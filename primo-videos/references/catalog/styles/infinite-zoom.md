# Infinite zoom (`infinite-zoom`)

A continuous zoom across 3 or 4 levels: the camera dives into a detail of the screen (a link, an icon, a card), and that detail
becomes the next screen, without a cut. From the overview to the detail, and the last detail becomes the closing with the logo. The screens are real
screenshots in a window; the text stays in a column or a strip outside it.

**When to use:** objectives `update` and `launch` for a website, dashboard or document with several layers ("from here you get
there"), `results` for a package shown from the whole to the part; opening or closing another piece with a dive into the screen; channels
`site`, `big-screen`, `feed`, `reels` (9:16 recomposed); product `b2b`, internal, documentation.
**When not to use:** teaching the click path (the dive doesn't show the tap: `real-screen-camera`,
`phone-3d`); screens without a small detail that leads from one to the next; more than 5 levels; a whole screen to be read
slowly (the first level goes by quickly).

## Structure (10–14 s)
- **0–1 s:** the overview screen filling the window, the promise already written beside it, the camera pushing in slowly.
- **Dive (1–2 s each):** the camera goes to the detail; the next screen grows out of it until it fills the window; the
  text changes in the middle of the dive.
- **Each level (0.7–1.7 s):** the screen fills the window, legible (the page's text at ~32 px), and the camera pushes in to the
  next detail.
- **Closing:** the last detail becomes the closing's background, with the logo inside, which grows to fill the frame and holds ~2 s.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** the window on one side and the text in a column, or the window centered and the text in a strip below (or
  above), aligned with it.
- **9:16 and 1:1:** the window on top, at the width of the safe area; the text in a strip below.
Each screen is captured at the proportion of the main format's window; in the others, it's cropped to fill the window,
with the detail always in view.

## The request must include
The page (URL or local HTML), with no customer data; 3 to 4 screens, from the overview to the detail, and on each one the element that
leads to the next (small: a link, an icon, a label, a cell); the sentence for each level; the theme; the palette and the logo.

## Variants
- **column + index:** the text in a column, with one pill per level and the current one lit; medium pace, 4 levels
  (`example.json`).
- **strip + calm:** the window centered and the sentence in a strip below; 3 levels, in the page's dark theme
  (`example-bottom-strip.json`).
- **fast:** 0.7 s per level and a 1 s dive, to open another piece.

## Script ideas that fit
[The zoom that reveals the impossible](../no-template.md#ideas) (in reverse: from the whole to the detail that proves it),
[New screen without a scare](../no-template.md#ideas), [The brand's whole city](../no-template.md#ideas),
[This is also](../no-template.md#ideas).

## How to render
`$SKILL/templates/infinite-zoom/TEMPLATE.md`. Format examples: `example.json` (text in a column, index, medium pace,
4 levels, light theme) and `example-bottom-strip.json` (text in a strip below, calm pace, 3 levels, dark theme).
