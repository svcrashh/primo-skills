# Drawn explainer (`drawn-explainer`)

Explains an idea, a flow or "how it works inside" with a drawing that appears on the word in the line: the box comes in
when the voice says its name, the arrow connects one piece to another on the verb, the number counts when it's said. In the same template, a
stretch of interface demo shows the concrete example, in the brand's colors, fonts and logo.
Port of [explainroo](https://github.com/vincentsch/explainroo) (MIT license, in `templates/drawn-explainer/LICENSE-explainroo.txt`).

**When to use:** objectives `teach` (an **idea**, not where to click) and `launch` (B2B that needs to explain how it
works before selling); channels `site` (the main one: website, help center, YouTube), `feed` (LinkedIn, 4:5 and 1:1,
for B2B), `reels` (stacked scenes); product `b2b`, `layperson`, `finance`, and a product without a pretty screen or that's hard to
understand (API, infra). How something works inside: data flow, the steps of a process, why a number comes out
that way; conceptual onboarding; "what happens when you click pay". In the script: `--concept`.
**When not to use:** a where-to-click tutorial (that's `real-screen-camera`); a list of new features (`rolling-list`,
`chapters-with-index`); a product whose appeal is visual, like games and fashion (`before-after`, `light-trail-teaser`);
a launch that looks like an event (`light-trail-teaser`).
**Voice:** optional (opt-in, paid; `references/voice-script.md`). Each spoken scene lasts its line, each piece comes in
on the word that names it and the caption is the speech. How: `templates/drawn-explainer/TEMPLATE.md`, "With voice
(optional)".
**Catalog rules here:** arrows and circles are the drawing of the idea, linking one piece to another; in the demo stretch, the
highlight is still the darkened background (rule 3). The hand-drawn stroke is the shapes' stroke (Rough.js); hand-drawn
illustration and characters remain out of reach (`../rules.md`).

## Structure (20–90 s)
- **Frame 0 (0–2 s):** the question or the problem already written in the frame ("What happens when you click
  pay?"). No empty frame waiting for the voice.
- **The diagram, one beat per sentence:** each piece comes in on the word in the line, by the timings in `narration.json` (without voice, at reading pace): the box on the
  name, the arrow (with a curve and a label) on the verb that connects, the icon, the hand annotation (underline, circle, box,
  highlighter, strike-through, bracket) on what matters. Something changes every 2–4 s; up to 5–6 elements on screen; one idea per
  scene; the camera follows when the drawing grows.
- **The concrete example:** the true number that counts, the chart that draws itself (bars, line, pie), the code or
  the terminal that types itself, or the interface demo with a cursor and typed text, with the product's real media
  (rule 15).
- **Closing (3–4 s):** the summary sentence, written, and the logo held ≥ 1.5 s.
Without voice (the default), the scenes advance by duration, with the same script and the text in the frame; with
voice, by the lines.

## Formats (recomposed, not cropped)
- **16:9:** the diagram runs from left to right (input → steps → output); caption at the bottom.
- **9:16:** stacked from top to bottom, inside the safe area of Reels, TikTok and Shorts (x 70–940, y 250–1450);
  caption just above the bottom strip.
- **4:5 and 1:1:** compact stack, 60 px margin.
The pieces change places in each format; none of them shrinks to fit.

## The request must include
The idea in one sentence; the 3–6 steps or pieces of the diagram with each one's real name (what the product calls it, not a
nickname); a true number or example, if there is one; the real screens (or the media: avatar, icons, photos) if it has the
demo stretch; colors, fonts and logo from the project reading (`references/reading.md`); the closing sentence.

## Variants
- **hand-drawn whiteboard:** paper texture, Rough.js stroke.
- **chalkboard:** chalk.
- **blueprint:** blueprint lines, for engineering and infra.
- **clean:** straight stroke, pop entrance.
- **night:** glowing stroke.
- **flow with arrows:** the pieces linked by arrows with a curve and a label, in the order in which things happen.
- **drawn before and after:** the old way crossed out, the new one drawn in its place.
- **chart that draws itself:** bars, line or pie growing, with the number that counts.
- **code or terminal that types itself:** the call, the command, the response, line by line.
- **interface demo:** card, browser, window over a darkened background, a notice that slides up, a title that comes out of the blur
  word by word, a field with typed text and a cursor, an answer word by word, menu, toggle, chips, badges,
  progress, a mouse cursor that moves in a curve and clicks with a ripple, the brand color that spreads and fills the frame.
The textures (paper, chalk, blueprint, night) go on top of the brand colors: they never change the palette or the font (rule 16).

## Script ideas that fit
[The customer's question as the title](../no-template.md#ideas), [Advice before the sale](../no-template.md#ideas),
[The number built from pieces](../no-template.md#ideas), [The sum that ends without a price](../no-template.md#ideas),
[The old way taken to the absurd](../no-template.md#ideas), [Define by what it isn't](../no-template.md#ideas),
[The fear that becomes a feature](../no-template.md#ideas).
Two styles from the "without a template" list are this one: [Concept before the screen](../no-template.md#styles-without-a-template) and
[Metaphor with the data](../no-template.md#styles-without-a-template).

## How to render
`$SKILL/templates/drawn-explainer/TEMPLATE.md`. Format examples: `example.json` (cover, three flat cards, closing; 16:9
and 9:16), `example-counts.json` (counting numbers, split layout, push between the scenes) and
`example-pull-back.json` (a single frame; the camera starts close and pulls back). Soundtrack and sounds are the skill's. Draft at 30 fps; final at
60 fps with motion blur.
Without narration, each scene advances by the reading time of its text. With voice, the voice comes from
`scripts/voice.mjs` (`narration.json` gives the time of each word), and each spoken scene advances by its line.
