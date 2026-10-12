#!/usr/bin/env python3
"""Demo of the synth's extended palette: each new instrument for ~1.5 s, in sequence.

Usage:  <venv>/bin/python palette_demo.py   → demo_paleta.wav (+ stems/eventos.npz), sheet_palette_demo.json

Before mixing, it checks each raw sound: no NaN/inf, peak between -12 and -1 dBFS, negligible DC,
first and last sample ~0. Exits with code 1 if any instrument fails.
The sheet's markers say WHEN each instrument comes in; this file says WHAT plays.
"""
import sys
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import synth  # noqa: E402

synth.configurar(AQUI / 'sheet_palette_demo.json', buses=())   # um bus por instrumento, criado no place
from synth import *  # noqa: E402,F401,F403

s16 = BATIDA / 4       # semicolcheia a 100 BPM = 0,15 s


def _acorde_fita():
    acorde = norm(sum(epiano(M(m), 1.1, vel=0.7) for m in (53, 57, 60, 64))) * 0.5
    return [(0.0, fita(acorde, profundidade=1.0), 0.0, 0.2)]


# nome → [(deslocamento desde o marco em s, sinal, pan, envio de reverb)]
PALETA = {
    'corda': lambda: [(s16 * i, corda(M(m), 1.4 - s16 * i), -0.3 + 0.12 * i, 0.15)
                      for i, m in enumerate((40, 47, 52, 55, 59, 64))],
    'epiano': lambda: [(0.0, epiano(M(m), 1.1, vel=0.8, tremolo=0.3), 0.0, 0.2) for m in (50, 53, 57, 60, 64)],
    'piano': lambda: [(0.0, piano(M(48), 1.2), 0.0, 0.2)] +
                     [(0.2 * i, piano(M(m), 1.2 - 0.2 * i), -0.2 + 0.13 * i, 0.2) for i, m in enumerate((60, 64, 67, 72))],
    'orgao': lambda: [(0.0, orgao(M(m), 1.3), 0.0, 0.15) for m in (48, 60, 64, 67)],
    'baixo808': lambda: [(0.0, baixo808(M(33), 0.7), 0.0, 0.0),
                         (0.75, baixo808(M(38), 0.75, glide=0.12, de=M(33)), 0.0, 0.0)],
    'pad_coral': lambda: [(0.0, pad_coral(M(m), 1.0, vogal='a', ataque=0.35, release=0.5), 0.0, 0.3)
                          for m in (57, 61, 64)],
    'metais': lambda: [(t, metais(M(m), d), 0.0, 0.15) for t, d in ((0.0, 0.2), (0.45, 0.2), (0.9, 0.45))
                       for m in (58, 62, 65)],
    'cordas_orq': lambda: [(0.0, cordas_orq(M(m), 1.0, ataque=0.4, release=0.5), 0.0, 0.25) for m in (55, 59, 62, 67)],
    'shaker': lambda: [(s16 * i, shaker() * (1.0 if i % 2 == 0 else 0.6), 0.3, 0.05) for i in range(10)],
    'aro': lambda: [(t, aro(), -0.2, 0.1) for t in (0.0, 0.45, 0.9, 1.2)],
    'conga': lambda: [(t, conga(f, tapa=tp), 0.2, 0.08)
                      for t, f, tp in ((0.0, 200, 0.1), (0.3, 200, 0.1), (0.45, 260, 0.9), (0.75, 150, 0.1),
                                       (1.05, 200, 0.1), (1.2, 150, 0.1))],
    'tamborim': lambda: [(s16 * k, tamborim(), 0.25, 0.08) for k in (0, 2, 3, 5, 6, 8)],
    'palma_seca': lambda: [(t, palma_seca(), 0.0, 0.05) for t in (0.0, 0.6, 1.2)],
    'prato_ride': lambda: [(t, prato_ride(1.5 - t), 0.0, 0.1) for t in (0.0, 0.6, 0.9, 1.2)],
    'vinil': lambda: [(0.0, vinil(1.5), 0.0, 0.0)],
    'fita': _acorde_fita,
    'impacto_cinema': lambda: [(0.0, impacto_cinema(3.0), 0.0, 0.2)],
}
# Loudness de cada trecho (LUFS sem gate). Percussão esparsa tem pico ~20 dB acima do loudness,
# então fica mais baixa, senão o limiter do master esmaga os ataques.
ALVO = {'shaker': -22.0, 'aro': -26.0, 'conga': -21.0, 'tamborim': -24.0, 'palma_seca': -25.0,
        'prato_ride': -22.0, 'vinil': -28.0, 'impacto_cinema': -16.0}      # os demais: -18


def checa(nome, sons):
    """Critério de cada som cru: finito, pico entre -12 e -1 dBFS, |DC| <= 1e-4, bordas <= 1e-6."""
    pk = [20 * np.log10(np.abs(x).max() + 1e-20) for _, x, _, _ in sons]
    dc = max(float(np.abs(np.mean(x, axis=-1)).max()) for _, x, _, _ in sons)
    bd = max(float(max(np.abs(x[..., 0]).max(), np.abs(x[..., -1]).max())) for _, x, _, _ in sons)
    fin = all(np.isfinite(x).all() for _, x, _, _ in sons)
    ok = fin and -12.0 <= min(pk) and max(pk) <= -1.0 and dc <= 1e-4 and bd <= 1e-6
    print(f'   {len(sons):2d} sound(s)  peak {min(pk):6.2f}…{max(pk):6.2f} dBFS  DC {dc:.1e}  edges {bd:.1e}'
          f'  {"finite" if fin else "NaN/inf!"}  {"OK" if ok else "FAILED"}')
    return ok


def main():
    marcos = FOLHA['marcos']
    if [m['evento'] for m in marcos] != list(PALETA):
        raise SystemExit('the order of the markers in sheet_palette_demo.json does not match PALETA')
    falhou = []
    print('order and time of each new instrument:')
    for k, mk in enumerate(marcos, 1):
        nome, t0 = mk['evento'], mk['t']
        sons = PALETA[nome]()
        print(f'{k:2d}. {t0:5.2f} s  {nome:15s} {mk["som"]}')
        if not checa(nome, sons):
            falhou.append(nome)
        for dt, x, pan, rev in sons:
            place(x, t0 + dt, nome, gain=1.0, pan=pan, rev=rev, event=(dt == 0))

    ganhos = ganho_por_alvo({mk['evento']: ((mk['t'], mk['t'] + 1.5), ALVO.get(mk['evento'], -18.0))
                             for mk in marcos})
    rev_out, dly_out = retornos(ganhos)
    salvar(soma_buses() + 0.35 * rev_out + 0.6 * dly_out)
    if falhou:
        print(f'\nFAILED the check: {", ".join(falhou)}')
        return 1
    print('\nall new instruments passed the numeric check')
    return 0


if __name__ == '__main__':
    sys.exit(main())
