#!/usr/bin/env python3
"""sons · sound effects for the video skills, built on synth.py.

Screen tap (toque), mouse click (clique), typing (digitacao), page flip (virada), whoosh, success (sucesso), riser
and impact (impacto); and, ported from the original engine of the drawn explanation, pop, tique, blip, rabisco, giz,
brilho, baque and erro.
Each sound is generated on the fly (numpy/scipy), is deterministic for the seed and never repeats exactly:
the `indice` (the occurrence of that sound in the video) shifts tuning, timing and noise a little.

Usage in an arrangement (after synth.configurar and `from synth import *`):
    import sounds as sons
    y = sons.som('toque', semente=3)                  # signal starting at zero, own level -26 short-term LUFS
    sons.CATALOGO['toque']                            # description, default level, anchor, parameters
    sons.colocar([{'t': 2.4, 'som': 'toque'},
                  {'t': 5.0, 'som': 'whoosh', 'dur': 0.5},
                  {'t': 8.0, 'som': 'digitacao', 'dur': 1.6},
                  {'t': 12.0, 'som': 'riser', 'dur': 1.5}], bus='sfx')

Anchor of each sound (what falls at instant t):
    inicio → the sound starts at t (toque, clique, digitacao, virada, sucesso, impacto, pop, tique, blip, brilho, baque,
             erro): place(..., event=True); rabisco and giz also start at t, but rise over 18 ms (no event)
    pico   → the whoosh starts at t − dur/2 and peaks at t; it does not mark an event (optional marker)
    fim    → the riser ends exactly at t; it does not mark an event (the impacto at t does)

Bell: CATALOGO[nome]['sino'] is True for the ones that sound like a bell (sucesso, brilho) — filter by it when the
brand refuses bells.
Tonic of blip and brilho: the `tonica` parameter; without it, the sheet's "tonica"; with neither, 72 (C).

Level: `nivel` is in dB RELATIVE to the music bed. Every sound comes out of som() at a short-term loudness of -26 LUFS
(max of the K-weighted loudness over a 200 ms window); colocar() measures the bed (ref_lufs) and applies
gain = ref_lufs + nivel − (−26).

Check: python sounds.py --verify [--out DIR]   (exit code ≠ 0 if something fails)
"""
import hashlib
import math
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from scipy.ndimage import uniform_filter1d  # noqa: E402
from scipy.signal import lfilter, sosfilt  # noqa: E402

import synth  # noqa: E402

TAU = 2 * np.pi
NIVEL_SOM = -26.0          # LUFS curtos (200 ms) de todo som que sai de som()
JANELA_CURTA = 0.2         # s
LIM_DESTAQUE = -10.0       # dB: ataque >1 kHz (RMS 5 ms) no nível padrão vs loudness da cama; a banda >1 kHz de uma cama fica ~15 dB abaixo dela

CATALOGO = {
    'toque': {
        'descricao': 'finger tapping the screen: short, soft low body + skin contact',
        'nivel_db': -6.0, 'dur': 0.075, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.04, 'sino': False,
        'parametros': {'variante': "'macio' (default) | 'firme' (more glass click)"},
    },
    'clique': {
        'descricao': 'mouse click: two transients (press and release)',
        'nivel_db': -6.0, 'dur': 0.2, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.03, 'sino': False,
        'parametros': {'variante': "'mouse' (default, with a low thunk) | 'trackpad' (lighter)",
                       'soltar': 'seconds between press and release (default 0.08; 0 = press only)'},
    },
    'digitacao': {
        'descricao': 'key sequence with a human rhythm; letters vary, space and enter have their own sound',
        'nivel_db': -10.0, 'dur': 1.2, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.03, 'sino': False,
        'parametros': {'dur': 'total duration in s (the keys fit in it)', 'teclas': 'number of keys (when dur is not given)',
                       'teclado': "'notebook' (default) | 'mecanico' | 'tela' (phone keyboard)",
                       'enter': 'True = ends with enter'},
    },
    'virada': {
        'descricao': 'page or card flip: paper snap, air flap and landing',
        'nivel_db': -4.0, 'dur': 0.36, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.06, 'sino': False,
        'parametros': {'variante': "'pagina' (default, ~0.36 s) | 'cartao' (~0.22 s, harder)",
                       'direcao': '+1 (left→right, default) | -1'},
    },
    'whoosh': {
        'descricao': 'air pass for a transition; peak at instant t',
        'nivel_db': -3.0, 'dur': 0.5, 'ancora': 'pico', 'ataque_seco': False, 'rev': 0.08, 'sino': False,
        'parametros': {'dur': 'total duration (the peak sits in the middle)',
                       'variante': "'curto' (0.3 s) | 'medio' (0.5 s, default) | 'longo' (0.9 s) — applies when dur is not given",
                       'direcao': '+1 | -1 (pan direction)'},
    },
    'sucesso': {
        'descricao': 'short 2–3 note chime rising to the tonic (tunable to the soundtrack key)',
        'nivel_db': -2.0, 'dur': 0.85, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.15, 'sino': True,
        'parametros': {'tonica': 'MIDI or pitch class of the tonic (default 72 = C)',
                       'modo': "'maior' (default) | 'menor'", 'notas': '2 | 3 (default)'},
    },
    'riser': {
        'descricao': 'tension rise (noise opening + pitch rising) that ends exactly at t',
        'nivel_db': -4.0, 'dur': 1.5, 'ancora': 'fim', 'ataque_seco': False, 'rev': 0.1, 'sino': False,
        'parametros': {'dur': 'duration (ends at t)', 'tonica': 'MIDI of the tonic (the pitch rises 2 octaves to it)',
                       'ticks': 'True = accelerating ticks on top'},
    },
    'impacto': {
        'descricao': 'impact: low end with a pitch drop + tuned body + punch + air',
        'nivel_db': 0.0, 'dur': 1.2, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.12, 'sino': False,
        'parametros': {'dur': 'duration (default 1.2 s)', 'tonica': 'MIDI of the tonic (the body sounds on it, octave 2)'},
    },
    'acento': {
        'descricao': 'discreet musical accent: a chord note picked with a plectrum (marker without its own effect)',
        'nivel_db': -5.0, 'dur': 0.6, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.2, 'sino': False,
        'parametros': {'nota': 'MIDI of the note (default 84); the arrangement picks a chord note above the melody'},
    },
    'pop': {
        'descricao': 'something appears (box, icon, label): short rising tone + small high click',
        'nivel_db': -6.0, 'dur': 0.25, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.05, 'sino': False,
        'parametros': {},
    },
    'tique': {
        'descricao': 'counting (number going up, pointer): sharp, crisp tick',
        'nivel_db': -10.0, 'dur': 0.06, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.03, 'sino': False,
        'parametros': {},
    },
    'blip': {
        'descricao': 'short note in the tonic pentatonic; list items step up in pitch',
        'nivel_db': -6.0, 'dur': 0.35, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.08, 'sino': False,
        'parametros': {'passo': 'degree of the major pentatonic from the tonic one octave up (0 = tonic, 5 = octave);'
                                ' without it, indice % 8: ten blips in a row go up',
                       'tonica': 'MIDI or pitch class; without it, the sheet\'s "tonica"; without either, 72 (C)'},
    },
    'rabisco': {
        'descricao': 'felt pen on paper while the stroke draws (stroke by stroke, each one rises in 18 ms)',
        'nivel_db': -10.0, 'dur': 0.6, 'ancora': 'inicio', 'ataque_seco': False, 'rev': 0.03, 'sino': False,
        'parametros': {'dur': 'duration in s (default 0.6); the strokes fit in it'},
    },
    'giz': {
        'descricao': 'chalk on a board while the stroke draws: grainy, with occasional short squeaks',
        'nivel_db': -12.0, 'dur': 0.6, 'ancora': 'inicio', 'ataque_seco': False, 'rev': 0.04, 'sino': False,
        'parametros': {'dur': 'duration in s (default 0.6); the strokes fit in it'},
    },
    'brilho': {
        'descricao': 'something new, magical: a cluster of high bell pings in the tonic pentatonic',
        'nivel_db': -5.0, 'dur': 1.5, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.18, 'sino': True,
        'parametros': {'tonica': 'MIDI or pitch class; without it, the sheet\'s "tonica"; without either, 72 (C)'},
    },
    'baque': {
        'descricao': 'something lands: low and soft (falling tone + low noise) with felt contact',
        'nivel_db': -4.0, 'dur': 0.6, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.05, 'sino': False,
        'parametros': {},
    },
    'erro': {
        'descricao': 'wrong, blocked: short double low buzz, with a discreet click at the start of each pulse',
        'nivel_db': -6.0, 'dur': 0.33, 'ancora': 'inicio', 'ataque_seco': True, 'rev': 0.03, 'sino': False,
        'parametros': {},
    },
}

