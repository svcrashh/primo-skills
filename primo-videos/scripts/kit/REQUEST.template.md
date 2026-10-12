# {{produto}} · the request

> {{pedido}}

Folder created by `kit new-video` from the {{produto}} kit ({{kit}}): the series `{{serie}}`, the recording base
(`recording/base.mjs`: sign in, language, tours, write barrier, sample data) and the soundtrack seed are already
wired up.
The stopwatch started now (`progress.json`). Target: **the preview in 10 min**.

## The fast path (each step with the progress line)

The commands below are ready to paste (zsh or bash), from inside the folder: `cd {{pasta}}`.

1. **The script.** The base thesis is in `thesis.md` (adjust the proof scene if the request changed). `node {{skill}}/scripts/progress.mjs now {{pasta}} script`.
   Write the texts in `texts.json` (ids `abertura`, `p1`…`pN`, `fechamento`; the opening is the title on screen, the closing
   is the end text). `node {{skill}}/scripts/progress.mjs done {{pasta}} script`.
2. **Ask the owner only if something that is wrong would throw the preview away.** Everything else is an assumption in one line.
3. **The journey** in `recording/journey.mjs` (`node {{skill}}/scripts/progress.mjs now {{pasta}} recording`).
4. **The --check:** `node video.mjs --check` until it comes out ✓ (it finds, in one go, everything compor would refuse).
5. **Record:** `node video.mjs` (0 escapes at the barrier). `node {{skill}}/scripts/progress.mjs done {{pasta}} recording --note "recorded"`.
6. **The draft:** `node {{skill}}/scripts/progress.mjs now {{pasta}} draft`; `node {{skill}}/scripts/tutorial/compose.mjs . --mode draft`; open the MP4 and
   the contact sheet. `node {{skill}}/scripts/progress.mjs done {{pasta}} draft --note "preview ready"` — **the preview goes to the owner now**.
7. **The refine runs alongside, not before:** `node {{skill}}/scripts/progress.mjs now {{pasta}} refine`; `node {{skill}}/scripts/refine.mjs . --channel <channel>` in
   the background; the warnings go with the preview, and only the final waits for it to pass.
8. `node {{skill}}/scripts/progress.mjs report {{pasta}}` — where the time went.

The before from a previous version (optional): `references/kit.md`, "The before (optional)".
