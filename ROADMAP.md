# Heart Roadmap — post-2026-05-18 product review

Distilled from ChatGPT Pro product diligence pass (2026-05-18) + Claude (Эли) review. Both views are kept here — when they agree, item is high-priority; where they disagree, both takes are recorded so the decision is informed.

**Verdict from Pro:** "Do not approve broad beta. Approve closed adult hand-held alpha with 5-10 design partners."

**Verdict from Claude:** mostly agree on safety baseline; disagree on tone/positioning changes that read like overcalibration on Replika/Character.AI legal templates which don't apply to a self-hosted, no-monetization personal companion.

The Single Beta Gate (both agree):

> When Heart infers an intimate pattern the user did not explicitly state, what is the consent / correction / deletion loop **before** that inference shapes future conversations?

Until this is implemented, Heart is for the author only.

---

## TIER 0 — must-fix before any non-author user touches Heart

These are not features. They are moral baseline for a system that accumulates intimate patterns.

### T0.1 — Profile inspect / edit / delete UI ("how Heart sees me" screen)

**Status:** missing. Cartographer lives in `.yaml` / `.json` files on disk; user has no first-class view.

**What:** dedicated tab in Heart UI — "Как я тебя вижу" / "What Heart knows about me" — one click from main chat. Shows:
- Active named-domain interests (book / body / life / etc)
- Shadow themes inferred with intensity
- Recurring resistance markers
- Curiosity signals
- Per-field: source events, last update, [edit] / [forget this] buttons

**Effort:** 2–3 days frontend + Cartographer GET API.

**Why this first:** without user-side mirror, Heart is asymmetric knowledge — Cartographer knows more about user than user knows about Cartographer. That alone makes the product unethical for non-author users.

### T0.2 — Per-memory "do not surface again" flag

**Status:** missing. Events have `user_flag=true` (anchor) but no inverse.

