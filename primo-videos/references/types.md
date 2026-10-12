# Video types

The type decides where the image comes from, what to ask, the duration, the **role** of the music, the density of sounds and the QA. That is why triage is step 0 of the flow (`SKILL.md`).

The type does **not** decide the look of the video or the music genre. Those come from the project reading (`references/reading.md`): the look, from section 3; the genre, from the audience (section 4). A card that said "tutorial: acoustic music" or "launch: electronic" would give the same music to an app for a car repair shop and to one for new mothers. That is why, in the cards below, "Music" states only the role:

- **background (`fundo`):** low level (around −18 LUFS in the series), low density, the mids left free for reading, no drop that steals attention. It still has a genre: background is not neutral;
- **lead (`protagonista`):** full level, contrast between sections, build and impact marking the cuts;
- **in between:** present on the cuts, pulled back under the text.

## Contents
0. Triage: how to decide and how to ask
1. Tutorial / step by step
2. Product demo
3. Launch / announcement
4. Showreel / institutional
5. Cases / portfolio
6. Explainer
7. Social cut / teaser
8. Sting / animated logo
9. Update / "what changed"
10. Other
11. Series: fixed identity, generated variation

---

## 0. Triage

1. **Do the conversation or the arguments already state the type?** For example, "make a tutorial on how to book", "a 15 s teaser for the launch", "animate the logo". Then confirm in one line and move on to that type's briefing: "Got it: a step-by-step tutorial for booking, with the app's real screen."
2. **Can it be inferred safely?** For example, the conversation just delivered a feature and the request is "a video showing this". Propose the most likely type as the recommended option, together with the 2 or 3 closest others.
3. **It can't?** Ask with `AskUserQuestion`, a single question, with 4 options picked from the 10 types by what the conversation suggests. "Other" covers the rest.
   - Each option's description carries the effect ("the app's real screen, one task, a caption per step, background music").
4. In the same triage round, only questions that do **not** depend on the type go in, such as where it will play. The others wait for the type's briefing.

A request can be two types ("a launch with a cut for stories"). In that case the main one rules and the other becomes an extra in the delivery.

**The thesis intent confirms the type** (`recipes/thesis.md`; step 0.2 of the flow). `sell` is demo, launch, cut or teaser, never tutorial: showing the real screen to someone who has not bought yet is not teaching. `teach` is tutorial or explainer. `update` is update.

**Where it plays decides between 3 and 7.** A short piece (≤ 15 s) made **for** Stories, Reels, TikTok or Shorts is a **social cut**, even if the content is an announcement: the network's native format (hook in the 1st second, sound off, safe area, vertical) weighs more than the subject. A **launch** is the main piece, 30 s or longer, which can *generate* cuts.

| # | Type | Image | Music role | Sounds | Text |
|---|---|---|---|---|---|
| 1 | tutorial | **real screen** | background | tap, click, typing, flip, success | caption per step |
| 2 | product demo | real screen with camera, or recreated UI | background or in between | tap, whoosh | short titles |
| 3 | launch / announcement | recreated UI, motion, typography | lead | all, with riser and impact | short informative lines (no catchphrase) |
| 4 | showreel / institutional | motion, photos, screens | lead | whoosh, impact | little text |
| 5 | cases / portfolio | screenshots and photos with camera | in between | whoosh, flip | number and result |
| 6 | explainer | motion, icons, diagrams | background | pop, flip | teaching sentences |
| 7 | social cut / teaser | reuses pieces, or motion | lead | impacts | big captions |
| 8 | sting / animated logo | logo | audio sign-off | riser, impact | only the brand |
| 9 | update / "what changed" | before → now, real screen | background | flip, success | what changed and where to see it |
| 10 | other | decided in the conversation | — | — | — |

The sounds come from `assets/audio/sounds.py` and the transitions are in `references/transitions.md`. Sound density: **low** is only on the main events, well below the music; **medium** is on every cut and tap; **high** is on every cut, keyword and impact.

---

## 1. Tutorial / step by step

