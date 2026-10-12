---
name: primo-videos
description: Use when someone asks, in Portuguese or English, for a video of their product, project or idea without narration — "faz um vídeo", "vídeo do produto", "vídeo tutorial", "vídeo explicativo", "vídeo sem voz", "só com música", "anima o logo", "vinheta", "corte para Reels", "catálogo de estilos de vídeo", "make a video", "product video", "explainer video", "tutorial video", "motion", "motion design", "motion graphics", "sting", "animate the logo", "logo animation", "video without voice", "music only", "video style catalog", "/primo-videos". The brand comes from the user's own project or site, never from a built-in one. It makes videos without narration, told by on-screen text, an original soundtrack and sound effects. Before producing, it always asks whether the person wants to talk the video through (topics and direction) and approve a prompt; each video varies from the brand's previous ones. It replies in the user's language.
---

# /primo-videos

## The person brings the brand, the context and the ideas

This skill has **no brand, no look and no ready-made idea built in**. The product, the brand, who the video is for and
the ideas are the person's. Your job is to read what can be read, ask for the rest and show everything before making it.

1. **Read first what can be read:** the conversation, the repository, the product's site and screens (the generic
   reading: `scripts/reading.mjs`, `references/reading.md`, `references/brand.md`). Never ask what the code or the site
   already answers.
2. **Ask for what only the person knows, each question with your suggestion first** (taken from what you read), never
   a blank question:
   - the **product** and where it is: the repository, the address, the local preview, the screens;
   - **who the video is for** and **where it plays**;
   - **what it has to prove or teach**;
   - the **brand**, when the project does not show it: the logo file, the colors and the role of each one, the font;
   - **visual references** they like (a video, a site, an image) and what they like in each;
   - **ideas of style** they already have: a style from the list, one they describe, or one they show.
3. **What is still missing after that is a question with a suggestion, not an assumption:** "I found two logos in
   `public/`: which one closes the video? I would use the horizontal one." An assumption is only for what does not
   change the video.
4. **Their idea leads.** When the person proposes a style, find it in the list (`node $SKILL/scripts/catalog.mjs list`)
   and say which template makes it. When it is not there, say the closest template and what would be different
   (`references/catalog/no-template.md`), or build it from their reference with the engine
   (`references/engine.md`), and show a still of it before going on.

## First step, always: ask whether the person wants to talk the video through

**Before any command, repository read or folder creation, in Copilot and in Claude Code, ask once whether the person
wants to talk the video through first (the topics and the visual direction) and get a detailed prompt to approve.** The
list in `recipes/prompt.md` (the product and where it is, who it is for and where it plays, what to prove or teach,
format and duration, what appears, visual, restrictions) only decides which option to recommend: a short request
recommends talking it through; a complete request recommends going ahead as it is.

Ask the question as **the last thing in the reply, and stop**: in Copilot, do not run anything after it; wait for the
answer. With a yes, follow the recipe's conversation, in three rounds that always end on the questions: **(1)** what you
understood and the map of **all** the topics you found, with your opinion on each (in, maybe, out, and why) and how
much time it costs; **(2)** two or three very different **directions**, with variety checked, **each one as a still
made in the person's brand**, opened side by side (`catalog.mjs open --directions … --folder <video-folder>`) and, in
the chat, their table; **(3)** the whole prompt, for the ok. Only produce after the ok. **The only exception:** the
message itself says the prompt is already approved or asks not to be asked ("just do it").

**"Show me the styles", "the catalog", "what video styles are there?"** is not a video request: run
`node $SKILL/scripts/catalog.mjs open` (opens the list of the styles the engine can make, with what each one is for and
what it needs, and prints the path), show in the chat the table from `node $SKILL/scripts/catalog.mjs list --format md`
(the chat does not always show images) and say how to ask: by name ("the Bento grid"), by mixing ("the timeline with
the camera of the 3D phone") or by describing or showing something that is not on the list. There is no gallery of
ready samples: what a style looks like **in their brand** is a still you make when they ask. `open`, `list` and `show`
take `--lang pt` for someone who asks in Portuguese.

## Owner's rule: show it before you make it

**Every visual decision is shown before it is produced.** A new scene, a new style, a 3D object, a visual fix: first a
still frame (or two or three concept stills side by side) or a preview, opened for the person, and **wait for the
ok**. Only then animate, render the final or deliver. Never go straight from a request to the finished thing, not even
when the request seems clear ("mix concept 1 with 3" still gets its stills first).

- **The review board is where it is shown** (`scripts/board.mjs`, the recipe is `recipes/board.md`): a local page, one
  phase per scene. For each scene, in this order: **still → "Approve still" → animate → preview with its sound →
  "Approve preview"**. The person can paste their own picture into a scene (`replace-still`) and you rebuild the still
  from it; they write to you per scene and you answer there (`board.mjs say`). The loop is `set → open → wait → act →
  patch / say → wait`. **Never animate a scene before its "Approve still"**, and never render it final before its
  "Approve preview". If the board cannot open, show the files (`open <file>`; in Copilot, the path and one line on what
  it shows) and ask in the chat.
- The preview always plays with its sound: the draft with the soundtrack mixed in, never the silent cut. In the
  chapters engine, `out/assembled-*.mp4` is silent; the preview to open comes from
  `node $SKILL/scripts/chapters/assemble.mjs <project> --soundtrack --deliver <folder> --name preview`.
- After the ok on a still, the animated preview is shown too, before the final.
- After every change the person asks for, even a small one, show how the scene looks now (the frame or the clip).
- **Every visual element you choose is shown, one by one, even a photo:** each direction you propose (its still, in
  the person's brand), each photo, illustration or icon of theirs, each screenshot of the product, each logo version,
  with one line on where it goes. Nothing goes into the video unseen.
- **Ask, don't pick for the person.** Whenever a choice is theirs (a direction, a look, a scene, a name or text on
  screen), show two or three options as stills side by side, with your recommendation first and one line on each, and
  ask (the board's choices; `AskUserQuestion` in Claude Code; in Copilot, the question at the end of the reply, and
  stop). When they answer with a mix or a reference image, the next step is stills of that, shown again, not the
  animation.

## Variety: no brand video identical to the previous one

Videos of the same brand do not repeat style, layout and transitions: a second one identical to the first already looks
like a template. The ten-axis matrix and the rule are in `references/catalog/variety.md`; the brand history
(`~/Documents/VideoStudio/Brands/<brand>/videos.json`) and the lock belong to the script:

- **before the script**, the video's direction (the ten axes in a `direction.json`) goes through
  `node $SKILL/scripts/variety.mjs check --brand <brand> --direction direction.json` (exit code 1 = it repeats the latest
  ones: change the axes it suggests);
- **at delivery**, `node $SKILL/scripts/variety.mjs record --brand <brand> --direction direction.json --video <mp4> --title "…"`;
- the person chooses **by looking**, not by reading: each proposed direction is a `direction-<n>.json` with its still
  beside it (`direction-<n>.png`, made in their brand), and
  `node $SKILL/scripts/catalog.mjs open --directions direction-1.json,direction-2.json --folder <video-folder>` opens
  them side by side with the ten axes of each and prints the table for the chat (a direction without a still is
  flagged: make the still before asking). `catalog.mjs open --folder <video-folder> --brand <brand>` shows the whole
  list of styles with this project's stills and the brand's delivered videos under each one;
- the `palette` axis says which of **the person's** colors dominates the frame (`main-color`, `secondary-color`,
  `accent-color`, `light-neutral`, `dark-neutral`), never a fixed color;