_RESERVADOS = {'t', 'som', 'nivel', 'pan', 'rev', 'dly', 'event', 'evento', 'opcional', 'efeito', 'indice', 'bus', 'abrir',
               'subir'}


# ------------------------------------------------------------------ utilitários
def _S(t):
    return synth.S(t)


def _T(n):
    return synth.T(n)


def _rampa(tt, a):
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / a, 0.0, 1.0))


def _rajada(t, t0, tau, a=0.0005):
    """Envelope que vale zero antes de t0, sobe em cosseno por `a` s e cai exponencial com constante tau."""
    tt = t - t0
    return _rampa(tt, a) * np.exp(-np.maximum(tt, 0.0) / tau)


def _seno_caindo(t, f_fim, f_ini, tau):
    """Seno que começa na fase 0 e cai de f_ini a f_fim com constante tau."""
    fa = f_fim + (f_ini - f_fim) * np.exp(-t / tau)
    return np.sin(TAU * (np.cumsum(fa) - fa[0]) / synth.SR)


def _banda(n, f1, f2, ch=None):
    x = synth.noise(n, ch)
    return sosfilt(synth.sos_bp(f1, min(f2, 0.45 * synth.SR)), x, axis=-1)


def _estereo(y):
    y = np.asarray(y, float)
    return synth.to_stereo(y, 0.0) if y.ndim == 1 else y


def loud_curta(y):
    """Loudness curta: máximo da loudness K ponderada (BS.1770, sem gate) em janela deslizante de 200 ms."""
    x = _estereo(y)
    p = (synth.kw(x) ** 2).sum(0)
    w = max(1, _S(JANELA_CURTA))
    if len(p) < w:
        p = np.pad(p, (0, w - len(p)))
    m = uniform_filter1d(p, size=w, mode='constant').max()
    return -0.691 + 10 * np.log10(m + 1e-20)


def _pitch(tonica, lo, hi):
    """Classe de altura de `tonica` (MIDI) posta no intervalo [lo, hi)."""
    pc = int(round(tonica)) % 12
    m = lo + ((pc - lo) % 12)
    return m if m < hi else m - 12


# ------------------------------------------------------------------ geradores (devolvem (sinal, âncora em amostras))
def _toque(r, variante='macio'):
    j = r.uniform(0.93, 1.07)
    dur = 0.075 * r.uniform(0.95, 1.08)
    n = _S(dur)
    t = _T(n)
    corpo = _seno_caindo(t, 205 * j, 330 * j, 0.004) * _rajada(t, 0, 0.013 * r.uniform(0.9, 1.15), 0.0008)
    pele = synth.norm(_banda(n, 900, 4500)) * _rajada(t, 0, 0.003, 0.0004)
    vidro = np.sin(TAU * 3350 * j * t) * _rajada(t, 0, 0.0015, 0.0004)
    k = (0.9, 0.75, 0.22) if variante == 'macio' else (0.75, 1.0, 0.4)
    y = k[0] * corpo + k[1] * pele + k[2] * vidro
    y = sosfilt(synth.sos_lp(12000), y)
    return synth.norm(y * synth.edges(n, 0.0004, 0.02)), 0


def _tecla_clique(t, t0, j, forca, trackpad, n):
    if trackpad:
        clk = synth.norm(sosfilt(synth.sos_lp(9000), _banda(n, 1500, 6000)))
        plast = np.sin(TAU * 4100 * j * (t - t0)) * _rajada(t, t0, 0.0018, 0.0004)
        return forca * (0.55 * clk * _rajada(t, t0, 0.0005, 0.0003) + 0.5 * plast)
    clk = synth.norm(sosfilt(synth.sos_lp(13000), _banda(n, 2200, 9000)))
    clk = clk * (_rajada(t, t0, 0.0006, 0.0003) + 0.35 * _rajada(t, t0 + 0.0021 * j, 0.0005, 0.0003))
    plast = (np.sin(TAU * 3150 * j * (t - t0)) * _rajada(t, t0, 0.0028, 0.0004)
             + 0.5 * np.sin(TAU * 5350 * j * (t - t0)) * _rajada(t, t0, 0.0012, 0.0004))
    return forca * (0.8 * clk + 0.45 * plast)


def _clique(r, variante='mouse', soltar=None):
    j = r.uniform(0.95, 1.05)
    g = (0.08 if soltar is None else float(soltar)) * r.uniform(0.9, 1.12)
    n = _S(g + 0.13)
    t = _T(n)
    trackpad = variante == 'trackpad'
    y = _tecla_clique(t, 0.0, j, 1.0, trackpad, n)
    if not trackpad:
        tt = np.maximum(t - 0.0005, 0)
        y = y + 0.9 * _seno_caindo(tt, 72 * j, 162 * j, 0.018) * _rajada(t, 0.0005, 0.04, 0.0015)
    if g > 0.005:
        y = y + _tecla_clique(t, g, j * 1.08, 0.5, trackpad, n)
        if not trackpad:
            tt = np.maximum(t - g, 0)
            y = y + 0.25 * _seno_caindo(tt, 90 * j, 180 * j, 0.012) * _rajada(t, g, 0.02, 0.0015)
    y = sosfilt(synth.sos_lp(14000), y)
    return synth.norm(y * synth.edges(n, 0.0003, 0.03)), 0


