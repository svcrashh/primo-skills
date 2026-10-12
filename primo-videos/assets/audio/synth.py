#!/usr/bin/env python3
"""synth · biblioteca de trilha sintetizada das skills de vídeo.

Dá os instrumentos, a mesa de mixagem e a masterização. NÃO dá a música: cada vídeo
compõe a sua (gênero, tom, BPM, timbres) num arquivo de arranjo próprio.

Uso num arranjo:
    import synth
    synth.configurar(AQUI / 'sheet.json')   # SR, N, SEGMENTS, rng, buses… passam a valer
    from synth import *                       # SEMPRE depois do configurar
    place(corda(M(64), 1.2), 0.5, 'keys', gain=0.8, rev=0.2)
    …
    salvar(soma_buses() + 0.4 * rev_out + 0.8 * dly_out)

Convenções: tempo em segundos; sinal mono (n,) ou estéreo (2, n) em float64. Instrumentos
originais saem com pico 1,0; os da paleta ampliada saem com pico = amp (padrão 0,5 ≈ -6 dBFS).
Todo som começa e termina em zero (rampa cosseno), então nada estala ao ser somado.
Tudo em numpy/scipy, sem ffmpeg na cadeia: o arquivo começa exatamente em t=0.
"""
import json
import math
import wave
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt, sosfiltfilt

TAU = 2 * np.pi
BUSES_PADRAO = ('drums', 'pad', 'saw', 'bass', 'arp', 'lead', 'keys', 'fx')

# Estado do módulo, preenchido por configurar(). Os valores iniciais só deixam os
# instrumentos utilizáveis sem folha (testes); a mesa e o master exigem configurar().
FOLHA = {}
SR = 48_000
N = 0
DURACAO = 0.0
BPM = 120.0
BATIDA = 0.5              # segundos por tempo (60 / BPM)
COMPASSO = 4
SILENCIOS = []            # [(de, ate)] com silêncio digital exato
SEGMENTS = []             # trechos contínuos = complemento dos silêncios em [0, duracao]
FADE = None               # (de, ate) do fade final, ou None
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
SAIDA = None              # Path do WAV final
rng = np.random.default_rng(0)
BUSES = list(BUSES_PADRAO)
bus = {}
sends = {'rev': {}, 'dly': {}}
evt_clips = {}            # 100 ms iniciais de cada som marcado event=True, por amostra de início
CLIP = 4800

# Ponderação K (BS.1770) — coeficientes exatos para 48 kHz; outras taxas em configurar().
KB1, KA1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
KB2, KA2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]


def _k_coefs(sr):
    """Ponderação K para qualquer taxa (mesmas fórmulas do libebur128)."""
    f0, g, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = math.tan(math.pi * f0 / sr)
    vh = 10 ** (g / 20)
    vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    b1 = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    a1 = [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = math.tan(math.pi * f0 / sr)
    a0 = 1 + k / q + k * k
    return b1, a1, [1.0, -2.0, 1.0], [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]


def configurar(folha, buses=BUSES_PADRAO):
    """Lê a folha (caminho do sheet.json ou dict) e zera o estado do módulo para um arranjo novo."""
    global FOLHA, SR, N, DURACAO, BPM, BATIDA, COMPASSO, SILENCIOS, SEGMENTS, FADE
    global TARGET_LUFS, CEILING_DBTP, SAIDA, rng, CLIP, KB1, KA1, KB2, KA2
    if isinstance(folha, dict):
        base, f = Path.cwd(), dict(folha)
    else:
        p = Path(folha).resolve()
        if not p.exists():
            raise FileNotFoundError(f'sheet not found: {p}')
        base, f = p.parent, json.loads(p.read_text(encoding='utf-8'))
    faltam = [k for k in ('duracao', 'taxa', 'saida', 'loudness_lufs', 'teto_dbtp', 'semente') if k not in f]
    if faltam:
        raise ValueError(f'the sheet is missing {", ".join(faltam)} — see the schema in API.md')

    FOLHA = f
    SR = int(f['taxa'])
    DURACAO = float(f['duracao'])
    N = int(round(DURACAO * SR))
    BPM = f.get('bpm', 120)
    BATIDA = 60.0 / BPM
    COMPASSO = int(f.get('compasso', 4))
    SILENCIOS = sorted((float(a), float(b)) for a, b in f.get('silencios', []))
    SEGMENTS, cur = [], 0.0
    for a, b in SILENCIOS:
        if not (cur <= a < b <= DURACAO):
            raise ValueError(f'silence [{a}, {b}] outside [0, {DURACAO}] or overlapping the previous one')
        if a > cur:
            SEGMENTS.append((cur, a))
        cur = b
    if cur < DURACAO:
        SEGMENTS.append((cur, DURACAO))
    fd = f.get('fade')
    FADE = (float(fd[0]), float(fd[1])) if fd else None
    if FADE and not (0 <= FADE[0] < FADE[1] <= DURACAO):
        raise ValueError(f'fade {list(FADE)} must be within [0, {DURACAO}] with de < ate')
    TARGET_LUFS = float(f['loudness_lufs'])
    CEILING_DBTP = float(f['teto_dbtp'])
    SAIDA = (base / f['saida']).resolve()
    rng = np.random.default_rng(int(f['semente']))
    CLIP = S(0.1)
    if SR != 48_000:
        KB1, KA1, KB2, KA2 = _k_coefs(SR)
    BUSES[:] = list(buses)
    bus.clear()
    bus.update({k: np.zeros((2, N)) for k in BUSES})
    for d in sends.values():
        d.clear()
    evt_clips.clear()
    return FOLHA


# ------------------------------------------------------------------ utilitários
def S(t):
    return int(round(t * SR))


def M(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


_NOTAS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nota(nome):
    """Nome de nota → MIDI: 'A4' → 69, 'F#3' → 54, 'Bb2' → 46. Use com M(): M(nota('C#4'))."""
    s = nome.strip()
    k, i = _NOTAS[s[0].upper()], 1
    while i < len(s) and s[i] in '#b':
        k += 1 if s[i] == '#' else -1
        i += 1
    return 12 * (int(s[i:]) + 1) + k


def T(n):
    return np.arange(n) / SR


def sos_lp(f, o=2):
    return butter(o, f, 'low', fs=SR, output='sos')


def sos_hp(f, o=2):
    return butter(o, f, 'high', fs=SR, output='sos')


def sos_bp(f1, f2, o=2):
    return butter(o, [f1, f2], 'band', fs=SR, output='sos')


def noise(n, ch=None):
    return rng.standard_normal(n if ch is None else (ch, n))


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


def edges(n, a=0.003, r=0.005):
    """Rampa cosseno de entrada e saída: começa e termina exatamente em zero."""
    e = np.ones(n)
    na, nr = min(n, max(2, S(a))), min(n, max(2, S(r)))
    e[:na] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    e[n - nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nr + 1) / nr)
    return e


def tail_fade(x, r=0.005):
    n = x.shape[-1]
    nr = min(n, S(r))
    x[..., n - nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, nr + 1) / nr)
    return x


def curve(t, pts):
    ts, vs = zip(*pts)
    return np.exp(np.interp(t, ts, np.log(np.asarray(vs, float))))


def to_stereo(y, pan):
    th = (np.asarray(pan) + 1.0) * np.pi / 4
    return np.stack([y * np.cos(th), y * np.sin(th)]) * math.sqrt(2)


def adsr(dur, a=0.01, d=0.1, s=0.7, r=0.2):
    """Envelope de dur + r segundos: ataque cosseno, queda exponencial (constante d) até s, release cosseno até zero."""
    nd = max(1, S(dur))
    n = max(nd + 2, S(dur + r))
    nr = n - nd
    na = max(1, min(nd, S(a)))
    env = np.empty(n)
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    env[na:nd] = s + (1 - s) * np.exp(-np.arange(nd - na) / SR / max(d, 1e-4))
    env[nd:] = env[nd - 1] * (0.5 + 0.5 * np.cos(np.pi * np.arange(1, nr + 1) / nr))
    return env


def _fecha(y, amp, a=0.002, r=0.02, normaliza=True):
    """Rampas de borda, DC zerado (com um bump subsônico que respeita as bordas) e pico = amp."""
    y = np.asarray(y, float) * edges(np.shape(y)[-1], a, r)
    n = y.shape[-1]
    w = np.sin(np.pi * np.arange(n) / (n - 1)) ** 2
    y = y - y.mean(axis=-1, keepdims=True) / w.mean() * w
    return norm(y) * amp if normaliza else y * amp


