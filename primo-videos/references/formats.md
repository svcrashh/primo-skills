# Formats

| Format | Size | Where | Closing sign-off |
|---|---|---|---|
| `16x9` | 1920×1080 | website, YouTube, pitch, TV, LinkedIn | horizontal logo |
| `19x9` | 2280×1080 | landscape phone screen (full-screen video on a phone held sideways, with no bars), laptop and widescreen monitor | horizontal logo |
| `21x9` | 2520×1080 | ultrawide monitor, event or stage big screen, a cinematic-looking opening | horizontal logo |
| `9x16` | 1080×1920 | Reels, Stories, TikTok, Shorts, status | vertical logo (symbol over the name), if the brand has one |
| `1x1` | 1080×1080 | square feed, ads | small vertical or horizontal logo |
| `4x5` | 1080×1350 | Instagram/LinkedIn feed (takes up more screen than 1:1) | vertical logo |

All at 60 fps in the final. The draft comes out at 30 fps.

The three horizontal ones have the same height (1080): 19:9 and 21:9 are a wider 16:9, not a bigger one. The text size, the height
of the stage and the size of the logo follow those of 16:9; what changes is the width, which the layout has to fill (below, "One video,
several formats").

## Safe areas

The platform's interface covers parts of the video. Text and logo stay out of them; a decorative shape can pass underneath.

- **9:16 (Reels/TikTok/Shorts):**
  - at the top, the top ~220 px (name, "Reels", camera);
  - at the bottom, the bottom ~420 px (caption, music, name);
  - on the right, a ~140 px strip between y 900 and 1650 (like, comment, share).
  - Text that matters: **y 250–1450, x 70–940**. In Stories the margins are similar: avoid the top 250 px and the bottom 340.
- **4:5 and 1:1 (feed):** the preview crop can eat the edges; leave a 60 px margin.
- **16:9, 19:9 and 21:9:** 5% margin for text; final logo centered.
  - 16:9: 96 px on the sides, 54 at the top and bottom (text in x 96–1824, y 54–1026);
  - 19:9: 114 px on the sides, 54 at the top and bottom (text in x 114–2166, y 54–1026). On a phone held sideways, the camera
    cutout and the rounded corners fall on the sides: the 5% covers them; do not put text right against them;
  - 21:9: 126 px on the sides, 54 at the top and bottom (text in x 126–2394, y 54–1026). On a big screen, the projection can eat the
    edge: the same 5% is enough for the text; the logo and the title stay away from the ends.

### `VIDEO.plataforma` and the automatic check

Say in `video.js` where the video will play. The collision check uses this to know the safe rectangle of each format:

| `plataforma` | Safe rectangle |
|---|---|
| `'reels'`, `'tiktok'`, `'shorts'` (in 9:16) | x 70–940, y 250–1450 (the button strip on the right is already left out) |
| `'stories'` (in 9:16) | x 60–1020, y 250–1580 (avoids the top 250 px and the bottom 340) |
| `'feed'` | 60 px margin |
| `'youtube'` | 5% margin (in any format) |
| `'app'` | 60 px margin (a player inside the product or the website, with no social-network interface on top) |
| `null` (no platform) | the format's default: 16:9, 19:9 and 21:9 → 5%; 9:16 → the reels/tiktok/shorts rectangle (that is where 9:16 usually goes); 1:1 and 4:5 → 60 px |

- With several formats, use an object: `plataforma: { '9x16': 'stories', '16x9': 'youtube' }`. A format that does not appear in the object uses its default.
- A tutorial that plays in the app's "See how to do it" uses `plataforma: 'app'`.

Every marked text (the `textLine`/`bloco` lines already are; logo and caption you mark with `marcar(el, 'logo')`) that is **still and opaque** has to fit in the rectangle. The measured rectangle is that of what shows (the letters, the logo's shapes), not that of the box. The check runs:

- on every frame of `frames.cjs` (strips, `--scenes`, `--auto`);
- over the whole timeline with `node tools/frames.cjs --project . --check [--qps 10] [--format 9x16]`, with no image, in a few seconds;
- on the automatic sheet that `render.cjs --mode draft` generates at the end.

The message comes out like this: `SAFE AREA t=4.00–7.90 s: text "Download now" leaves the reels safe area (y 1636 > 1450)`, with exit code 4. Fix the layout (`L({...})`, smaller size, line break). In a centered title in 9:16, reels only accepts up to 800 px of width, because the center is at 540 and the limit at 940. Only unmark (`marcar(el, false)`) what is truly decorative.

## One video, several formats

Decide the formats in the briefing and write each scene **already with a layout per format**. Rebuilding later costs double (converting a finished video to another format calls for a script just for that).

- Use `L({ '16x9': …, '9x16': … })` for position, font size, radius and number of lines; `VERTICAL`, `HORIZONTAL` and `W/H/CX/CY` are for logic.
- **19:9 and 21:9:** with no key of their own, `L` uses the `16x9` value. That works for text size, `y` and heights, but an
  `x` or a width in fixed 16:9 px leaves an empty strip on the right (360 px in 19:9 and 600 in 21:9). Write what
  is horizontal as fractions of `W` or anchored to the safe area (left column on the left margin, right object on the
  right margin), or multiply the 16:9 x by `W / 1920`. Only add a `'21x9'` key when the composition really
  changes (three columns where 16:9 has two, for example). The templates already do it this way; each one's `TEMPLATE.md` says what it
  accepts.
- A sentence that fits on one line in 16:9 becomes two in 9:16. Build it with `bloco` and break it by meaning ("The plan for / each student,"), never by length.
- Side-by-side compositions (text on the left, image on the right) become stacked in vertical, with the title on top and the image bigger in the center.
- Columns become stacked horizontal strips; a horizontal carousel becomes vertical.
- Charts and rings stay centered and bigger in vertical, which has height to spare.
- Whip-pan: in vertical, the movement can stay horizontal (it is natural on the phone) or become vertical.
- Review **each format** with `frames.cjs --format 9x16 --scenes` and `frames.cjs --format 9x16 --check` (and `--format 21x9`). One good format does not guarantee the other.

## Minimum readable text

- **16:9 watched on a laptop:** 28 px for a label, 56+ for a sentence, 90+ for a title.
- **9:16 watched on a phone:** 34 px for a label, 60+ for a sentence, 88+ for a title.
- **19:9 watched on a phone held sideways:** the same numbers as 9:16 (34 / 60+ / 88+). The 1080 px of the short side are the width
  of the phone in both cases, so 1 px is the same size in the hand; the laptop minimum (28 px) is too small.
- **21:9 on an ultrawide monitor:** the 16:9 numbers (28 / 56+ / 90+): the height is the same 1080 and the screen is at least as
  tall as a laptop's. **On a big screen**, seen from afar, go up one step: 36 px for a label, 64+ for a sentence, 110+ for a
  title.
- Interface text inside a phone mock can be smaller, because it is "image", but the message needs to be in a title outside it.
