# Growing chart (`growing-chart`)

Bars, columns, a line or a donut that draw themselves on screen with the numbers counting, one chart per scene. The axis, the
labels and the values stay outside the bars; the data comes from the JSON. It works as a video of its own of 6–20 s or as the
data scene inside a bigger video.

**When to use:** objectives `results` (the main one: results, dashboard, metric), `update` (what changed, with a number),
`teach` (a proportion or a trend that explains the subject); channels `site`, `big-screen`, `whatsapp`, `feed`; product
`b2b` (sober), `finance`, `creator` (audience, reach). When there are **2 to 8 numbers in the same unit** to
compare, a **proportion** ("96 of 128") or a **time series**.
**When not to use:** a single number, with no comparison (that's `counting-number`); an invented number or one with no source; internal data
that can't leave the company; more than 8 bars or 12 points (the labels become unreadable: group them into "others"); teaching
where to click. **The number has to be true and have a source** (the scene's `nota` says which one).
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `counting-number` (one number at a time).

## Structure (6–20 s)
- **0–1 s:** the title (the subject, up to 7 words) and the note (the data's source) already written; the axis appears and the camera
  moves 10% closer.
- **1–3 s:** each bar grows, one after the other, with the value counting at its tip; the highlighted one in the strong color.
- **3–5 s:** the whole chart, to be read, with the camera breathing (+2.5%); with `percorrer`, the highlight moves bar by
  bar with the number jumping, and nothing stays still.
- **1–3 more charts** (optional), each in its own scene, with the transition between them (push, whip, mask, zoom or cut).
- **Closing:** only the logo, centered, held ≥ 1.5 s, on the background the brand chooses for it (a limit of the template: no text here).

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** title on top and chart below (`em-cima`), or the chart on one side and the title on the other with a thin rule
  in the middle (`dividido`); the wide ones stretch the chart, not the letters.
- **9:16, 1:1, 4:5:** title on top, chart below; on bars, the label moves up above the bar.

## The request must include
The true numbers, with the source and the date ("counted in the product on the date"); what they measure (the title); the unit
("px", "%"); the item that deserves the highlight; for the donut, the value and the total; the chart type for each scene (bars to
compare, columns for few items with short labels, a line for time, a donut for a proportion).

## Variants
- **horizontal bars with a highlight that moves along:** a ranking, the highlight moves from bar to bar and comes back to the first one
  (`example.json`).
- **donut + columns in a split layout:** a proportion and a comparison, push between them (`example-split.json`).
- **line that draws itself:** a series by month or week, each point lighting up when the line reaches it.
- **bars with an icon:** the brand's icon beside each label (never inside the bar).
- **chart as a data scene:** a single chart, 5 s long, in the middle of another video (render it separately and join them).

## Script ideas that fit
[The customer's question as the title](../no-template.md#ideas), [Weird user stat](../no-template.md#ideas),
[Question and answer with a number](../no-template.md#ideas), [The sum that ends without a price](../no-template.md#ideas).

## How to render
`$SKILL/templates/growing-chart/TEMPLATE.md`. Format examples: `example.json` (title on top, one scene of bars, the
highlight moving along) and `example-split.json` (split layout, donut and columns, push between the scenes).
