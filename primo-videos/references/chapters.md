# Chapter video: the redesigned interface

The default for updates, patch notes, launches, demos, explainers and announcements. Without voice, the video is music,
sound effects and the on-screen text: the timings are fixed, on the soundtrack's grid (§9). The tutorial that teaches a
task still uses the real screen (`references/tutorial.md`).

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
10. Names spelled right
11. Production: template first, chapters in parallel
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

Timing of a chapter:

| t (s) | What |
|---|---|
| 0.0–0.9 | the index card comes in from the right, stops in the middle and shrinks into the label (§7) |
| 0.75 | label, rule and title come in (mask from bottom to top, word by word) |
| 0.9–1.5 | the object enters the stage; nothing on the stage before 0.9 |
| 1.4 | the first support line comes in: the title has already been read |
| 1.4 onward | a new action every 1.5–3 s, on a beat of the bar, and nothing still for more than 0.6 s between them (the stage camera breathes, the object reacts): the refinement check fails frozen frames; each support line comes in at its marked time (`em`) |
| last action + 0.8 | breathing room with everything still and readable; in the last 0.5 s everything rises and disappears, the background stays |

Without voice, the chapter's duration is fixed and comes from the stage and from reading time: `max(5, 1.4 + beats + 0.8)`
seconds, with each beat lasting 1.5–3 s and each support line on screen at least long enough to be read (§9). Three 2 s
beats give an 8.2 s chapter; if it goes past 12–15 s, the chapter holds two new features: split it. Round the duration to
the soundtrack's bar, so the transition lands on a downbeat.

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
comes in: without that, half the frame stays empty while the first item is read.

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

## 10. Names spelled right

Without voice, the risk isn't pronunciation: it's spelling. Before the first chapter:

1. **List the names in the whole video:** product, proper names, stage names, terms in another language, acronyms,
   numbers with units, address.
2. **Copy the spelling from the source,** letter by letter (case, accents, periods, hyphens): the site, the app, the
   manual (`references/brand.md`). Close enough doesn't count.
3. **Check on the contact sheet** (§12) each name on the list, in 16:9 and in 9:16.

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

## 13. The example template (`assets/chapters/`)

A minimal chapter video, with no brand at all (made-up colors and names), taken from a patch notes video that
went live with this method:

- `template/kit.js`: the components (background with grid and glow, index card, chapter frame with label,
  poster title, support and exit, phone, card, pill, tap, index list) and the layout per format;
- `template/index.js`: the index, the name, the address and the closing numbers;
- `scenes/00-opening`, `scenes/01-example`, `scenes/99-closing`: an opening, a chapter and a closing that use the kit;
- `README.md`: how to swap the tokens, write a chapter, render and assemble.

The scripts live in `scripts/chapters/`: `new.mjs` (creates the project), `render.mjs` (one chapter or all of them, in
both formats, with the contact sheet) and `assemble.mjs` (joins them and writes the soundtrack's sync sheet). Swap the tokens
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
- **`.abs` ignores `right`:** the class fixes `left: 0`, so `right: '12px'` does nothing and the box ends up on the
  left, on top of the icon. Compute the `left`. (Three subagents ran into this in the same video.)
- **`font:` resets `lineHeight`:** the `font` shorthand (the kit's `F.*`) declared afterward wipes out `lineHeight` and
  the text rises to the top of the box. Center with `display: 'flex', alignItems: 'center'`; truncate with
  `textOverflow: 'ellipsis'` on an inner span, never in the middle of a word.
- **Counting number blurred at the end:** with motion blur, each subframe showed a different number and the average
  came out as a ghost digit ("3779 × 2128"). The engine's `conta()` already locks the number to the 60 fps frame; text
  that changes with `t` outside `conta` uses `quadroDe(t)`.
- **Pop at the start and a rewritten sheet:** `assemble.mjs` puts 20 ms of silence at the beginning. If you edit
  `sheet.json` by hand, remember that `montar` rewrites it: whatever must stay (an impact on the logo) goes in as a marker
  without `"auto"`.
- **The example scene in the assembly:** `01-example` no longer goes into the video; delete it once the first real
  chapter exists.
- **Split work without a contract:** each person invents their own transition, their own background, their own title
  size, and the video becomes a collage. The template and the contract come before the first chapter (§11).
