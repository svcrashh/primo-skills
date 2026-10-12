# The video's thesis

Before the script, the skill writes down **what the video has to prove**. Without it, the skill takes the feature list and
films the click path.

A product that sells an AI working on its own, with no thesis, tends to get a video in which, for most of the screen
time, the one doing the work is a person (asking, transferring, replying with a tap), with "Step 2 of 4" cards on top.
That video contradicts what the product sells and gets sent back. Those are two mistakes, both the skill's: nobody
decided what the video proves, and a sales video came out in tutorial format.

```sh
node $SKILL/scripts/thesis.mjs write <repository> --out <project folder> [--request "<what the owner asked for>"]
node $SKILL/scripts/thesis.mjs validate <project folder>/thesis.md
node $SKILL/scripts/thesis.mjs count    <video folder>/script.md [--thesis <thesis.md>] [--write]
```

## Usage rule

1. **The thesis comes before the script, the style and the briefing**, in every video. It lives in `thesis.md`, in the
   project folder, next to `reading.md`.
2. **A fresh conversation writes it** (`thesis.mjs write`), and it only sees this recipe and the repository. It does
   not see the full request, the feature survey or what the person making the video has already decided: that is how
   the thesis comes from the product and not from the path that was already in someone's head. It runs in the
   background, during reconnaissance, and takes minutes. `--request` carries only the owner's sentence, to decide the
   intent.
3. **You check it and show it in five lines** (`validate` prints the summary): the sentence, who buys, the proof scene,
   what stays out and the intent. Disagree with a part? Fix the file **with the evidence** (`file:line`) and run `validate` again. Without new evidence, what came out stands.
4. **Product without a repository** (a website only, a description only): write the thesis by hand with the recipe
   below, with a URL or the owner's sentence in place of `file:line`, and run it through `validate`.
5. **The format comes from the intent** ("The format follows the intent", below). The thesis decides before the style is
   recommended.
6. **The script carries the "Who does the work" column and the count** ("The screen-time rule"). A
   sales script that fails the count does not go to the owner: it goes back.
7. **The critic gets the thesis** (`critic.mjs --thesis`), and checks: does the video prove the sentence? who does the
   work on screen? is the format the one for the intent? (`recipes/critic.md`, R14 to R16).
8. **Never adjust the thesis so the script passes.** The thesis is the criterion; the script is what changes.

## The recipe

This is the text the fresh conversation receives, between the markers. It has no product example inside, on purpose: an
example becomes a template, and one product's thesis must not come out looking like another's.

<!-- thesis:start -->
The thesis says **what the video has to prove**. It comes from the product's repository, not from the feature list:
what the product **has** is a list; what it **sells** is a sentence.

**Where to read, in this order** (read only; do not run anything):

1. **the text written to sell:** the landing page (the big headline, the subheading, the button text), pricing and
   plans, the page `<title>` and description, ad copy, pitch, positioning, brand kit;
2. **the README and the documents** about product, vision and audience (`docs/`, the `.md` files at the root,
   `CLAUDE.md`);
3. **the demo the product built for itself:** simulator, demo, sample data, presentation script, end-to-end tests. What
   it chose to show first is what it thinks sells;
4. **the names of things in the code:** routes, screens, modules, the main entities, the interface copy;
5. **the history** (`CHANGELOG`, release notes), only for the `update` (what's new) intent.

Sales copy weighs more than internal documents, which weigh more than code names. Where they disagree, say so.

**Once you pick the part of the product that carries the sentence, go to its document** (the module README, the spec,
the data sheet). That is where the product says, without embellishment, what that part has to do and what makes it
convincing. If it states the same promise better than the sales page (shorter, with the work that disappears), use its
words and cite both.

The thesis has five parts. The headings and the bold field labels of the answer stay exactly as in the format at the
end: the scripts find the parts and fields by them.

**1. What the product sells, in one sentence.**

- **In the product's own words.** Copy the passage and say where you took it from (`file:line`, the path from the
  repository root). You may shorten it and join two passages; you may not swap its words for yours.
