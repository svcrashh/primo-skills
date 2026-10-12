# The review board

The local page where the video is made with the person, one scene at a time. Each scene is a phase: they see the still
before it is animated, approve it, watch the preview, approve it. In any phase they can paste a better picture and
write to you. You write what the page shows (`board.json`); `wait` tells you what they did; `say` answers them there.
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
png, jpg, jpeg, webp, gif. Videos: mp4, mov, webm. Only `title` is required; a block with nothing in it is not drawn.

```json
{
  "title": "New feature",
  "subtitle": "60 s · 16:9",
  "progress": { "label": "Preview", "percent": 40, "text": "stills approved; now: animation" },
  "choices": [
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
    { "id": "01", "title": "Cover", "seconds": 9, "state": "concept", "pendingChoice": "cover", "onScreen": "“New feature”" },
    { "id": "02", "title": "The list", "seconds": 12, "state": "concept", "still": "stills/02.png",
      "onScreen": "“Three steps”", "willMove": ["Rows come in one by one"] },
    { "id": "03", "title": "The result", "seconds": 10, "state": "animated-preview", "still": "stills/03.png",
      "video": "out/03-draft.mp4" }
  ],
  "pieces": [
    { "kind": "Photo", "name": "Team at the table", "image": "board/pieces/team.jpg", "goesTo": "scene 02" }
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

The page writes these itself: `choices[].chosen` (the option's `label`), `scenes[].state`, `scenes[].previewApproved`,
`scenes[].rebuilding` (the picture a still is being rebuilt from), a new item in `references[]` and its `scene`.

## What `wait` prints

`{ "n", "at", "type", … }`, one line per event, also kept in `<project>/board/events.jsonl`:

| `type` | Comes with | What to do next |
|---|---|---|
| `choice` | `choice`, `option`, and `scene` if it has one | make that option the scene's still; `patch`: the scene's `still`, and the choice with `"remove": true` |
| `approve-still` | `scene` | animate that scene; `patch`: `state: "animated-preview"` and `video` |
| `approve-preview` | `scene` | render it final; `patch`: `state: "final"` and the final `video`. The page already moved on to the next scene |
| `replace-still` | `scene`, `file`, maybe `text` | the person wants their own picture for this scene: rebuild the still from `file` (keep what `text` says), `patch` the new `still`, `say` it is there. The scene is back to `concept` and waits for "Approve still" again |
| `message` | `text`, `from: "person"`, maybe `scene` | answer with `say` in the same thread; if it asks for a change, make it and show the scene again |
| `reference` | `file`, maybe `scene` | a picture pasted, dropped or picked. Nothing to make yet: look at it, `patch` its `take` if you have something to say |
| `attach-reference` | `file`, `scene` | a general reference was put next to a scene; same as above |

## Patch

Texts and `pieces` are replaced, `progress` is merged, `scenes` and `choices` are merged by `id`, `references` by `file`.
A new `id` is added at the end, `"remove": true` takes an item out, `null` removes a field.

```
node $SKILL/scripts/board.mjs patch <project> '{"choices":[{"id":"cover","remove":true}],"scenes":[{"id":"01","still":"stills/cover-b.png"}]}'
```

**Rules:**
- the person's marks belong to the picture they were made on: when a scene gets a new `still`, `video` or `state`, its
  preview approval and its "rebuilding" are cleared; new `options` clear the pick. An approval comes from the person
  (the board or the chat), never from you;
- a still or a video rewritten at the same path shows up on the open page on its own, and ends "Rebuilding from your
  picture" too;
- `set` again replaces the whole board but keeps the person's references, unless the new board brings `references`;
- the page runs on 127.0.0.1 behind a random address, and serves only pictures and videos from the project folder.
