# The review board

The local page where the video is made with the person, one scene at a time. Each scene is a phase: they see the still
before it is animated, approve it, watch the preview, approve it. In any phase they can paste a better picture and
write to you. With a voice-over, they also approve the script before any voice is recorded, pick the voice by ear and
listen to each line; a generated picture carries its mark and cost, and the page shows what the video spent. You write
what the page shows (`board.json`); `wait` tells you what they did; `say` answers them there.
Read together with `SKILL.md` → "Owner's rule: show it before you make it".

## The loop

```
node $SKILL/scripts/board.mjs set   <project> <board.json>     # 1. write the board (validated; every file must exist)
node $SKILL/scripts/board.mjs open  <project>                  # 2. opens the browser, prints the address, returns
node $SKILL/scripts/board.mjs wait  <project> --timeout 540    # 3. blocks until the person does something, prints it
node $SKILL/scripts/board.mjs status <project> --scene 02 working "Redrawing the still"   # 4. while you act on it
node $SKILL/scripts/board.mjs patch <project> '{"scenes":[{"id":"02","still":"stills/02-v2.png"}]}'   # 5. show the result
node $SKILL/scripts/board.mjs say   <project> --scene 02 "Here is the new still."         #    and say it; back to 3
node $SKILL/scripts/board.mjs stop  <project>                  # when the video is delivered
```

**For each scene, in this order: still → "Approve still" → animate → preview with its sound → "Approve preview".**
Never animate a scene before its `approve-still`, and never render it final before its `approve-preview`.

**With a voice-over, first: script → "Approve script" → the voice, chosen by ear → then each scene as above, its
preview playing with its line and the music.** Never record a line before `approve-script`: recording spends credits.
A video without a voice has no `script` and no `narration`, and the board works as it always did.

- `set` and `patch` take a file, `-` (stdin) or the JSON itself. A board with a problem is not written: the message
  says where and what to fix.
- `wait` prints one JSON line per new thing the person did and exits 0; exit 2 = nobody answered in time (say so in the
  chat and stop; the next `wait` still brings everything done meanwhile); exit 1 = the board is not open. While `wait`
  blocks, the page says "Skill connected". `events <project>` lists the whole log, your lines included.
- `say` without `--scene` goes to the thread about the whole video. `status … working "<what>"` shows "Skill is
  working…" in that thread until your next `say` there, or `status … idle`.
- `agent <project>` prints this loop with the commands for the project, for the session that will serve the board;
  `agent <project> --terminal` opens Terminal.app with Claude Code on it (macOS; elsewhere it prints the loop).
- `open` again reuses the running board. If it fails, show the files and ask in the chat instead.

## board.json

Paths are relative to the project folder and stay inside it (copy a kit photo or icon into the project first). Pictures:
png, jpg, jpeg, webp, gif. Videos: mp4, mov, webm. Audio: mp3, wav, m4a. Only `title` is required; a block with nothing
in it is not drawn. Every field below the title is optional; this example is a narrated video halfway through.

