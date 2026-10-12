#!/usr/bin/env python3
"""arranjo_serie · composes the bed of ONE piece of a series from the identity + the sheet's seed.

Usage:
    python arrange_series.py identity.json sheet.json [--stats]

What it does:
    1. variacao(identidade, folha['semente']) decides key, mode, BPM, progression, motif, groove and timbres.
    2. Form from the sheet's `secoes`: the 1st section is the opening (bed coming in + pickup), the middle is the
       body (the music's own grid), the last section is the closing (cadence → tonic, respecting the fade).
       No sections: body from 0 and closing in the last 2 s (or 10 %).
    3. The BPM is adjusted (±1 beat over the whole body) so the body has a whole number of beats:
       the 1st beat falls at the start of the body and the final tonic at the start of the closing. The BPM used goes to
       <output>.variation.json. The sheet's "bpm" is ignored: the variation decides.
    4. Markers with "efeito" become sound effects (sons.colocar) at the exact sample. Markers without "efeito"
       become discreet musical accents (a chord note, event=True).
    5. A bed note with a short attack that would fall up to 45 ms BEFORE an event is moved onto the event
       (tonal) or dropped (percussion) — so the event's onset stays clean.
    6. Levels the buses, masters to the sheet's loudness and saves with synth.salvar (WAV + stems/eventos.npz).

Identity with "versao": 2 (contract C, API.md): the genre is declared (groove, bumbo, baixo, harmonia, cede_db)
and the role changes level and density within it (serie.PAPEL_V2). In the "pista" (dance floor) family the kick has
its own bus, never drops out for an event, owns the sub, and the bed ducks for it. Without "versao", everything above
is exactly as before, sample by sample.

Sheet with "voz" (mix_voz.py): the bed is composed the same way and the voiceover goes on top. The music ducks for
the voice, the transition effects go down under the speech, and soundtrack.wav becomes the final mix (music, effects and
voice), mastered to the sheet's loudness. stems/ gets voz, musica, efeitos and ref/ (the music and the effects before
the voice). Without "voz", none of this runs and mix_voz.py is not even imported: the video without narration is exactly
as before.
"""
import json
import math
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.dont_write_bytecode = True

import numpy as np  # noqa: E402
from scipy.signal import butter, sosfilt, sosfiltfilt  # noqa: E402

import series as serie  # noqa: E402
import sounds as sons  # noqa: E402
import synth as sy  # noqa: E402

BUSES = ('harm', 'baixo', 'perc', 'mel', 'textura', 'acento', 'sfx')
BUSES_V2 = ('harm', 'baixo', 'bumbo', 'perc', 'mel', 'textura', 'acento', 'sfx')   # v2: o bumbo tem bus próprio
PARAMS_EFEITO = ('dur', 'variante', 'direcao', 'teclas', 'teclado', 'enter', 'soltar', 'notas', 'ticks', 'passo', 'pan', 'rev')
JANELA_EVENTO = 0.045
JANELA_CURTA = 0.09        # v2: nota curta de baixo que cairia até 90 ms antes de um evento respira (sai)
ENCOSTA_BUMBO = 0.026      # v2: bumbo a menos de 26 ms antes de um evento sai dali (o estalo leria como onset adiantado)


# ------------------------------------------------------------------ tempos da forma
def forma(folha):
    """(t_corpo, t_fecho): início do corpo e da resolução final, pelas seções da folha. Se um marco obrigatório
    cai de 0,3 s antes a 0,6 s depois do início do fechamento (o logo, o impacto), a resolução encosta nele."""
    dur = float(folha['duracao'])
    secs = sorted(folha.get('secoes', []), key=lambda s: float(s['de']))
    if len(secs) >= 2:
        a, b = float(secs[0]['ate']), float(secs[-1]['de'])
    else:
        a, b = 0.0, dur - min(2.0, 0.1 * dur)
    perto = [float(m['t']) for m in folha.get('marcos', [])
             if not m.get('opcional', False) and b - 0.3 <= float(m['t']) <= b + 0.6]
    if perto:
        b = min(perto, key=lambda t: abs(t - b))
    b = min(max(b, a + 1.0), dur)
    return a, b


# ------------------------------------------------------------------ instrumentos (adaptadores)
def nota_harmonia(inst, m, d, vel, brilho):
    f = sy.M(m)
    if inst == 'epiano':
        return sy.epiano(f, d, vel=vel, brilho=brilho, release=0.35)
    if inst == 'piano':
        return sy.piano(f, d, vel=vel, release=0.3)
    if inst == 'pad_note':
        return sy.pad_note(f, d, attack=0.35, release=0.9, amp=0.5)
    if inst == 'orgao':
        return sy.orgao(f, d, drawbars='806000000', leslie=0.25, clique=0.15, release=0.1)
    if inst == 'corda':
        return sy.corda(f, d + 0.6, brilho=brilho, decaimento=1.4)
    if inst == 'pad_coral':
        return sy.pad_coral(f, d, vogal='o', ataque=0.4, release=0.9)
    if inst == 'cordas_orq':
        return sy.cordas_orq(f, d, ataque=0.35, release=0.8, brilho=brilho)
    if inst == 'pluck':
        return 0.5 * sy.pluck(f, d + 0.3, bright=brilho, tau=0.4)
    raise ValueError(f'harmonia: instrument {inst!r} has no adapter')


