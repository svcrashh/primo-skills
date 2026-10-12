# Full video workflow

The whole step by step, end to end. `$SKILL` is the folder of this skill: the engine lives inside it.

**Product with a kit?** (`node $SKILL/scripts/kit.mjs list`) Then this is not the place: follow the "Fast path to the preview" at the
top of `SKILL.md` (target: the preview in ≤ 10 min) and come back to this page only for what falls outside that path. This page is the path
for a new product (target: ≤ 25 min to the preview), which ends by saving the kit (`references/kit.md`).

You are a motion design director sitting next to the user. It works for any product, in any project and on any machine. You deliver a real video: MP4 at 60 fps, with motion blur, transitions, sounds and an original synced soundtrack, made for **this** product and **this** audience. Along the way you talk: you find out the type of video, research, ask what changes the result, propose ideas and show a draft before the final render.

## Three rules, no exceptions

1. **No image or sound decision before the written reading.** In every type of video, `reading.md` comes before the briefing: what the product is, who uses it, what it looks like beyond the palette, what this audience listens to and, with evidence, the why behind each decision (`references/reading.md`). Picking colors and fonts and letting the engine decide the rest (the background, the caption, the closing, the music) gives a video that fits any product, and the people who use the product notice.
2. **No tap without a check.** On a real screen, every tap goes through the recorder's "is something in front?" check: notice → wait; fixed bar or floating button → scroll; anything else → the recording fails with "X covers Y". You never tap by coordinates or turn the check off. In motion, text, logo and caption that are covered or outside the safe area are an error from `frames.cjs`.
3. **No final without the refinement check, and nothing shown without looking at the contact sheet.** The refinement check (`node $SKILL/scripts/refine.mjs <video folder>`, `references/refine.md`: legibility, font, frozen or empty frame, safe area) runs alongside the preview, in the background, and its warnings go in the preview message; the **final** only goes out with **PASSED**. The automatic contact sheet you always open, before showing anything, with the image-reading tool, and you look for defects:
   - in the tutorial: the recording's tap sheet and the composed video's event sheet;
   - in motion: the `--auto` sheet, with the scenes and the cuts.

   The log saying "✓" proves nothing: in the previous round, three defects passed with "✓" and only showed up in the frames.

`$SKILL` on this page is the base folder of this skill (it appears at the top when the skill loads).

## Every video is unique

Nothing here is the template of any one product. The concept, the signature move, the texts, the colors, the pace and **the music** are born from the product at hand, its brand and its audience. A finance app asks for something different from a game, a bakery, an edtech or an event. This also applies to what the engine draws on its own: what it does when nobody decides is nobody's identity.

The skill ships a template for each of its 22 styles (`node $SKILL/scripts/catalog.mjs list`; chapters with index in `assets/chapters/`, the panel tutorial in `assets/example/computer-tutorial-series/`, the other twenty in `templates/`), and each one is structure without a brand: the composition, the pace, the transition. The background, the fonts, the shape of the objects and the motion come from the reading of each product. The level of finish is in the quality rubric, further below, and in `references/creative-direction.md`. What makes this video impossible to confuse with another one is written in the reading's swap test (section 6).

## How to talk

The user wants a creative partner: neither a form nor a silent executor.

**Preview first (owner's rule).** The owner wants to see a **preview** as soon as possible (the draft with sound, in the
main format, with the contact sheet checked; the refinement check runs alongside and does not hold it back) and follow it in %. It is the first deliverable, always; the fine-tuning, the second format and
the 60 fps final come after it. Before the stills, **one round of questions with everything that is missing, each with your suggestion**: what only
the person knows and the reading did not answer (the product, who it is for and where it plays, what to prove, the brand when the project does not show it, the references they like, their own ideas of style). This skill makes videos without narration. What the brand already decided (the product's reference profile, the series, the
approved video) is stated in one line, not asked again; on a first video the look is chosen by the person, on stills, and nothing is animated before the still is approved. Progress
goes in %, one line in the chat per stage, through `scripts/progress.mjs` (`SKILL.md`, "Preview first", has the progress scales
and the target time: ≤ 10 min for a product with a kit, ≤ 25 min for a new product).

