#!/usr/bin/env python3
"""mix_voz · the soundtrack ducks under the narration, like a professional edit (Contract M).

arrange_series.py uses this module when the sheet has the "voz" block. A custom arrangement can use it too:
compose the bed as usual and, before saving, call tratar() on the voice and mixar() on the music.

The voice leads. Why each step exists:
  1. Each line goes in at −23 LUFS before the compressor. The lines come out of the generator at different levels (up to
     7 dB apart); without that input gain, the same compressor would squeeze one line and not touch the other.
  2. High-pass at 80 Hz: below that the voice only has rumble and breath, which steal loudness and carry no word.
  3. Light compressor (threshold −26 dBFS, 3:1, attack 5 ms, release 90 ms): brings the strong syllables closer to the
     weak ones so the last word of a sentence does not vanish under the music.
  4. Each line at −15 LUFS: all at the same level, 3 dB above the bed (−18 LUFS, the level of a background track).
  5. The music goes down from 0.15 s before the first sound (the listener hears the music making room, and the first
     syllable is born clean), stays down while the voice speaks, holds 0.08 s after the last word and comes back in
     0.45 s. A pause shorter than 0.6 s does not rise: going up and down again in half a second is pumping.
  6. While the voice speaks, the music loses 3 extra dB at 1.5–4 kHz, the band where speech is understood.
  7. Guarantee: in every segment, the voice sits ≥ 12 dB above the soundtrack, full band and also on a phone speaker
     (300 Hz–8 kHz, where the bed "rises" relative to the voice). If it does not, the music of that segment goes down
     until it does, and the report says how much.
"""
import math
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

import numpy as np  # noqa: E402
from scipy.signal import butter, sosfilt, sosfiltfilt  # noqa: E402

import verify as V  # noqa: E402

PERFIS = {                                    # quanto a música cede na fala · onde ela fica nas pausas (dB sobre a cama)
    'calmo': {'cede_db': 11.0, 'pausa_db': -1.0},
    'reels': {'cede_db': 9.0, 'pausa_db': 0.0},
}
ENTRADA_LUFS = -23.0      # cada fala, mono, antes do compressor
HP_VOZ = 80.0
COMP = {'limiar': -26.0, 'razao': 3.0, 'ataque': 0.005, 'soltura': 0.09}
VOZ_LUFS = -15.0          # cada fala, estéreo, antes do master
CAMA_LUFS = -18.0         # a trilha sem voz (música + efeitos), antes do master
RECORTE_DB = 3.0
BANDA_RECORTE = (1500.0, 4000.0)
ANTES, SEGURA, VOLTA, PAUSA_MIN = 0.15, 0.08, 0.45, 0.6
MIN_RAZAO = 12.0
MARGEM_GARANTIA = 0.2     # o mix mira 12,2 dB depois do master, para a régua do verify.py não cair no arredondamento
FONE = (300.0, 8000.0)
EFEITOS_FICAM = ('toque', 'clique', 'digitacao', 'pop', 'tique', 'blip')   # o gesto que a tela mostra: fica no nível dele
SOB_VOZ_DB = -6.0   # os outros (whoosh, virada, riser, sucesso, impacto, acento, rabisco, giz, brilho, baque, erro) descem
MARGEM_TP = 0.3           # o limiter mira 0,3 dB abaixo do teto: o AAC da entrega sobe alguns décimos no pico


def ler_voz(caminho, n, sr):
    """A faixa de voz da folha, mono float, com exatamente n amostras."""
    from scipy.io import wavfile
    p = Path(caminho)
    if not p.exists():
        raise FileNotFoundError(f'voice: {p} does not exist — compose/assemble writes voz.wav next to the sheet')
    taxa, x = wavfile.read(p)
    if taxa != sr:
        raise ValueError(f'voice: {p.name} is at {taxa} Hz and the sheet asks for {sr} Hz')
    if x.dtype == np.uint8:
        x = (x.astype(np.float64) - 128) / 128
    elif np.issubdtype(x.dtype, np.integer):
        x = x / float(-np.iinfo(x.dtype).min)
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 2:
        x = x.mean(1)
    if abs(len(x) - n) > int(0.005 * sr):
        print(f'(warning) voice: {p.name} has {len(x) / sr:.3f} s and the sheet {n / sr:.3f} s — padding with silence or cutting the end')
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def lufs(x, sr, a=None, b=None):
    """Loudness de x (mono ou (canais, n)) inteiro, ou só de [a, b) s — a mesma conta do verify.py."""
    x = x[None] if x.ndim == 1 else x
    y = V.ponderar(x, sr)
    return V.lufs_janela(y, sr, 0.0 if a is None else a, x.shape[1] / sr if b is None else b)