# ------------------------------------------------------------------ filtros variáveis
def rbj(kind, fc, q):
    fc = min(max(fc, 20.0), 0.45 * SR)
    w = TAU * fc / SR
    c, al = math.cos(w), math.sin(w) / (2 * q)
    a0 = 1 + al
    if kind == 'lp':
        b = ((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0)
    elif kind == 'hp':
        b = ((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0)
    else:
        b = (al / a0, 0.0, -al / a0)
    return np.array(b), np.array((1.0, -2 * c / a0, (1 - al) / a0))


def tv_filter(x, fc, q=0.707, kind='lp', block=64):
    """Biquad com corte variando no tempo (coeficientes por bloco, estado contínuo)."""
    x = np.asarray(x, float)
    mono = x.ndim == 1
    X = x[None, :] if mono else x
    n = X.shape[1]
    fc = np.broadcast_to(np.asarray(fc, float), (n,))
    Y = np.empty_like(X)
    zi = np.zeros((X.shape[0], 2))
    for i in range(0, n, block):
        j = min(i + block, n)
        b, a = rbj(kind, fc[(i + j) // 2], q)
        Y[:, i:j], zi = lfilter(b, a, X[:, i:j], axis=-1, zi=zi)
    return Y[0] if mono else Y


# ------------------------------------------------------------------ osciladores
def _blep(ph, dt):
    y = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] = x + x - x * x - 1.0
    m = ph > 1.0 - dt
    x = (ph[m] - 1.0) / dt[m]
    y[m] = x * x + x + x + 1.0
    return y


def saw(freq, n, ph0=None):
    """Dente de serra PolyBLEP (sem o aliasing do serra ingênuo)."""
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    dt = f / SR
    ph = ((rng.random() if ph0 is None else ph0) + np.cumsum(dt)) % 1.0
    return 2.0 * ph - 1.0 - _blep(ph, dt)


def tone(f0, dur, parts, attack=0.003, release=0.02, rand_phase=False):
    """Soma de parciais senoidais (ratio, amp, tau). Parcial acima de 18,5 kHz é descartado."""
    n = S(dur)
    t = T(n)
    y = np.zeros(n)
    for r, a, tau in parts:
        f = f0 * r
        if f > 18500:
            continue
        p = rng.uniform(0, TAU) if rand_phase else 0.0
        y += a * np.sin(TAU * f * t + p) * (np.exp(-t / tau) if tau else 1.0)
    return norm(y * edges(n, attack, release))


# ------------------------------------------------------------------ instrumentos tonais (paleta original)
def pluck(f0, dur=0.6, bright=0.6, tau=0.35, attack=0.003):
    """Pluck aditivo: harmônicos agudos decaem mais rápido (é o 'filtro' fechando)."""
    n = S(dur)
    t = T(n)
    ph = TAU * f0 * t
    k = 0.06 + 1.4 * (1.0 - bright) ** 1.6
    roll = 0.18 * (1.0 - bright)
    y = np.zeros(n)
    for h in range(1, max(1, min(40, int(17000 // f0))) + 1):
        th = tau / (1.0 + k * (h - 1))
        if th < 0.003:
            break
        y += np.exp(-roll * (h - 1)) / h * np.sin(h * ph) * np.exp(-t / th)
    return norm(y * edges(n, attack, 0.02))


def pling(f0, dur=1.8, bell=0.6, decay=1.0):
    """Marimba + sino: parcial 3,93 é o da barra de marimba; 2,0/3,0/5,4 dão o brilho de sino."""
    parts = [(1.0, 1.0, 0.9 * decay), (2.0, 0.22 * bell, 0.55 * decay), (3.0, 0.10 * bell, 0.30 * decay),
             (3.93, 0.30, 0.10), (5.40, 0.10 * bell, 0.18 * decay), (9.2, 0.06, 0.035)]
    y = tone(f0, dur, parts, attack=0.002, release=0.05)
    n = len(y)
    mallet = norm(sosfilt(sos_bp(1500, 5000), noise(n)) * np.exp(-T(n) / 0.004)) * edges(n, 0.002, 0.01)
    return norm(y + 0.15 * mallet)


def bell(f0, dur=2.5, bright=1.0, decay=1.0):
    """Sino/celesta aditivo de parciais inarmônicos; confirmação, 'salvar', brilho."""
    return tone(f0, dur, [(1, 1, 1.6 * decay), (2.0, 0.45, 0.9 * decay), (2.76, 0.28 * bright, 0.45 * decay),
                          (4.07, 0.18 * bright, 0.28 * decay), (5.43, 0.10 * bright, 0.18 * decay),
                          (6.8, 0.05 * bright, 0.10 * decay)], attack=0.003, release=0.08)


def flip_snap(dur=0.09):
    """Estalo do cartão virando: rajada curta de ruído médio-agudo + toque seco."""
    n = S(dur)
    t = T(n)
    nz = norm(sosfilt(sos_bp(1500, 6000), noise(n)) * np.exp(-t / 0.008))
    return norm((nz + 0.5 * tick(1800, dur)) * edges(n, 0.002, 0.02))


def glint(f, dur=0.35):
    """Brilho curtíssimo (cascata de 'glints' agudos = faísca)."""
    return tone(f, dur, [(1, 1, 0.12), (2.0, 0.35, 0.06), (3.0, 0.12, 0.03)], attack=0.002, release=0.03)


def shimmer_pad(f0, dur):
    """Pad senoidal com tremolo, bem discreto, para cama aguda."""
    n = S(dur)
    t = T(n)
    y = np.sin(TAU * f0 * t) * (1 + 0.25 * np.sin(TAU * 4.5 * t)) + 0.25 * np.sin(TAU * 2 * f0 * t + 1.0)
    return norm(y) * edges(n, 0.7, 1.2)


def pad_note(f0, dur, attack=0.3, release=0.6, amp=1.0, det=7.0, pitch=None):
    """Pad estéreo (4 vozes serra+seno desafinadas); devolve dur + release. `pitch(t)` multiplica a frequência."""
    n = S(dur + release)
    t = T(n)
    env = np.ones(n)
    na = min(n, S(attack))
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    nd = S(dur)
    env[nd:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, n - nd + 1) / (n - nd))
    pm = 1.0 if pitch is None else pitch(t)
    out = np.zeros((2, n))
    for cents, pan in ((-det, -0.8), (-det / 3, -0.3), (det / 3, 0.3), (det, 0.8)):
        f = f0 * 2 ** (cents / 1200) * pm
        ph = TAU * np.cumsum(np.broadcast_to(f, (n,))) / SR + rng.uniform(0, TAU)
        v = 0.55 * saw(f, n) + 0.45 * np.sin(ph)
        out += to_stereo(v, pan)
    return out * env * amp / 4


def supersaw_note(f0, dur, attack=0.008, release=0.15, amp=1.0, det=16.0, pitch=None, decay=None):
    """Supersaw estéreo de 7 serras (EDM/pop); devolve dur + release."""
    n = S(dur + release)
    t = T(n)
    env = np.ones(n)
    na = min(n, S(attack))
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    nd = S(dur)
    env[nd:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, n - nd + 1) / (n - nd))
    if decay:
        env *= np.exp(-t / decay)
    pm = 1.0 if pitch is None else pitch(t)
    out = np.zeros((2, n))
    offs = (-1.0, -0.62, -0.28, 0.0, 0.3, 0.64, 1.0)
    amps = (0.55, 0.7, 0.85, 1.0, 0.85, 0.7, 0.55)
    for o, a in zip(offs, amps):
        out += to_stereo(a * saw(f0 * 2 ** (o * det / 1200) * pm, n), 0.85 * o)
    return out * env * amp / 5


def bass_note(f0, dur, bright=0.5, amp=1.0, sub=0.6, pitch=None, release=0.02, decay=None):
    """Baixo aditivo (mono): harmônicos até ~1,6 kHz, brilho que decai como filtro."""
    n = S(dur)
    t = T(n)
    f = f0 * (1.0 if pitch is None else pitch(t)) * np.ones(n)
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    y = sub * np.sin(ph)
    for h in range(1, int(min(28, 1600 / f0)) + 1):
        tau_h = 0.5 / (1 + (h - 1) * (1.4 - bright) * 0.8)
        a = np.exp(-(h - 1) * (1 - bright) * 0.35) / h
        y += a * np.sin(h * ph) * (0.35 + 0.65 * np.exp(-t / tau_h))
    env = edges(n, 0.004, release)
    if decay:
        env *= np.exp(-t / decay)
    return norm(y * env) * amp


def lead_note(f0, dur, rel=0.07):
    """Lead estéreo aditivo com vibrato atrasado (gancho/melodia); devolve dur + rel."""
    n = S(dur + rel)
    t = T(n)
    vd = 0.0045 * np.clip((t - 0.18) / 0.25, 0, 1)
    out = np.zeros((2, n))
    hmax = int(min(24, 16000 // f0))
    for c, det in enumerate((-6.0, 6.0)):
        f = f0 * 2 ** (det / 1200) * (1 + vd * np.sin(TAU * 5.6 * t + c))
        ph = TAU * np.cumsum(f) / SR
        y = np.zeros(n)
        for h in range(1, hmax + 1):
            s = math.exp(-(h - 1) / 3.5)
            y += (s + (1 - s) * np.exp(-t / (0.09 / (1 + 0.15 * h)))) / h * np.sin(h * ph)
        out[c] = y
    env = np.ones(n)
    na = S(0.005)
    env[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    env *= 0.72 + 0.28 * np.exp(-t / 0.12)
    nd = S(dur)
    env[nd:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(1, n - nd + 1) / (n - nd))
    return norm(out * env)


# ------------------------------------------------------------------ bateria (paleta original)
def kick(dur=0.42, f_hi=160.0, f_lo=47.0, p_tau=0.035, a_tau=0.13, click=0.25, drive=1.8):
    """Bumbo eletrônico: queda de pitch, saturação e clique."""
    n = S(dur)
    t = T(n)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / p_tau)
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    body = np.tanh(drive * np.sin(ph) * np.exp(-t / a_tau)) / np.tanh(drive)
    cl = norm(sosfilt(sos_bp(1200, 6000), noise(n)) * np.exp(-t / 0.004))
    return norm((body + click * cl) * edges(n, 0.002, 0.03))


def subboom(dur=1.6, f_hi=95.0, f_lo=41.0, p_tau=0.22, a_tau=0.55):
    """Sub grave com queda de pitch (reforço de impacto)."""
    n = S(dur)
    t = T(n)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / p_tau)
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    return np.sin(ph) * np.exp(-t / a_tau) * edges(n, 0.004, 0.2)


def crash(dur=2.4, tau=0.85, lp=12000.0):
    """Prato de ataque estéreo (ruído + 36 parciais metálicos). Invertido com [:, ::-1] vira crash reverso."""
    n = S(dur)
    t = T(n)
    nz = sosfilt(sos_lp(lp), sosfilt(sos_hp(3200), noise(n, 2), axis=1), axis=1)
    metal = np.zeros((2, n))
    for _ in range(36):
        f, a, tt = rng.uniform(2800, 10500), rng.uniform(0.2, 1.0), tau * rng.uniform(0.4, 1.1)
        for c in range(2):
            metal[c] += a * np.sin(TAU * f * (1 + 0.002 * c) * t + rng.uniform(0, TAU)) * np.exp(-t / tt)
    env = np.exp(-t / tau) * (1.0 + 1.2 * np.exp(-t / 0.03))
    return norm((0.75 * norm(nz) + 0.35 * norm(metal)) * env * edges(n, 0.002, 0.15))


def hat(dur=0.2, tau=0.06):
    """Chimbal: ruído em banda 6,5–12 kHz; tau curto = fechado."""
    n = S(dur)
    x = sosfilt(sos_bp(6500, 12000), noise(n))
    return norm(x * np.exp(-T(n) / tau) * edges(n, 0.002, 0.02))


def clap(dur=0.35):
    """Palma eletrônica estéreo (3 rajadas + cauda)."""
    n = S(dur)
    t = T(n)
    out = np.zeros((2, n))
    for c in range(2):
        x = sosfilt(sos_bp(850, 2600), noise(n))
        env = np.zeros(n)
        for tb, g, tau in ((0.0, 1.0, 0.004), (0.009, 1.0, 0.004), (0.018, 1.0, 0.004), (0.02, 0.55, 0.085)):
            tt = t - tb
            m = tt >= 0
            env[m] += g * np.exp(-tt[m] / tau) * np.minimum(1.0, tt[m] / 0.002)
        out[c] = x * env
    return norm(out * edges(n, 0.002, 0.03))


def snare(dur=0.22, f=190.0):
    """Caixa: corpo tonal + esteira de ruído."""
    n = S(dur)
    t = T(n)
    fa = f * (1 + 0.3 * np.exp(-t / 0.01))
    body = np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / 0.045)
    nz = norm(sosfilt(sos_bp(1800, 8000), noise(n)) * np.exp(-t / 0.07))
    return norm((0.6 * body + 0.8 * nz) * edges(n, 0.002, 0.02))


def tom(f0, dur=0.55):
    """Tom de bateria afinado em f0 (Hz)."""
    n = S(dur)
    t = T(n)
    fa = f0 * (1 + 0.5 * np.exp(-t / 0.03))
    body = np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / 0.2)
    hit = norm(sosfilt(sos_bp(300, 3000), noise(n)) * np.exp(-t / 0.01))
    return norm((body + 0.3 * hit) * edges(n, 0.002, 0.04))


def _bumbo_acustico(dur=0.38, f_hi=95.0, f_lo=57.0, a_tau=0.1, batedor=0.3, drive=1.0):
    """Bumbo de bateria: pele que cai pouco de afinação, casco, feltro do batedor e o ar da pele."""
    n = S(dur)
    t = T(n)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.012)
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    pele = np.sin(ph) * np.exp(-t / a_tau) + 0.25 * np.sin(2.1 * ph) * np.exp(-t / 0.035)
    casco = 0.2 * np.sin(TAU * 118 * t) * np.exp(-t / 0.05)
    feltro = norm(sosfilt(sos_bp(1500, 5000), noise(n)) * np.exp(-t / 0.003))
    ar = norm(sosfilt(sos_lp(600), noise(n)) * np.exp(-t / 0.02))
    y = pele + casco + batedor * feltro + 0.25 * ar
    if drive > 1.0:
        y = np.tanh(drive * y / np.abs(y).max()) / np.tanh(drive)
    return norm(y * edges(n, 0.001, 0.03))


def bumbo(tipo='eletronico'):
    """Bumbo do gênero (pico 1,0). 'eletronico' é o de sempre; os outros seguem a convenção de cada pista:
    house     redondo e firme (909): queda de afinação de ~7 ms, o grave chega em ~13 ms e decai (−5 dB em 100 ms);
    techno    duro e longo: mais saturação, clique forte e um rumble grave, abaixo do golpe, que entra aos 120 ms;
    garage    seco e curto, com soco, para caber entre as síncopes do 2-step;
    acustico  bumbo de bateria: pele, casco e feltro do batedor, sem queda eletrônica de afinação;
    break     bateria acústica comprimida, com mais batedor (o break sampleado)."""
    if tipo == 'eletronico':
        return kick(dur=0.35, f_hi=120, f_lo=48, p_tau=0.03, a_tau=0.12, click=0.08, drive=1.2)
    if tipo == 'house':
        return kick(dur=0.42, f_hi=160, f_lo=52, p_tau=0.007, a_tau=0.14, click=0.14, drive=1.2)
    if tipo == 'techno':
        corpo = kick(dur=0.62, f_hi=170, f_lo=47, p_tau=0.006, a_tau=0.18, click=0.22, drive=2.2)
        n = len(corpo)
        t = T(n)
        cauda = np.clip((t - 0.12) / 0.06, 0, 1) * np.exp(-(t - 0.12) / 0.18)
        rumble = sosfilt(sos_lp(140, 4), np.sin(TAU * 47 * t) + 0.6 * noise(n)) * cauda
        return norm((corpo + 0.1 * norm(rumble)) * edges(n, 0.001, 0.05))
    if tipo == 'garage':
        return kick(dur=0.3, f_hi=150, f_lo=55, p_tau=0.007, a_tau=0.12, click=0.16, drive=1.8)
    if tipo == 'acustico':
        return _bumbo_acustico()
    if tipo == 'break':
        return _bumbo_acustico(dur=0.3, f_hi=110, f_lo=60, a_tau=0.08, batedor=0.55, drive=2.5)
    raise ValueError(f'bumbo {tipo!r} does not exist (use eletronico, house, techno, garage, acustico, break)')


# ------------------------------------------------------------------ efeitos de sincronia
def thud(dur=0.35):
    """Baque grave e seco (algo pousando na tela)."""
    n = S(dur)
    t = T(n)
    fa = 55 + 70 * np.exp(-t / 0.03)
    body = np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / 0.09)
    lpn = norm(sosfilt(sos_lp(350), noise(n)) * np.exp(-t / 0.02))
    return norm((body + 0.5 * lpn) * edges(n, 0.002, 0.03))


def woodclick(f=1250.0, dur=0.08):
    """Clique de madeira (encaixe de peça)."""
    n = S(dur)
    t = T(n)
    y = np.sin(TAU * f * t) * np.exp(-t / 0.012) + 0.5 * np.sin(TAU * f * 2.37 * t) * np.exp(-t / 0.006)
    nz = sosfilt(sos_bp(1500, 4000), noise(n)) * np.exp(-t / 0.003)
    return norm((norm(y) + 0.4 * norm(nz)) * edges(n, 0.002, 0.01))


def tick(f=2600.0, dur=0.06):
    """Tique agudo curto (letra, cursor, UI)."""
    n = S(dur)
    t = T(n)
    y = np.sin(TAU * f * t) * np.exp(-t / 0.006) + 0.4 * np.sin(TAU * 1.5 * f * t) * np.exp(-t / 0.004)
    return norm(y * edges(n, 0.002, 0.01))


def tap(dur=0.08):
    """Toque de dedo em tela."""
    n = S(dur)
    t = T(n)
    y = np.sin(TAU * 2300 * t) * np.exp(-t / 0.008) + 0.6 * np.sin(TAU * 1150 * t) * np.exp(-t / 0.018)
    nz = sosfilt(sos_lp(11000), sosfilt(sos_hp(3000), noise(n))) * np.exp(-t / 0.002)
    return norm((norm(y) + 0.3 * norm(nz)) * edges(n, 0.002, 0.01))


def pop(f_start=450.0, f_end=1500.0, glide=0.02, tau=0.035, dur=0.14):
    """'Pop' de bolha subindo de pitch (destaque, pílula, balão)."""
    n = S(dur)
    t = T(n)
    fa = f_start * (f_end / f_start) ** np.clip(t / glide, 0, 1)
    return norm(np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / tau) * edges(n, 0.002, 0.02))


def tumble(dur=0.3):
    """Letras antigas despencando: toques de madeira caindo de tom e acelerando."""
    out = np.zeros(S(dur))
    for dt, f, g in ((0.0, 1500, 1.0), (0.06, 1150, 0.7), (0.105, 900, 0.5), (0.14, 720, 0.35)):
        w = woodclick(f, 0.08) * g
        i = S(dt)
        n = min(len(w), len(out) - i)
        out[i:i + n] += w[:n]
    return norm(out)


def scribble(dur=0.22):
    """Caneta riscando: ruído em banda com traços rápidos (~23/s) e crepitação de papel."""
    n = S(dur)
    t = T(n)
    ps = TAU * np.cumsum(23.0 * (1.0 + 0.12 * np.sin(TAU * 2.7 * t + 0.6))) / SR
    stroke = 0.25 + 0.75 * (0.5 + 0.5 * np.cos(ps)) ** 1.2   # começa no topo do traço
    fc = 2600.0 * (1.0 + 0.45 * np.sin(ps * 0.5 + 0.4)) * (1 + 0.5 * t / dur)
    body = norm(tv_filter(noise(n), fc, 1.6, 'bp', block=32))
    grit = sosfilt(sos_lp(11000), sosfilt(sos_hp(5000), noise(n) * (rng.random(n) < 0.02)))
    y = (body + 0.25 * norm(grit)) * stroke * edges(n, 0.002, 0.03) * (1.0 - 0.3 * t / dur)
    return norm(to_stereo(y, np.linspace(-0.6, 0.6, n)))


def whoosh(dur, tp, f0, f1, f2, q=1.0, pan=(-0.5, 0.5), up=2.0, down=3.0, hard_end=False):
    """Whoosh estéreo: banda de ruído f0→f1 até o pico tp e f1→f2 depois; tp >= dur = só subida (termina seco)."""
    n = S(dur)
    t = T(n)
    fc = curve(t, [(0, f0), (tp, f1), (dur + 1e-6, f2)]) if tp < dur else curve(t, [(0, f0), (dur, f1)])
    a = tv_filter(noise(n), fc, q, 'bp', block=32)
    b = tv_filter(noise(n), fc * 1.02, q, 'bp', block=32)
    if tp >= dur:
        env = (t / dur) ** up
    else:
        env = np.where(t < tp, (t / max(tp, 1e-4)) ** up, np.exp(-down * (t - tp) / (dur - tp)))
    env = env * edges(n, 0.003, 0.004 if hard_end else 0.05)
    th = (np.linspace(pan[0], pan[1], n) + 1) * np.pi / 4
    y = np.stack([(0.8 * a + 0.2 * b) * np.cos(th), (0.8 * b + 0.2 * a) * np.sin(th)]) * math.sqrt(2)
    return norm(y * env)


def morph(dur=0.35):
    """Transformação: ruído subindo + tom que desliza (um elemento virando outro)."""
    n = S(dur)
    t = T(n)
    nz = norm(tv_filter(noise(n), curve(t, [(0, 1400), (dur, 6000)]), 1.4, 'bp', block=32))
    fa = 660 * (1 + 0.6 * np.clip(t / 0.15, 0, 1))
    ton = np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / 0.07)
    y = (0.7 * nz + 0.35 * ton) * np.exp(-t / 0.09) * edges(n, 0.002, 0.03)
    return norm(to_stereo(y, np.linspace(-0.3, 0.3, n)))


