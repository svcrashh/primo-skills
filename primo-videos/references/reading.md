# Project reading

The project reading is a file, `reading.md`, written **before** any image or sound decision, for
every type of video. In a series, it lives in the series folder; in a standalone video, in the video's
project folder. Everything the video decides afterward (background, caption, title, closing, music genre)
points to a line of it.

## Contents
1. Why the project reading exists
2. How to do it
3. What counts as evidence
4. The seven sections, and why each one exists
5. Shallow reading × reading
6. Pitfalls
7. Two examples (made up, from opposite products)

---

## 1. Why the project reading exists

You can read a product's colors, fonts and logo and still deliver a video that
would work for any other: the same background, the same caption, the same mockup frame and some
"discreet" music that belongs to no one. Anyone who uses the product notices right away. A craft brewery,
a pediatric clinic and a freight company can have the same blue, and have nothing else in common.

The failure wasn't one of taste. It was one of order: the colors were collected, but nobody wrote down **who uses it**,
**what the product looks like beyond the palette** and **what that audience listens to** before deciding. Without
that written down, what decides is the engine's default, and the engine's default is everyone's identity.

Two sentences show the difference:

- **Paint:** "the brand is orange".
- **Language:** "orange is action and active item, never an area background; on paper it turns
  rust (`--acao-no-papel`, `src/tema.css:31`)".

The first one only lets you paint. The second says where orange goes in the video (the tap, the active step),
where it never goes (the closing background) and what color it turns into on a light background. The project
reading exists to produce sentences of the second kind.

## 2. How to do it

1. **Collect the facts:** `node $SKILL/scripts/reading.mjs <project-folder> --out <series-or-video-folder>`.
   It writes `leitura.bruta.json` and `leitura.bruta.md`: color tokens with where each one is
   used, fonts, radii, shadows and borders, surfaces, brand files, document excerpts
   that talk about audience and product, the screens' vocabulary, and the videos and series that already exist.
   It doesn't interpret and doesn't read secrets. The raw output is the starting point, not the reading.
2. **Look for what already exists before proposing anything.** The raw output lists, under "Vídeos e séries
   que já existem" (videos and series that already exist), the `_serie/` folders, `series.json`, `identity.json`
   and videos in the project, in the worktrees and branches of the same git repo and in sibling folders
   (`produto-videos`, `produto-ajuda`). Open each one: the identity it uses, the scripts, and whether it was approved,
   published or rejected (search its documents for "recus", "aprov", "feedback", and the English "reject",
   "approv"). An approved and published series is the strongest evidence there is: the reading says whether the new
   one continues it or why not. A rejected series is too: what was rejected becomes a written prohibition. Proposing a
   new identity without having seen the one already live gives the product two faces.
3. **Go to the source.** For each thing you're going to claim, open the file the raw output points to: the
   button component, the navigation bar, the page background, the README, the brand document.
   A color used 40 times as `bg-` in a `Button.tsx` and never in `body` tells you a role; the
   number alone doesn't.
4. **Look at the product, if you can.** Public site: a full-page screenshot (GET only, `brand.md`). An app
   that runs locally: screenshots of the main screens. In a tutorial, the tap sheet from `--check` and from the
   first recording is also evidence of what the screens look like. Screenshots and sheets stay in the reading's
   folder and are cited by path.
5. **Read the conversation.** What the user said about the audience, their taste and what they rejected counts
   as evidence (quote the sentence).
6. **Write the seven sections** (§4), with evidence for every claim in sections 1 to 4.
7. **Show the essentials** in the reconnaissance summary (SKILL.md, step 0.1): product, audience, the
   look in three lines, the sound in one, and the questions from section 7, which go into the briefing.

The reading fits in one or two pages. It's not an essay: it's a list of facts with the why.

## 3. What counts as evidence

| Counts | Doesn't count |
|---|---|
| `file:line` with the path from the repository root (`src/index.css:31`, `docs/product/PRODUTO.md:12`); outside it, the full path | "the brand looks modern"; `PRODUTO.md:12` when the file is in `docs/product/` |
| a public URL (`https://produto.com/precos`), with what you saw there | the product's name ("the name sounds nocturnal") |
| a screenshot or sheet you generated, by path (`leitura/home.png`) | what "products in the category usually do", without saying it's general knowledge |
| a sentence from the user in this conversation, in quotes | the engine's default ("the tutorial already comes with a white card") |
| web research, with the URL | the example that comes with the skill |

