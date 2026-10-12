# Chapter video: the redesigned interface

The default for updates, patch notes, launches, demos, explainers and announcements. Without voice, the video is music,
sound effects and the on-screen text: the timings are fixed, on the soundtrack's grid (§9). That is the default, and it
runs entirely on this machine. With voice (opt-in and paid: an ElevenLabs voiceover, only when the person asks for one
and the key is set up, `references/voice-choice.md` §12), each chapter lasts as long as its line and the stage follows
the spoken word: the "With voice" parts of §4, §9, §10 and §11. The tutorial that teaches a task still uses the real
screen (`references/tutorial.md`).

## Contents
1. Why redesign instead of record
2. What fails (the defects that already shipped and nobody wants again)
3. The structure: opening with index, chapters, closing
4. Anatomy of a chapter
5. The redesigned interface
6. Real screen: only as proof
7. Transition between chapters
8. 16:9 and 9:16, recomposed
9. Without voice: timing, text and soundtrack
   - With voice: the voice in the chapters
10. Names spelled right
    - With voice: pronunciation dictionary and transcription check
11. Production: template first, chapters in parallel
    - With voice: the order of production
12. Contact sheet: mandatory, per format
13. The example template (`assets/chapters/`)
14. Pitfalls that already cost time

---

## 1. Why redesign instead of record

A whole app screen inside a 1920 px video becomes a 600 px image with 6 px letters. Nobody reads it,
and what matters (the new button, the number, the color) gets lost among everything that didn't change. The video that
works **redesigns the interface, simplified, large and animated, with only what matters**:

- the phone shows three lines of content, not thirty;
- the new number takes up a third of the phone's height;
- the change happens in front of the viewer: the before state turns into the after state.

The tokens (colors, fonts, radii, icons) come from the product, through the project reading (`references/reading.md`);
the data, from an authorized example account (§5). It looks like the product, but reads like a poster.

## 2. What fails

Each item below shipped in a delivered video and was rejected. The contact sheet (§12) looks for each one.

- **Real screen shrunk inside a mockup frame:** unreadable text, a frame full of nothing.
- **Page recorded half-loaded:** the frame shows loading, blank white or an empty corner.
- **Always the same composition:** screen in the middle and caption below, from start to finish.
- **No index or chapters:** the viewer doesn't know how much is left or where they are.
- **With voice, on-screen text that repeats the whole line:** the text on screen says what the voice says, word for
  word. In a chapter video the title is a poster (§4), and the line is something else.
- **With voice, a name pronounced wrong:** brand, product name, a term in another language, an invented name. Without
  the dictionary and the transcription check (§10), it only shows up when the owner listens.

## 3. The structure

| Part | Duration | What happens |
|---|---|---|
| **Opening** | 5–8 s | logo, the video's word ("What's new", "What changed") and the **numbered index**, which fills in item by item |
| **Chapters** | 5–12 s each | one per new feature, in index order (§4) |
| **Closing** | 6–10 s | the full index, **big numbers** (only true ones), logo held still ≥ 1.5 s (the closing is the logo alone: no address, no slogan) |

- The index is the video's thread: the card of the next item opens the chapter (§7), and the closing comes back to it in full.
- 6 to 12 chapters. More than that becomes "And more": one chapter with three small new features, one line each.
- Total duration: 1 min 30 s to 3 min in 16:9; the same structure in 9:16 (it is not a crop of the horizontal, §8).

## 4. Anatomy of a chapter

Fixed composition, so the viewer learns to read the video in the first chapter:

- **Label**, small, in a mono font, with a rule above it: `01 · AREA` (the product area, one word).
- **Poster title:** 2–3 words, in the brand's title font (condensed, heavy weight; italic if the brand has it),
  with the **keyword in the highlight color**. "**New** colors", "Your **kit**". Not a full sentence.
- **Support:** 1–2 short lines that come in one at a time, at the marked time (§9). At most ~45 characters each.
- **The object:** on the right in 16:9, at the bottom in 9:16. A phone, card, panel or number, redesigned (§5), that
  **changes while the chapter runs**: it enters, shows the before state, turns into the after state, highlights the detail.
