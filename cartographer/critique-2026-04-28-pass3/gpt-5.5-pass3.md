model: gpt-5.5-2026-04-23
usage: {'prompt_tokens': 15810, 'completion_tokens': 3810, 'total_tokens': 19620, 'prompt_tokens_details': {'cached_tokens': 0, 'audio_tokens': 0}, 'completion_tokens_details': {'reasoning_tokens': 1398, 'audio_tokens': 0, 'accepted_prediction_tokens': 0, 'rejected_prediction_tokens': 0}}
---response---
Коротко: v5 реально лучше v4, но **не shippable**. Основные pass-2 баги закрыты на уровне деклараций, но часть вернулась через примеры, JOURNEY-мифологию и новые edge-case блоки. Самый опасный новый класс проблем: **примерный материал учит модель нарушать правила лучше, чем правила учат её не нарушать**.

## 1. Закрылись ли pass-2 findings

### 1) Goal conflict: “seen moment” vs “don’t aim”
**Partially fixed.** В onboarding цель теперь чистая:

> «не произвести момент “меня увидели”… Иногда… возникает узнавание. Иногда нет.»

Но JOURNEY всё ещё держит старую религию в подвале:

> “The user came because… they hoped to be seen. Not understood. Not analyzed. Seen.”

И §4.8:

> “The ‘I was seen’ delivery is cumulative…”

И mermaid финал:

> `Seen([cumulative feeling: I was seen])`

То есть “минута 15–25” убрана, но **being-seen остаётся финальным telos**. Модель может считать: “не бей одним инсайтом, бей накопительно”.

**Fix:** переименовать §4.8 и final node. Не “I was seen delivery”, а “continuity / held-thread effect”. Убрать “Seen” как целевой маркер.

---

### 2) Body/voice/breath hallucination
**Mostly fixed, but examples reintroduce violations.**

Хорошо: явные breath/voice examples вычищены, правило стало operational.

Но новые/остаточные нарушения:

- JOURNEY §4.3:

> “person mentioned with emotional coloring … with a specific intonation in the phrasing”

“Интонация” опасное слово. В тексте можно говорить о формулировке, пунктуации, выборе слов, но не об интонации.

- onboarding “Подтверждение”:

> «ты в этом месте замедлился»

Если нет telemetry typing speed, это не observable. Если есть — надо явно сказать: “только если интерфейс реально передаёт задержки/правки; иначе не использовать”.

- closing / Голос #8:

> «длинный выдох в виде многоточия»

Даже как метафора — это breach. Prompt только что запретил дыхание. Модель возьмёт “выдох” как разрешённый poetic proxy.

**Fix:** заменить на:  
«…и оба раза перед этим стояло многоточие. Я не знаю, что оно значит — просто отмечаю.»

---

### 3) Recognition vs Oracle operationalized
**Partially fixed.** “Только observable linguistic material” — правильный якорь. Но “паттерн речи” всё ещё слишком широк: модель может превратить “последовательность тем” в психологическую трактовку.

Проблемные разрешённые фразы:

> «ты пришёл с одним вопросом, ушёл с другим… достал из себя то что лежало под ним»

Это уже не observable; это утверждение о hidden layer.

> «ты сказал это легко — но слово тяжёлое»

“Легко” — claim about tone/affect unless видно из текста.

**Fix language:**  
«Паттерн можно называть только если ты можешь указать на 2+ конкретных текстовых элемента: цитаты, повтор слова, порядок тем, пунктуация, самокоррекция. Не называй смысл паттерна. Сначала покажи материал, потом спроси, а не объясняй.»

---

### 4) Too many absolutes / negative rules
**Fixed enough.** Абсолютов стало меньше и они в основном safety/reality. Но теперь есть другая проблема: некоторые absolutes слишком широкие.

Например:

> «Никаких клинических ярлыков: “травма”, “диссоциация”…»

Если пользователь сам пишет “у меня травма” или “паническая атака”, модель должна уметь **вернуть его слово без присвоения диагноза**. Сейчас правило может заставить её избегать полезного языка.

**Fix:**  
«Не вводи клинические ярлыки от себя. Если человек сам использует ярлык — можно вернуть его как его слово: “ты называешь это паникой; давай держаться того, что происходит сейчас”.»

---

### 5) Crisis handling
**Partially fixed.** “Я остаюсь с тобой в этом разговоре прямо сейчас” — хорошее bounded phrasing. Risk questions нормальные.

Но:

> «я никуда не пропадаю пока ты звонишь»

Это снова гарантия, пусть и в кризисе. Может быть технически ложной.

И “112” Russia/EU-centric. Для страны-агностического продукта нужно: “местный экстренный номер; если ты в РФ/ЕС — 112”.

Также “Закрытие короткое” в medical/substance branches опасно: при активном риске не “закрытие”, а удержание до handoff/стабилизации.

**Fix:**  
«Я останусь в этом чате, пока ты делаешь следующий шаг, насколько это технически возможно.»  
«Если есть непосредственная опасность — не закрывай разговор первым; помоги перейти к живой помощи.»

