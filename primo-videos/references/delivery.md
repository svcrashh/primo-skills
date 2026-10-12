# Render, verification and delivery

## Reference times (Mac M-series, 8 workers)

| Stage | 8 s | 40 s |
|---|---|---|
| Single frames (16) | ~10 s | ~10 s |
| Draft (30 fps, no blur) | ~5 s | ~30 s |
| Final (60 fps, 8 subframes) | ~80 s | ~6–7 min per format |
| Soundtrack (arranjo.py) | seconds | seconds |

Run the final render in the background (`run_in_background`) and work on something else, or say that it is running. With two formats, run one after the other: in parallel, both compete for CPU and get slower.

## Disk

The render streams to ffmpeg and does not write frames, so it needs little space. The previews (`previas/`) grow: delete the old ones. If `environment.mjs` warns about low disk, do not use a high `--sub`.

## Open it for the user to see

| System | File | Live preview |
|---|---|---|
| macOS | `open arquivo.mp4` | `open -a "Google Chrome" "file://…/index.html?play"` (or the default browser) |
| Windows | `start "" arquivo.mp4` | `start chrome "file:///C:/…/index.html?play"` |
| Linux | `xdg-open arquivo.mp4` | `xdg-open "file://…/index.html?play"` |

In a remote session, with no screen, just give the path.

## Delivery verification (`finalize.mjs`)

The script exits with code 1 if anything fails, and then you do not deliver. It checks:

- resolution and fps;
- video duration = audio duration = `VIDEO.duracao`, with a tolerance of one frame;
- loudness close to the target (-14 LUFS, the standard for social media and streaming) and true peak ≤ -0.5 dBTP;
- that every silence in `sheet.json` is still silent in the MP4 and that the sound comes back right after. This is the proof that the sync survived AAC.

With voice (a sheet with a `voz` block), it also checks, on the AAC: the true peak against the sheet's ceiling, each
line's 1st sound within ±1 frame of the sheet, and the voice at least 15 dB above what plays under it
(`references/voice-mix.md` §6). Then `voice.mjs listen --mix` on the final MP4 of each format, if the person agrees to
the few credits it costs: it is the only check that hears whether the mix ate a word.

On your own, also:

- extract 6–10 frames from the **final MP4** (`ffmpeg -ss T -i final.mp4 -frames:v 1 x.png`) at the moments of fast motion and look at the motion blur;
- open the poster.

## Delivery folder

Default: `~/Desktop/<brand>-video/`. On Windows, the user's Desktop. Use another place if they ask.

```
<brand>-video/
  <brand>-<name>-16x9.mp4
  <brand>-<name>-16x9-poster.png
  <brand>-<name>-9x16.mp4
  <brand>-<name>-9x16-poster.png
  README.md          ← formats, script (table), how to redo it, what is fictional, the sample account and where
                       the numbers came from
  reading.md         ← the project reading: why the video is the way it is
  fonte/             ← the whole project, without out/ and previas/ (and without audio/.venv)
```

With voice, also:

- **next to each MP4, its `.srt`** (`<brand>-<name>-16x9.srt`): the speech as a caption file, for the platforms that
  take one. The chapter assembly with `--deliver` copies it on its own; the tutorial's `compose.mjs` writes
  `<id>-<device>.srt` in the video folder, to be copied. `opening.mjs` moves the `.srt` next to the video along with
  the logo opening.
- **in the README, the voice:** `voice_id`, name, model, settings (`speed`, `stability`…) and the pronunciation map. The
  ElevenLabs history belongs to the account: on another machine, nobody finds the voice without this.
- **in `fonte/`, the whole `voice/` folder,** `_takes/` included: the takes are the source of the sound, and a line that
  didn't change is not paid for again (`references/voice-script.md` §7).

Do not create anything inside a git repository unless the user asks, and do not commit.

## What to say at the end

- Where each file is and the format of each one.
- What was verified, with the measured numbers (duration, LUFS, true peak, sync).
- What you could not verify: you do not watch or listen, so ask for a play, preferably on the device where the video will run.
- Assumptions made (fictional names, provisional identity, synthesized music) and what the reading marked as a guess or left as a question.
- With voice or generated images: what the video spent against its cap (`node $SKILL/scripts/costs.mjs show <project>`).
- 1 or 2 extras worth doing:
  - **15 s cut:** the same soundtrack shortened, hook and sign-off.
  - **Another format.**
  - **Preview GIF:** `ffmpeg -i v.mp4 -vf "fps=15,scale=720:-1:flags=lanczos,palettegen" p.png` and then `paletteuse`.
  - **3 s logo sting:** reuses the sign-off scene.
  - **Private page to share the video:** if the Artifact tool exists.