def regioes(trechos, n, sr):
    """Cada fala é dona da faixa entre os pontos médios das pausas vizinhas (a cauda da voz vai junto)."""
    cortes = [0] + [int(round(0.5 * (b0 + a1) * sr)) for (_, b0), (a1, _) in zip(trechos, trechos[1:])] + [n]
    return list(zip(cortes, cortes[1:]))


def _ganho_por_regiao(v, sr, regs, trechos, alvo, estereo=False):
    """Um ganho por fala, medido no trecho dela (do 1º som ao fim da última palavra) e aplicado na região inteira,
    com rampa de 10 ms nas emendas (que caem no silêncio entre falas)."""
    g = np.ones(len(v))
    y = V.ponderar(np.stack([v, v]) if estereo else v[None], sr)
    for (i0, i1), (a, b) in zip(regs, trechos):
        medido = V.lufs_janela(y, sr, a, b)
        if math.isfinite(medido):
            g[i0:i1] = 10 ** ((alvo - medido) / 20)
    w = int(0.01 * sr)
    return v * np.convolve(np.pad(g, (w // 2, w - 1 - w // 2), mode='edge'), np.ones(w) / w, 'valid')


def comprimir(v, sr, limiar=-26.0, razao=3.0, ataque=0.005, soltura=0.09):
    """Compressor de RMS (10 ms), ganho suavizado em dB com ataque e soltura de um polo, sem lookahead."""
    from scipy.ndimage import uniform_filter1d
    hop = int(0.0025 * sr)
    nq = len(v) // hop + 1
    rms = np.sqrt(uniform_filter1d(v ** 2, int(0.01 * sr))[::hop][:nq] + 1e-12)
    nivel = 20 * np.log10(rms)
    alvo = np.where(nivel > limiar, -(nivel - limiar) * (1 - 1 / razao), 0.0)
    g = np.zeros_like(alvo)
    ka, kr = math.exp(-hop / sr / ataque), math.exp(-hop / sr / soltura)
    for i in range(1, len(alvo)):
        k = ka if alvo[i] < g[i - 1] else kr
        g[i] = k * g[i - 1] + (1 - k) * alvo[i]
    return v * 10 ** (np.interp(np.arange(len(v)), np.arange(len(g)) * hop, g) / 20)


def tratar(v, trechos, sr):
    """Voz crua da folha → voz do mix, estéreo (2, n): ganho de entrada, passa-alta, compressor, cada fala a −15 LUFS."""
    regs = regioes(trechos, len(v), sr)
    v = _ganho_por_regiao(v, sr, regs, trechos, ENTRADA_LUFS)
    v = sosfilt(butter(2, HP_VOZ, 'highpass', fs=sr, output='sos'), v)
    v = comprimir(v, sr, **COMP)
    v = _ganho_por_regiao(v, sr, regs, trechos, VOZ_LUFS, estereo=True)
    return np.stack([v, v])


def grupos(trechos):
    """Trechos separados por pausa < 0,6 s viram um grupo só: a música não sobe entre eles."""
    out = [list(trechos[0])]
    for a, b in trechos[1:]:
        if a - out[-1][1] < PAUSA_MIN:
            out[-1][1] = b
        else:
            out.append([a, b])
    return out


def envelope(n, sr, grps, profundidades):
    """(at_db, r): quanto a música cede (dB, ≥ 0) e a forma normalizada (0 = pausa, 1 = embaixo), amostra a amostra."""
    at_db, r = np.zeros(n), np.zeros(n)
    for (a, b), d in zip(grps, profundidades):
        i0, i1 = max(0, int((a - ANTES) * sr)), min(n, int(math.ceil((b + SEGURA + VOLTA) * sr)) + 1)
        t = np.arange(i0, i1) / sr
        desce = np.clip((t - (a - ANTES)) / ANTES, 0, 1)
        sobe = 1 - np.clip((t - (b + SEGURA)) / VOLTA, 0, 1)
        f = np.minimum(0.5 - 0.5 * np.cos(np.pi * desce), 0.5 - 0.5 * np.cos(np.pi * sobe))
        np.maximum(r[i0:i1], f, out=r[i0:i1])
        np.maximum(at_db[i0:i1], d * f, out=at_db[i0:i1])
    return at_db, r


def span_efeito(it, catalogo):
    """(início, fim) aproximados de um item de efeito, pela âncora e duração do catálogo."""
    cat = catalogo[it['som']]
    dur = it.get('dur')
    if dur is None and it['som'] == 'whoosh':
        dur = {'curto': 0.3, 'medio': 0.5, 'longo': 0.9}.get(it.get('variante', 'medio'), 0.5)
    dur = float(dur if dur is not None else cat['dur'])
    t = float(it['t'])
    return {'inicio': (t, t + dur), 'pico': (t - dur / 2, t + dur / 2), 'fim': (t - dur, t)}[cat['ancora']]


def sob_voz(ini, fim, trechos):
    """O som toca enquanto a música está cedendo à voz (da descida ao fim do segura)?"""
    return any(ini < b + SEGURA and fim > a - ANTES for a, b in trechos)


def mixar(musica, efeitos, voz, trechos, perfil, sr, alvo=MIN_RAZAO):
    """Aplica envelope, pausa e recorte à música e cumpre a garantia (voz ≥ alvo dB acima da trilha). musica, efeitos
    e voz: (2, n), a cama já a −18 LUFS e cada fala a −15. Devolve (música do mix, relatório)."""
    p = PERFIS[perfil]
    n = musica.shape[1]
    grps = grupos(trechos)
    prof = [p['cede_db']] * len(grps)
    dono = [next(k for k, (ga, gb) in enumerate(grps) if ga - 1e-9 <= a and b <= gb + 1e-9) for a, b in trechos]
    banda = sosfiltfilt(butter(2, BANDA_RECORTE, 'bandpass', fs=sr, output='sos'), musica, axis=1)
    fone = butter(4, FONE, 'bandpass', fs=sr, output='sos')
    yv, yvf = V.ponderar(voz, sr), V.ponderar(sosfilt(fone, voz, axis=1), sr)
    lv = [(V.lufs_janela(yv, sr, a, b), V.lufs_janela(yvf, sr, a, b)) for a, b in trechos]
    for rodada in range(12):
        at_db, r = envelope(n, sr, grps, prof)
        m = (musica + banda * (10 ** (-RECORTE_DB * r / 20) - 1)) * 10 ** ((p['pausa_db'] - at_db) / 20)
        trilha = m + efeitos
        yt, ytf = V.ponderar(trilha, sr), V.ponderar(sosfilt(fone, trilha, axis=1), sr)
        razoes = [(v - V.lufs_janela(yt, sr, a, b), vf - V.lufs_janela(ytf, sr, a, b))
                  for (a, b), (v, vf) in zip(trechos, lv)]
        falta = [0.0] * len(grps)
        for k, (rc, rf) in zip(dono, razoes):
            falta[k] = max(falta[k], alvo - min(rc, rf))
        if max(falta) <= 0 or max(prof) - p['cede_db'] > 40:
            break
        prof = [d + (f + 0.2 if f > 0 else 0.0) for d, f in zip(prof, falta)]
    rel = {
        'perfil': perfil, 'cede_db': p['cede_db'], 'pausa_db': p['pausa_db'], 'recorte_db': RECORTE_DB,
        'grupos': [{'de': round(a, 3), 'ate': round(b, 3), 'cede_db': round(d, 2),
                    'desceu_a_mais_db': round(d - p['cede_db'], 2)} for (a, b), d in zip(grps, prof)],
        'trechos': [{'de': round(a, 3), 'ate': round(b, 3), 'voz_sobre_trilha_db': round(rc, 2),
                     'no_celular_db': round(rf, 2)} for (a, b), (rc, rf) in zip(trechos, razoes)],
        'garantia_ok': bool(all(min(rc, rf) >= MIN_RAZAO for rc, rf in razoes)),
    }
    return m, rel


def validar_trechos(bloco, dur):
    """Os trechos da folha, conferidos: [início, fim] em ordem, sem sobrepor, dentro do vídeo."""
    tr = [(float(a), float(b)) for a, b in bloco.get('trechos', [])]
    if not tr:
        raise ValueError('voice: the sheet has no "trechos" — compose/assemble writes one [first sound, end of the last word] per line')
    for i, (a, b) in enumerate(tr):
        if not (0 <= a < b <= dur):
            raise ValueError(f'voice: segment {i + 1} [{a}, {b}] outside [0, {dur}] or ending before it starts')
        if i and a < tr[i - 1][1]:
            raise ValueError(f'voice: segment {i + 1} starts at {a} s, before the end of the previous one ({tr[i - 1][1]} s)')
    return tr


def salvar(pasta_folha, bloco, musica, fixos, sob, sob_ref, musica_crua, stats=False, fase_zero=False):
    """Mix final com voz: cama a −18 LUFS, voz tratada, música cedendo, master no loudness da folha com margem
    de true peak, stems (voz, musica, efeitos e ref/) e o relatório em <saida>.voz.json. fixos: os efeitos que ficam;
    sob: os que tocam debaixo da fala, já 6 dB abaixo; sob_ref: os mesmos sons, colocados de novo no nível de antes
    da voz; musica_crua: a música antes de qualquer cessão (nem aos efeitos nem à voz). Réguas do verify.py:
    ref/musica (depois dos efeitos, antes da voz) mede o que a voz fez com a música; ref/musica-crua, tudo o que o mix
    fez com ela, para o bombear; ref/efeitos, quanto cada efeito desceu."""
    import json
    import synth as sy
    sr, n = sy.SR, sy.N
    trechos = validar_trechos(bloco, sy.DURACAO)
    for a, b in sy.SILENCIOS:
        if any(ta < b and tb > a for ta, tb in trechos):
            print(f'(warning) voice: a segment crosses the sheet silence {a}–{b} s, and the voice will be cut there')
    if sy.FADE and trechos[-1][1] > sy.FADE[0]:
        print(f'(warning) voice: the last line ends at {trechos[-1][1]:.3f} s, inside the fade ({sy.FADE[0]:.3f} s)')
    voz = tratar(ler_voz(Path(pasta_folha) / bloco.get('arquivo', 'voz.wav'), n, sr), trechos, sr)
    k = 10 ** ((CAMA_LUFS - lufs(sy.condicionar(musica + fixos + sob_ref, fase_zero), sr)) / 20)   # com o fade
    musica, fixos, sob, sob_ref, musica_crua = musica * k, fixos * k, sob * k, sob_ref * k, musica_crua * k
    for i0 in sy.evt_clips:
        sy.evt_clips[i0] *= k
    alvo, teto = MIN_RAZAO, sy.CEILING_DBTP - MARGEM_TP
    fone = butter(4, FONE, 'bandpass', fs=sr, output='sos')
    for _ in range(5):                                  # a garantia vale no que sai: o limiter do master também conta
        m, rel = mixar(musica, fixos + sob, voz, trechos, bloco['perfil'], sr, alvo)
        _, g_db, red, _ = sy.master(voz + m + fixos + sob, fase_zero=fase_zero, teto=teto)
        ganho = 10 ** ((g_db - red) / 20)
        vp, tp = sy.condicionar(voz, fase_zero) * ganho, sy.condicionar(m + fixos + sob, fase_zero) * ganho
        yv, yvf, yt, ytf = (V.ponderar(z, sr) for z in (vp, sosfilt(fone, vp, axis=1), tp, sosfilt(fone, tp, axis=1)))
        for t, (a, b) in zip(rel['trechos'], trechos):
            t['voz_sobre_trilha_db'] = round(V.lufs_janela(yv, sr, a, b) - V.lufs_janela(yt, sr, a, b), 2)
            t['no_celular_db'] = round(V.lufs_janela(yvf, sr, a, b) - V.lufs_janela(ytf, sr, a, b), 2)
        pior = min(min(t['voz_sobre_trilha_db'], t['no_celular_db']) for t in rel['trechos'])
        rel['garantia_ok'] = bool(pior >= MIN_RAZAO)
        if pior >= MIN_RAZAO + MARGEM_GARANTIA or max(g['desceu_a_mais_db'] for g in rel['grupos']) > 40:
            break
        alvo += MIN_RAZAO + MARGEM_GARANTIA - pior + 0.05
    print(f"voice: profile {rel['perfil']} · the music ducks {rel['cede_db']:g} dB under speech, sits {rel['pausa_db']:+g} dB in the "
          f"pauses and loses {RECORTE_DB:g} extra dB at {BANDA_RECORTE[0] / 1000:g}–{BANDA_RECORTE[1] / 1000:g} kHz")
    for t in rel['trechos']:
        print(f"  segment {t['de']:7.3f}–{t['ate']:<7.3f} voice {t['voz_sobre_trilha_db']:5.1f} dB above the soundtrack · "
              f"on a phone {t['no_celular_db']:5.1f} dB (after the master)")
    for g in rel['grupos']:
        if g['desceu_a_mais_db'] > 0:
            print(f"  guarantee: from {g['de']:.3f} to {g['ate']:.3f} s the music went down {g['desceu_a_mais_db']:.1f} dB more "
                  f"for the voice to sit {MIN_RAZAO:g} dB above")
    if not rel['garantia_ok']:
        print(f'(warning) voice: not even the music 40 dB down leaves the voice {MIN_RAZAO:g} dB above — an effect that stays '
              f'(toque, clique, digitacao) is too loud under the speech')
    stems = {'voz': voz, 'musica': m, 'efeitos': fixos + sob, 'ref/musica': musica, 'ref/musica-crua': musica_crua,
             'ref/efeitos': fixos + sob_ref}
    sy.salvar(voz + m + fixos + sob, stats=stats, fase_zero=fase_zero, stems=stems, teto=teto)
    lado = sy.SAIDA.with_suffix('.voz.json')
    rel.update({'arquivo': bloco.get('arquivo', 'voz.wav'), 'cama_lufs': CAMA_LUFS, 'voz_lufs': VOZ_LUFS,
                'teto_limiter_dbtp': round(teto, 2), 'alvo_garantia_antes_do_master_db': round(alvo, 2),
                'stems': list(stems)})
    lado.write_text(json.dumps(rel, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'voice: {lado}')
    return rel
