# Voice in tutorial mode: the voice sets the time, the caption is the speech

How the tutorial mode engine (`references/tutorial.md`) records and composes a video with a voiceover.

- **What generates the voice** is `scripts/voice.mjs` (the voiceover script, the voice choice, `generate`:
  `references/voice-script.md` and `references/voice-choice.md`). It delivers the narration, and the engine only reads
  it.
- **The engine doesn't know who generated it.** It reads a neutral `narration.json` and the WAVs next to it.
- **Without `voz` in `video.mjs`, none of this exists**, and the output is the usual one, byte for byte.

## Contents
1. Turning the voice on in a video
2. The narration the engine reads
3. Timing: first say it, then do it
4. The caption is the speech
5. What comes out
6. Error messages and what to do
7. What has no voice yet

---

## 1. Turning the voice on in a video

In `video.mjs`, one more block:

```js
voz: { locucao: 'voice/{versao}/narration.json', roteiro: 'voice/{versao}/script.json', perfil: 'calmo' },   // perfil: 'calmo' | 'reels'
```

- **`{versao}`** becomes the version's name (`phone`, `computer`…). Each version has its own narration, because the
  text changes: on the phone the voice says "Tap Save"; on the computer, "Click Save".
  - A version without narration is an error. Generate its voice, or remove the version from `versoes`.
- **`roteiro`** is the voiceover script of that version (optional: without it, the `script.json` next to the
  narration). Before the voice is generated, `--check` reads the lines from it (the text only, no timings yet), so a
  text error shows up before a single credit is spent.
- **`perfil`** goes to the sync sheet and chooses the mix: `calmo` in a tutorial, `reels` in a short cut. It's the same
  name the script used for the voice's speed (`references/voice-choice.md` §5).
  - Without the field, `calmo` applies.
- **Record and compose as always** (`references/tutorial.md` §7). `--check` already checks the narration (or the
  script), so a text error shows up in seconds, before recording.

## 2. The narration the engine reads

`<video folder>/voice/<version>/narration.json`, with the audio in `lines/` (PCM WAV, 48 kHz, mono):

```json
{
  "versao": 1, "idioma": "en-US", "voz": { "…": "informational; the engine doesn't use it" },
  "falas": [
    { "id": "abertura", "onde": "abertura", "texto": "Water the garden.", "arquivo": "lines/abertura.wav",
      "duracao": 1.21, "inicio_voz": 0.04,
      "palavras": [ { "texto": "Water", "ini": 0.04, "fim": 0.39 }, { "texto": "the", "ini": 0.42, "fim": 0.52 }, { "texto": "garden.", "ini": 0.55, "fim": 1.21 } ] },
    { "id": "p1", "onde": { "passo": 1 }, "texto": "Tap the flower bed.", "…": "…" },
    { "id": "fechamento", "onde": "fechamento", "texto": "Done. See you tomorrow.", "…": "…" }
  ]
}
```

- **`onde`** says where the line goes in: `"abertura"` (opening), `{ "passo": n }` (n starts at 1, in the order of the
  `g.passo` calls) or `"fechamento"` (closing). All of them are optional, and each place has at most one line. A step
  without a line stays as always, by the minimum reading time.
- **Times** in seconds from the start of the file. `inicio_voz` is the first measured sound (10 ms RMS above
  −45 dBFS), and the 1st word never starts before it.
- **The words, joined by spaces, give exactly the `texto`**, with its punctuation. That's what lets the caption show
  the text and highlight word by word without getting lost.
- **What the engine checks** (and refuses, saying what):
  - `versao` 1;
  - unique `id` and valid `onde`, with no repeated place;
  - the file exists and is 48 kHz mono;
  - the words are in order, inside the audio, and match the text;
  - the opening line is the video's title, and the closing line is `fimLinhas` joined (ignoring case and
    punctuation). The screen shows one text; the voice can't say another;
  - no line is left over for a step the script doesn't have.

`voice.mjs validate <narration.json>` checks the same contract with no network.

## 3. Timing: first say it, then do it

The voice leads and the image follows: the recorder holds each step for as long as its line takes. If the image led,
the voice would have to rush or be cut.

Constants: `ENTRA` = 0.15 s and `ANTES` = 0.30 s. A line's useful span runs from the first sound to the end of the last
word.

| Where | Rule | Why |
|---|---|---|
| step with a line | the first sound lands `ENTRA` after the caption change | the viewer reads the new caption and hears it right after, not before |
| | `g.passo()` only gives control back 0.3 s before the end of the sentence | the step's first action starts when the sentence is already ending: first say it, then do it |
| | with `g.passo('…', { junto: true })`, control comes back at the first sound | a step with several taps: the line and the taps run together, and no silent video is left while the hand works |
| | the next step waits `max(leituraMin, ENTRA + useful span + 0.5)` | no line crosses a step change; half a second of breathing room is left |
| first step | the screen breathes 0.5 s before the first line | there's no change: the caption comes in with a fade, and with the `cortina` opening it is only whole at A + 0.65 s. Without the breathing room, the voice would start before the caption appears |
| opening with a line | first sound at 0.30 s; lasts `max(series opening, 0.30 + useful span + 0.40)` | a long title is not cut off by the screen |
| closing with a line | first sound 0.25 s after the start; lasts `max(series closing, 0.25 + useful span + 1.5)` | the logo stays still at least 1.5 s after the voice |

