#!/usr/bin/env python3
"""Tests for the sounds ported from the original engine of the drawn explanation (pop, tique, blip, rabisco, giz, brilho, baque, erro).

    python -m unittest assets/audio/test_sounds.py      or      python assets/audio/test_sounds.py

No network and no files: everything is generated on the fly. Needs numpy and scipy.
"""
import hashlib
import subprocess
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.dont_write_bytecode = True

import numpy as np  # noqa: E402

import sounds as sons  # noqa: E402
import synth  # noqa: E402

NOVOS = ('pop', 'tique', 'blip', 'rabisco', 'giz', 'brilho', 'baque', 'erro')
PENTA = (0, 2, 4, 7, 9)
FOLHA = {'duracao': 3.0, 'taxa': 48000, 'saida': 'nao-grava.wav', 'loudness_lufs': -16.0, 'teto_dbtp': -1.5,
         'semente': 5}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def fundamental(y):
    """Frequência do pico mais forte do espectro (zero padding + interpolação parabólica)."""
    x = sons._estereo(y).mean(0)
    n = 1 << 20
    m = np.abs(np.fft.rfft(x * np.hanning(len(x)), n))
    k = int(np.argmax(m[1:])) + 1
    a, b, c = np.log(m[k - 1:k + 2] + 1e-30)
    return (k + 0.5 * (a - c) / (a - 2 * b + c)) * synth.SR / n


def sha(y):
    return hashlib.sha1(np.ascontiguousarray(y).tobytes()).hexdigest()


def configurar(**extra):
    synth.configurar(dict(FOLHA, **extra))


class Base(unittest.TestCase):
    def setUp(self):
        configurar()                                    # folha sem "tonica": o padrão vale

    def tearDown(self):
        configurar()

    def assertNota(self, y, midi, tol=0.005):
        f = fundamental(y)
        self.assertLess(abs(f / hz(midi) - 1), tol, f'{f:.2f} Hz measured, note {midi} is {hz(midi):.2f} Hz')


class Contrato(Base):
    def test_nivel_bordas_e_dc(self):
        for nome in NOVOS:
            for i in range(3):
                y = sons.som(nome, semente=11, indice=i)
                x = sons._estereo(y)
                with self.subTest(som=nome, indice=i):
                    self.assertAlmostEqual(sons.loud_curta(y), -26.0, delta=0.5)
                    self.assertLess(np.abs(x[:, 0]).max(), 1e-4)
                    self.assertLess(np.abs(x[:, -1]).max(), 1e-4)
                    self.assertLess(np.abs(x.mean(1)).max(), 1e-3)
                    self.assertLessEqual(np.abs(x).max(), 1.0)

    def test_deterministico_e_indice_varia(self):
        for nome in NOVOS:
            with self.subTest(som=nome):
                a, b = sons.som(nome, semente=3, indice=2), sons.som(nome, semente=3, indice=2)
                self.assertEqual(sha(a), sha(b))
                c = sons.som(nome, semente=3, indice=3)
                self.assertFalse(c.shape == a.shape and np.allclose(a, c), 'a different index gave the same signal')
                d = sons.som(nome, semente=4, indice=2)
                self.assertFalse(d.shape == a.shape and np.allclose(a, d), 'a different seed gave the same signal')

    def test_dur_de_rabisco_e_giz(self):
        for nome in ('rabisco', 'giz'):
            for dur in (0.3, 0.6, 1.2, 2.0):
                with self.subTest(som=nome, dur=dur):
                    y = sons.som(nome, semente=1, dur=dur)
                    self.assertLessEqual(abs(y.shape[-1] / synth.SR - dur), 0.010)
            self.assertAlmostEqual(sons.som(nome).shape[-1] / synth.SR, 0.6, delta=0.010)   # padrão 0,6 s

    def test_catalogo(self):
        for nome in NOVOS:
            cat = sons.CATALOGO[nome]
            with self.subTest(som=nome):
                self.assertEqual(set(cat), {'descricao', 'nivel_db', 'dur', 'ancora', 'ataque_seco', 'rev', 'sino',
                                            'parametros'})
                self.assertEqual(cat['ancora'], 'inicio')
                self.assertEqual(cat['ataque_seco'], nome not in ('rabisco', 'giz'))
        self.assertTrue(all(isinstance(c['sino'], bool) for c in sons.CATALOGO.values()), 'every sound has "sino"')
        self.assertEqual({n for n, c in sons.CATALOGO.items() if c['sino']}, {'brilho', 'sucesso'})

    def test_parametro_desconhecido_da_erro_claro(self):
        with self.assertRaisesRegex(TypeError, r"invalid parameter for 'pop'.*Accepted: none"):
            sons.som('pop', dur=0.3)
        with self.assertRaisesRegex(TypeError, r"invalid parameter for 'blip'.*Accepted: passo, tonica"):
            sons.som('blip', nota=72)
        with self.assertRaisesRegex(ValueError, 'tonica must be MIDI'):
            sons.som('brilho', tonica='C')

    def test_verificar_do_sons_py(self):
        r = subprocess.run([sys.executable, str(AQUI / 'sounds.py'), '--verify'], capture_output=True, text=True,
                           timeout=300)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('RESULT: all OK', r.stdout)
        for nome in NOVOS:
            self.assertIn(f'\n{nome} ', r.stdout, f'{nome} is not in --verify')


