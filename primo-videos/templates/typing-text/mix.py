#!/usr/bin/env python3
"""Som do molde "texto que se digita": efeitos marcados pela cena (window.SONS) + trechos de voz, voz por cima.
Uso: python mix.py som.json   (escrito pelo render.mjs)"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
sys.path.insert(0, cfg['audio'])
import synth  # noqa: E402
import sounds as sons  # noqa: E402

SR = 48000
DUR = float(cfg['duracao'])
synth.configurar({'duracao': DUR, 'taxa': SR, 'saida': cfg['saida'], 'loudness_lufs': -16, 'teto_dbtp': -1.0, 'semente': 7})
N = int(round(DUR * SR))
sfx, voz = np.zeros((2, N)), np.zeros((2, N))


def soma(bus, y, t, ganho=1.0):
    y = np.asarray(y, dtype=float)
    if y.ndim == 1:
        y = np.vstack([y, y])
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    k = min(y.shape[1], N - i0)
    bus[:, i0:i0 + k] += y[:, :k] * ganho


NIVEL = {'digitacao': -14, 'clique': -12, 'toque': -12, 'whoosh': -16, 'sucesso': -12, 'acento': -14}
cont = {}
for e in cfg['sons']:
    nome = e.pop('som')
    t = e.pop('t')
    i = cont[nome] = cont.get(nome, -1) + 1
    y = sons.som(nome, semente=11, indice=i, **e)
    if nome == 'whoosh':
        t -= sons.CATALOGO['whoosh']['dur'] / 2 if 'dur' not in e else e['dur'] / 2
    soma(sfx, y, max(0.0, t), 10 ** (NIVEL.get(nome, -14) / 20))

for f in cfg['falas']:
    # pelo pipe: no Windows o ffmpeg não abre um NamedTemporaryFile que o Python ainda segura aberto
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f['wav'], '-ss', str(f['de']), '-to', str(f['ate']), '-ac', '1', '-ar', str(SR),
                          '-af', 'afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse', '-f', 'f32le', '-'], check=True, stdout=subprocess.PIPE).stdout
    soma(voz, np.frombuffer(raw, dtype='<f4').astype(float), f['em'], 1.0)

# a voz manda: os efeitos abaixam 6 dB enquanto ela fala
env = np.abs(voz).mean(0)
w = int(0.08 * SR)
env = np.convolve(env, np.ones(w) / w, mode='same')
duck = 1 - 0.5 * np.clip(env / (env.max() + 1e-9) * 6, 0, 1)
mix = voz + sfx * duck
y, g, red, lu = synth.master(mix)
synth.write_wav24(cfg['saida'], y)
print(f'sound: {cfg["saida"]} · {lu:.1f} LUFS · {len(cfg["sons"])} effects · {len(cfg["falas"])} voice segments')