General knowledge is allowed where the repository doesn't reach, mainly in section 4 (the
conventions of a music genre aren't in anyone's code). In that case, write
**"genre knowledge"** or **"guess"** in place of the evidence. What's not allowed is an unnamed
guess: it becomes a hidden assumption, and a hidden assumption is what makes a whole series come out wrong without anyone noticing.

The source's doubt travels with the evidence. If the document says something is an "assumption", a "draft",
"to be confirmed" or a "proposal", the reading writes that alongside it ("tone of voice: direct and close, assumption
not yet confirmed in `docs/visao.md:50`"), and the item also goes to section 7. A project assumption
cited as fact becomes a certainty nobody gave.

## 4. The seven sections

### 1. The product
**Answers:** what it is, in one sentence, in the words the audience uses.
**Why:** the product sentence decides what the videos' "gesture" is and the vocabulary of the captions.
Written in the audience's words ("close out the register", not "reconcile receivables"), it
also keeps the video from sounding like generic sales material.
**Where to find it:** the package's `description`, `<title>`, README, landing page, the screens' vocabulary in the
raw output (the most frequent phrases are the product's words).

### 2. The audience
**Answers:** who they are, what they do, what they consume, where they'll watch, what they'd find fake.
**Why:** the audience decides the music genre, the register of the text and what "feels
real". "What they'd find fake" is the most useful question: someone who lives on the dance floor finds a generic
lounge bed fake; a mechanic finds a video that looks like a bank ad fake; a gamer finds
a spa look fake. Write that down before choosing, and the choice makes itself.
**Where to find it:** vision documents, personas, plans, CLAUDE.md, landing page copy, the roles
the system has (attendant, manager, organizer), the language and tone of the screens. **Where they'll
watch** changes the video: inside the app, in a help center, on Instagram, in a WhatsApp group.
An audience is not a category: "merchants" can mean the owner of a corner grocery or of a designer boutique. If the
repository doesn't say which, that's a question for section 7.

### 3. The product's look
**Answers**, one line per item, each with evidence:
- **Surface:** light, dark, or both, and where each one appears (the landing page is dark, the dashboard
  is light; dark mode exists but isn't the default).
- **Color:** the **role** of each color (stage, ink, action signal, active item, alert, support), **where
  it's forbidden** and how it changes from one surface to another. A prohibition is a fact: if a color never
  appears as an area background on any screen, it doesn't become an area background in the video.
- **Typography:** family, weight, case (upper or normal), letter spacing, the title's relative
  size. A brand with condensed all-caps titles and wide tracking calls for a different video title
  than one with lowercase serif.
- **Shape:** radii (square, 8 px, pill), **border or shadow** (1 px hairline or long shadow),
  flat or with a gradient.
- **Density:** lots of information per screen or lots of breathing room; small text and tables, or large
  blocks.
- **Texture and grid:** grain, paper, noise, grid lines, dots, or nothing.
- **Photography:** are there photos? of what (people, equipment, places)? cut out, full-bleed, in a
  frame, in black and white?
- **Motion:** what the interface already does (short, crisp transitions, springs, nothing).

**Why:** this section is what the video copies from the language, and not just from the paint. Each element of a
series' look (background, mockup frame, caption, badge, title, opening, closing, highlight, indicator)
is decided by looking at an item here. Without it, all you have is where to put four colors, and the rest comes out of the default.
**Where to find it:** in the raw output, `cores` (with context and the files that use each color most), `superficies`,
`fontes`, `tipografia`, `forma`, `densidade`; then, the components it points to and the screenshots.

### 4. The audience's sound
**Answers:** what this audience listens to, the genre's conventions (tempo, groove, timbres), and what would
embarrass the brand.
**Why:** the **genre** is an audience decision; the music's **role** (background or protagonist:
how loud, how full, how much room it leaves for reading) is a video-type decision. Mixing the
two was the mistake: "a tutorial calls for background music" became "a tutorial calls for a generic bed with no kick drum".
Background is volume and density, not genre. For people who live on forró, a background bed can be a
xote with the zabumba held back; for people who live on the dance floor, a four-on-the-floor with the kick low. A
"neutral" bed, with no genre, is what both would find fake.
**Where to find it:** the repository sometimes talks about music (genres, SoundCloud links, events,
playlists — the raw output collects this under `som`). The rest comes from the conversation, from web research
(`soundtrack.md` §1) or from genre knowledge, marked as such. Write the conventions with numbers:
"xote: 80–100 BPM, zabumba on the beat and the offbeat, triangle in sixteenth notes, accordion on the
melody".
**What would embarrass it:** the mistake the audience would notice in one second (a badly
synthesized dance-floor track, a children's song for teenagers, an epic score for a bill-paying app).

### 5. Decisions
**Answers:** each element of the look and the music's identity, with the why of each one pointing
to sections 1 to 4.
- **Series (tutorial or campaign):** the elements of the look declared in `series.json` (background,
  mockup frame, caption, badge, title, opening, closing, highlight, indicator, with the options from
  `references/tutorial.md`) and the musical identity in `identity.json` (role, accepted genres and grooves,
  tempo, timbres, with the fields from `references/soundtrack.md` §9).
- **Standalone video:** the role of each color in the video, the typography, the shape and the texture, the type of
  image (real screen, recreated UI, typography), what the concept can't have, and the musical direction.

Format of each line: **decision — because (section, evidence)**. Example: "caption in a dark strip
at the bottom, no card — the screens are dark and dense (§3, `src/App.css:12`), a white card would
blow out over them". A decision that matches the engine's default needs the same why: if
there isn't one, the default is deciding for you.

### 6. The swap test
**Answers:** "if I swap the logo and the name for another product's, does the video still work?" Do the
swap for real, with a product from another world (a clinic app, a game, a school), and say what
makes the confusion impossible: at least three elements that only this product would call for.
**Why:** it's the test a generic video fails. If what separates this video from another is
only the colors and the logo, the identity is still the engine's. Go back to section 5.

### 7. What we couldn't find out
**Answers:** what the repository, the site and the conversation didn't say and that would change the video (which
slice of the audience, whether the brand has a sound, whether dark mode is the default, whether photos of people are
allowed, whether the series that already exists continues or is replaced).
**Why:** what isn't known and isn't written down becomes a silent assumption. Each item becomes a question in the
briefing, with options drawn from what you found. With no way to ask, it becomes a **declared assumption** at the
top of the delivery, with what would change if it's wrong.

## 5. Shallow reading × reading

| Shallow | Reading |
|---|---|
| "Colors: red #F85149, gray #0D1117." | "Stage: night gray `#0D1117`, the background of the whole app (`src/theme.ts:3`). Alert: red, only on the active-incident badge (`IncidentBadge.tsx:7`; 0 uses as area background or button). No brand color on buttons." |
| "Font: Nunito." | "Titles in Nunito 800, normal case, large: `text-3xl` is the smallest title (64 uses, `src/**`); no `uppercase` in the app." |
| "Audience: merchants." | "Grocery store owners aged 40 to 65, at the counter (`docs/pesquisa-campo.md:10-22`); they watch on WhatsApp with sound on (`docs/pesquisa-campo.md:31`)." |
| "Music: acoustic background." | "Forró and sertanejo from the radio at the counter (guess, goes to section 7). Background role: accordion and zabumba held back, no sung chorus. Would embarrass: cold startup electronica." |

## 6. Pitfalls

- **Pasting the raw output and calling it a reading.** The raw output has facts without roles; the reading has the role of
  each fact.
- **Accepting the engine's default without declaring it.** Shapes that breathe, a pill badge, a window with the
  macOS dots, a white card that flips, an iris in the brand color: all of that is what the engine
  draws when nobody decides. It may suit a product, but only with a why from section 3.
- **Confusing role with genre** (section 4).
- **Deriving the audience from the product's name or color.** The audience is in the documents, in the system's
  roles and in the conversation. If it isn't there, it's a question.
- **Copying another video.** The last one you made, a competitor's, one from another series by the same
  user: none of them is a style reference for this one.
- **Decorative evidence:** a file path that doesn't support the sentence. If you open the line and it
  doesn't say what you wrote, the sentence is a guess.

## 7. Two examples

Made up and short. The paths are from repositories that don't exist; the format is what matters.

### Example A · digital tab-keeping for the neighborhood grocery store

**1. The product.** "Write down the tab on your phone and collect over WhatsApp" (`README.md:3`; the screens say
"write down", "who owes", "collect", `src/i18n/pt.json:4-40`).

**2. The audience.** Owners of grocery stores and bakeries, 40 to 65 years old, a busy counter, a simple Android phone
(`docs/pesquisa-campo.md:10-22`). They watch on WhatsApp, with sound on, in the lull between customers
(`docs/pesquisa-campo.md:31`). They'd find fake: a digital-bank look, English, people in suits.

**3. The look.** Light surface, cream ruled paper `#FFF8E7` on every screen
(`src/styles/base.css:4`), no dark mode. Leaf green `#2E7D32` only on "paid" and on the
"write down" button (`Button.tsx:11`); brick red only on "owes", never on a button. Titles in Nunito 800,
normal case, large (`text-3xl` is the smallest title, 64 uses). A dark 2 px border, radius 12, no
shadow (`base.css:18-30`; 0 `shadow-`). Little information per screen, big numbers. A ruled-paper
texture in the background (`public/pauta.png`). No photos.

**4. The sound.** Popular AM and FM radio at the counter: forró, sertanejo, pagode (guess; confirm in
section 7). Would embarrass: cold electronica, a "startup" soundtrack.

**5. Decisions.** Ruled-paper background (§3 texture); caption in a strip at the bottom, large type, 2 px
border, no floating card (§3 shape and density; the audience reads slowly, §2); tap highlight as a
thick green outline (§3 color); light closing with the logo in color, never in flat area green
(§3). Music: background role; genre xote or acoustic arrasta-pé, accordion and zabumba, 90–100
BPM (§4, to be confirmed).

**6. Swap test.** With a gym app's logo, the ruled paper, the thick-bordered caption
strip and the accordion would remain: nobody would use that for a gym. Passes.

**7. Couldn't find out.** Is the audience from Brazil's Northeast, its Southeast or both? That changes the genre.
Does the brand accept photos of a real counter?

### Example B · on-call dashboard for infrastructure teams

**1. The product.** "See what went down, who's on call, and silence the alert" (`README.md:1`; screens:
"incident", "acknowledge", "escalate", `src/components/**`).

**2. The audience.** SRE and platform engineers, in the middle of the night, on a big monitor
(`docs/personas.md:5-19`). They watch in the documentation and in the internal channel, without sound most of the time
(guess). They'd find fake: cute animation, candy colors, marketing copy.

**3. The look.** Dark surface `#0D1117` across the whole app (`src/theme.ts:3`), light only in the alert
email. Grays in four levels carry the interface; red `#F85149` only on an active incident
(`IncidentBadge.tsx:7`), amber on warnings; no brand color on buttons. JetBrains Mono for numbers and
times, Inter 500 for the rest, normal case, small sizes (`text-sm` is the most used, 410 uses).
A 1 px `#30363D` hairline, radius 6, no shadow (`theme.ts:30-44`). Very dense: tables and
timelines. A subtle background grid in the charts. Crisp motion, 120 ms, no spring (`theme.ts:52`).

**4. The sound.** Electronic music you can listen to while working: ambient, minimal techno, synthwave
(genre knowledge; confirm). Would embarrass: a catchy melody or a heroic score.

**5. Decisions.** Plain dark background with the charts' grid (§3); mockup frame as a 1 px hairline, without the
macOS dots (§3 shape); loose caption in mono, no card (§3 density and typography); highlight
with corners, not a full outline (the UI is already full of boxes); closing on a hard cut, no iris
(§3 motion). Music: background role; minimal techno at 118–124 BPM, a dry, low kick, a synth
pulse, no melody (§4).

**6. Swap test.** With the logo of the tab app from example A, nothing fits: the mono, the hairline, the grid and the dry techno
belong to this world. Passes.

**7. Couldn't find out.** Does the video play with sound anywhere? If never, the music can be
optional. Does the brand have its own color besides the incident red?
