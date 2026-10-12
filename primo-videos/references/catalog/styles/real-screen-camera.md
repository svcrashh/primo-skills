# Real screen with camera (`real-screen-camera`)

A tutorial with the real recorded screen, and a camera that zooms and glides to the current field, with a scrim and blur over the rest.
The person recognizes the real button and can read everything.

**When to use:** objective `teach` (outside the table, also a SaaS tour or a camera over the UI in a launch);
any channel except the big screen; product `layperson`, `b2b`, `finance`. A flow of 3 to 8 steps on a phone or a computer.
**When not to use:** announcing or selling to people who don't know the product (there's no hook); a flow with 15+ steps (break it into videos);
feed without a hook; a screen that can't be recorded.

## Structure (30–60 s; a tutorial the person follows along with can run longer)
- **0–2 s:** the written promise ("How to sign in with the invite") with the screen already behind it. Wide shot of the screen for 1–2 s.
- **Each step (4–8 s):** the camera goes to the step's region (1.8–3×), dark scrim + blur outside it, tap
  ring or cursor, step card ("Step 3 of 7" + an 8–14 word sentence) or a caption that matches the line.
- **Between stages:** a 2–3 word intertitle alone on the background, ~1.5 s.
- **Closing (3–4 s):** the result in close-up and "Done! That's all." with the logo.

## Formats (recomposed, not cropped)
- **16:9:** computer in a laptop or browser mockup frame; phone on the right with the title on the left. On the
  computer, never the whole window with small text: the camera comes in until the text is ≥ 3% of the height.
- **9:16:** phone at ~85% of the width with the step card at the top; computer cropped to one column of the UI, with a
  karaoke caption (the current word in a color box).
- **1:1:** square crop of the block in focus, step card below.

## The request must include
A test account with nice-looking sample data (no "test123"); the list of steps with the exact label of each
button; who will watch; which device. The position of each field comes from Playwright (`boundingBox`), which becomes the
camera's script.

## Variants
- **device in the scene:** phone, the group in focus "rises" as a card over the scrim (short flow, people in a hurry).
- **from laptop to detail:** three camera levels, whole laptop → window → dialog.
- **camera that roams:** dense SaaS, UI without a mockup frame, cut off at the edges, sober tone.
- **floating window with macro:** the window over a drawn background, alternating with a 2.5–3× macro; shortcut
  keys drawn in the corners.
- **lightning (9:16):** one step every 1.5–3 s, a promise with a time in the title ("in under 60 s").

## Script ideas that fit
[Objection ahead of time](../no-template.md#ideas), [Talks to the viewer](../no-template.md#ideas),
[One task from start to finish](../no-template.md#ideas), [Little find that fixes an annoyance](../no-template.md#ideas).

## How to render
`$SKILL/templates/real-screen-camera/TEMPLATE.md` (and `references/tutorial.md` for recording with Playwright).
Format examples: `example.json` (card on the left, hard cut), `example-card-below.json` (strip at the bottom, mask,
travelling camera, symbol in the background) and `example-card-right.json` (card on the right, push, diamonds in the
background), each one with its own `-journey.mjs`.