- **Goal:** someone finishes the video knowing how to do **one** task in the product, on their own.
- **Image:** **real screen**, always. Nothing recreated: the person will look for exactly that screen. The video is recorded by the capture engine (`scripts/tutorial/`) and the contract is in `references/tutorial.md`.
- **Briefing questions of its own** (up to 4 per round, only what the reconnaissance did not answer):
  - which app or URL, and **how to log in without a password in the chat** (demo mode, documented test account, or the user logs in and says so);
  - which person or role (who does the task, what they see, what they are allowed to do);
  - **one task per video** (if the request has three, that is three videos in the same series);
  - series or one-off;
  - versions: phone, computer or both;
  - what can **never** appear: real data, secrets, unreleased features, AI turned off;
  - plausible data rule: business days, hours, holidays (school ≠ store ≠ clinic);
  - caption language, where it will play (inside the app, website, YouTube, Reels);
  - how to re-record when the screen changes (who runs the `--check` and when).
- **Mandatory warning in the briefing:** if the `--check` lists native controls (select, date, time, file), say that the native list and calendar do not show up in the capture. The choice is shown in the field itself, going through the options, with a highlight and a badge showing the choice. If the product has its own list component, prefer it in the script.
- **Duration:** the real time of the task, without stretching or cutting a step, between 20 and 90 s. Longer than that becomes two videos.
- **Formats:** phone → 9:16; computer → 16:9. Both versions come from the same script.
- **Music:** background role. The viewer is reading and copying the step, so the music stays behind the caption: −18 LUFS, low density, no drop. The genre comes from the reading (section 4): for a rock audience, a clean guitar with restrained drums; for a shop-counter audience, a xote with the zabumba kept low. Series: `series.py`, with the identity declared (§11).
- **Sounds:** medium density, and discreet. Tap or click on every tap, typing while typing, flip on the caption change, whoosh on the screen change, success at the end and a light impact on the closing.
- **Caption:** a caption per step, a short sentence in the imperative ("Tap Save."), held **at least 3 s**. The recorder guarantees this.
- **Pace:** that of the real task.
  - The camera follows the action: zoom on the target (limited by the capture resolution), back to the full frame when the screen scrolls or changes.
  - An opening of ~2.4 s with the title and a closing of ~2.8 s with the brand.
- **Specific QA** (no exceptions):
  - the `--check` passes;
  - **no tap without a check**;
  - the recording's tap sheet and the composed video's event sheet were **looked at**;
  - no date on a weekend or holiday;
  - password, link with a token and real e-mail blurred;
  - the tap lands on the target, not on whatever is in front of it.
- **Series:** fixed identity, declared from the reading (§11): the look in `series.json` with `"versao": 2`, element by element, and the music in `identity.json` with `"versao": 2`. The tutorial template is the easiest trap: the engine already knows how to draw a whole tutorial by itself, and that drawing was born from another product (`creative-direction.md` §8). The identity is shown on a board and approved before the second video. Each video has its own soundtrack, generated from the video's seed. The briefing is not repeated: the following videos only ask for the task and the role.

## 2. Product demo

- **Goal:** show the product working and make people want to use it. It does not teach step by step.
- **Image:** the style chosen in `SKILL.md` ("The style"): typing text when the product has a text box, before and after, rolling list, or chapters with index (`references/chapters.md`) for several "wow" moments. The real screen only as proof, full screen. A real screen shrunk inside a mockup frame is rejected.
- **Questions of its own:** which "wow" flow (the moment that sells), for whom, what cannot appear, where it will play.
- **Duration and formats:** 30–60 s; 16:9 for website and pitch, 9:16 for social.
- **Music:** background or in-between role, marking the cuts. Genre: from the reading.
- **Sounds:** medium (tap, whoosh on the changes).
- **Text:** short titles per segment, no "step n of N".
- **Pace:** segments of 3–6 s, cut on the music's beat, zoom on the details.
- **QA:** the same tap rules as the tutorial, if it is a real screen; each segment shows a single thing.
- **Series:** "a demo of each module" works as a series of tutorials without step captions.

## 3. Launch / announcement

- **Goal:** announce something new and make the brand memorable.
- **Image:** motion, typography and UI recreated with the product's tokens (this is the skill's current case). Real screens only as quick proof.
- **Questions of its own:** the news in one sentence, the date, the call to action, the tone and the music (3 directions).
- **Duration and formats:** 15, 30 or 40 s; 16:9 and 9:16.
- **Music:** lead role, with build, drop and silence before the impact. Genre: from the reading; the build and the drop are written in that genre's language.
- **Sounds:** high (riser before the drop, impact on the logo, whoosh on the transitions).
- **Text:** short informative lines, one idea per scene; never a catchphrase.
- **Pace and QA:** those of `creative-direction.md` §4 and §7, plus the collision and safe-area check of `frames.cjs`.
- **Series:** a campaign with several ads, with a fixed identity and the soundtrack varied by the seed.