- repeat only on request ("same as the previous one"), with `--allow-repeat`, stated in the prompt.

## The brand's options: logo, slogan, language

What opens the video, what closes it and what is written at the end change from one brand to another. They are
**options of each brand**, with defaults, kept in the brand's data folder
(`~/Documents/VideoStudio/Brands/<brand>/brand.json`) so the next video does not ask again:

```sh
node $SKILL/scripts/brand.mjs show "<brand>"                                  # the brand's options (nothing saved: the defaults)
node $SKILL/scripts/brand.mjs set "<brand>" --opening-logo off --slogan "…"   # save only what the person decided
```

| Option | Default | In the video |
|---|---|---|
| **Closing logo** (`closingLogo`) | on | The last scene is the brand's logo, in the version that reads on that background, centered, with breathing room, coming in and held still for 1.5 to 2.5 s. Off only on request (a cut that goes inside another video, a loop). |
| **Opening logo** (`openingLogo`) | on | The logo is the first frame (already at frame 0, coming in with movement) and stays ~1 to 1.5 s; then the content is born from it (the background becomes the video's, the logo rises or pulls back), with no hard cut. Off: the video starts on the content, and frame 0 still has movement. |
| **Slogan and call to action** (`slogan`, `cta`) | none | Only when the brand **has** one and the person **wants** it in the video. The slogan is the product's, word for word (the site's hero, the `<title>`, the `<meta name="description">`); it goes next to the closing logo. The call to action is the last line before the logo. Without them, the closing is the logo alone. |
| **Language** (`language`) | the product's | The on-screen language of this brand's videos ("Language", below). |

- **Read the options before the script.** At a brand's first video, state the defaults as one-line assumptions
  ("Assumptions: the logo opens and closes the video; no slogan, the site does not have one") and save what the person
  changes. Ask only when the reading found a slogan or a call to action: whether it goes in the video is theirs to say.
- **Never invent a slogan, a tagline or a call to action.** If the brand does not have one, the video does not either,
  and no sentence takes its place: on-screen text says the subject, the label, the name of the screen or the step, a
  number with a source (`scripts/writing.mjs review` flags a slogan in place of the fact).
- **One language per video, always.** A video in English is entirely in English; a video in another language, entirely
  in that language: on-screen text, drawn interface, file names, what the screens and the results show. A real result
  that only exists in the other language does not go in: redo the test in the video's language or swap the scene.
  Proper names (the product, its features, commands) do not count as mixing.
