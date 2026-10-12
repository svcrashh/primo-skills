# Ticking checklist (`ticking-checklist`)

Items that get checked (✓) or crossed out (✕), one at a time, with a counter that goes up ("4 of 6"): in a single list
being checked off, or in two columns, "Do" and "Don't". A 6–12 s video.

**When to use:** objectives `teach` (requirements, what needs to be ready), `update` (what the version does and what it
doesn't do yet), `results` (the check that was done); channels `site`, `whatsapp`, `feed`, `big-screen`, `reels`; product `b2b`,
`layperson` and internal audience (process, policy, a limit stated head-on). Works without sound.
**When not to use:** new features that need screen proof (`rolling-list`); a where-to-click step by step
(`real-screen-camera`); more than 8 items per list. **Each item is a verifiable fact**, never a catchphrase
("faster", "hassle-free").
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `rolling-list` (one item per line of the list).

## Structure (6–12 s)
- **0 s:** the title and the cards already on screen, with the items and each one's empty circle.
- **Items (0.5–1.3 s each):** one at a time, the circle fills with a spring and the ✓ draws itself, or the ✕ marks and strikes through the text
  behind it; the counter goes up and pulses; in the list, the current item's highlight bar moves to the next one.
- **Breather (~1 s):** the complete list, the counter full ("4 of 4").
- **Closing:** only the logo, held ~2 s.

## Formats (recomposed, not cropped)
- **16:9:** two columns side by side, or the list on the left and the big counter on the right.
- **9:16:** the columns one below the other, or the list on top and the counter below, inside the Reels area.
- **1:1:** like 9:16.

## The request must include
The items (up to 8 per list, one line each) and each one's mark (✓ or ✕); the title of the list or of the columns; the counter's
label ("checked", "ready"); the pace (fast for a glance, calm for a check); the dominant color.

## Variants
- **do's and don'ts:** two columns with their own colors, ✓ in one and crossed-out ✕ in the other, a counter in each one's header,
  fast pace, still camera and hard cut (`example-columns.json`).
- **check that follows:** a single list, the current item's bar, the big counter beside it, a light zoom that
  follows each item and the mask coming out of the counter (`example.json`).
- **list with one no:** the per-item mark (one ✕ in the middle of a list of ✓), for what isn't allowed (`"marca": "nao"` on the item).

## Script ideas that fit
[Define by what it isn't](../no-template.md#ideas), [The skeptics vs. the product](../no-template.md#ideas),
[Objection ahead of time](../no-template.md#ideas), [What's coming this month](../no-template.md#ideas).

## How to render
`$SKILL/templates/ticking-checklist/TEMPLATE.md`. Format examples: `example.json` (a single list with the big counter,
calm pace, camera that follows, mask) and `example-columns.json` (two columns, do's and don'ts, fast pace, still
camera, hard cut).