- **Background:** the brand's background color, a subtle grid and a slow glow in the highlight color. The same in every
  chapter: what changes is the object.

With voice (§9), the title is not a sentence from the line, each support line comes in when the voice reaches its
subject, and the object changes while the voice speaks.

Timing of a chapter:

| t (s) | What |
|---|---|
| 0.0–0.9 | the index card comes in from the right, stops in the middle and shrinks into the label (§7) |
| 0.75 | label, rule and title come in (mask from bottom to top, word by word) |
| 0.9–1.5 | the object enters the stage; nothing on the stage before 0.9 |
| 1.4 | the first support line comes in: the title has already been read |
| 1.4 onward | a new action every 1.5–3 s, on a beat of the bar, and nothing still for more than 0.6 s between them (the stage camera breathes, the object reacts): the refinement check fails frozen frames; each support line comes in at its marked time (`em`) |
| last action + 0.8 | breathing room with everything still and readable; in the last 0.5 s everything rises and disappears, the background stays |

With voice, the first three rows stay and the rest follow the line instead of the bar grid:

| t (s) | What |
|---|---|
| 1.4 | the line starts (`VOZ_EM`): the title has already been read |
| during the line | a new action every 1.5–3 s, each on the word that names it (`em('word')`), and nothing still for more than 0.6 s between them: the refinement check fails frozen frames; each support line comes in when the voice reaches it (`em`) |
| end of the line + 0.8 | breathing room with everything still and readable; in the last 0.5 s everything rises and disappears, the background stays |

Without voice, the chapter's duration is fixed and comes from the stage and from reading time: `max(5, 1.4 + beats + 0.8)`
seconds, with each beat lasting 1.5–3 s and each support line on screen at least long enough to be read (§9). Three 2 s
beats give an 8.2 s chapter; if it goes past 12–15 s, the chapter holds two new features: split it. Round the duration to
the soundtrack's bar, so the transition lands on a downbeat.

With voice, the chapter lasts as long as its line: `max(5, 1.4 + line + 0.8)` seconds. A 9 s line gives an 11.2 s
chapter; if it goes past 12–15 s, the chapter holds two new features: split it. The `em` values of the support and the
beats come from the word-by-word timings measured in `narration.json`, through `scripts/chapters/tempos.mjs`, not from
the estimate (§11, "With voice").

## 5. The redesigned interface

- **Only what matters:** the real screen has thirty elements; the chapter has three to five. If the subject is the
  button color, the phone shows the profile, two buttons and the palette. Remove menus, footers and running text.
- **Large:** object text ≥ 28 px in 16:9 (1080 tall) and ≥ 32 px in 9:16. The phone takes up ~70% of the
  height in 16:9 and ~55% in 9:16.
- **Components, not screenshots:** the phone is a component (mockup frame, island, screen with rounded corners) that
  receives the content; so are the card, the selector, the list and the number. A chapter builds the object from them.
- **Animated:** each object has a visible "before → after". A selector that slides, a color that swaps, a number that
  counts, a list that fills in, a card that stands out. A still object is a screenshot.
- **Data from an authorized example account** (name, photo, real numbers, with the account owner's written ok)
  or plausible fictional data (`references/brand.md`). Never invent a product number, client or testimonial. If the
  number doesn't exist, the object shows the interface without a number.
- **Real photos and logos** come in as images (`media/`), cropped to the size at which they appear.
- **Real media comes from the public page,** not from screenshots: `scripts/extract-media.mjs <url> --out media/<name>`
  downloads the avatar, the icons, the background photos, the background video and the API's JSON responses (the labels,
  the order, the numbers), with analytics calls blocked. The redesign uses those assets and that data; the screenshots it
  takes only serve to check labels and colors. A still screenshot in a panel fails; the same content redesigned with the
  example account's real assets passes.
