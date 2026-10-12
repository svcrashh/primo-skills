# Web tool tutorial on the computer: why the series looks like this

This is the note of the example series, which has no brand: greys, placeholder texts and a placeholder logo. Replace it
with the reading of your own product (who it is for, where the video plays, the colors, the type and the logo of the
brand) and keep, for each element, the choice and its why. Each video's angle (audience, thesis, proof scene) goes in
the video's own `reading.md`.

| Element | Choice in the example | Why |
|---|---|---|
| format | 19:9 (2280×1080); 16:9 and 9:16 with `--format` | a computer screen recorded wide, with room for the text column beside it |
| text | `fora-da-imagem` | the step is read beside the screen, never over it: the screen fades out at the edge of the free area and the check fails anything that crosses it |
| panel | the recorded screen on a 3D panel (`cinema: moldura`) that flips at the opening and at each section | depth and a strong moment every few seconds, while the steps stay face-on and readable |
| background and frame | plain light background; browser frame with a flat bar and the address, radius 28, long shadow | the recorded screen is the subject, and the bar says "this is a website" without extra drawing; the shadow belongs to the panel, which floats |
| caption, label and badge | loose on the left, 30% of the width (in portrait, on top), dark on light; one pill in the third color for the step label and the badge | the column is the free area the screen never invades; only text pairs listed in `MARCA.pares` |
| title | bold, dark, normal case, left-aligned, comes in word by word | it is a sentence to read, not a poster |
| opening | panel in the main color with the logo, which leaves diagonally; the 3D panel with the result screen beside the title; the index of the sections as numbered pills (with 2 or more); it flips and the recorded screen is born on the back | the result before the first step, then the map of the video |
| closing | light background, only the logo, centered; it rises and holds ~1.9 s (`so-logo`) | by default the video signs off with the brand's logo, alone; a sentence or a slogan only when the brand has one and the person wants it (`ordem`) |
| highlight and pointer | outline in the main color, 4 px, with a glow on the tap; dark cursor with a light border | the brand color as a shape, never as small text; the cursor shows on light and on dark areas |
| soundtrack | sober electronic pop, 112–118 BPM, foreground role (`protagonista`) but restrained (low density), −14 LUFS | a video without voice: the soundtrack leads, and it stays restrained because the viewer is following steps |

This is the `left-column` variant. The others (`right-column`, `bottom-strip`, `dark-stage`) are in `variants/`,
each with its own note; how to choose and apply them: `references/tutorial.md`, section 18.
