# Kinetic typography (`kinetic-typography`)

Big words, alone on screen, that come in on the beat, stack up, rotate and rearrange themselves, with the brand's shapes
beside them. Each sentence is a color frame; the change is a hard cut on the beat or a mask that opens from the shape. A
6–15 s video or the opening of another one.

**When to use:** objectives `update` (short internal announcement), `attention` (opening of a video or of an event), `results`
(summing up 3 facts); channels `site`, `big-screen`, `feed`, `reels`; product `b2b` and internal audience. Works without sound.
**When not to use:** teaching how to use something (that's a tutorial); a subject that needs a long sentence; no fact to show. **By
default the text is informative: name, number, fact.** It's the style where it's easiest to slip into a slogan: "4 features" and
"Website and mobile app" yes; "faster", "transform" only when the brand has a slogan and the person wants it.
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `rolling-list` (`cartaz`: one big sentence per card).

## Structure (6–15 s)
- **0 s:** the 1st line already coming in (frame 0 never empty), the sentence's shapes bouncing along.
- **Sentences (2–4 s each, 2–4 of them):** 1 to 5 short lines, one per beat (half a beat at the fast pace), each with
  its own way of coming in (rises from the mask, rotates into place, drops big and settles, slides with a motion blur); the stack
  re-centers with each line; while waiting, the lines pulse on the beat. Optional: the stack turns into a single line.
- **Change:** on the beat, a hard cut or the next sentence's color opening from the biggest shape (mask), push or whip.
- **Closing:** only the logo, coming in on the beat and held ~2 s.

## Formats (recomposed, not cropped)
- **16:9:** text in a column at 58% of the usable width, shapes in the other one bleeding off the edge; or text at 80% of the width
  and shapes in the corners (full screen).
- **9:16:** text on top (64% of the usable height), shapes below.
- **1:1:** like 9:16.

## The request must include
2 to 4 short facts (names, numbers), each in up to 7 words per line; the dominant color; whether it's the opening of another
video or a video of its own.

## Variants
- **column + giant symbol:** the brand symbol cropped in the other column, turning slowly, and the mask opening
  from it (`example-left-column.json`).
- **full screen + hard cut:** lines dropping every half beat, flat shapes in the corners, slow zoom while waiting
  (`example.json`).
- **the stack turns into a line:** the sentence's lines rearrange into a single line (best in full screen).
- **number + word:** `*128* items`, the number in bold and the word light, on the same line.

## Script ideas that fit
[Word triptych](../no-template.md#styles-without-a-template), [Weird user stat](../no-template.md#ideas),
[What's coming this month](../no-template.md#ideas), [Ad that's already over](../no-template.md#ideas).

## How to render
`$SKILL/templates/kinetic-typography/TEMPLATE.md`. Format examples: `example.json` (full screen, guided zoom, hard cut
on the beat) and `example-left-column.json` (left column, static camera, mask, the giant symbol).
