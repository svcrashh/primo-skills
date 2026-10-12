# Drawn flow (`drawn-flow`)

A diagram of nodes and arrows that draws itself on screen, stroke by stroke, and a packet that travels the path: each node lights up
when the packet reaches it. The graph comes from the request (nodes, arrows, branches) and is laid out in layers automatically; the nodes can have the
brand's icons. It's the "what this passes through" at a glance: the viewer follows the little dot.

**When to use:** objectives `teach` (how something works inside, with no click screen), `results` (where the data
lives, who approves what), `launch` (the architecture of a new tool); channels `site`, `big-screen`, `feed`, `reels` (the
flow runs downward); product `b2b`, internal, infra, process. Architecture, process, "where the data comes from", the path of a
request, and where the path **stops** (a missing rule or approval: the arrow with a lock).
**When not to use:** teaching where to click (that's `real-screen-camera`); explaining an idea that needs free drawing,
a number or a chart alongside (that's `drawn-explainer`); more than 8 pieces or more than 3 side by side (split it); a cycle (the
flow goes in one direction only); a stack of parts that rest on each other (that's `isometric`).
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `drawn-explainer` (the flow drawn by hand, scene by scene).

## Structure (7–12 s)
- **Frame 0:** the headline (`chamada`) in the pill and the first node already drawing itself.
- **Drawing (1–2 s):** layer by layer, each node's outline is traced, the tile fills in dimmed, the icon and the label
  come in; the arrows draw themselves out from the nodes.
- **Path (0.8–1.5 s per hop):** the packet sets off, waits a moment at each node and travels to the next; the node lights up
  (pulse, ring, full color) and its detail appears. At a branch the packet splits; at a lock it stops at the gate.
- **End (1–1.5 s):** the whole diagram lit up, small dots running along the arrows. It's the cover frame.
- **Closing:** hard cut, mask or zoom through the last node, and the logo held ~2 s.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** horizontal (left to right, text below the node) or vertical; in the `dividido` layout,
  a column on the left with the title and the list of details, which grows with each node that lights up.
- **9:16, 1:1, 4:5:** the flow runs downward, the text beside the node; the camera that follows aims at the Reels safe area.
Text that the camera pushes toward the edge fades out instead of being cut off.

## The request must include
The 3 to 8 pieces with each one's real name (label of up to 5 words) and one true detail line; what connects to
what (the arrows), and where the path stops, if it does; each piece's icon (a single-color set of the brand works best); the
palette; horizontal or vertical; whether the camera follows the packet.

## Variants
- **horizontal + camera that follows + zoom through:** the camera travels along with the packet, close, and goes through the last node
  to the logo (`example.json`).
- **vertical, split, branched, with a lock + static camera:** the left column becomes the list of what each node
  guarantees; the packet splits and stops at the gate (`example-vertical.json`).
- **without icons:** a node without `icone` gets a dot on its tile.
- **dashed:** the arrow that is an option, not a sure path (`tracejada: true`).

## Script ideas that fit
[The customer's question as the title](../no-template.md#ideas), [The fear that becomes a feature](../no-template.md#ideas),
[Advice before the sale](../no-template.md#ideas), [Define by what it isn't](../no-template.md#ideas) (the lock).

## How to render
`$SKILL/templates/drawn-flow/TEMPLATE.md`. Format examples: `example.json` (horizontal, full screen, camera that
follows the packet, zoom through the last node) and `example-vertical.json` (vertical, split layout, branched, with a
lock, static camera, mask).