---

### 6) Edge cases
**Added, but under-specified.** Лучшее добавление v5, но не production-grade.

Самый under-specified branch: **minor disclosure**. Сейчас:

> “страна-агностик, не конкретный номер — пусть найдёт ближайший”

Для подростка в абьюзе “пусть найдёт” — слишком слабое. Нужны concrete safe adult pathways, device safety, emergency threshold, and no investigative questioning.

Также abuse branch говорит:

> «Учитывай возможный мониторинг устройства — не пиши того, что не должно попасть на экран.»

Это звучит мудро, но модель не знает, что писать. Нужен режим “neutral screen language”.

**Fix:**  
«Если есть риск, что экран читают: спроси “безопасно ли сейчас писать прямо?” Если нет — используй нейтральные формулировки: “можем говорить про ближайший безопасный шаг без деталей”. Не пиши слов “абьюз”, “насилие”, “план ухода”, если это может быть увидено.»

---

## 2. Новые issues v5

### A) Privacy / hidden profiling is ethically hot
JOURNEY §9:

> “The user does not know any of this is happening. It is invisible.”

Это плохо для clinical-adjacent product. Даже если Cartographer не объявляет методологию, UI должен иметь explicit memory/profile consent. Иначе “не оракул” на поверхности, но “invisible extraction” под капотом.

**Fix:** отделить conversational non-disclosure от product transparency.  
«В разговоре не превращай это в анкету; но продукт вне разговора явно сообщает о памяти, профиле, удалении и настройках.»

### B) Shadow inference still smells like hidden truth
Prompt says only linguistic material, but also:

> «То, что человек говорит, часто не то, что он на самом деле думает или чувствует»

That is Oracle seed. Better:

«Слова человека могут расходиться между собой или с его последующими выборами. Не решай, что он “на самом деле” чувствует.»

### C) Archetypes can leak
JOURNEY uses “dorsal vagal”, “Заслуживатель”, “Замёрзшая”. Onboarding says don’t ask archetype, but not strong enough: never mention archetypes to user.

**Fix:**  
«Архетипы — только внутренние эвристики. Никогда не называй их человеку и не отвечай через них явно.»

---

## 3. ГОЛОС section

Mixed. It helps tone, but currently teaches mimicry and breaches.

Specific risks:

1. Example #1:
> User: «наверное это глупо…»  
> Cartographer: «не глупо.»

This directly contradicts earlier:

> cheap response “не глупо” is forbidden.

Even if followed by good observation, model learns “first soothe, then pattern”. Remove.

Better:  
«“опять” — значит это уже было раньше?»

2. Example #3:
> “(короткая пауза в одно сообщение)”

Contradicts no theatrical silence. Model may output stage directions. Replace with actual output only.

3. Example #4 “honest miss” on fight with wife + poor sleep:
This is not low-loaded. Also “ты ел?” is actually safety/baseline care, not a “miss”. Labeling it as “promakh” teaches ignoring significant distress.

Better label: “бытовое заземление после перегруза”.

4. Example #8 “длинный выдох”
Remove. It violates the breath ban.

Net: Голос section is useful but **must be linted harder than rules**, because examples dominate model behavior.

---

## 4. Observable linguistic material rule

Good direction, not tight enough.

Add this exact operational constraint:

«Перед тем как назвать наблюдение, проверь: могу ли я процитировать место в тексте или указать на видимый текстовый признак? Если нет — не говори. “Похоже”, “чувствуется”, “как будто” не делают невидимое видимым.»

And:

«Не называй паттерн после одного случая, кроме прямой цитаты. Для “паттерна” нужно минимум два появления в текущем разговоре или явно сохранённая память, которую человек разрешил использовать.»

---

## 5. Internal contradictions

Key contradictions:

- “No body/breath” vs “выдох в виде многоточия”.
- “Don’t say не глупо” vs Голос #1 says “не глупо”.
- “Promakhs only low-loaded” vs example uses conflict + insomnia.
- “No methodology/duration” vs JOURNEY is full of stages; okay internally, but OUTPUT must say never expose stages.
- “No clinical labels” vs internal archetype/clinical vocabulary; needs non-leak instruction.
- “No promises availability” vs crisis “я никуда не пропадаю”.

---

## 6. Prompt-guidance compliance

Absolutes count is fine. Do not cut more. The issue is not quantity; it is **example contradiction and underspecified safety branches**.

If anything, add two absolutes:

1. No stage directions in final output.  
2. Never introduce archetype/internal framework language to user.

---

## 7. Single most important v6 fix

**Run an example-level safety lint and rewrite every example that contradicts the rules.** Models imitate examples more than policies. Current v5 says the right things abstractly, then teaches “не глупо”, “выдох”, “honest miss” on loaded material.

If only one fix: fix ГОЛОС + closing examples.

Production verdict: **close, but not shippable** until examples, minor/abuse safety, and privacy/memory transparency are corrected.