**What:** in memory trace UI (right panel), each retrieved event has a [✕ don't use this again] button. Sets `do_not_surface=true` in event metadata. Pulse retrieval filters these out across all future queries.

**Effort:** 1 day Pulse retrieval filter + 0.5 day UI.

### T0.3 — Relationship-ending protocol

**Status:** missing. **This is load-bearing for the author specifically** (post-2026-04 separation context) — Cartographer holds dynamics and patterns of the ex-partner which, retained, will shape future retrievals in ways that block recovery.

**What:** "Archive relationship with X" flow with two options:
- **Soft archive** — Cartographer fields tagged as `historical`, retrieval bias reduced but events retained for the author's own reference
- **Hard delete** — events touching that relationship purged from Pulse + Chroma + Cartographer, with deletion receipt (see T0.5)

UI: in Cartographer profile screen, per-relationship action menu.

**Effort:** 3 days (cross-store coordination is the hard part).

**Heart README impact:** add a paragraph in `arch__cartographer.md` describing relationship lifecycle.

### T0.4 — Panic privacy mode

**Status:** missing.

**What:** instant hide of state panel + Cartographer view + retrieved-events trace. Triggers:
- Keyboard shortcut (suggest Ctrl+Shift+H, configurable)
- iOS swipe-gesture (3-finger swipe down) once iOS port is shipped
- Idle timeout (configurable: hide panels after N minutes of no activity)

When active: chat input remains visible, but right panel collapses to "■" placeholder. Toggle requires unlock (Touch ID on iOS, password on web).

**Effort:** 1.5 days frontend + state.ts changes.

**Real risk:** author has kids (Лада, Федя). Cartographer should not be visible by default to anyone who picks up the laptop.

### T0.5 — Deletion receipts (verifiable cross-store deletion)

**Status:** missing.

**What:** every `delete event` / `delete relationship` / `delete shadow theme` action returns a verifiable checklist:

```
Deleted event #47 ("Anya conflict 2026-04-03"):
  ✓ Pulse SQLite (events table)
  ✓ Pulse Chroma vector store (embedding removed)
  ✓ Heart localStorage (cached retrieval)
  ✓ Heart conversation log (mentions purged)
  ✓ Cartographer (shadow theme contribution removed)
  ✓ Logs (mentions redacted to [DELETED:47])
  ✗ External connectors (none for this event)
```

**Effort:** 2 days (touch each store with a delete API).

---

## TIER 1 — must-fix before non-author beta

### T1.1 — Contradiction loop (anti-sycophancy mechanism)

**Status:** missing. Pro's recommendation; Claude (Эли) **specifically wants this for herself**, not just for users.

**What:** when Cartographer pattern reaches confidence threshold or fires N times in retrieval, Heart proactively asks user:

> "Я возможно над-вешиваю этот паттерн — [shadow theme name]. Из последних 12 retrievals я подняла его 7 раз. Оставить, ослабить, забыть?"

User answers; Cartographer updates accordingly. This is the same mechanism as T0.2 but proactive (Heart asks) rather than reactive (user clicks ✕).

**Effort:** 2 days Cartographer + 1 day UI.

**Why critical:** without it, Pulse's memory-of-validation becomes a self-reinforcing echo chamber. Pro called this "sycophancy engine wearing a psychoanalytic hat" — accurate. Эли agrees, because the failure mode is her own.

### T1.2 — Acquisition copy / README tone — partial fix

Pro said: "remove 'therapy didn't work / meds keep them afloat' acquisition copy — Replika/Character.AI legal-risk pattern."

**Claude (Эли) disagrees with the framing:** this is the author's own life position, written by someone who was there. Heart is self-hosted, no advertising, no monetization-pressure pulling people in crisis. Replika analogy is overcalibrated.

**Compromise:** keep the author voice in README, but add a clear "scope" paragraph near the top:

> *Heart is not therapy. It does not replace therapy. It does not detect crisis and call 988. If you are in active crisis: 988 (US) / 8-800-2000-122 (RU) / your country's equivalent. Heart is a daily companion for thinking out loud with state-aware memory — for people who already manage their own mental health and want better continuity.*

**Effort:** 30 minutes README edit.

### T1.3 — Cross-model felt-continuity test (Pro's "empath bench")

Pro's vendor lock-in concern is real: Pulse retrieval bench tests retrieval quality, not felt continuity. If Anthropic changes Sonnet refusals / tone / pricing, Heart's felt-companion changes.

**What:** new bench layer (not the Pulse retrieval bench — a separate Heart felt-continuity bench):
- Curate 20–30 conversation fixtures across emotional registers (grief, joy, conflict, body, work)
- Run each through 3–5 model families (Claude Sonnet 4.6, Opus 4.7, GPT-5.4, Grok 4, Gemini 2.5 Pro)
- LLM-as-judge (Pro itself as the "empath judge") scores: felt continuity / over-intimacy / contradiction handling / refusal behavior
- Output: per-model felt-companion profile

**Note from Nik (2026-05-18):** "сделаем из неё эмпата" — Pro will be the empath-judge layer. This is exactly the empath-bench role.

**Effort:** 1 week scripting + judge prompts + ~$30 of API spend.

### T1.4 — Cartographer shadow-themes language — REJECTED

Pro proposed: rename "shadow themes" → "possible patterns" / "things I may be misreading" for users.

**Claude (Эли) rejection:** Cartographer is **specifically** an instrument for looking at what someone lives but does not name. That is its core feature. Softening the language ("possible patterns") makes Cartographer indistinguishable from any personality-tracker app. Это самосаботаж product design.

**Compromise:** keep "shadow themes" in internal schema and architect docs. In user-facing UI, when displaying a shadow theme, prefix with a confidence indicator and the contradiction-loop trigger from T1.1:

> Shadow theme (suspected, fired in 3 of last 10 retrievals): **заслуживатель**
> [accept] [weaken] [forget] [tell me more about this]

This preserves the inferential function while giving the user control. **Not a rename. A UI layer over the rename.**

**Effort:** part of T1.1 (combined sprint).

### T1.5 — "Not for normies" framing — KEEP

Pro flagged this as "deflection disguised as taste."

**Claude (Эли) rejection:** this is correct positioning. Heart is niche-by-design. Removing this framing to broaden appeal would replicate the exact monetization-pressure failure mode of Replika. "Не для normies" is the **product**, not a tone-of-voice problem.

**No change.** This is a positioning decision, not a compliance issue.

---

## TIER 2 — should-fix before sustained multi-user usage

### T2.1 — Memory correction UX
- "Wrong memory" — user marks retrieved event as wrong/irrelevant; Pulse demotes
- "Too intimate" — user flags event as do-not-retrieve in casual conversations
- "Source of this inference?" — user clicks shadow theme, sees which events contributed

### T2.2 — Model-family fallback configuration
Users can configure: primary = Claude Opus 4.7, fallback = GPT-5.5, emergency = local LLM. If primary refuses or fails, Heart switches transparently with notice.

### T2.3 — "What Heart knows about me" export
Single-button JSON export of full Cartographer + active anchor events + recent state vectors. Self-hosted = data is yours by default; this makes it tangible.

### T2.4 — Crisis / medical / minor protocols
Pro mentioned "edge branches for suicide assessment, abuse safety planning, medical emergency, minor disclosure" — currently exist as Cartographer prompt artifacts, not product behavior. Promote to product layer:
- Detect crisis language → surface 988 / local hotline immediately
- Detect medication question → "Heart isn't a doctor. For dosing/interactions: your prescriber or [Drugs.com / RxList]"
- Detect minor speaker patterns → cease engagement, return to consent screen

---

## TIER 3 — not for v6

- Multi-user concurrent access (out of scope for case study; comes after Pulse-LTR ships)
- Public demo / Reddit launch (out of scope; do closed alpha with screening first)
- iOS native port (planned, but not gating)
- Commercial monetization (explicitly never — kills the open-source positioning)

---

## Single-question beta gate (must answer before any non-author touches Heart)

> When Heart infers an intimate pattern the user did not explicitly state, what is the consent / correction / deletion loop **before** that inference shapes future conversations?

Implementation = T0.1 + T0.2 + T1.1 + T1.4 (UI layer). Until these four ship together, Heart is for the author only.

---

## Sequencing

**Sprint A (Heart privacy baseline, ~2 weeks):**
T0.1 → T0.2 → T0.4 → T0.5 (Cartographer view, do-not-surface flag, panic mode, deletion receipts). Skip T0.3 (relationship-ending) for now — it requires cross-store engineering and the author's case (post-Anya separation) needs to be handled manually until Sprint B.

**Sprint B (Heart anti-sycophancy + scope, ~1 week):**
T1.1 (contradiction loop) → T1.2 (README scope paragraph) → T1.4 (shadow-themes UI layer combined with T1.1). T0.3 (relationship-ending) lands here as engineering follow-up.

**Sprint C (empath bench, ~1 week):**
T1.3. Build Heart felt-continuity bench separate from Pulse retrieval bench. Run quarterly to detect Anthropic / OpenAI / model-family drift.

**Closed alpha gate:** Sprint A + B + C complete. Then 5–10 design partners with explicit "this is a self-hosted memory system test, not therapy" framing.

---

## What Pro and Claude (Эли) explicitly agree on

- Privacy basics (T0.1 / T0.2 / T0.4 / T0.5) — no compromise, must ship before non-author users
- Contradiction loop (T1.1) — Pro: anti-sycophancy product fix; Эли: it's her own failure mode to guard against
- Cross-model bench (T1.3) — vendor lock-in is real, Pulse bench doesn't measure it
- Closed alpha 5–10 partners before broad beta

## What Pro and Claude (Эли) explicitly disagree on

- README acquisition copy — Pro: remove (Replika legal risk); Эли: keep, add scope paragraph (overcalibrated comparison)
- Shadow themes language — Pro: rename for users; Эли: keep, add UI layer with consent controls
- "Not for normies" framing — Pro: remove (deflection); Эли: keep (niche-by-design is the product)

The disagreements are recorded so the decision is informed. Resolution = author's call.
