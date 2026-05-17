# Heart Runtime Surface Audit

Heart's goal is to be one conversational layer on top of Pulse, where the user writes naturally and the system itself picks memory, profile, and safe read-only context sources. This document records what to port from OpenClawWorkspace into the garden-heart runtime, and what to keep off the default surface.

## Core runtime

| Surface | Purpose | Policy |
|---|---|---|
| Pulse | Primary memory substrate: recall, ingest, state-aware retrieval | Silent by default. Secrets only via env / local secret store, never in committed config |
| Cartographer profile | Hidden steering: user map, curiosity, resistance markers | Inject selected fields only. Shadow material is never disclosed automatically |
| Health summary | Body/state grounding: sleep, HRV, heart rate, fatigue | Read-only. Pull only on body/state prompts or a strong state signal |
| Conversation router | Domain classification: book, Mila, Zasluzhivatel, life, body, tasks, memory, dev | Always local. Never exposed as user-visible agent switching |
| Tool policy | Gate for capabilities before external reads/actions | Read-first. Writes/actions require explicit confirmation |

## Optional personal context connectors

| Surface | Use when | Policy |
|---|---|---|
| Calendar read | User asks about schedule, meetings, commitments | Read-only with task/schedule domain signal |
| Gmail read | User asks about mail, sent promises, external commitments | Read-only with explicit or high-confidence domain signal |
| Notion search | Research / project notes, workspace docs, structured external knowledge | Optional; do not use as primary emotional memory |
| Krisp / Limitless | Meeting notes, lifelogs, transcripts | Optional and high-privacy; only when meeting / lifelog context is relevant |
| Obsidian | Book / Garden / contact notes while migration is incomplete | Prefer importing durable memory into Pulse long-term |
| Telegram | Conversation channel | Channel only; do not treat Telegram history as available memory unless explicitly ingested |

## Dev-only tools

These are useful while building Heart but should not be part of the default companion runtime:

- Playwright — UI / debug verification only.
- Mobile MCP — simulator / device testing only.
- Superpowers coding workflow skills — development process only.
- `frontend-design`, `claude-api`, `review`, `security-review` — development only.
- Git, tests, build commands — Claude Code workspace only.

## Disabled by default

| Surface | Why disabled |
|---|---|
| Reddit | Public write risk, policy risk, high prompt-injection / noise surface |
| Play Sheet Music | Creative utility, not core memory / context |
| Google Drive | Auth not active and no default use case |
| Broad Auto Claude skills | Too likely to capture intent and turn conversation into process |
| Sonya prose / check skills | Powerful for chapter work, but too biasing for ordinary life conversation |

## Skills profile

### Core migration / context skills

- `chat-export`, `chat-resume` — move conversation state between sessions.
- `claude-mem:*` — temporary cross-session search / corpus tooling while Pulse coverage matures.
- `obsidian:obsidian-cli`, `obsidian:obsidian-markdown` — bridge to vault notes when explicitly relevant.
- `schedule`, `loop` — routines and heartbeat automation, not ordinary turn handling.
- `update-config` — settings / hooks / permissions management.

### Explicit creative triggers

Sonya / fiction skills should activate only when the user clearly asks for chapter / prose / book work. They should not load for generic "I feel bad", "Mila", "Zasluzhivatel" unless the turn is explicitly about the book.

## Secret handling

The OpenClawWorkspace `.mcp.json` currently contains a Pulse API key inline. garden-heart should not copy that pattern. Use env variables, local untracked settings, Keychain / iOS bridge, or Pulse-local secret storage.

## Product rule

The Heart runtime is not a swarm. It should feel like one companion with better context selection, not a dispatcher announcing agents, skills, tools, or route decisions.
