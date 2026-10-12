# Timeline (`timeline`)

An axis with milestones that light up in sequence: each milestone is a step or a date and a line of text (and, if you want, an
icon beside it). The axis is horizontal or vertical, and the camera travels along it (tracking), stays still with the whole axis
in the frame, or moves close to the current milestone and travels with it (guided). It's for showing **order**: what comes before, what comes after.

**When to use:** objectives `teach` (the steps of a process, without the click screen), `results` (the history, what has already
been done and when), `update` and `launch` (the roadmap, what's coming and when); channels `site`, `big-screen`, `whatsapp`,
`feed`; product `b2b` (internal process, onboarding), `creator`. Also "a day with": the routine hour by hour.
**When not to use:** teaching where to click (that's a tutorial); items with no order between them (that's `rolling-list`); a number that
proves everything (that's `counting-number`); more than 10 milestones (it becomes a list); invented dates or steps.
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `rolling-list` (numbered items, in order).

## Structure (8–20 s)
- **0–0.4 s:** the title already written at the top; the axis track appears and the progress runs up to the first milestone.
- **Each milestone (1–4 s):** the dot lights up (hops and settles), the pill with the step or the date rises, the line of text rises;
  when traveling, the camera reaches the milestone at the instant it lights up. 4 to 8 milestones give the best pace.
- **Last milestone:** held still to be read (≥ 1.4 s).
- **Closing:** only the logo, centered, held ≥ 1.5 s; the transition can start from the last dot (zoom through it, a circle
  mask) or push the axis out (push, in the axis's direction).

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** horizontal with travel (the lit milestone a little to the right of center, the previous one still legible) or
  vertical in a column on the left (pills on one side of the axis, text on the other); the wide ones show more of the axis.
- **9:16:** the vertical one fits better (the text gets the full width to the right of the axis); the horizontal one shows one
  legible milestone at a time.
- **1:1 and 4:5:** like 9:16, shorter.

## The request must include
The steps or the dates, in order, with a line of up to 7 words each; whether they are steps (process) or dates (history,
roadmap); the title; whether you want icons (the brand's, a single-color set per piece); how much time per milestone (the default is 1.4 s).

## Variants
- **horizontal with travel and icons:** the path of a request, step by step, zoom on the last dot (`example.json`).
- **vertical with guided camera:** a project's history in 4 dates; the camera moves close to each date when it
  lights up and pulls back to the whole list before the push to the closing (`example-vertical.json`).
- **still vertical:** the whole axis in the frame, no camera; only for 3–4 short milestones (it holds still between them).
- **vertical with travel:** 6 to 10 steps that don't fit when still; what moves up disappears before reaching the title.
- **roadmap:** future dates as milestones, the last one lit is the next launch (without promising what hasn't been decided).
- **a day with:** times as dates ("09h", "12h"), a line about what happens at each one.

## Script ideas that fit
[One task from start to finish](../no-template.md#ideas), [Generations in one film](../no-template.md#ideas),
[Day count](../no-template.md#ideas), [The list of lives](../no-template.md#ideas).

## How to render
`$SKILL/templates/timeline/TEMPLATE.md`. Format examples: `example.json` (horizontal, seven steps with icons, the
camera travelling, zoom into the closing) and `example-vertical.json` (vertical, four dates, guided camera, push).
