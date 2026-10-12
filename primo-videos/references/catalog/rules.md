# Rules that apply to any style

Each one showed up on its own in several groups of the videos studied. They apply to the 8 templates. Rules 13 to 16 came from a video that was rejected and redone from scratch.

1. **The promise or the question is written on screen at frame 0.** No seconds of empty screen, blinking cursor
   or logo before saying what it's about.
2. **Never the whole screen shrunk.** Every line that matters reaches ~3% of the frame height or more: crop,
   camera zoom, floating window or redesigned interface.
3. **Highlight = dark scrim + blur on the rest**, not an arrow or a red circle.
4. **Captions always.** Half the people watch without sound. Even better if the caption is made with a component of
   the product itself (its card, its bubble, its tag).
5. **A single number, big, alone, with a 3-word label** proves more than any adjective.
6. **Before and after in the same framing:** the same screen, in the same place, in two states.
7. **A 2–3 word intertitle** between blocks organizes any video longer than 30 s.
8. **The text doesn't take up the whole video.** New text from start to finish is tiring; leave breathers where only
   the image and the soundtrack do the work.
9. **Length:** what worked stayed between 6 and 60 s. Above 90 s it loses the thread, except a tutorial the person
   follows along with.
10. **The product is the rule of the game, not decoration.** The video people remember is the one where the app is the
    mechanism or the payoff of the story. If the app barely shows up, they remember the joke and forget the product.
11. **End on the brand's logo.** What the person takes away is the proof the video showed, never an invented line. A
    slogan or a call to action only goes in when the brand has one and the person wants it ("The brand's options", at
    the top of SKILL.md); without them, the closing is the logo alone.
12. **Views don't prove the idea works; likes per view do.** A video that truly went viral stays at 2–3% likes;
    a paid ad has millions of views and almost no likes. This applies when choosing a reference and when measuring ours.

13. **The scene builds up beat by beat, on the soundtrack's timing.** "It starts doing one thing, then does another,
    and keeps adding": the card comes in simple, gets the icon, then the photo, and the highlight changes style at each
    beat, each entrance on a beat of the bar. A static proof looks like "all the same thing, very random".
14. **The video the owner already approved is the benchmark.** If the product has an approved video (in the repository,
    on the site, in whatever they show: "I want something at this level"), watch it before recommending a style: the
    frames and the sound. It decides the style (`recommend-style.mjs --approved`) and the level of finish. Recommend
    something else only with a stated reason.
15. **A system screenshot never becomes the video.** The static screenshot inside a panel, or the whole screen shrunk,
    comes out "grotesque" and repetitive. What works: the interface **redesigned**, big and animated, with the **real**
    media and data (avatar, icons, photos, the background video playing, the numbers from the public API), collected
    with `scripts/extract-media.mjs` with the metrics locked. The screenshot stays as a reference for labels, color and
    order.
16. **The brand is copied, not redesigned.** Logo = the product's component (the SVG and the text with the same font,
    weight, style and color per letter); slogan = the product's (meta description, hero); title in the font and style
    of the site's class (if the CSS says `font-style: italic`, it's `italic` in `font`, not `skewX`). "You changed the
    logo's font" and a slogan that was similar-but-not-the-same were noticed right away.

## Out of reach (and the swap)

The engine doesn't film people (actor, presenter, hand holding a phone), doesn't do 3D (rotating device, glass,
particles with volume), doesn't animate rigged characters or hand-drawn animation, doesn't sing jingles and doesn't do
real time-lapse. Hand-drawn strokes for shapes (boxes, arrows, annotations) do exist: they're the `drawn-explainer` ones.
**The idea stays, the image changes:** people become a first-person quote card; 3D becomes a 2D mockup frame and an
abstract background; a jingle becomes a refrain in the soundtrack (never a written catchphrase); time-lapse becomes
captures per day ("DAY 01 … DAY 34"); gameplay and mascots only come in if the client delivers the recording or the
layered SVG. Tell the user about the swap.