def _tecla(r, tipo, teclado, forca):
    """Uma tecla. tipo: 'letra' | 'espaco' | 'enter'. Mono."""
    j = float(np.clip(1 + 0.05 * r.standard_normal(), 0.88, 1.12))
    longa = tipo in ('espaco', 'enter')
    n = _S(0.12 if longa else 0.07)
    t = _T(n)
    if teclado == 'tela':
        f = (1500 if tipo == 'letra' else 1100) * j
        y = (np.sin(TAU * f * t) * _rajada(t, 0, 0.004, 0.0004)
             + 0.6 * synth.norm(_banda(n, 1500, 6000)) * _rajada(t, 0, 0.0012, 0.0003)
             + 0.35 * _seno_caindo(t, 180 * j, 260 * j, 0.004) * _rajada(t, 0, 0.008, 0.0006))
        return synth.norm(sosfilt(synth.sos_lp(11000), y) * synth.edges(n, 0.0003, 0.015)) * forca
    if teclado == 'mecanico' and tipo == 'letra':
        clk = synth.norm(sosfilt(synth.sos_lp(13000), _banda(n, 2800, 9000)))
        d = 0.0052 * j
        y = clk * (_rajada(t, 0, 0.0007, 0.0003) + 0.55 * _rajada(t, d, 0.0006, 0.0003))
        y = y + 0.45 * np.sin(TAU * 4300 * j * t) * _rajada(t, 0, 0.0022, 0.0004)
        y = y + 0.3 * np.sin(TAU * 1850 * j * t) * _rajada(t, d, 0.006, 0.0004)
    elif tipo == 'letra':                                   # notebook: tesoura, macio
        clk = synth.norm(sosfilt(synth.sos_lp(12000), _banda(n, 1500, 7000)))
        d = 0.007 * j
        y = 0.7 * clk * (_rajada(t, 0, 0.0007, 0.0003) + 0.4 * _rajada(t, d, 0.0008, 0.0003))
        y = y + (np.sin(TAU * 1150 * j * t) + 0.4 * np.sin(TAU * 2630 * j * t)) * _rajada(t, 0, 0.005, 0.0004)
        y = y + 0.35 * _seno_caindo(t, 150 * j, 230 * j, 0.004) * _rajada(t, d, 0.006, 0.0008)
    elif tipo == 'espaco':
        clk = synth.norm(sosfilt(synth.sos_lp(12000), _banda(n, 900, 4500)))
        y = 0.55 * clk * (_rajada(t, 0, 0.0012, 0.0003) + 0.6 * _rajada(t, 0.009, 0.0015, 0.0004)
                          + 0.35 * _rajada(t, 0.021, 0.001, 0.0004))
        y = y + (np.sin(TAU * 420 * j * t) + 0.5 * np.sin(TAU * 1030 * j * t)) * _rajada(t, 0.0005, 0.016, 0.0006)
        y = y + 0.5 * _seno_caindo(t, 130 * j, 190 * j, 0.005) * _rajada(t, 0.0005, 0.013, 0.0008)
    else:                                                    # enter
        clk = synth.norm(sosfilt(synth.sos_lp(12000), _banda(n, 2200, 8000)))
        y = 0.7 * clk * (_rajada(t, 0, 0.0009, 0.0003) + 0.5 * _rajada(t, 0.006, 0.0008, 0.0003))
        y = y + (np.sin(TAU * 560 * j * t) + 0.5 * np.sin(TAU * 1240 * j * t)) * _rajada(t, 0.006, 0.02, 0.0006)
        y = y + 0.6 * _seno_caindo(t, 150 * j, 210 * j, 0.005) * _rajada(t, 0.006, 0.016, 0.0008)
        y = y + 0.25 * synth.norm(_banda(n, 1200, 5000)) * _rajada(t, 0.028, 0.0015, 0.0004)
    return synth.norm(y * synth.edges(n, 0.0003, 0.015)) * forca


def _digitacao(r, dur=None, teclas=None, teclado='notebook', enter=False):
    if teclado not in ('notebook', 'mecanico', 'tela'):
        raise ValueError(f"teclado must be 'notebook', 'mecanico' or 'tela', got {teclado!r}")
    base = {'notebook': 0.105, 'mecanico': 0.1, 'tela': 0.13}[teclado]
    if dur is None and teclas is None:
        teclas = 8
    fim = None if dur is None else float(dur) - 0.075
    eventos, tk, corrida = [], 0.0, int(r.integers(3, 8))
    while True:
        tipo = 'letra'
        if eventos and corrida == 0:
            tipo, corrida = 'espaco', int(r.integers(3, 8))
        eventos.append((tk, tipo))
        corrida = max(0, corrida - (tipo == 'letra'))
        if teclas is not None and len(eventos) >= int(teclas):
            break
        passo = float(np.clip(base * math.exp(0.33 * r.standard_normal()), 0.05, 0.28))
        if tipo == 'espaco':
            passo *= 1.25
        if r.random() < 0.08:                                  # pausa de quem pensa
            passo += r.uniform(0.12, 0.3)
        if fim is not None and tk + passo > fim - (0.2 if enter else 0.0):
            break
        tk += passo
    if enter:
        eventos.append((tk + r.uniform(0.16, 0.24), 'enter'))
    ultimo = eventos[-1][0] + (0.12 if eventos[-1][1] != 'letra' else 0.07)
    n = _S(max(ultimo, dur or 0.0) if dur is None else float(dur))
    out = np.zeros((2, n))
    for i, (tk, tipo) in enumerate(eventos):
        forca = 1.0 if i == 0 else float(np.clip(r.uniform(0.62, 1.0), 0, 1))
        y = _tecla(r, tipo, teclado, forca)
        pan = {'letra': r.uniform(-0.25, 0.2), 'espaco': 0.0, 'enter': 0.3}[tipo]
        i0 = _S(tk)
        k = min(y.shape[-1], n - i0)
        if k > 0:
            out[:, i0:i0 + k] += synth.to_stereo(y[:k], pan)
    return synth.norm(out * synth.edges(n, 0.0003, 0.01)), 0


def _virada(r, variante='pagina', direcao=1):
    if variante not in ('pagina', 'cartao'):
        raise ValueError(f"virada variante must be 'pagina' or 'cartao', got {variante!r}")
    cart = variante == 'cartao'
    dur = (0.22 if cart else 0.36) * r.uniform(0.94, 1.07)
    j = r.uniform(0.93, 1.07)
    n = _S(dur)
    t = _T(n)
    estalo = synth.norm(_banda(n, 1800 * j, 8000)) * _rajada(t, 0, 0.004 if not cart else 0.005, 0.0004)
    estalo = estalo + 0.6 * synth.norm(_banda(n, 600 * j, 2400)) * _rajada(t, 0, 0.007, 0.0005)
    imp = np.zeros(n)
    if not cart:
        for _ in range(int(r.integers(4, 8))):
            imp[_S(r.uniform(0.004, 0.09))] += r.choice((-1, 1)) * r.uniform(0.25, 0.7)
    crep = sosfilt(synth.sos_bp(2500, 7500), imp)
    crep = crep / (np.abs(crep).max() + 1e-12) * 0.35 if imp.any() else crep
    lo, pk, fn = (1500, 4000, 1800) if cart else (900, 2600, 700)
    fc = synth.curve(t, [(0, lo * j), (0.45 * dur, pk * j), (dur, fn * j)])
    ar = synth.norm(synth.tv_filter(synth.noise(n), fc, 0.8, 'bp', block=32))
    x = t / dur
    env = np.sin(np.pi * np.clip(x / 0.92, 0, 1)) ** 1.5
    taxa = 28 * (12 / 28) ** x
    flutter = 1 - 0.35 * (0.5 + 0.5 * np.sin(TAU * np.cumsum(taxa) / synth.SR))
    flap = ar * env * flutter
    tp = 0.84 * dur
    if cart:
        pouso = synth.norm(_banda(n, 2000, 6500)) * _rajada(t, tp, 0.0012, 0.0004)
    else:
        pouso = (synth.norm(sosfilt(synth.sos_lp(1400), synth.noise(n))) * _rajada(t, tp, 0.006, 0.001)
                 + 0.5 * np.sin(TAU * 160 * np.maximum(t - tp, 0)) * _rajada(t, tp, 0.01, 0.001))
    y = 1.0 * estalo + crep + (0.22 if cart else 0.26) * flap + 0.3 * pouso
    y = sosfilt(synth.sos_lp(13000), y) * synth.edges(n, 0.0004, 0.03)
    pan = np.linspace(-0.35, 0.35, n) * (1 if direcao >= 0 else -1)
    return synth.norm(synth.to_stereo(y, pan)), 0


