#!/usr/bin/env python3
"""sons_interface · a camada de sons de interface (toque, troca de tela, entrada do logo) para um vídeo já mixado.

Usa os geradores do sounds.py (tudo sintetizado aqui, nada baixado) e escreve só os efeitos, numa faixa estéreo da duração
do vídeo, para serem somados por cima da mix. Quem soma e confere o volume é o scripts/captions/caption.mjs.

    python ui_sounds.py --cues cues.json --duration 15 --ref-lufs -14 --out sfx.wav [--seed 7] [--segments '[[0.3,1.5]]']

cues.json: lista de {t, efeito, nivel?, dur?, variante?, direcao?}. `efeito` é um nome do sons.CATALOGO.
Nível: dB sobre a loudness da mix (`--ref-lufs`), mais baixo que o do motor de tutorial: aqui o som é acabamento.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from scipy.io import wavfile  # noqa: E402

import sounds as sons  # noqa: E402
import synth  # noqa: E402

# dB sobre a mix. O gesto (toque, clique, digitação) é o som mais curto e o mais discreto; passagens e fecho ficam abaixo da voz.
NIVEL = {'toque': -9.0, 'clique': -9.0, 'digitacao': -13.0, 'virada': -12.0, 'whoosh': -14.0, 'sucesso': -12.0,
         'riser': -14.0, 'impacto': -9.0, 'acento': -12.0, 'pop': -9.0, 'tique': -13.0, 'blip': -9.0,
         'rabisco': -13.0, 'giz': -15.0, 'brilho': -12.0, 'baque': -9.0, 'erro': -12.0}
GESTO = ('toque', 'clique', 'digitacao')
SOB_VOZ_DB = -6.0          # passagens e fecho descem enquanto a voz fala; o gesto fica no nível dele
JUNTOS_S, JUNTOS_FATOR = 0.15, 0.6   # sons colados (< 0,15 s) entram a 60%: não empilham
SR = synth.SR


def gerar(cues, duracao, ref_lufs, semente=0, trechos=()):
    n = int(round(duracao * SR))
    saida = np.zeros((2, n))
    contagem, anterior = {}, -9.0
    for c in sorted(cues, key=lambda c: c['t']):
        nome = c['efeito']
        if nome not in sons.CATALOGO:
            raise ValueError(f'unknown effect: {nome!r}. Available: {", ".join(sons.CATALOGO)}')
        params = {k: v for k, v in c.items() if k in sons.CATALOGO[nome]['parametros']}
        i = contagem.get(nome, 0)
        contagem[nome] = i + 1
        y, ancora = sons.som_ancorado(nome, semente=semente, indice=i, **params)
        y = np.vstack([y, y]) if y.ndim == 1 else y
        db = ref_lufs + c.get('nivel', NIVEL.get(nome, -12.0)) - sons.NIVEL_SOM
        if nome not in GESTO and any(a <= c['t'] <= b for a, b in trechos):
            db += SOB_VOZ_DB
        if c['t'] - anterior < JUNTOS_S:
            db += 20 * np.log10(JUNTOS_FATOR)
        anterior = c['t']
        y = y * 10 ** (db / 20)
        ini = int(round(c['t'] * SR)) - ancora
        a, b = max(0, ini), min(n, ini + y.shape[1])
        if b > a:
            saida[:, a:b] += y[:, a - ini:b - ini]
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cues', required=True)
    ap.add_argument('--duration', type=float, required=True)
    ap.add_argument('--ref-lufs', type=float, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--segments', default='[]')
    a = ap.parse_args()
    cues = json.loads(Path(a.cues).read_text())
    y = gerar(cues, a.duration, a.ref_lufs, a.seed, [tuple(t) for t in json.loads(a.segments)])
    wavfile.write(a.out, SR, y.T.astype(np.float32))
    print(f'{len(cues)} sound(s) → {a.out} ({a.duration:.2f} s, peak {20 * np.log10(max(1e-9, np.abs(y).max())):.1f} dBFS)')


if __name__ == '__main__':
    main()