- **Real video inside the phone:** the profile's background video becomes portrait frames
  (`ffmpeg -ss 2 -t 9 -i video.mp4 -vf "crop=ih*390/844:ih,scale=480:-2,fps=30" -q:v 3 media/x/video/q%04d.jpg`) and
  comes in with `sequencia(tela, quadros)` + `.set(t)`. That's what makes the phone look alive.
- **The example account's components in the kit** (the profile with header and tabs, the link row, the button): every
  chapter draws with them, and the video doesn't turn into a collage.

## 6. Real screen: only as proof

The real screen appears only a few times (0 to 3 in the whole video), when proving is worth more than explaining: "it's live".

- **Full screen,** zoomed in on the detail that matters. Never shrunk inside a mockup frame in the middle of the frame.
- **Page fully loaded:** record after everything has loaded (fonts, images), never the loading.
- **Without dirtying real data:** a recording on a real account must not count a visit, a click or a device. Intercept
  the analytics calls in the browser (`page.route`) before opening the page, and say in the report what was
  intercepted.
- Use the tutorial's capture engine (`scripts/tutorial/record.mjs`) or a frame-by-frame `page.screenshot`; the
  recording becomes a frame sequence in `media/` (`references/engine.md`).

## 7. Transition between chapters

- **The index card passes over:** the next chapter's item (number + name) comes in as a card, grows and
  becomes the chapter's label. It's the default transition; keep the same one throughout the video.
- Duration 0.5–0.7 s, with a short whoosh (`audio/sounds.py`) at the marker on the sync sheet.
- The previous chapter doesn't disappear before the card covers it: no empty frame between chapters.

## 8. 16:9 and 9:16, recomposed

**19:9 and 21:9** (2280 and 2520 × 1080) use the 16:9 layout stretched in width (`KX = W/1920` in `kit.js`: the text column and the stage grow, body text size and heights stay the same). `new.mjs --formats 19x9` or `21x9`; details in `assets/chapters/README.md` and `references/formats.md`.

The vertical is a different composition, with the same elements, not a crop of the horizontal:

