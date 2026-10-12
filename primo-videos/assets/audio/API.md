# synth · synthesized soundtrack API

`synth.py` provides **instruments, a mixing desk and mastering**. The music does not come from the library: each video
composes its own (genre, key, BPM, timbres). `api_example.py` (with `sheet_api_example.json`, 8 s for a made-up bakery)
shows the **API** plumbing in a 3-bar sketch; it is not a style to copy.
Requirement: Python 3 with numpy and scipy. Everything is in seconds. Signals are `(n,)` mono or `(2, n)` stereo.

## A new arrangement, step by step
1. Copy `synth.py` and `verify.py` to the video folder: that way the soundtrack stays reproducible even if the library changes.
2. Write `sheet.json` from the shot breakdown (schema at the end). Every marker that has its own sound becomes `event=True`.
3. Write `arranjo.py`: `configurar` → `from synth import *` → `place(...)` → process buses → `salvar(mix)`.
4. Run `python arranjo.py` and then `python verify.py sheet.json`. Exit code 0 means everything passed; otherwise, the output says what failed.
5. Same `semente` = same WAV, bit for bit. Change the seed for another variation of noises and phases.

Minimal example (lo-fi 85 BPM, 8 s, markers at 0, 4·60/85 and 8·60/85 s; tested, passes `verify.py`):
```python
import sys
from pathlib import Path
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))                     # synth.py copied to the video folder
import synth
synth.configurar(AQUI / 'sheet.json')
from synth import *                               # after configurar

b = BATIDA                                        # 60/85 s
ACORDES = [(50, 53, 57, 60, 64), (43, 53, 57, 59, 64)]   # Dm9 · G13
for c in range(3):                                # 3 bars; anything past 8 s is ignored
    t0 = 4 * b * c
    for m in ACORDES[c % 2]:
        place(epiano(M(m), 3.6 * b, vel=0.6), t0, 'keys', gain=0.25, rev=0.3)
    place(baixo808(M(ACORDES[c % 2][0] - 12), 2 * b), t0, 'bass', gain=0.8, event=True)
    for k in range(4):
        tb = t0 + k * b
        if k % 2 == 0:
            place(kick(), tb, 'drums', gain=0.7, event=(k == 0))
        else:
            place(palma_seca(), tb, 'drums', gain=0.5, rev=0.1)
        place(shaker(), tb + b / 2, 'drums', gain=0.3, pan=0.3)
place(vinil(DURACAO), 0.0, 'fx', gain=0.4)

bus['keys'] = fita(bus['keys'], profundidade=0.7)
bus['keys'] *= sidechain([4 * b * c + 2 * b * k for c in range(3) for k in range(2)], 0.3)
ganhos = ganho_por_alvo({'drums': ((0, 8), -17), 'keys': ((0, 8), -20), 'bass': ((0, 8), -19)})
rev, dly = retornos(ganhos)
salvar(soma_buses() + 0.4 * rev + 0.6 * dly)
```
A marker on musical time: write the value in the sheet with every decimal place (`2.823529411764706`). `verify.py` requires
the flagged sound to start **at the marker's exact sample**.

## The desk
- `configurar(folha, buses=...)` reads the sheet and resets everything: `SR`, `N`, `DURACAO`, `BPM`, `BATIDA` (s per beat), `COMPASSO`,
  `SILENCIOS`, `SEGMENTS` (continuous stretches), `FADE`, `TARGET_LUFS`, `CEILING_DBTP`, `SAIDA`, `rng` (from `semente`), `FOLHA`.
  **Call it before `from synth import *`**: the import copies the values as they are at that moment.
- `bus[nome]` is a `(2, N)` array. `place` on a bus that does not exist creates the bus. `BUSES` sets the order of the sum.
- `place(sig, t0, to, gain, pan, rev, dly, event)` adds the sound starting at `t0`. A mono sound is panned by `pan` (-1…1).
  The sound is cut (12 ms fade) at the sheet's next silence, and starting inside a silence is an error. Anything that starts after the end is ignored.
  `rev`/`dly` are sends to reverb/delay. `event=True` stores the attack so `verify.py` can check the marker.
- Bus processing: filters (`sosfilt(sos_hp(140), bus['x'], axis=1)`), automation (`tv_filter(bus['x'], curve(T(N), pts))`)
  and sidechain (`bus['x'] *= sidechain(tempos_do_kick, 0.4)`).
