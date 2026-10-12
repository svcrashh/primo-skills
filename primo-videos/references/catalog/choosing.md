# How to choose the style

Three questions: **what for** (objective), **where it will play** (channel) and **what product/audience**. Table 1 gives
the styles in order of preference; table 2 pulls, removes and adjusts the tone; the shortcuts settle the common cases.
The first in the cell is the recommended one; the others are the alternatives the skill shows alongside.
The labels in parentheses are the keys of `scripts/recommend-style.mjs`: the two have to match.

## 1. Objective × channel

| Objective | Site, help, YouTube (`site`) | WhatsApp (`whatsapp`) | Reels, TikTok, Shorts 9:16 (`reels`) | Feed, LinkedIn 1:1/4:5 (`feed`) | Big screen 16:9 without sound (`big-screen`) |
|---|---|---|---|---|---|
| **Teach** (`teach`) | `real-screen-camera` · `drawn-explainer` (the idea or how it works inside, not where to click) · `before-after` (a single step) · `typing-text` (the idea is hard: explain it before the button) · `card-stack` · `infinite-zoom` | `real-screen-camera` (9:16, step card) · `before-after` · `rolling-list` · `card-stack` | `real-screen-camera` (lightning, karaoke caption) · `rolling-list` (numbered tips) · `before-after` · `drawn-explainer` (stacked scenes) · `card-stack` · `phone-3d` | `rolling-list` (numbered tips, 4:5) · `real-screen-camera` (1:1) · `drawn-explainer` (B2B on LinkedIn: how it works, 4:5 or 1:1) · `before-after` · `card-stack` · `ticking-checklist` | a tutorial doesn't work on a big screen without sound. If they insist: `rolling-list` (one poster card per step, no camera or speech) · `counting-number` · `before-after` · `ticking-checklist` |
| **Announce news** (`update`) | `rolling-list` (phrase card or wall) · `chapters-with-index` (6 to 12 new features) · `before-after` · `counting-number` (a number or a rule changed) · `card-bento` · `timeline` | `counting-number` · `before-after` · `rolling-list` · `card-stack` | `rolling-list` (burst) · `before-after` · `counting-number` · `phone-3d` · `kinetic-typography` | `rolling-list` (1:1/4:5) · `before-after` · `counting-number` · `card-bento` | `light-trail-teaser` · `rolling-list` (burst) · `counting-number` · `kinetic-typography` · `card-bento` |
| **Launch / sell** (`launch`) | `rolling-list` (poster card and proof) · `typing-text` (product with a text box) · `light-trail-teaser` (demanding audience, event feel) · `chapters-with-index` · `drawn-explainer` (B2B that needs to explain how it works) · `chat-bubbles` · `card-bento` | `counting-number` (offer on a marquee) · `typing-text` · `before-after` · `chat-bubbles` | `typing-text` · `counting-number` (refrain) · `rolling-list` (lightning) · `phone-3d` · `chat-bubbles` | `rolling-list` (poster card and proof, 1:1) · `typing-text` · `counting-number` · `drawn-explainer` (B2B that needs to explain how it works) · `chat-bubbles` · `card-bento` | `light-trail-teaser` (new identity, event feel) · `rolling-list` (phrase that lights up) · `counting-number` · `kinetic-typography` · `photo-mosaic` |
| **Grab attention** (`attention`) | `light-trail-teaser` · `before-after` (zoom-out that reveals) · `typing-text` · `infinite-zoom` · `kinetic-typography` | `before-after` · `counting-number` · `typing-text` · `kinetic-typography` | `before-after` · `typing-text` · `counting-number` · `kinetic-typography` · `phone-3d` | `counting-number` · `before-after` · `light-trail-teaser` · `kinetic-typography` · `photo-mosaic` | `light-trail-teaser` · `counting-number` · `before-after` · `kinetic-typography` · `photo-mosaic` |
| **Report results** (`results`) | `counting-number` · `rolling-list` (wall) · `chapters-with-index` (long year-in-review) · `before-after` · `growing-chart` · `timeline` | `counting-number` · `before-after` · `rolling-list` · `growing-chart` | `counting-number` · `before-after` (the same place, months later) · `rolling-list` · `growing-chart` | `counting-number` · `rolling-list` (wall) · `before-after` · `growing-chart` · `ticking-checklist` | `counting-number` · `rolling-list` (wall) · `light-trail-teaser` · `growing-chart` · `kinetic-typography` |

