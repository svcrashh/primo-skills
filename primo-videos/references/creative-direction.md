# Creative direction

## Contents
1. Anatomy of a product video
2. Where ideas come from (for the 3 concepts)
3. Catalog of moves and transitions
4. Pace and timing
5. Typography, color and composition
6. On-screen text
7. Review list (before showing anything)
8. Anti-clone

---

## 1. Anatomy of a product video

The structure that holds attention is: hook, tension, turn, proof, emotion and sign-off. The proportions change with the length:

| Beat | 15 s | 30 s | 40 s | 60 s | Function |
|---|---|---|---|---|---|
| Hook | 0–2 | 0–3 | 0–4 | 0–5 | something is already moving at frame 0; the brand shows up or is promised |
| Tension | 2–5 | 3–9 | 4–10 | 5–16 | the problem, the "before", what bothers the audience |
| Turn | 5–7 | 9–12 | 10–12 | 16–20 | the line that changes the game, with a build in the music |
| Proof | 7–12 | 12–24 | 12–28 | 20–44 | the product working: 2 to 4 scenes, one idea per scene (in the 15 s, just one) |
| Emotion | — | 24–27 | 28–34 | 44–52 | who gains from it; a breather or breakdown |
| Sign-off | 12–15 | 27–30 | 34–40 | 52–60 | impact, the exact logo alone (no sign-off line, no address) |

This is a starting point, not law. A typography-only video, or a "day in the life", rearranges everything. Just don't give up three things: the hook, one idea per scene and a clean sign-off.

## 2. Where ideas come from

Generate the 3 concepts from **different sources**. That way they come out truly different, and not three versions of the same one.

- **The logo's metaphor:** does the logo already tell a story? Pieces that fit together, a leaf that grows, a wave, a dot that becomes a line. Animate the story, not the drawing.
- **The product's gesture:** what gesture does the user make? Tap, drag, check, chat, pay. Turn the gesture into a transition.
- **Before → now:** lines about the problem that transform into the solution (strike and swap, flip the card, erase and rewrite).
- **True number:** a real, verifiable figure (time saved, steps, students), shown big, with a counter. Never make one up.
- **A day in the life:** the routine of a person from the audience, from the start to the end of the day, and where the product comes in.
- **Typography as protagonist:** the text is the image. Words in a grid, scale, changing weight, letters that become shapes.
- **Object that transforms:** a shape goes through the whole video turning into things (dot → chart → phone → logo). It's the continuous *match cut*.
- **Infinite zoom:** each scene lives inside a detail of the previous one.
- **Map, network or system:** nodes that connect, showing how the product's parts talk to each other (template:
  `drawn-explainer`, arrows that link the pieces on the word in the lines).
- **Editorial collage:** paper, cutouts, grain and tape, for a handmade or warm brand.
- **Choreographed interface:** the UI rebuilt in HTML with the product's tokens, dancing to the pace (taps, lists that come in, charts that draw themselves).
- **Contrast of worlds:** chaotic black and white × color and order; noise × silence.

For each concept, define the **signature move**: the visual gesture that comes back at the start and at the end and ties the video together. It comes from this brand, from sections 1 to 3 of the reading: a logo made of pieces calls for fitting together, a delivery product calls for a route, a recipe notebook calls for turning a page.

## 3. Catalog of moves and transitions

Choose 4 to 6 for the video and don't repeat the same transition twice in a row. The code recipes are in `engine.md`.

**Text entrances and exits**
- Per-word mask (`riseWords`): the elegant default, with a 0.06–0.09 s stagger and outExpo easing.
- Letter by letter with a spring (`spring` on the scale): for the keyword, one letter per sixteenth note.
- Strike and swap: a drawn stroke crosses it, the old letters fall with gravity and the new line rises with a highlighter.
- Typing with a cursor: for a message, chat or report.
- Counter and odometer: numbers that roll.

**Transitions between scenes**
- Dive (zoom-through): the camera goes into a shape until its color fills the screen, and the next scene is born from that color. Use `pontoInterno()` so it doesn't leak past the edge.
- Iris: a circle that grows from a point **with meaning**, like a word, a button or a notification.
- Element that becomes the screen: a pill, card or notification that grows to the whole frame.
- Push: the new scene pushes the old one, vertically or horizontally, on the beat.
- Whip-pan: a fast pan with motion blur, from scene A to scene B side by side.
- Collapse into dots: panels turn into dots, the dots merge into one and it grows until it becomes the next scene's background.
- 3D flip: a card flips (`perspective`, `backface-visibility`); the front is one version and the back is another.
- Particle dissolve: letters shed dots and come apart with blur.
- Match cut: the same shape or color in the same position in both scenes, with a hard cut on the beat.
- Hard cut on the downbeat: the strongest of all when the music hits. Don't be afraid of it.

**Life and emphasis**
- Organic shapes breathing in the corners (`breathe`), bleeding off the frame.
- A shock ring on impact, instead of a full-screen flash (the flash turns gray).
- A short camera shake on impacts (`VIDEO.impactos`).
- A scale pulse when something "lights up" (`pulse`), with a ripple coming out.
- A stroke that draws itself (`traco`): underline, connection, line chart; by hand (Rough.js), with underline, circle,
  highlighter and strike-through annotations: `drawn-explainer`.