- **It is the sale, not the category.** "Platform for X", "system for Y", "complete solution for Z" is the category: it
  fits every competitor. The sale is what **this** product says it does that changes the day of whoever buys it. Write
  the category on a separate line, so it does not pass for the sale.
- **It names the work that disappears.** A good sentence answers: "once it is bought, what stops being done by hand,
  or what starts happening without me?". Between two candidates, the one that names the work the product takes off
  someone's plate wins.
- **It ends on the product.** The subject of the sentence is the product, and the verb is the work it does. If the
  sentence ends with someone working ("…and the team takes over", "…for you to check"), its ending tells what is left
  for the person. Cut it at that point.
- **The part that works on its own is the sale.** When the sales copy announces one part of the product that does the
  work with nobody involved and another where people work (dashboard, queue, form, report), the sale is the first one,
  even if the second has more screens. The second is where the team handles what is left, and every competitor has it.
- **There is only one.** A product with three promises has one that the others serve. Pick that one. Joining two
  passages only works when both state the same promise; two promises joined by "and" are two sentences. The others go
  to "what the video does not show": each one is another video.

**2. Who buys, and what pain they have.**

- **Who buys** is whoever decides and pays, which is not always whoever uses it. Name the kind of business or person,
  with the evidence.
- **The pain** is what it costs that person today, without the product, in their words: time, people, lost sales,
  mistakes. One or two lines.

**3. The proof scene.** The moment, on the real screen, when the product does on its own the work the
sentence promises. It is what the video exists to show.

- **It is a scene, not a tour:** it starts (the situation arrives), it happens (the product works) and it ends (the
  result appears).
- **Hands off:** while it happens, nobody on the buyer's side touches anything, or gets anything to do. At most, the
  person triggers it (a request, a question, a tap). If someone has to click for the scene to move on, that is the
  product's operation, not the proof.
- **It ends with the sentence being true on screen:** someone watching with no sound understands what the product did.
- **One place only.** The scene happens where the work shows up. A second screen only comes in if without it the result
  cannot be seen. The screen that explains **how** the product did it (the history, the log, the report) is another
  promise and another video.
- **It has the convincing detail:** what, on screen, shows the work came out well done, as it would from the hands of
  whoever used to do it. Say which one it is.
- **It exists on the real screen.** Name the screen, the route or the component (`file:line`) and, if there is one,
  the demo, the simulator or the sample data that shows it. If the work happens behind the scenes and no screen shows
  it, say so and point to what can be seen: the before and the after, the notice that arrives, the log entry.
- **The safety net is not the proof.** What the product does when it stops working (hands over to a person, asks for
  help, falls back to manual mode) reassures the buyer, but does not prove the sentence. This holds even when the sales
  copy announces it as a strength, and even when it is well done (hands over with a summary, with context, at the right
  time). The proof scene starts and ends with the product working: it ends **before** the safety net.

**4. What the video does not show.** A list, using the name the thing has in the product:

- **the manual work the product exists to remove.** If the sentence says the product does it, a scene of people doing
  it contradicts the sentence;
- **what is done once:** sign-up, setup, login, settings;
- **features that do not prove the sentence,** however good they are. List each one, so the script does not pull it
  back in. It proves another sentence and is another video;
