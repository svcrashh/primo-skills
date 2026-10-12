# Style catalog

What the skill knows about **which look to give the video**: the 22 styles the engine can make (20 templates in
`templates/`, the chapters with index and the panel tutorial series), the rules that apply to all of them and how to
choose. It comes from a study of 182 videos actually watched (contact sheet, measured cuts, transcribed speech).

**No style carries a brand.** The colors, the font, the logo and the content are the person's; what a style looks like
in their brand is a still made on demand, shown before anything is animated.

The list, in one command (the only list: name, what it is for, what it needs, the template):

```sh
node $SKILL/scripts/catalog.mjs list --format md      # the table for the chat (--lang pt in Portuguese)
node $SKILL/scripts/catalog.mjs show <style>          # one style: template, card and format example
node $SKILL/scripts/catalog.mjs open --folder <video-folder> [--brand <brand>]   # the list as a page, with the person's own stills and delivered videos
```

Order of use:
1. **The person's own idea, first:** a style they name, describe or show. On the list: its card. Not on the list:
   [`no-template.md`](no-template.md) says the closest template, or it is built from their reference.
2. [`rules.md`](rules.md): the rules for any video and what the engine does not do. Always read it.
3. [`choosing.md`](choosing.md): objective × channel × product kind → styles in order of preference, plus the shortcuts.
   It gives the recommended one and 2 or 3 more alternatives, for when the person has no idea yet or asks for yours.
4. `styles/<id>.md`: the card of the chosen style (structure with timings, 16:9/9:16/1:1, what the request needs to
   bring, where the template and its format examples are).
5. [`variety.md`](variety.md): the ten axes of a direction and the rule that keeps a brand's videos from repeating.

**With voice** (opt-in and paid, only when the person asks: `references/voice-script.md`), the choice narrows: the
styles that take narration are the panel tutorial, `chapters-with-index`, `drawn-explainer`, `rolling-list`,
`counting-number`, `light-trail-teaser`, and `real-screen-camera`, `before-after` and `typing-text` (in these three,
with voice there is no music: the voice alone, or the voice and the effects in `typing-text`). The others have no narration; the **Voice:** line of each card names the closest style that takes
it. Without voice, every style stays as it is.

The cards: [`real-screen-camera`](styles/real-screen-camera.md) · [`typing-text`](styles/typing-text.md) ·
[`rolling-list`](styles/rolling-list.md) · [`counting-number`](styles/counting-number.md) ·
[`before-after`](styles/before-after.md) · [`light-trail-teaser`](styles/light-trail-teaser.md) ·
[`chapters-with-index`](styles/chapters-with-index.md) · [`drawn-explainer`](styles/drawn-explainer.md) ·
[`chat-bubbles`](styles/chat-bubbles.md) · [`ticking-checklist`](styles/ticking-checklist.md) ·
[`growing-chart`](styles/growing-chart.md) · [`timeline`](styles/timeline.md) · [`card-bento`](styles/card-bento.md) ·
[`card-stack`](styles/card-stack.md) · [`phone-3d`](styles/phone-3d.md) · [`infinite-zoom`](styles/infinite-zoom.md) ·
[`drawn-flow`](styles/drawn-flow.md) · [`isometric`](styles/isometric.md) ·
[`kinetic-typography`](styles/kinetic-typography.md) · [`photo-mosaic`](styles/photo-mosaic.md). The typing terminal
is described in `templates/typing-terminal/TEMPLATE.md`, and the panel tutorial in `references/tutorial.md`.