def nota_melodia(inst, m, d, brilho):
    f = sy.M(m)
    if inst == 'pling':
        return sy.pling(f, max(0.9, d + 0.7), bell=0.45, decay=0.8)
    if inst == 'bell':
        return sy.bell(f, max(1.2, d + 0.9), bright=0.55, decay=0.55)
    if inst == 'pluck':
        return sy.pluck(f, d + 0.35, bright=brilho, tau=0.3)
    if inst == 'corda':
        return sy.corda(f, d + 0.5, brilho=0.55, decaimento=1.0) * 2
    if inst == 'epiano':
        return sy.epiano(f, d, vel=0.6, brilho=brilho, release=0.3) * 2
    if inst == 'piano':
        return sy.piano(f, d, vel=0.6, release=0.3) * 2
    if inst == 'lead_note':
        return sy.lead_note(f, d)
    if inst == 'metais':
        return sy.metais(f, d) * 2
    raise ValueError(f'melodia: instrument {inst!r} has no adapter')


def nota_baixo(inst, m, d, brilho, pista=False):
    f = sy.M(m)
    if inst == 'bass_note' and pista:                    # v2, pista: menos sub; o grave do tempo é do bumbo
        return sy.bass_note(f, d, bright=0.3 + 0.3 * brilho, sub=0.3, release=0.04)
    if inst == 'bass_note':
        return sy.bass_note(f, d, bright=0.25 + 0.3 * brilho, sub=0.7, release=0.04)
    if inst == 'baixo808':
        return sy.baixo808(f, d, drive=1.3, release=0.06) * 2
    if inst == 'corda':
        return sy.corda(f, d + 0.2, brilho=0.25, decaimento=0.8) * 2
    if inst == 'baixo_serra':
        return sy.baixo_serra(f, d, corte=260 + 500 * brilho, decay=min(0.12, 0.6 * d)) * 2
    raise ValueError(f'baixo: instrument {inst!r} has no adapter')


def golpe(inst, brilho, timbre=None):
    if inst == 'kick' and timbre:
        return sy.bumbo(timbre)
    if inst == 'kick':
        return sy.kick(dur=0.35, f_hi=120, f_lo=48, p_tau=0.03, a_tau=0.12, click=0.08, drive=1.2)
    if inst == 'hat_aberto':
        return sy.hat(0.4, tau=0.1) * 0.8
    if inst == 'conga':
        return sy.conga(180, 0.4) * 2
    if inst == 'aro':
        return sy.aro() * 2
    if inst == 'palma_seca':
        return sy.palma_seca() * 2
    if inst == 'clap':
        return sy.clap()
    if inst == 'snare':
        return sy.snare(dur=0.18)
    if inst == 'tamborim':
        return sy.tamborim() * 2
    if inst == 'shaker':
        return sy.shaker(0.1, brilho=brilho) * 2
    if inst == 'hat':
        return sy.hat(0.12, tau=0.03)
    if inst == 'prato_ride':
        return sy.prato_ride(1.0, sino=0.2) * 2
    raise ValueError(f'percussao: instrument {inst!r} has no adapter')


# ------------------------------------------------------------------ harmonia
def voicing(pcs, prev, centro, abertura, faixa=(52, 84)):
    """Acorde fechado (ou drop-2) perto de `centro`, com a menor movimentação desde `prev`.
    Se nenhuma posição cabe na faixa (acontece com certas tônicas e registros), alarga a faixa em
    vez de devolver nada: um acorde um pouco mais grave ou agudo é melhor que a trilha falhar."""
    melhor, custo_min = None, 1e9
    for inv in range(len(pcs)):
        ordem = pcs[inv:] + pcs[:inv]
        for base in range(centro - 9, centro + 4):
            if base % 12 != ordem[0]:
                continue
            v = [base]
            for pc in ordem[1:]:
                x = v[-1] + ((pc - v[-1]) % 12 or 12)
                v.append(x)
            if abertura == 'aberto' and len(v) >= 3:
                v[-2] -= 12 if len(v) >= 4 else -12
                v.sort()
            if v[0] < faixa[0] or v[-1] > faixa[1]:
                continue
            c = abs(np.mean(v) - centro) * (0.3 if prev else 1.0)
            if prev and len(prev) == len(v):
                c += sum(abs(a - b) for a, b in zip(sorted(prev), v))
            if c < custo_min:
                melhor, custo_min = v, c
    if melhor is None and faixa[1] - faixa[0] < 60:
        return voicing(pcs, prev, centro, abertura, (faixa[0] - 6, faixa[1] + 6))
    return melhor


