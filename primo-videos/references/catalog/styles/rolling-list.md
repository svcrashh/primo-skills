# Rolling list (`rolling-list`)

New features without an index: each item is **a short sentence + the screen proof**, at a pace picked with a speed
knob, and a wall at the end shows the size of the update.

**When to use:** objectives `update`, `launch`, `results` (with the wall); every channel, and it's the only one with a good 1:1 and
4:5 for the feed; product `young` (burst), `game` (numbered list), `creator` (showcase), `b2b` (≥ 2 s per item). It's the
natural switch when the product's last video was `chapters-with-index`.
**When not to use:** teaching step by step (nobody replays a 1 s item); a single new feature; an audience that doesn't yet
know what the product is (it becomes noise).
**And also not when the person asking wants an explanation** ("give me a quick rundown") or has already approved a chapters video
of the same product: with a still screenshot as proof inside the panel and the same composition for every item, the video looks all
the same and has no thread. If you use it, the proof is a redesigned interface that moves (rule 13), never the still screenshot.

## Structure (15–60 s)
- **0–2 s:** the promise with the number or the version name ("12 new features in October", "Version 3").
- **Items:** short sentence (1–6 words) + live screen proof (cursor, panel opening, number changing). Speed:
  - **burst:** 0.8–1.2 s per item, without explaining (Reels, young audience, existing users);
  - **list:** 2–3 s per item, numbered tag always in the same corner (patch notes, B2B);
  - **poster card and proof:** 1.5–2.5 s poster card → 4–6 s proof (launch with 3–5 benefits).
- **Wall (3–5 s):** the device in the center and dozens of new feature names on the sides; the quantity is the message.
- **Closing:** a 4–8 word sentence (can be split into two cards) + logo + address.

## Formats (recomposed, not cropped)
- **16:9:** proof at ~55–65% of the width over a color or light background; tag in the bottom left corner.
- **9:16:** sentence in the top third, proof at 85–90% of the width below; name on 2 lines if needed.
- **1:1 and 4:5:** pill badge at the top, cropped screen filling the width, short caption at the bottom.
The new feature tag stays **always in the same corner**: the eye learns where to read.

## The request must include
The list of new features with one sentence each, split into big and small ones; 1–5 s of screen for each (recording or HTML);
which ones are paid/beta; the complete list for the wall; the closing and the address.

## Variants
feature burst · lightning list (huge name ↔ 1 s of UI, "And more!") · numbered list · phrase card with a
lightning round at the end · poster card and proof · features in the feed (1:1/4:5) · dismantled UI and wall · phrase that lights up ·
sliding card stack · name that decodes itself · isolated component in the dark ("the screen changed").

## Script ideas that fit
[Trailer that is a list](../no-template.md#ideas), [What's coming this month](../no-template.md#ideas),
[Catchy jingle with a list](../no-template.md#ideas), [Chorus that repeats the promise](../no-template.md#ideas),
[One promise per scene](../no-template.md#ideas).

## How to render
`$SKILL/templates/rolling-list/TEMPLATE.md`. Format examples: `example.json` (burst speed, a flat color per item),
`example-poster.json` (poster speed: the poster card, then the proof) and `example-list.json` (list speed, items
with push).