- A shine that crosses the logo (a gradient clipped by the logo itself).
- Sparkles, confetti and particles only at the climax, never as constant decoration.
- A 12 fps "boil" (texture or outline that jitters) for a handmade look.

## 4. Pace and timing

- **Grid:** choose the BPM together with the length. At 120 BPM, a beat lasts 0.5 s, a bar 2 s, and 20 bars give 40 s. At 100 BPM, a bar is 2.4 s. Every cut, fit and keyword lands on a beat; the details, on eighth or sixteenth notes.
- **Sync sheet:** it's the contract between image and sound. Every on-screen event with its own sound becomes a marker in `sheet.json`. Changed a scene? Change the sheet and tell the soundtrack.
- **Reading time:** count from the moment the text finishes coming in until it leaves.
  - 2 to 4 words need ≥ 0.7 s.
  - 5 to 10 words need ≥ 1.5 s.
  - A paragraph needs slow typing plus 1 s.
  - When in doubt, give it more time.
- **Anticipation:** before the drop and the final logo, the motion "pulls" inward for 0.15–0.25 s, and the music goes silent or just breathes.
- **Speed contrast:** a fast entrance (outExpo, ~0.4 s) with a slow hold reads better than everything at medium speed.
- **Breather:** around 2/3 of the video, a calmer moment (breakdown) comes in before the climax. Without it, the ending has no weight.
- **Final hold:** the logo stays still and legible for at least 1.5–2 s. It's the frame that becomes the cover.

## 5. Typography, color and composition

- **Typography:** use the brand's fonts, with two families at most. Large titles: 90–240 px in 16:9, 80–200 px in 9:16. Weight contrast in the same line (regular + black) and emphasis on one word (brand color, italic or highlighter).
- **Color:** each color plays in the video the role it plays in the product (reading, section 3): the color that only shows up on buttons and active items marks the tap and the keyword, it doesn't paint the background; a color forbidden as an area background stays forbidden. Use the guidelines' proportion, when there is one; with no guidelines or reading that says, 60% background, 25% text/dark and 15% accents. One emphasis color per scene. Alternating light and dark scenes gives pace, but only if the product has both surfaces.
- **Composition:** the text sits on the side opposite the decorative shapes. Decorative shapes: up to 3 per scene, in different corners, bleeding off. Leave margins and respect the format's safe areas (`formats.md`).
- **Product UI:** rebuild it in HTML with the real tokens (colors, radius, the app's font), with believable content in the product's vocabulary. A flat screenshot ages and becomes illegible.

## 6. On-screen text

- Short, affirmative lines, one idea per scene, in the brand's voice (read the guidelines and the brand briefing, if they exist).
- Respect the product's language rules, like forbidden terms and inclusive language.
- No statistic, testimonial, client or badge you haven't confirmed. People on screen get fictional names.
- No real personal data, not even in a fake interface.
- Check spelling, accents and agreement, because the text is what sticks in people's heads.

## 7. Review list (before showing anything)

Run `frames.cjs --scenes` and a strip at each transition, open the images and check:

- [ ] Does each line stay still and legible for the minimum time (section 4)?
- [ ] Do frame 0 and the first second have real motion?
- [ ] Does any transition open onto an empty or nearly empty screen?
- [ ] Does any text touch the edge, leave the frame or enter the area covered by the platform's interface?
- [ ] Does any muddy in-between color (brown, gray, mustard) show up in a change?
- [ ] Does any flash leave the screen grayish?
- [ ] Is any letter or shape cut off by a mask when it should fall or leave?
- [ ] Is the final logo exact (proportion, colors, no distortion) and still for ≥ 1.5 s?
- [ ] Does the watermark or badge collide with shapes or text in any scene?
- [ ] Does any real screen appear shrunk inside a mockup frame, with lettering you can't read in the thumbnail? Redraw it (`references/chapters.md` §5).
- [ ] Does the composition change for no reason from one scene to the next, or stay always the same (screen in the middle, caption at the bottom) from start to finish?
- [ ] In 9:16, is it a different composition or a crop of the 16:9?
- [ ] Did the script print a page or font error? If so, nothing else matters: fix it first.
- [ ] Do the scene timings match the sync sheet?
- [ ] **Swap test:** with the logo and name of a product from another world, would this video still work? Point out at least three elements that only this product would call for (reading, section 6). If only color and logo are left, go back to the decisions.
- [ ] Does every element that repeats on screen (background, mockup frame, caption, badge, title, closing, highlight) have a line in section 5 of the reading saying why?

## 8. Anti-clone

Before writing the script, write down (in section 5 of the reading, if it doesn't already say):

1. The signature move: where does it come from in this brand?
2. Which musical palette (genre, BPM, timbres) and why it belongs to **this audience** (reading, section 4)?
3. Three decisions in this video that the previous one didn't have.

**The tutorial template is the easiest trap.** The tutorial engine can draw a whole video without you deciding anything. What it draws in that case (organic shapes breathing in the background, a pill badge, a window with three dots, a white caption card that flips, an iris in the brand color) is only what's left over when nobody chose. Put on two different products, it makes both look the same. In a new series, each of these elements is declared (`references/types.md` §11). If the declaration matches that drawing, section 5 of the reading says why this product calls for it; "it's what the engine does" is not a reason.

**The previous video is the second trap.** The last video you made, a competitor's, one from another series by the same user: none of them is a style reference for this one.
