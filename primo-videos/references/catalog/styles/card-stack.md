# Card stack (`card-stack`)

Stacked cards, one per tip, step or rule. The top one stays long enough to be read and leaves (slides to the side or flips
up like a notepad sheet), the one below rises into its place and the "2/5" counter moves on. It's the swiping grammar that
everyone knows, for content read in a short sequence.

**When to use:** objectives `teach` (short steps, no screen), `update` (usage tips), `attention` (rules, warnings);
channels `reels` and `whatsapp` (9:16), `feed` (1:1 and 4:5), `site`; internal audience, onboarding, quick guide.
**When not to use:** the click path on a screen (that's `real-screen-camera`); more than 8 cards (split into two
videos); long text (each card takes a title of up to 7 words and one line); comparing two things (that's
`before-after`); numbers that need to stand out (`counting-number`).
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `rolling-list` (one tip or step per item, numbered).

## Structure (8–15 s)
- **0–0.9 s:** the stack comes in from below, the series title and the "1/N" counter already in place.
- **Cards (1.9–3.1 s each, by word count):** the title and the line rise word by word; the card leaves
  (swipe or flip), the next one rises and changes to the top card's color, the counter rolls.
- **Closing:** the last card leaves and the transition (whip, flip, push, mask) leads to the logo, held ~2 s.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** `centro` layout (header on top, the stack in the middle) or `dividido` (big title and counter
  on the left, with progress dots; the stack on the right, leaving to the right).
- **9:16 and 4:5:** header on top (title and counter), the stack filling the width of the safe area.
- **1:1:** like 9:16, with a shorter card.

## The request must include
2 to 8 cards, each with a title of up to 7 words and a line of up to 7 (true text, preferably what's
already written in the product's guide or in the rule); the series title; each one's icon, if any (a single set in
one color reads best; it is the brand's choice); the color of the background, of the card and of the cards behind it.

## Variants
- **split + swipe:** big title and counter on one side, the stack on the other, the cards behind slightly rotated
  (`example-split.json`).
- **center + flip:** the stack in the middle, counter in a pill, each card flips up and the camera slowly moves closer
  while it's being read (`example.json`).
- **without icon:** only the title and the line, in a larger size.

## Script ideas that fit
[The interface the audience already knows](../no-template.md#ideas), [Numbered tips](../no-template.md#styles-without-a-template),
[The skeptics vs. the product](../no-template.md#ideas) (one objection and one fact per card),
[Each objection becomes a character](../no-template.md#ideas).

## How to render
`$SKILL/templates/card-stack/TEMPLATE.md`. Format examples: `example.json` (center layout, flip, camera that moves
closer, closing by flip) and `example-split.json` (split layout, swipe, the cards behind rotated, closing by whip).