| | 16:9 (1920×1080) | 9:16 (1080×1920) |
|---|---|---|
| label + title + support | left column (x 140, up to 700 px wide), title 128 px | at the top (x 90, up to 840 px), label at y 262, title 118 px |
| object (the stage) | on the right, x 900–1800, y 90–990 | at the bottom, x 90–930, y 760–1450 (outside that, TikTok's interface covers it: the refinement check fails it) |
| index (opening and closing) | to the right of the logo | below the logo, one column |
| safe area | 5% all around | social-media 9:16: 14% at the top, 20% at the bottom, 6% on the sides (`references/formats.md`) |

**In 9:16 the whole phone has small text.** It comes in whole and the stage camera (`camPalco` in the kit) slowly moves
in on the action area, which follows the stage beats (the button when the beat is the button), with the stage fading out
at the top and bottom instead of a hard cut. The opening starts with the brand in the center and rises when the index
comes in: without that, half the frame stays empty while the first item is read. With voice, the action area follows
the line instead of the beats (the button when the voice talks about the button), and the opening rises as the voice
says its first sentence.

Each scene declares the layout per format (`L({ '16x9': …, '9x16': … })`) from the first line. A title that fits
on one line in 16:9 may need two in 9:16: write the line breaks, don't let the browser decide.

## 9. Without voice: timing, text and soundtrack

- **The grid rules the timing:** the soundtrack is the protagonist (`references/soundtrack.md` §2). Choose the BPM before the
  scenes and put every entrance (title, support, stage beat, transition) on a beat of the bar (bar = 240/BPM s; half a
  beat when you need more). The `em` values of the support lines and the beats are fixed numbers in `scene.js`, copied
  from the script's table, and the same times go as markers to the soundtrack's sync sheet.
- **The on-screen text does the work of speech:** the title is the poster (2–3 words); the support says what you gain,
  in the present tense, one idea per line. "33 layouts. 4 featured, the rest one tap away." It doesn't describe the screen.
- **Reading time:** each support line stays still and readable for ~1 s per 12 characters, never less than 1.5 s,
  before the chapter leaves. Text that disappears before it's read is the most common mistake.
- **The caption is the on-screen text:** there is no separate caption. Whoever watches without sound reads the whole
  video; whoever listens also gets the soundtrack and the effects.
- **Sounds mark the action:** one whoosh per transition (`assemble.mjs` puts it on the sheet), an impact when the number
  lands, a tap and a click where the object reacts (`references/soundtrack.md` §8), each on the exact audio sample of its marker.
- **Numbers in digits, and large,** with a 3-word label that says what they count.
- The mix is the protagonist-soundtrack mix (−14 LUFS, `references/soundtrack.md` §2), checked by `finalize.mjs`.

### With voice: the voice in the chapters

Only when the person asked for a voiceover. Everything above about the on-screen text still holds; what changes is who
sets the time.

- **One line per chapter:** each chapter's line is `"onde": { "capitulo": n }` in `voice/<version>/script.json`, plus
  `"abertura"` and `"fechamento"` (`references/voice-script.md` §2 and §6). `voice.mjs` orders and checks it the same
  way as in a tutorial: one line per place, and a script doesn't mix `passo` and `capitulo`.
- **Sentences that say what you gain:** present tense, one idea per sentence, written the way people talk
  (`references/voice-script.md` §3; `voice.mjs review` checks the script before any credit is spent). 6 to 10 s of
  speech per chapter, usually two sentences. "There are thirty-three layouts now, four of them featured and the rest one
  tap away." It doesn't read the screen.
- **The voice rules the timing** (§4): the chapter lasts as long as its line, not the bar. Write the script, generate
  the voice, and only then lock the durations. In split work, the locked script (text + estimated duration) comes
  before any scene.
- **Title ≠ line:** the title is the poster (2–3 words), the support is 1–2 lines, the line is the whole sentence. There
  is no word-by-word caption in a chapter video. `assemble.mjs` writes the speech as a caption file
  (`out/assembled.srt`) for platforms that take one; if the video must be followed without sound with the speech
  burned in, that caption is a separate element at the bottom, checked on the contact sheet like the rest.
- **Numbers:** in digits on screen. In the script, spelled out when the voice can misread them ("two point seven
  megabytes"), or kept in digits with the spoken form in the `pronuncia` map (§10).
- **The line is measured:** `voice.mjs generate` writes each line's real duration and the time of each word in
  `narration.json`; `tempos.mjs` and the assembly use the measured times, never the estimate.
- **Opening and closing** follow `references/voice-script.md`. Here the opening line can say how many new features
  there are, while the index fills in.
- **The mix is the mix with voice** (`references/voice-mix.md`), not the protagonist-soundtrack one: the music steps
  back to a bed and gives way under each line. Profile `reels` for ads and social media, `calmo` for help content: the
  same `perfil` in `script.json` and `--profile` in `assemble.mjs`.
- **Sounds under the line:** the transition whoosh and the impacts go down 6 dB while the voice speaks, and taps and
  clicks stay at their level (`references/voice-mix.md` §4). An effect right on top of the product's name can eat the
  word: `listen --mix` catches it (§12).

## 10. Names spelled right

Without voice, the risk isn't pronunciation: it's spelling. Before the first chapter:

1. **List the names in the whole video:** product, proper names, stage names, terms in another language, acronyms,
   numbers with units, address.
2. **Copy the spelling from the source,** letter by letter (case, accents, periods, hyphens): the site, the app, the
   manual (`references/brand.md`). Close enough doesn't count.
3. **Check on the contact sheet** (§12) each name on the list, in 16:9 and in 9:16.

### With voice: pronunciation dictionary and transcription check

With voice, the spelling above still holds for the screen, and pronunciation becomes a risk too. Before generating the
first line:

1. **List the risk words of the whole video:** the same list as above (product, proper names, stage names, terms in
   another language, acronyms, numbers with units, address). In a product update there are almost always 8 to 15.
2. **Decide the spelling of each one** in the script's `pronuncia` map (`references/voice-script.md` §4). A word the
   voice reads right stays out of the map, but stays on the risk list.
3. **Listen before spending the rest:** the risk words in a single sentence, written the way the map spells them, read
   by the chosen voice:

   ```sh
   node $SKILL/scripts/voice.mjs samples --phrase "<the risk words in one sentence>" --voices <chosen voice id> --profile <the script's perfil> --project <folder>
   ```

   One sentence, few credits. Adjust the map and repeat until the person hears it right
   (`voice.mjs transcribe <the sample's mp3> --project <folder>`, paid by duration, shows what the transcription hears
   in it).
4. **Show the dictionary in the approval table** (`references/voice-script.md` §5): word → how the voice reads it.
5. **After generating, transcribe:**

   ```sh
   node $SKILL/scripts/voice.mjs listen <folder>/voice/<version>/narration.json --words "Name,Other,Acronym"
   ```

   - It sends each line to the ElevenLabs speech-to-text (`scribe_v2`), **without keyterms**: biasing the
     transcription toward the right word would hide the wrong one.
   - It compares what the transcription heard with what the voice should say (the `dito`, when there is a
     pronunciation swap).
   - Risk word = one with a swap in the map, plus those in `--words`. If one doesn't appear in the transcription, the
     line fails and the command exits with code 1.
   - It writes `heard.md` next to `narration.json`: line, risk, what it should say, what was heard.
   - A risk word that failed: adjust the map and `voice.mjs generate … --redo <id>`. Two takes in a row wrong on the
     same word: change the spelling, don't insist on the take.
   - It is paid by duration, like every transcription (`references/voice-mix.md` §6), and goes through the video's cap.
6. The transcription doesn't judge accent or intonation, and an invented word can come out "right" in the transcription
   and strange to the ear. The report lists the risk words for whoever listens.

## 11. Production: template first, chapters in parallel

**For a Reels, the project is born 9:16 only:** `new.mjs <folder> --formats 9x16`. `render.mjs` and `assemble.mjs` follow
the formats in each scene's `video.js`: no rendering 16:9 for nothing.

1. **Script locked:** the index and, per chapter, the duration, the label, the title, the support lines with `em` and
   the stage beats with the time of each one, all on the BPM grid (§9).
2. **Template:** `node $SKILL/scripts/chapters/new.mjs <folder> --fonts "…"` creates the project from
   `assets/chapters/`. Swap tokens, fonts, logo and index using the project reading and make **one whole chapter**,
   rendered in both formats (`scripts/chapters/render.mjs`) and looked at on the contact sheet. It's the reference for the rest.
3. **Timings:** the `em` values of the support lines and the beats are the script's numbers, on the bar grid. Changed a
   time? Change it in the script, in the scene and in the soundtrack's sync sheet together (`references/soundtrack.md` §7).
4. **Chapters in parallel:** with the template approved, each chapter (or group of 3) goes to a subagent or
   window, with a closed scope: the `scenes/NN-nome/` folder, the text and duration from the script, and the instruction
   not to touch the template. Each one renders both formats, looks at its own contact sheet (§12) and writes a short
   `DONE.md` (what it did, the duration, what was left out). A defect in the template becomes a request to whoever
   maintains the template, not a local fix.
5. **In parallel, the soundtrack:** it comes from the sync sheet with each chapter's markers and it is the protagonist (§9).
6. **Assembly:** `node $SKILL/scripts/chapters/assemble.mjs <folder>` joins opening + chapters + closing in both
   formats and writes the soundtrack's sync sheet (one whoosh per chapter transition). Then, the soundtrack over the sheet
   (`references/soundtrack.md` §4) and `finalize.mjs` for each format.
7. **Refinement check:** `node $SKILL/scripts/refine.mjs <folder> [--product "Name"]` before showing the draft and again
   on the final MP4 (`references/refine.md`). Fix what it points out, render the scenes and run it again, until it passes.

The project already comes with a `CONTRACT.md` to fill in. In work split across windows or subagents, fill in the contract first: who does what, where each one
writes, the locked script (folder, duration, label, title, support with `em`, stage beats with their times) and the exact
labels of each stage.
A defect in the template goes to a requests file that only whoever maintains the template resolves.

Each chapter is a short video: render and check one on its own, without depending on the others.

### With voice: the order of production

Only when the person asked for a voiceover. Without that request, or without the ElevenLabs key, the steps above are the
whole production and nothing here runs. The voice is paid (`references/voice-choice.md` §12): before the first paid
call, tell the person it costs up to about 900 credits per minute of narration, and that the video's cap is 1,500 voice
credits unless they raise it. The template (step 2) and the chapters in parallel (step 4) stay the same; the rest
changes:

1. **Script locked, with the lines:** the index and, per chapter, its line in `<folder>/voice/<version>/script.json`
   (§9), with the estimated duration (`review` counts ~150 words per minute, `references/voice-script.md` §3).
   `node $SKILL/scripts/voice.mjs review <folder>/voice/<version>/script.json` with no errors, the risk words in the
   `pronuncia` map (§10), then the approval table (`references/voice-script.md` §5) and the person's yes. On the review
   board it is "Approve script" (`recipes/board.md`). No line is generated before it.
2. **The voice, chosen by ear:** three different candidates reading the first real line,
   `node $SKILL/scripts/voice.mjs samples --script <folder>/voice/<version>/script.json --voices id1,id2,id3`
   (`references/voice-choice.md` §4), and the pace, `calmo` or `reels` (§5 there). The chosen voice goes into `voz` in
   `script.json`.
3. **Generate early:**
   `node $SKILL/scripts/voice.mjs generate <folder>/voice/<version>/script.json --out <folder>/voice/<version>`
   writes `narration.json` and `lines/<id>.wav`. A writing tic in a new line stops it before spending (exit code 3;
   `--accept-text` only with the person's yes). Over the cap, nothing is called (exit code 5):
   ask the person, and with their yes, `node $SKILL/scripts/costs.mjs cap <folder> --voice-credits <n>`. Then `listen`
   (§10). With the measured times, the durations and the `em` values stop being guesses.
4. **Timings:** with the voice generated and the scene folders created,
   `node $SKILL/scripts/chapters/tempos.mjs <folder> [--narration voice/<version>/narration.json] [--speech-at 1.4]`
   writes each scene's `tempos.js` and loads it in the scene's `index.html`: `em('word')` / `ate('word')` on the
   **exact** word (§14), `VOZ_EM`, `FIM_FALA` and `DURACAO_MINIMA`. The `"abertura"` line goes to `00-…`,
   `{ "capitulo": n }` to `NN-…`, the `"fechamento"` line to `99-…`. `--narration` can be left out when the project has
   a single `voice/<version>/narration.json`.
   - Every support `em` and every stage beat uses `em()`, never a copied number.
   - Each scene's `duracao` in `video.js` is `FIM_FALA` + ~0.8 s, and at least 5 s: below `DURACAO_MINIMA` the
     assembly refuses the line, and more than 1.3 s after the last word (3 s on the closing) the refinement check flags
     leftover silence.
   - The voice changed? Run it again and render the scenes again.
5. **Render** each scene in its formats (`scripts/chapters/render.mjs`), as in steps 2 and 4.
6. **Assembly with the voice:**

   ```sh
   node $SKILL/scripts/chapters/assemble.mjs <folder> --narration voice/<version>/narration.json --profile reels|calmo [--soundtrack --deliver <delivery folder>]
   ```

   It joins opening + chapters + closing, puts each line at `scene start + 1.4 s` (`--speech-at`, the same value as in
   `tempos.mjs`), refuses a line that doesn't fit its scene and says which `duracao` fixes it, and writes
   `audio/voz.wav`, `out/assembled.srt` and `audio/sheet.json` with the `voz` block and one whoosh per transition.
   `--profile` is the script's `perfil` (`reels` when left out). Then the soundtrack over that sheet is the mix with
   voice (`references/voice-mix.md` §5), and `finalize.mjs` for each format; with `--soundtrack --deliver`, it composes,
   checks with `verify.py`, finalizes each format and puts the `.srt` next to each delivered MP4.
7. **Refinement check:** `node $SKILL/scripts/refine.mjs <folder> [--product "Name"]`, before showing the draft and
   again on the final MP4. With voice it also fixes, by itself, the narration's alignment to the real pauses and the
   silence left at the end of each line, keeping the originals (`narration.before-refine.json`, `lines/_before-refine/`).
   It finds the project's single `narration.json` by itself; with more than one version, pass
   `--narration voice/<version>/narration.json`. After that: `tempos.mjs`, render the scenes and refine again, until it
   passes.
8. **The mix, heard (optional):** on each format's final MP4,
   `node $SKILL/scripts/voice.mjs listen --mix <delivery folder>/<name>-<format>.mp4 --script <folder>/voice/<version>/narration.json --words "…"`:
   did the soundtrack or an effect eat a word? (`references/voice-mix.md` §6).

After every paid call (samples, generate, `--redo`, listen):
`node $SKILL/scripts/costs.mjs board <folder> [--account-left <credits>]`, and a patch to the review board with the
block it prints, as `{"costs": …}` (`recipes/board.md`).

In split work, the contract carries the locked script with the line of each chapter (folder, duration, label, title,
support with `em`, the line) instead of the beat times. Generate the voice before the chapters are done, and tell
whoever makes each chapter when the timings change.

## 12. Contact sheet: mandatory, per format

Before saying it's done, for **each** final **format**: the refinement check (`node $SKILL/scripts/refine.mjs <folder>`,
until it comes out with PASSED: legibility, font, frozen or empty frame, and safe area) and the contact sheet, looked at:

```sh
# one frame every 2 s, 5 per row
ffmpeg -v error -i final-16x9.mp4 -vf "fps=1/2,scale=480:-1,tile=5x8" -frames:v 1 sheet-16x9.jpg
ffmpeg -v error -i final-9x16.mp4 -vf "fps=1/2,scale=270:-1,tile=8x4" -frames:v 1 sheet-9x16.jpg
```

Open each sheet with the image-reading tool and look for:

- **nothing empty:** a frame with no object, a page loading, plain background between chapters;
- **nothing unreadable:** text you can't read in the 480 px thumbnail probably can't be read on a phone;
- **nothing cut off in the vertical:** title, object or index outside the safe area or past the edge;
- **the composition:** label, title and object in the same place in every chapter;
- **the index:** the opening and the closing show all the items, in chapter order.

Also check the duration (`ffprobe`) and the audio (`finalize.mjs`: loudness and true peak). Find a defect, fix it,
redo the sheet.

With voice, the refinement check also has to pass the voice checks (animation on the word, voice alignment, flat voice
and leftover silence), `finalize.mjs` also checks the voice above the soundtrack in each line
(`references/voice-mix.md` §6), and the transcription comes in: `voice.mjs listen` on the lines (§10) and, optionally,
`voice.mjs listen --mix` on each format's final MP4 (§11, "With voice"). Both are paid by duration: about 20 credits per
minute of audio.

## 13. The example template (`assets/chapters/`)

A minimal chapter video, with no brand at all (made-up colors and names), taken from a patch notes video that
went live with this method:

- `template/kit.js`: the components (background with grid and glow, index card, chapter frame with label,
  poster title, support and exit, phone, card, pill, tap, index list) and the layout per format;
- `template/index.js`: the index, the name, the address and the closing numbers;
- `scenes/00-opening`, `scenes/01-example`, `scenes/99-closing`: an opening, a chapter and a closing that use the kit;
- `README.md`: how to swap the tokens, write a chapter, render and assemble.

The scripts live in `scripts/chapters/`: `new.mjs` (creates the project), `render.mjs` (one chapter or all of them, in
both formats, with the contact sheet) and `assemble.mjs` (joins them and writes the soundtrack's sync sheet). With voice,
`tempos.mjs` writes each scene's timings from the spoken words, and `assemble.mjs --narration` also puts each line in its
scene (through `falas.mjs`) and writes the `voz` block of the sheet. Swap the tokens
for those from the project reading (§3 of the reading: the product's look) and write the chapters. The example is structure, not identity: each
product's background, fonts, phone shape and motion come from its own project reading.

## 14. Pitfalls that already cost time

- **Title too wide:** a long word at 128 px goes past 750 px in 16:9. Break it into two lines with the same text
  ("33" / "LAYOUTS"); only as a last resort make it smaller (`tituloPx: { '16x9': 118 }`). The title never touches the stage.
- **Measured with the wrong font:** the engine loads every weight and style of the families in `VIDEO.fontes` before
  building the scenes. A font used outside that list is measured with the fallback (≈1.3× wider) and the width check
  lies: every family in the kit goes into each scene's `VIDEO.fontes`.
- **Gap in 9:16:** the vertical stage is tall so it fits a two-line title and three support lines. With a one-line
  title, the stage content hugs its top (up to 60 px) and grows downward; a small phone centered in the middle
  of the stage leaves a hole between the text and the object.
- **False positives from `frames.cjs --check`:** the mask of the title's second line touches the first one
  ("COLLISION … at up to 33%") and the 9:16 label sits above the social-media safe area when the
  video doesn't declare a platform. Check on the sheet you looked at; if there's no visible overlap, move on.
- **With voice, `em()` by prefix:** an old `tempos.js` found the first word that *started* with the search:
  `em('nine', 2)` landed on "ninety" and the price jumped 0.5 s before "nine!"; `em('no')` landed on "now". The
  `scripts/chapters/tempos.mjs` compares the exact word, and the refinement check (animation on the word) flags a call
  that lights up before the voice.
- **With voice, a word after a pause comes early:** the ElevenLabs alignment put the pause inside the next word, and a
  beat tied to it lit up 0.2 to 0.74 s before the sound. `voice.mjs generate` already corrects it by the measured
  pauses; for a narration generated before that, the refinement check corrects it (and keeps the original).
- **With voice, a line that grows after the voice was generated:** the durations and the support `em` values come from
  the measured times (`narration.json`), not from the estimate. Generate the voice before the chapters are done, and
  tell whoever makes the chapters when the timings change.
- **`.abs` ignores `right`:** the class fixes `left: 0`, so `right: '12px'` does nothing and the box ends up on the
  left, on top of the icon. Compute the `left`. (Three subagents ran into this in the same video.)
- **`font:` resets `lineHeight`:** the `font` shorthand (the kit's `F.*`) declared afterward wipes out `lineHeight` and
  the text rises to the top of the box. Center with `display: 'flex', alignItems: 'center'`; truncate with
  `textOverflow: 'ellipsis'` on an inner span, never in the middle of a word.
- **Counting number blurred at the end:** with motion blur, each subframe showed a different number and the average
  came out as a ghost digit ("3779 × 2128"). The engine's `conta()` already locks the number to the 60 fps frame; text
  that changes with `t` outside `conta` uses `quadroDe(t)`.
- **Pop at the start and a rewritten sheet:** `assemble.mjs` puts 20 ms of silence at the beginning. If you edit
  `sheet.json` by hand, remember that `assemble.mjs` rewrites it: whatever must stay (an impact on the logo) goes in as a marker
  without `"auto"`.
- **With voice, a fade that eats the last word:** at 2.5 s from the end, the fade swallowed the closing's last word.
  `assemble.mjs` now starts the fade only after the last line ends.
- **The example scene in the assembly:** `01-example` no longer goes into the video; delete it once the first real
  chapter exists.
- **Split work without a contract:** each person invents their own transition, their own background, their own title
  size, and the video becomes a collage. The template and the contract come before the first chapter (§11).