class Tonica(Base):
    def test_blip_na_pentatonica(self):
        for passo in range(5):                          # tônica padrão 72 (Dó): passo 0 é Dó5
            with self.subTest(passo=passo):
                self.assertNota(sons.som('blip', passo=passo), 72 + PENTA[passo])
        self.assertNota(sons.som('blip', passo=5), 84)  # 5 passos = uma oitava
        self.assertNota(sons.som('blip', passo=7), 88)

    def test_blip_sobe_com_o_passo(self):
        f = [fundamental(sons.som('blip', passo=p)) for p in range(8)]
        self.assertTrue(all(b > a * 1.05 for a, b in zip(f, f[1:])), f)

    def test_blip_sem_passo_sobe_com_o_indice(self):
        f = [fundamental(sons.som('blip', semente=2, indice=i)) for i in range(9)]
        self.assertTrue(all(b > a * 1.05 for a, b in zip(f[:8], f[1:8])), f)
        for i in range(8):
            self.assertNota(sons.som('blip', semente=2, indice=i), 72 + 12 * (i // 5) + PENTA[i % 5])
        self.assertNota(sons.som('blip', semente=2, indice=8), 72)   # indice % 8: o 9º volta à tônica

    def test_tonica_da_folha_muda_a_nota(self):
        configurar(tonica=67)                           # Sol
        self.assertEqual(synth.FOLHA['tonica'], 67)
        self.assertNota(sons.som('blip', passo=0), 79)
        self.assertNota(sons.som('blip', passo=2), 83)
        self.assertNota(sons.som('blip', passo=0, tonica=62), 74)    # o parâmetro vence a folha
        self.assertNota(sons.som('blip', passo=0, tonica=7), 79)     # classe de altura = o mesmo Sol
        configurar()
        self.assertNota(sons.som('blip', passo=0), 72)              # sem nada: 72

    def test_brilho_na_pentatonica_da_tonica(self):
        for tonica in (60, 62, 69, 71):
            alto = 60 + tonica % 12 + 24
            notas = [alto + 12 * (p // 5) + PENTA[p % 5] for p in range(7)]
            for i in range(3):
                f = fundamental(sons.som('brilho', semente=5, indice=i, tonica=tonica))
                with self.subTest(tonica=tonica, indice=i):
                    self.assertLess(min(abs(f / hz(m) - 1) for m in notas), 0.005, f'{f:.1f} Hz outside the pentatonic')
        configurar(tonica=62)
        self.assertEqual(sha(sons.som('brilho')), sha(sons.som('brilho', tonica=62)))
        self.assertNotEqual(sha(sons.som('brilho')), sha(sons.som('brilho', tonica=60)))


class Arranjo(Base):
    def test_blip_e_brilho_no_tom_da_peca_e_o_passo_do_blip_passa(self):
        import arrange_series as arranjo_serie
        marcos = [{'t': 1.0, 'efeito': 'blip', 'passo': 0}, {'t': 1.4, 'efeito': 'blip', 'passo': 1},
                  {'t': 2.0, 'efeito': 'brilho'}, {'t': 3.0, 'efeito': 'pop'}, {'t': 3.5, 'evento': 'sem efeito'}]
        itens = arranjo_serie.itens_dos_marcos(marcos, {}, 7, 'maior')   # Sol
        self.assertEqual([i['som'] for i in itens], ['blip', 'blip', 'brilho', 'pop'])
        self.assertEqual([i.get('passo') for i in itens[:2]], [0, 1])
        self.assertEqual([i.get('tonica') for i in itens], [67, 67, 67, None])
        self.assertNota(sons.som('blip', **{k: itens[0][k] for k in ('passo', 'tonica')}), 79)   # Sol5: o blip mora na oitava de Dó5


class Colocar(Base):
    def test_coloca_cada_som_na_amostra_certa(self):
        t = 0.5
        for nome in NOVOS:
            with self.subTest(som=nome):
                configurar()
                postos = sons.colocar([{'t': t, 'som': nome}], ref_lufs=-20.0, verbose=False)
                self.assertEqual(len(postos), 1)
                p, i0 = postos[0], synth.S(t)
                self.assertEqual(p['inicio'], t)
                x = synth.bus['sfx']
                self.assertFalse(np.any(x[:, :i0]), 'sound before t')
                self.assertTrue(np.any(np.abs(x[:, i0:i0 + synth.S(0.003)]) > 1e-6), 'nothing right after t')
                seco = sons.CATALOGO[nome]['ataque_seco']
                self.assertEqual(p['event'], seco)
                self.assertEqual(i0 in synth.evt_clips, seco)
                self.assertEqual(p['nivel_db'], sons.CATALOGO[nome]['nivel_db'])
                self.assertAlmostEqual(sons.loud_curta(x), -20.0 + p['nivel_db'], delta=0.5)

    def test_dez_blips_seguidos_sobem(self):
        configurar(duracao=8.0, tonica=62)
        ts = [0.3 + 0.6 * k for k in range(10)]
        sons.colocar([{'t': t, 'som': 'blip'} for t in ts], ref_lufs=-20.0, verbose=False)
        x = synth.bus['sfx']
        f = [fundamental(x[:, synth.S(t):synth.S(t + 0.35)]) for t in ts]
        self.assertTrue(all(b > a * 1.05 for a, b in zip(f[:8], f[1:8])), f)
        base = 62 + 12                                  # Ré5: a tônica da folha uma oitava acima
        for k in range(10):
            with self.subTest(blip=k):
                p = k % 8
                self.assertLess(abs(f[k] / hz(base + 12 * (p // 5) + PENTA[p % 5]) - 1), 0.005)

    def test_parametros_pelo_colocar(self):
        configurar()
        postos = sons.colocar([{'t': 0.2, 'som': 'rabisco', 'dur': 1.2}, {'t': 1.6, 'som': 'blip', 'passo': 3},
                               {'t': 2.0, 'som': 'brilho', 'tonica': 65}], ref_lufs=-20.0, verbose=False)
        self.assertEqual([p['som'] for p in postos], ['rabisco', 'blip', 'brilho'])
        with self.assertRaisesRegex(TypeError, 'Accepted: dur'):
            sons.colocar([{'t': 0.2, 'som': 'giz', 'passo': 2}], ref_lufs=-20.0, verbose=False)


if __name__ == '__main__':
    unittest.main()
