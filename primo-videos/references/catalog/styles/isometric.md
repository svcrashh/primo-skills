# Isometric (`isometric`)

Isometric blocks modelled in 3D (WebGL, no perspective), with rounded edges and each face in a flat brand color (no light,
shadow, floor or gradient), that stack up in layers: each layer drops, lands and lights up when it is
named, and its label comes in beside it, outside the blocks, connected by a thin line. The camera orbits slowly, or rises and pulls
away along with the stack. It's the "what sits on top of what" of a system, without drawing the screen.
**Device mode** (`"modo": "aparelho"`): the same three-part story as a soft 3D device under a gentle studio light,
with a short contact shadow: a tray (the base), soft keys in its wells with the brand's icons as they are (the
parts) and a monitor that opens on a hinge (where the product is used). The keys type, the neutral screen loads up to
100% and shows the result. The labels stay in one column with equal spacing and each line is straight and horizontal.

**When to use:** objectives `results` (what a package or a platform has, layer by layer), `teach` (how the
parts rest on each other: the base, the middle, the top), `launch` (the layers of a new product); channels `site`, `big-screen`, `feed`,
`reels` (the exploded stack fills the height); product `b2b`, internal, infra, a tool package. The layers of a
system, of a package, of a platform; steps that build on one another.
**When not to use:** a path with branches or with a lock (that's `drawn-flow`); teaching where to click (that's
`real-screen-camera`); loose items that don't rest on each other (`rolling-list`, `card-bento`); more than 6 layers;
when what matters is the product's real screen (the blocks are abstract).
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `drawn-explainer` (how a system works inside).

## Structure (7–12 s)
- **Frame 0:** the headline (`chamada`) in the pill and the base already landing.
- **Each layer (1–2 s):** drops already solid in its colors, lands with a small squash and a thud; the line draws itself and the
  label (name + detail) rises beside it. With a highlight, the newly named layer stays in the highlight color until the next one.
- **End (1–2 s):** the whole stack, with the camera still moving. It's the cover frame.
- **Closing:** hard cut or mask from the top of the stack, and the logo held ~2 s.

**Device mode (9 s + the 1 s logo opening):** the tray lands with a small squash (0.3 s) and its label comes in;
the keys drop one by one into the wells (1.2–1.6 s); the monitor opens on its hinge (1.9–2.75 s); the keys type 10
times while the screen's bar fills from 0 to 100% (3.0–4.8 s); the screen shows the result ("Checked ✓", 5.05 s); a
hold with the device turning slowly; hard cut to the logo (6.6 s). Each label line appears ready, with its label.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** the stack on one side, the labels on the other, the group centered across the width.
- **9:16 and 4:5:** the exploded stack (layers spread apart) fills the height, labels beside it, inside the Reels safe area.
- **1:1:** slightly exploded.
The label follows the height of its layer and never sits on top of a block.
**Device mode:** horizontal only (16:9, 19:9, 21:9); the device on the left, the label column on the right.

## The request must include
The 2 to 6 layers, from bottom to top, with each one's real name (up to 5 words) and one true detail
line; how many blocks each layer has (the parts: 4 features = 4 blocks); the three colors of each layer (three shades
of the same color family of the brand read best); which side the labels go on; orbit or rising with the stack.
Device mode: exactly 3 parts (the base, 2 to 6 keys with a color and a brand icon each, where the product is used), the
screen's two short status texts (loading, done) and its neutral colors.

## Variants
- **device (`modo: aparelho`) + studio light + light background:** the product as a device that loads and shows the
  result; one key per part, each in a brand color with the brand's icon, a monitor in a brand color, a neutral screen
  (`example-device.json`).
- **orbit + labels on the right + calm pace + hard cut:** each layer in a color family of its own; the camera turns
  slowly and shows the faces (`example.json`).
- **dolly-3d + labels on the left + exploded + highlight + fast pace + mask:** the camera starts close to the base and
  rises with the stack; the named layer lights up in the highlight color and goes back to its own
  (`example-exploded.json`).
- **chosen turn and tilt:** `giro: [70, 25]`, `inclinacao: 34` in the JSON, so the orbit shows another face of the stack.

## Script ideas that fit
[This is also](../no-template.md#ideas), [What's coming this month](../no-template.md#ideas) (the new layer on top),
[The brand's whole city](../no-template.md#ideas).

## How to render
`$SKILL/templates/isometric/TEMPLATE.md`. Format examples: `example.json` (a stack of layers, orbit camera),
`example-exploded.json` (exploded stack, dolly-3d, labels on the left, highlight, mask) and `example-device.json` (the
device mode: a tray, keys and a monitor).
