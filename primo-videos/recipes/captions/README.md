# Recipe: sound on taps (and, with voice, captions on screen)

One switch, **off by default**: without it the video comes out identical (byte-for-byte copy). With no voice there is
no separate caption track: the caption is the on-screen text, which the scenes already draw. **With voice**
(`references/voice-script.md`), a second switch comes back: the caption on screen, word by word, from the narration.
Both stay off by default, and with both off the video still comes out identical. Each switch comes up as a question
among the video's decisions, in the chat (`AskUserQuestion`, the recommended option first, with "(Recommended)"), after
the script is approved and before assembly.

| # | Question | Options (recommended first) | How to recommend |
|---|---|---|---|
| 1 | "Sounds on taps and screen changes?" | **Yes, subtle** · No | **Yes** when the video shows a screen with taps or screen changes and the soundtrack does not have those sounds yet; not in the tutorial, where the engine already adds them (Sounds, below). With voice, also not in a video that goes out with the voice only, with no soundtrack under it |
| 2 | With voice only: "Captions on screen, word by word?" | **Yes** · No | **Yes in 9:16** (Reels, TikTok and Shorts play without sound); in 16:9 for a site or YouTube, no, unless the owner asks. If the style already has a card with the line (tutorial), the caption repeats the text: recommend **no** and say why |

In the chat (`AskUserQuestion`), with the reason in the question: "A short sound on every tap and every screen change,
made on the spot, subtle under the music." Options: "Yes, subtle (Recommended)" and "No".

With voice, the caption is one more question, the same way: "People watching Reels and TikTok often watch without
sound. The caption appears word by word, in the brand's font and color." Options: "Yes" (9:16 above the bottom third,
16:9 in the free side column or at the bottom) and "No" (only the `.srt` the narration writes), with "(Recommended)" on
the one the table recommends.

## Run

```sh
node $SKILL/scripts/captions/caption.mjs --video final.mp4 --out final-com-sons.mp4 \
  --sounds --audio mix-sem-efeitos.wav --sheet <comp>/audio/sheet.json   # --cues cues.json if there is no sheet with cue points
  [--from 0 --to 15] [--report r.json]
node $SKILL/scripts/captions/sheet.mjs a.mp4 folha.png 1,3.3,6 8 270          # contact sheet: look at it before delivering
```

Needs Python with numpy and scipy (the one from `scripts/environment.mjs --fix`, found automatically; `--python`
forces another one).

With voice, the caption on screen:

```sh
node $SKILL/scripts/captions/caption.mjs --video final.mp4 --out final-captioned.mp4 \
  --captions --narration voice/<version>/narration.json --sheet <comp>/audio/sheet.json --series <series folder> \
  [--script voice/<version>/script.json]       # the pronunciation ("Veerta") never shows: the caption keeps "Vyrta"
  [--sounds --audio mix-sem-efeitos.wav]       # interface sounds over the mix; --cues cues.json if there is no sheet with cue points
  [--zone 0.3,0.667]                           # top and bottom of the allowed band, as a fraction of the height
  [--from 0 --to 15] [--report r.json]
node $SKILL/scripts/captions/check.mjs --on a.mp4 --base b.mp4 --report r.json --sheet <comp>/audio/sheet.json --voice <comp>/audio/voz.wav
node $SKILL/scripts/captions/sheet.mjs a.mp4 folha.png 1,3.3,6 8 270          # contact sheet: look at it before delivering
```

`--series` is the folder with `series.json` and `brand.js` (and `fonts/`). `check.mjs` compares the captioned video
(`--on`) with the same stretch without captions (`--base`: the input video or, for a `--from`/`--to` stretch,
`caption.mjs` with the same stretch and no switch), using the `--report` that `caption.mjs` wrote. The caption also
needs Playwright: it is drawn in the engine's Chromium and comes in as a layer with alpha, so it does not depend on an
ffmpeg built with libass or drawtext. `scripts/environment.mjs --fix` records Playwright and Python once in
`~/.videostudio/environment.json`.

## How the caption decides (with voice)

