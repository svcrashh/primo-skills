# Recipe: sound on taps

One switch, **off by default**: without it the video comes out identical (byte-for-byte copy). With no voice there is
no separate caption track: the caption is the on-screen text, which the scenes already draw. The switch comes up as a
question among the video's decisions, in the chat (`AskUserQuestion`, the recommended option first, with
"(Recommended)"), after the script is approved and before assembly.

| # | Question | Options (recommended first) | How to recommend |
|---|---|---|---|
| 1 | "Sounds on taps and screen changes?" | **Yes, subtle** · No | **Yes** when the video shows a screen with taps or screen changes and the soundtrack does not have those sounds yet; not in the tutorial, where the engine already adds them (Sounds, below) |

In the chat (`AskUserQuestion`), with the reason in the question: "A short sound on every tap and every screen change,
made on the spot, subtle under the music." Options: "Yes, subtle (Recommended)" and "No".

## Run

```sh
node $SKILL/scripts/captions/caption.mjs --video final.mp4 --out final-com-sons.mp4 \
  --sounds --audio mix-sem-efeitos.wav --sheet <comp>/audio/sheet.json   # --cues cues.json if there is no sheet with cue points
  [--from 0 --to 15] [--report r.json]
node $SKILL/scripts/captions/sheet.mjs a.mp4 folha.png 1,3.3,6 8 270          # contact sheet: look at it before delivering
```

Needs Python with numpy and scipy (the one from `scripts/environment.mjs --fix`, found automatically; `--python`
forces another one).

## Sounds

`assets/audio/ui_sounds.py` uses `sounds.py` (all synthesized, nothing downloaded). Level relative to the mix
loudness: tap and click −9 dB, logo impact −9, flip −12, short whoosh −14; sounds less than 0.15 s apart come in at 60%.
After summing, the mix goes back to the base volume (at most 0.3 LU) and the peak stays at the sheet's ceiling. The
tutorial engine already adds these sounds to the soundtrack on its own (`folhaDoVideo`): do **not** turn on `--sounds`
over audio that already has them, or they double up. The layer is for the styles that ship with music only.

## What fails it

`finalize.mjs` fails the volume (−14 LUFS ±1.5, true peak at the ceiling). And look at the contact sheet and ask for a
play: the measurement does not see what is ugly or hear the sound that feels heavy.

## Studied, not copied

Only the idea, written our way. No code or text came from them.

| Repository | License | What came from it |
|---|---|---|
| `Upload-Post/avatar-mix` | MIT | captions in short lines (up to 3 words), breaking at punctuation and pauses, the active word in an accent color, a transparent layer on top of the video, no overlap between lines |
| `echris6/motion-video-kit` | MIT | sound only on real action (tap, change); short and with no bass; level measured against the music; sounds close together come in lower; repeated sounds sound alike; "what failed" (too much sound, heavy) |
| `op7418/guizang-product-video-skill` | AGPL-3.0 | the sound event as a single list of instants; measuring where the sound really lands and checking it against the event; the music yields to the sound. AGPL: **nothing** was copied or adapted |