def riser(dur, m0, m1, f0=300.0, f1=9000.0, power=2.2):
    """Riser estéreo: ruído abrindo + tom subindo de MIDI m0 a m1, crescendo até o fim."""
    n = S(dur)
    t = T(n)
    x = t / dur
    nz = norm(tv_filter(noise(n, 2), f0 * (f1 / f0) ** (x ** 1.5), 0.9, 'bp', block=32))
    fa = M(m0) * (M(m1) / M(m0)) ** (x ** 1.3)
    ph = TAU * np.cumsum(fa) / SR
    ton = sum(np.sin(h * ph) / h for h in range(1, int(18000 // M(m1)) + 1) if h <= 8)
    return (0.7 * nz + 0.35 * norm(ton)[None, :]) * x ** power * edges(n, 0.01, 0.005)


def powerdown(dur=1.0):
    """Desligando: tom e ruído caindo de 1,6 kHz a 60 Hz."""
    n = S(dur)
    t = T(n)
    x = t / dur
    fa = 1600 * (60 / 1600) ** (x ** 0.8)
    ph = TAU * (np.cumsum(fa) - fa[0]) / SR
    ton = norm(sum(np.sin(h * ph) / h ** 1.5 for h in range(1, 5)))
    nz = norm(tv_filter(noise(n), curve(t, [(0, 5000), (dur, 200)]), 1.0, 'bp', block=32))
    y = (0.6 * ton + 0.4 * nz) * (1 - x) ** 0.8 * edges(n, 0.015, 0.02)
    return to_stereo(y, np.linspace(0.4, 0.0, n))


# ------------------------------------------------------------------ paleta ampliada · tonais
def corda(f0, dur=1.5, brilho=0.5, decaimento=1.2, posicao=0.18, amp=0.5):
    """Corda dedilhada Karplus-Strong: violão (brilho ~0,5), harpa (brilho baixo, decaimento longo), koto (brilho alto, posicao ~0,08)."""
    n = S(dur)
    P = SR / f0
    L = max(2, int(P - 0.6))
    d = P - 0.5 - L                       # atraso fracionário que falta, feito por um all-pass
    c = (1 - d) / (1 + d)
    g = 10 ** (-3 / (f0 * max(decaimento, 0.05)))
    # y = x + g·z^-L·média(2)·allpass·y  →  um único IIR (filtro pente) no lfilter
    a = np.zeros(L + 3)
    a[0], a[1] = 1.0, c
    a[L] -= g * c / 2
    a[L + 1] -= g * (1 + c) / 2
    a[L + 2] -= g / 2
    ne = min(n, L + 1)
    burst = sosfilt(sos_lp(min(0.4 * SR, 900 + 11000 * brilho ** 1.5)), noise(ne))
    k = max(1, int(round(posicao * P)))
    if k < ne:
        burst[k:] -= burst[:-k].copy()    # ponto de ataque: tira os harmônicos múltiplos de 1/posicao
    exc = np.zeros(n)
    exc[:ne] = burst * np.hanning(ne)     # sem degrau no começo/fim do burst (degrau circula no laço = clique)
    y = lfilter([1.0, c], a, exc)
    return _fecha(y, amp, 0.001, min(0.05, dur / 4))


def epiano(f0, dur=1.0, vel=0.8, brilho=0.5, release=0.3, tremolo=0.0, amp=0.5):
    """Piano elétrico FM (Rhodes): par 1:1 com índice que cai + 'tine' metálico no ataque; neo-soul, lo-fi, R&B. Devolve dur + release."""
    tau = float(np.clip(2.2 * (261.6 / f0) ** 0.5, 0.4, 4.0))
    env = adsr(dur, a=0.002, d=tau, s=0.0, r=release)
    t = T(len(env))
    ph = TAU * f0 * t
    i1 = (0.4 + 1.8 * brilho * vel) * np.exp(-t / 0.35) + 0.15 * vel
    y = np.sin(ph + i1 * np.sin(ph)) + 0.15 * vel * np.sin(2 * ph) * np.exp(-t / 0.3)
    i2max = 1.2 * vel
    rt = min(14.0, (18000.0 / f0 - 1) / (2 + i2max))   # razão do tine: até a 2ª banda lateral fica < 18 kHz
    if rt >= 2:
        y += 0.35 * np.sin(ph + i2max * np.exp(-t / 0.012) * np.sin(rt * ph)) * np.exp(-t / 0.05)
    if tremolo:
        y *= 1 - tremolo * 0.5 * (1 - np.cos(TAU * 5.2 * t))
    return _fecha(y * env, amp, 0.001, 0.005)


def piano(f0, dur=1.5, vel=0.7, release=0.25, amp=0.5):
    """Piano acústico aditivo: parciais levemente inarmônicos, 2 cordas desafinadas, decaimento em 2 estágios e martelo; balada, trilha emotiva. Devolve dur + release."""
    env_nota = adsr(dur, a=0.001, d=1.0, s=1.0, r=release)
    n = len(env_nota)
    t = T(n)
    B = float(np.clip(0.0004 * (f0 / 440.0) ** 0.5, 1e-4, 2e-3))
    tau1 = float(np.clip(0.9 * (261.6 / f0) ** 0.7, 0.12, 4.0))
    y = np.zeros(n)
    for h in range(1, 41):
        fh = h * f0 * math.sqrt(1 + B * h * h)
        if fh > 16000:
            break
        a = (0.15 + abs(math.sin(math.pi * h / 7.3))) / h ** (1.5 - 0.6 * vel)
        th = tau1 / (1 + 0.12 * (h - 1) ** 1.2)
        env = 0.75 * np.exp(-t / (0.35 * th)) + 0.25 * np.exp(-t / (2.5 * th))
        dh = 1 + rng.uniform(0.0001, 0.0006)     # 2ª corda desafinada diferente em cada parcial: batimento
        y += a * env * (np.sin(TAU * fh * t) + 0.7 * np.sin(TAU * fh * dh * t + rng.uniform(0, TAU)))  # sem padrão de phaser
    ham = norm(sosfilt(sos_lp(1500 + 4000 * vel), noise(n)) * np.exp(-t / 0.004))
    y = norm(y) + 0.06 * (0.5 + vel) * ham
    return _fecha(y * env_nota, amp, 0.001, 0.005)


_RATIOS_ORGAO = (0.5, 1.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0)   # 16' 5⅓' 8' 4' 2⅔' 2' 1⅗' 1⅓' 1'


def orgao(f0, dur=1.0, drawbars='888000000', leslie=0.3, clique=0.3, release=0.06, amp=0.5):
    """Órgão de drawbars (tipo Hammond): '888000000' gospel/rock, '800000888' agudo; clique de tecla e Leslie; soul, reggae, igreja. Devolve dur + release."""
    if len(drawbars) != 9 or not drawbars.isdigit() or max(drawbars) > '8':
        raise ValueError(f"drawbars must be 9 digits from 0 to 8 (e.g. '888000000'), got {drawbars!r}")
    env = adsr(dur, a=0.004, d=1.0, s=1.0, r=release)
    n = len(env)
    t = T(n)
    f = f0 * (1 + leslie * 0.0035 * np.sin(TAU * 6.3 * t))
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    y = np.zeros(n)
    for r, k in zip(_RATIOS_ORGAO, drawbars):
        if k != '0' and r * f0 < 18000:
            y += 10 ** (-(8 - int(k)) * 3 / 20) * np.sin(r * ph)
    y *= 1 - leslie * 0.18 * (0.5 - 0.5 * np.cos(TAU * 6.3 * t + 0.8))
    ck = norm(sosfilt(sos_bp(1500, 7000), noise(n)) * np.exp(-t / 0.0025))
    y = norm(y) + 0.3 * clique * ck
    return _fecha(y * env, amp, 0.001, 0.005)


def baixo808(f0, dur=0.8, glide=0.0, de=None, drive=2.0, decay=None, release=0.08, amp=0.5):
    """Baixo 808: senoide sub com 'punch' de pitch no ataque, glide opcional (de `de` Hz até f0 em `glide` s) e saturação; trap, funk, hip-hop."""
    n = S(dur)
    t = T(n)
    f = np.full(n, float(f0))
    if de and glide > 0:
        x = 0.5 - 0.5 * np.cos(np.pi * np.clip(t / glide, 0, 1))
        f = de * (f0 / de) ** x
    f = f * 2 ** (0.5 * np.exp(-t / 0.012))
    ph = TAU * (np.cumsum(f) - f[0]) / SR
    y = np.tanh(drive * np.sin(ph)) / np.tanh(drive)
    if decay:
        y *= np.exp(-t / decay)
    return _fecha(sosfilt(sos_lp(5000), y), amp, 0.002, release)


def baixo_serra(f0, dur=0.2, corte=420.0, q=1.6, env=3.0, decay=0.09, sub=0.5, amp=0.5):
    """Baixo de serra com filtro passa-baixa ressonante que abre no ataque e fecha em `decay` s (o baixo curto
    e repetido do techno; com decay longo e env alto, um acid discreto). Sub senoidal para o peso; mono."""
    n = S(dur)
    t = T(n)
    fc = corte * (1 + env * np.exp(-t / decay))
    y = tv_filter(saw(f0, n), fc, q=q, kind='lp') + sub * np.sin(TAU * f0 * t)
    return _fecha(sosfilt(sos_lp(4000), y), amp, 0.002, 0.012)


VOGAIS = {   # formantes de contralto: (Hz, dB, meia largura Hz)
    'a': ((800, 0, 80), (1150, -4, 90), (2800, -20, 120), (3500, -36, 130)),
    'e': ((400, 0, 60), (1600, -24, 80), (2700, -30, 120), (3300, -35, 150)),
    'i': ((350, 0, 50), (1700, -20, 100), (2700, -30, 120), (3700, -36, 150)),
    'o': ((450, 0, 70), (800, -9, 80), (2830, -16, 100), (3500, -28, 130)),
    'u': ((325, 0, 50), (700, -12, 60), (2530, -30, 170), (3500, -40, 180)),
}


def pad_coral(f0, dur=2.0, vogal='a', ataque=0.5, release=0.9, vozes=5, amp=0.5):
    """Pad de coro: vozes em serra com vibrato próprio passando pelos formantes da vogal ('a','e','i','o','u'); épico, gospel, etéreo. Estéreo, dur + release."""
    if vogal not in VOGAIS:
        raise ValueError(f'vogal must be one of {"/".join(VOGAIS)}, got {vogal!r}')
    env = adsr(dur, a=ataque, d=1.0, s=1.0, r=release)
    n = len(env)
    t = T(n)
    src = np.zeros((2, n))
    for v in range(vozes):
        x = 2 * v / (vozes - 1) - 1 if vozes > 1 else 0.0
        cents = 9 * x + rng.uniform(-2, 2)
        vib = 1 + rng.uniform(0.003, 0.006) * np.sin(TAU * rng.uniform(4.6, 5.8) * t + rng.uniform(0, TAU)) \
            * np.clip(t / 0.6, 0, 1)
        src += to_stereo(saw(f0 * 2 ** (cents / 1200) * vib, n), 0.7 * x)
    src += 0.04 * sosfilt(sos_hp(1500), noise(n, 2), axis=1)      # sopro
    y = np.zeros((2, n))
    for fc, db, bw in VOGAIS[vogal]:
        y += 10 ** (db / 20) * sosfilt(sos_bp(max(40, fc - bw), min(0.45 * SR, fc + bw)), src, axis=1)
    return _fecha(y * env, amp, 0.005, 0.01)


def metais(f0, dur=0.35, brilho=0.6, release=0.12, amp=0.5):
    """Stab de metais: 3 serras com 'scoop' de afinação e filtro que abre no ataque e fecha no sustain; funk, pop, fanfarra. Devolve dur + release."""
    env = adsr(dur, a=0.012, d=0.15, s=0.75, r=release)
    n = len(env)
    t = T(n)
    scoop = 2 ** (-0.4 / 12 * np.exp(-t / 0.025))
    x = sum(saw(f0 * 2 ** (c / 1200) * scoop, n) for c in (-8.0, 0.0, 7.0)) / 3
    fenv = (1 - np.exp(-t / 0.012)) * (0.45 + 0.55 * np.exp(-t / 0.12))
    fc = np.minimum(f0 * (1.5 + (3 + 14 * brilho) * fenv), 10000.0)
    y = np.tanh(1.6 * tv_filter(x, fc, 1.1, 'lp', block=32))
    y = sosfilt(sos_lp(15000, 4), y)     # o que a saturação dobra acima de 24 kHz volta em 18–21 kHz: corta
    return _fecha(y * env, amp, 0.002, 0.005)


def cordas_orq(f0, dur=2.0, ataque=0.45, release=0.8, brilho=0.5, amp=0.5):
    """Naipe de cordas: 6 serras com vibrato e afinação próprios, ataque lento e timbre escuro; cinema, balada, tensão. Estéreo, dur + release."""
    env = adsr(dur, a=ataque, d=1.0, s=1.0, r=release)
    n = len(env)
    t = T(n)
    out = np.zeros((2, n))
    for i, cents in enumerate((-10.0, -6.0, -2.0, 2.5, 6.0, 11.0)):
        rate, depth, p = rng.uniform(4.8, 6.2), rng.uniform(0.0025, 0.0045), rng.uniform(0, TAU)
        vib = 1 + depth * np.sin(TAU * rate * t + p) * np.clip((t - 0.15) / 0.5, 0, 1)
        out += to_stereo(saw(f0 * 2 ** (cents / 1200) * vib, n), -0.8 + 0.32 * i)
    out = sosfilt(sos_lp(1400 + 5000 * brilho), sosfilt(sos_hp(90), out, axis=1), axis=1)
    return _fecha(out * env, amp, 0.005, 0.01)


# ------------------------------------------------------------------ paleta ampliada · percussão
def shaker(dur=0.12, brilho=0.6, amp=0.5):
    """Shaker/ganzá: ruído agudo com ataque macio (~6 ms) e cauda curta; semicolcheias de bossa, pop acústico, lo-fi."""
    n = S(dur)
    t = T(n)
    lo = 3000 + 3500 * brilho
    x = sosfilt(sos_lp(14000), sosfilt(sos_bp(lo, min(2.2 * lo, 12000)), noise(n)))
    return _fecha(x * (1 - np.exp(-t / 0.006)) * np.exp(-t / (dur / 3.5)), amp, 0.002, 0.02)


def aro(dur=0.12, amp=0.5):
    """Aro/rimshot: estalo seco de madeira e metal (~460 Hz + 1,7 kHz) com ruído curtíssimo; reggae, bossa, cross-stick."""
    n = S(dur)
    t = T(n)
    corpo = (np.sin(TAU * 460 * t) * np.exp(-t / 0.014) + 0.6 * np.sin(TAU * 1720 * t) * np.exp(-t / 0.007)
             + 0.3 * np.sin(TAU * 2950 * t) * np.exp(-t / 0.004))
    estalo = sosfilt(sos_bp(2000, 7000), noise(n)) * np.exp(-t / 0.0025)
    return _fecha(norm(corpo) + 0.6 * norm(estalo), amp, 0.0008, 0.02)


def conga(f0=200.0, dur=0.45, tapa=0.2, amp=0.5):
    """Conga: membrana com queda curta de pitch e modos 1 / 1,59 / 2,14; `tapa` (0–1) soma o estalo de mão aberta; afro, latin, samba-reggae."""
    n = S(dur)
    t = T(n)
    fa = f0 * (1 + 0.1 * np.exp(-t / 0.015))
    ph = TAU * (np.cumsum(fa) - fa[0]) / SR
    y = (np.sin(ph) * np.exp(-t / 0.16) + 0.35 * np.sin(1.59 * ph) * np.exp(-t / 0.06)
         + 0.15 * np.sin(2.14 * ph) * np.exp(-t / 0.035))
    slap = sosfilt(sos_bp(900, 5000), noise(n)) * np.exp(-t / 0.006)
    return _fecha(norm(y) + tapa * norm(slap), amp, 0.001, 0.03)


def tamborim(dur=0.1, f0=880.0, amp=0.5):
    """Tamborim: couro pequeno e tenso na baqueta — tom agudo curtíssimo + estalo; samba, batucada, teleco-teco."""
    n = S(dur)
    t = T(n)
    corpo = (np.sin(TAU * f0 * t) * np.exp(-t / 0.02) + 0.5 * np.sin(TAU * 1.51 * f0 * t) * np.exp(-t / 0.012)
             + 0.3 * np.sin(TAU * 2.3 * f0 * t) * np.exp(-t / 0.008))
    baqueta = sosfilt(sos_bp(2500, 9000), noise(n)) * np.exp(-t / 0.0025)
    return _fecha(norm(corpo) + 0.5 * norm(baqueta), amp, 0.0008, 0.015)


def palma_seca(dur=0.12, amp=0.5):
    """Palma seca: uma batida de mão sem cauda de sala (2 microrrajadas em 1,2 ms); funk, pop minimalista, samba de roda."""
    n = S(dur)
    t = T(n)
    env = np.zeros(n)
    for tb, g, tau in ((0.0, 1.0, 0.011), (0.0012, 0.6, 0.009)):
        tt = np.maximum(t - tb, 0.0)
        env += (t >= tb) * g * np.exp(-tt / tau) * np.minimum(1.0, tt / 0.0008)
    return _fecha(sosfilt(sos_bp(900, 2800), noise(n)) * env, amp, 0.0005, 0.02)


def prato_ride(dur=1.6, sino=0.3, amp=0.5):
    """Prato de condução (ride): ping da baqueta + nuvem metálica que sustenta e cúpula (`sino`); jazz, rock, bossa. Estéreo."""
    n = S(dur)
    t = T(n)
    k = 28
    f, a, tau = rng.uniform(2600, 9500, k), rng.uniform(0.3, 1.0, k), rng.uniform(0.35, 1.0, k)
    ph0 = rng.uniform(0, TAU, (2, k))
    metal = np.stack([(a[:, None] * np.sin(TAU * f[:, None] * (1 + 0.0015 * c) * t + ph0[c][:, None])
                       * np.exp(-t / tau[:, None])).sum(0) for c in range(2)])
    fb = 520 * np.array([1.0, 1.51, 2.13, 2.71, 3.62])
    cupula = (np.sin(TAU * fb[:, None] * t) * np.exp(-t / np.array([0.9, 0.6, 0.45, 0.3, 0.2])[:, None])).sum(0)
    wash = sosfilt(sos_bp(5000, 13000), noise(n, 2), axis=1) * np.exp(-t / 0.45)
    ping = sosfilt(sos_bp(3000, 9000), noise(n, 2), axis=1) * np.exp(-t / 0.003)
    ruido = sosfilt(sos_lp(14000), 0.3 * norm(wash) + 0.6 * norm(ping), axis=1)
    y = 0.55 * norm(metal) + ruido + sino * norm(cupula)[None, :]
    return _fecha(y * (1 + 0.8 * np.exp(-t / 0.02)), amp, 0.0008, 0.08)


# ------------------------------------------------------------------ paleta ampliada · texturas e impacto
def vinil(dur, chiado=0.5, estalos=6.0, amp=0.5):
    """Textura de vinil estéreo: chiado com a oscilação de 33⅓ rpm + estalos esparsos (~`estalos` por s); cama lo-fi, memória."""
    n = S(dur)
    t = T(n)
    hiss = sosfilt(sos_bp(1200, 7500), noise(n, 2), axis=1) * (1 + 0.25 * np.sin(TAU * 0.555 * t))
    hiss *= 0.15 * chiado / (hiss.std() + 1e-12)
    mask = rng.random((2, n)) < estalos / SR
    imp = np.zeros((2, n))
    cnt = int(mask.sum())
    imp[mask] = np.where(rng.random(cnt) < 0.5, -1.0, 1.0) * rng.random(cnt) ** 2.5
    stal = sosfilt(sos_bp(700, 6500), imp, axis=1)
    y = sosfilt(sos_lp(9000, 4), 0.8 * norm(stal) + hiss, axis=1)     # vinil é escuro
    return _fecha(y, amp, 0.03, 0.05, normaliza=False)


def fita(sinal, profundidade=0.5, wow_hz=0.55, flutter_hz=7.0):
    """Fita cassete aplicada a um sinal (mono ou estéreo): wow + flutter na afinação, perda de agudos e saturação leve, mantendo o pico; lo-fi, VHS, memória."""
    x = np.asarray(sinal, float)
    X = x[None, :] if x.ndim == 1 else x
    n = X.shape[1]
    t = T(n)
    p = float(np.clip(profundidade, 0.0, 1.0))
    dw = 0.004 * p / (TAU * wow_hz) * SR           # desvio de afinação de pico 0,4 %·p (wow)
    df = 0.0012 * p / (TAU * flutter_hz) * SR      # 0,12 %·p (flutter)
    m = (dw * np.sin(TAU * wow_hz * t + rng.uniform(0, TAU)) + df * np.sin(TAU * flutter_hz * t)) * edges(n, 0.05, 0.05)
    idx = np.clip(np.arange(n) - m, 0, n - 1)
    Y = np.stack([np.interp(idx, np.arange(n), ch) for ch in X])
    Y = sosfilt(sos_lp(15000 - 9000 * p), Y, axis=1)
    pico = np.abs(X).max()
    g = 1 + p
    Y = np.tanh(g * Y / (pico + 1e-12)) / math.tanh(g)
    Y = _fecha(Y, pico, 0.002, 0.005)
    return Y[0] if x.ndim == 1 else Y


def impacto_cinema(dur=3.0, amp=0.5):
    """Impacto de trailer: boom sub com queda de pitch, soco médio saturado, rajada de ar e cauda escura estéreo; abertura, virada de cena, logo."""
    n = S(dur)
    t = T(n)
    fa = 36 + 80 * np.exp(-t / 0.07)
    boom = np.sin(TAU * (np.cumsum(fa) - fa[0]) / SR) * np.exp(-t / (0.35 * dur))
    soco = np.tanh(3 * norm(sosfilt(sos_lp(1400), noise(n)) * np.exp(-t / 0.045)))
    ar = sosfilt(sos_lp(12000), sosfilt(sos_bp(1800, 9000), noise(n, 2), axis=1), axis=1) \
        * (np.exp(-t / 0.18) - np.exp(-t / 0.004))
    cauda = tv_filter(noise(n, 2), curve(t, [(0, 3500), (dur, 250)]), 0.7, 'lp')
    cauda = sosfilt(sos_hp(150), cauda, axis=1) * np.exp(-t / (0.3 * dur)) * (1 - np.exp(-t / 0.06))
    y = (0.9 * boom + 0.45 * soco)[None, :] + 0.35 * norm(ar) + 0.3 * norm(cauda)
    return _fecha(y, amp, 0.001, 0.25)


# ------------------------------------------------------------------ mesa de mixagem
def seg_end(t0):
    """Fim do trecho contínuo que contém t0 (um som nunca vaza para dentro de um silêncio)."""
    for a, b in SEGMENTS:
        if a - 1e-9 <= t0 < b - 1e-9:
            return b
    raise ValueError(f'sound starting inside a silence: t={t0:.4f} — move the sound out of "silencios" in the sheet')


def place(sig, t0, to, gain=1.0, pan=0.0, rev=0.0, dly=0.0, event=False):
    """Soma `sig` no bus `to` a partir de t0 (s); corta no próximo silêncio, manda para reverb/delay; event=True marca o som do marco.
    Som que começa depois do fim é ignorado (loop passando do fim); som que começa dentro de um silêncio é erro."""
    if not N:
        raise RuntimeError('call synth.configurar(folha) before using the mixer')
    if t0 >= DURACAO - 1e-9:
        return
    if to not in bus:
        bus[to] = np.zeros((2, N))
        BUSES.append(to)
    x = np.array(sig, dtype=float) * gain
    if x.ndim == 1:
        x = to_stereo(x, pan)
    i0 = S(t0)
    if i0 < 0:
        raise ValueError(f'sound before t=0: {t0}')
    n = min(x.shape[1], S(seg_end(t0)) - i0)
    if n < x.shape[1]:
        x = tail_fade(x[:, :n].copy(), 0.012)
    bus[to][:, i0:i0 + n] += x
    for kind, amount in (('rev', rev), ('dly', dly)):
        if amount:
            arr = sends[kind].setdefault(to, np.zeros((2, N), np.float32))
            arr[:, i0:i0 + n] += x * amount
    if event:
        k = min(CLIP, n)
        evt_clips.setdefault(i0, np.zeros(CLIP))[:k] += x.mean(0)[:k]


def sidechain(times, depth, attack=0.003, hold=0.012, release=0.2):
    """Curva de ganho (N,) que 'abaixa' `depth` em cada instante de `times` — multiplique um bus por ela."""
    na, nh, nr = S(attack), S(hold), S(release)
    shape = np.concatenate([0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na), np.ones(nh), (1 - np.arange(nr) / nr) ** 2])
    duck = 1 - depth * shape
    g = np.ones(N)
    for tk in times:
        i0, d = S(tk) - S(0.001), duck
        if i0 < 0:
            i0, d = 0, duck[-i0:]
        seg = g[i0:i0 + len(d)]
        np.minimum(seg, d[:len(seg)], out=seg)
    return g


def kw(x):
    return lfilter(KB2, KA2, lfilter(KB1, KA1, x, axis=-1), axis=-1)


def loud(y_kw, a, b):
    """Loudness sem gate (LUFS) de um sinal já ponderado por kw(), na janela [a, b) s."""
    seg = y_kw[:, S(a):S(b)]
    return -0.691 + 10 * np.log10((seg ** 2).mean(axis=1).sum() + 1e-20)


def lufs_integrated(x):
    """Loudness integrado BS.1770 (blocos de 400 ms, gates -70 LUFS e relativo -10 LU)."""
    p = kw(x) ** 2
    blk, hop = S(0.4), S(0.1)
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(p, axis=1)], axis=1)
    st = np.arange(0, x.shape[1] - blk + 1, hop)
    z = ((cs[:, st + blk] - cs[:, st]) / blk).sum(0)
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    m = lk > -70
    rel = -0.691 + 10 * np.log10(z[m].mean()) - 10
    return -0.691 + 10 * np.log10(z[m & (lk > rel)].mean())


