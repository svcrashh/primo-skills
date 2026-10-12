# The independent critic

Whoever makes the video checks their own work and lets things slip. A video can pass the refinement check and the
direction check and still come back from the owner with the screen cut in half, leftover cream background and no 3D,
motion or transition. What is missing is someone who looks at the finished video **from the outside, without knowing
how it was made**.

`scripts/critic.mjs` is that someone: a fresh Claude conversation that receives only the package (contact sheets of
frames, the caption, the refinement and direction numbers, the owner's request, the video's thesis) and the rubric
below. It never receives the script, the maker's history, or what the author thinks they fixed.

```sh
node $SKILL/scripts/critic.mjs <video.mp4> --request "<what the owner asked for, in their words>" [--thesis <thesis.md>] [--guide <file>] [--channel <channel>] [--captions <.srt>]
```

The refinement check it runs underneath takes the briefing's `--channel` (or `--player <px>`): lettering that disappears
on a phone goes into the package as a defect, measured at the size the video plays at (`references/refine.md`,
"Reading in the player").

**With voice, the transcript goes into the package.** The narration also writes what the voice says as a `.srt`.
`critic.mjs` takes the one next to the video (`<video>.srt`) on its own; when it has another name or sits elsewhere in
the project (`legenda.srt`, `<id>-<device>.srt`), pass it with `--captions`. The package then carries the transcript,
the share of the video with voice and the longest stretch without it, and the critic reads the rubric with the voice
(R1, R4 to R7, R16). A narrated video sent without its `.srt` is judged as if it had no voice: pass it. Without voice
there is no `.srt`, and the package's "no .srt caption" warning is expected: the caption is the on-screen text, read in
the frames. The logo opening (`scripts/opening.mjs`) shifts the `.srt` next to the video along with it.

**The thesis goes into the package** (`recipes/thesis.md`): what the product sells, the scene that proves it, what stays
out and the intent. It was written before the script, from the repository, so it is not the opinion of whoever made the
video: it is the criterion for items R14 to R16. `critic.mjs` finds the `thesis.md` in the video's folder (or up to 3
folders above) on its own; `--thesis` points to another one. Without a thesis it warns and judges only the finish (R1 to
R13): a good-looking video that proves the wrong thing passes.

It returns **approve or reject** and up to **3 defects**, each with the second, the rubric item, the severity and what
to do. It is also written to `<video>.critic/critique.json` and `critique.md`.

## Usage rule

1. **It runs at the end of every video, before it goes to the owner.** On each format (9:16 and 16:9 are two videos).
2. **Rejected:** whoever made it fixes each severe defect and runs it again on the new video, or writes, in the delivery,
   why they are not fixing it (the owner reads the explanation next to the defect). A rejected video is never delivered
   in silence.
3. **Approved with a minor caveat:** deliver it, stating the caveats.
4. **Do not argue with the critic by changing the request.** `--request` is what the owner said, copied, not what the
   author thought they wanted.
5. **Never adjust the rubric so the video passes.** If the rubric rejected something the owner would approve (or
   approved something they would reject), the mistake is the rubric's: fix the item here and note in "Rubric
   adjustments" what changed and why, as a general rule (no product name, person name or date).
6. The critic is the second opinion, not the owner. Passing it is not "approved": it is "will not be rejected for the
   mistakes we already know".

Do not run it on a script draft: it looks at finished video. Cost and how the conversation is called: "How the fresh
conversation is called", at the end.

## The rubric

<!-- regua:ini -->
Each item is a question answered by looking at the contact sheets, the frames and the caption. The rubric comes from
videos the owner has already rejected and approved (rejected app tutorials; approved short social videos, a 3D demo and
reference reels), plus what is measured in product launch videos: an opening that is already a finished composition, no
empty frame, no text over text, each change born from the previous one.

The package's transcript says which video this is. **No transcript:** the video has no voice, and the caption is the
on-screen text. **A transcript:** the video has voice; the transcript is what the voice says and when, and the items
that change with it say how to read them "with voice".

**Image**

