#!/usr/bin/env python3
"""Objective checks of a soundtrack against its sync sheet.

Usage:  python verify.py [sheet.json] [arquivo.wav]
        no arguments: ./sheet.json and the WAV in "saida" (relative to the sheet's folder)

Checks the format and the exact sample count, onsets at the markers (±10 ms), silences with digital
zero, clicks at the edges of the silences and at the end, peak, DC, mono bass, energy >18 kHz,
integrated loudness (BS.1770) and true peak (4x) — all here, without ffmpeg. It only reads files.

Sheet with "voz" (mix_voz.py): it also measures, on the stems, what the mix did — the voice where the sheet puts it,
every line at the same level, the voice ≥ 12 dB above the soundtrack (and on a phone speaker), how much and when the
music ducks, the 1.5–4 kHz cut, the effects under the speech and pumping. The markers are then measured on the
soundtrack without the voice. This skill makes videos without narration.
Exit code: 0 if everything passed, 1 if something failed.
"""
import json
import math
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, lfilter, resample_poly, sosfilt, sosfiltfilt

TOL_ONSET = 0.010          # s
LIM_DC = 1e-3              # ≈ -60 dBFS
LIM_LADO_GRAVE = -20.0     # dB, energia lateral/central abaixo de 120 Hz
LIM_18K = -40.0            # dB, energia acima de 18 kHz / total
TOL_LUFS = 0.5             # LU
TOL_TP = 0.1               # dB acima do teto (com voz: zero)
TOL_1SOM = 0.010           # s: 1º som da voz da folha contra o início do trecho
TOL_LUGAR = 0.001          # s: a voz do mix contra a voz da folha
STEMS_VOZ = ('voz', 'musica', 'efeitos', 'ref/musica', 'ref/musica-crua', 'ref/efeitos')


def ler_wav(path):
    with wave.open(str(path)) as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        i = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(i >= 1 << 23, i - (1 << 24), i) / 8388608.0
    elif sw == 2:
        x = np.frombuffer(raw, '<i2') / 32768.0
    elif sw == 4:
        x = np.frombuffer(raw, '<i4') / 2147483648.0
    else:
        raise SystemExit(f'unsupported sample format: {sw * 8} bits')
    return sr, ch, sw, n, x.reshape(-1, ch).T


def k_coefs(sr):
    """Ponderação K do BS.1770 para qualquer taxa (fórmulas do libebur128)."""
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


def ponderar(x, sr):
    b1, a1, b2, a2 = k_coefs(sr)
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=-1), axis=-1)


def lufs_integrado(x, sr):
    p = ponderar(x, sr) ** 2
    blk, hop = int(round(0.4 * sr)), int(round(0.1 * sr))
    cs = np.concatenate([np.zeros((x.shape[0], 1)), np.cumsum(p, axis=1)], axis=1)
    st = np.arange(0, x.shape[1] - blk + 1, hop)
    z = ((cs[:, st + blk] - cs[:, st]) / blk).sum(0)
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    m = lk > -70
    if not m.any():
        return -math.inf
    rel = -0.691 + 10 * np.log10(z[m].mean()) - 10
    return -0.691 + 10 * np.log10(z[m & (lk > rel)].mean())


def lufs_janela(y, sr, a, b):
    """Loudness de [a, b) s de um sinal JÁ ponderado (ponderar), com os gates do BS.1770. Janela menor que um bloco
    de 400 ms: sem gate. Pondera-se o sinal inteiro antes de cortar, para o filtro não começar do zero na janela."""
    seg = y[:, int(round(a * sr)):int(round(b * sr))]
    blk, hop = int(round(0.4 * sr)), int(round(0.1 * sr))
    if seg.shape[1] < blk:
        return -0.691 + 10 * np.log10((seg ** 2).mean(axis=1).sum() + 1e-20) if seg.size else -math.inf
    cs = np.concatenate([np.zeros((seg.shape[0], 1)), np.cumsum(seg ** 2, axis=1)], axis=1)
    st = np.arange(0, seg.shape[1] - blk + 1, hop)
    z = ((cs[:, st + blk] - cs[:, st]) / blk).sum(0)
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    m = lk > -70
    if not m.any():
        return -math.inf
    rel = -0.691 + 10 * np.log10(z[m].mean()) - 10
    return -0.691 + 10 * np.log10(z[m & (lk > rel)].mean())


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=1)
    return 20 * np.log10(np.abs(up).max() + 1e-20)


