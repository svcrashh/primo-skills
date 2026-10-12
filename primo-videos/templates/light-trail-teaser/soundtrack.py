#!/usr/bin/env python3
"""Trilha do light-trail-teaser, casada com os tempos do molde, e a voz por cima.

  python soundtrack.py <parametros.json> <project>/voice/pt/narration.json saida.wav
  python soundtrack.py <parametros.json> - saida.wav          (sem locução: só a trilha, protagonista, a −14 LUFS)

Cama grave escura (acorde em pad com filtro que abre aos poucos), um sopro de luz em cada varredura,
um impacto grave na revelação e um brilho quando a luz vira o botão. Com locução, a música cede 10 dB sob
a voz (desce 0,15 s antes, volta 0,4 s depois) e o mix vai a −16 LUFS. Precisa de numpy e scipy (os mesmos
do assets/audio da skill).
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
par = json.loads(Path(sys.argv[1]).read_text())
loc_p = None if sys.argv[2] == '-' else Path(sys.argv[2])
loc = json.loads(loc_p.read_text()) if loc_p else None
saida = Path(sys.argv[3])

D = par.get('duracao', 16)
N = len(par['fragmentos'])
REV = par.get('tempos', {}).get('revelacao', 3.8)
FECHO = par.get('tempos', {}).get('fecho', 3.6)
FR = (D - 0.9 - REV - FECHO) / N
T_REV = 0.9 + N * FR
T_FECHO = T_REV + REV
n = int(D * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)


def lp(x, f):
    return sosfilt(butter(2, f / (SR / 2), 'low', output='sos'), x)


def hp(x, f):
    return sosfilt(butter(2, f / (SR / 2), 'high', output='sos'), x)


def env(a, b, ataque, soltura):
    e = np.zeros(n)
    i0, i1 = int(a * SR), min(n, int(b * SR))
    k = np.arange(i1 - i0) / SR
    e[i0:i1] = np.minimum(1, k / max(ataque, 1e-3)) * np.clip((b - a - k) / max(soltura, 1e-3), 0, 1)
    return e


# cama: lá menor com nona, serras desafinadas, filtro abrindo até a revelação
cama = np.zeros(n)
for f in (55.0, 110.0, 164.81, 220.0, 246.94):
    for det in (-0.12, 0.0, 0.11):
        ph = rng.random()
        cama += ((t * f * (1 + det / 100) + ph) % 1.0 * 2 - 1) * (0.6 if f < 100 else 0.25)
corte = 300 + 1500 * np.clip(t / T_REV, 0, 1) ** 2
blocos = []
for i in range(0, n, 4800):
    blocos.append(lp(cama[i:i + 4800], float(corte[i])))
cama = np.concatenate(blocos) * env(0, D, 0.6, 1.2) * 0.22

# sopro de luz em cada varredura (ruído filtrado que sobe e corta)
sopro = np.zeros(n)
for i in range(N):
    a = 0.9 + i * FR
    sopro += env(a, a + 0.8, 0.6, 0.2) * 1.0
sopro += env(T_REV, T_REV + 1.0, 0.8, 0.2)
if par.get('fecho', {}).get('soLogo'):   # fecho só com o logo: a luz varre o quadro inteiro, e o sopro vai junto
    sopro += env(T_FECHO - 0.15, T_FECHO + 0.7, 0.55, 0.2)
ruido = hp(lp(rng.standard_normal(n), 6000), 1200)
sopro = ruido * sopro * 0.12

# impacto grave na revelação e brilho no botão
imp = np.zeros(n)
i0 = int(T_REV * SR)
k = np.arange(n - i0) / SR
imp[i0:] = np.sin(2 * np.pi * (40 * k + 30 * (1 - np.exp(-k / 0.08)) * 0.08)) * np.exp(-k / 0.6) * 0.9
bri = np.zeros(n)
i1 = int((T_FECHO + 0.75) * SR)
k = np.arange(n - i1) / SR
for f, g in ((1318.5, 0.5), (1975.5, 0.3), (2637.0, 0.2)):
    bri[i1:] += np.sin(2 * np.pi * f * k) * np.exp(-k / 0.9) * g
bri *= 0.18

musica = (cama + sopro + imp + bri) * 0.4   # a cama fica ~8 dB abaixo da voz mesmo sem ceder

# voz: cada fala no seu "em", ganho igual entre falas; a música cede
voz = np.zeros(n)
cede = np.ones(n)
for f in (par.get('falas', []) if loc else []):
    lf = next(x for x in loc['falas'] if x['id'] == f['id'])
    arq = loc_p.parent / lf['arquivo']
    with wave.open(str(arq)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        y = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    if ch > 1:
        y = y.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        y = np.interp(np.arange(int(len(y) * SR / sr)) * sr / SR, np.arange(len(y)), y)
    y = hp(y, 80) / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.12
    a = int(f['em'] * SR)
    voz[a:a + len(y)] += y[: max(0, n - a)]
    fim = f['em'] + len(y) / SR
    cede -= env(f['em'] - 0.15, fim + 0.4, 0.15, 0.4) * (1 - 10 ** (-10 / 20))
mix = musica * np.clip(cede, 0.2, 1) + voz
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.89

tmp = saida.with_suffix('.cru.wav')
with wave.open(str(tmp), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    est = np.repeat((mix * 32767).astype(np.int16)[:, None], 2, axis=1)
    w.writeframes(est.tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-af', f'loudnorm=I={-16 if loc else -14}:TP=-1.5:LRA=11',
                '-ar', str(SR), '-t', str(D), str(saida)], check=True)
tmp.unlink()
print(f'{"soundtrack + voice" if loc else "soundtrack without voice"}: {saida} ({D} s) · sweeps at {[round(0.9 + i * FR, 2) for i in range(N)]} · reveal {T_REV:.2f} · button {T_FECHO + 0.75:.2f}')