```json
{
  "title": "New feature",
  "subtitle": "60 s · 16:9",
  "progress": { "label": "Preview", "percent": 40, "text": "stills approved; now: animation" },
  "costs": { "images": { "usd": 0.09, "capUsd": 0.5, "count": 3 }, "voice": { "credits": 480, "capCredits": 1500, "accountLeft": 13191 } },
  "script": { "state": "approved", "words": 13, "seconds": 6, "credits": 90, "voice": "Calm narrator" },
  "choices": [
    { "id": "voice", "title": "The voice of the video", "intro": "The first line, read by three voices. Listen, then pick one.",
      "options": [
        { "label": "A", "title": "Calm narrator", "line": "Low, slow, warm.", "audio": "voice/v1/samples/a.mp3", "recommended": true },
        { "label": "B", "title": "Bright host", "line": "Quick and friendly.", "audio": "voice/v1/samples/b.mp3" },
        { "label": "C", "title": "Plain guide", "line": "Even and clear.", "audio": "voice/v1/samples/c.mp3" }
      ] },
    { "id": "look", "title": "The look of the whole video", "intro": "Two palettes. Pick one before I draw the scenes.",
      "options": [
        { "label": "A", "title": "Warm", "line": "Cream background, dark text.", "image": "stills/look-a.png", "recommended": true },
        { "label": "B", "title": "Dark", "line": "Dark background, light text.", "image": "stills/look-b.png" }
      ] },
    { "id": "cover", "title": "How the cover is drawn", "intro": "Two ways to open. Pick one and I animate it next.",
      "scene": "01",
      "options": [
        { "label": "A", "title": "Soft stack", "line": "Three rounded layers.", "image": "stills/cover-a.png",
          "willMove": ["Layers drop in, base first"], "recommended": true },
        { "label": "B", "title": "Flat stack", "line": "The same layers in flat color.", "image": "stills/cover-b.png" }
      ] }
  ],
  "scenes": [
    { "id": "01", "title": "Cover", "seconds": 9, "state": "concept", "pendingChoice": "cover", "onScreen": "“New feature”",
      "narration": { "text": "Here is what is new." } },
    { "id": "02", "title": "The list", "seconds": 12, "state": "concept", "still": "stills/02.png",
      "generated": { "model": "image-model", "usd": 0.043 },
      "onScreen": "“Three steps”", "willMove": ["Rows come in one by one"],
      "narration": { "text": "Three steps, one screen.", "audio": "voice/v1/lines/02.wav", "seconds": 2.1, "credits": 40 } },
    { "id": "03", "title": "The result", "seconds": 10, "state": "animated-preview", "still": "stills/03.png",
      "video": "out/03-draft.mp4", "narration": { "text": "And it is done.", "audio": "voice/v1/lines/03.wav", "seconds": 1.6, "credits": 30 } }
  ],
  "pieces": [
    { "kind": "Photo", "name": "Team at the table", "image": "board/pieces/team.jpg", "goesTo": "scene 02" },
    { "kind": "Illustration", "name": "A drawn map", "image": "images/map.png", "goesTo": "scene 03",
      "generated": { "model": "image-model", "usd": 0.043 } }
  ],
  "references": [
    { "file": "board/references/sketch.png", "scene": "02", "take": ["The longer shadows"] }
  ]
}
```

| Field | What it is |
|---|---|
| `scenes[]` | one phase each, in order. `state`: `concept` (a still to approve), `still-approved`, `animated-preview` (needs `video`; plays with its sound), `final` |
| `choices[]` | the open choices: two or more options, each a still. With `scene`, it shows inside that scene's phase; without, in a first phase called "Direction". Take a choice out once you acted on it |
| `scenes[].pendingChoice` | the `id` of the choice this scene has no still without: the phase shows the options instead of a still |
| `pieces[].kind` | free text; `Icon`, `Logo` and `Photo` get their own framing. Shown under "All scenes" |
| `references[]` | the person's pictures (files in `board/references/`). With `scene`, it is "Your version" next to our still; you add `take`, what you would use from it |
| `costs` | what the video spent, shown on every phase against each cap, with a warning from 80% of a cap and past it. Exactly what `node $SKILL/scripts/costs.mjs board <project> [--account-left <credits>]` prints: `images` (`usd`, `capUsd`, `count`) and `voice` (`credits`, `capCredits`, `accountLeft`, the credits left in the voice account, when known). `patch` it after every paid call |
| `script` | the voice-over, a phase of its own before everything else: every scene's line in order (from `scenes[].narration.text`), with the button "Approve script". `state` (required): `draft` or `approved`; `words`, `seconds`, `credits` (the estimate to record it) and `voice` (its name) are shown when given. Without `words`, the lines are counted |
| `scenes[].narration` | the scene's line. `text` (required); `audio`, the take (mp3, wav, m4a), plays alone and can be asked for again; `seconds` and `credits` of that take. A take longer than the scene is pointed out |
| `choices[].options[].audio` | an option that is heard: how the voice is chosen (the same line read by two or three voices). With `audio`, `image` is optional. One sound plays at a time on the page |
| `generated` | in `scenes[]`, `choices[].options[]` and `pieces[]`: `{ "model", "usd" }`. The picture carries "AI-generated" and its cost. A picture without it is the person's or the product's |

