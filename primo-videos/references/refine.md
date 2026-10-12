# Automatic refinement check

Everything we used to catch by hand before showing a video, in a single gate. **It runs before showing any draft
or final, and the video only goes to the user when it passes.** A script's ✓ doesn't replace looking at the contact sheet (rule 3 of the
workflow): the refinement check finds what can be measured; the sheet, looked at, finds the rest.

## Contents
1. Running it
2. The checks
3. Fixing until it passes
4. Reference profile per product
5. What the refinement check doesn't do
6. Direction: is the video dull?

---

## 1. Running it

```sh
node $SKILL/scripts/refine.mjs <video folder> [--format 9x16] [--product "Name"] [--channel whatsapp]
node $SKILL/scripts/refine.mjs <video.mp4> [--project <video folder>] [--product "Name"] [--player 390] --out <folder>
```

- **In the video folder** it finds by itself the scenes (`scenes/NN-*`), the assembly (`out/assembly.json`) and the most
  advanced MP4 of each format in `out/` (final > assembled). `--video` and `--format` pick by hand.
  - **With voice** (opt-in and paid: `references/voice-script.md`), it also finds the narration: the only
    `voice/<version>/narration.json` in the folder, or the one the scenes' `tempos.js` used. `--narration
    voice/<version>/narration.json` picks by hand. More than one narration and no scene pointing to one (a tutorial
    with two versions): it stops with code 2 and asks for `--narration`. The refine itself calls no API and costs
    nothing.
- **MP4 only** runs the video checks (legibility, reading in the player, frozen, empty, safe area). With `--project`, also the
  page checks in Chromium (font and DOM boxes).
  - With voice, `--project` also measures the narration and the animation on the word, without fixing anything: a run
    on an MP4 never rewrites the narration.
- **In the drawn explainer's work folder** (`<output>/.work-<name>/`, a canvas) it finds the MP4 with sound in the folder
  above (the newest between `<name>-<format>.mp4` and the `-draft` one), the formats and the platform of the work
  (`out/assembly.json`, `params.js`) and skips the pages, which can't see the canvas (the template's `render.mjs`
  already checked the text).
  With voice, it measures the build's narration (`voice/obra/narration.json`, the excerpt of each scene) without fixing
  it: it's a copy the render cuts from the video's narration (`voz.locucao` in `video.json`). A fix goes in that one,
  and the build is rendered again.
- **Output** goes to `<folder>/refine/` (or `<video>.refine/`): `refine.md` (to read), `refine.json` (for scripts) and
  `frames/` with the frame of each problem, the box marked in red. Open the frames with the image-reading
  tool before fixing: they tell you where to look.
- **Exit code 1 = failed.** Each error says what to do. Exit code 2 = it couldn't run (the error says why).
- **It only checks:** without voice, there's nothing it fixes by itself. Each fix is yours, in the scene or in the kit.
- **With voice, it fixes what is automatic:** the voice alignment (each word's start by the measured pauses) and the
  silence left over at the end of each take. It rewrites `narration.json` and trims the WAVs in `lines/`, keeping the
  originals first in `narration.before-refine.json` and `lines/_before-refine/` (only once: a later run doesn't
  overwrite them). The terminal says `fixed: …` and `refine.md` gains a "Fixed automatically" section. `--check-only`
  measures without touching the narration or the takes: use it when the folder isn't yours (with `--out <folder>`,
  not even the report goes into it). Everything else is still yours.
- **Where the video plays:** `--channel whatsapp|reels|feed|site|big-screen` (the names from `recommend-style.mjs`) or
  `--player <width in px>` (overrides `--channel`) turn on the reading in the player (section 2, "Reading in the player").
  Without either of them, it doesn't run and the summary says so: always pass the briefing's channel.
- Options: `--platform tiktok` (otherwise it comes from `VIDEO.plataforma`), `--fonts "A,B"` (the kit; otherwise it
  comes from the reference profile or from `VIDEO.fontes`), `--no-pages` (skips Chromium), `--no-ocr`, `--no-direction`
  (skips section 6).
- Takes ~1 min for a 30 s video (OCR at 2 frames per second, the pages every 0.5 s).

## 2. The checks

Each row is a defect that already shipped in a delivered video.

| Problem that already happened | Check (`checagem` in the JSON) | Fails when |
|---|---|---|
| Botched screenshot, shrunken screen | **Legibility** (`legibilidade`): Vision OCR (macOS) at 2 frames/s; the height of each line, normalized to a short side of 1080 | a line under 16 px; or 6+ lines under 28 px in the same frame (the whole screen shrunk). A line between 16 and 28 px is a warning. All caps counts 1.2× (Vision measures the capital's height) |
| Text that passes in the file and vanishes on the phone (a 1920 16:9 playing in a 390 px player) | **Reading in the player** (`player`): the same OCR, with each line at the size it ends up after the player shrinks the video, `altura × min(1, player ÷ largura)`. Only runs with `--channel` or `--player` | a line under 16 px in the player. 6+ such lines in the same frame become a single finding (the whole screen); for up to 2.6 s in a row it's the wide shot, a warning. No warning band above 16 px |
| "The logo's font changed" | **Font** (`fonte`): in Chromium, the computed font of each visible text (HTML and SVG `<text>`), every 0.5 s | a family outside the brand kit; a kit family that fell back to the fallback (the width measurement matches the fallback font); synthesized italic or bold (the kit doesn't have that face) |
| Frozen frame | **Frozen** (`parado`): ffmpeg's `freezedetect` (n = 0.001, on a 270 px copy: grain and a slow glow don't count as motion) | nothing moves for more than 0.6 s, except the end card (which has to stay still ≥ 1.2 s, otherwise a warning) |
| Empty frame | **Empty** (`vazio`): edges per 36 px cell, 10 times per second (a background with grid and glow counts as empty) | less than 1.5% of the safe area occupied for more than 0.3 s; the top or bottom half with less than 2% for more than 1 s is a warning |
| Stuff under TikTok's interface | **Safe area** (`area-segura`): in Chromium, the box of **every** element that paints (text, image, SVG, box with a background); in the MP4, the OCR text and the content in the zones | something still with content intrudes on the interface zones (top y < 220, bottom y > 1500, buttons x > 940 between y 900 and 1650, in 9:16); text outside x 70–940, y 250–1450 (just a glimpse, < 1 s, or faded, is a warning). The marked frame is the one from the worst moment |

The thresholds came from the delivered videos that had these defects. The tests (`tests/refine-*.test.mjs`) rebuild
each case.

With voice there are four more rows ("With voice: the voice checks", at the end of this section). In a video without
voice they show in the report as "did not run" (three of them with the note "video without voiceover") and count for
nothing.

### Reading in the player

Legibility measures the type in the file, with the short side at 1080. But the video plays shrunk: on an upright phone the
player is ~390 px wide, and a 1920 16:9 fits into those 390. A 40 px line, comfortable in the file, ends up
at 8 px on the screen. The reading in the player measures each line at that size:

```
px_no_player = altura × min(1, player ÷ largura)          precisa = ceil(16 × largura ÷ player)
```

`altura` (height) and `largura` (width) are those of the normalized video (the short side at 1080, as in legibility): width 1920 in 16:9,
1080 in 9:16, in 1:1 and in 4:5. `precisa` (needs) is how big the line has to be in the video to reach 16 px in the player.

| Where it plays (`--channel`) | Player | 16:9 needs | 9:16, 1:1 and 4:5 need |
|---|---|---|---|
| `whatsapp`, `reels` (the upright phone) | 390 px | 79 px | 45 px |
| `feed` | 854 px | 36 px | 21 px |
| `site`, `big-screen` | no reduction: the check doesn't run (legibility already measures the full size) | — | — |

- **`--player <px>` overrides `--channel`:** `--player 412` measures on a large Android phone. The refinement summary (in the terminal and
  in `refine.md`) says which player it used and where it came from (`player: 390 px (--channel whatsapp)`), how big the line needs
  to be in each video and how many frames with text fell below. In `refine.json`: `player` (the player and its origin),
  `checagens.player` and the findings with `checagem: "player"`, separate from those of `legibilidade`; each video's
  measurements in `medidas.videos[].player`.
- **Why 16 px:** it's the benchmark of the drawn explainer's engine (`templates/drawn-explainer/scene/engine/readability.js`:
  under 16 px in the player is a problem) and the body size of running text on the web and on phones. Below that it's fine print: you can only read it by pausing and leaning in, and whoever
  watches on WhatsApp or Reels doesn't pause.
- **No warning band.** At full resolution, 16–28 px is a warning because 28 px is the comfortable size with the video filling the
  screen. In the player the measurement is already the real size on the screen, and 16 px is already reading text. A 16–28 band in the player
  would be noise: a 16:9 at 390 would need 138 px in the video to reach 28 (only titles pass), and a warning that shows up in
  every video teaches people not to read warnings. Either it reaches 16, or it fails.
- **What counts the same as in legibility:** the reference profile's `texto_excecoes` (above 16 px at full resolution; below
  that, legibility already fails it), the tutorial's decorative opening with cinema mode, a line seen in only one sample and not
  confirmed half a step before and after (the title that grows on its entrance, caught mid-animation), which becomes a warning, and
  the short wide shot: 6+ small lines in the same frame for up to 2.6 s in a row, before the zoom, is a warning. A lone line
  is an error even if brief: in 16:9 on a phone, the 2 s zoom on the field is still tiny, and it's there to be read.

**What to do when it fails.** The message says how many px the line has in the video, how many it ends up with in the player and how many it
needs, and picks its sentence according to the situation:

- **Few lines:** "Make the text ≥ 79 px in the video (it reaches 16 px in a 390 px player), or take this text out of
  the frame." A label that isn't meant to be read (the interface text inside the mock phone, the logo in the scenery) goes into
  `texto_excecoes`, with the why.
- **Many small lines in the same frame** (6+: the whole screen shown): "Aproxime a câmera do campo da vez" (move the
  camera in on the current field): the whole screen doesn't fit legibly on a phone; show less, and larger.
- **16:9 in an upright-phone player** (up to 480 px) **with a third or more of the frames with text failing:** the
  sentence gains "Esse 16:9 no celular em pé fica ilegível: faça o 9:16." (this 16:9 is unreadable on an upright phone:
  make the 9:16). It can't be fixed line by line: 79 px is title size.

The marked frame (`frames/player-*.png`) shows each line in red, as in legibility.

**Calibration.** A synthetic 16:9 with two 40 px lines in Helvetica passes legibility and
fails in the 390 player (39–45 px in the video, 7.9–9.1 px in the player); at 96–120 px, it passes. All the examples of the
templates and of the chapters fail at 390: the 16:9 ones with 91% to 100% of frames with text below (and the 9:16 sentence); the
9:16 ones with 36% to 100%, on 22–43 px labels (all-caps overlines, the press kit interface, the closing's
address). Three approved sales Reels too (72% to 88% of frames): overlines and numbers at
22–40 px (8–14 px in the player), the price footer and the whole app screen (which legibility already catches). The benchmark is
stricter than the approved videos: in a 9:16 for the phone, text meant to be read starts at 45 px.

### With voice: the voice checks

Only when the video has a narration (`voice/<version>/narration.json`). The report names them "Voice alignment",
"Animation on the word", "Flat voice" and "Leftover silence".

| Problem that already happened | Check (`checagem` in the JSON) | Fails when |
|---|---|---|
| Animation before the word | **Voice alignment** (`alinhamento`): the real pauses of each take (below −38 dBFS for ≥ 0.1 s); a word born inside a pause starts at its end, and the last word ends at the last sound | it doesn't fail: it's fixed in `narration.json`. A word moved 0.08 s or more is a warning that names it; the error shows up in "Animation on the word" if a scene lights up early |
| `em('nine')` catching "ninety" | **Animation on the word** (`palavra`): each literal `em('word', n)` and `ate(…)` of the scene's `scene.js`, evaluated with that scene's own `tempos.js`, against the instant the **exact** word is heard (in the narration already fixed by the alignment) | it lights up ≥ 0.08 s before the word; the word isn't in the line. A call that only finds the word by its prefix is a warning |
| Flat voice ("a corpse talking") | **Flat voice** (`voz-apagada`): the pitch range (p90−p10 of f0, in semitones) and the energy range (p90−p10 of the RMS, in dB), median of the lines | against the approved voice of the reference profile (section 4), the mean of the two ratios below 0.8 (below 0.9, a warning). Without one, only with the `reels` profile (the `perfil` of the `script.json` next to the narration; without that file, a reels/tiktok/shorts platform): below the floor on both (8 st and 17.5 dB), on one only a warning. With `calmo` and no approved voice it doesn't run ("no baseline"). A line under 70% of the pitch and 80% of the energy of the benchmark is a warning: redo only that one |
| A line with silence left over at the end | **Leftover silence** (`silencio-fim`): the last sound of each take; the end of each scene against its last word | the take has more than 0.3 s after the last sound (it's trimmed at the last sound + 0.12 s); the scene goes on more than 1.3 s after the last word (3.0 s in the closing, `99-…`; the rules `respiro_max` and `fecho_respiro_max`) is a warning, and more than 0.7 s past that limit, an error |

The thresholds came from real cases: with −38 dBFS, the end of each pause fell within ±5 ms of where the voice comes
back, on the words a series of videos had corrected by ear (up to 0.74 s early); the lively voice approved for Reels
measures ~10 st and ~20 dB, and the calm tutorial voice, turned down in Reels, ~6.7 st and ~16 dB. The tests
(`tests/refine-voice.test.mjs`, `tests/refine-narration.test.mjs`) rebuild each case with synthetic speech (and, on the
Mac, real speech from `say`), no network. In `refine.json`, what it fixed is in `correcoes`, and the measurements in
`medidas.voz` and `medidas.cenas`.

### em() on the exact word

The scenes' `tempos.js` comes from `scripts/chapters/tempos.mjs` (`node $SKILL/scripts/chapters/tempos.mjs <folder>
--narration voice/v1/narration.json --speech-at 1.4`). `em('nine')` finds the word equal to "nine", without accent,
case or punctuation: "nine!" yes, "ninety" no. Also valid: `em('acme')` for "acme.app!" (the piece before the dot),
`em('forty two')` (the sequence) and `em('nine', 2)` (the second time). A word that isn't in the line goes to the page
console (`WORD "…" (time 1) IS NOT IN LINE <id>: …`) and the scene's render exits with code 3.

## 3. Fixing until it passes

1. `refine.mjs <folder>`: lists what failed and the warnings.
2. Open `refine/refine.md`: each error says what to do and points to the marked frame.
3. For each error, open the marked frame and fix it in the scene (or in the kit, if the defect is in all of them).
4. Run it again. Repeat until **PASSED**. A warning doesn't fail, but read each one: a warning that's a defect, fix it; a warning that's
   on purpose (the price-source footer at 22 px), put it in the reference profile (`texto_excecoes`) so it doesn't come back.
5. Only then the contact sheet, looked at, and the draft (or the final) for the user. In the report to the user, say that the
   refinement check passed and how many warnings remained, and why.

**With voice,** steps 1 and 2 are these; 3 to 5 stay the same:

1. `refine.mjs <folder>`: fixes the narration by itself and lists the rest. On this first run "Animation on the word"
   can still fail: the scenes still have the old times.
2. Fixed the narration? In a chapter video, `node $SKILL/scripts/chapters/tempos.mjs <folder> --narration
   voice/<version>/narration.json`, render the scenes again (a draft is enough for the refine) and assemble again
   (`references/chapters.md`). In another style with voice, render it again (the tutorial: compose again,
   `references/voice-tutorial.md`), so it reads the fixed narration. Then run the refine again.

- **The refine doesn't fix a flat voice:** that's a new take, of the line (`voice.mjs generate … --redo <id>`) or of
  the whole script with a livelier read (`references/voice-choice.md` §7). It's a paid call: it checks the video's cap
  before calling and goes into the cost notebook (`references/voice-choice.md` §12); after it, update the board's
  `costs` (`recipes/board.md`). Let the person listen to it next to the old one before assembling.

## 4. Reference profile per product

The brand kit and each product's approved videos, saved as a reference: the next video starts from them and the refinement check
measures against them (the kit's fonts become the font benchmark; the rules, the thresholds; with voice, the approved
voice becomes the flat voice's benchmark).

```sh
node $SKILL/scripts/refine.mjs profile "<Product>" --from <approved video folder> --video <delivered mp4> --approved
node $SKILL/scripts/refine.mjs <next video folder> --product "<Product>"
```

It lives in `~/Documents/VideoStudio/Brands/<product>/profile/` (the name in lowercase, without accents, with hyphens),
in the brand's data folder, next to its kit and its variety history. `VIDEOSTUDIO_BRANDS` changes the root;
`VIDEOSTUDIO_PROFILES` changes only where the profiles go (`$VIDEOSTUDIO_PROFILES/<product>/`):

```
profile.json
kit/                      copy of the approved video's template/ (kit.js, fonts/, brand pieces), without engine.js
aprovados/<name>-sheet.jpg   the contact sheet of each approved video
```

`profile.json` (version 1):

```json
{
 "versao": 1,
 "produto": "My Product",
 "atualizado": "2026-10-02",
 "marca": { "fontes": ["Inter"], "fontes_extras": ["Helvetica Neue"],
            "sintetico_ok": [], "kit": "kit/", "origem": "<video folder>" },
 "plataforma": "tiktok",
 "formatos": ["9x16"],
 "regras": { "parado_max": 0.6, "final_parado_min": 1.2, "texto_min_px": 28, "texto_ilegivel_px": 16,
             "texto_excecoes": ["^myproduct\\.com$"], "respiro_max": 1.3, "fecho_respiro_max": 3.0 },
 "aprovados": [ { "titulo": "…", "video": "<mp4>", "projeto": "<folder>", "folha": "aprovados/<name>-sheet.jpg",
                  "estilo": "chapters-with-index", "data": "2026-10-02", "duracao": 34.3, "largura": 1080, "altura": 1920 } ]
}
```

- Every key is optional, except `versao` and `produto`. `regras` only stores what differs from the default (the values above are the
  default). `texto_excecoes` are regular expressions matched against the OCR text; they apply to legibility and to text outside the
  safe area (a small logo in the background scenery isn't text to read: `--rule "texto_excecoes=^Brand$"`).
- **With voice,** `voz` only exists after a `profile … --approved` on a video with narration (`--narration
  voice/<version>/narration.json` when the folder has more than one): who the voice is and how much it moves,
  `"voz": { "nome": "…", "id": "…", "modelo": "eleven_v3", "ajustes": { "stability": 0 }, "tom": 10.2, "energia": 21.2,
  "nivel": -15.6, "f0": 271, "fonte": "…", "locucao": "<path>" }`. `tom` and `energia` are the flat voice's benchmark;
  without `voz`, the flat voice uses the Reels floor, and only with the `reels` profile (section 2, "With voice: the
  voice checks").
- `fontes_extras` (`--extra-fonts`): a font from outside the brand used on purpose, like the generic font on the
  competitor's side in a comparison. `sintetico_ok` (`--synthetic "Family:italico"` or `:negrito`): the style the
  product itself synthesizes. Only with proof: the family has no italic face and the product's own site imports only the regular one and asks for
  italic, so the browser slants it there too. Without that in the reference profile, synthesized italic is an error: it's the "the logo's
  font changed" case when the face exists and didn't load.
- In a regular run, `--rule key=value` applies only to that run, on top of the reference profile (a one-video exception,
  without touching the product's benchmark). In `profile`, it gets saved.
- `--rule key=value` changes a rule (`--rule parado_max=0.8`; `texto_excecoes` separates with `|`). `--fonts`,
  `--platform`, `--title` and `--style` (the skill's style id) complete it.

## 5. What the refinement check doesn't do

- **It doesn't listen or watch.** Is the soundtrack pleasing? Do the effects land well? Does the motion have taste? That's still up to the user's
  ear and to the contact sheet, looked at.
- **With voice, it doesn't listen to the voice either.** Does the voice fit the brand? The intonation of the questions?
  Breaths and mouth clicks? Does the soundtrack work under the voice? By ear: `references/voice-mix.md` §8 lists what to
  tell the user. Whether each word is understood, alone and after the mix, is `voice.mjs listen` and `listen --mix`
  (`references/voice-mix.md` §6), paid calls.
- **OCR only on macOS** (Vision, compiled the first time with the machine's `swiftc`). On another machine, legibility
  becomes a "não rodou" (did not run) warning, the reading in the player is "não rodou" and the other checks carry on.
- **Font and DOM boxes need Playwright** (the same one the render uses). Without it, those two become "não rodou".
- **With voice, the scene check reads literal calls** (`em('word', n)`). An `em(variable)` isn't evaluated: write the
  word.

## 6. Direction: is the video dull?

The refinement check catches defects; direction catches the defect-free video that nobody watches to the end: the tutorial that passes the refinement check
but uses no 3D, motion or transitions. It runs together with the refinement check (the top of `refine.md` shows **DIRECTION: weak|ok|strong**
(direction: weak|ok|strong) and, below, the Direção section) or alone:
`node $SKILL/scripts/refine/direction.mjs <video.mp4> [--json]`. **It never fails a video** and doesn't count toward the warnings.

- **fraco (weak):** don't deliver it silently. Each warning says what to use (in the tutorial, `"cinema": "moldura"` brings the opening with
  the 3D phone, the glow on the step change and the 3D logo in the closing; in the other styles, a motion transition, `camera()`,
  `conta()`): change it and run again. If it stays that way on purpose, show it and say why.
- **ok:** you can show it, telling the user which signal remained and why (opening with a talking face gives a weak hook).
- **forte (strong):** go ahead.

**How it measures.** Gray thumbnails 64 px on the short side, 10 per second (ffmpeg); each frame's composition is the average
of the thumbnail's 16 px blocks (4 × 7 in 9:16). Distance = mean luminance difference (0–255). The still end
card is cut from the body before measuring monotony and moments. Score: **0 signals = forte, 1 = ok, 2 or more = fraco.**

| Signal | What it measures | Weak when | Rejected | Approved |
|---|---|---|---|---|
| Hook (`gancho`) | the change in composition, frame by frame, summed over the first 2 seconds | < 18 | 5.5–14.0 | 22.1–74.6 (the reel that opens with a talking face: 8.3) |
| Monotony (`monotonia`) | the longest stretch in which the composition stays within ≤ 10 of the stretch's first frame | > 12 s | 6.9–62.3 (22 of 28 above) | 2.2–10.1 |
| Strong moments (`momentos`) | the longest gap without a strong moment (the composition changes ≥ 16 in 0.5 s; at most one per second), from the start to the card | > 15 s | 13.5–69.1 (25 of 28 above) | 4.7–12.6 |
| Closing (`fecho`) | how long the final frame stays with nothing moving (difference < 0.2; grain doesn't go above that) and whether it came in on a cut (a jump ≥ 30 in the 2 s before) | still > 2.5 s | 2.8–4.6 s, all on a cut (jump 88–116) | 0–2.0 s, none on a cut (jump ≤ 16) |

**Discarded** (they don't separate the groups): the variety of compositions (how many groups of similar frames: rejected
2–9, approved 3–25; the tutorial that alternates the zoom on the screen has as many as a TikTok); the mean energy (median
change: rejected 0.4–1.4, approved 0.8–7.0: the tutorial changes a lot, screen swaps and scrolling, only always in the same
place); the area of the frame that changes in a strong moment (the tutorial's screen swap changes as much area as a
transition); the peak change at the start instead of the sum (rejected 3.5–10.3, approved 1.8–60.4).

Calibration: the thresholds came from the owner's judgment (rejected or approved), not from the number. Moments: per 10 s / longest gap.

| Video | Group | Hook | Monotony | Moments | Closing | Score |
|---|---|---|---|---|---|---|
| App tutorial 1, v1 (79 s) | rejected | 6.8 | 20.1 s | 0.8 / 24.9 s | cut, 4.6 s | fraco (4 signals) |
| App tutorial 3, v1 (73 s) | rejected | 7.2 | 62.3 s | 0.1 / 69.1 s | cut, 2.8 s | fraco (4) |
| App tutorials, v2: 13 Reels 9:16 (30–49 s) | rejected | 8.9–14.0 | 10.0–36.6 s | 0.3–2.0 / 13.8–36.6 s | cut, 3.1–3.2 s | fraco (3–4) |
| App tutorials, v2: 13 Widescreen 16:9 (30–48 s) | rejected | 5.5–13.6 | 6.9–33.8 s | 0.3–2.5 / 13.5–36.6 s | cut, 3.1–3.2 s | fraco (2–4; #13 only on hook and closing) |
| Sales Reels A | approved | 46.8 | 5.2 s | 2.5 / 6.3 s | animated, 1.4 s | forte |
| Sales Reels B | approved | 22.1 | 9.1 s | 1.2 / 9.2 s | animated, 1.8 s | forte |
| Sales Reels C | approved | 74.6 | 6.6 s | 1.8 / 8.1 s | animated, 1.7 s | forte |
| Sales Reels D | approved | 24.1 | 10.1 s | 1.6 / 12.6 s | animated, 1.2 s | forte |
| Cinematic 3D demo (15 s) | approved | 30.1 | 2.4 s | 2.3 / 5.0 s | animated, 2.0 s | forte |
| Reference whiteboard 1 (112 s) | approved | 50.8 | 3.2 s | 5.5 / 4.7 s | no card | forte |
| Reference whiteboard 2 (125 s) | approved | 55.4 | 2.2 s | 5.8 / 6.4 s | no card | forte |
| Reference whiteboard 3 (125 s) | approved | 8.3 | 3.1 s | 5.2 / 7.8 s | no card | ok (hook: opens with a talking face) |

**What direction doesn't see:** taste. It measures whether there is movement, composition change and strong moments, not whether they're beautiful.
The measurement is in luminance: a light element on a light background barely changes the number even when animated (the whiteboard reels,
which are light, pass with room to spare, but check on the contact sheet). The tests (`tests/refine-direction.test.mjs`) rebuild the two
extremes with synthetic series: the monotonous tutorial gives fraco and the video with a strong moment every 3 s gives forte.