**Reporting results has no template of its own.** The social proof template (testimonial, wall of replies, case) was
left for the second batch because it depends on real client material. Today: `counting-number` for the number,
`rolling-list` with the wall for the volume, `before-after` for the change. Tell the user this when you recommend.

**The twelve catalog styles** come in at the end of the cells, as alternatives: they don't take the place of any
of the eight from before (in the script, `DO_CATALOGO`: 4 points, and they don't count as a rung). When they fit better,
the round-2 conversation and the catalog (`scripts/catalog.mjs open`) show it; each one's style card is in
`styles/<id>.md`.

| Style | Use when | Don't use when |
|---|---|---|
| `chat-bubbles` | the product converses (chatbot, AI, support): the request, the question back, what comes back | it's a single request with no question back (`typing-text`), or the conversation is a real client's |
| `ticking-checklist` | what it does and doesn't do, requirements, a check before delivery | the new feature calls for screen proof, or there are more than 8 items |
| `growing-chart` | 2 to 8 true numbers in the same unit, a proportion or a series over time, with a source | it's a single number (`counting-number`) or the number has no source |
| `timeline` | stages in order, a history with dates, a roadmap, "a day with" | the items have no order (`rolling-list`) or the dates would be made up |
| `card-bento` | the overview of a product, version or bundle with 3 to 9 parts | teaching where to click, or the proof has to be the real screen |
| `card-stack` | 2 to 8 short steps, tips or rules, read in sequence | a click path, or long text |
| `phone-3d` | a mobile app or responsive page with the real screen on the phone; a vertical piece | the product is desktop-only, or there are more than 3 steps |
| `infinite-zoom` | layers from the general to the detail, or navigation across 3 or 4 screens | teaching the click path; more than 5 levels |
| `drawn-flow` | architecture, process, where the data comes from, where a request stops | an idea that calls for free drawing or a number; more than 8 pieces |
| `isometric` | the layers of a system, a bundle or a platform | a path with branching (`drawn-flow`); more than 6 layers |
| `kinetic-typography` | an opening, a short internal announcement, summing up 2 to 4 facts | there's no concrete fact (it turns into a slogan); a tutorial |
| `photo-mosaic` | institutional, people, an event opening, with the brand's own approved photos | the brand has no photos of its own, or it's to teach a tool |

## 2. Product kind and audience

| Product / audience | Lean toward | Avoid | Tone adjustment |
|---|---|---|---|
| **Serious B2B**: SaaS, ERP, dashboard, CRM (`b2b`) | `real-screen-camera` · `before-after` · `counting-number` (sober, before → after a limit) · `drawn-explainer` (when the video explains how it works inside: flow, integration, API) | `rolling-list` in a burst (< 1.5 s per item); caught-in-the-act humor | one highlight color, 2 s per item, the why before the number |
| **Young consumer**: social network, music, delivery, fashion (`young`) | `typing-text` · `rolling-list` (burst) · `before-after` | long `chapters-with-index`; `real-screen-camera` as a slow tour | saturated color, 0.8–1.2 s per item, a joke every 3–4 items |
| **School, public service, layperson** (`layperson`) | `real-screen-camera` (step card); to explain an idea before the button, open with `typing-text`; `drawn-explainer` when the idea is the whole video (what it is, why, how it works) | `light-trail-teaser`; `rolling-list` in a burst | full sentence at each step, slow pace, "Done! That's all." at the end |
| **Bank, finance** (`finance`) | `real-screen-camera` · `counting-number` (a number that runs, always with context) · `drawn-explainer` (when the video explains how the amount is calculated: interest, bill, yield) | `light-trail-teaser`; mocking and caught-in-the-act humor | restrained; numbers always with context; nothing that looks like a promise of gains |
| **Creator, DJ, personal brand** (`creator`) | `chapters-with-index` · `rolling-list` (showcase of what they do) · `counting-number` | `real-screen-camera` as a SaaS tour | the person's own photos and numbers on stage |
| **Game, community** (`game`) | `before-after` · `light-trail-teaser` · `rolling-list` (numbered list); balance changes with numbers: the `30 → 40` tag from `counting-number` | slow `real-screen-camera` | accepts 220 words/min, the season's color, the season number fixed in the opening |
| **Store, retail, delivery** (`retail`) | `counting-number` (marquee, refrain) · `before-after` | `light-trail-teaser` (too abstract for a price) | giant price and deadline, repeated refrain |
| **Other** (`other`) | only table 1 | nothing | the tone comes from the brand reading (`references/reading.md`) |

When product and channel disagree, the product removes (the "Avoid" column) and the channel orders what's left.

## 3. Shortcuts

- **The owner already approved a video of this product, or shows one as a reference** → that style, at that level
  (`--approved <style>`; `registrar … --approved` remembers it on its own). It beats the rule of not repeating chapters.
  Watch the video first (frames and sound): it's the benchmark for finish. With voice, frames and transcription: it is
  the benchmark for the voice too (`references/voice-choice.md` §6).
- **The request asks for an explanation** ("give a quick overview", "show what changed") → a style that builds up beat
  by beat on the soundtrack's timing (with voice, on the word the voice says): `chapters-with-index` (news) or
  `real-screen-camera` (teaching), in 9:16 too (`--explain`). The list of panels with a static proof, in that case,
  looks like "all the same thing". If the
  explanation is of a concept (an idea, not where to click), the alternative is `drawn-explainer`; with
  `--concept` too, it becomes the recommended one.
- **The video explains an idea, a flow or how something works inside** (not where to click) → `drawn-explainer`
  (in the script: `--concept`). Without the flag it only shows up as an alternative: the table doesn't know whether the
  explanation is of an idea or of a click.
- **Tutorial on the computer** → `real-screen-camera`, always with the camera going to the field in turn. Never the
  whole screen.
- **Patch notes, and the product's last video was `chapters-with-index`** → `rolling-list` (phrase card or wall);
  for Reels, `rolling-list` at burst speed.
- **`chapters-with-index` is never recommended twice in a row for the same product.** The script keeps each product's
  last style (`recommend-style.mjs --name "Produto"` reads it; `registrar --name … --style …` saves it after the
  delivery). With no history, look for the previous video (project folder, conversation) or ask along with the choice.
  If the user picks chapters again on their own, that's fine: the rule is for the recommendation.
- **The product has a text box** (AI, search, chat, sign-up) → `typing-text` is almost always the best
  opening, or the whole video (in the script: `--text-box`).
- **6 to 12 new features for the site** → `chapters-with-index` moves up (in the script: `--items N`), unless it was
  the last one.
- **There's a true, strong number** → `counting-number` as a video of its own (6–20 s) or as the opening or closing
  block of any other template.
- **The product isn't live yet** (launch with a date) → `light-trail-teaser`. After it launches, no: it frustrates people
  who want to see it.
- **WhatsApp** → 9:16, up to 45 s, big caption, the "Done!" at the end; the recipient's phone is the screen.
- **The request brings an idea** (hook, joke) **and little nice-looking screen** → choose the idea first
  ([`no-template.md`](no-template.md#ideas)) and count on `typing-text` or `rolling-list` (phrase that lights up).
- **The request names a style that has no template** → [`no-template.md`](no-template.md) says which template it falls
  back to; tell the user.