- **`g.na('word')` puts each tap on its word.** It waits until 0.6 s before the word is said (the time for the
  indicator to get there), counting from the step's first sound by the narration's timings. A word that isn't in the
  step's line is an error, already in `--check`; a repeated word takes the next occurrence. At the end, the recording
  warns about every stretch of more than 2.5 s without voice after a line
  (`warning: step 4: 8.7 s without voice after the line (4 taps)…`): use `junto` + `g.na`, or split the step.
- **`--check` doesn't wait for the voice.** It checks the taps in seconds. The timings only hold in the recording.
- **Changed the narration after recording?** The composition checks again, line by line, against the recorded steps.
  If it fits, it composes and warns. If any line would cross the next change, it refuses: record again.

## 4. The caption is the speech

- **The step's caption is the line's `texto`.** If the script's `g.passo('…')` says something else, the recorder warns
  and the line wins: the caption never says one thing while the voice says another.
- **The spoken word is highlighted**, one at a time, from its `ini` to its `fim`, in the lettering style the series'
  caption already has.
  - A short word ("a", "the", "and") stays highlighted at least 0.12 s, without going past the start of the next one.
    At 50 ms, it would blink in a single frame.
  - In the pauses between sentences, no word is highlighted.
- **The highlight color comes from the brand:** `MARCA.cores.acento` in `brand.js` (or `marca`, if there's no accent).
  It's never a fixed color.
  - If the color reads over the caption's background (at least 3:1), only the word's color changes.
  - If it doesn't (for example, a strip in the same color family), the highlight becomes a **marker pen**: background in
    the color, letters in the series' ink if it passes 4.5:1 there. Otherwise, the letters go in whichever contrasts
    most among the caption's background, white and near-black.
- **Only the color changes: the text doesn't move.** The measurement that shrinks a long caption and the collision and
  safe-area check still apply to the line's text.
- **It works in both designs:** series version 2 and the old design.

## 5. What comes out

On top of the usual, only when there's a voice:

| File | What it is |
|---|---|
| `output/<version>/comp/audio/voz.wav` | the voice track of the whole video: 48 kHz, mono, 16-bit, each line sample by sample in its place and silence outside |
| `<id>-<version>.srt` | external caption: one cue per line, from the first sound to the end of the last word, on the final video's timeline |
| `voz` block of `audio/sheet.json` | `{ arquivo: "voz.wav", trechos: [[start, end], …], perfil, falas: [{ id, t, texto }] }`, plus `loudness_lufs: -14` and `teto_dbtp: -1.0`. Whoever mixes the voice with the soundtrack reads it from here (`references/voice-mix.md`) |

- **`events.json`** gains `voz: { locucao, sha256, perfil }` (which narration was recorded). Each `passo` gains `fala`
  (the id), and `roteiro` when the script's text was different.
- **Composition summary line:** says how many lines, the profile and whether the opening or the closing grew. Example:
  `voice: 7 lines from voice/phone/narration.json, profile calmo · opening 2.40 s · closing 3.96 s (grew from 2.80 s
  for the voice)`.

## 6. Error messages and what to do

| Message (start) | What to do |
|---|---|
| `the narration of version computer is missing` | generate the voice for that version, or remove the version from `versoes` |
| `there is neither the narration (…) nor the voice script (…)` (in `--check`) | write that version's `script.json` before the `--check` |
| `… does not follow the narration contract` | the list below it says the field and the line. Usually the narration was edited by hand: generate it again |
| `the opening line (…) is not the video title` | change the title or the opening line, so they say the same |
| `the closing line (…) is not the closing text` | the same, with `fimLinhas` |
| `the narration has a line for step 6 (…), but the recording has 5 step(s)` | remove the line, or add the step to the script |
| `the recording of phone is from before the voice` | record again: the old recording didn't hold the steps by the line |
| `step 2's line (…) does not fit in the recorded step` | the narration changed after recording and got too long: record again |
| `g.na('word'): step 3's line does not have that word` | use a word that is in the step's line, or change the line |
| `… MARCA.cores.acento (or .marca) must be a hex` | put the color as a hex in the series' `brand.js` |
| `video.voz.perfil "…" does not exist` | use `'calmo'` or `'reels'` |

## 7. What has no voice yet

- **Templates that take narration:** `rolling-list`, `counting-number`, `typing-text`, `real-screen-camera`,
  `drawn-explainer`, `before-after` and `light-trail-teaser`, plus the tutorial (this file) and the chapter video
  (`references/chapters.md`).
- **Templates that don't take narration yet:** `card-bento`, `card-stack`, `chat-bubbles`, `drawn-flow`,
  `growing-chart`, `infinite-zoom`, `isometric`, `kinetic-typography`, `phone-3d`, `photo-mosaic`,
  `ticking-checklist`, `timeline` and `typing-terminal`. A video in one of these comes out with on-screen text,
  soundtrack and effects; if the person wants a voice, offer a style that takes it.
- **The engine's free motion mode** (`scenes.js`, a video without a template) has no scene timing guided by the voice
  and no spoken caption.
- **The opening title and the closing text** don't highlight words. The voice says the same text that's on screen, and
  it's already fully in view.
- **The mix** (the soundtrack going down under the voice, the final loudness) isn't the image engine's: it's in
  `references/voice-mix.md`.