- **the safety net as a scene** (the handover to a person, the work landing in someone's queue): it fits in one line of
  text, at most;
- what cannot appear: real data, a disabled feature, what the screen does not do.

**5. The intent:** `sell`, `teach` or `update` (what's new). What decides it is **who
watches** and what they leave the video with.

| Intent | Who watches | Leaves the video | Format |
|---|---|---|---|
| `sell` | someone who has not bought yet, or does not know it | believing the product does what the sentence says | hook, the proof, call to action |
| `teach` | someone who already uses it | knowing how to do a task on their own | tutorial, with steps |
| `update` | someone who already uses it or follows it | knowing what changed | the before and the after |

- "Explain the product", "present it", "show the screens", "show how it works", for someone who has not bought yet, is
  **sell**. `teach` is only when there is a named task and the viewer already has the product in hand.
- Did the owner's request come along? It and the channel decide (advertising, Reels, landing page: sell; help center,
  inside the app: teach; release note: update).
- No request? Look at the product. Does it offer itself to the outside (landing page, pricing, open sign-up, demo)? The
  video is what introduces it to people who do not know it: `sell`. Is it an internal tool, for a team that already
  has it? `teach`.

**A product that is not sold** (internal tool, a project for one's own use): the sentence is the work it takes off the
people who use it, "who buys" is whoever uses it and whoever commissioned it, and the proof scene is still the moment
when it does that work on its own. Say in part 2 that there is no sale.

**Do not make things up.** No numbers, no clients, no promises the product does not write. What the repository does not
say goes to "What could not be found out", and a guess is written as a guess.

**Answer format.** Only the text below, in Markdown, with these headings and these bold fields, in this order. One page,
at most. Keep the headings and the bold labels exactly as written; replace each `<…>` with the content.

```
# Video thesis · <product name>

## 1. What the product sells
**Sentence:** <one sentence only, up to 25 words, in the product's words; nothing else on this line>
**Source:**
- `path/file:line` "<copied passage>"
- `path/file:line` "<copied passage>"
**Category (not the sale):** <the category it competes in>
**Why this sentence:** <one or two lines: why this one, and where the other promises went>

## 2. Who buys, and what pain they have
**Who buys:** <who decides and pays> (`file:line`)
**Pain:** <what it costs today, without the product>

## 3. The proof scene
**Scene:** <starts, happens, ends: 2 to 4 lines>
**Where, on screen:** <the screen or the route> (`file:line`); <the demo or the sample data that shows it>
**Who does the work:** <the product; the person only triggers it with…, or touches nothing>
**The convincing detail:** <what shows the work came out well done>
**Ends on:** <the frame in which the sentence is true>

## 4. What the video does not show
- <manual work the product removes>
- <what is done once>
- <a feature that does not prove the sentence>
- <the safety net>

## 5. The intent
**Intent:** <sell | teach | update>
**Why:** <who watches and what they leave with>
**Format:** <the one from the table>

## What could not be found out
- <what the repository does not say and would change the video>
```
<!-- thesis:end -->

## The format follows the intent

The thesis's intent decides the format **before** the style is recommended and before the script is written.

| | `sell` | `teach` | `update` |
|---|---|---|---|
| **Structure** | hook (up to 3 s: the pain or the promise) → the proof scene (the core) → call to action (what to do now) | the task's title → the steps → the screen that proves the task is done | the before (short) → the after → where to see it |
| **On-screen text** | only what reinforces the proof: the thesis sentence, a number the product shows, the name of what it just did | step card, the sentence in the imperative, the button name as it is on screen | what changed and where to see it |
| **Forbidden** | "Step N of M"; instruction card; usage text in the imperative, and with voice a spoken line in the imperative ("Tap…", "Click…"); a tour of the screens; anything from part 4 of the thesis | a sales promise in the middle of the steps; skipping a step | the full tutorial of the new feature |
| **Type** (`references/types.md`) | demo, launch, social cut, teaser. **Never a tutorial** | tutorial, explainer | update, feature launch |
| **`--goal`** (`recommend-style.mjs`) | `launch`; `attention` for a piece of up to 15 s | `teach` | `update` |
| **Real screen** | comes in as proof: recorded in full, with no step card (`legenda.rotulo: "nenhum"` in the series) and with the caption saying what the product just did (with voice, the caption is the narration line, and the line says it) | tutorial mode, as always | the same framing in both states |
| **The count** | mandatory, with a verdict | informative | informative |

A real screen in a sales video does not turn the video into a tutorial. The recorder is the same (`scripts/tutorial/`),
but the one shown doing the work is the product: the scene is recorded from start to finish, the product's waiting time
is cut (`cortarEsperas`) or, with voice, covered by the line (the cut never takes a line in progress), and no text or
line tells the viewer to do anything.

## The screen-time rule

In the script, **each scene says who is doing the work in it**, in a "Who does the work" column (`thesis.mjs count`
finds the column by this name):

| Value | When |
|---|---|
| `proof` | the product doing, on its own, the work of the sentence: the thesis's proof scene, or a piece of it |
| `product` | the product working on its own on something else that reinforces the sentence: a result, a number it calculated, a notice it sent |
| `person` | someone on the buyer's side operating: clicks, types, drags, transfers, replies, checks, configures. Also the scene in which the product **passes the work on**: it says it will call someone, the queue that arrives, the "take over this conversation" |
| `—` | nobody works: the person on camera, a poster card, the logo |

- **Whoever is being served does not count as a person.** What counts is whoever would do the work if the product did
  not exist. The customer who asks and gets answered by the product is in a `proof` scene.
- **When in doubt, mute it and look:** is there a cursor, a finger or a keyboard of someone operating the product moving
  in the scene? `person`.
- **The gesture that only triggers** (a tap, a question) and leaves the rest to the product stays in the product's
  scene. Two gestures in a row are already operation: `person`.

**The count.** Product time = `proof` + `product` + `person` (the time the product is on screen; the person on camera
and the card are left out). In a **sales** video:

- **the proof scene is at least 50% of product time;**
- **a person working is at most 25% of product time.** The target is zero; 25% is the ceiling.

Did not pass? **The script goes back:** cut the person scenes, stretch the proof scene and count again. It does not go
to the owner.

```sh
node $SKILL/scripts/thesis.mjs count <video folder>/script.md --write    # exit code 1 = goes back
```

`--write` writes the count inside the script, below the table, so the owner sees the number together with the text.
With no `thesis.md` nearby and no `--intent`, the command stops: there is no script without a thesis.

**Why 50% and 25%.**

- **50% for the proof** is "most of it" said as a number: the video exists to show that scene, so it takes up more
  product time than everything else together.
- **25% for the person, not 49%.** "Minority" would be anything under half, but a video with 40% of people clicking is
  still remembered as "a tool you operate". A sales video has 12 to 25 s of product; a quarter of that is 3 to 6 s,
  **one scene**. One person scene is what honesty sometimes asks for: the single gesture that triggers the product, or
  its limit said on screen ("what it cannot solve, it hands to someone"). Two scenes already tell another story, the
  one about how it is operated.
- **Where it came from:** a rejected sales script had 75% person and 25% proof
  (`tests/cases/thesis/rejected-script-annotated.md`). The rule is that script turned upside down. It is **one** case;
  see "Known limits".

In `teach` the person works on purpose (it is the task), and in `update` the before can be the manual work: in both,
the count comes out without a verdict.

## How the fresh conversation is called

`thesis.mjs write` runs Claude Code in `-p` mode, **in the product's repository folder**, the same way as the critic
(`scripts/critic/call.mjs`):

```sh
# the prompt (the recipe, between the markers, and the owner's request when there is one) goes in through stdin
claude -p --model sonnet --system-prompt <the role of whoever writes the thesis> \
  --tools Read,Glob,Grep --allowedTools Read,Glob,Grep --permission-mode dontAsk \
  --setting-sources "" --disable-slash-commands --strict-mcp-config --no-session-persistence \
  --output-format json --max-budget-usd 3
```

- **The prompt goes in through stdin**, as in the critic, on macOS and on Windows, and `claude` is found the same way
  (`recipes/critic.md`, "How the fresh conversation is called").
- **Read only:** `Read`, `Glob` and `Grep`. It runs nothing from the repository and writes no file; the script is what
  saves `thesis.md`, from the text the conversation returns.
- **Isolated:** no profile `CLAUDE.md`, no memory, no skills, no MCP, no history. What is in the repository is material
  to read, never instructions.
- **Checks the format:** a thesis missing one of the five parts, missing the sentence's source or with an intent outside
  the three goes back once, with what was missing. Failed again: it stays in `tese.invalida.md` and the command exits
  with code 1.
- **Does not overwrite:** is there already a `thesis.md`? Only with `--redo`, and the old one is kept as `tese-v1.md`.
- **Cost:** US$ 0.20 to 0.30 per thesis (30 to 100 s, 11 to 19 turns), at the list price `claude` reports; on a
  subscription it is quota usage. One in three needed the second attempt, and then it costs double. It is logged in
  `tese.registro.json`.

## Calibration

In every round, the fresh conversation got only the recipe and the repository, with no request.

- **One known target.** In a messaging customer-service product with AI agents, whose sales video had been sent back,
  the target was "the AI handles it on its own, like a person, with nobody from the team". With the first version of
  the recipe, the thesis came out identical to the rejected video (the AI replies and hands the conversation over; it
  ends on the agent's dashboard). After the three recipe adjustments (in "Recipe adjustments"), the sentence hit the
  target in 4 of 4 rounds, with the same proof scene and "no agent on screen"; the handover to the team ended up in
  "what the video does not show".
- **In two more repositories,** with the final recipe: a product that is sold and a tool for one's own use. Both theses
  made sense, with the caveats in "Known limits". In the tool for one's own use, the conversation said there is no
  sale, that whoever uses it is whoever commissioned it, and flagged what was described as design and was not seen
  working.
- **The rejected script goes back** (`tests/cases/thesis/`). As written, because it does not say who does the work in
  each scene. With the column filled in by the rule: proof scene 3.5 of 14 s (25%), person 10.5 of 14 s (75%); it goes
  back for both reasons. A fresh conversation, with only the rule and the thesis, marked the "I'm calling someone"
  notice as `product` (person 54%): it goes back all the same, and the rule now says that the scene in which the
  product passes the work on is a person scene.
- **The critic, on that video's draft, with the thesis, rejects it for the right reasons** (tutorial format, proof
  scene missing, person working); **without the thesis, only for finish**. The numbers are in `recipes/critic.md`,
  "Calibration".

### Known limits

- **It is a single target.** The recipe was adjusted three times looking at the same repository. The adjustments are
  general rules and the other two repositories came out making sense, but no owner has read those two theses.
- **The promise that only the module's document states** (and the sales page does not) only shows up after the rule of
  going to the part's document, and in the sentence in 2 of 4 rounds; in the others, only in the source or in the
  detail.
- **The rule "the part that works on its own is the sale" pulls toward automation.** In a product where automation is a
  shortcut (importing an old document) and the headline promise is something else, it picked the shortcut and left the
  headline promise out. It can be the wrong choice in a product where automation is a detail.
- **The 50% and the 25% come from one rejected script.** No approved video has been measured by this count yet.
- **With no request, the intent of a product that is not sold is a guess.** The recipe says `teach`, and in a tool for
  one's own use the conversation itself wrote that what there was to teach was mostly just looking at the dashboard.
- **The thesis depends on what the repository writes.** Pain in the buyer's words, price and the decision-maker's role
  were in none of the three repositories; they went to "what could not be found out".

## Recipe adjustments

Whenever the owner disagrees with a thesis, or calibration shows the recipe got it wrong, fix the recipe and note here
what changed and why, as a general rule: no product name, person name or date.

- **The sentence ends on the product; the part that works on its own is the sale; the proof scene ends before the
  safety net, even when the sales copy announces it.** When the sales page announces the handover to the team as a
  strength, the thesis comes out identical to the video that goes back.
- **Two promises joined by "and" are two sentences; the scene happens in one place only, and the screen that explains
  how the product did it is another video; the scene names the detail that shows the work was well done.** Without
  this, the sentence joins two promises (handling it and leaving the trail) and the scene ends on the history screen.
- **Once the part that carries the sentence is picked, read its document.** The module's document can state the promise
  better than the sales page, and the reading used to stop at the page.
- **Format: "nothing else on this line" and the "Por que esta frase" field.** One in three answers went over the
  sentence's 30 words, by adding a comment on the same line. The sentence in quotes counts on its own in the check.
