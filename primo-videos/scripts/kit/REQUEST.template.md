# {{produto}} · the request

> {{pedido}}

Folder created by `kit new-video` from the {{produto}} kit ({{kit}}): the series `{{serie}}`, the recording base
(`recording/base.mjs`: sign in, language, tours, write barrier, sample data) and the soundtrack seed are already
wired up.
The stopwatch started now (`progress.json`). Target: **the preview in 10 min**.

<!-- se !voz -->
**Without voice:** on-screen text, soundtrack and effects tell it, and the texts live in `texts.json`.
<!-- se voz-do-kit -->
The kit holds an approved voice ({{voz}}), left out because a video only has a voiceover when it asks for one. If the
owner wants it in this video, create the folder again with `--voice` (a new folder, the same request).
<!-- fim -->
<!-- fim -->
<!-- se voz -->
**With a voiceover:** the lines live in `voice/v1/script.json` (there is no `texts.json`), the caption is the speech,
and `video.mjs` reads the voice from `voice/v1/narration.json`, which `voice.mjs generate` writes.
<!-- se voz-do-kit -->
The voice is the kit's approved one, {{voz}}, already in the script with its settings and pronunciation, and {{takes}}
approved take(s) came along in `voice/_takes/` (a line already paid for, with the same voice and neighbors, costs 0).
<!-- fim -->
<!-- se !voz-do-kit -->
The kit has no approved voice yet: the script has no `voz`, and `generate` refuses it until the owner picks one by ear
(step 2).
<!-- fim -->
<!-- fim -->

## The fast path (each step with the progress line)

The commands below are ready to paste (zsh or bash), from inside the folder: `cd {{pasta}}`.

1. **The script.** The base thesis is in `thesis.md` (adjust the proof scene if the request changed). `node {{skill}}/scripts/progress.mjs now {{pasta}} script`.
<!-- se !voz -->
   Write the texts in `texts.json` (ids `abertura`, `p1`…`pN`, `fechamento`; the opening is the title on screen, the closing
   is the end text). `node {{skill}}/scripts/progress.mjs done {{pasta}} script`.
2. **Ask the owner only if something that is wrong would throw the preview away.** Everything else is an assumption in one line.
3. **The journey** in `recording/journey.mjs` (`node {{skill}}/scripts/progress.mjs now {{pasta}} recording`).
4. **The --check:** `node video.mjs --check` until it comes out ✓ (it finds, in one go, everything compor would refuse).
5. **Record:** `node video.mjs` (0 escapes at the barrier). `node {{skill}}/scripts/progress.mjs done {{pasta}} recording --note "recorded"`.
<!-- fim -->
<!-- se voz -->
   Write the lines in `voice/v1/script.json`, not in `texts.json` (ids `abertura`, `p1`…`pN`, `fechamento`; the opening is the
   title on screen, the closing is the end text, and each step's line is its caption: `{{skill}}/references/voice-script.md`).
   `node {{skill}}/scripts/voice.mjs review {{pasta}}/voice/v1/script.json --seconds <s>` until it exits with 0 errors (free, no network).
2. **The one question to the owner: the script, approved in a table** (each line, the estimated seconds and credits, the
   voice, and what this video can still spend). Nothing is generated before the yes; everything else is an assumption in one line.
<!-- se voz-do-kit -->
   The voice goes in the table already proposed: the kit's, {{voz}}.
<!-- fim -->
<!-- se !voz-do-kit -->
   Then the voice, by ear (`{{skill}}/references/voice-choice.md`): `node {{skill}}/scripts/voice.mjs search` (free), then
   `node {{skill}}/scripts/voice.mjs samples --script {{pasta}}/voice/v1/script.json --voices <id1,id2,id3>` (paid: the
   first approved line's characters × 3); the one the owner picks goes in `voz` in the script (`id`, `nome`).
<!-- fim -->
   `node {{skill}}/scripts/progress.mjs done {{pasta}} script`.
3. **The journey** in `recording/journey.mjs` (`node {{skill}}/scripts/progress.mjs now {{pasta}} recording`). **The voice in
   parallel** (`node {{skill}}/scripts/progress.mjs now {{pasta}} voice`): `node {{skill}}/scripts/voice.mjs account` (free), then
   `node {{skill}}/scripts/voice.mjs generate {{pasta}}/voice/v1/script.json --out {{pasta}}/voice/v1`, saying the cost it
   prints. `node {{skill}}/scripts/progress.mjs done {{pasta}} voice`.
4. **The --check:** `node video.mjs --check` until it comes out ✓ (it finds, in one go, everything compor would refuse; before
   the voice exists it reads the lines from the script, so a wrong `g.na` word shows up before a single credit is spent).
5. **Record, after `generate`:** `node video.mjs` (0 escapes at the barrier; the recorder holds each step for as long as its
   line). `node {{skill}}/scripts/progress.mjs done {{pasta}} recording --note "recorded"`.
<!-- fim -->
6. **The draft:** `node {{skill}}/scripts/progress.mjs now {{pasta}} draft`; `node {{skill}}/scripts/tutorial/compose.mjs . --mode draft`; open the MP4 and
   the contact sheet. `node {{skill}}/scripts/progress.mjs done {{pasta}} draft --note "preview ready"` — **the preview goes to the owner now**.
7. **The refine runs alongside, not before:** `node {{skill}}/scripts/progress.mjs now {{pasta}} refine`; `node {{skill}}/scripts/refine.mjs . --channel <channel>` in
   the background; the warnings go with the preview, and only the final waits for it to pass.
8. `node {{skill}}/scripts/progress.mjs report {{pasta}}` — where the time went.

The before from a previous version (optional): `references/kit.md`, "The before (optional)".