def _whoosh(r, dur=None, variante='medio', direcao=1):
    if dur is None:
        dur = {'curto': 0.3, 'medio': 0.5, 'longo': 0.9}[variante]
    dur = float(dur)
    j = r.uniform(0.9, 1.1)
    n = _S(dur)
    t = _T(n)
    tp = _S(dur / 2) / synth.SR
    fc = synth.curve(t, [(0, 350 * j), (tp, 2800 * j), (dur + 1e-6, 600 * j)])
    q = r.uniform(0.8, 1.0)
    a = synth.tv_filter(synth.noise(n), fc, q, 'bp', block=32)
    b = synth.tv_filter(synth.noise(n), fc * 1.03, q, 'bp', block=32)
    env = np.where(t < tp, (t / tp) ** 2.2, np.exp(-3.2 * (t - tp) / (dur - tp)))
    corpo = synth.norm(sosfilt(synth.sos_lp(380), synth.noise(n))) * env ** 1.5
    th = (np.linspace(-0.6, 0.6, n) * (1 if direcao >= 0 else -1) + 1) * np.pi / 4
    y = np.stack([(0.8 * a + 0.2 * b) * np.cos(th), (0.8 * b + 0.2 * a) * np.sin(th)]) * math.sqrt(2)
    y = synth.norm(y) * env + 0.3 * corpo[None, :]
    y = sosfilt(synth.sos_lp(13000), y, axis=1) * synth.edges(n, 0.01, 0.03)
    return synth.norm(y), _S(dur / 2)


def _nota_chime(f, n, t, t0):
    tt = np.maximum(t - t0, 0)
    y = (np.sin(TAU * f * tt) * np.exp(-tt / 0.32) + 0.4 * np.sin(TAU * 2 * f * tt) * np.exp(-tt / 0.16)
         + 0.14 * np.sin(TAU * 3 * f * tt) * np.exp(-tt / 0.08) + 0.1 * np.sin(TAU * 5.04 * f * tt) * np.exp(-tt / 0.02))
    return y * _rajada(t, t0, 1e9, 0.0004)


def _sucesso(r, tonica=72, modo='maior', notas=3):
    terca = 4 if modo == 'maior' else 3
    ints = [7, 12] if int(notas) == 2 else [terca, 7, 12]
    base = _pitch(tonica, 84 - ints[0], 96 - ints[0])      # 1ª nota entre Dó6 e Si6: ataque acima de 1 kHz
    gap = 0.075 * r.uniform(0.92, 1.1)
    n = _S(gap * (len(ints) - 1) + 0.75)
    t = _T(n)
    mallet = synth.norm(sosfilt(synth.sos_lp(12000), _banda(n, 2500, 9000)))
    out = np.zeros((2, n))
    for k, iv in enumerate(ints):
        t0 = _S(k * gap) / synth.SR
        f = synth.M(base + iv) * r.uniform(0.998, 1.002)
        y = _nota_chime(f, n, t, t0) + (0.9 if k == 0 else 0.4) * mallet * _rajada(t, t0, 0.0025, 0.0004)
        g = 1.0 if k == 0 else 0.85 + 0.15 * k / max(1, len(ints) - 1)
        out += synth.to_stereo(g * y, -0.15 + 0.3 * k / max(1, len(ints) - 1))
    return synth.norm(out * synth.edges(n, 0.0003, 0.08)), 0


def _riser(r, dur=1.5, tonica=57, ticks=False):
    dur = float(dur)
    n = _S(dur)
    t = _T(n)
    x = t / dur
    fc = 300 * (8000 / 300) ** (x ** 1.5)
    nz = synth.norm(synth.tv_filter(synth.noise(n, 2), fc * r.uniform(0.95, 1.05), 0.9, 'bp', block=32))
    alvo = _pitch(tonica, 60, 72)
    fa = synth.M(alvo - 24) * 4 ** (x ** 1.3)
    ph = TAU * np.cumsum(fa) / synth.SR
    ton = synth.norm(sum(np.sin(h * ph) / h for h in range(1, 5)))
    y = 0.7 * nz + 0.35 * ton[None, :]
    if ticks:
        tk_sig = np.zeros(n)
        tk, d = 0.0, 0.075
        while tk < dur - 0.012:
            u = tk / dur
            tk_sig += (0.6 + 0.4 * u) * np.sin(TAU * synth.M(84 + 24 * u) * np.maximum(t - tk, 0)) * _rajada(t, tk, 0.004)
            tk += d
            d = max(0.012, d * 0.85)
        y = y + 0.5 * synth.norm(tk_sig)[None, :]
    y = sosfilt(synth.sos_lp(14000), y, axis=1) * x ** 2.4
    return y * synth.edges(n, 0.02, 0.004), n


def _impacto(r, dur=1.2, tonica=None):
    dur = float(dur)
    n = _S(dur)
    t = _T(n)
    j = r.uniform(0.96, 1.04)
    f_corpo = synth.M(_pitch(tonica, 36, 48)) if tonica is not None else 82.4 * j
    grave = _seno_caindo(t, 44 * j, 110 * j, 0.06) * _rajada(t, 0, 0.3 * dur, 0.0015)
    corpo = _seno_caindo(t, f_corpo, 2.1 * f_corpo, 0.018) * _rajada(t, 0, 0.22, 0.0015)
    soco = np.tanh(2.5 * synth.norm(sosfilt(synth.sos_lp(1600), synth.noise(n)))) * _rajada(t, 0, 0.035, 0.0006)
    soco = sosfilt(synth.sos_lp(5000), soco)
    ar = synth.norm(sosfilt(synth.sos_lp(12000), _banda(n, 1800, 9000, 2), axis=1)) * _rajada(t, 0, 0.12, 0.0008)
    clique = synth.norm(_banda(n, 1500, 7000)) * _rajada(t, 0, 0.0015, 0.0003)
    y = (0.8 * grave + 0.55 * corpo + 0.45 * soco + 0.5 * clique)[None, :] + 0.3 * ar
    return synth.norm(y * synth.edges(n, 0.0005, 0.2)), 0


def _acento(r, nota=84):
    n = _S(0.6)
    t = _T(n)
    f = synth.M(nota) * r.uniform(0.999, 1.001)
    palheta = synth.norm(_banda(n, 2000, 8000)) * _rajada(t, 0, 0.002, 0.0003)
    y = synth.pluck(f, 0.6, bright=0.75, tau=0.25) + 0.6 * palheta
    return synth.norm(y * synth.edges(n, 0.0005, 0.05)), 0