def ganho_por_alvo(alvos):
    """Nivela buses por loudness: alvos = {bus: ((de, ate), lufs)}. Multiplica cada bus e devolve {bus: ganho}."""
    gains = {k: 1.0 for k in BUSES}
    for k, ((a, b), target) in alvos.items():
        gains[k] = 10 ** ((target - loud(kw(bus[k]), a, b)) / 20)
        bus[k] *= gains[k]
    return gains


def somar_sends(kind, ganhos=None, buses=None):
    """Soma os sends 'rev' ou 'dly' de todos os buses (ou só dos de `buses`), cada um com o ganho do seu bus."""
    acc = np.zeros((2, N))
    for k, arr in sends[kind].items():
        if buses is None or k in buses:
            acc += (1.0 if ganhos is None else ganhos.get(k, 1.0)) * arr
    return acc


def make_ir(dur=3.2, predelay=0.02):
    """Resposta ao impulso sintética de sala (graves longos, agudos curtos), energia unitária por canal."""
    n = S(dur)
    t = T(n)
    nz = noise(n, 2)
    lo = sosfilt(sos_lp(450), nz, axis=1)
    hi = sosfilt(sos_hp(3500), nz, axis=1)
    ir = lo * np.exp(-6.91 * t / 2.4) + (nz - lo - hi) * np.exp(-6.91 * t / 2.0) + hi * np.exp(-6.91 * t / 0.9)
    ir *= 1 - np.exp(-t / 0.015)
    ir = sosfilt(sos_lp(11000), ir, axis=1)
    ir = np.concatenate([np.zeros((2, S(predelay))), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def ping_pong(x, d=None, fb=0.38, taps=6):
    """Delay pingue-pongue (padrão: colcheia pontuada do BPM da folha), repetições alternando L/R e escurecendo."""
    D = S(0.75 * BATIDA if d is None else d)
    n = x.shape[1]
    y = np.zeros_like(x)
    cur = x.mean(0)
    lp, hp = sos_lp(5000), sos_hp(250, 1)
    for k in range(1, taps + 1):
        if k * D >= n:
            break
        cur = sosfilt(hp, sosfilt(lp, cur))
        g = fb ** (k - 1)
        l, r = (0.35, 1.0) if k % 2 else (1.0, 0.35)
        y[0, k * D:] += g * l * cur[:n - k * D]
        y[1, k * D:] += g * r * cur[:n - k * D]
    return y


def per_segment(x, fn):
    """Aplica o efeito trecho a trecho: cauda nenhuma atravessa um corte."""
    out = np.zeros_like(x)
    for a, b in SEGMENTS:
        i0, i1 = S(a), S(b)
        out[:, i0:i1] = tail_fade(fn(x[:, i0:i1])[:, :i1 - i0], 0.012)
    return out


def retornos(ganhos=None, ir=None, dly_para_rev=0.25, rev_hp=200.0, rev_lp=9000.0, buses=None, **pingpong):
    """Processa os sends trecho a trecho: delay pingue-pongue e reverb por convolução. Devolve (rev_out, dly_out).
    buses=(...): só os envios desses buses. Para separar grupos (a música dos efeitos), passe o mesmo `ir` a cada chamada."""
    dly_out = per_segment(somar_sends('dly', ganhos, buses), lambda x: ping_pong(x, **pingpong))
    if ir is None:
        ir = make_ir()
    rev_in = somar_sends('rev', ganhos, buses) + dly_para_rev * dly_out
    rev_out = per_segment(rev_in, lambda x: fftconvolve(x, ir, axes=1))
    rev_out = sosfilt(sos_lp(rev_lp), sosfilt(sos_hp(rev_hp), rev_out, axis=1), axis=1)
    return rev_out, dly_out


def soma_buses():
    """Soma de todos os buses (na ordem de BUSES)."""
    return sum(bus[k] for k in BUSES)


def relatorio(linhas):
    """Imprime o loudness sem gate de cada (nome, sinal) por seção da folha (ou por trecho, se a folha não tiver seções)."""
    secs = [(s['nome'], s['de'], s['ate']) for s in FOLHA.get('secoes', [])] or \
        [(f'{a:g}-{b:g}', a, b) for a, b in SEGMENTS]
    print('\nLoudness per bus/section (ungated LUFS, pre-master):')
    print(f"{'':8s}" + ''.join(f'{c[:8]:>9s}' for c, _, _ in secs))
    for name, x in linhas:
        y = kw(x)
        print(f'{name[:8]:8s}' + ''.join(f'{loud(y, a, b):9.1f}' for _, a, b in secs))


# ------------------------------------------------------------------ master
def true_peak_env(x):
    up = resample_poly(x, 4, 1, axis=1)
    return np.abs(up).reshape(2, -1, 4).max(axis=(0, 2))


def limiter(x, ceiling_db, attack=0.0015, release_db_s=60.0):
    """Limiter de true peak offline: ganho calculado olhando o futuro, aplicado sem atrasar o áudio."""
    r = np.maximum(0.0, 20 * np.log10(true_peak_env(x) + 1e-12) - ceiling_db)
    L = S(attack)
    r = uniform_filter1d(maximum_filter1d(r, size=2 * L + 1), size=L + 1)
    c = release_db_s / SR
    idx = np.arange(len(r))
    red = np.maximum.accumulate(r + c * idx) - c * idx
    return x * 10 ** (-red / 20), red


def condicionar(mix, fase_zero=False):
    """A parte linear do master: grave em mono, DC fora e fade da folha. Linear: a soma dos stems condicionados é o mix condicionado."""
    filtro = sosfiltfilt if fase_zero else sosfilt
    mid, side = 0.5 * (mix[0] + mix[1]), 0.5 * (mix[0] - mix[1])
    side = filtro(sos_hp(120, 4), side)            # grave (<120 Hz) em mono
    x = np.stack([mid + side, mid - side])
    x = filtro(sos_hp(22), x, axis=1)              # tira DC/infra
    t = T(N)
    if FADE:
        a, b = FADE
        x *= np.where(t < a, 1.0, 0.5 + 0.5 * np.cos(np.pi * np.clip((t - a) / (b - a), 0, 1)))
    else:
        x = tail_fade(x, 0.012)
    return x


def master(mix, fase_zero=False, teto=None):
    """Grave em mono, DC fora, fade da folha, loudness no alvo com limiter de true peak, silêncios digitais exatos e último sample 0.
    fase_zero=True: os passa-altas (22 Hz e o do lado em 120 Hz) rodam para frente e para trás. O causal atrasa ~6 ms o
    grave de um bumbo; offline não há por que atrasar. O padrão (False) é o de sempre: trilhas antigas não mudam.
    teto: o teto do limiter em dBTP (padrão: o `teto_dbtp` da folha)."""
    x = condicionar(mix, fase_zero)
    teto = CEILING_DBTP if teto is None else teto

    g_db = TARGET_LUFS - lufs_integrated(x)
    for _ in range(8):
        y, red = limiter(x * 10 ** (g_db / 20), teto)
        lu = lufs_integrated(y)
        if abs(lu - TARGET_LUFS) < 0.03:
            break
        g_db += TARGET_LUFS - lu

    for a, b in SILENCIOS:                          # silêncio digital exato
        y[:, S(a):S(b)] = 0.0
    y[:, -1] = 0.0
    return y, g_db, red, lu


def write_wav24(path, x):
    q = np.ascontiguousarray(np.round(np.clip(x, -1.0, 1.0 - 2 ** -23).T * 8388608.0).astype('<i4'))
    raw = q.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


def salvar(mix, stats=False, fase_zero=False, stems=None, teto=None):
    """Masteriza, grava o WAV 24 bits de `saida` e stems/eventos.npz ao lado, e imprime o resumo. Devolve o sinal final.
    stems={'nome': sinal}: cada um passa pela mesma cadeia do master (condicionar, o mesmo ganho, a mesma redução do
    limiter, os mesmos silêncios) e vira stems/<name>.wav. Os que somam o mix somam o WAV final; 'ref/…' vão para a subpasta."""
    out, g_db, red, lu = master(mix, fase_zero=fase_zero, teto=teto)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    write_wav24(SAIDA, out)

    pasta = SAIDA.parent / 'stems'
    pasta.mkdir(exist_ok=True)
    for nome, sinal in (stems or {}).items():
        y = condicionar(sinal, fase_zero) * 10 ** ((g_db - red) / 20)
        for a, b in SILENCIOS:
            y[:, S(a):S(b)] = 0.0
        y[:, -1] = 0.0
        destino = pasta / f'{nome}.wav'
        destino.parent.mkdir(parents=True, exist_ok=True)
        write_wav24(destino, y)
    starts = np.array(sorted(evt_clips), dtype=np.int64)
    clips = []
    for i in starts:
        r = red[i:i + CLIP]
        if len(r) < CLIP:
            r = np.pad(r, (0, CLIP - len(r)), mode='edge')
        clips.append(evt_clips[i] * 10 ** ((g_db - r) / 20))
    clips = np.stack(clips) if clips else np.zeros((0, CLIP))
    np.savez(pasta / 'eventos.npz', starts=starts, clips=clips, wav=SAIDA.name, amostras=N)

    tp = 20 * np.log10(true_peak_env(out).max() + 1e-20)
    print(f'\nmaster: gain {g_db:+.2f} dB, max limiter reduction {red.max():.2f} dB, '
          f'{(red > 0.5).mean() * 100:.1f}% of the time with >0.5 dB of reduction')
    print(f'integrated LUFS (internal) {lufs_integrated(out):.2f} | true peak (internal, 4x) {tp:.2f} dBTP | '
          f'samples {out.shape[1]}')
    if stats:
        y = kw(out)
        print('energy curve (LUFS per second): ' +
              ' '.join(f'{loud(y, s, s + 1):.0f}' for s in range(int(DURACAO))))
    print(f'written: {SAIDA}')
    return out
