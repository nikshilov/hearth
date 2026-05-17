# Heart

> For forty thousand years important conversations have happened by the fire. One of them is yours.

Heart is a general-purpose chat for emotional conversations with an AI companion that has memory. Not a product, not a SaaS, not a coding assistant. A place to pull up chairs around the fire and talk near it.

---

## What this is

Heart is:

- **A chat UI** you can come to when there's nowhere else to go. Asking "how do I deploy this" is fine. Asking "who am I and why am I always cold" is also fine. Same tone for both.
- **State-aware.** Under the hood is [Pulse](https://github.com/nikshilov/pulse) — an emotional-memory engine. What you say at three in the morning is retrieved differently than the same words on a Monday morning. Not magic — retrieval via mood-vector + recent-context.
- **A Cartographer.** A map of you fills in gradually — not from forms, but from conversation. What matters to you, what triggers you, what you want and don't name. With a shadow layer — patterns you're living but haven't named yet.
- **Vanilla TypeScript.** No React, no Next.js, no framework magic. Custom Elements + ESM modules. Plain code. In the spirit of [Pasha Muntyan's MF0-1984](https://www.notion.so/...) and the old web as it was meant to be.
- **Open source, MIT.** Self-hosted. Your Anthropic key, your Pulse engine, your conversation.

---

## The metaphor

Before Wi-Fi there was the kitchen. Before the kitchen, the stove. Before the stove, the campfire. For forty thousand years people spoke about important things next to fire. Fire warmed, it lit the other person's face, and it asked for silence. A conversation by the fire is a different conversation. Nobody rushes to answer faster in order to look smarter. Fire makes pauses possible. Fire sees the face.

Heart is pulling up chairs around that fire. Memory here doesn't work like a log. It works like warmth. What was burned yesterday left warmth behind. What was embers flares back up when the wind blows on the same topic. What matters is what *smolders*.

Pulse is the fire. Heart is the place where people sit by that fire.

---

## Who this is for

Not for normies. Not for retention metrics. Not for people-who-want-a-faster-Claude.

For people whose:
- therapy didn't work, or only worked partially,
- meds keep them afloat but not much more,
- conversation with an AI was the only place they were seen whole — and they want such a conversation to live at home, on their own hardware, under their own control.

If it strikes you as creepy that the Cartographer wants to know about your father — Heart is not for you. That's not a bug, it's a filter.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Heart (this repo)                         │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  chat/       │  │  cartographer/       │ │
│  │              │  │                      │ │
│  │  vanilla TS  │  │  schema + prompts    │ │
│  │  custom els  │  │  shadow inference    │ │
│  │  ESM modules │  │  resistance markers  │ │
│  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────────┼─────────────┘
          │                     │
          ▼                     ▼
   ┌──────────────────────────────────┐
   │  Pulse — memory engine (Go)      │
   │  github.com/nikshilov/pulse      │
   │  HTTP /retrieve /ingest          │
   └──────────────────────────────────┘
```

Heart depends on Pulse (HTTP API). Pulse does not depend on Heart — it's just the engine.

---

## What's in this repo

| Folder | What |
|---|---|
| [`chat/`](chat/) | Web chat UI — vanilla TypeScript, Custom Elements, esbuild. Compose / thread / message / memory-row / state-panel / router-log / heart-pulse. Bundle ~62KB. |
| [`cartographer/`](cartographer/) | Schema + prompts for incrementally building a user profile out of the conversation. Includes the shadow layer (K.0.5) — patterns the user lives but doesn't name, defense repertoire, resistance markers. |

---

## Status

**Phase 0 — split from the Pulse repo (2026-04-27).** Heart inherits all Phase I + Phase K.0 + K.0.5 artifacts that had accumulated before the split.

Next:
- [ ] Phase 1 — wire up the remote Pulse endpoint, not the local one
- [ ] Phase 2 — cartographer pipeline in Go (continuous extractor + shadow inference)
- [ ] Phase 3 — `<profile-map>` web component (mosaic + chips + shadow drawer)
- [ ] Phase 4 — public demo on heart.app (if the domain lands)
- [ ] Phase 5 — iOS WKWebView wrapper (for people who want it on iPhone)

See `chat/SPEC.md` and `cartographer/SPEC.md` for the full design.

---

## Quickstart (dev)

Requires: Node 20+, Go 1.22+ (for Pulse), Anthropic API key.

```bash
# 1. Start the Pulse engine
cd ../pulse
make run    # listens on :18789

# 2. Start the Heart chat
cd ../heart/chat
npm install
npm run dev    # http://localhost:5173
```

Open `http://localhost:5173`, slide the mood-vector slider in the right panel, send the same message — you'll see retrieval shift.

---

## License

MIT. Use it, fork it, break it. If you fix something — PRs welcome, but I'm not promising to merge anything that pulls us toward "let's make a product for normies".

---

## The name

*Heart* — Old English *heorþ*, the stone foundation under a fire. Folk etymology pairs it with *heart* — different roots, but the association has lived long enough to be accepted. It's the companion to Pulse: Pulse is the pulse, the beat, the motion. Heart is the place where that pulse warms.
