# Hearth Runtime Surface Audit

Цель Hearth — один разговорный слой поверх Pulse, где пользователь пишет естественно, а система сама выбирает память, профиль и безопасные read-only источники контекста. Этот документ фиксирует, что переносить из OpenClawWorkspace в garden-heart runtime, а что держать вне дефолтной поверхности.

## Core runtime

| Surface | Назначение | Policy |
|---|---|---|
| Pulse | Главный memory substrate: recall, ingest, state-aware retrieval | Silent by default. Secrets only через env/local secret store, не в committed config |
| Cartographer profile | Hidden steering: карта пользователя, curiosity, resistance markers | Inject selected fields only. Shadow material never disclosed automatically |
| Health summary | Body/state grounding: сон, HRV, пульс, усталость | Read-only. Pull only on body/state prompts or strong state signal |
| Conversation router | Domain classification: book, Mila, Zasluzhivatel, life, body, tasks, memory, dev | Always local. Never exposed as user-visible agent switching |
| Tool policy | Gate for capabilities before external reads/actions | Read-first. Writes/actions require explicit confirmation |

## Optional personal context connectors

| Surface | Use when | Policy |
|---|---|---|
| Calendar read | User asks about schedule, meetings, commitments | Read-only with task/schedule domain signal |
| Gmail read | User asks about mail, sent promises, external commitments | Read-only with explicit or high-confidence domain signal |
| Notion search | Research/project notes, workspace docs, structured external knowledge | Optional; do not use as primary emotional memory |
| Krisp / Limitless | Meeting notes, lifelogs, transcripts | Optional and high-privacy; only when meeting/lifelog context is relevant |
| Obsidian | Book/Garden/contact notes while migration is incomplete | Prefer importing durable memory into Pulse long-term |
| Telegram | Conversation channel | Channel only; do not treat Telegram history as available memory unless explicitly ingested |

## Dev-only tools

These are useful while building Hearth but should not be part of default companion runtime:

- Playwright — UI/debug verification only.
- Mobile MCP — simulator/device testing only.
- Superpowers coding workflow skills — development process only.
- `frontend-design`, `claude-api`, `review`, `security-review` — development only.
- Git, tests, build commands — Claude Code workspace only.

## Disabled by default

| Surface | Why disabled |
|---|---|
| Reddit | Public write risk, policy risk, high prompt-injection/noise surface |
| Play Sheet Music | Creative utility, not core memory/context |
| Google Drive | Auth not active and no default use-case |
| Broad Auto Claude skills | Too likely to capture intent and turn conversation into process |
| Sonya prose/check skills | Powerful for chapter work, but too biasing for ordinary life conversation |

## Skills profile

### Core migration/context skills

- `chat-export`, `chat-resume` — move conversation state between sessions.
- `claude-mem:*` — temporary cross-session search/corpus tooling while Pulse coverage matures.
- `obsidian:obsidian-cli`, `obsidian:obsidian-markdown` — bridge to vault notes when explicitly relevant.
- `schedule`, `loop` — routines and heartbeat automation, not ordinary turn handling.
- `update-config` — settings/hooks/permissions management.

### Explicit creative triggers

Sonya/fiction skills should activate only when the user clearly asks for chapter/prose/book work. They should not load for generic “мне плохо”, “Мила”, “Заслуживатель” unless the turn is explicitly about the book.

## Secret handling

The OpenClawWorkspace `.mcp.json` currently contains a Pulse API key inline. Garden-heart should not copy that pattern. Use env variables, local untracked settings, Keychain/iOS bridge, or Pulse-local secret storage.

## Product rule

Hearth runtime is not a swarm. It should feel like one companion with better context selection, not a dispatcher announcing agents, skills, tools, or route decisions.