The page writes these itself: `choices[].chosen` (the option's `label`), `scenes[].state`, `scenes[].previewApproved`,
`scenes[].rebuilding` (the picture a still is being rebuilt from), a new item in `references[]` and its `scene`,
`script.state` (`approved`).

## What `wait` prints

`{ "n", "at", "type", … }`, one line per event, also kept in `<project>/board/events.jsonl`:

| `type` | Comes with | What to do next |
|---|---|---|
| `choice` | `choice`, `option`, and `scene` if it has one | make that option the scene's still; `patch`: the scene's `still`, and the choice with `"remove": true`. The voice choice: record the approved lines in that voice (see `approve-script`), `patch` `script.voice`, and take the choice out |
| `approve-still` | `scene` | animate that scene; `patch`: `state: "animated-preview"` and `video` |
| `approve-preview` | `scene` | render it final; `patch`: `state: "final"` and the final `video`. The page already moved on to the next scene |
| `replace-still` | `scene`, `file`, maybe `text` | the person wants their own picture for this scene: rebuild the still from `file` (keep what `text` says), `patch` the new `still`, `say` it is there. The scene is back to `concept` and waits for "Approve still" again |
| `message` | `text`, `from: "person"`, maybe `scene` | answer with `say` in the same thread; if it asks for a change, make it and show the scene again |
| `reference` | `file`, maybe `scene` | a picture pasted, dropped or picked. Nothing to make yet: look at it, `patch` its `take` if you have something to say |
| `attach-reference` | `file`, `scene` | a general reference was put next to a scene; same as above |
| `approve-script` | — | the words are approved. No voice chosen yet: put up the voice choice (the approved first line read by two or three voices, each option with its `audio`). Voice chosen: record the approved lines, then `patch` each scene's `narration.audio`, `seconds`, `credits` and the `costs` block |
| `redo-line` | `scene`, maybe `text` | record only that line again. `text` is new words or what to change ("slower"). New words go on the page first: `patch` `narration.text`, and wait for `approve-script` again. Then the new take: `patch` its `narration.audio` (and `seconds`, `credits`, `costs`), `say` it is there |

## Patch

Texts and `pieces` are replaced; `progress`, `costs` and `script` are merged (`costs` one level deeper too); `scenes`
and `choices` are merged by `id`, and inside a scene its `narration` and `generated`; `references` by `file`.
A new `id` is added at the end, `"remove": true` takes an item out, `null` removes a field.

```
node $SKILL/scripts/board.mjs patch <project> '{"choices":[{"id":"cover","remove":true}],"scenes":[{"id":"01","still":"stills/cover-b.png"}]}'
node $SKILL/scripts/board.mjs patch <project> '{"costs":{"voice":{"credits":560}},"scenes":[{"id":"02","narration":{"audio":"voice/v1/lines/02.wav","seconds":2.1,"credits":40}}]}'
```

**Rules:**
- the person's marks belong to the picture they were made on: when a scene gets a new `still`, `video` or `state`, its
  preview approval and its "rebuilding" are cleared; new `options` clear the pick. An approval comes from the person
  (the board or the chat), never from you;
- the same goes for what is heard: a new `narration.text` or `narration.audio` clears that scene's preview approval
  (a new `seconds` or `credits` does not). And an approved script is approved on its words: a patch that changes what
  a line says, or gives a scene a line it did not have, puts `script.state` back to `draft` by itself;
- `generated` belongs to its picture: a new `still` without `generated` in the same patch drops the mark (send both
  together when the new still is generated too);
- a still, a video or a take rewritten at the same path shows up on the open page on its own, and ends "Rebuilding from
  your picture" and "Redoing this line" too;
- `set` again replaces the whole board but keeps the person's references, unless the new board brings `references`;
- the page runs on 127.0.0.1 behind a random address, and serves only pictures, videos and audio from the project
  folder. What the person drops or pastes is a picture or a video, never audio.