- **Time:** the words come from the narration (`narration.json`, each line's `palavras[]` with `ini`/`fim`) and the
  start of each line comes from the sync sheet (`audio/sheet.json`); the word appears at its `ini`, the earlier ones in
  the line stay, the current one goes in the brand's accent color.
- **The written word, never the spoken one:** the words in `narration.json` already carry the script's `texto`;
  `--script` brings the `pronuncia` map, so a spoken form that slipped through goes back to the written one
  (`references/voice-script.md` §4).
- **Lines:** up to 3 words and 22 letters, broken at punctuation and at pauses longer than 0.45 s, split evenly.
- **Font and color:** `series.json` (`fonteTitulo`, or `fonteTexto`) and `brand.js` (`cores.acento`, or `cores.marca`);
  the brand's dark outline instead of a plate (it covers only the letters). No font in the series: error.
- **Place:** per line, the band with the least detail (gradient) and **without the accent color** (the app's highlight
  and finger) in the video's own frames, inside the format's zone: 9:16 above the bottom third, inside the Reels safe
  column; 16:9 at the bottom, in the center or in the side column that is free. It only moves if the new place is
  almost 2× quieter, so it does not jump.
- **Tutorial with the step card at the top (9:16):** pass `--zone 0.3,0.667`; the card stays above the zone.
- **A short word does not blink:** a word that would stay less than 120 ms on screen ("a", "is" aligned at 20 ms)
  appears a little earlier, in the silence after the previous one; if that is not enough, the next one comes in up to
  60 ms later.
- **After the logo opening:** `scripts/opening.mjs` adds the logo before the video and records in the MP4 how many
  seconds it added (the `abertura_s` tag). `caption.mjs` reads it and adds it to the words and to the sounds from the
  sheet ("the video has the logo opening (+N s): the captions and the sounds move with it"): pass the narration and the
  sheet as they are, from before the opening. The `.srt` next to the video is shifted by `opening.mjs` itself.

## Sounds

`assets/audio/ui_sounds.py` uses `sounds.py` (all synthesized, nothing downloaded). Level relative to the mix
loudness: tap and click −9 dB, logo impact −9, flip −12, short whoosh −14; sounds less than 0.15 s apart come in at 60%.
After summing, the mix goes back to the base volume (at most 0.3 LU) and the peak stays at the sheet's ceiling. The
tutorial engine already adds these sounds to the soundtrack on its own (`folhaDoVideo`): do **not** turn on `--sounds`
over audio that already has them, or they double up. The layer is for the styles that ship with music only.

With voice, the transitions and the closing go down 6 dB while the voice speaks (the stretches come from the sheet's
`voz` block; taps, clicks and typing stay at their level), and the layer also serves the styles that ship with voice
and music.

## What fails it

`finalize.mjs` fails the volume (−14 LUFS ±1.5, true peak at the ceiling). And look at the contact sheet and ask for a
play: the measurement does not see what is ugly or hear the sound that feels heavy.

With voice, `check.mjs` exits with code 1 if: a word appears more than 80 ms from its time; the caption covers the
app's highlight or finger; the engine's `finalize.mjs` fails the volume (the sheet's loudness ±1.5, −14 LUFS by
default; true peak at the sheet's ceiling; the first sound of each line on time; the voice ≥ 15 dB above what plays
under it). And look at the contact sheet: the measurement does not see what is ugly.

## Studied, not copied

Only the idea, written our way. No code or text came from them.

| Repository | License | What came from it |
|---|---|---|
| `Upload-Post/avatar-mix` | MIT | captions in short lines (up to 3 words), breaking at punctuation and pauses, the active word in an accent color, a transparent layer on top of the video, no overlap between lines |
| `echris6/motion-video-kit` | MIT | sound only on real action (tap, change); short and with no bass; level measured against the music; sounds close together come in lower; repeated sounds sound alike; "what failed" (too much sound, heavy) |
| `op7418/guizang-product-video-skill` | AGPL-3.0 | the sound event as a single list of instants; measuring where the sound really lands and checking it against the event; the music yields to the sound. AGPL: **nothing** was copied or adapted |