- **R1 · Does the screen come in whole?** When a **new** screen comes in, the device appears whole (bezel, bottom bar)
  for about 0.75 s and only then the camera moves in on the current field. That zoom after the wide shot is the "wide
  then detail" the owner approved: the app filling the width and fading out at the bottom during the detail is **not** a
  defect. Severe: the new screen already comes in zoomed, only the top half, without ever having appeared whole before
  the zoom; or a frame in which the device is cut in a way that gets in the way of reading what the caption points to
  (with voice, what the voice is saying).
- **R2 · Is there leftover empty background?** In some frame more than a quarter of the image is plain background with
  no function: cream, an empty column next to the caption, a small device in the middle of nowhere, a flat color band.
  Severe when it lasts more than 1 s in a row; minor when it is a glimpse, during a transition. An exception the owner has
  not decided yet: in 9:16, the bottom quarter of the frame during the detail is the **blurred background of the screen
  itself** (it sits below the Reels safe area) and counts as **minor**, stated as "owner's decision"; it only becomes
  severe if it takes up more than a third of the frame or if it is plain cream.
- **R3 · Is there real cinema?** Does 3D appear (the phone spinning, the logo assembling), a camera moving from one
  target to another and a transition between screens, or is it just a screen recording with zoom? Severe when none of the
  three appears in the whole video.
- **R4 · Is anything cut off or on top of something else?** Text cut by the edge, one text over another, a caption on
  top of what it tells you to read, a finger or highlight off target, a strange color band at the edge. **Severe** when,
  at the moment the caption points to something, the caption or its target does not fit whole in the frame (cut by the
  edge, hidden behind another card); minor when it is a ghost from a transition, a glimpse. With voice, the target is
  what the voice tells you to read: a caption on top of it is a defect, and it is **severe** when, at the moment the
  voice says the line, the caption or the line's target does not fit whole in the frame.
- **R5 · Can it be read on a phone?** Is what the on-screen text points to (a button, a number, a status) big enough at
  the moment it appears? The whole screen small, in passing, does not count. With voice: what the voice tells you to
  read, at the moment it is said.

**Text and image** (without voice, the caption is the on-screen text; with voice, the transcript is what the voice
says, and when)

- **R6 · Does what the text says match what is seen?** When the caption says "Sales", the screen shows Sales. An
  explanatory caption over a frozen screen, a silent tap, a button with a different name from the one on screen. Also
  severe: text or a screen in a language other than the video's, at any size (proper names and commands do not count).
  With voice, the same question for what the voice says, at the transcript's time: when the voice says "Sales", the
  screen shows Sales; a line of explanation over a frozen screen is a defect. A video the request says is narrated, with
  no transcript in the package: judge only by what is written in the frames and say the transcript was missing.
- **R7 · Is there time to read it?** A caption, title or support line that disappears before it is read: a short
  sentence held for less than ~0.7 s, or a long line that changes before ~1 s per 12 characters. Severe when it happens
  to the text that carries the message. With voice, the question is whether the voice stops: more than 2.5 s without
  voice in the middle of the video, or a voice that ends long before the end (the transcript's numbers give the longest
  stretch without voice and how long the end goes without it).

**Pace**

- **R8 · Do the first two seconds hook?** Frame 0 already has movement and, within 2–3 s, it is clear what the video
  delivers (a title, a result screen, a question). Severe: a static title card, an empty screen, only the brand coming
  in in silence.
- **R9 · Does something really change every 3–4 s?** On the 1-frame-per-second sheet, more than 4 frames in a row that
  look the same is "static". Severe from 6 identical frames in a row.
- **R10 · Is each change born from the previous one?** One screen that turns into the next (spin, pull-back, slide, the
  same element carrying on) is flow; a hard cut between compositions with nothing in common is a jump. The measured hard
  cuts come in the package: check in the frames whether they are real. Minor when there are isolated jumps; severe when
  the video is a sequence of jumps.

**Closing and truth**