# Desenho sonoro portado de engine/audio/sfx.js do explainroo (MIT, © 2026 Vincent Schmalbach),
# https://github.com/vincentsch/explainroo
_PENTA = (0, 2, 4, 7, 9)
_UNIFORME = 1 / math.sqrt(3)       # o ruído do motor original é uniforme em ±1: mesmo RMS, mesmas proporções na mistura


def _recebe_indice(gerador):
    """Marca o gerador que recebe o `indice` da ocorrência (o blip sobe de nota a cada item de lista)."""
    gerador.recebe_indice = True
    return gerador


def _tonica(tonica):
    """Tônica de blip e brilho: o parâmetro; sem ele, o "tonica" da folha; sem nada, 72 (Dó).
    Só a classe de altura conta: vai para Dó4–Si4, o `60 + tom` do motor original."""
    if tonica is None:
        tonica = synth.FOLHA.get('tonica', 72)
    if isinstance(tonica, bool) or not isinstance(tonica, (int, float)):
        raise ValueError(f'tonica must be MIDI (e.g. 62) or a pitch class 0–11, got {tonica!r}')
    return _pitch(tonica, 60, 72)


def _penta(tonica, passo):
    """MIDI do `passo` da pentatônica maior a partir da tônica (5 passos = uma oitava)."""
    return tonica + 12 * (passo // 5) + _PENTA[passo % 5]


def _ruido(n):
    return synth.noise(n) * _UNIFORME


def _biquad(x, tipo, fc, q=0.707):
    b, a = synth.rbj(tipo, fc, q)
    return lfilter(b, a, x, axis=-1)


def _glide(t, f0, f1, dur):
    """Fase (começa em 0) de um tom que vai de f0 a f1 em curva exponencial por `dur` s e para em f1."""
    fa = f0 * (f1 / f0) ** np.clip(t / dur, 0.0, 1.0)
    return TAU * (np.cumsum(fa) - fa[0]) / synth.SR


def _ruido_curto(n, t, t0, f1, f2, tau, a=0.0003):
    """Rajada de ruído em banda [f1, f2] com RMS unitário antes do envelope: o nível não depende do sorteio."""
    x = _banda(n, f1, f2)
    return x / (x.std() + 1e-12) * _rajada(t, t0, tau, a)


def _pop(r):
    n = _S(0.25)
    t = _T(n)
    tom = np.sin(_glide(t, r.uniform(360, 420), r.uniform(780, 880), 0.045)) * _rajada(t, 0, 0.03, 0.002)
    y = sosfilt(synth.sos_lp(12000), tom + 0.23 * _ruido_curto(n, t, 0, 2500, 9000, 0.004, 0.0008))
    return synth.norm(y * synth.edges(n, 0.0003, 0.03)), 0


def _tique(r):
    n = _S(0.06)
    t = _T(n)
    tom = np.sin(TAU * 2800 * r.uniform(0.94, 1.06) * t) * _rajada(t, 0, 0.005, 0.0005)
    y = sosfilt(synth.sos_lp(12000), 0.37 * _ruido_curto(n, t, 0, 3500, 9000, 0.0018, 0.0008) + 0.5 * tom)
    return synth.norm(y * synth.edges(n, 0.0003, 0.012)), 0


@_recebe_indice
def _blip(r, passo=None, tonica=None, indice=0):
    p = int(indice) % 8 if passo is None else int(round(float(passo)))
    f = synth.M(_penta(_tonica(tonica) + 12, p)) * r.uniform(0.9994, 1.0006)
    n = _S(0.35)
    t = _T(n)
    ph = _glide(t, 0.94 * f, f, 0.015)
    tri = sum((-1) ** (k // 2) * np.sin(k * ph) / (k * k) for k in range(1, int(14000 // f) + 1, 2)) * 8 / np.pi ** 2
    y = (tri * _rajada(t, 0, 0.05 * r.uniform(0.94, 1.06), 0.002)
         + 0.25 * np.sin(2 * ph) * _rajada(t, 0, 0.025, 0.002))
    return synth.norm(y * synth.edges(n, 0.0003, 0.04)), 0


def _rosa(n):
    """Ruído rosa (filtro econômico de Paul Kellet, como no motor original)."""
    w = _ruido(n)
    return 0.22 * (lfilter([0.099046], [1, -0.99765], w) + lfilter([0.2965164], [1, -0.963], w)
                   + lfilter([1.0526913], [1, -0.57], w) + 0.1848 * w)


def _tracos(r, dur, banda, q, rosa, grao, rangido):
    """Caneta ou giz desenhando: um ruído em banda cujo ganho e centro mudam traço a traço (cada traço sobe em
    18 ms). `grao` = ganho granulado dentro do traço; `rangido` = rangidos curtos ocasionais."""
    dur = float(dur)
    if dur < 0.05:
        raise ValueError(f'dur must be at least 0.05 s, got {dur}')
    n = _S(dur)
    t = _T(n)
    ta, va, tf, vf, rangidos = [], [], [], [], []
    s = 0.0
    while s < dur - 0.04:
        ln = min(dur - s, r.uniform(0.09, 0.22))
        pico = r.uniform(0.7, 1.0)
        f0 = r.uniform(*banda)
        tf += [s, s + ln]
        vf += [f0, f0 * r.uniform(0.8, 1.25)]
        ta += [s, s + 0.018]
        va += [0.0, pico]
        if grao:
            x = s + 0.03
            while x < s + ln - 0.03:
                ta.append(x)
                va.append(pico * r.uniform(0.35, 1.0))
                x += r.uniform(0.012, 0.025)
        else:
            ta.append(s + ln - 0.022)
            va.append(pico * r.uniform(0.75, 0.95))
        ta.append(s + ln)
        va.append(0.0)
        if rangido and r.random() < 0.25:
            rangidos.append((s + r.uniform(0.02, max(0.03, ln - 0.08)), r.uniform(2600, 3400)))
        s += ln + r.uniform(0.02, 0.05)
    x = (_rosa(n) if rosa else _ruido(n)) * np.interp(t, ta, va)
    y = synth.tv_filter(x, np.interp(t, tf, vf), q, 'bp', block=16)
    for at, f in rangidos:
        ph = TAU * np.cumsum(np.interp(t, [at, at + 0.06], [f, f * r.uniform(0.9, 1.1)])) / synth.SR
        y = y + 0.18 * np.sin(ph - ph[min(n - 1, _S(at))]) * _rajada(t, at, 0.025, 0.01)
    y = sosfilt(synth.sos_lp(12000), y)
    return synth.norm(synth.to_stereo(y * synth.edges(n, 0.0005, 0.01), r.uniform(-0.15, 0.15))), 0


def _rabisco(r, dur=0.6):
    return _tracos(r, dur, (1500, 2700), 1.3, rosa=True, grao=False, rangido=False)


def _giz(r, dur=0.6):
    return _tracos(r, dur, (2800, 4800), 0.9, rosa=False, grao=True, rangido=True)


_PING_BRILHO = ((1, 1, 1), (2.76, 0.2, 0.4), (5.4, 0.1, 0.2))


def _ping(t, t0, f, decaimento, parciais):
    """Ping de sino com parciais inarmônicos (razão, amplitude, fração do decaimento)."""
    tt = np.maximum(t - t0, 0.0)
    return sum(a * np.sin(TAU * f * razao * tt) * _rajada(t, t0, decaimento * df / 4, 0.0015)
               for razao, a, df in parciais if f * razao < 16000)


def _brilho(r, tonica=None):
    base = _tonica(tonica) + 24
    pings, at = [], 0.0
    for k in range(6):
        pings.append((_S(at) / synth.SR, synth.M(_penta(base, int(r.integers(0, 7)))), 0.85 ** k,
                      r.uniform(0.5, 0.8), r.uniform(-0.7, 0.7)))
        at += r.uniform(0.035, 0.07)
    n = _S(max(a + 7 * d / 4 + 0.02 for a, _, _, d, _ in pings))
    t = _T(n)
    out = np.zeros((2, n))
    for a, f, g, d, pan in pings:
        out += synth.to_stereo(g * _ping(t, a, f, d, _PING_BRILHO), pan)
    return synth.norm(out * synth.edges(n, 0.0003, 0.08)), 0


def _baque(r):
    n = _S(0.6)
    t = _T(n)
    j = r.uniform(0.97, 1.03)
    corpo = np.sin(_glide(t, 110 * j, 42 * j, 0.18)) * _rajada(t, 0, 0.09 * r.uniform(0.94, 1.06), 0.002)
    grave = _biquad(_ruido(n), 'lp', 400, 0.8) * _rajada(t, 0, 0.03, 0.0008)
    feltro = _ruido_curto(n, t, 0, 1200, 5000, 0.003)            # contato de feltro: o ataque que a cama deixa ouvir
    y = corpo + 0.3 * grave + 0.33 * feltro
    return synth.norm(y * synth.edges(n, 0.0003, 0.08)), 0


def _erro(r):
    n = _S(0.33)
    t = _T(n)
    j = r.uniform(0.985, 1.015)
    g = 0.17 * r.uniform(0.97, 1.03)
    env = np.interp(t, [0, 0.01, 0.1, 0.12, g, g + 0.01, g + 0.1, g + 0.12], [0, 1, 1, 0, 0, 1, 1, 0])
    y = _biquad((synth.saw(110 * j, n, 0.0) + synth.saw(116.5 * j, n, 0.0)) * env, 'lp', 700, 0.8)
    y = y + 0.66 * (_ruido_curto(n, t, 0, 1200, 5000, 0.004) + 0.6 * _ruido_curto(n, t, g, 1200, 5000, 0.004))   # estalo
    return synth.norm(y * synth.edges(n, 0.0003, 0.02)), 0


_GERADORES = {'toque': _toque, 'clique': _clique, 'digitacao': _digitacao, 'virada': _virada,
              'whoosh': _whoosh, 'sucesso': _sucesso, 'riser': _riser, 'impacto': _impacto, 'acento': _acento,
              'pop': _pop, 'tique': _tique, 'blip': _blip, 'rabisco': _rabisco, 'giz': _giz, 'brilho': _brilho,
              'baque': _baque, 'erro': _erro}


# ------------------------------------------------------------------ API
def _acabamento(y):
    """Comum a todos: passa-baixa íngreme em 15 kHz (nada perto de 18 kHz), rampa de 3 ms no fim
    (a cauda do filtro) e DC zerado por um bump sin² que vale zero nas bordas."""
    y = sosfilt(synth.sos_lp(15000, 8), y, axis=-1)
    y = synth.tail_fade(y, 0.003)
    n = y.shape[-1]
    w = np.sin(np.pi * np.arange(n) / (n - 1)) ** 2
    return y - y.mean(axis=-1, keepdims=True) / w.mean() * w


def _rng(nome, semente, indice):
    return np.random.default_rng([int(semente) & 0xFFFFFFFF, zlib.crc32(nome.encode()), int(indice)])


def som_ancorado(nome, semente=0, indice=0, **params):
    """Como som(), mas devolve (sinal, âncora em amostras a partir do início do sinal)."""
    if nome not in _GERADORES:
        raise ValueError(f'unknown sound: {nome!r}. Available: {", ".join(CATALOGO)}')
    r = _rng(nome, semente, indice)
    guardado = synth.rng
    synth.rng = r                                  # os ruídos do synth usam synth.rng: troca e devolve
    gerador = _GERADORES[nome]
    if getattr(gerador, 'recebe_indice', False):
        params['indice'] = int(indice)
    try:
        y, ancora = gerador(r, **params)
    except TypeError as e:
        aceitos = ", ".join(CATALOGO[nome]["parametros"]) or "none"
        raise TypeError(f'invalid parameter for {nome!r}: {e}. Accepted: {aceitos}') from None
    finally:
        synth.rng = guardado
    y = _acabamento(np.asarray(y, float))
    g = 10 ** ((NIVEL_SOM - loud_curta(y)) / 20)
    return y * g, int(ancora)


def som(nome, semente=0, indice=0, **params):
    """Gera o som `nome` (mono (n,) ou estéreo (2, n)), começando e terminando em zero, com loudness curta de
    -26 LUFS. Mesmo (nome, semente, indice, params) = mesmo sinal; `indice` diferente = micro variação."""
    return som_ancorado(nome, semente, indice, **params)[0]


def ref_cama(excluir=('sfx',)):
    """Loudness integrada (BS.1770) da soma dos buses musicais que já estão na mesa (pré-master)."""
    x = sum(synth.bus[k] for k in synth.BUSES if k not in excluir)
    if not np.any(x):
        raise ValueError('there is no music bed on the mixer to use as the reference — pass ref_lufs=… to colocar()')
    return synth.lufs_integrated(x)


SUBIDA_ALVO = 12.0         # dB previstos; reverb e delay (fora da previsão) comem ~3 dB — o verify.py exige 6
PASSOS_ESPACO = ((0, 0), (2, 0), (4, 0), (6, 0), (6, 2), (8, 2), (10, 2), (10, 4))   # (cama cede dB, efeito sobe dB)
PASSOS_SO_CEDE = ((0, 0), (2, 0), (4, 0), (6, 0), (8, 0), (10, 0), (12, 0), (14, 0))  # o efeito tem nível fixo (debaixo da fala)
_PROTEGIDOS = ('sfx', 'acento')


def _rms5_db(x):
    w = _S(0.005)
    return 10 * np.log10(np.convolve(x * x, np.ones(w) / w, 'same') + 1e-14)


def _prever_subida(fundo, evento, i0):
    """Subida (dB) do onset em i0 como o verify.py mede: RMS 5 ms, banda cheia e >1 kHz, base = mediana
    de 25 a 6 ms antes, pico nos 20 ms seguintes. `fundo` e `evento` são mono, recortes que começam em
    i0 − 0,2 s. Devolve a melhor das duas bandas."""
    from scipy.signal import butter, sosfiltfilt
    k = _S(0.2)
    melhor = -99.0
    for banda in (None, butter(4, 1000, 'high', fs=synth.SR, output='sos')):
        f = fundo if banda is None else sosfiltfilt(banda, fundo)
        e = evento if banda is None else sosfiltfilt(banda, evento)
        base = np.median(_rms5_db(f)[k - _S(0.025):k - _S(0.006)])
        depois = _rms5_db(f + e)[k:k + _S(0.02)].max()
        melhor = max(melhor, depois - base)
    return melhor


def _curva_espaco(n, i0, cede_db, segura=0.1, fim=0.4):
    """Ganho local (n amostras a partir de i0 − 0,2 s): desce em cosseno de −60 a −30 ms, segura até +100 ms,
    volta em 300 ms. Lookahead: a base do detector (−25 a −6 ms) já está cedida.
    A versão curta (segura até +50 ms, de volta em +150 ms) serve a um efeito logo antes de uma fala."""
    g = np.ones(n)
    if cede_db <= 0:
        return g
    k, prof = _S(0.2), 1 - 10 ** (-cede_db / 20)
    a, b, c, d = k - _S(0.06), k - _S(0.03), k + _S(segura), k + _S(fim)
    g[a:b] -= prof * (0.5 - 0.5 * np.cos(np.pi * np.arange(b - a) / (b - a)))
    g[b:c] -= prof
    g[c:d] -= prof * (0.5 + 0.5 * np.cos(np.pi * np.arange(d - c) / (d - c)))
    return g


def _abrir_espaco(x_evento, i0, bus, ganho_ev, proteger=(), curto=False, subir=True):
    """Escolhe o menor ajuste (cama cede / efeito sobe) que dá SUBIDA_ALVO; aplica a cessão nos buses musicais
    (e nos envios deles). Devolve (cede_db, sobe_db, subida prevista)."""
    ia, ib = i0 - _S(0.2), i0 + _S(0.45)
    if ia < 0 or ib > synth.N:
        return 0, 0, float('nan')
    musicais = [k for k in synth.BUSES if k not in _PROTEGIDOS and k not in proteger and k != bus]
    zero = np.zeros((2, ib - ia))
    cama = sum((synth.bus[k][:, ia:ib] for k in musicais), zero).mean(0)
    resto = sum((synth.bus[k][:, ia:ib] for k in synth.BUSES if k not in musicais), zero).mean(0)
    ev = np.zeros(ib - ia)
    m = min(x_evento.shape[-1], ib - i0)
    ev[_S(0.2):_S(0.2) + m] = x_evento.mean(0)[:m] * ganho_ev
    for cede, sobe in (PASSOS_ESPACO if subir else PASSOS_SO_CEDE):
        g = _curva_espaco(ib - ia, i0, cede, 0.05, 0.15) if curto else _curva_espaco(ib - ia, i0, cede)
        sub = _prever_subida(cama * g + resto, ev * 10 ** (sobe / 20), i0)
        if sub >= SUBIDA_ALVO:
            break
    if cede:
        for k in musicais:
            synth.bus[k][:, ia:ib] *= g
            for d in synth.sends.values():
                if k in d:
                    d[k][:, ia:ib] *= g.astype(d[k].dtype)
    return cede, sobe, sub


def colocar(itens, bus='sfx', ref_lufs=None, semente=None, verbose=True, abrir=True, proteger=()):
    """Põe cada som na mesa. itens: [{'t': s, 'som': nome, 'nivel': dB rel. à cama (opcional),
    'pan', 'rev', 'dly', 'event' (opcionais), e parâmetros do som (dur, variante, tonica…)}].
    Âncora 'inicio' → começa em t com event=True; 'pico' → pico em t; 'fim' → termina em t.
    ref_lufs=None mede a soma dos buses musicais já na mesa (chame depois de compor e nivelar a cama).
    abrir=True: para cada som de ataque seco, prevê a subida do onset como o verify.py mede e, se ficar
    abaixo de SUBIDA_ALVO (12 dB), faz a cama ceder com antecipação (2–10 dB) e, em último caso, sobe o
    efeito (até +4 dB). Buses 'sfx' e 'acento' nunca cedem, nem os de `proteger` (ex.: ('bumbo',) na pista:
    o quatro por quatro não pode sumir a cada clique).
    Por item, 'bus' troca o bus daquele som; 'abrir': False dispensa o abrir espaço dele (a locução já abriu), e
    'abrir': 'curto' devolve a cama em 150 ms em vez de 400 (o efeito vem logo antes de uma fala), e 'subir': False
    nunca sobe o efeito, só faz a cama ceder (até 14 dB): o nível dele é contrato (ex.: −6 dB debaixo da fala).
    Devolve a lista do que foi posto (t, início, som, nível final, ganho, event, cessão, subida prevista)."""
    if not synth.N:
        raise RuntimeError('call synth.configurar(folha) before sons.colocar')
    if semente is None:
        semente = int(synth.FOLHA.get('semente', 0))
    ref = ref_cama(excluir=(bus,)) if ref_lufs is None else float(ref_lufs)
    contagem, postos = {}, []
    # no mesmo instante, o que não tem ataque (riser que termina em t) entra antes, para a previsão enxergar
    for it in sorted(itens, key=lambda d: (float(d['t']), CATALOGO.get(d['som'], {}).get('ataque_seco', True))):
        nome, t = it['som'], float(it['t'])
        if nome not in CATALOGO:
            raise ValueError(f'unknown sound: {nome!r}. Available: {", ".join(CATALOGO)}')
        cat = CATALOGO[nome]
        params = {k: v for k, v in it.items() if k not in _RESERVADOS}
        idx = contagem.get(nome, 0) + int(it.get('indice', 0))
        contagem[nome] = contagem.get(nome, 0) + 1
        y, anc = som_ancorado(nome, semente, idx, **params)
        y = _estereo(y) if y.ndim == 2 else y
        nivel = float(it.get('nivel', cat['nivel_db']))
        ganho_db = ref + nivel - NIVEL_SOM
        i0 = _S(t) - anc
        if i0 < 0:                                      # começaria antes do zero: corta a cabeça com rampa
            y = y[..., -i0:].copy()
            y *= synth.edges(y.shape[-1], 0.005, 0.0001)
            i0 = 0
        for a, b in synth.SILENCIOS:                    # começaria num silêncio: começa no fim dele
            if _S(a) <= i0 < _S(b):
                y = y[..., _S(b) - i0:].copy()
                y *= synth.edges(y.shape[-1], 0.005, 0.0001)
                i0 = _S(b)
        if i0 >= synth.N or y.shape[-1] == 0:
            continue
        ev = bool(it.get('event', cat['ancora'] == 'inicio' and cat['ataque_seco']))
        pan = float(it.get('pan', 0.0))
        cede = sobe = 0
        sub = float('nan')
        bus_it = it.get('bus', bus)
        modo = it.get('abrir', True)
        if abrir and ev and modo:
            xs = synth.to_stereo(y, pan) if y.ndim == 1 else y
            cede, sobe, sub = _abrir_espaco(xs, i0, bus_it, 10 ** (ganho_db / 20), proteger, curto=modo == 'curto',
                                            subir=it.get('subir', True))
            ganho_db += sobe
        synth.place(y, i0 / synth.SR, bus_it, gain=10 ** (ganho_db / 20), pan=pan,
                    rev=float(it.get('rev', cat['rev'])), dly=float(it.get('dly', 0.0)), event=ev)
        postos.append({'t': t, 'inicio': i0 / synth.SR, 'som': nome, 'nivel_db': nivel + sobe, 'ganho_db': ganho_db,
                       'event': ev, 'cama_cede_db': cede, 'subida_prevista_db': sub})
    if verbose and postos:
        print(f'sons: {len(postos)} effect(s) on bus {bus!r}, bed at {ref:.1f} LUFS')
        for p in postos:
            extra = ''
            if p['event']:
                extra = f", predicted rise {p['subida_prevista_db']:.1f} dB"
                if p['cama_cede_db']:
                    extra += f", bed ducks {p['cama_cede_db']} dB"
            print(f"  {p['t']:8.3f} s  {p['som']:10s} {p['nivel_db']:+5.1f} dB rel."
                  f"  (starts at {p['inicio']:.3f}{', event' if p['event'] else ''}{extra})")
    return postos


# ------------------------------------------------------------------ verificação
_CASOS = [
    ('toque', {}), ('toque', {'variante': 'firme'}),
    ('clique', {}), ('clique', {'variante': 'trackpad'}),
    ('digitacao', {'dur': 1.6}), ('digitacao', {'teclas': 10, 'teclado': 'mecanico', 'enter': True}),
    ('digitacao', {'teclas': 6, 'teclado': 'tela'}),
    ('virada', {}), ('virada', {'variante': 'cartao', 'direcao': -1}),
    ('whoosh', {'variante': 'curto'}), ('whoosh', {}), ('whoosh', {'variante': 'longo', 'direcao': -1}),
    ('sucesso', {}), ('sucesso', {'notas': 2, 'tonica': 67}), ('sucesso', {'modo': 'menor', 'tonica': 69}),
    ('riser', {}), ('riser', {'dur': 1.0, 'ticks': True, 'tonica': 62}),
    ('impacto', {}), ('impacto', {'tonica': 63, 'dur': 1.6}),
    ('acento', {}), ('acento', {'nota': 91}),
    ('pop', {}), ('tique', {}),
    ('blip', {}), ('blip', {'passo': 0}), ('blip', {'passo': 4}), ('blip', {'passo': 4, 'tonica': 67}),
    ('blip', {'passo': 7, 'tonica': 71}),
    ('rabisco', {}), ('rabisco', {'dur': 0.3}), ('rabisco', {'dur': 1.2}),
    ('giz', {}), ('giz', {'dur': 0.3}), ('giz', {'dur': 1.2}),
    ('brilho', {}), ('brilho', {'tonica': 69}),
    ('baque', {}), ('erro', {}),
]


def _hash(y):
    return hashlib.sha1(np.ascontiguousarray(y).tobytes()).hexdigest()[:12]


def verificar(saida=None):
    import subprocess
    from scipy.signal import butter, sosfiltfilt
    SR = synth.SR
    falhas = []
    print(f'{"sound":10s} {"parameters":38s} {"dur":>6s} {"peak":>7s} {"LUFS-S":>6s} {"DC":>8s} {">18k":>6s} '
          f'{"attack":>7s} {"promin.":>7s} {"edges":>8s}  result')
    catalogo = []
    for nome, p in _CASOS:
        y, anc = som_ancorado(nome, 7, 0, **p)
        y2, _ = som_ancorado(nome, 7, 0, **p)
        y3, _ = som_ancorado(nome, 7, 1, **p)
        x = _estereo(y)
        mono = x.mean(0)
        erros = []
        if not np.all(np.isfinite(x)):
            erros.append('NaN/inf')
        borda = max(np.abs(x[:, 0]).max(), np.abs(x[:, -1]).max())
        if borda >= 1e-4:
            erros.append(f'edge {borda:.1e}')
        dc = np.abs(x.mean(1)).max()
        if dc >= 1e-3:
            erros.append(f'DC {dc:.1e}')
        pico = np.abs(x).max()
        if pico > 1.0:
            erros.append(f'peak {pico:.2f}')
        hf = sosfiltfilt(butter(4, 18000, 'high', fs=SR, output='sos'), mono)
        e18 = 10 * np.log10(np.sum(hf ** 2) / (np.sum(mono ** 2) + 1e-20) + 1e-20)
        if e18 >= -40:
            erros.append(f'>18 kHz {e18:.0f} dB')
        amp = np.abs(x).max(0)
        i_at = int(np.argmax(amp >= 0.25 * amp.max()))
        at_ms = (i_at - anc) / SR * 1000 if CATALOGO[nome]['ancora'] == 'inicio' else float('nan')
        if CATALOGO[nome]['ataque_seco'] and not (0 <= at_ms <= 2.0):
            erros.append(f'attack {at_ms:.1f} ms')
        if _hash(y) != _hash(y2):
            erros.append('not deterministic')
        if y3.shape == y.shape and np.allclose(y3, y):
            erros.append('index 1 = index 0 (no variation)')
        lc = loud_curta(y)
        # destaque: RMS 5 ms do ataque acima de 1 kHz, no nível padrão, relativo à loudness da cama.
        # É a banda que decide o onset no verify.py quando o baixo da cama ondula a banda cheia.
        agudo = sosfiltfilt(butter(4, 1000, 'high', fs=SR, output='sos'), mono) * math.sqrt(2)
        rms5 = np.convolve(agudo ** 2 * 2, np.ones(_S(0.005)) / _S(0.005), 'same')
        destaque = float('nan')
        if CATALOGO[nome]['ataque_seco']:
            destaque = 10 * np.log10(rms5[anc:anc + _S(0.012)].max() + 1e-20) - lc + CATALOGO[nome]['nivel_db']
            if destaque < LIM_DESTAQUE:
                erros.append(f'weak high-frequency attack ({destaque:+.1f} dB)')
        ok = not erros
        if not ok:
            falhas.append(f'{nome} {p}: ' + ', '.join(erros))
        ps = ', '.join(f'{k}={v}' for k, v in p.items()) or '—'
        print(f'{nome:10s} {ps[:38]:38s} {x.shape[1] / SR:6.3f} {20 * np.log10(pico):6.1f}d {lc:6.1f} {dc:8.1e} '
              f'{e18:6.0f} {at_ms:6.2f}m {destaque:+6.1f}d {borda:8.1e}  {"OK" if ok else "FAILED: " + ", ".join(erros)}')
        catalogo.append(x)
    if saida:
        d = Path(saida).resolve()
        d.mkdir(parents=True, exist_ok=True)
        gap = np.zeros((2, _S(0.45)))
        todo = np.concatenate([np.concatenate([c, gap], axis=1) for c in catalogo], axis=1)
        todo *= 10 ** (-12 / 20) / (np.abs(todo).max() + 1e-12) * 1.0
        todo = np.concatenate([gap, todo], axis=1)
        wav = d / 'catalog.wav'
        synth.write_wav24(wav, todo)
        png = d / 'catalog-spectrum.png'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-lavfi',
                        'showspectrumpic=s=1920x1080:legend=1:scale=log', str(png)], check=False)
        print(f'\ncatalog: {wav} ({todo.shape[1] / SR:.1f} s, in table order, 0.45 s between sounds)')
        print(f'spectrogram: {png}')
    print('\nRESULT: ' + ('all OK' if not falhas else f'{len(falhas)} failure(s)\n  ' + '\n  '.join(falhas)))
    return 0 if not falhas else 1


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--verify' in a:
        sd = a[a.index('--out') + 1] if '--out' in a else None
        sys.exit(verificar(sd))
    print(__doc__)