- **How the templates do it.** Each template's `example*.json` opens with the logo and closes with it: the field
  `"aberturaLogo": { "logo": "<logo.png>", "fundo": "<the brand's light background>", "dur": 1 }` makes the template
  run `scripts/opening.mjs` after delivery, which puts ~1 s of the logo before frame 0 of the content (logo already
  visible at frame 0, a short whoosh, same size and fps; it does not apply twice). Opening off: leave `aberturaLogo`
  out. Chapters: `<project>/opening-logo.json`. Outside the templates:
  `node $SKILL/scripts/opening.mjs <video.mp4> --logo <png>`. The slogan goes in the field the template gives it
  (`marca.slogan`, the closing's sign-off line); a template whose closing is the logo scene alone says so in its
  `TEMPLATE.md`, and a brand whose slogan has to be read picks another template or says it in the last content scene.

## Copilot and Claude Code

This skill runs the same in Copilot chat (VS Code, Agent mode) and in Claude Code.

- `$SKILL` is the folder of this `SKILL.md`. The whole engine lives in it: `scripts/`, `assets/`, `templates/`, `references/`.
- Commands run in the terminal (in Copilot, through Agent mode's terminal tool). Ask permission before installing anything.
- Where the text says `AskUserQuestion`: ask in the chat, with the recommended option first.
- Where it says subagent, `Agent` or "in the background": in Copilot, use the chat's subagent if it is available; otherwise, do it in sequence, in this conversation.
- `thesis.mjs write` and `critic.mjs` call Claude Code (`claude -p`) and find the command on their own, even outside the PATH (`~/.local/bin`, Homebrew). Only without Claude Code installed: write the thesis yourself following `recipes/thesis.md` and validate it with `thesis.mjs validate`; instead of the critic, review the finished video against the rubric in `recipes/critic.md` and say the review was yours.
- **Long request:** after the prompt's ok (or the "go ahead as it is"), keep going until the preview without stopping to ask whether to continue, showing the `progress.mjs` line at each stage. If Copilot chat asks to continue, that is its step limit (`chat.agent.maxRequests`), not the skill: answer continue.
- Write the skills' paths in full in commands (`node ~/.claude/skills/primo-videos/scripts/…`), not in a variable: that way the terminal's auto-approval recognizes the command.
- **macOS only, for now.** The skill is built and tested on the Mac (the GPU through Metal, the OCR of the refinement check, `open <file>`). Windows comes later: on another system, say so in one line before starting, and do not improvise a Windows path.
- The skill is installed as a link (`~/.claude/skills/primo-videos` points to its folder in the `primo-skills` repository): fix an engine defect in that folder, and `git pull` there updates it.

## The brand comes from the product (read before anything else)

This skill has **no brand built in**. Every video takes its look, its words and its sound from the product at hand:
the person's repository, their site, the files and the rules they show. Everything runs on the person's computer
(motion, 3D, soundtrack, effects, render, refinement); the thesis and the critic are fresh Claude Code conversations
(`claude -p`). Before any step of the workflow below:

1. **Read the brand, in writing.** `node $SKILL/scripts/reading.mjs <repository> --out <series or video folder>`
   collects the facts (each color with the place where it is used, fonts, radii, border or shadow, surfaces, brand
   files, documents about audience and product, the vocabulary of the screens; it does not read secrets). Then go to
   the source of what it points to, look at the product (the public site, the app's screens) and write `reading.md`,
   with the seven sections of `references/reading.md`: the product, the audience, the product's look, the audience's
   sound, the decisions, the swap test and what could not be found out. Where to look and what to extract is in
   `references/brand.md`. **No image or sound decision comes before the written reading.**
2. **The brand's assets are the product's own, copied, never recreated:** the logo is the repository's SVG or PNG (and
   the component that writes the name: font, weight, case), the colors are the tokens with the role each one plays, the
   fonts are the product's (`scripts/fonts.mjs`), the slogan is word for word. A brand still raw, or no brand at all:
   offer two or three provisional identities and say they are provisional (`references/brand.md`, "When there is no
   brand").
3. **What the skill remembers about a brand** lives in `~/Documents/VideoStudio/Brands/<brand>/`
   (`VIDEOSTUDIO_BRANDS` changes the root): `kit/` (the product kit, which makes the next video start ready:
   `scripts/kit.mjs`), `profile/` (the reference profile with the approved videos: `scripts/refine.mjs profile`),
   `videos.json` (the variety history: `scripts/variety.mjs`) and `brand.json` (the brand's options, above:
   `scripts/brand.mjs`). A brand with a kit skips the reading: it is in the kit.
4. **Data:** real people's data does not go in the video (name, e-mail, phone, document, photo), nor secrets, nor a
   number without a source. A screen that shows a customer, an e-mail or an amount is recorded with the sample
   account, blurred by the recorder, or redrawn with fictional data (`references/brand.md`, "Product screens").
   Without a true number, no "Counting number".
5. **The templates' examples are examples of FORMAT, with no brand** (`templates/<id>/example*.json`,
   `assets/example/`): skeleton greys, placeholder texts ("Your product", "Feature one") and a placeholder logo. They
   show the parameters of each template; they are never the look of a video. A video starts from the **chosen
   direction** ("Variety", at the top), with the person's colors, font, logo and content in place of the placeholders.

The rest of this page is the studio: it applies the same to every brand.

## Language

**Reply in the user's language**: someone who writes in Portuguese gets Portuguese, someone who writes in English gets
English, from the first question to the delivery report. This skill's references are written in English: read them as
instructions and answer in the user's language. The catalog and the directions page follow the same language
(`--lang pt` for someone who asks in Portuguese).

The video's on-screen language (captions, titles, on-screen text) follows the briefing. Without one, it is the language
of the product's own screens and site (what the reading finds); when that is unclear, the language the person asked in.
State the assumption in one line. One language per video, always.

This skill makes videos without narration: the whole product video (motion, 3D, original soundtrack, sound effects,
refinement, thesis, critic and the templates), and nobody speaks. The music is the lead, the effects land on every cut
and the caption is the on-screen text. A request with narration, voiceover or a person presenting on camera: say in one
line that this skill makes videos without narration, and make the video without voice.

`$SKILL` is this skill's folder, which appears at the top when it loads. The whole engine lives in here, in the usual
paths: `scripts/`, `assets/`, `references/`.

## Fast path to the preview (read this first)

Owner's rule: the time until the preview is the problem. **Target: the preview in ≤ 10 min** for a product that already
has a kit (from the request to the draft open for the owner) and **≤ 25 min** for a new product. The common case is the
product with a kit (`node $SKILL/scripts/kit.mjs list`): follow only this list. **The long references
(`references/workflow.md`, `references/tutorial.md`, the catalog, the templates) are only read when the case leaves the
path** (below); reading everything before acting is what ate the first minutes.

Below, `progress` is `node $SKILL/scripts/progress.mjs` (write the whole command: `P="node …"` followed by `progress now` does not run in zsh); each of its commands prints the % line that goes to the chat.

1. **The kit:** `node $SKILL/scripts/kit.mjs new-video "<product>" <new folder> --request "<the request, in the
   owner's words>"`. It creates the folder with `video.mjs`, `recording/` (the base: sign-in, language, tours, write
   barrier, sample data), the series, the seed,
   the `REQUEST.md` with these steps already filled in with the paths, and starts the stopwatch (target 10 min).
   `kit.mjs show` says what the kit has. The environment is already set (`node $SKILL/scripts/environment.mjs
   --fix`, once per machine).
2. **The texts** (`progress now <folder> script`): in `texts.json` (`abertura` = the title, `p1`…`pN`,
   `fechamento` = the end); the base thesis comes from the kit, only the proof scene changes. Ask the owner only about
   what, if wrong, throws the preview away; everything else is a one-line assumption. `progress done <folder> script`.
4. **The journey** in `recording/journey.mjs` (`progress now <folder> recording`), with `g.antes` on the what's-new step
   (`references/tutorial.md`, the recorder table, when you need the API).
5. **The check:** `node <folder>/video.mjs --check` until ✓. It finds at once everything the compositor would refuse
   (the short scoreboard, the long label, the before, the series, the environment).
6. **Record:** `node <folder>/video.mjs` (the barrier with 0 leaks; look at the tap sheet). `progress done <folder> recording`.
7. **The draft:** `progress now <folder> draft`; `node $SKILL/scripts/tutorial/compose.mjs <folder> --mode draft`
   (it prints the `WebGL: …` line: report it); look at the event sheet; open the MP4. `progress done <folder> draft
   --note "preview ready"`. **The preview goes to the owner now**, with the assumptions.
8. **The refinement check runs alongside, not before:** `progress now <folder> refine` and `node
   $SKILL/scripts/refine.mjs <folder> --channel <channel>` in the background; its warnings go in the preview message
   ("the refinement check found X; I'll fix it at the end"). The refinement check only blocks the FINAL.
9. `progress report <folder>`: where the time went, against the target. Once the video is approved, `kit.mjs save`
   updates the kit.

**Off the path** (then, yes, the references): **product without a kit** → the full workflow (`references/workflow.md`),
with `progress.mjs start <folder> --new` (target 25 min) and, once the video is approved, `kit.mjs save "<product>"
--from <folder> --recipe <folder with base.mjs and recipe.json>` (`references/kit.md`); **a style that is not a real
screen** → the style card and its `TEMPLATE.md`; **the before of a previous version** → `references/kit.md`, "The before";
**an engine defect** → fix it here, in the skill folder, without holding up the preview: what the refinement check flags
in the engine goes with the preview.

**How the work runs:** in this conversation.

1. **The conversation plans, decides and talks to the owner:** every question goes through `AskUserQuestion`, the
   recommended one first, with the table or the contact sheet in `preview` and the previews open on the Mac
   (`open <file>`; audio and video with `open -a "QuickTime Player" <files>`).
2. **A recipe that is already written and heavy can go to background subagents** (`Agent` with
   `run_in_background: true`): recording several screens, the chapters in parallel, the formats of a final. Each one
   gets a short request: goal and inputs (paths), the thesis, the skill's commands, the rules and what to deliver. The
   creative direction, the contact sheet review and the final review stay with you.
3. **Render, at most 2 at the same time**, counting this conversation and the subagents.
4. **Nothing here is paid:** the thesis and the critic use the Claude account's quota; soundtrack, effects and render
   run on the Mac.
5. **A defect in the skill is fixed in the skill folder** (`$SKILL`), and the tests run again
   (`node --test "$SKILL/tests/*.test.mjs"`).

## Preview first, with progress in %

Owner's rule: **there must always be a preview**, made faster and more on target, and he follows it in %.
The workflow exists to reach a **preview seen by the owner as soon as possible**: the draft with sound, in the main
format, with the contact sheet looked at. It is the first deliverable, always. **The preview does not wait for the
refinement check:** it runs alongside, in the background, and its warnings go with the preview; the refinement check
only blocks the final. Whatever does not change the preview waits until after it: fine-tuning, the second format, the
final at 60 fps.

1. **One round of questions before the stills, with everything that is missing, each with your suggestion.**
   With a yes to the first step (at the top), the recipe's conversation replaces this rule: topics, directions and
   prompt, in as many rounds as the person wants.
   Ask what only the person knows and the reading did not answer (the list at the top: product, audience and channel,
   what to prove, the brand, references, their ideas of style), all together, never one question per message, and
   never what the code or the site already says.
   What the brand already decided is not asked again: the style, the music, the format and the channel of a product
   with a kit come from its reference profile (`refine.mjs profile`), from the series or from the approved video
   (`recommend-style.mjs --name`), stated in one line ("From your last video: Rolling list, the series' house track,
   9:16 for Reels; tell me if this one is different."). A first video has none of that: the look is chosen by the
   person, on stills.
3. **Parallel by default:** recording, series and identity, and soundtrack in background subagents when they do not
   depend on each other (assembly waits for everything). Render, at most 2 at the same time.
4. **Progress in %, on two scales** (`node $SKILL/scripts/progress.mjs stages` shows the stages, the weights and the
   minutes):
   - until the preview: kit and request (or reading and thesis) 10, script 15, recording 30, series and soundtrack 5,
     draft 25 (the math is over what exists in this video);
   - from the preview to the final: preview refine 10 (what runs alongside it), requested adjustments 15, final render 45,
     final refine and critic 20, delivery 10.

   `kit.mjs new-video` already starts the stopwatch (`start --kit`). Without a kit, start with `node
   $SKILL/scripts/progress.mjs start <video folder> [--new] [--skip recording]`; parallel stages (voice and recording)
   can be in `now` together; for each stage that starts, `now <folder> <stage> [--remaining <min>]`; for each one that
   ends, `done <folder> <stage> --note "<what got done>"`. Each command prints the line, which goes to the chat exactly
   as it came out:
   `Preview: 40% — draft ready; now: recording (~2 min) · ~5 min left, 4 of 10 min`. In a long stage, `line <folder>`
   every ~5 min. Once the preview is done, the scale moves to the final ("Final: 20% — …"). At the end, `report
   <folder>` shows where the time went, stage by stage and the "between stages", against the target (and writes
   `stopwatch.md`).
5. **Preview target time:** ≤ 10 min for a product with a kit (`start --kit`, which `kit.mjs new-video` does); ≤ 25
   min for a new product (`start --new`). Over it, or the pace is going to go over (the line warns): tell the owner
   right away, in one line, and cut the preview's scope (a single format, draft at 30 fps, fine-tuning for later). Do
   not cut the contact sheet review; the refinement check runs alongside and its warnings go with the preview.

## The GPU, before every render

Every Chromium in the video pipeline (the render, the contact sheets, the screen recording, the refinement check) comes
from `scripts/playwright.cjs`, which on the Mac launches with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`.
3D on the CPU (SwiftShader) is ~13× slower.

- **Before the draft and before the final**, run `node $SKILL/scripts/playwright.cjs --gpu` and report the `WebGL: …`
  line along with the rest. It has to be the graphics card (on the Mac, something like
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M…)`).
- `render.cjs` prints the same `WebGL: …` at the start of every render and, on the Mac, stops with exit code 5 if it
  falls back to the CPU.
- Got `SwiftShader`, `llvmpipe`, `Software` or the `3D ON CPU` warning in the console: **stop** and fix it
  before rendering (is the copy in the project's `tools/playwright.cjs` old? copy the skill's). CPU only on
  purpose, with `VIDEOSTUDIO_NO_GPU=1`, when the owner asks or the machine has no GPU, and say so.
- Playwright and the soundtrack's Python: `node $SKILL/scripts/environment.mjs --fix`, once per machine, finds (or
  installs, asking before downloading Chromium) and writes `~/.videostudio/environment.json`, which every script reads on
  its own. No command needs `PLAYWRIGHT_PATH` or Python by hand.

**Off the fast path (product without a kit, new style), read `$SKILL/references/workflow.md` in full and follow it.** It
is the video's full workflow: the three no-exception rules, the project reading, the triage, the briefing, the series,
the storyboard, the soundtrack and the delivery. It applies here without changing anything.
This page says what the workflow does not say: the thesis, the style, the extra rules and how to assemble and prove
each style without voice.

## The thesis: what the video has to prove

**Before the style, the briefing and the script, the skill writes the video's thesis** (`recipes/thesis.md`; step 0.2
of the workflow). Without it the script comes from the feature list and films the click path: in a product that sells an
AI working on its own, that turns into people clicking for three quarters of the screen time and "Step 2 of 4" cards,
the opposite of what it sells.