def env_db(mono, sr, win=0.005, hop=0.0005):
    p = mono ** 2
    cs = np.concatenate([[0.0], np.cumsum(p)])
    c = np.arange(0, len(mono), int(hop * sr))
    h = int(win * sr) // 2
    lo, hi = np.clip(c - h, 0, len(mono)), np.clip(c + h, 0, len(mono))
    return c / sr, 10 * np.log10((cs[hi] - cs[lo]) / np.maximum(hi - lo, 1) + 1e-14)


def onset(tt, db, m, rise=6.0):
    """Primeiro instante em m±15 ms em que o RMS(5 ms) sobe 3 dB acima do fundo logo antes
    do marco, desde que o pico nos 20 ms seguintes fique >= `rise` dB acima do fundo."""
    antes = db[(tt >= m - 0.025) & (tt < m - 0.006)]
    base = np.median(antes) if len(antes) else -140.0
    idx = np.where((tt >= m - 0.015) & (tt <= m + 0.015))[0]
    above = idx[db[idx] >= base + 3.0]
    if not len(above):
        return None, None
    i0 = above[0]
    peak = db[i0:i0 + 40].max() - base
    if peak < rise:
        return None, peak
    return tt[i0] - m, peak


def atraso(a, b, sr, max_s=0.15):
    """Quanto `a` está atrasado em relação a `b` (s), pela correlação cruzada, procurando em ±max_s."""
    from scipy.signal import correlate, correlation_lags
    c = correlate(a, b, mode='full', method='fft')
    lags = correlation_lags(len(a), len(b), mode='full')
    ok = np.abs(lags) <= int(max_s * sr)
    return lags[ok][np.argmax(c[ok])] / sr


def curva_ganho(m, r, sr, sos, win=0.02, hop=0.005):
    """Ganho (dB) que leva a régua r ao sinal m, janela a janela (mínimos quadrados), numa banda. NaN onde r é
    silêncio. Com a música crua como régua, é exatamente o que o mix fez com a música."""
    m, r = sosfiltfilt(sos, m.mean(0)), sosfiltfilt(sos, r.mean(0))
    cn, cd = np.concatenate([[0.0], np.cumsum(m * r)]), np.concatenate([[0.0], np.cumsum(r * r)])
    c = np.arange(0, len(m), int(hop * sr))
    h = int(win * sr) // 2
    lo, hi = np.clip(c - h, 0, len(m)), np.clip(c + h, 0, len(m))
    num, den = cn[hi] - cn[lo], cd[hi] - cd[lo]
    pot = den / np.maximum(hi - lo, 1)
    ok = (pot > np.median(pot[pot > 0]) * 1e-4) & (num > 0)
    return c / sr, np.where(ok, 20 * np.log10(np.where(ok, num, 1.0) / np.maximum(den, 1e-30)), np.nan)


def ler_stems_voz(pasta, n):
    st = {}
    for k in STEMS_VOZ:
        p = pasta / f'{k}.wav'
        if not p.exists():
            return None, f'missing {p} — run arrange_series.py with this sheet (it writes the voice stems)'
        _, _, _, m, y = ler_wav(p)
        if m != n:
            return None, f'{p.name} has {m} samples and the WAV has {n} — the stems belong to another soundtrack'
        st[k] = np.vstack([y, y]) if y.shape[0] == 1 else y
    return st, ''