## 4. Showreel / institutional

- **Goal:** show who the brand or the studio is, and what it has already done.
- **Image:** motion, photos and screens with camera (guided Ken Burns, `camera()`), light 3D (`references/engine.md`).
- **Questions of its own:** what goes in (projects, true numbers), the feeling, where it plays (website, event, big screen).
- **Duration and formats:** 40–90 s; 16:9, sometimes 9:16.
- **Music:** lead role. Genre: from the reading.
- **Sounds:** medium to high, with whoosh and impact on the main cuts.
- **Text:** little (names, numbers).
- **QA:** every number has a source; final hold of the logo ≥ 1.5 s.
- **Series:** rare. When there is one (annual reel), it follows the previous one's identity with a new soundtrack.

## 5. Cases / portfolio

- **Goal:** prove results with a real client.
- **Image:** the client's screenshots and photos with camera, light 3D, a big number.
- **Questions of its own:** which cases, which numbers (verified), what can be shown of the client (authorization).
- **Duration and formats:** 20–30 s per case; 16:9.
- **Music:** in-between role. Genre: from the reading (in a studio portfolio, the audience is the studio's client).
- **Sounds:** medium.
- **Text:** pain → solution → number → the client's brand.
- **QA:** verifiable number; the client's logo exact.
- **Series:** almost always a series. The structure and the identity are fixed; what changes per case is color, font, texts, media and **the soundtrack, generated from each case's seed**. A single soundtrack for all the cases is the mistake from the previous round.

## 6. Explainer

- **Goal:** explain a concept or how something works inside.
- **Image:** motion, icons, diagrams that build themselves, a visual metaphor.
- **Questions of its own:** which idea, for whom (knowledge level), the one thing that has to stick.
- **Duration and formats:** 45–120 s; 16:9.
- **Music:** background role, with time for the sentence to be read. Genre: from the reading.
- **Sounds:** low to medium (pop when something appears, flip on the change of idea).
- **Text:** teaching sentences, one per scene, with generous reading time.
- **QA:** reading (minimum time), logical sequence, no unexplained jargon.
- **Series:** "explaining each part of the product", with a fixed identity and a soundtrack per seed.

## 7. Social cut / teaser

- **Goal:** stop the thumb in the feed and lead to the product or to the main video. It applies to a news announcement, a teaser, an event call: any short piece native to a network.
- **Image:** short motion made from scratch, **or** scenes cut from a piece that already exists (if there is one). UI recreated with fictitious data when the product appears.
- **Questions of its own:** which network (if it did not come), whether there is a main piece to cut, the hook of the 1st second, the message, the audience (people who don't know it yet or people who already use it), the call to action.
- **Duration and formats:** 6–15 s; 9:16 (Reels, TikTok, Shorts, Stories) and 4:5 or 1:1 (feed).
- **Music:** lead role, with the hook in the first second. Genre: from the reading, and from what plays on that network for that audience.
- **Sounds:** high.
- **Text:** big captions, because most people watch with the sound off. Everything inside the platform's safe area (`VIDEO.plataforma`).
- **QA:** frame 0 with movement, safe area with no violation in `frames.cjs --check`.
- **Series:** cuts from a campaign, with a soundtrack derived from the main piece through the seed.

## 8. Sting / animated logo

- **Goal:** a 2 to 6 s brand sign-off (a video opening, the end of a presentation).
- **Image:** the logo in parts (`logo.mjs --split`), the signature move.
- **Questions of its own:** where it will be used, light or dark background, with or without sound, the logo version.
- **Duration and formats:** 2–6 s; every format requested.
- **Music:** the role of a short audio sign-off (sonic logo). The timbre comes from the reading's genre.
- **Sounds:** riser and impact on the final lock-in.
- **Text:** only the brand.
- **QA:** final logo exact and still ≥ 1.5 s; no distortion.
- **Series:** does not apply.

## 9. Update / "what changed"

- **Goal:** show people who already use it what changed and where to find it.
- **Image:** the style chosen in `SKILL.md` ("The style"); rolling list or before and after for a few new things, chapters with index (`references/chapters.md`) for 6 to 12 on the website, never twice in a row for the same product. In chapters: an opening with the numbered index, one chapter per new thing with the redrawn interface doing before → now, a closing with the full index and the big numbers. A single new thing, in a short video inside the app, can be the real screen (the tutorial engine) in full screen.
- **Questions of its own:** what changed (only what is in production), for whom, the date, the authorized sample account whose data appears.
- **Duration and formats:** one new thing, 15–45 s; patch notes with several, 1:30–3 min. 16:9 and 9:16 recomposed (`references/chapters.md` §8).
- **Music:** background role in a short update; lead in the chapters video, where it carries the pace without voice (`references/chapters.md` §9). With voice (opt-in, `references/voice-script.md`), background in every case: the voice leads and the music makes room for it (`references/voice-mix.md`). Genre: from the reading; in a series of updates, the same identity as the tutorials.
- **Sounds:** low to medium (flip on the before → now, success at the end); in the chapters video, one whoosh per passage.
- **Text:** a `01 · AREA` label, a 2–3 word poster-card title with the keyword in color, 1–2 supporting lines, each held long enough to be read. With voice, the text is not the line: the title is the poster, the voice says the whole sentence.
- **QA:** the contact sheet of each format; the redrawn "before" shows what really existed, never a defect invented to make the "now" shine.
- **Series:** release notes in video, one per release, with a soundtrack per seed.

## 10. Other

Ask for the goal in one sentence and find out which of the types above is closest. Use its card as a starting point and say what changes.

---

## 11. Series: fixed identity, generated variation

In a series (tutorials for an app, cases for a studio, ads for a campaign), the identity is decided **once** and repeats in every piece. If it is wrong, it is wrong in all of them. That is why it comes out of the reading, is declared in writing and is seen before it multiplies.

**1. The reading, first.** The `reading.md` lives in the series folder (`references/reading.md`). Its section 5 is the identity in prose: each element with the why.

**2. The look, declared (contract B).** In `series.json`, with `"versao": 2` and `"leitura": "reading.md"`, the `visual` block declares each element: `cores`, `fundo`, `moldura`, `legenda`, `selo`, `titulo`, `abertura`, `fechamento`, `realce`, `indicador`. The options for each are in `references/tutorial.md`. No element is left out: a default nobody chose becomes everybody's identity, and two products with nothing in common come out with the same video. A series without `"versao"` composes with the engine's old drawing, which is nobody's identity; use it only to redo an old series.

**3. The music, declared (contract C).** In `identity.json`, with `"versao": 2`: the `papel` (`fundo` or `protagonista`, from the type of video: level, density and room for reading), the list of `groove` the series accepts and the timbres, the kick, the bass and how much the pad ducks under the kick, with the field names from `references/soundtrack.md` §9. The grooves and timbres come from the reading's genre (section 4). The seed only chooses among what was declared.

**4. The board, before the second video.** With the draft of the first video ready, take three frames and put them side by side:

```sh
# opening with the readable title, a screen with caption and highlight, closing with the logo still
ffmpeg -y -ss 1.9 -i draft.mp4 -frames:v 1 p1.png
ffmpeg -y -ss <a step from the middle + 1 s> -i draft.mp4 -frames:v 1 p2.png
ffmpeg -y -sseof -0.5 -i draft.mp4 -frames:v 1 p3.png
ffmpeg -y -i p1.png -i p2.png -i p3.png -filter_complex "[0][1][2]hstack=inputs=3,scale=2400:-2" prancha.png
```

The moment of the step comes from `events.json` (the start of a caption from the middle). In a 9:16 version the board comes out tall and narrow; that's fine. Save `prancha.png` in the series folder, look at it yourself (the swap test applies here too) and show it to the user together with section 5 of the reading and the draft with sound (`SKILL.md`, step 4.1). Only record the second video after approval.

**5. Each piece gets:**

- the content;
- its **own soundtrack**, generated by `series.py` with the piece's seed (key, BPM, progression, motif and groove change, within what was declared);
- the sounds on its events.

The following videos **do not repeat the briefing**: ask only what changes (the task, the case). Prove the variation with `series.py --compare` before delivering the series.
