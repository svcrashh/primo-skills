# Chat bubbles (`chat-bubbles`)

A chat conversation going back and forth between the person and the product: the "typing…", the bubbles that come in with a spring, the
answer that brings a mini-card (a file that assembles itself, a list with "in / maybe", an image) and the camera that
follows the last bubble. An 8–15 s video.

**When to use:** objectives `teach` (how to ask), `launch` and `update` (a chatbot, an AI, a support flow),
`attention`; channels `site`, `whatsapp`, `reels`, `feed`; product `b2b` and internal audience, and any product that
**converses**: chatbot, AI assistant, support, a tool that asks before doing. Works without sound.
**When not to use:** a single request and its answer, with no question back (`typing-text` is more direct); teaching
where to click (`real-screen-camera`); a long conversation (more than ~6 messages). **Never a conversation with a real customer, name or
data:** the bubbles are generic requests and answers, and no invented testimonial.
**Voice:** none: the style has no narration. With voice (opt-in, `references/voice-script.md`), the closest style
that takes it is `typing-text` (the request typed and the product answering).

## Structure (8–15 s)
- **0 s:** the first bubble (the request) already coming in: frame 0 is never empty.
- **Back and forth (2–4 s each):** the "typing…" before each answer; the bubble comes in with a spring; the question back
  ("one thing missing: is it for the team or for a customer?"); the person's answer.
- **The delivery:** the product's last bubble with the card (the file with its thumbnails assembling, the list with the chips
  bouncing), ~2–3 s to read.
- **Closing:** only the logo, held ~2 s.

## Formats (recomposed, not cropped)
- **16:9:** the conversation in a chat window in the center (camera that follows) or at 41% of the width, with the card opening
  in a panel beside it (split).
- **9:16:** the window fills the Reels safe area; the card comes into the conversation.
- **1:1:** like 9:16, with a 60 px margin.

## The request must include
The conversation in 3 to 6 messages (who speaks, the text of each one, up to 7 words per line); what the product returns
(the file's name and detail, the list items and each one's chip); the name of whoever speaks in the labels; the dominant color.

## Variants
- **window that follows:** a chat mockup frame with a title (the name of the product's chat), the last bubble on the
  reading line and the conversation scrolling up; push to the closing (`example.json`).
- **split with guided zoom:** the conversation on the left, the list opening in a panel on the right in a mask that comes out of the
  bubble; the camera moves close to each bubble, pulls back and reaches the panel (`example-split.json`).
- **still:** the whole short conversation in view, no window, with a hard cut (`"camera": "parada"`, `"transicao": "corte"`).
- **answer with an image:** the card brings an image with the caption below it, never on top.

## Script ideas that fit
[Each objection becomes a character](../no-template.md#ideas), [Reply to a comment](../no-template.md#ideas),
[The counter question](../no-template.md#ideas), [Journey through what gets typed](../no-template.md#ideas).

## How to render
`$SKILL/templates/chat-bubbles/TEMPLATE.md`. Format examples: `example.json` (column layout in a chat window, camera
that follows, the delivery in a file card, push) and `example-split.json` (split layout, guided zoom, the delivery in a
list with chips that opens in the panel, mask).