def checar_voz(folha, folha_p, wav_p, x, sr, st, veredito):
    """As medidas do mix com voz, nos stems. Import tardio: só a folha com voz precisa do mix_voz.py."""
    import mix_voz as mv
    import sounds as sons
    bloco = folha['voz']
    print(f'\nvoice (profile {bloco.get("perfil")})')
    perfil = mv.PERFIS.get(bloco.get('perfil'))
    if perfil is None:
        veredito('voice profile', False, f'{bloco.get("perfil")!r} does not exist; use {" or ".join(mv.PERFIS)}')
        return
    dur = x.shape[1] / sr
    trechos = [(float(a), float(b)) for a, b in bloco['trechos']]
    grps = mv.grupos(trechos)
    dono = [next(k for k, (ga, gb) in enumerate(grps) if ga - 1e-9 <= a and b <= gb + 1e-9) for a, b in trechos]
    lado_p = wav_p.with_suffix('.voz.json')
    lado = json.loads(lado_p.read_text(encoding='utf-8')) if lado_p.exists() else None

    d = np.abs(st['voz'] + st['musica'] + st['efeitos'] - x).max() * 2 ** 23
    veredito('the stems add up to soundtrack.wav', d <= 4, f'max difference {d:.1f} LSB at 24 bits (limit 4)')

    # ------------------------------------------------ a voz no lugar da folha
    crua = mv.ler_voz(folha_p.parent / bloco.get('arquivo', 'voz.wav'), x.shape[1], sr)
    w10 = int(0.01 * sr)                        # 1º som como no inicio_voz da locução: 10 ms a partir do instante, passo 1 ms
    c2 = np.concatenate([[0.0], np.cumsum(crua ** 2)])
    tt = np.arange(0, len(crua) - w10, sr // 1000)
    db10 = 10 * np.log10((c2[tt + w10] - c2[tt]) / w10 + 1e-20)
    tt = tt / sr
    fala = sosfiltfilt(butter(4, [300, 3400], 'bandpass', fs=sr, output='sos'), np.vstack([st['voz'].mean(0), crua]), axis=1)
    fone = butter(4, mv.FONE, 'bandpass', fs=sr, output='sos')
    yv, yvf = ponderar(st['voz'], sr), ponderar(sosfilt(fone, st['voz'], axis=1), sr)
    trilha = st['musica'] + st['efeitos']
    yt, ytf = ponderar(trilha, sr), ponderar(sosfilt(fone, trilha, axis=1), sr)
    ym, yr = ponderar(st['musica'], sr), ponderar(st['ref/musica-crua'], sr)
    linhas, lv, falhas_1som, falhas_lugar, razoes, bombas = [], [], [], [], [], []
    for i, (a, b) in enumerate(trechos):
        idx = np.where((tt >= a - 0.1) & (tt <= b) & (db10 >= -45))[0]
        on = tt[idx[0]] if len(idx) else math.nan
        # (a fala que começa nos primeiros 50 ms do vídeo: índice negativo daria um trecho vazio)
        i0, i1 = max(0, int((a - 0.05) * sr)), int((b + 0.05) * sr)
        lag = atraso(fala[0, i0:i1], fala[1, i0:i1], sr)
        v, vf = lufs_janela(yv, sr, a, b), lufs_janela(yvf, sr, a, b)
        rc, rf = v - lufs_janela(yt, sr, a, b), vf - lufs_janela(ytf, sr, a, b)
        mom = [(lufs_janela(ym, sr, s0, s0 + 0.4), lufs_janela(yr, sr, s0, s0 + 0.4)) for s0 in np.arange(a, b - 0.4 + 1e-9, 0.05)]
        dif = [m1 - r1 for m1, r1 in mom]
        bomba = (max(dif) - min(dif)) if dif else math.nan
        var_m = (max(m1 for m1, _ in mom) - min(m1 for m1, _ in mom)) if mom else math.nan
        var_r = (max(r1 for _, r1 in mom) - min(r1 for _, r1 in mom)) if mom else math.nan
        lv.append(v)
        razoes.append((rc, rf))
        bombas.append(bomba)
        if not abs(on - a) <= TOL_1SOM:
            falhas_1som.append(f'{a:.3f} s (measured {on:.3f})')
        if abs(lag) > TOL_LUGAR:
            falhas_lugar.append(f'{a:.3f} s ({lag * 1000:+.1f} ms)')
        linhas.append(f'  {a:7.3f}–{b:<7.3f} {on:8.3f} {lag * 1000:+7.1f} ms {v:7.1f} {rc:8.1f} {rf:8.1f} '
                      f'{bomba:7.2f} {var_m:6.1f} {var_r:6.1f}')
    print(f"  {'segment':15s} {'1st snd':>8s} {'position':>10s} {'LUFS':>7s} {'voc/trk':>8s} {'phone':>8s} "
          f"{'pumping':>7s} {'music':>6s} {'raw':>6s}   (dB; pumping = how much the mix varies in 400 ms)")
    print('\n'.join(linhas))
    veredito('1st voice sound at the start of each segment', not falhas_1som,
             f'sheet voice, 10 ms from the instant > −45 dBFS, ±{TOL_1SOM * 1000:.0f} ms' + (': ' + ', '.join(falhas_1som) if falhas_1som else ''))
    veredito('the mix voice where the sheet voice is', not falhas_lugar,
             f'correlation at 300–3400 Hz, ±{TOL_LUGAR * 1000:.0f} ms' + (': ' + ', '.join(falhas_lugar) if falhas_lugar else ''))
    veredito('every line at the same level', max(lv) - min(lv) <= 1.0,
             f'from {min(lv):.1f} to {max(lv):.1f} LUFS (difference {max(lv) - min(lv):.2f}, limit 1)')
    cama = lufs_integrado(st['ref/musica'] + st['ref/efeitos'], sr)
    alvo_cama = mv.CAMA_LUFS - mv.VOZ_LUFS
    veredito('the bed below the voice', abs(cama - np.mean(lv) - alvo_cama) <= 0.5,
             f'soundtrack without voice {cama:.1f} LUFS, average line {np.mean(lv):.1f} → {cama - np.mean(lv):+.1f} dB (target {alvo_cama:+g} ±0.5)')
    pior = min(range(len(trechos)), key=lambda i: min(razoes[i]))
    veredito(f'voice ≥ {mv.MIN_RAZAO:g} dB above the soundtrack in every segment', all(min(r) >= mv.MIN_RAZAO for r in razoes),
             f'worst {min(razoes[pior]):.1f} dB in the segment at {trechos[pior][0]:.3f} s (full band {razoes[pior][0]:.1f}, '
             f'phone 300 Hz–8 kHz {razoes[pior][1]:.1f})')
    bmax = np.nanmax(bombas) if not all(math.isnan(b) for b in bombas) else 0.0
    veredito('no pumping', bmax < 3.0,
             f'within each segment the mix varies the music by at most {bmax:.2f} dB (400 ms LUFS, against the raw music; limit 3)')

    # ------------------------------------------------ quanto e quando a música cede (a música crua é a régua)
    tg, g = curva_ganho(st['musica'], st['ref/musica'], sr, butter(4, 600, 'low', fs=sr, output='sos'))
    _, gb = curva_ganho(st['musica'], st['ref/musica'], sr, butter(4, [2000, 3000], 'bandpass', fs=sr, output='sos'))

    def em(t0, arr=g):
        k = np.where(np.abs(tg - t0) <= 0.0101)[0]
        k = k[~np.isnan(arr[k])]
        return arr[k[np.argmin(np.abs(tg[k] - t0))]] if len(k) else math.nan

    def mediana(jans, arr=g):
        m = np.zeros(len(tg), bool)
        for j0, j1 in jans:
            m |= (tg >= j0) & (tg < j1)
        v = arr[m]
        return np.nanmedian(v) if np.any(~np.isnan(v)) else math.nan

    fim_volta = [gb_ + mv.SEGURA + mv.VOLTA for _, gb_ in grps]
    pausas = [(0.05, grps[0][0] - mv.ANTES - 0.05)] + \
             [(fv + 0.05, ga - mv.ANTES - 0.05) for fv, (ga, _) in zip(fim_volta, grps[1:])] + [(fim_volta[-1] + 0.05, dur - 0.05)]
    pausas = [(j0, j1) for j0, j1 in pausas if j1 - j0 >= 0.2]
    g_pausa = mediana(pausas)
    veredito('the music in the pauses', abs(g_pausa - perfil['pausa_db']) <= 0.5,
             f'{g_pausa:+.2f} dB over the bed (target {perfil["pausa_db"]:+g} ±0.5; median of {len(pausas)} pauses)')
    ruins, notas = [], []
    for k, (a, b) in enumerate(grps):
        extra = lado['grupos'][k]['desceu_a_mais_db'] if lado and k < len(lado['grupos']) else 0.0
        cede = g_pausa - mediana([(a, b)])
        esperado = perfil['cede_db'] + extra
        if abs(cede - esperado) > 0.5:
            ruins.append(f'{a:.3f}–{b:.3f} s ducks {cede:.1f} dB (expected {esperado:.1f})')
        if extra > 0:
            notas.append(f'{a:.3f} s: {extra:.1f} dB extra for the guarantee')
        prof = esperado
        solto = k == 0 or a - mv.ANTES - 0.05 > fim_volta[k - 1]
        livre = k == len(grps) - 1 or grps[k + 1][0] - mv.ANTES > fim_volta[k] + 0.04
        pontos = [('still up 0.18 s before', a - mv.ANTES - 0.03, 'cima', solto),
                  ('middle of the dip', a - mv.ANTES / 2, 'meio', solto),
                  ('down at the 1st sound', a, 'baixo', True),
                  ('down until 0.08 s after', b + mv.SEGURA - 0.01, 'baixo', True),
                  ('middle of the return', b + mv.SEGURA + mv.VOLTA / 2, 'meio', livre),
                  ('back up 0.53 s after', b + mv.SEGURA + mv.VOLTA + 0.02, 'cima', livre)]
        for nome, t0, onde, vale in pontos:
            if not vale:
                continue
            v = em(t0)
            if math.isnan(v):
                notas.append(f'{nome} at {t0:.3f} s: no music there, not measured')
                continue
            ok = {'cima': v >= g_pausa - 1.0, 'baixo': v <= g_pausa - (prof - 1.0),
                  'meio': abs(v - (g_pausa - prof / 2)) <= 1.5}[onde]
            if not ok:
                ruins.append(f'{nome} ({t0:.3f} s): {v:+.1f} dB')
        for (a1, b1), (a2, _), k1, k2 in zip(trechos, trechos[1:], dono, dono[1:]):
            if k1 == k2 == k and a2 - b1 > 0.02:
                sub = np.nanmax(np.where((tg >= b1) & (tg <= a2), g, np.nan)) if np.any((tg >= b1) & (tg <= a2) & ~np.isnan(g)) else math.nan
                if not math.isnan(sub) and sub > g_pausa - (prof - 1.0):
                    ruins.append(f'the {a2 - b1:.2f} s pause at {b1:.3f} s rose to {sub:+.1f} dB')
    curtas = sum(1 for (_, b1), (a2, _) in zip(trechos, trechos[1:]) if a2 - b1 < mv.PAUSA_MIN)
    veredito(f'the music ducks {perfil["cede_db"]:g} dB under speech, on time', not ruins,
             f'{len(grps)} dip(s): goes down {mv.ANTES:g} s before the 1st sound, holds {mv.SEGURA:g} s, comes back in {mv.VOLTA:g} s; '
             f'{curtas} pause(s) < {mv.PAUSA_MIN:g} s without rising' + ('; ' + '; '.join(ruins) if ruins else ''))
    for nt in notas:
        print(f'          ({nt})')
    rec_fala = mediana(trechos, gb - g)
    rec_pausa = mediana(pausas, gb - g)
    veredito(f'{mv.RECORTE_DB:g} dB cut at 1.5–4 kHz only under speech',
             abs(rec_fala + mv.RECORTE_DB) <= 0.75 and abs(rec_pausa) <= 0.5,
             f'measured at 2–3 kHz: {rec_fala:+.2f} dB in speech, {rec_pausa:+.2f} dB in the pauses')

    # ------------------------------------------------ efeitos debaixo da fala
    ef = []
    for mk in folha.get('marcos', []):
        if not mk.get('efeito'):
            continue
        it = {k: v for k, v in mk.items() if k != 'som'}
        it['som'] = mk['efeito']
        ini, fim = mv.span_efeito(it, sons.CATALOGO)
        esperado = mv.SOB_VOZ_DB if mk['efeito'] not in mv.EFEITOS_FICAM and mv.sob_voz(ini, fim, trechos) else 0.0
        ef.append((mk, max(0.0, ini), min(dur, fim), esperado))
    maus, info = [], []
    for mk, ini, fim, esperado in ef:
        i0, i1 = int(ini * sr), int(fim * sr)
        e_ref = np.sum(st['ref/efeitos'][:, i0:i1] ** 2)
        if e_ref <= 0:
            continue
        r = 10 * np.log10(np.sum(st['efeitos'][:, i0:i1] ** 2) / e_ref + 1e-20)
        mistura = any(o is not mk and oe != esperado and oi < fim and of > ini for o, oi, of, oe in ef)
        txt = f"{mk['efeito']} {mk['t']:.3f} s {r:+.1f} dB (expected {esperado:+g})"
        if mistura:
            info.append(txt + ', overlaps another effect: info only')
        elif abs(r - esperado) > 1.0:
            maus.append(txt)
    n_sob = sum(1 for *_, e in ef if e)
    veredito('effects under speech', not maus,
             f'{n_sob} went down {mv.SOB_VOZ_DB:g} dB, {len(ef) - n_sob} stayed ({", ".join(mv.EFEITOS_FICAM)} always stay)'
             + ('; ' + '; '.join(maus) if maus else ''))
    for t in info:
        print(f'          ({t})')


def main():
    args = sys.argv[1:]
    if any(a in ('-h', '--help') for a in args):
        print(__doc__)
        return 0
    folha_p = Path(args[0] if args else 'sheet.json').resolve()
    if not folha_p.exists():
        print(f'sheet not found: {folha_p}\nusage: python verify.py [sheet.json] [arquivo.wav]')
        return 1
    folha = json.loads(folha_p.read_text(encoding='utf-8'))
    wav_p = Path(args[1]).resolve() if len(args) > 1 else (folha_p.parent / folha['saida']).resolve()
    if not wav_p.exists():
        print(f'WAV not found: {wav_p} — run the arrangement first (or pass the path as the 2nd argument)')
        return 1

    dur, taxa = float(folha['duracao']), int(folha['taxa'])
    silencios = sorted((float(a), float(b)) for a, b in folha.get('silencios', []))
    marcos = sorted(folha.get('marcos', []), key=lambda m: m['t'])
    falhas = []

    def veredito(nome, ok, detalhe=''):
        print(f'  {"OK    " if ok else "FAILED"}  {nome}{": " + detalhe if detalhe else ""}')
        if not ok:
            falhas.append(nome)

    print(f'sheet: {folha_p.name} — {folha.get("titulo", "")}')
    print(f'wav:   {wav_p}')
    sr, ch, sw, n, x = ler_wav(wav_p)
    n_esp = int(round(dur * taxa))
    print('\nformat')
    veredito('sample rate', sr == taxa, f'{sr} Hz (sheet: {taxa})')
    veredito('channels', ch == 2, f'{ch} (expected 2)')
    veredito('bit depth', sw == 3, f'{sw * 8} bits (expected 24)')
    veredito('samples', n == n_esp, f'{n} = {n / sr:.6f} s (expected {n_esp})')
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    mono = x.mean(0)
    voz = folha.get('voz')
    st = None
    if voz:
        st, msg = ler_stems_voz(wav_p.parent / 'stems', n)
        veredito('voice stems', st is not None, msg or ', '.join(STEMS_VOZ))
        if st is not None:                  # os marcos são do vídeo; a voz é outra camada, medida por trecho
            mono = (st['musica'] + st['efeitos']).mean(0)

    # ---------------------------------------------------------------- onsets nos marcos
    tt, db_full = env_db(mono, sr)
    _, db_hp = env_db(sosfiltfilt(butter(4, 1000, 'high', fs=sr, output='sos'), mono), sr)
    sos150 = butter(2, 150, 'high', fs=sr, output='sos')
    mix_h = sosfiltfilt(sos150, mono)
    ev_p = wav_p.parent / 'stems' / 'eventos.npz'
    starts = clips = None
    if ev_p.exists():
        evz = np.load(ev_p)
        velho = ('amostras' in evz and int(evz['amostras']) != n) or ('wav' in evz and str(evz['wav']) != wav_p.name)
        if velho:
            print(f'\n(warning) {ev_p} belongs to another soundtrack — ignored; checking by the envelope only')
        else:
            starts, clips = evz['starts'], evz['clips']
    usa_ev = starts is not None

    print(f'\nmarkers (RMS 5 ms; offset = 1st crossing of +3 dB over the floor; tolerance ±{TOL_ONSET * 1000:.0f} ms'
          + ('; start = sample where the sound marked event=True starts' if usa_ev else '; no stems/eventos.npz')
          + ('; with voice: measured on the soundtrack without the voice' if st is not None else '') + ')')
    print(f"{'marker':>7s}  {'event':36s} {'offset':>8s} {'band':>6s} {'rise':>7s}"
          + (f" {'start':>8s} {'promin.':>9s}" if usa_ev else '') + '  ok')
    n_obr = 0
    for mk in marcos:
        m, label, opc = float(mk['t']), str(mk.get('evento', '')), bool(mk.get('opcional', False))
        n_obr += not opc
        best = None
        for name, db in (('full', db_full), ('>1kHz', db_hp)):
            d, r = onset(tt, db, m)
            if d is not None and (best is None or abs(d) < abs(best[1])):
                best = (name, d, r)
        ok = best is not None and abs(best[1]) <= TOL_ONSET
        no_silencio = any(a <= m < b for a, b in silencios) or m >= dur
        extra = ''
        if usa_ev:
            i_m = int(round(m * sr))
            off = starts - i_m
            near = int(off[np.argmin(np.abs(off))]) if len(off) else 10 ** 9
            clip = sosfiltfilt(sos150, clips[off == 0].sum(0)) if near == 0 else np.zeros(1)
            e_clip = np.sum(clip[:int(0.06 * sr)] ** 2)
            prom = 10 * np.log10(e_clip / (np.sum(mix_h[i_m:i_m + int(0.06 * sr)] ** 2) + 1e-20) + 1e-20)
            ok = ok and near == 0
            extra = f" {(f'{near:+d} smp' if abs(near) < 10 ** 6 else '—'):>8s} {prom:+7.1f}dB"
        ok = ok and not no_silencio
        if not ok and not opc:
            falhas.append(f'marker {m:.3f} ({label})')
        desvio = f'{best[1] * 1000:+6.1f}ms' if best else '   ----'
        verdict = 'OK' if ok else ('(optional)' if opc else 'FAILED') + (' — inside a silence' if no_silencio else '')
        print(f'{m:7.3f}  {label[:36]:36s} {desvio:>8s} {best[0] if best else "-":>6s} '
              f'{(f"{best[2]:5.1f}dB" if best else "   -"):>7s}{extra}  {verdict}')
    f_marcos = sum(f.startswith('marker ') for f in falhas)
    print(f'required markers: {n_obr}, failures: {f_marcos} (optional ones are info only)')

    # ---------------------------------------------------------------- silêncios e bordas
    print('\nsilences (exact digital zero)')
    for a, b in silencios:
        s = x[:, int(round(a * sr)):int(round(b * sr))]
        veredito(f'silence {a:g}–{b:g} s', s.size > 0 and np.count_nonzero(s) == 0,
                 f'peak {np.abs(s).max() if s.size else 0:.2e}, non-zero samples {np.count_nonzero(s)}')
    if not silencios:
        print('  (the sheet has no silences)')

    print('\nclicks at the edges (sample jump or >12 kHz burst above what was playing)')
    _, db12 = env_db(sosfiltfilt(butter(4, 12000, 'high', fs=sr, output='sos'), mono), sr, win=0.001)
    dx = np.abs(np.diff(x, axis=1)).max(0)
    for c in [a for a, _ in silencios] + [dur]:
        i = min(int(round(c * sr)), n)
        pre, fd = dx[max(0, i - int(0.040 * sr)):max(0, i - int(0.012 * sr))], dx[max(0, i - int(0.012 * sr)):i]
        d_pre, d_fd = (pre.max() if len(pre) else 0.0), (fd.max() if len(fd) else 0.0)
        r12 = db12[(tt >= c - 0.040) & (tt < c - 0.012)]
        w12 = db12[(tt >= c - 0.012) & (tt < c + 0.005)]
        sobe12 = (w12.max() if len(w12) else -140) - (r12.max() if len(r12) else -140)
        veredito(f'cut at {c:g} s', d_fd <= 1.25 * d_pre + 1e-4 and sobe12 <= 3.0,
                 f'max |Δx| before {d_pre:.4f} → in the fade {d_fd:.4f}; >12 kHz at the cut vs before {sobe12:+.1f} dB')
    for c in [0.0] + [b for _, b in silencios if b < dur]:
        i = int(round(c * sr))
        d1, d20 = dx[i:i + int(0.001 * sr)].max(), dx[i + int(0.001 * sr):i + int(0.021 * sr)].max()
        prim = np.abs(x[:, i]).max()
        veredito(f'entry at {c:g} s', prim <= 1e-3 and d1 <= 1.5 * d20 + 1e-4,
                 f'1st sample {prim:.2e}, max |Δx| in the 1st ms {d1:.4f} vs the next 20 ms {d20:.4f}')
    veredito('last sample', np.all(x[:, -1] == 0), f'L/R = {x[0, -1]:.2e}/{x[1, -1]:.2e}')

    # ---------------------------------------------------------------- integridade e loudness
    print('\nintegrity')
    pico = np.abs(x).max()
    quase = int(np.sum(np.abs(x) >= 10 ** (-0.1 / 20)))
    veredito('sample peak', quase == 0, f'{20 * np.log10(pico + 1e-20):.2f} dBFS; samples >= -0.1 dBFS: {quase}')
    dc = x.mean(1)
    veredito('DC', np.all(np.abs(dc) <= LIM_DC), f'L {dc[0]:+.2e}, R {dc[1]:+.2e} (limit {LIM_DC:.0e})')
    lp = butter(4, 120, 'low', fs=sr, output='sos')
    mid_lo, side_lo = sosfiltfilt(lp, 0.5 * (x[0] + x[1])), sosfiltfilt(lp, 0.5 * (x[0] - x[1]))
    lado = 10 * np.log10(np.sum(side_lo ** 2) / (np.sum(mid_lo ** 2) + 1e-20) + 1e-20)
    veredito('lows <120 Hz in mono', lado <= LIM_LADO_GRAVE, f'side vs mid {lado:.1f} dB (limit {LIM_LADO_GRAVE:.0f})')
    hf = sosfiltfilt(butter(4, 18000, 'high', fs=sr, output='sos'), mono) if sr > 36000 else np.zeros(1)
    e18 = 10 * np.log10(np.sum(hf ** 2) / (np.sum(mono ** 2) + 1e-20) + 1e-20)
    veredito('energy >18 kHz', e18 <= LIM_18K, f'{e18:.1f} dB of the total (limit {LIM_18K:.0f})')

    alvo, teto = float(folha['loudness_lufs']), float(folha['teto_dbtp'])
    lu = lufs_integrado(x, sr)
    tp = true_peak_db(x)
    veredito('integrated loudness', abs(lu - alvo) <= TOL_LUFS, f'{lu:.2f} LUFS (target {alvo:g} ±{TOL_LUFS})')
    veredito('true peak', tp <= teto + (0.0 if voz else TOL_TP), f'{tp:.2f} dBTP (ceiling {teto:g})')
    if st is not None:
        checar_voz(folha, folha_p, wav_p, x, sr, st, veredito)

    secoes = folha.get('secoes', [])
    if secoes:
        y = ponderar(x, sr)
        print('\nloudness per section (ungated LUFS, info only)')
        for s in secoes:
            seg = y[:, int(round(s['de'] * sr)):int(round(s['ate'] * sr))]
            v = -0.691 + 10 * np.log10((seg ** 2).mean(axis=1).sum() + 1e-20) if seg.size else float('nan')
            print(f"  {s['nome'][:12]:12s} {s['de']:7.3f}–{s['ate']:<7.3f} {v:7.1f}  energy {s.get('energia', '-')}")

    print('\nRESULT: ' + ('all OK' if not falhas else f'{len(falhas)} failure(s) — ' + '; '.join(falhas)))
    return 0 if not falhas else 1


if __name__ == '__main__':
    sys.exit(main())