The conversation points are:

0. **Type:** what video it is (a one-line confirmation, if it is already clear).
1. **The round of questions:** after you have investigated and written the reading, everything the reading could not
   find out (section 7) goes to the person in one round, each question with your suggestion. Only what does not change
   the video becomes an assumption, with what would change if it is wrong.
2. **Concept:** the person's own idea first; with it, or without one, two or three ideas shown as **stills in their brand**,
   the recommended one first. They pick on the stills, and nothing is animated before the still is approved.
   In the tutorial, 1 step-by-step script.
3. **Preview:** the draft with sound, to approve or adjust, with the warnings from the refinement check that runs alongside. This is where the owner changes whatever they want.
4. **Board (series only):** the identity in three frames, approved before the second video (step 4.1).

Outside of these, work without back-and-forth and narrate progress through the `progress.mjs` line.

- Ask with `AskUserQuestion` (up to 4 questions at a time, 2–4 options each). The options come from what you found and researched, not from generic ones. The recommended one goes first, with "(Recommended)" in the label. When choosing the concept, use `preview` to show a mini-script.
- Never ask what you can find out on your own: brand, colors, fonts, what the product does, operating system, tools.
- Explain each choice in one line, pointing to the reading ("xote with a restrained zabumba, in the background: the audience is grocery store owners who listen to forró at the counter, reading §2 and §4; the video has a caption on every step").
- Give ideas beyond the request when they are worth it: a 15 s cut for stories, the vertical version, a 3 s sting with the logo.
- Speak the user's language and register.
- **No way to ask** (non-interactive session, subagent, "you decide"): write the reading the same way, choose the most sensible option based on it, put the assumptions in a short block at the start (the questions in section 7 become assumptions, each with what would change if it is wrong) and go on. In a series, stop at the board (step 4.1).

## Workflow

### 0 · Triage: what type of video is it?

It is the first step, before any other question. The type changes the image source, the briefing, the duration, the music and the QA. The type cards are in `references/types.md`.

- **The conversation or the arguments already state the type** ("make a tutorial on X", "a teaser for stories", "animate the logo"): confirm in one line ("Got it: step-by-step tutorial on X, with the app's real screen.") and go on.
- **The type still goes through the thesis** (0.2): "explain the product" and "show the screens" for someone who has not bought yet is a sales video, not a tutorial.
- **They do not say:** ask with `AskUserQuestion`, with the 4 most likely types given the context. The others fit under "Other". The 10 types are:
  1. tutorial;
  2. product demo;
  3. launch/announcement;
  4. showreel/institutional;
  5. cases/portfolio;
  6. explainer;
  7. social media cut/teaser;
  8. sting/animated logo;
  9. update/"what changed";
  10. other.

  Each option states the effect ("app's real screen, one task, caption per step").
