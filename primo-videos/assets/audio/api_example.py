#!/usr/bin/env python3
"""exemplo_api · como usar o synth.py e o sounds.py, em 8 s. EXEMPLO DE API, NÃO DE ESTILO.

A "Forno Azul" é uma padaria inventada, e a música aqui é de propósito um esboço de 3 compassos: um acorde,
um baixo e um bumbo. Não copie tom, andamento, timbre nem forma. A música de cada vídeo sai de quem vai ouvir
(references/soundtrack.md §1). O que este arquivo mostra é o encanamento:

    configurar a folha → place(...) nos buses (event=True no marco) → processar um bus (filtro, sidechain)
    → nivelar os buses (ganho_por_alvo) → sons de efeito (sons.colocar) → retornos de reverb/delay → salvar

Uso:  <venv>/bin/python api_example.py && <venv>/bin/python verify.py sheet_api_example.json
"""
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import synth  # noqa: E402

synth.configurar(AQUI / 'sheet_api_example.json')
from synth import *  # noqa: E402,F401,F403  — depois do configurar: SR, N, BATIDA, bus… já são desta folha
import sounds as sons  # noqa: E402

b = BATIDA                                          # 60/96 s
ACORDES = [(48, 55, 64, 67), (53, 57, 60, 65)]      # qualquer coisa: o exemplo é a API
kicks = []
for c in range(3):
    t0 = 4 * b * c
    for i, m in enumerate(ACORDES[c % 2]):          # dedilhado: 20 ms entre as cordas
        place(corda(M(m), 3.8 * b, brilho=0.4), t0 + 0.02 * i, 'harm', gain=0.5, rev=0.3)
    place(bass_note(M(ACORDES[c % 2][0] - 12), 3.5 * b, bright=0.3), t0, 'baixo', gain=0.8)
    for k in (0, 2):
        place(kick(), t0 + k * b, 'perc', gain=0.8)
        kicks.append(t0 + k * b)

# marco sem efeito na folha (5,0 s): um som musical começando na amostra exata, event=True
place(pluck(M(79), 0.6, bright=0.7), 5.0, 'mel', gain=0.6, dly=0.3, event=True)

bus['harm'] = sosfilt(sos_lp(6000), bus['harm'], axis=1)     # processar um bus inteiro
bus['harm'] *= sidechain(kicks, 0.3)                          # e fazê-lo ceder ao bumbo
ganhos = ganho_por_alvo({'harm': ((0, 7.5), -20), 'baixo': ((0, 7.5), -23), 'perc': ((0, 7.5), -27),
                         'mel': ((4.5, 6.0), -22)})
sons.colocar([{'t': 2.5, 'som': 'toque'}, {'t': 6.25, 'som': 'whoosh', 'dur': 0.5}])   # marcos com "efeito"
rev, dly = retornos(ganhos)
salvar(soma_buses() + 0.4 * rev + 0.4 * dly)
