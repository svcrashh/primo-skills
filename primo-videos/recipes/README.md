# Recipes

Ready-made, tested prompts, by project type. Each recipe says when to use it, the prompt with the parts that change in
`{braces}`, how many options to generate, the cost and what makes the result fail. They complement `references/`: the
reference gives the method, the recipe gives the text that works.

| Folder | Project | Read together with |
|---|---|---|
| `captions/` | UI sounds on taps and screen changes, off by default. With no voice, the caption is the on-screen text; with a voiceover, the caption is the speech (`caption.mjs --captions` burns it in word by word, also off by default) | `scripts/captions/` |
| `prompt.md` | **every request, before anything else**: ask whether the person wants the request refined into a detailed prompt to approve, the list of what a solid request says, and the prompt template | `SKILL.md` → "First step, always" |
| `board.md` | **whenever something is shown**: the local review board, one phase per scene (still → Approve still → animate → preview → Approve preview); with a voiceover, first the script (Approve script) and the voice picked by ear, then each scene's line to listen to; a generated image carries its mark and cost, and what the video spent shows on every phase. The `board.json`, what `wait` prints and what to do next | `SKILL.md` → "Owner's rule: show it before you make it" |
| `human-voice.md` | **every voiceover**: the voice that sounds like a person, not an announcer: which model, how to write the text for the voice, the emotion and pause markup, the settings, what makes it robotic | `references/voice-script.md` + `references/voice-choice.md` |
| `thesis.md` | **every video, before the script**: what the video has to prove (the recipe the fresh conversation receives), the format per intent and the screen-time rule | `SKILL.md` → "The thesis" |
| `critic.md` | **every finished video, before the person sees it**: the rubric the independent critic receives with the video and the thesis | `SKILL.md` → "Prove" |

**Rule for recipes:**
- a recipe that failed in a real case gets the lesson written into the recipe itself, as a rule (no product name, no
  date).