1. **Ask for the thesis right at reconnaissance,** in the background, while you write the reading:
   ```sh
   node $SKILL/scripts/thesis.mjs write <product repository> --out <project folder> [--request "<what the owner asked for, in their words>"]
   ```
   A fresh Claude conversation, which sees only the recipe and the repository, reads the sales copy, the README, the
   demo and the names of things in the code, and writes `<project folder>/thesis.md`. It takes minutes and uses the
   account's quota, with no paid service. Product without a repository: write it by hand following the recipe and run
   it through `validate`.
2. **The thesis has five parts:**
   - **what the product sells, in one sentence,** in its own words and with the `file:line` it came
     from;
   - **who buys and what pain they have;**
   - **the proof scene:** the moment, on the real screen, when the product does on its own the work it promises. The
     video exists to show that scene;
   - **what the video does not show:** the manual work the product exists to remove, what is done once (sign-up,
     setup), features that do not prove the sentence, and the safety net (the handover to a person);
   - **the intent:** `sell`, `teach` or `update` (what's new).
3. **Check it and show it in five lines:** `node $SKILL/scripts/thesis.mjs validate <project folder>`. The five lines go in
   the reconnaissance summary and at the top of the script table. Disagree with a part? Fix `thesis.md` with the evidence
   (`file:line`, or the owner's sentence) and validate again. **Never adjust the thesis so the script passes.**
4. **The format follows the intent.** The choice happens here, before the style:

   | Intent | Who watches | Structure | On-screen text | Type and `--goal` |
   |---|---|---|---|---|
   | `sell` | someone who has not bought yet | hook → the proof scene → call to action | only what reinforces the proof. **No "Step N of M", instruction card, "Tap…" or tour of the screens** | demo, launch, cut or teaser, **never a tutorial**; `launch` (`attention` up to 15 s) |
   | `teach` | someone who already uses it | the task's title → steps → the screen of the finished task | step card and the sentence in the imperative, as today | tutorial; `teach` |
   | `update` | someone who already uses it or follows it | the before (short) → the after → where to see it | what changed and where to see it | update; `update` |

   "Explain the product", "present it" or "show the screens" to someone who has not bought yet is `sell`. A real
   screen in a sales video comes in as proof: it comes out of the same recorder, with `legenda.rotulo: "nenhum"` in the
   series and the caption saying what the product is doing, and whoever appears doing the work is the product.
5. **The screen-time rule.** In the script, each scene says **who does the work**, in a "Who does the work" column
   (the name `thesis.mjs count` looks for): `proof` (the product, in the proof scene), `product` (the product, in another
   scene), `person` (someone operating, or receiving the work) or `—` (poster card, logo). In a sales video, of the
   time the product is on screen, **the proof scene is at least 50% and a person working is at most 25%** (the target
   is zero).
   `node $SKILL/scripts/thesis.mjs count <video folder>/script.md --write` does the math and writes it into the script;
   exit code 1, **the script goes back** before it reaches the owner.
6. **The critic checks the thesis** on the finished video (`critic.mjs`, which finds `thesis.md` on its own): does the
   video prove the sentence? who does the work on screen? is the format the one for the intent?

## The style: look at the product, recommend, ask

The engine makes **22 styles**, each with a real template. The list is one command away and is the only list:
`node $SKILL/scripts/catalog.mjs list --format md` (what each style is for, what it needs from the person and the
template that makes it; `catalog.mjs show <style>` for one). The style is chosen **before the briefing**, right after
the thesis (step 0.2 of the workflow), and it applies to any request. **The person's own idea comes first**: a style
they name, describe or show is the starting point, and the recommendation below is what you bring when they have none
or ask for your opinion.

The catalog is in `references/catalog/`: `rules.md` (the 16 rules that apply to every style), `choosing.md` (the
selection guide), `styles/<id>.md` (one card per style) and `no-template.md` (styles and script ideas that do not have a
template yet). **Read `rules.md` and `choosing.md` before recommending.**

0. **Look for the video the owner already approved** before anything else: videos in the repository (`src/assets`,
   `public`, what the site plays), in the history (`recommend-style.mjs --name`), whatever they show in the
   conversation ("watch this video"). Found it? Actually watch it: a contact sheet of frames
   (`ffmpeg -vf "fps=1/2,scale=400:-1,tile=6x5"`). It is the benchmark for style and finish (rule 14 of the catalog).
   Did not find the project that generated the video? Ask once whether it is on another machine before redoing it from
   scratch.
1. **Look at the product,** during the workflow's reconnaissance (0.1), before asking: the repository and the screens;
   **what changed** (`git log`, changelog, the conversation — and `git fetch`: the local clone may be behind what is
   live); **who it is for**; **where the video will play**; how many new features or steps there are; whether the
   product has a text box (search, AI, chat); **whether the request asks for an explanation** ("explain it a bit").
   That gives the values:
   - objective: `teach` · `update` · `launch` · `attention` · `results`. **It comes from the thesis's intent:**
     `sell` → `launch` (`attention` for a piece of up to 15 s); `teach` → `teach`; `update` → `update`;
   - channel: `site` · `whatsapp` · `reels` · `feed` · `big-screen`. **The same channel goes to the refinement check**
     (`refine.mjs … --channel <channel>`): it measures the lettering at the size the video plays at (390 px on WhatsApp
     and Reels, 854 on the feed). A video that goes to two places: each format's refinement check with its own channel
     (the site's 16:9 with `--channel site`, the 9:16 with `--channel reels`);
   - product: `b2b` · `young` · `layperson` · `finance` · `creator` · `game` · `retail` · `other`;
   - the number of items, whether there is a text box, whether it asks for an explanation (`--explain`), whether it
     explains an idea or how something works inside, and not where to click (`--concept`), and the style approved
     before (`--approved`).
2. **Run the table:**
   ```sh
   node $SKILL/scripts/recommend-style.mjs --goal update --channel reels --product young --items 5 --name "Product" [--text-box] [--explain] [--concept] [--approved <style>]
   ```
   It returns the recommended style with the reason, plus three more that also work, each with its example video, and
   the tone for that kind of product. `--name` reads the product's history: **chapters with index is not recommended
   twice in a row for the same product, unless the previous one was approved** (then it is the benchmark). The table is
   the starting point: if the reading shows something it does not know (the product has no screen, the owner already
   rejected a style), change it and say why.
3. **State the recommended one and the reason in one line:** "I recommend **Rolling list**: there are five new features
   for Reels and the audience is young; one per second, with the proof on screen."
4. **State the style as an assumption and move on** ("Preview first"): the product's approved style or the recommended
   one, in one line, **with a still of it in the person's brand** (the board, or `catalog.mjs open --directions …`).
   Ask before the preview when the choice changes everything and there is neither an approved style nor a clear
   recommendation: two or three options as stills, the recommended one first, each with one sentence. The still is
   approved before anything is animated ("show it before you make it"); changing the style after the preview happens
   by watching.
5. **Read the card** (`references/catalog/styles/<id>.md`) and the chosen template's `TEMPLATE.md` (for chapters,
   `references/chapters.md` in full) before the briefing: the briefing asks for what the template needs (the screens,
   the number, the typed text, the before and the after).
6. **Did they ask for an idea** (hook, twist, joke) or a style that does not have a template yet? Look in
   `references/catalog/no-template.md`. You can suggest it as a script idea, but warn that the video ships **in the
   closest template**, which the line itself says.
7. **At delivery,** record the direction in the brand's history (`variety.mjs record`, in "Variety", at the top)
   and the product's style: `node $SKILL/scripts/recommend-style.mjs record --name "Product" --style <id> --video <folder>`
   and, when the owner approves, `--approved` (the product's next video starts from it).

A real screen shrunk inside a mockup frame, with the caption
underneath, was rejected in every video that used it: no
style does that (`references/catalog/rules.md`, rule 2). **Nor a static screenshot of the system inside a panel**
(rule 15): the video redraws the interface with the real media, collected by `scripts/extract-media.mjs`.

**Product type (before recording):** `node $SKILL/scripts/product/type.mjs <project-folder>` recognizes from the repository whether it is a website on the computer, a phone app, a desktop program with a window, a command line or a product with no screen, and states what it found in one line. Tell the owner that line; the path for each type (start it, record it, template, what to ask, the Screen Recording permission on macOS) is in `references/product.md`.

## Three extra rules, no exceptions

1. **No shrunk screen, no static screenshot.** Interface that appears too small to read is redrawn, large, with only
   what matters, and with the product's real media (avatar, icons, photos, background video, numbers from the public
   API: `scripts/extract-media.mjs`). A screenshot of the system does not become a panel in the video (catalog, rule
   15); the real screen only comes in as proof, full screen and with zoom on the detail. No recording on a real account
   counts a visit, click or device: metrics calls are intercepted.
2. **No final without the refinement check passing, and no draft or final without the contact sheet looked at.** The
   preview goes with the refinement check running alongside and its warnings in the message; the final only ships with
   `PASSED`. `node $SKILL/scripts/refine.mjs <video folder> --channel <channel>` until it comes out with `PASSED`
   (`references/refine.md`: legibility by OCR, reading in the player, font checked against the kit, frozen or empty
   frame, safe area of everything that appears); then the contact sheet looked at: nothing empty, nothing illegible,
   nothing cut off in vertical (`references/chapters.md` §12; each template generates its own sheet).
   A script's ✓ does not replace looking.
3. **No script without the thesis, and no sales script that fails the count.** `thesis.md` exists before the first line
   of the script ("The thesis", above). A sales video carries no "Step N of M" and no instruction card, and
   `thesis.mjs count` has to exit with code 0 before the script goes to the owner.

## Assembling and proving without voice

Without narration, the video is image, on-screen text, soundtrack and effects. Three things change compared with a
narrated video:

- **timings are fixed:** each scene lasts as long as its text takes to read (references/chapters.md, "without
  voice"), on the soundtrack's bar grid, and nothing waits for a line to be spoken;
- **the caption is the on-screen text:** the short sentence of the step, the item or the chapter, large and inside the
  safe area;
- **the soundtrack is the lead:** role `protagonista`, −14 LUFS, with an accent on every cut and the UI sounds on the
  taps (`references/soundtrack.md`). In the briefing, the music is heard first: 3 excerpts of 18 s in different
  directions (`arrange_series.py` with one identity per direction); on Reels, something upbeat (house 124–128, garage
  132, drum and bass 172).

The format comes from the channel: Reels, TikTok, Shorts → 9:16 only; website → 16:9; both only when the video goes to
both places.

### The templates

**The twenty templates in `templates/`**: `templates/<id>/TEMPLATE.md` says everything — parameters, the command that
renders, the variations and the limits. Start by copying the template's `example.json` (or the `example-<variant>.json`
closest to the direction): it is a format example, in skeleton greys with placeholder texts and a placeholder logo.
Swap every grey for the brand's color in that role, the font, the logo, the texts, the screens and the numbers for the
video's; no brand is built into the template. Still first, then the draft, contact sheet looked at, then the final.

- **Every template runs without narration:** the sound is the skill's soundtrack as the lead (`arrange_series.py`; in
  the teaser, the template's `soundtrack.py`), with effects on the cuts, the taps and the keystrokes, and the on-screen text
  tells the story. Run each one as its `TEMPLATE.md` says.
- The `falas` (spoken lines) of an example JSON become captions only, timed to the text (Rolling list, teaser, Before
  and after), or are left out with a warning (Counting number, real screen, Typing text).

**Drawn explainer** (`templates/drawn-explainer/TEMPLATE.md`): another engine, on canvas, ported from an open engine
(MIT; the credit is in the template's LICENSE). Each scene is a function in `scenes.js` that draws as a function of time;
each element comes in at an `at` that is a word of the scene's `texto` (`at: 'Instagram'`), a marker (`'#cola'`) or
seconds, and each entrance becomes a cue in the sync sheet, played by the skill's soundtrack (`arrange_series.py` +
`sounds.py`). Without narration, each scene moves on by `min` or by the time it takes to read its text.
`node $SKILL/templates/drawn-explainer/render.mjs <video.json> --out <folder> [--mode final]`; it prints the
WebGL renderer (it has to be Metal on the Mac), checks each format and takes the contact sheet. Brand copied from the
reading; the `papel`, `giz`, `planta`, `noite` textures only go on top of the brand colors.

- Soundtrack: Python with numpy and scipy, the one from the skill's environment (`environment.mjs --fix`, once per
  machine).
- Draft: 30 fps without motion blur, seconds; final: 60 fps with subframes, minutes per format.

### Chapters

`references/chapters.md` §11 and `assets/chapters/README.md`:

```sh
node $SKILL/scripts/chapters/new.mjs <video folder> --fonts "Título,Texto,Mono" [--formats 9x16]
node $SKILL/scripts/extract-media.mjs <public url of the sample account> --out <video folder>/media/<name>
node $SKILL/scripts/chapters/render.mjs <video folder> 01-<name> --mode draft
node $SKILL/scripts/chapters/assemble.mjs <video folder> --soundtrack --deliver <folder>
```

The order that worked:
1. **The script with the timings.** Each chapter has the title (2–3 words), the support line and the stage beat by
   beat; the duration comes from the text that is read (`references/chapters.md`), and each beat comes in at a fixed
   time in `video.js`.
2. **The brand copied from the product** into the kit: tokens, the title class (`ESTILO_TITULO = 'italic'` if the site
   is italic), the shape (chamfer, radius, ring), the **logo component** and the site's **slogan**
   (`references/brand.md`).
3. **The real media** of the sample account (`extract-media.mjs`), and its components in the kit (the profile, the
   card, the button) so all chapters draw them the same way.
4. **One whole chapter** as the benchmark, rendered and looked at on the contact sheet: the stage builds up in beats,
   the camera (`camPalco`) moves in on the action in 9:16, the object's text is ≥ 28 px in the final frame.
5. **The `CONTRACT.md` filled in** (it comes with the project): the benchmark, the rules and, per chapter, the timings
   and the stage beat by beat. Only then the other chapters in parallel (one subagent per chapter, each in its own
   folder, without touching the template). A template defect they find, you fix in the kit for everyone.
6. The template's opening and closing already recompose for vertical (the brand starts at the center and rises when
   the index comes in; without true numbers, the closing goes straight to the logo and the slogan).
