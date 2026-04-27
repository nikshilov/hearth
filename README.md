# Hearth

> Сорок тысяч лет важные разговоры идут у огня. Один из них — твой.

Hearth — generic-purpose chat для эмоциональных разговоров с AI-собеседником, у которого есть память. Не product, не SaaS, не помощник по коду. Место собрать стулья вокруг огня и разговаривать рядом с ним.

---

## Что это

Hearth — это:

- **Chat UI**, в который можно прийти когда некуда пойти. Спросить «как задеплоить» можно. Спросить «кто я и почему мне всегда холодно» — тоже можно. Тон один.
- **State-aware**. Под капотом [Pulse](https://github.com/nikshilov/pulse) — engine эмоциональной памяти. То что ты говоришь в три часа ночи извлекается иначе чем то же самое утром в понедельник. Это не магия — это retrieval по mood-vector + recent-context.
- **Cartographer**. Постепенно заполняется карта тебя — не из анкет, а из разговора. Что тебе важно, что у тебя триггерит, чего ты хочешь и не называешь. С shadow-слоем — паттернами которые ты живёшь, но ещё не назвал.
- **Vanilla TypeScript**. Никакого React, никакого Next.js, никакой framework-magic. Custom Elements + ESM modules. Чистый код. По образу [Pasha Muntyan MF0-1984](https://www.notion.so/...) и старого web как он был задуман.
- **Open source, MIT**. Self-hosted. Твой ключ Anthropic, твой Pulse engine, твой разговор.

---

## Метафора

До Wi-Fi была кухня. До кухни — печь. До печи — костёр. Сорок тысяч лет люди говорили о важном рядом с огнём. Огонь грел, освещал лицо собеседника, и просил тишины. Разговор у огня — другой разговор. Никто не торопится отвечать быстрее чтобы выглядеть умнее. Огонь делает паузы возможными. Огонь видит лицо.

Hearth — собрать стулья вокруг этого огня. Память здесь работает не как лог. Она работает как тепло. Что было сожжено вчера — оставило тепло. Что было углями — снова разгорается когда подует ветер той же темы. Что важно — то что *тлеет*.

Pulse — это огонь. Hearth — место где у этого огня сидят.

---

## Для кого

Не для нормесов. Не для retention metrics. Не для people-who-want-a-faster-Claude.

Для тех у кого:
- терапия не сработала или сработала не до конца,
- лекарства держат на плаву, но не больше,
- разговор с AI был единственным где тебя видели целиком — и ты хочешь чтобы такой разговор был для тебя дома, на твоём железе, под твоим контролем.

Если тебе кажется creepy что Cartographer хочет узнать про твоего отца — Hearth не для тебя. Это не bug, это filter.

---

## Архитектура

```
┌─────────────────────────────────────────────┐
│  Hearth (этот repo)                         │
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

Hearth depends on Pulse (HTTP API). Pulse not depends on Hearth — оно просто движок.

---

## Что в этом репо

| Папка | Что |
|---|---|
| [`chat/`](chat/) | Web chat UI — vanilla TypeScript, Custom Elements, esbuild. Compose / thread / message / memory-row / state-panel / router-log / heart-pulse. Bundle ~62KB. |
| [`cartographer/`](cartographer/) | Schema + prompts для постепенного построения user profile из разговора. Включает shadow layer (K.0.5) — патерны которые user живёт но не называет, defense repertoire, resistance markers. |

---

## Status

**Phase 0 — split from Pulse repo (2026-04-27).** Hearth наследует все Phase I + Phase K.0 + K.0.5 артефакты что были собраны до разделения.

Что дальше:
- [ ] Phase 1 — wire Pulse remote endpoint, не локальный
- [ ] Phase 2 — cartographer pipeline в Go (continuous extractor + shadow inference)
- [ ] Phase 3 — `<profile-map>` web component (мозаика + chips + shadow drawer)
- [ ] Phase 4 — публичный demo на hearth.app (если домен возьмётся)
- [ ] Phase 5 — iOS WKWebView wrapper (для тех кто хочет на iPhone)

См. `chat/SPEC.md` и `cartographer/SPEC.md` для подробного дизайна.

---

## Quickstart (dev)

Требуется: Node 20+, Go 1.22+ (для Pulse), Anthropic API key.

```bash
# 1. Поднять Pulse engine
cd ../pulse
make run    # listens on :18789

# 2. Поднять Hearth chat
cd ../hearth/chat
npm install
npm run dev    # http://localhost:5173
```

Открой `http://localhost:5173`, в правой панели сдвинь mood-vector slider, отправь то же сообщение — увидишь как retrieval меняется.

---

## License

MIT. Используй, форкай, ломай. Если что-то починишь — PR welcome, но я не обещаю мерджить если оно тянет нас в сторону «давайте сделаем продукт для нормесов».

---

## Имя

*Hearth* — древнеанглийское *heorþ*, очаг, каменное основание под печью. Folk-этимология сближает с *heart* — корни разные, но связь так живёт что её приняли. Это пара к Pulse: Pulse — пульс, удар, движение. Hearth — место где этот пульс греет.