def itens_dos_marcos(marcos, ident, tonica, modo):
    """Os efeitos dos marcos da folha (os com "efeito"), com o nível, os parâmetros e a tônica da peça (tonica = classe
    de altura): sucesso, riser, impacto, blip e brilho soam no tom; o "passo" do blip passa, para uma lista recomeçar."""
    niveis_ident = (ident.get('efeitos') or {}).get('nivel', {})
    itens = []
    for mk in marcos:
        ef = mk.get('efeito')
        if not ef:
            continue
        it = {'t': float(mk['t']), 'som': ef}
        if 'nivel' in mk:
            it['nivel'] = float(mk['nivel'])
        elif ef in niveis_ident:
            it['nivel'] = float(niveis_ident[ef])
        for k in PARAMS_EFEITO:
            if k in mk:
                it[k] = mk[k]
        if ef in ('sucesso', 'riser', 'impacto', 'blip', 'brilho'):
            it['tonica'] = 60 + tonica
        if ef == 'sucesso':
            it.setdefault('modo', 'menor' if modo in ('menor', 'dorico') else 'maior')
        itens.append(it)
    return itens


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    if len(args) < 2:
        print(__doc__)
        return 1
    ident = serie.carregar_identidade(args[0])
    folha_p = Path(args[1]).resolve()
    folha = json.loads(folha_p.read_text(encoding='utf-8'))
    var = serie.variacao(ident, int(folha['semente']))
    voz = folha.get('voz')
    if voz:                                 # só a folha com voz precisa do mix_voz.py; sem voz, ele nem precisa existir
        try:
            import mix_voz as mv
        except ModuleNotFoundError:
            raise SystemExit('the sheet has "voz", but mix_voz.py is not next to arrange_series.py. '
                             'This copy of the skill has no voice mix: reinstall the skill, or remove "voz" from the sheet.')
    if voz and voz.get('perfil') not in mv.PERFIS:
        raise ValueError(f'voz: profile {voz.get("perfil")!r} does not exist. Use {" or ".join(mv.PERFIS)}')

    dur = float(folha['duracao'])
    t_corpo, t_fecho = forma(folha)
    batida_nom = 60.0 / var['bpm']
    n_bat = max(2, int(round((t_fecho - t_corpo) / batida_nom)))
    v2 = var.get('versao') == 2
    if v2:                                  # v2: o andamento ajustado não sai da faixa da identidade (é convenção do gênero)
        lo, hi = var['bpm_faixa']
        corpo = t_fecho - t_corpo
        cands = [k for k in range(max(2, n_bat - 3), n_bat + 4) if lo <= 60 * k / corpo <= hi]
        if cands:
            n_bat = min(cands, key=lambda k: abs(60 * k / corpo - var['bpm']))
    B = (t_fecho - t_corpo) / n_bat
    bpm_ef = 60.0 / B

    f = dict(folha)
    f['bpm'] = bpm_ef
    f['saida'] = str((folha_p.parent / folha['saida']).resolve())
    sy.configurar(f, buses=BUSES_V2 if v2 else BUSES)
    if 'bpm' in folha and abs(float(folha['bpm']) - bpm_ef) > 0.5:
        print(f'(warning) the sheet\'s bpm ({folha["bpm"]}) is ignored: the series decides ({bpm_ef:.2f} effective)')
    if voz:
        print(f'with voice: the bed sits at {mv.CAMA_LUFS:g} LUFS, each line at {mv.VOZ_LUFS:g} and the mix goes to '
              f'{folha["loudness_lufs"]} LUFS (the identity asks for {ident["loudness_lufs"]} only without voice)')
    elif abs(float(folha['loudness_lufs']) - float(ident['loudness_lufs'])) > 0.01:
        print(f'(warning) sheet loudness {folha["loudness_lufs"]} ≠ identity loudness {ident["loudness_lufs"]}: the sheet wins')

    rng = np.random.default_rng([int(folha['semente']) & 0xFFFFFFFF, 99])
    brilho = var['brilho']
    tonica = var['tonica_pc']
    escala = var['escala']
    prog = var['progressao']
    harm = var['harmonia']
    mel = var['melodia']
    grv = var['groove']
    fundo = var['papel'] == 'fundo'
    pv = serie.PAPEL_V2[var['papel']] if v2 else None

    def tb(b):
        return t_corpo + b * B

    # ---------------------------------------------------------------- eventos (efeitos e acentos)
    marcos = sorted(folha.get('marcos', []), key=lambda m: float(m['t']))
    eventos = []
    for mk in marcos:
        ef = mk.get('efeito')
        if ef is None or (sons.CATALOGO.get(ef, {}).get('ancora') == 'inicio'):
            eventos.append(float(mk['t']))
        if ef and ef not in sons.CATALOGO:
            raise ValueError(f'marker {mk["t"]}: efeito {ef!r} does not exist. Use {", ".join(sons.CATALOGO)}')
        if ef and not sons.CATALOGO[ef]['ataque_seco'] and not mk.get('opcional', False):
            print(f'(warning) marker {mk["t"]}: efeito {ef!r} has no sharp attack (anchor {sons.CATALOGO[ef]["ancora"]}) '
                  f'— set "opcional": true or put a sound with an attack at the same instant')

    def conflito(t):
        for e in eventos:
            if e - JANELA_EVENTO <= t < e - 1e-9:
                return e
        return None

    def no_silencio(t):
        return any(a <= t < b for a, b in sy.SILENCIOS)

    def p(sig, t, bus, gain=1.0, pan=0.0, rev=0.0, dly=0.0, tonal=True, bumbo=False, curta=False):
        """Põe na mesa e devolve o instante usado (None se não pôs). bumbo=True (v2): o bumbo nunca some por
        causa de um evento. Se cairia a menos de 26 ms antes dele (o estalo do bumbo leva ~10 ms para sumir e o
        verify.py leria o onset do evento adiantado), vai para o lado mais perto: o próprio evento (até 13 ms
        depois do tempo) ou 26 ms antes dele (até 13 ms antes do tempo). Mais cedo que isso, fica no tempo.
        curta=True (v2): nota curta e grave que cairia até 90 ms antes de um evento sai. O RMS de 5 ms de uma
        nota grave ondula alguns dB e o verify.py leria o onset do evento adiantado."""
        if t < 0 or t >= dur - 0.01:
            return None
        if curta and any(ev - JANELA_CURTA <= t < ev - 1e-9 for ev in eventos):
            return None
        e = conflito(t)
        if e is not None:
            if bumbo:
                if e - t < ENCOSTA_BUMBO:
                    t = e if e - t <= ENCOSTA_BUMBO / 2 else e - ENCOSTA_BUMBO
            elif not tonal:
                return None
            else:
                t = e
        if no_silencio(t):
            return None
        sy.place(sig, t, bus, gain=gain, pan=pan, rev=rev, dly=dly)
        return t

    # ---------------------------------------------------------------- linha do tempo harmônica (em tempos do corpo)
    graus, bats = prog['graus'], prog['batidas']
    cad_len = 4 if n_bat >= 12 else (2 if n_bat >= 4 else 0)
    limite = n_bat - cad_len
    acordes, b, i = [], 0, 0
    while b < limite:
        e = min(b + bats[i % 4], limite)
        acordes.append([b, e, graus[i % 4]])
        b, i = e, i + 1
    if cad_len:
        acordes.append([limite, n_bat, prog['cadencia'][0]])
    antecipa = prog['antecipacao']

    def idx_em(bt):
        """Índice do acorde no tempo bt (com antecipação de 1 colcheia nas trocas, se a variação pedir)."""
        i = 0
        for k, (a0, _, _) in enumerate(acordes):
            if bt >= a0 - (0.5 if antecipa and a0 > 0 else 0.0) - 1e-9:
                i = k
        return i

    def acorde_em(bt):
        return acordes[idx_em(bt)][2]

    def pcs(grau, ext=harm['extensao']):
        return [(tonica + x) % 12 for x in serie.graus_acorde(escala, grau, ext)]

    def raiz_baixo(grau):
        r = (tonica + serie.graus_acorde(escala, grau)[0]) % 12
        return 36 + ((r - 36) % 12)

    centro = harm['registro']
    inst_h = harm['instrumento']
    sustentado = harm['padrao'] == 'sustentado' or inst_h in serie.INSTR_SUSTENTADOS

    # ---------------------------------------------------------------- abertura
    ton_I = voicing(pcs(1), None, centro, harm['abertura'])
    if t_corpo >= 0.3:
        b0 = -math.floor(t_corpo / B + 1e-9)
        t0 = max(0.0, tb(b0))
        d = t_corpo - t0 + 0.2
        for m in ton_I:
            if sustentado:
                p(sy.pad_note(sy.M(m), t_corpo + 0.3, attack=min(1.2, 0.6 * t_corpo), release=0.9, amp=0.5)
                  if inst_h == 'pad_note' else nota_harmonia(inst_h, m, t_corpo + 0.3, 0.5, brilho), 0.0, 'harm', rev=0.2)
            else:
                p(nota_harmonia(inst_h, m, d, 0.5, brilho), t0, 'harm', rev=0.2)
        if t_corpo >= B:                                   # anacruse: quinta e terça levando ao corpo
            mref = 60 + tonica + 12 * round((mel['registro'] - 60 - tonica) / 12)
            for k, (bt, gi) in enumerate(((-1.0, 4), (-0.5, 2))):
                mm = mref + escala[gi]
                p(nota_melodia(mel['instrumento'], mm, 0.5 * B, brilho), tb(bt), 'mel', gain=0.8 - 0.15 * k,
                  pan=0.15, rev=0.3, dly=0.12)

    # ---------------------------------------------------------------- corpo: harmonia
    prev = ton_I
    vozes = {}
    for a0, a1, gr in acordes:
        v = voicing(pcs(gr), prev, centro, harm['abertura'])
        vozes[a0] = v
        prev = v

    def voz_em(bt):
        return vozes[acordes[idx_em(bt)][0]]

    n_comp = int(math.ceil(n_bat / 4))
    if sustentado:
        for a0, a1, gr in acordes:
            ini = a0 - (0.5 if antecipa and a0 > 0 else 0.0)
            for m in vozes[a0]:
                p(nota_harmonia(inst_h, m, (a1 - ini) * B, 0.55, brilho), tb(ini), 'harm', rev=0.2)
    elif harm['padrao'] == 'arpejo':
        for k in range(n_bat * 2):
            bt = k / 2
            v = voz_em(bt)
            ordem = v + v[-2:0:-1]
            m = ordem[k % len(ordem)]
            p(nota_harmonia(inst_h, m, 1.4 * B, 0.42 + 0.1 * (k % 4 == 0), brilho), tb(bt), 'harm',
              pan=-0.2 + 0.4 * ((k % len(ordem)) / max(1, len(ordem) - 1)), rev=0.2, dly=0.05)
    else:
        golpes = (serie.TODAS_HARMONIAS if v2 else serie.HARMONIAS)[harm['padrao']]
        dly_h = 0.35 if harm['padrao'] == 'dub' else 0.0     # dub: um acorde só, e o delay responde
        for c in range(n_comp):
            onda = 1.0 + 0.08 * math.sin(2 * math.pi * c / 8)
            for e8, d8, vel in golpes:
                bt = 4 * c + e8 / 2
                if bt >= n_bat - 1e-9:
                    continue
                dd = min(d8 / 2, n_bat - bt) * B
                for m in voz_em(bt):
                    if dly_h:
                        p(nota_harmonia(inst_h, m, dd, vel * onda, brilho), tb(bt), 'harm', rev=0.18, dly=dly_h)
                    else:
                        p(nota_harmonia(inst_h, m, dd, vel * onda, brilho), tb(bt), 'harm', rev=0.18)
        if antecipa:
            for a0, _, gr in acordes[1:]:
                bt = a0 - 0.5
                for m in vozes[a0]:
                    p(nota_harmonia(inst_h, m, 0.9 * B, 0.5, brilho), tb(bt), 'harm', rev=0.18)

    # ---------------------------------------------------------------- corpo: baixo
    padrao_b = (serie.TODOS_BAIXOS if v2 else serie.BAIXOS)[var['baixo']['padrao']]
    antecipa_b = antecipa and not (v2 and var['baixo']['padrao'] in serie.BAIXOS_OFFBEAT)
    for c in range(n_comp):
        for e8, qual, d8 in padrao_b:
            bt = 4 * c + e8 / 2
            if bt >= n_bat - 1e-9:
                continue
            g = acorde_em(bt)
            r = raiz_baixo(g)
            if qual == '5':
                m = r + 7
            elif qual == '8':
                m = r + 12
            elif qual == 'a':
                prox = raiz_baixo(acorde_em(bt + 0.5))
                m = prox - 1 if prox != r else r + 7
            else:
                m = r
            dd = min(d8 / 2, n_bat - bt) * B
            if v2:
                p(nota_baixo(var['baixo']['instrumento'], m, dd, brilho, grv['familia'] == 'pista'), tb(bt), 'baixo',
                  gain=0.9 + 0.1 * (e8 == 0), curta=dd <= 0.5 * B)
            else:
                p(nota_baixo(var['baixo']['instrumento'], m, dd, brilho), tb(bt), 'baixo', gain=0.9 + 0.1 * (e8 == 0))
        if antecipa_b:
            for a0, _, gr in acordes[1:]:
                if 4 * c <= a0 - 0.5 < 4 * c + 4:
                    p(nota_baixo(var['baixo']['instrumento'], raiz_baixo(gr), 0.45 * B, brilho), tb(a0 - 0.5), 'baixo', gain=0.8)

    # ---------------------------------------------------------------- corpo: percussão
    kit, sw = grv['kit'], grv['swing']
    comp_cad = limite / 4.0

    def t16(c, s):
        t = tb(4 * c + s / 4)
        if s % 4 == 2:
            t += sw * B * 0.5
        elif s % 2 == 1:
            t += sw * B * 0.25
        return t

    tempos_bumbo = []
    if v2:
        pista = grv['familia'] == 'pista'
        timbre = grv['timbre_bumbo']
        conducao = grv['tempo'] if pv['tempo'] == 'inteiro' else [x for x in grv['tempo'] if x % 2 == 0]
        papeis = (('bumbo', grv['bumbo']), ('marcacao', grv['marcacao']),
                  ('fantasma', grv['fantasma'] if pv['fantasma'] else []), ('tempo', conducao), ('aberto', grv['aberto']))
        for c in range(n_comp):
            cheio = pista or c >= 1 or n_comp <= 2         # na pista o quatro por quatro começa no 1º tempo
            ultimo_antes_cad = abs(c + 1 - comp_cad) < 1e-9
            for papel, lista in papeis:
                inst = kit.get(papel)
                if not inst or not lista or (papel not in ('tempo', 'bumbo') and not cheio):
                    continue
                passos = list(lista)
                if papel == 'tempo' and ultimo_antes_cad:
                    passos = sorted((set(passos) | {12, 13, 14, 15}) - set(grv['aberto']))
                if papel == 'bumbo' and not cheio:
                    passos = [0]
                for s in passos:
                    bt = 4 * c + s / 4
                    if bt >= n_bat - 1e-9:
                        continue
                    if papel == 'bumbo':
                        g = 1.0 if s == 0 else (0.92 if pista else 0.75)
                        t = p(golpe(inst, brilho, timbre), t16(c, s), 'bumbo', gain=g, tonal=False, bumbo=True)
                        if t is not None:
                            tempos_bumbo.append(t)
                        continue
                    if papel == 'tempo':
                        g = (0.3 if s % 4 == 0 else 0.5 if s % 2 == 0 else 0.3) * float(rng.uniform(0.85, 1.1))
                        pan = 0.25
                    elif papel == 'marcacao':
                        g, pan = pv['marcacao'] * float(rng.uniform(0.9, 1.05)), -0.1
                    elif papel == 'fantasma':
                        g, pan = 0.2 * float(rng.uniform(0.8, 1.1)), -0.1
                    else:
                        g, pan = pv['aberto'] * float(rng.uniform(0.92, 1.05)), 0.2
                    p(golpe(inst, brilho), t16(c, s), 'perc', gain=g, pan=pan,
                      rev=0.08 if papel in ('marcacao', 'fantasma') else 0.0, tonal=False)
    else:                                              # versão 1: exatamente como antes
        for c in range(n_comp):
            cheio = c >= 1 or n_comp <= 2
            ultimo_antes_cad = abs(c + 1 - comp_cad) < 1e-9
            for papel, lista in (('bumbo', grv['bumbo']), ('marcacao', grv['marcacao']), ('tempo', grv['tempo'])):
                inst = kit.get(papel)
                if not inst or (papel != 'tempo' and not cheio and not (papel == 'bumbo' and 0 in lista)):
                    continue
                passos = list(lista)
                if papel == 'tempo' and ultimo_antes_cad:
                    passos = sorted(set(passos) | {12, 13, 14, 15})
                if papel == 'bumbo' and not cheio:
                    passos = [0]
                for s in passos:
                    bt = 4 * c + s / 4
                    if bt >= n_bat - 1e-9:
                        continue
                    if papel == 'tempo':
                        g = (0.3 if s % 4 == 0 else 0.5 if s % 2 == 0 else 0.3) * float(rng.uniform(0.85, 1.1))
                        pan = 0.25
                    elif papel == 'marcacao':
                        g, pan = 0.6 * float(rng.uniform(0.9, 1.05)), -0.1
                    else:
                        g, pan = (1.0 if s == 0 else 0.75), 0.0
                    p(golpe(inst, brilho), t16(c, s), 'perc', gain=g, pan=pan, rev=0.08 if papel == 'marcacao' else 0.0,
                      tonal=False)

    # ---------------------------------------------------------------- corpo: melodia (motivo A / resposta A')
    mref = 60 + tonica + 12 * round((mel['registro'] - 60 - tonica) / 12)

    def altura(a):
        return mref + escala[a % 7] + 12 * (a // 7)

    frases = []
    cada = pv['melodia_cada'] if v2 else 4             # v2: o papel decide quantas frases (fundo = uma a cada 8 compassos)
    for c in range(n_comp):
        if c % cada == 2 and c + 2 <= comp_cad + 1e-9:
            frases.append((c, 'notas' if (c // cada) % 2 == 0 else 'resposta'))
        elif (not v2 or not fundo) and var['densidade'] != 'baixa' and c % 4 == 0 and c >= 4 and c + 2 <= comp_cad + 1e-9:
            frases.append((c, 'resposta'))
    for c, qual in frases:
        for s, a, d16 in var['motivo'][qual]:
            bt = 4 * c + s / 4
            m = altura(a)
            if s % 4 == 0:                                   # tempo forte: nota do acorde
                alvo = pcs(acorde_em(bt), 'triade')
                if m % 12 not in alvo:
                    m = min((m + dlt for dlt in (-1, 1, -2, 2, -3, 3) if (m + dlt) % 12 in alvo), key=lambda x: abs(x - m))
            p(nota_melodia(mel['instrumento'], m, d16 / 4 * B, brilho), t16(c, s), 'mel',
              gain=0.85 + 0.15 * (s % 4 == 0), pan=0.12, rev=0.3, dly=0.12)

    # ---------------------------------------------------------------- fechamento: tônica
    if t_fecho < dur - 0.05:
        dfim = dur - t_fecho + 0.1
        prev = voicing(pcs(1), vozes[acordes[-1][0]], centro, harm['abertura'])
        for m in prev:
            p(nota_harmonia(inst_h, m, dfim, 0.55, brilho), t_fecho, 'harm', rev=0.25)
        p(nota_baixo(var['baixo']['instrumento'], raiz_baixo(1), min(dfim, 2.5), brilho), t_fecho, 'baixo')
        p(nota_melodia(mel['instrumento'], mref + 12 * (mel['registro'] - mref > 6), 1.5, brilho), t_fecho, 'mel',
          gain=0.8, rev=0.35, dly=0.1)
        if kit.get('bumbo') and v2:
            t = p(golpe(kit['bumbo'], brilho, grv['timbre_bumbo']), t_fecho, 'bumbo', gain=0.8, tonal=False, bumbo=True)
            if t is not None:
                tempos_bumbo.append(t)
        elif kit.get('bumbo'):
            p(golpe(kit['bumbo'], brilho), t_fecho, 'perc', gain=0.8, tonal=False)

    # ---------------------------------------------------------------- textura
    if var['textura']:
        tx = var['textura']
        for k, iv in enumerate((0, 7)):
            m = 72 + tonica + iv if tx == 'shimmer_pad' else 60 + tonica + iv
            if tx == 'shimmer_pad':
                sig = sy.shimmer_pad(sy.M(m), dur)
            elif tx == 'vinil':
                if k:
                    continue
                sig = sy.vinil(dur, chiado=0.4, estalos=3.0)
            elif tx == 'pad_coral':
                sig = sy.pad_coral(sy.M(m), dur - 1.0, vogal='u', ataque=1.5, release=1.0)
            else:
                sig = sy.pad_note(sy.M(m), dur - 1.0, attack=1.5, release=1.0, amp=0.5)
            p(sig, 0.0, 'textura', pan=-0.4 + 0.8 * k, rev=0.3)

    # ---------------------------------------------------------------- mix da cama
    for k in ('harm', 'mel', 'textura', 'perc') + (('bumbo',) if v2 else ()):
        sy.bus[k] = sosfilt(sy.sos_lp(15000, 8), sy.bus[k], axis=1)      # serras e ruídos: nada perto de 18 kHz
    if inst_h in ('pad_note', 'pad_coral', 'cordas_orq'):
        sy.bus['harm'] = sosfilt(sy.sos_lp(3500 + 6000 * brilho), sy.bus['harm'], axis=1)
    if v2 and grv['familia'] == 'pista':               # na pista o sub é do bumbo: o baixo mora acima de 60 Hz
        sy.bus['baixo'] = sosfilt(sy.sos_hp(60, 2), sy.bus['baixo'], axis=1)
    if v2 and var['cede_db'] > 0 and tempos_bumbo:     # a cama cede ao bumbo (sidechain): o pulso da pista
        curva = sy.sidechain(tempos_bumbo, 1 - 10 ** (-var['cede_db'] / 20), attack=0.004, hold=0.015, release=0.45 * B)
        for k in ('harm', 'baixo', 'textura'):
            sy.bus[k] *= curva
        sy.bus['mel'] *= np.sqrt(curva)
    if v2 and pv['medios_db'] < 0:                     # fundo: 1,2–4 kHz livres para quem lê
        sos_m = butter(2, [1200, 4000], 'band', fs=sy.SR, output='sos')
        for k in ('harm', 'mel'):
            sy.bus[k] = sy.bus[k] - (1 - 10 ** (pv['medios_db'] / 20)) * sosfiltfilt(sos_m, sy.bus[k], axis=1)
    if v2:
        alvos = dict(serie.ALVOS_V2[(grv['familia'], var['papel'])])
    else:
        alvos = {'harm': -21.0, 'baixo': -22.5, 'perc': -26.0 if fundo else -23.0, 'mel': -27.0 if fundo else -24.0,
                 'textura': -34.0}
    janela = (t_corpo, t_fecho)
    ok_alvos = {}
    for k, v in alvos.items():
        if sy.loud(sy.kw(sy.bus[k]), *janela) > -70:
            ok_alvos[k] = (janela, v)
    ganhos = sy.ganho_por_alvo(ok_alvos)
    ref = sons.ref_cama(excluir=('sfx', 'acento'))

    # ---------------------------------------------------------------- acentos musicais (marcos sem efeito)
    acentos = []
    for mk in marcos:
        if mk.get('efeito'):
            continue
        t = float(mk['t'])
        bt = (t - t_corpo) / B
        gr = acorde_em(bt) if 0 <= bt < n_bat else 1
        alvo = pcs(gr, 'triade')
        # acima de toda a melodia (o motivo vai até ~mref+14): nota igual à da melodia se cancela
        m = min((mref + 19 + dlt for dlt in range(-6, 7) if (mref + 19 + dlt) % 12 in alvo), key=lambda x: abs(x - mref - 19))
        acentos.append({'t': t, 'som': 'acento', 'nota': m, 'pan': 0.1,
                        'nivel': float(mk.get('nivel', sons.CATALOGO['acento']['nivel_db'] + (0 if fundo else 3)))})
    protegidos = ('bumbo',) if v2 and grv['familia'] == 'pista' else ()
    if voz:                                             # debaixo da fala: o gesto fica, o resto desce 6 dB
        trechos = mv.validar_trechos(voz, dur)
        _, forma_voz = mv.envelope(sy.N, sy.SR, mv.grupos(trechos), [1.0] * len(mv.grupos(trechos)))

        def sob_a_voz(it):
            if it['som'] not in mv.EFEITOS_FICAM and mv.sob_voz(*mv.span_efeito(it, sons.CATALOGO), trechos):
                it['bus'] = 'sob_voz'
                it['nivel'] = float(it.get('nivel', sons.CATALOGO[it['som']]['nivel_db'])) + mv.SOB_VOZ_DB
                it['subir'] = False                     # os −6 dB são contrato: para o ataque aparecer, só a cama cede
                print(f"voice: {it['som']} at {float(it['t']):.3f} s plays under the speech → {mv.SOB_VOZ_DB:+g} dB")
            t = float(it['t'])
            i0 = min(sy.N - 1, max(0, sy.S(t - 0.06)))
            if forma_voz[i0:sy.S(t + 0.4) + 1].max() > 0:  # a música cede à voz perto dali: o buraco não pode entrar na fala
                antes_da_fala = forma_voz[min(sy.N - 1, sy.S(t))] < 0.5 and \
                    not any(a < t + 0.15 - 1e-6 and b > t - 0.06 + 1e-6 for a, b in trechos)
                it['abrir'] = 'curto' if antes_da_fala else False
            return it
        crua = {k: sy.bus[k].copy() for k in sy.BUSES}  # a música antes de qualquer cessão: a régua do verify.py
        crua_envios = {kind: {k: a.copy() for k, a in d.items()} for kind, d in sy.sends.items()}
        acentos = [sob_a_voz(a) for a in acentos]
        protegidos_voz = protegidos + ('sob_voz',)
    if acentos and voz:
        sons.colocar(acentos, bus='acento', ref_lufs=ref, semente=int(folha['semente']), proteger=protegidos_voz)
    elif acentos and protegidos:
        sons.colocar(acentos, bus='acento', ref_lufs=ref, semente=int(folha['semente']), proteger=protegidos)
    elif acentos:
        sons.colocar(acentos, bus='acento', ref_lufs=ref, semente=int(folha['semente']))

    # ---------------------------------------------------------------- efeitos dos marcos
    itens = [sob_a_voz(it) if voz else it for it in itens_dos_marcos(marcos, ident, tonica, var['modo'])]
    if itens and voz:
        sons.colocar(itens, bus='sfx', ref_lufs=ref, semente=int(folha['semente']), proteger=protegidos_voz)
    elif itens and protegidos:
        sons.colocar(itens, bus='sfx', ref_lufs=ref, semente=int(folha['semente']), proteger=protegidos)
    elif itens:
        sons.colocar(itens, bus='sfx', ref_lufs=ref, semente=int(folha['semente']))

    if protegidos:                                      # pista: o grave é do bumbo e do baixo; o "thunk" dos efeitos
        sy.bus['sfx'] = sosfilt(sy.sos_hp(100, 2), sy.bus['sfx'], axis=1)   # sai (causal: o onset não adianta)
        if voz and 'sob_voz' in sy.bus:
            sy.bus['sob_voz'] = sosfilt(sy.sos_hp(100, 2), sy.bus['sob_voz'], axis=1)
    if voz:                                             # a música e os efeitos em grupos separados, com o mesmo reverb
        ir = sy.make_ir()

        def grupo(bs, buses=sy.bus):
            bs = [k for k in bs if k in buses]
            if not bs:
                return np.zeros((2, sy.N))
            rv, dl = sy.retornos(ganhos, ir=ir, buses=bs)
            return sum(buses[k] for k in bs) + 0.4 * rv + 0.35 * dl
        nomes_musica = [k for k in sy.BUSES if k not in ('sfx', 'acento', 'sob_voz')]
        musica = grupo(nomes_musica)
        fixos, sob = grupo(['sfx', 'acento']), grupo(['sob_voz'])
        agora = {kind: dict(d) for kind, d in sy.sends.items()}
        for kind in sy.sends:                           # os retornos da música crua saem dos envios dela
            sy.sends[kind].clear()
            sy.sends[kind].update(crua_envios[kind])
        musica_crua = grupo(nomes_musica, crua)
        for kind in sy.sends:
            sy.sends[kind].clear()
            sy.sends[kind].update(agora[kind])

        def nominal(lista):                             # a régua dos efeitos: os mesmos sons (mesma semente, mesmos
            out = []                                    # índices), no nível de antes da voz, sem abrir espaço
            for it in lista:
                c = dict(it, event=False, bus='descarte')
                if it.get('bus') == 'sob_voz':
                    c.update(bus='sob_ref', nivel=it['nivel'] - mv.SOB_VOZ_DB)
                out.append(c)
            return out
        for lista in (acentos, itens):
            if lista:
                sons.colocar(nominal(lista), bus='descarte', ref_lufs=ref, semente=int(folha['semente']), verbose=False,
                             abrir=False)
        if protegidos and 'sob_ref' in sy.bus:
            sy.bus['sob_ref'] = sosfilt(sy.sos_hp(100, 2), sy.bus['sob_ref'], axis=1)
        sob_ref = grupo(['sob_ref'])
    else:
        rev, dly = sy.retornos(ganhos)
    comp_s = 4 * B
    print(f"\npiece: {var['tom']} {var['modo']} · {var['bpm']} BPM nominal → {bpm_ef:.2f} effective ({n_bat} beats in the body, "
          f"bar {comp_s:.3f} s) · {' '.join(prog['acordes'])} ({'+'.join(map(str, prog['batidas']))}"
          f"{', anticipation' if antecipa else ''}) · cadence {' → '.join(prog['cadencia_nomes'])}")
    print(f"      harmony {inst_h}/{harm['padrao']}/{harm['extensao']} · bass {var['baixo']['instrumento']}/"
          f"{var['baixo']['padrao']} · groove {grv['nome']} {kit} swing {sw} · melody {mel['instrumento']} · "
          f"texture {var['textura']} · bed {ref:.1f} LUFS")
    if v2:
        print(f"      v2 · genre {var.get('genero') or '(declared field by field)'} · family {grv['familia']} · "
              f"kick {grv['timbre_bumbo']} ({len(tempos_bumbo)} hits) · ducks {var['cede_db']:g} dB · role {var['papel']}")
    if voz:
        mv.salvar(folha_p.parent, voz, musica, fixos, sob, sob_ref, musica_crua, stats='--stats' in argv, fase_zero=v2)
    elif v2:                                            # v2: master sem atraso de fase no grave (o bumbo fica no tempo)
        sy.salvar(sy.soma_buses() + 0.4 * rev + 0.35 * dly, stats='--stats' in argv, fase_zero=True)
    else:
        sy.salvar(sy.soma_buses() + 0.4 * rev + 0.35 * dly, stats='--stats' in argv)

    lado = Path(f['saida']).with_suffix('.variation.json')
    lado.write_text(json.dumps({
        'variacao': var, 'bpm_efetivo': bpm_ef, 't_grade': t_corpo, 't_fecho': t_fecho, 'batida_s': B,
        'n_batidas': n_bat, 'acordes': [[tb(a0), tb(a1), gr] for a0, a1, gr in acordes],
        'wav': Path(f['saida']).name, 'identidade_arquivo': str(Path(args[0]).resolve()),
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'variation: {lado}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