- **R11 · Does it open and close with the right brand?** By default the video **opens with the brand's logo** (the
  first frame, ~1 to 1.5 s) and ends **with the logo** (in the version for the background, whole and undistorted),
  legible and held for 1.5 to 2.5 s, with nothing beside it. The request says when this brand does it differently (the
  opening logo turned off; the brand's own slogan or call to action at the closing): then that is the right one.
  Severe: no closing; an opening without the logo when the request does not turn it off; wrong brand; a recolored or
  distorted logo; a slogan, tagline or call to action that the request does not give as the brand's own, in **any**
  scene.
- **R12 · Does it end on the proof?** The last step shows the screen that proves the task is done (the status, the
  value, the title of the finished screen), not a reminder or a transitional screen.
- **R13 · Does it only show and say the truth?** Nothing the screen does not do, no real person's name, no visible
  "test" or "simulated", no value, percentage or deadline when the request forbids it.

**Thesis** (only when the package has "The video's thesis"; without it, skip these three and say in the
summary that the thesis was missing)

- **R14 · Does the video prove the sentence?** The thesis says what the product sells and what the proof scene is. Look
  for that scene in the frames: is it in the video, whole (the situation arrives, the product works, the result
  appears), and can it be read? Severe: the proof scene does not appear; it appears in passing (less than 3 s, or less
  than half the time the product is on screen); the video spends its time on what the thesis put under "o que o vídeo
  não mostra" (what the video does not show), or on a tour of the screens.
- **R15 · Who does the work on screen, the product or a person?** Count on the 1-frame-per-second sheets, only in the
  frames where the product is on screen: in how many the product does the work on its own, and in how many it is someone
  operating (the cursor or finger of whoever uses the product, text being typed by that person, an open menu, something
  being transferred, answered or checked by hand; also the scene in which the work is handed to someone). Whoever is
  served by the product does not count as a person working. Put the count in "o_que" ("person in 12 of 17 frames").
  Severe, with intent "vender": a person in more than a quarter of those frames. With intent "ensinar" the person works
  on purpose: not a defect.
- **R16 · Is the format the one for the intent?** "vender" is hook, the proof and call to action: "Step N of M", a card
  that narrates or orders a step, usage text in the imperative (with voice, also a spoken line in the imperative) and a
  tour of the screens are tutorial format, and are severe. "ensinar" is a tutorial: missing the step by step or the
  screen of the finished task is severe. "novidade" is the before and the after: missing one of the two is severe.

In a thesis defect, the "second" is the one of the first frame in which it shows (the first step card, the first person
scene); if the defect is the proof scene missing, it is the second at which the product comes on screen.

**How to decide**

- **Reject** if there is at least one **severe** defect. **Approve** if there is none, even with **minor** caveats.
- Do not invent a defect to look rigorous, and do not let a severe one through to look kind. A video that passed the
  numbers and still does not look expensive next to the approved ones is a reason to reject (R3, R8, R9, R10).
- **A thesis defect (R14 to R16) comes before a finish defect.** A well-finished video that proves the wrong thing goes
  back whole; fixing its caption does not help.
- Rank by what weighs most to the eye of someone watching on a phone, and point out at most **3** defects. Each one has
  the exact second (the one of the frame where it appears, or the start of the stretch), the rubric item, the severity,
  what is seen and what to do, as one action that can be carried out.
<!-- regua:fim -->

## Where each item came from

| Item | Origin |
|---|---|
| R1, R2, R3 | the defects that send an app tutorial back: the screen that comes in cut in half, instead of appearing whole first and then getting the zoom (the "wide then detail" of `references/tutorial.md`); leftover cream background; no 3D, motion or transition |
| R5, R6, R9 | the tutorial rule: one sentence, one new screen; more than 4 identical frames in a row is "static" |
| R7 | the workflow's quality bar (`references/workflow.md`): a short sentence held and legible for ≥ ~0.7 s; a sentence that disappears before it is read is the most common mistake |
| R6 and R7 with voice | the same tutorial rule, narrated: one line, one new screen; the voice does not stop |
| R8, R11, R12 | what usually gets approved: a hook in the first 2–3 seconds (short social videos, 3D demo), the logo that assembles at the end, the video that ends on the proof |
| R4, R5 and "rank, point to the second" | from `echris6/motion-video-kit` (MIT): a film's quality list (no empty frame, no text over text, frame 0 is already a finished composition, legible at phone size, the closing legible for ~1.5 s) and the format of the critic's report (ranked, with the time of each defect) |
| R10 | from `feitangyuan/onetake` (PolyForm Noncommercial; the idea only): the measure of continuity between one scene and the next, to reject the video that switches slides instead of flowing |
| "builder ≠ judge" | from `echris6/motion-video-kit`: the critic is a fresh conversation, which sees only the video, the request and the rubric, never the maker's reasoning |
| R14, R15, R16 | the sales video that goes back because it contradicts the product: the product sells an AI working on its own and, on screen, the one doing the work is a person, with "Step 2 of 4" cards. The three items check the thesis (`recipes/thesis.md`); R15's one quarter is the ceiling of the screen-time rule |

Left out on purpose: the sound critic (loudness, effects against the music), because there is no video approved or
rejected because of sound to calibrate against; and onetake's continuity oracle, which measures the HTML composition
before rendering. Here the video is already finished, so continuity is measured only in the pixels (hard cuts). With
voice, the voice over the soundtrack is measured by `finalize.mjs` (the voice at least 15 dB above what plays under it:
`references/voice-mix.md`), not by the critic, which does not hear the video: it reads the transcript.

## How the fresh conversation is called

`critic.mjs` runs Claude Code in `-p` mode (one question, one answer), in a folder that holds only the package, like
this:

```sh
claude -p --model sonnet --system-prompt <the critic's role> --tools Read \
  --setting-sources "" --disable-slash-commands --strict-mcp-config --no-session-persistence \
  --output-format json --max-budget-usd 1.5 "<the rubric, the request and what to read>"
```

- **Isolated:** no profile `CLAUDE.md`, no project memory, no skills, no MCP, no history. Only the `Read` tool, and only
  inside the package folder.
- **Uses the account already logged in** to `claude` (the subscription): it does not ask for an API key and does not
  spend paid-service credit, not even when the video has voice or generated images (no ElevenLabs, no OpenAI).
- **Cost:** the JSON Claude returns carries `total_cost_usd` and the token usage; `critic.mjs` writes both to
  `critique.json` and prints them at the end. The measured numbers are in "Calibration".
- If the answer comes back out of format, it asks again once, saying what was wrong.

## Calibration

Three videos of one app tutorial, 9:16, with the same `--request`, on the current rubric. Each row is a new call.

| Video | Expected | Round | Verdict | Defects pointed out (second · item · severity) |
|---|---|---|---|---|
| Approved final | pass | 1 | approve | 14 · R2 minor; 12 · R4 minor |
| | | 2 | approve | 5 · R2 minor; 28 · R4 minor |
| | | 3 | approve | 6 · R2 minor; 12 · R4 minor |
| Draft of the same video | see what it flags | 1 | reject | 7 · R4 severe (caption covers the sentence's target); 7 · R2 minor; 45.6 · R11 minor (closing comes in on a cut) |
| | | 2 | reject | 14.5 · R4 severe (caption covers the shortcuts menu); 29 · R2 minor; 4.5 · R4 minor |
| | | 3 | reject | 7 · R2 severe (blurred band adds up to more than 1/3); 7 · R4 minor; 2.2 · R10 minor |
| Broken copy (screen cut 8–14 s, small app on cream 22–32 s, no closing from 44.6 s) | reject | 1 | reject | 41 · R11 severe; 20 · R2 severe; 8 · R4 severe |
| | | 2 | reject | 40.6 · R11 severe; 22 · R2 severe; 8 · R3 minor |
| | | 3 | reject | 44 · R11 severe; 22 · R2 severe; 8 · R4 severe |

- **The approved one passes (3 of 3) and the broken one is rejected (3 of 3).** The approved one's minor defects are
  real: the caption card fades over the on-screen text at the step change, and the bottom quarter of the 9:16 is the
  blurred background (R2's exception).
- **In the broken one,** the missing closing and the leftover cream show up 3 of 3 as severe (the cream up to 2 s before
  its real start, when the previous screen is already a small wide shot). The cut screen comes out at the right second,
  as severe, in 2 of 3; in the other, the critic describes it as a "screen recording with zoom", minor. Since only 3
  defects fit, third place is contested.
- **The draft has an unstable verdict:** it is rejected each time for a different, plausible reason (the caption over
  the sentence's target, the sum of the blurred background bands, the hard cut to the closing); with an earlier version
  of the rubric, it was approved.
- **Known limit:** these are 9 calls on 3 videos of a single tutorial, and the rubric was adjusted looking at those same
  videos (see "Rubric adjustments"). The test with a video it has never seen, and with the owner's judgment, is still
  missing.
- **Cost:** US$ 0.05 to 0.09 per call (average 0.076), 12 to 28 s, ~2 thousand output tokens. That is the list price
  `claude` itself reports; on the subscription it becomes quota usage, not money. Building the package (sheets, frames,
  direction) takes ~6 s; the local refinement check, about 25 s more when `--refine` is not passed.

### The thesis items

The screens draft of a rejected sales video (9:16, 22 s, no voice), with the original request and the thesis a fresh
conversation wrote from the repository. Each row is a new call.

| Package | Verdict | Defects pointed out (second · item · severity) |
|---|---|---|
| with the thesis | reject | 2.5 · R16 severe ("Step 1 of 4" to "Step 4 of 4" cards); 3 · R14 severe (the proof scene does not appear, the time goes to the handover); 15 · R15 severe (person in 11 of 19 frames) |
| with the thesis | reject | 2.5 · R16 severe; 3 · R14 severe |
| with the thesis | reject | 2.3 · R16 severe; 2.3 · R14 severe; 4 · R15 severe (person in 14 of 19 frames, counting the tap on the suggestions) |
| with the thesis (the one from the final recipe) | reject | 2.5 · R14 severe; 3 · R16 severe; 9 · R15 severe (person in 12 of 16 frames) |
| without the thesis | reject | 0.5 · R2 severe (empty opening); 19 · R13 severe (the word "test" in the closing); 4 · R4 minor |
| without the thesis | reject | 0 · R2 severe; 4 · R4 severe (suggestions cut by the edge); 19.8 · R13 minor |

- **With the thesis, the critic points out the defect that sent the video back:** tutorial format in a sales video (R16)
  and the missing proof scene (R14) in all four; people working in a product that sells the AI working on its own (R15)
  in three.
- **Without the thesis, it rejects only for finish.** Not a word about the step cards or about who does the work. With
  the opening and the closing fixed, the same video would pass.
- **Known limit: the critic reads the proof scene literally.** The thesis cited two customer questions, the draft showed
  another question answered by the AI, for about 5 s, and it wrote "the proof scene does not appear".
- **The finger of whoever records counts as a person** (the tap on the suggestions, in one of the rounds). In a sales
  video, the message from whoever is being served has to arrive with no finger.
- Cost: US$ 0.07 to 0.09 per call, as above.

## Rubric adjustments

Whenever the owner disagrees with the critic, or calibration shows the rubric got it wrong, fix the item and note here
what changed and why, as a general rule: no product name, person name or date.

- **R1 judges only the new screen's entrance.** An earlier version treated the app fading out at the bottom during the
  detail as a "cut screen" and rejected the approved video. The zoom after the wide shot is the right "wide then
  detail"; the defect is the new screen already coming in zoomed, without ever having appeared whole.
- **R2 has the exception for the bottom quarter of the 9:16:** the blurred background of the screen itself, during the
  detail, is minor and stays as the owner's decision. Without the exception, the rubric rejected the approved video for
  "leftover background".
- **R4 says what "gets in the way of reading" means:** a caption or the sentence's target that does not fit whole in the
  frame, at the moment the caption points to it (with voice, at the moment the voice says it), is severe. When it only
  said "severe when it gets in the way of reading", the cut screen came out as minor.
