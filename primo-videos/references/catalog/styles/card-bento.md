# Bento grid (`card-bento`)

A bento grid (cards of different sizes, fitted together) that assembles piece by piece. Each card carries an icon, a
short title and a drawn mini-visual; the camera roams across them, each card's visual animates when the camera gets
there, and at the end it pulls back to the whole grid. It's the "overview" that reads at a glance and makes sense in the detail.

**When to use:** objectives `update` (what comes in a version, item by item), `launch` (the features of a new product),
`results` (what a package or a team delivers, with each item's number); channels `site`, `big-screen`, `feed` (1:1 and 4:5
recomposed); product `b2b`, internal, platform with several parts.
**When not to use:** teaching the click path (that's `real-screen-camera`); a single feature or a single number
(`counting-number`); more than 9 items (the grid gets tiny: split it); when what matters is the product's real screen (the
mini-visual is a drawing, not a screenshot).
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `chapters-with-index` (one feature per chapter).

## Structure (10–15 s)
- **0–1.5 s:** the cards come in one by one until the grid is complete; or, in the "along the way" assembly, the first one already in close-up.
- **Visits (1.2–2.2 s each):** the camera goes to a card (guided zoom or tracking), its visual animates (bars
  grow, colors light up, a number counts, a wave locks in); the neighbors' text fades so nothing is left cut off at the edge.
- **Pull-back (1.2–1.8 s):** the whole grid, everything done. It's the cover frame.
- **Closing:** zoom through a card, push, whip, mask or flip to the logo, held ~2 s.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** 4 columns; the wide ones stretch the cells across the width.
- **9:16:** 2 columns inside the Reels safe area; the camera brings each card to its center.
- **1:1 and 4:5:** 3 columns.
The grid is packed again in each format (a leftover card stretches into the gap), not cropped.

## The request must include
3 to 9 items, each with a title of up to 7 words and one detail line; the size of each card (the main one
bigger); for each, what the mini-visual shows (colors, bars, a true number, page, slides, player, wave,
letters, or the brand's own images); each one's icon, if any (a single set in one color reads best; it is the
brand's choice); the palette.

## Variants
- **guided zoom + assembly first:** the grid assembles, the camera visits each card in close-up and pulls back (`example.json`).
- **tracking + assembly along the way:** the camera glides from card to card at a fixed zoom, each card comes in as
  the camera arrives, and the whole grid only appears on the pull-back, as a reveal (`example-travelling.json`).
- **only some visited:** `visitar` picks the cards shown in close-up; the others come in on the pull-back.
- **with images:** the brand's logos, photos or illustrations inside the cards (marked: no text crosses the image).

## Script ideas that fit
[What's coming this month](../no-template.md#ideas), [This is also](../no-template.md#ideas),
[Weird user stat](../no-template.md#ideas) (a card with the number), [The brand's whole city](../no-template.md#ideas).

## How to render
`$SKILL/templates/card-bento/TEMPLATE.md`. Format examples: `example.json` (4 cards, guided zoom, the grid assembles
first, closing by zoom through a card) and `example-travelling.json` (7 cards on a dark background, tracking camera,
assembly along the way, cards with images, closing by push).
