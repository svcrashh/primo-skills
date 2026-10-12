# 3D phone (`phone-3d`)

A 3D phone (rounded corners, thickness, sides that catch the light, no manufacturer brand) with the real recorded
screen inside: the page scrolling and a tap. The phone turns and orbits, or the camera moves close to it until the app's
text is legible; the text stays beside it, never over the screen.

**When to use:** objectives `launch` and `update` for a mobile app or a responsive page (showing that it works on a
phone), `teach` a short path on the phone (scroll and tap, 2 or 3 steps); channels `reels`, `whatsapp` (9:16, the
phone fills the frame), `site`, `feed`; product `layperson`, `retail`, internal with a mobile version.
**When not to use:** a product that only exists on the computer (the phone would be decoration: `real-screen-camera` or
`infinite-zoom`); a tutorial of more than 3 steps (`real-screen-camera`); a screen that can't be recorded; an ad with no
screen at all.
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `real-screen-camera` (the real screen, in 9:16).

## Structure (10–15 s)
- **0–1.5 s:** the whole phone coming in (turning, or coming from far away), with the written promise beside it already in frame 0.
- **Each step (2–4 s):** the camera moves close (2×: the app's 16 px text at 32 px), the recording scrolls; the step's
  sentence (up to 7 words per line) changes beside it.
- **Tap:** the camera reaches the point a little before; the point appears, presses and releases a ripple.
- **Pull-back (~2 s):** the whole phone again, turning.
- **Closing:** mask, push or cut to the logo, held ~2 s.

## Formats (recomposed, not cropped)
- **16:9, 19:9, 21:9:** the phone in a window (or card) on one side, the text in a column on the other, or each in a
  half (split).
- **9:16:** the text in a strip at the top of the safe area, the phone below, big; up close it fills the window.
- **1:1:** like 9:16, with the phone cropped at the bottom in the full shot.
The phone never leaves its window, which stays inside the safe area: the screen's text doesn't touch the edge of the frame.

## The request must include
The page or the app (URL or local HTML) in a demo account, with no customer data; the journey (where it scrolls,
what it taps, the result), with each step's sentence; the theme (light or dark); the palette and the logo.

## Variants
- **orbit + column:** the phone moves from one side to the other while the recording plays; a color card behind it, a symbol
  turning in the background (`example-orbit.json`).
- **dolly + split:** the camera comes from far away and moves close, barely turning; the phone in one half, the text in the other,
  calm pace (`example.json`).
- **vertical (9:16):** the phone's natural format, for Reels and WhatsApp.

## Script ideas that fit
[One task from start to finish](../no-template.md#ideas), [Little find that fixes an annoyance](../no-template.md#ideas),
[Talks to the viewer](../no-template.md#ideas), [New screen without a scare](../no-template.md#ideas).

## How to render
`$SKILL/templates/phone-3d/TEMPLATE.md`. Format examples: `example.json` (dolly, split, push, calm pace: scroll to a
table row) and `example-orbit.json` (orbit, column on the right, mask, symbol in the background: scroll and tap).