- `ganho_por_alvo({bus: ((de, ate), lufs)})` levels each bus by loudness over a window and returns the gains
  (pass them to `retornos`, which applies the same gain to that bus's sends).
- `retornos(ganhos)` → `(rev_out, dly_out)`: ping-pong delay (default: a dotted eighth at the BPM) and convolution reverb,
  processed **segment by segment**, so no tail crosses a silence.
- `salvar(soma_buses() + a * rev_out + b * dly_out)` runs the `master` (lows in mono, DC removed, the sheet's fade,
  loudness on target with a true-peak limiter, silences at digital zero, last sample 0) and writes the 24-bit WAV,
  `stems/eventos.npz` next to it, and the summary. `salvar(mix, stats=True)` also prints the LUFS curve per second.
  One soundtrack per folder: `stems/eventos.npz` belongs to the last soundtrack saved there. `verify.py` notices when it belongs to another soundtrack, warns, and checks by the envelope only.

## Public functions
**Utilities**: `S(t)` s→samples · `T(n)` time vector · `M(m)` MIDI→Hz · `nota('F#3')`→MIDI · `norm(x)` peak 1 ·
`noise(n, ch=None)` Gaussian from `rng` · `edges(n, a, r)` cosine ramps · `tail_fade(x, r)` · `curve(t, [(t, v), …])` exponential
automation · `to_stereo(y, pan)` · `adsr(dur, a, d, s, r)` envelope of dur+r · `sos_lp/sos_hp(f, o=2)`, `sos_bp(f1, f2, o=2)`
Butterworth for `sosfilt` · `rbj(kind, fc, q)` biquad · `tv_filter(x, fc, q, kind='lp'|'hp'|'bp', block)` filter with a variable cutoff.
**Oscillators**: `saw(freq, n, ph0)` PolyBLEP saw (freq can be a vector) · `tone(f0, dur, [(ratio, amp, tau)], …)` additive.

**Original palette** (output peaks at 1.0):
- `pluck(f0, dur, bright, tau)`: additive pluck · `pling(f0, dur, bell, decay)`: marimba+bell · `bell(f0, dur, bright, decay)`: bell.
- `glint(f, dur)`: high sparkle · `shimmer_pad(f0, dur)`: sine bed with tremolo.
- `pad_note(f0, dur, attack, release, amp, det, pitch)`: stereo pad (returns dur+release; `pitch(t)` multiplies the frequency).
  **Watch out:** `pad_note`, `supersaw_note` and `riser` leave air above 18 kHz (measured: −30 to −35 dB), and `verify.py` fails anything above −40. Filter their buses in the arrangement: `bus['pad'] = sosfilt(sos_lp(13000, 4), bus['pad'], axis=1)`. `arrange_series.py` already does this.
- `supersaw_note(f0, dur, attack, release, amp, det, pitch, decay)`: 7 saws (EDM) · `lead_note(f0, dur, rel)`: lead with vibrato.
- `bass_note(f0, dur, bright, amp, sub, pitch, release, decay)`: mono additive bass.
- Drums: `kick(dur, f_hi, f_lo, p_tau, a_tau, click, drive)` · `bumbo(tipo)`: each genre's kick, peak 1.0
  (`'eletronico'` the usual one · `'house'` round, low end within ~13 ms · `'techno'` hard, saturated, with rumble after the
  hit · `'garage'` dry and short · `'acustico'` head, shell and felt · `'break'` compressed acoustic) ·
  `subboom(dur, …)` · `crash(dur, tau, lp)` (`[:, ::-1]` = reversed) ·
  `hat(dur, tau)` · `clap(dur)` · `snare(dur, f)` · `tom(f0, dur)`.
- Sync effects: `thud()` thud · `woodclick(f)` click into place · `tick(f)` letter/UI · `tap()` screen tap ·
  `pop(f_start, f_end, …)` bubble · `tumble()` things falling · `scribble(dur)` pen · `flip_snap()` card flipping ·
  `morph(dur)` transformation · `whoosh(dur, tp, f0, f1, f2, q, pan, up, down, hard_end)` · `riser(dur, m0, m1, …)` ·
  `powerdown(dur)` powering down.

**Extended palette** (output peaks at `amp`, default 0.5 ≈ -6 dBFS; DC zeroed; starts and ends at 0):
- `corda(f0, dur, brilho, decaimento, posicao)`: Karplus-Strong. Acoustic guitar with `brilho` ~0.5; harp with low `brilho` and long `decaimento`; koto with high `brilho` and `posicao` ~0.08.
- `epiano(f0, dur, vel, brilho, release, tremolo)`: FM Rhodes, for neo-soul and lo-fi (dur+release).
- `piano(f0, dur, vel, release)`: inharmonic additive piano with hammer, for ballads and emotional scores (dur+release).
- `orgao(f0, dur, drawbars='888000000', leslie, clique, release)`: Hammond, for soul, gospel and reggae (dur+release).
- `baixo808(f0, dur, glide, de, drive, decay, release)`: punchy 808 sub, glide from `de` Hz and saturation.
- `baixo_serra(f0, dur, corte, q, env, decay, sub, amp)`: saw through a resonant low-pass that opens on the attack and closes
  over `decay`; techno's short, repeated bass (with high `env` and long `decay`, a subtle acid). Mono.
- `pad_coral(f0, dur, vogal='a'|'e'|'i'|'o'|'u', ataque, release, vozes)`: formant choir, stereo (dur+release).
- `metais(f0, dur, brilho, release)`: brass stab for funk and fanfare (dur+release). Sounds best up to ~C6.
- `cordas_orq(f0, dur, ataque, release, brilho)`: slow string section for cinema, stereo (dur+release).
- Percussion: `shaker(dur, brilho)` · `aro(dur)` rimshot/cross-stick · `conga(f0, dur, tapa)` · `tamborim(dur, f0)` ·
  `palma_seca(dur)` · `prato_ride(dur, sino)` (stereo).
- Texture: `vinil(dur, chiado, estalos)` stereo, lo-fi · `fita(sinal, profundidade, wow_hz, flutter_hz)` wow/flutter +
  saturation, keeps the peak · `impacto_cinema(dur)` boom + punch + air + tail, stereo.

**Desk and master**: `configurar`, `place`, `seg_end(t0)` end of t0's segment · `sidechain(times, depth, attack, hold, release)`
`(N,)` curve · `ganho_por_alvo(alvos)` · `somar_sends('rev'|'dly', ganhos)` · `retornos(ganhos, ir, dly_para_rev, rev_hp, rev_lp, **ping_pong)` ·
`make_ir(dur, predelay)` synthetic IR · `ping_pong(x, d, fb, taps)` · `per_segment(x, fn)` effect segment by segment ·
`soma_buses()` · `relatorio([(nome, sinal)])` LUFS per section · `kw(x)` K-weighting · `loud(y_kw, a, b)` ungated LUFS ·
`lufs_integrated(x)` BS.1770 · `true_peak_env(x)` 4x · `limiter(x, ceiling_db)` · `master(mix, fase_zero=False)` · `write_wav24(path, x)` ·
`salvar(mix, stats, fase_zero=False)` (`fase_zero=True`: master high-passes with no phase delay; the kick's low end stays on time).

## sheet.json schema
```json
{
  "titulo": "text", "duracao": 40.0, "bpm": 120, "compasso": 4, "taxa": 48000,
  "saida": "soundtrack.wav", "loudness_lufs": -14.0, "teto_dbtp": -1.5, "semente": 20260926,
  "silencios": [[11.75, 12.0], [33.875, 34.0]],
  "fade": [38.0, 40.0],
  "secoes": [{"nome": "intro", "de": 0.0, "ate": 4.0, "energia": "baixa", "descricao": "text"}],
  "marcos": [{"t": 1.0, "evento": "what happens on screen", "som": "what should sound", "opcional": false}]
}
```
- The code uses: `duracao` and `taxa` (N = round(duracao·taxa), checked to the sample), `saida` (relative to the sheet's folder),
  `loudness_lufs`, `teto_dbtp`, `semente`, `silencios` (exact digital zero; the stretches between them are the `SEGMENTS`),
  `fade` (cosine to zero; `null` = only 12 ms at the end), `bpm` (`BATIDA` and the delay) and `marcos`.
- `tonica` (optional, MIDI): the tonic that `blip` and `brilho` use when the marker does not carry its own. `arrange_series.py`
  already puts the piece's tonic on each of those markers; the key is for a sheet built outside it.
- `secoes`, `titulo` and the text fields are for humans; `secoes` also organize the `relatorio` and `verify.py`'s per-section loudness.
- Required marker (`opcional: false`): `verify.py` requires an onset within ±10 ms. With `stems/eventos.npz`, it also requires an
  `event=True` sound starting at the marker's sample. Use `opcional: true` for slow-attack markers (pad, strings) or purely informative ones.
- `verify.py` also checks: format (the sheet's rate, 24 bits, stereo, exact sample count), clicks at the edges of silences and at the end, peak, DC,
  lows <120 Hz in mono, energy >18 kHz, integrated loudness (±0.5 LU) and true peak (≤ ceiling + 0.1 dB).

## Sound effects (sounds.py)
`toque` (tap), `clique` (click), `digitacao` (typing), `virada` (flip), `whoosh`, `sucesso` (success), `riser`, `impacto` (impact)
and `acento` (accent), generated on the fly on top of `synth.py`; and, for the drawn explainer, `pop`, `tique` (tick), `blip`,
`rabisco` (scribble), `giz` (chalk), `brilho` (sparkle), `baque` (thud) and `erro` (error), with the sound design ported from
`engine/audio/sfx.js` of [explainroo](https://github.com/vincentsch/explainroo) (MIT, © 2026 Vincent Schmalbach).
Copy `sounds.py` to the video folder along with `synth.py` (`new-project.mjs` already copies it).

```python
import sounds as sons                                        # after synth.configurar and from synth import *
y = sons.som(nome, semente=0, indice=0, **params)  # mono (n,) or stereo (2, n); starts and ends at 0;
                                                   # short-term loudness of -26 LUFS (K-weighted max. over 200 ms)
y, ancora = sons.som_ancorado(nome, semente=0, indice=0, **params)   # anchor in samples from the start
sons.CATALOGO[nome]  # {'descricao', 'nivel_db', 'dur', 'ancora', 'ataque_seco', 'rev', 'sino', 'parametros'}
postos = sons.colocar(itens, bus='sfx', ref_lufs=None, semente=None, verbose=True, abrir=True)
sons.ref_cama(excluir=('sfx',))                    # integrated LUFS of the sum of the other buses (pre-master)
sons.colocar(itens, proteger=('bumbo',))           # buses that never duck when making room (besides sfx and acento)
sons.loud_curta(y)                                 # the level measure used above
```
- `itens`: `[{'t': s, 'som': nome, 'nivel': dB (optional), 'pan', 'rev', 'dly', 'event' (optional), + the sound's parameters}]`.
  `semente=None` uses the sheet's. `indice` goes up on its own with each repetition of the same sound: ten taps are never identical.
- **Anchor:** `inicio` (the sound starts at t, `event=True`) · `pico` (whoosh: starts at t − dur/2, peaks at t, no event) ·
  `fim` (riser: ends exactly at t, no event). A marker with a whoosh or a riser goes with `"opcional": true`, or shares the
  instant with an attack sound (riser + impact at the same t).
- **Level:** `nivel` is dB relative to the bed. `ref_lufs=None` measures the sum of the buses already on the desk: call `colocar` after
  composing and leveling (`ganho_por_alvo`) the bed and before `retornos`.
- **`abrir=True`:** for each sharp-attack sound, `colocar` predicts the onset rise the way `verify.py` measures it (5 ms RMS,
  full band and >1 kHz). Below a predicted 12 dB, the bed ducks ahead of time (drops from −60 to −30 ms, holds until
  +100 ms, comes back over 300 ms), by 2 to 10 dB, and only as a last resort does the effect go up, by up to +4 dB. The `sfx` and `acento` buses never
  duck. What was done goes to the log and to the `postos` list (`cama_cede_db`, `subida_prevista_db`).
- A sound starting before 0 or inside one of the sheet's silences loses its head, with a 5 ms ramp.

| sound | anchor | default level (dB rel.) | typical dur. | parameters |
|---|---|---|---|---|
| `toque` | start | −6 | 0.075 s | `variante` 'macio' \| 'firme' |
| `clique` | start | −6 | 0.2 s | `variante` 'mouse' \| 'trackpad', `soltar` (s between press and release; 0 = press only) |
| `digitacao` | start (1st key) | −10 | dur | `dur` or `teclas`, `teclado` 'notebook' \| 'mecanico' \| 'tela', `enter` |
| `virada` | start | −4 | 0.36 s | `variante` 'pagina' \| 'cartao' (0.22 s), `direcao` ±1 |
| `whoosh` | peak | −3 | 0.5 s | `dur` or `variante` 'curto' (0.3) \| 'medio' \| 'longo' (0.9), `direcao` |
| `sucesso` | start | −2 | 0.85 s | `tonica` (MIDI), `modo` 'maior' \| 'menor', `notas` 2 \| 3 |
| `riser` | end | −4 | 1.5 s | `dur`, `tonica`, `ticks` |
| `impacto` | start | 0 | 1.2 s | `dur`, `tonica` |
| `acento` | start | −5 | 0.6 s | `nota` (MIDI) — musical accent for a marker with no effect |
| `pop` | start | −6 | 0.25 s | — (something appears: a ~380→830 Hz tone in 45 ms + a small high snap) |
| `tique` | start | −10 | 0.06 s | — (counting: a high tick, ~2.8 kHz) |
| `blip` | start | −6 | 0.35 s | `passo` (pentatonic degree), `tonica` (MIDI or pitch class) |
| `rabisco` | start, rises over 18 ms | −10 | dur (0.6 s) | `dur` — felt-tip pen on paper, stroke by stroke |
| `giz` | start, rises over 18 ms | −12 | dur (0.6 s) | `dur` — chalk on a blackboard, grainy, with short squeaks |
| `brilho` | start | −5 | ~1.5 s | `tonica` — a cluster of bell pings on the pentatonic (something new, magical) |
| `baque` | start | −4 | 0.6 s | — (something lands: a low tone from 110→42 Hz, low noise and felt contact) |
| `erro` | start | −6 | 0.33 s | — (a double low buzz, saws at 110 and 116.5 Hz, with a subtle snap) |

The levels are for a tutorial background soundtrack: the sounds stay present and under the music. In a
foreground (`protagonista`) soundtrack, raise the item by 2 to 4 dB (`'nivel'`).

- **`sino`:** `True` for the sounds that sound like a bell (`sucesso` and `brilho`), `False` for all the others. When the brand rejects
  bells, filter on it: `[n for n, c in sons.CATALOGO.items() if not c['sino']]`.
- **`blip` and the index:** `passo` is the degree of the major pentatonic starting from the tonic one octave up (0 = tonic,
  5 = the octave, like `pentaNote(tonic + 12, passo)` in the original engine). Without `passo`, `indice % 8` applies: since `colocar`
  raises the index with each repetition of the same sound, ten blips in a row climb in pitch (the 9th goes back to the tonic). The
  blip generator declares that it receives the index (`@_recebe_indice`); the others do not receive it.
- **Tonic of `blip` and `brilho`:** the `tonica` parameter → otherwise the sheet's `"tonica"` (`synth.FOLHA['tonica']`, MIDI,
  e.g. the variation's `60 + tom`) → otherwise 72 (C). Only the pitch class counts (62, 74 and 2 give the same D): it is placed
  in C4–B4, blip step 0 sounds one octave up (C5–B5) and brilho two octaves up.
- **`rabisco` and `giz`** start at t but have no sharp attack (each stroke rises over 18 ms): they mark the stroke, not an
  instant. A marker with them goes with `"opcional": true`, like the whoosh.
- **`baque` and `erro`** are low: the felt contact (baque) and the snap at the start of each pulse (erro) sit 13 to
  19 LU below the body (together they add less than 0.1 LU), only so the attack shows up above 1 kHz when the bed's low end
  hides the sound.

Verification: `python sounds.py --verify [--out DIR]` generates every sound and variant and checks edges at zero, NaN, DC,
peak, energy >18 kHz, attack within 2 ms, enough high-frequency attack, determinism and variation by index. With `--out`,
it writes `catalog.wav` and `catalog-spectrum.png`. It exits with code ≠ 0 if anything fails.

## Series soundtrack (series.py, arrange_series.py)
In a series, the identity is decided once and each piece gets its own soundtrack: `variacao(identidade, semente)`.
**One seed per piece.** The same seed on different sheets is the same music, stretched.

```python
import series as serie
ident = serie.carregar_identidade('identity.json')     # validates and fills in the defaults
v = serie.variacao(ident, semente)    # deterministic, JSON-serializable dict: tom, tonica_pc, modo, escala, bpm,
                                      # progressao{graus, batidas, antecipacao, cadencia, acordes, cadencia_nomes},
                                      # motivo{notas, resposta}, groove{nome, bumbo, marcacao, tempo, kit, swing},
                                      # baixo{instrumento, padrao}, harmonia{instrumento, padrao, extensao, abertura,
                                      # registro}, melodia{instrumento, registro}, textura, brilho, densidade, papel
serie.janela_garantida(ident)          # no. of consecutive seeds without repeating (key, BPM) or progression
```
CLI:
```
python arrange_series.py identity.json sheet.json [--stats]    # composes, mixes and saves (WAV + stems/eventos.npz
                                                                 # + <output>.variation.json)
python series.py --compare folhaA.json folhaB.json [wavA wavB]  # differences + chroma similarity; code 0 = ok
python series.py --test identity.json [N]                    # distinction rules over seeds 1..N
python series.py --show identity.json SEED                  # the variation, as JSON
```
- **Guarantees:** (key, BPM) comes from a bijection of the seed. Neighboring seeds never repeat the key, and within
  `janela_garantida` seeds (keys × BPMs, or the mode's 288–384 progressions, whichever is smaller) nothing repeats. The
  progression is a 4-degree loop (with rotations, no duplicates) × 6 harmonic rhythms × anticipation. The motif is
  generated (rhythmic cells + a walk on the scale) and the answer changes the ending.
- **`--compare`:** chroma (12 classes, FFT) per bar, each piece on its own grid (read from `.variation.json`). Criterion:
  best transposition < 0.85. Same seed and same sheet: requires an identical hash. Same seed on different sheets:
  fails. Measured reference: two different pieces from the example series give 0.57, and the same music stretched gives 0.95.
- **Form in `arrange_series.py`:** 1st section = opening (bed coming in + anacrusis), last = closing (cadence →
  tonic). The resolution snaps to the required marker that sits −0.3 to +0.6 s from the start of the closing. The BPM is
  adjusted by up to half a beat across the whole body so that a whole number of beats fits. The sheet's `bpm` is ignored.
- **Off-grid events:** effects and accents land on the exact sample. A bed note whose attack would land up to 45 ms
  before an event moves to the event (tonal) or is dropped (percussion). In v2, the kick and the short bass have their own rule
  (below, under `groove` and `padrao_baixo`).

`identity.json` schema (new series: `"versao": 2`, contract C). No genre is the default: the example
below declares every field for a made-up nightclub whose audience lives on house; right after it, two other
made-up identities, for different audiences, ask for other genres.
```json
{
  "versao": 2,
  "nome": "Porão 9 · how to use the app", "papel": "fundo",
  "estilo": "deep house: round 4x4, open hi-hat on the offbeat, bass on the offbeat, organ in m7/m9",
  "genero": "house",
  "bpm": [120, 126], "modos": ["dorico", "menor"], "tons": ["C", "D", "Eb", "F", "G", "A"],
  "instrumentos": {"harmonia": ["orgao", "epiano", "piano"], "baixo": ["bass_note"],
                   "percussao": ["kick", "clap", "hat", "hat_aberto", "shaker"], "melodia": ["pluck", "epiano"],
                   "textura": ["pad_note"]},
  "groove": ["house"], "bumbo": "house", "padrao_baixo": ["contratempo", "contratempo_oitava"],
  "padrao_harmonia": ["stab", "stab_sincopado"], "cede_db": 5,
  "densidade": "baixa", "loudness_lufs": -18.0
}
```
Other audiences, other identities (only what changes):
- physiotherapy clinic, adult patients: `"genero": "acustico"`, `"bpm": [80, 92]`, harmony `corda` and `piano`,
  percussion `kick`, `shaker`, `aro`;
- racing game, young audience: `"genero": "break"`, `"bpm": [170, 174]`, `"papel": "protagonista"`, bass
  `baixo808`, percussion `kick`, `snare`, `hat`.

Why it exists: in the old identity the groove comes from the density and the kick has a single timbre, so no identity
could ask for a house four-on-the-floor. Here the **genre** (what the audience listens to) and the **role** (how loud and
how full, for the person reading) are two separate decisions.

- **`genero`** (shortcut, optional): `acustico`, `break`, `garage`, `house` or `techno`. It fills in the `groove`, `bumbo`,
  `padrao_baixo`, `padrao_harmonia`, `cede_db` and `swing` the identity did not declare. What the identity declares always
  wins. `--show` prints what was resolved.
- **`groove`**: list of the accepted grooves. The seed picks among them, and only among them. Without `groove` (and without
  `genero`), the density's list applies, as in version 1.
  | groove | family | kick (sixteenths 0–15) | backbeat | offbeat (`aberto`) | ghost snare (`fantasma`) | what the seed varies |
  |---|---|---|---|---|---|---|
  | `house` | `pista` (dance floor) | 0 4 8 12, fixed | 4 12 | 2 6 10 14 (open hi-hat) | — | timekeeping |
  | `techno` | `pista` | 0 4 8 12, fixed | 4 12, or 12, or 4 12 14 | 2 6 10 14 | — | timekeeping, backbeat |
  | `garage` | `quebrado` (broken) | 2-step: 0 10 · 0 7 10 · 0 10 11 · 0 3 10 | 4 12 | — | 7 15 | kick, timekeeping |
  | `break` | `quebrado` | 0 2 10 · 0 10 11 · 0 3 10 · 0 2 7 10 | 4 12 | — | 7 9 15 | kick, timekeeping |
  | `reto`, `meio_tempo`, `quebrado`, `contratempo`, `sincopado`, `leve` | `leve` (light) | the version 1 ones | | — | — | kick, timekeeping |
  In the `pista` family the four-on-the-floor starts on beat 1 of the body and no beat disappears because of a video event.
  A kick less than 26 ms before an event (where its click would pull forward the onset `verify.py` measures) moves
  to the nearer side: the event, or 26 ms before it. It never moves more than 13 ms off the beat.
  Dance-floor mix: the kick owns the sub. The bass goes through a 60 Hz high-pass, the effects (`sfx`) through a
  100 Hz one (the mouse click's "thunk" fought with the kick), and the kick does not duck when `sons.colocar` makes room
  for an effect (`proteger=('bumbo',)`).
- **`bumbo`**: the kick's timbre (string or list): `eletronico` (the version 1 one), `acustico`, `break`, `garage`,
  `house`, `techno`. See `synth.bumbo`. In v2 the kick has its own bus (`bumbo`).
- **`padrao_baixo`**: list of the accepted patterns. New: `contratempo` and `contratempo_oitava` (house: the bass between
  the kicks), `rolante` and `rolante_quinta` (techno: a note repeated in sixteenths, off the kick), `garage`,
  `quebrado`; plus the version 1 ones (`semibreve`, `raiz_quinta`, `pulso`, `sincopado`, `colcheias`, `ancora`). A
  short bass note that would land up to 90 ms before an event is dropped: the RMS of a low note ripples, and `verify.py`
  would read the event's onset early.
- **`padrao_harmonia`**: list of the accepted patterns. New: `stab` (a chord on the offbeat), `stab_sincopado`, `dub`
  (one chord per bar, with delay). Plus the version 1 ones (`sustentado`, `pulsado`, `seminimas`, `respiro`,
  `arpejo`). A sustained instrument (`pad_note`, `pad_coral`, `cordas_orq`, `shimmer_pad`) is always `sustentado`.
- **`cede_db`** (0–12): how much the harmony, the bass and the texture duck on each kick (sidechain; the melody ducks
  half as much, in dB). 0 = no ducking. House 4–6, techno 5–8, acoustic 0.
- **New instruments in v2:** percussion `hat_aberto` (the offbeat; a groove with an offbeat but neither `hat_aberto` nor
  `hat` is an error) · bass `baixo_serra`.
- **The tempo stays in range.** In v2 the BPM adjustment (to fit a whole number of beats in the body) picks, among
  the neighbors, the one that falls within `bpm`. Tempo is a genre convention: house outside 118–128 is no longer house.
- **`papel` within the genre** (`serie.PAPEL_V2` and `serie.ALVOS_V2`). The role does not take away the genre; it takes away layers and volume:
  | | `fundo` (background) | `protagonista` (foreground) |
  |---|---|---|
  | kick, backbeat, offbeat, bass | stay (they are the genre) | stay |
  | timekeeping (closed hi-hat, shaker) | eighths only | as the groove asks (sixteenths) |
  | ghost snare (`fantasma`) | out | in |
  | backbeat / offbeat (gain) | 0.45 / 0.5 | 0.65 / 0.6 |
  | melody | one phrase every 8 bars | every 4 (plus answers, if the density is not low) |
  | mids 1.2–4 kHz in the harmony and the melody | −5 dB (room for the reader) | intact |
  | loudness | −18 LUFS | −14 LUFS |
  Per-bus targets (ungated LUFS over the body, pre-master): in `pista` the kick sits above the bass (`fundo`: kick −20.5,
  bass −26.5, harmony −23); in `leve`, the harmony leads (−21) and the kick sits at −29.
- **Master with no low-end delay (v2):** `arrange_series.py` saves with `salvar(..., fase_zero=True)`: the master's high-passes
  (22 Hz and the side one at 120 Hz) run forward and backward. The causal version delayed the low end of every
  kick by ~6 ms. Without `fase_zero` (the default), the master is the usual one.
- `variacao()` for a v2 identity also returns `versao`, `genero`, `bpm_faixa`, `cede_db` and, under `groove`,
  `familia`, `fantasma`, `aberto` and `timbre_bumbo`.

Schema of the old identity (no `"versao"`). **Still valid, and composes sample for sample as before**:
```json
{
  "nome": "Agenda Clara · tutorials", "papel": "fundo",
  "estilo": "free text for humans",
  "bpm": [88, 104], "modos": ["maior", "lidio"], "tons": ["C", "D", "Eb", "E", "G", "A", "Bb"],
  "instrumentos": {"harmonia": ["epiano", "pad_note"], "baixo": ["bass_note"],
                   "percussao": ["kick", "shaker", "hat", "aro"], "melodia": ["pling", "bell"],
                   "textura": ["shimmer_pad"]},
  "densidade": "baixa", "loudness_lufs": -18.0,
  "swing": [0.0, 0.08], "brilho": [0.35, 0.55], "registro_harmonia": [57, 65], "registro_melodia": [72, 79],
  "efeitos": {"nivel": {"toque": -6, "digitacao": -10}}
}
```
- Required (in both versions): `nome`, `papel` (fundo | protagonista), `bpm` [min, max], `modos` (maior, lidio,
  mixolidio, dorico, menor), `tons` (C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B), `instrumentos`.
- `instrumentos`: each function lists the allowed ones, and the seed picks one per piece. Accepted — `harmonia`: epiano, piano,
  pad_note, orgao, corda, pad_coral, cordas_orq, pluck · `baixo`: bass_note, baixo808, corda (+ baixo_serra in v2) ·
  `percussao`: kick, conga, aro, palma_seca, clap, snare, tamborim, shaker, hat, prato_ride (+ hat_aberto in v2; roles:
  kick, backbeat, timekeeping, and in v2 offbeat and ghost snare) · `melodia`: pling, pluck, bell, corda, epiano, piano,
  lead_note, metais · `textura` (optional): shimmer_pad, vinil, pad_note, pad_coral.
- Optional, with defaults: `densidade` baixa | media | alta (grooves when there is no `groove`, bass, motif cells),
  `loudness_lufs` (−18 `fundo`, −14 `protagonista`; the sheet's value wins), `swing` and `brilho` [min, max],
  `registro_harmonia` and `registro_melodia` [MIDI min, max], `efeitos.nivel` (default level per sound in the series).
- In the old identity, `densidade` picks the groove, and the `fundo` role lowers percussion and melody. It cannot
  ask for a dance-floor genre. For a new series, use `"versao": 2`.

## The `efeito` field in the sheet's markers
```json
{"t": 3.47, "evento": "tap on Save", "som": "tap", "efeito": "toque", "nivel": -6, "opcional": false}
{"t": 5.12, "evento": "types the name", "som": "typing", "efeito": "digitacao", "dur": 1.8, "opcional": false}
{"t": 10.9, "evento": "screen change", "som": "whoosh", "efeito": "whoosh", "dur": 0.5, "opcional": true}
{"t": 22.0, "evento": "riser into the logo", "som": "riser", "efeito": "riser", "dur": 1.4, "opcional": true}
{"t": 22.0, "evento": "logo", "som": "impact", "efeito": "impacto", "opcional": false}
```
- `efeito`: a name from `sons.CATALOGO`. `nivel` (dB relative to the bed) and the sound's parameters (`dur`, `variante`,
  `direcao`, `teclas`, `teclado`, `enter`, `soltar`, `notas`, `ticks`, `passo`, `pan`, `rev`) are optional.
  `arrange_series.py` tunes `sucesso`, `riser`, `impacto`, `blip` and `brilho` to the piece's key (the `blip`'s `passo` makes a
  second list start again from the tonic).
- `t` is the anchor instant: the start, the whoosh's peak or the riser's end.
- A marker without `efeito` becomes a subtle musical accent (`acento`, a chord note above the melody).
- `opcional: false` only with a sharp-attack sound (toque, clique, digitacao, virada, sucesso, impacto, acento, pop, tique,
  blip, brilho, baque, erro); rabisco and giz go with `opcional: true`.