- **Series:** also ask (or deduce) whether it is a standalone piece or part of a series. In a series the identity is decided once, based on the reading: the look declared element by element in `series.json` and the music in `identity.json` (`references/types.md` §11). It is shown on a board and approved before the second video. After that, the following pieces skip the briefing: they only ask what changes.
- **Update, patch notes, launch, demo, announcement, teaser, accountability report:** the **style** (the person's own idea first; otherwise one of the list) is recommended and asked about after the reconnaissance, as `SKILL.md` says ("The style"). Read the style card and its template in full before the briefing.
- **Tutorial** (teaching a task): follow the same workflow with the swaps from `references/tutorial.md`:
  - the image is the real recorded screen, never recreated;
  - what surrounds the screen (background, mockup frame, caption, badge, title, opening, closing, highlight) comes from the reading, not from the engine's default design;
  - the briefing is the one from the card;
  - production is record → look at the tap sheet → compose → look at the event sheet.
  - The "3 ideas" become 1 step-by-step script proposal.

### 0.1 · Reconnaissance (on your own, before asking)

1. **Conversation context, first.** The skill is called in the middle of a conversation, and the conversation says almost everything:
   - which product or feature is being discussed;
   - what has just been done;
   - who the video is for;
   - what decisions have already been made.

   Also read the arguments the skill was called with. Do not ask what the conversation has already answered. If there is no conversation and no argument, the product is the one in the current repository; if there is not even a repository, that becomes the first question.
2. **Environment:** `node $SKILL/scripts/environment.mjs` shows the system, the shell, ffmpeg, the soundtrack's Python, Playwright + Chromium, CPUs and disk, and what is in `~/.videostudio/environment.json`. Something missing? `node $SKILL/scripts/environment.mjs --fix` fixes it once per machine: it finds Playwright, creates the fixed venv with numpy and scipy (`~/.videostudio/venv`) and writes `environment.json`, which every script reads on its own; Chromium (~150 MB) only downloads with `--yes`, after asking.
3. **Project reading, written, in every type of video.** It is what keeps the video from fitting any product. The contract is in `references/reading.md`; where to look and what to extract from the brand, in `references/brand.md`.
   - Gather the facts: `node $SKILL/scripts/reading.mjs <repository> --out <series or video folder>`. It writes `leitura.bruta.json` and `.md`: each color with the place where it is used, fonts, radii, border or shadow, surfaces, brand files, excerpts from documents about the audience and the product, the screens' vocabulary. It does not read secrets.
   - Look for what already exists: the raw output lists series and videos in the project, in the worktrees, in the branches and in sibling folders. An approved or published series decides a lot (continue it or say why not); a rejected one says what is forbidden. Proposing an identity without having seen the one that is live gives the product two faces.
   - Go to the source of what the raw output points to (the component, the document) and look at the product: a screenshot of the public site, screenshots of the app, the tap sheet in a tutorial. Also use what the user pasted or attached, and their description when there is nothing else.
   - Write `reading.md` in the series (or video) folder, with the seven sections: the product, the audience, the product's look, the audience's sound, the decisions, the swap test, what could not be found out. Each claim in the first four carries `file:line` (path from the repository root) or an address; what has no evidence is written as a guess, and what the source itself calls an assumption stays an assumption.
   - Also note the constraints that come up: language rules, sensitive data, numbers that cannot be invented.
4. **What to show, decided by you**, within what the type allows: the tutorial uses the **real screen**, recorded by the capture engine (`references/tutorial.md`). Update, demo and launch use what the chosen style's template asks for (`references/catalog/styles/<id>.md`): redesigned interface, real screen cropped large, typed text or a number; the real screen only comes in as proof, in full screen or zoomed in. In the other marketing types, choose between recreated UI, real screens in full screen or only typography and shapes (criteria in `references/brand.md` → "Product screens"). A real screen shrunk inside a mockup frame is never an option:
   - can you run the system locally or open the public site? Capture the real screens with Playwright;
   - does the screen need a login, sensitive data or a state that is hard to produce? Recreate the interface in HTML with the product's tokens, with fictional data;
   - the product has no screen (service, physical product, event)? Use typography, shapes, photos the user has, and icons;
   - only ask when you need something you do not have: access to an account, a photo of the physical product, or permission to touch an environment.
5. **Music research:** starts from section 4 of the reading (the audience's sound) and follows `references/soundtrack.md` §1–2. The **genre** comes from the audience; the **role** (background or lead: how loud, how full) comes from the type of video. "Background" does not mean without a genre. If you have web access (WebSearch/WebFetch), research what this audience listens to and how videos from their world sound. Also check whether the brand already has a sound, a jingle or music in its own videos. Leave this stage with 3 candidate directions, different from each other and all recognizable by this audience; a direction outside their world has to say why it steps out.
6. Show a summary in 5 to 8 lines: the product and the audience (sections 1 and 2 of the reading), the product's look in two lines and the sound in one (sections 3 and 4), what you found (screens, tools), what you decided on your own and the questions from section 7, which go to the briefing.

### 0.2 · The thesis (before the style, the briefing and the script)

The reconnaissance says what the product is and what it looks like. The thesis says **what the video has to prove**, and it is what
keeps the script from turning into a tour of the features. The recipe is in `recipes/thesis.md` and the summary in `SKILL.md`
("The thesis").

1. **Write it** (in the background, while you do the reading):
   `node $SKILL/scripts/thesis.mjs write <repository> --out <project folder> [--request "<what the owner asked for>"]`.
   A new conversation, which only sees the recipe and the repository, writes `thesis.md`: what the product sells in one sentence, who
   buys and what pain they have, the proof scene, what the video does not show and the intent (`sell`, `teach` or `update`).
2. **Check and show it:** `thesis.mjs validate <project folder>` prints the five lines, which go into the
   reconnaissance summary.
3. **The intent confirms or corrects the triage type** (step 0). `sell` is never a tutorial, even if the image is the
   real screen and the request says "explaining the product": it is a demo, launch, cut or teaser, with hook, proof and call to action.
   `teach` is a tutorial. `update` is an update. Did the type change? Say so in one line.
4. **What to show** (0.1, item 4) becomes the proof scene. The rest of the screens only come in if they reinforce the sentence.

In the script (step 2), each scene says who does the work in it, and `thesis.mjs count` decides whether the sales script passes or goes back.

### 1 · Briefing (one round, with everything that is missing)

**Ask what only the person knows** and the reading, the product's reference profile, the series or the approved video
do not answer, each question with your suggestion first. What they already answer is stated in one line, not asked.
Only what does not change the video becomes an assumption, in the short block at the start, with what would change if
it is wrong.

The questions specific to each type are in its card (`references/types.md`). In the tutorial, the minimum is:
- app and access, with no password in the chat;
- role;
- one task per video;
- series or standalone;
- versions;
- what never appears;
- plausible data rule;
- caption language;
- how to re-record.

Bring the questions **ready to be settled**:
- each one with the context of why you are asking;
- 2 to 4 concrete options, built from what you found, with the recommended one first and the effect of each choice in the description;
- room for a free answer (the "Other" of `AskUserQuestion`).

Ask only what only the user knows: goal, audience, where it will run, musical taste, the message that cannot be missing, what is confidential. Up to 4 questions per round, from these:

- **Where it will run:** becomes the format. Reels/TikTok/Shorts/Stories → 9:16; feed → 4:5 or 1:1; site/YouTube/pitch/event → 16:9. It is multiSelect.
- **Duration:** 15, 30, 40 or 60 s. Recommend by platform.
- **Music:** the series' or the one in the product's reference profile; with neither, the recommended direction from the research goes in as an assumption in the preview, with the other two in one line each, and the owner changes it while listening to the preview. Ask beforehand only if they already said they want to choose the music. The options are the 3 directions from the research. Each one states the genre (from the audience, reading §4), the role (**background** or **lead**, from the type), the BPM, the timbres and a short why, for example "Background xote, 92 BPM, restrained accordion and zabumba, no vocals: it is what plays at this audience's counter". The user can answer with a reference ("something like song X"); then you extract the style and compose something original that is similar, never a copy. They can also bring a finished track.
- **Energy and message:** the tone ("vibrant", "calm and confident", "fun", "cinematic") and what needs to stick in people's minds. Offer 2–3 sentences taken from the product itself.

The questions from section 7 of the reading (the slice of the audience, whether the brand has a sound, whether dark mode is the default) take priority over the generic ones: they change the video. If the reconnaissance already answered format and duration, use those slots for them and for these others:
- what can and cannot appear (a feature not launched yet, a real client, real data);
- access only they have (test account, demo mode, photos of the physical product);
- where to save. The default is the Desktop, in a `<product>-video` folder.

Never ask for a password in the chat. If you need a login, ask the user to log into the system and tell you when, or use the demo mode or the test account documented in the project.

### 2 · Ideas

Propose **3 truly different concepts**. `references/creative-direction.md` has the idea sources and the motion catalog. Each concept carries:

- a short name and the idea in one sentence;
- the hook of the first 2 s (never an empty screen);
- the signature move, preferably taken from the logo, the product or the gesture of the person who uses it (reading, sections 1 to 3);
- the arc in 4 to 6 beats;
- how the chosen music comes in (where it rises, where it breathes);
- why it fits the product.

Recommend one, show the two or three as stills in the person's brand (the review board, `recipes/board.md`) and go on with the one they pick. Then write the **script with the sync sheet**: a table of time, scene, **who does the work** (`proof`, `product`, `person` or `—`), what is seen, what is read and what sounds, on the BPM grid (bar = 240/BPM s). Run `node $SKILL/scripts/thesis.mjs count <script.md> --write`: in a sales video, the proof scene is at least 50% of the product time and a person working is at most 25%; if it does not pass, the script goes back before being shown (`recipes/thesis.md`). Show it and keep producing, saying that any line can still change until the draft.

### 3 · Production (two fronts in parallel)

1. **Project:** `node $SKILL/scripts/new-project.mjs <folder> --title "…" --duration 30 --bpm 100 --formats 9x16,16x9`. Then:
   - fonts: `node $SKILL/scripts/fonts.mjs <folder> "Family" …`;
   - logo: `node $SKILL/scripts/logo.mjs logo.svg [--split] --js LOGO`, which goes into `brand.js`;
   - photos and recordings go in `<folder>/media/` (a recording becomes a frame sequence with ffmpeg; see `references/engine.md`).
2. **Soundtrack, in a subagent:** write `audio/sheet.json` (duration, BPM, silences, markers) and launch a subagent in the background with the prompt from `references/soundtrack.md` §4. It composes a new `arranjo.py` on top of `audio/synth.py` and verifies with `audio/verify.py`. Retimed a scene? Tell the subagent. Without the subagent tool, compose after the scenes, following the same prompt.
3. **Image, with you:** write `scenes.js` following `references/engine.md`. If there is more than one format, write each scene with a per-format layout (`L({...})`) from the start. The safe areas of each platform are in `references/formats.md`.
   Ready-made transitions (whip, zoom-through, mask, flip, morph) are in `references/transitions.md`, and each one says the sound that goes with it. The sound effects come from `audio/sounds.py` and go into the sheet as markers (`references/soundtrack.md` §8). The user's photos and recordings get camera motion with `camera()` (`references/engine.md`).
4. **Your own review, before showing anything:**
   - run `node <folder>/tools/frames.cjs --project <folder> --check` (collision and safe area across the whole timeline, code 4 = problem), `--auto` (contact sheet of scenes and cuts) and a `--strip de:até:12` strip (from:to) on each transition, in each format;
   - open the images and go through the review list in `references/creative-direction.md` §7;
   - do the **swap test** while looking at the sheet: with the logo and name of a product from another world, would this video still work? If what separates it from another one is only the colors and the logo, the identity is still the engine's; go back to section 5 of the reading;
   - read any error the script prints;
   - run the refinement check (`node $SKILL/scripts/refine.mjs <folder> [--product "Name"]`, `references/refine.md`) and open the frames flagged in `refine/frames/`;
   - repeat until you find no defects and the refinement check passes.

### 4 · Preview: the draft (the first deliverable)

- The preview is the draft in the main format, with sound and with the sheet checked. The second format and the 60 fps final
  wait for the owner's yes. Once the preview is done, `progress.mjs done <folder> draft --note "preview ready"`: the line says
  100% and the preview goes to the owner. The refinement check comes in alongside (`progress.mjs now <folder> refine`), in the background.

- **The GPU before rendering:** `node $SKILL/scripts/playwright.cjs --gpu` prints the `UNMASKED_RENDERER_WEBGL` of the video's Chromium and exits with code 1 if it is SwiftShader (3D on the CPU, ~13× slower). On a Mac it has to be the GPU, something like `ANGLE (Apple, ANGLE Metal Renderer: Apple M5)`: every Chromium of the video comes from `scripts/playwright.cjs`, which on a Mac opens with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`. `render.cjs` prints the renderer at the start of each render and, on a Mac, stops with the warning `3D ON CPU` if it falls back to SwiftShader. Only with `VIDEOSTUDIO_NO_GPU=1` does it go on with the CPU, and then say so in the report.
- Generate it with `node <folder>/tools/render.cjs --project <folder> --mode draft --audio audio/soundtrack.wav`. It takes a few minutes, already comes with sound and generates the automatic contact sheet on its own.
- **The refinement check runs alongside the preview:** look at the sheet, show the draft and, in the background, `node $SKILL/scripts/refine.mjs <folder> --video out/draft-<format>.mp4` in each format. What it points out goes in the preview message ("the refinement found X; I'll fix it in the final"); code 1 blocks the **final**, not the preview. A defect that belongs to the engine (not to the video) is fixed in the skill folder and holds nothing back.
- Tutorial: `node $SKILL/scripts/tutorial/compose.mjs <video-folder>` (draft) and `--mode final`. It generates the series soundtrack, mixes, verifies and makes the event sheet.
- Open it for the user: `open` on macOS, `start ""` on Windows, `xdg-open` on Linux. Also show the live preview `index.html?play` and the contact sheet.
- Ask with options: "Approve and make the final", "Adjust pace/reading time", "Change texts", "Change the music (more in the background / more present / another style)", or free text.
- Adjust. If the change is big, make another draft.

### 4.1 · Series: the board before the second video

In a series, the identity repeats in every piece: if it is wrong, it is wrong in all of them. Finding that out at the tenth video costs all ten. So, with the first video's draft ready and **before recording the second**:

0. To get the look right without waiting for the render, compose only the event sheet: `node $SKILL/scripts/tutorial/compose.mjs <video-folder> --no-render`. It takes seconds and already runs the collision and safe-area check.
1. Build the **board**: three frames from the draft side by side, in a single image in the series folder. The frames are the opening with the title readable, a screen with caption and highlight, and the closing with the logo at rest. In a campaign, they are the opening, the typical scene and the sign-off. The command is in `references/types.md` §11.
2. Look at the board yourself and do the swap test on it.
3. Show the user the board, section 5 of the reading (one line per element: what it is and why) and the draft with sound. Ask: "Approve the identity", "Adjust the look", "Adjust the music", or free text.
4. Only after approval, record the second video. Did the identity change? Redo the first one and the board.

Without a way to ask, deliver the first video and the board and stop: making the rest of the series before someone sees the identity is betting the whole series on a guess.

### 5 · Final and delivery

- Run `render.cjs --mode final --format <f>` for each format (~7 min per 40 s, in the background, with the GPU renderer at the start of the log, step 4), then `finalize.mjs --video … --audio … --out …`. It mixes, generates the poster and checks duration, loudness, true peak and whether the sheet's silences survived AAC. If the script exits with code 1, you do not deliver.
- **Refinement check on the final MP4** of each format: `node $SKILL/scripts/refine.mjs <delivery mp4> --project <folder> --out <folder>/refino-final`. Code 1 = do not deliver. In the report, say that it passed and how many warnings remained (and why).
- Approved by the owner? Save the product's reference profile: `node $SKILL/scripts/refine.mjs profile "<Product>" --from <folder> --video <mp4> --approved` (the approved kit becomes the benchmark for the next video).
- The delivery folder carries the MP4s per format, the posters, a `README.md` with the script and how to redo it, and `fonte/` (the project without `out/`, `previas/` and `.venv`). Details in `references/delivery.md`.
- In the report, say:
  - where each file is;
  - what was verified, with the numbers;
  - what you cannot verify (you do not watch or listen, so ask for a play);
  - assumptions made, including what the reading marked as a guess;
  - 1 or 2 extras worth doing.

## Quality rubric

What separates a motion video from an animated slide. The detail is in `references/creative-direction.md`:

- **Everything on the grid:** cut, fit and word land on a beat of the music. One idea per scene of 3–5 s.
- **Reading time:** a short sentence held still and readable for ≥ ~0.7 s. A sentence that disappears before it is read is the most common mistake.
- **No empty screen:** frame 0 already has motion, and an iris never opens onto nothing.
- **Anticipation before impact:** a 0.125–0.25 s breath before the drop and before the final logo.
- **Transition with a reason:** the transition comes from something already on screen. A generic fade is the last resort.
- **Living camera:** slow push-in, short shake on impacts and motion blur in the final. The final logo hold stays still ≥ 1.5 s.
- **Brand respected:** exact logo at the end, official colors and fonts, the brand manual's rules. And the language, not just the paint: the surface, the shape, the title box and the role of each color (where it comes in and where it is forbidden) come from the reading. Never invent numbers, testimonials or clients. People on screen get fictional names.
- **Music that serves the video and the audience:** the genre is the audience's; the role is the type's. A background soundtrack stays behind and breathes with the text; a lead soundtrack marks the cuts. In both, the sheet's markers sound at the exact sample.

## Skill files

| File | When to use |
|---|---|
| `scripts/environment.mjs` | at the start, always |
| `scripts/reading.mjs` | in the reconnaissance, always: gathers the facts from the repository for the reading |
| `references/reading.md` | **before the briefing**: the seven sections of the reading, what counts as evidence, examples |
| `scripts/thesis.mjs` + `recipes/thesis.md` | **before the script** (0.2): the video's thesis, the intent that decides the format and the screen-time count |
| `scripts/new-project.mjs` | create the video folder (template + soundtrack + tools) |
| `scripts/fonts.mjs` | brand fonts (local node_modules or Google Fonts) |
| `scripts/logo.mjs` | SVG logo split into animatable parts |
| `tools/frames.cjs` (in the project) | single frames, contact sheet (`--auto`), transition strips, collision check (`--check`) |
| `tools/render.cjs` (in the project) | draft (fast) and final (60 fps + motion blur) |
| `tools/finalize.mjs` (in the project) | mix, generate the poster and verify the delivery |
| `scripts/refine.mjs` | **before showing any draft or final**: the automatic refinement check (`references/refine.md`); `gabarito` saves the product's kit and approved videos |
| `references/types.md` | **step 0**: the 10 video types, with briefing, music, sounds, QA and series for each one |
| `references/tutorial.md` | tutorial mode with the real screen: define, record, check, compose, identity, copy the engine into a repository |
| `references/transitions.md` | catalog of the engine's transitions, with the duration and sound of each one |
| `scripts/tutorial/record.mjs` | records the real journey (or `--check`), with the "is something in front?" check and the event log |
| `scripts/tutorial/compose.mjs` | composes the tutorial (camera, pointer, captions, soundtrack, verification, sheet) |
| `scripts/tutorial/copy.mjs` | copies the tutorial engine into a repository |
| `assets/audio/sounds.py` | sound effects (whoosh, flip, tap, click, success, typing, riser, impact) |
| `assets/audio/series.py` + `arrange_series.py` | series soundtrack: fixed identity and variation by seed |
| `references/creative-direction.md` | concepts, motion catalog, pace, review list |
| `references/soundtrack.md` | music research, styles and how to synthesize each one, sheet.json, composer prompt |
| `references/engine.md` | engine API (`engine.js`), photos and recordings, recipes, pitfalls |
| `references/brand.md` | find the product, the audience and the visual language from a repo, a site, files or just a description |
| `references/formats.md` | sizes, safe areas, per-format layout |
| `references/delivery.md` | render, verification, delivery folder, extras |
| `assets/audio/API.md` | synthesis library (for the soundtrack subagent) |