7. **`assemble.mjs --soundtrack --deliver`**: joins, composes the soundtrack (`audio/identity.json`, role `protagonista`),
   measures in `verify.py` and finalizes each format. Then the contact sheet of the whole video, looked at.

### Tutorial

The workflow's tutorial mode (`references/tutorial.md`), with no `voz` in `video.mjs`: each step's caption is the
`g.passo` sentence, and each step stays on screen as long as it takes to read and for the hand to act.

- **the opening already shows the result:** the success screen (`g.sucesso`, or the last frame) appears next to the
  title (16:9) or below it (9:16), so the viewer knows where the tutorial ends up. Every script ends on a
  `g.sucesso()` on the screen that shows the task done (`"previa": "nenhuma"` in the series' opening turns it off);
- **recorded phone**, in 16:9 or 9:16: **wide then detail** — each new screen comes in **whole** (never cut in the
  middle), holds for a moment and the camera moves in on the current field, at reading zoom; on success, it opens up to
  the whole result. In the detail, the 9:16 stays in the safe area and goes down to the app's bottom bar; the camera
  breathes slowly (never a frozen frame). This is already in the engine: **do not copy the engine to change it**. An
  engine defect is fixed here in the skill and copied again (`scripts/tutorial/copy.mjs`);
- **cinema mode** (`"cinema": "moldura"`, the default): the video's mockup frame gets 3D and motion and the steps stay
  face-on. Opening on a panel with the brand logo that exits diagonally, a whole 3D phone spinning with the success
  screen, the screen itself blurred behind the device (no leftover plain background), a glow in the brand color at each
  step, a light spin on the screen change, closing with the brand logo assembled in 3D. **When to use it and when to
  turn it off is your call**, by the rule in `references/tutorial.md` → "Cinema mode": a brand piece (Reels, website,
  the app's player) gets cinema; a sober help center, the owner's request or a render without GPU, `"nenhum"`;
- **UI sounds** on the taps and on the screen change, from the compositor's sync sheet; the soundtrack rises and falls
  with the sections, with nothing to duck for;
- **web tool on the computer:** when the chosen direction is the tutorial on a 3D panel (`style:
  panel-tutorial`), start from the `assets/example/computer-tutorial-series/` series and one of its variants (recipe
  in `references/tutorial.md` §19; 19:9, panel with zoom, `g.secao`, text never over the screen, closing with only the
  logo), with the brand of the product in place of the demo one and without writing engine code. It is one direction among the others, not the default: the choice goes
  through variety (above).

### Prove

The preview (the draft) goes to the owner with the contact sheet looked at and the refinement check running alongside,
in the background: its warnings go in the preview message. **Before the final**, everything below passes:

0. **The refinement check:** `node $SKILL/scripts/refine.mjs <video folder> --channel <briefing channel> [--product "Name"]`,
   until `PASSED` (`references/refine.md`). It flags, with the frame marked: illegible text, text that disappears on a
   phone (below 16 px at the size the video plays at: on a 390 px player, 79 px in 16:9 and 45 px in 9:16; 16:9 on a
   phone held upright failing in a good share of frames calls for the 9:16), a font outside the kit or on the fallback,
   frozen or empty frame, something under TikTok's interface. On each format's final MP4, again. Approved by the owner:
   `refine.mjs profile "<Product>" --from <folder> --video <mp4> --approved` (the kit becomes the benchmark for the next
   one).
0b. **Direction: passing the refinement check is not being good.** The refinement check catches defects; it does not
   see a dull video. `refine.mjs` includes the **Direction** section (`references/refine.md`): a hook in the first
   seconds, a long stretch with the same composition, strong moments, variety, closing with sign-off. A `fraco` (weak)
   score does not go to the owner in silence: change what it points to (cinema in the mockup frame, transition, camera
   closer, Counting number, split step) and run it again. Then look at the contact sheet as the owner would and answer
   in writing, one line each: (1) do the first 2 seconds make someone stop scrolling? (2) does something really change
   every 3–4 s? (3) does the closing have the brand's sign-off? (4) next to the approved ones, does this look expensive
   or does it look like a template? A "no" is rework, not a warning. A tutorial that passes the refinement check
   without using 3D, motion or transitions is rejected all the same.
1. **The soundtrack measured:** −14 LUFS, ceiling of −1 dBTP, each accent on the cut's sample (`verify.py`, which the
   template and `assemble.mjs` run).
1b. **On-screen text without AI tics:** `node $SKILL/scripts/writing.mjs review <the template's .json | video.js | script.md>` (English rules by default; add `--lang pt` for Portuguese text)
   (or `--text "…"`) exits with 0 errors: no em dash, no "it's not X, it's Y", no reveal with a colon (a one-word
   label, "Before: 3 clicks", passes), no slogan in place of the fact ("Three requests, three live."), no filler
   (simply, basically, actually, literally, really) and no "let's go", "here we go", "stay tuned". The brand's slogan,
   copied from the site, goes in `marca.slogan` (or `--accept "…"`) and passes.
2. **The contact sheet, looked at:**
   - chapters: the contact sheet of **each format** (`references/chapters.md` §12): nothing empty, nothing illegible,
     nothing cut off in vertical, the same composition in every chapter, the index complete;
   - tutorial: the event sheet, and the tap lands where the caption says.
3. **The independent critic, with the thesis:** `node $SKILL/scripts/critic.mjs <mp4> --request "<what the owner asked for>"`
   on each format (`recipes/critic.md`; when the brand's options differ from the defaults, say so in the request: "no
   opening logo", "the closing carries the slogan '…'"): a fresh Claude conversation, which sees only the finished video, the thesis
   and the rubric, and returns approve/reject with up to 3 defects — the finish, whether the video proves the sentence,
   who does the work on screen and whether the format is the one for the intent (R14 to R16). Rejected: fix it and run
   it again, or write in the delivery why you are not fixing it.
4. In the report, what only the ear can judge: whether the soundtrack fits the brand and whether the effects are
   pleasant.

**Another language is another video:** another `video.mjs` or another template (title, `fimLinhas`, the chapter
titles, the series' `passo` in that language), and the on-screen text is rewritten, not translated word for word.


## Files

| File | When to use it |
|---|---|
| `scripts/kit.mjs` + `references/kit.md` | **first, always**: `new-video` starts the ready video from the product's kit (the fast path, at the top); `save` stores the kit of an approved video; `show` and `list` |
| `scripts/environment.mjs --fix` | once per machine: Playwright and the soundtrack's Python in `~/.videostudio/environment.json` |
| `scripts/reading.mjs` + `references/reading.md` + `references/brand.md` | **a brand without a kit**: collect the facts of the product's brand from its repository, then write the reading (the seven sections) before any image or sound decision |
| `scripts/brand.mjs` | the brand's options (`show`, `set`, `list`): opening logo, closing logo, slogan, call to action, language |
| `references/workflow.md` | **off the fast path** (product without a kit, new style): the video's full workflow |
| `references/catalog/` | **before the briefing**: the rules, the selection guide, one card per style and what does not have a template yet |
| `scripts/catalog.mjs` + `scripts/styles.mjs` | **in round 2 and when someone asks for the styles**: the list of the styles the engine can make (`list --format md`, `show <style>`), the page with them and the person's own stills and delivered videos (`open --folder … --brand …`) and the proposed directions side by side, each with its still (`open --directions … --folder …`). No sample gallery: a style is shown as a still in the person's brand |
| `scripts/board.mjs` + `recipes/board.md` | **whenever something is shown**: the local review board, one phase per scene (still → Approve still → animate → preview → Approve preview), the person's own picture pasted into a scene, the conversation per scene; `set`, `open`, `wait`, `patch`, `say`, `status`, `stop` |
| `scripts/recommend-style.mjs` | the objective × channel × product table: the recommended style, the reason and the alternatives; `record` stores the product's latest style |
| `templates/<id>/` | the twenty templates, each with `TEMPLATE.md` (how to render) and `example*.json` (format examples with no brand: greys, placeholder texts, placeholder logo) |
| `assets/example/` | what the format examples use: placeholder logo, symbol, icon and photos, the examples' font (`scripts/example-fonts.mjs`), a neutral sample page for the screen-recording examples (`page.html`), the engine's brand skeleton (`brand.js`) and the example series of the computer tutorial |
| `templates/drawn-explainer/` | **Drawn explainer style**: the original engine ported (canvas, Rough.js, Lucide; MIT), `render.mjs`, `icons.mjs <word>` (icon search), `TEMPLATE.md` with the scenes API and the interface kit (`s.ui`) |
| `scripts/extract-media.mjs` | the real media of a public page (images, background video, API JSON) with metrics blocked, to redraw the interface |
| `scripts/playwright.cjs --gpu` | **before the draft and the final**: the WebGL renderer of the video's Chromium; exits 1 if it is the CPU |
| `scripts/progress.mjs` | **from start to finish**: the preview and the final in %, the line for the chat (`start`, `now`, `done`, `line`) and the stopwatch (`report`: where the time went, against the target) |
| `scripts/writing.mjs review` | on-screen text without AI tics, before the refinement check |
| `scripts/refine.mjs` | **before showing any draft or final**: the automatic refinement check, with `refine.md`, `refine.json` and the marked frames; `profile` stores each product's kit and approved videos |
| `references/refine.md` | the refinement check's checks, the thresholds, fixing until it passes and the reference profile's format |
| `references/chapters.md` | **Chapters with index style**: the chaptered video with the interface redrawn, index, 16:9 and 9:16, contact sheet |
| `assets/chapters/` | the sample template of the chaptered video (component kit + opening, chapter and closing), with no brand; `README.md` says how to use it |
| `scripts/chapters/` | `new.mjs` (creates the project), `render.mjs` (chapter in both formats + contact sheet), `assemble.mjs` (joins, composes the soundtrack, finalizes) |
| `references/tutorial.md` | **tutorial mode**: the real recorded screen, the camera, cinema mode and the series |
| `references/soundtrack.md` + `assets/audio/` | the original soundtrack and the sound effects: the identity, the sync sheet, the mix and `verify.py`; in `sounds.py`, the Drawn explainer's eight (`pop`, `tique`, `blip`, `rabisco`, `giz`, `brilho`, `baque`, `erro`) and the `sino` switch (`brilho` and `sucesso`): a brand that refuses bells or chimes does not use the marked ones |
| `recipes/captions/` | **UI sounds** (`scripts/captions/caption.mjs --sounds`), off by default |
| `scripts/thesis.mjs` + `recipes/thesis.md` | **before the script, always**: the video's thesis. `write` (a fresh Claude conversation reads the repository and writes `thesis.md`), `validate` (the five parts and the five-line summary) and `count` (who does the work in each scene of the script and the screen-time verdict) |
| `scripts/critic.mjs` + `recipes/critic.md` | **the independent critic**: a fresh Claude conversation that sees only the finished video, the thesis and the rubric, and returns approve/reject with up to 3 defects; it runs at the end of every video, before the owner |
| `tests/` | `node --test "$SKILL/tests/*.test.mjs"`: the tests of the engine, the refinement check, the thesis, the critic, the captions, `recommend-style.mjs`, the Drawn explainer template and the new sounds (with Python, numpy and scipy), no network |
