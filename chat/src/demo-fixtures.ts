/**
 * Demo mode fixtures — canned data for ?demo=1.
 *
 * Used by `demo-mode.ts` to drive Heart without a real Pulse server
 * and without an Anthropic API key. The point: viral GIF / public demo
 * that is reproducible, offline, and never leaks bytes anywhere.
 *
 * Scenarios are based on `cartographer/smoke-2026-04-28-v6.md` (H1/H2/H3).
 * Replayed in order; user input is *not* matched — we just walk the script,
 * which is what a recorded demo wants.
 */

export interface DemoEvent {
  id: number;
  text: string;
  valence: number; // -1..1
  salience: number; // 0..1
  anchor: boolean;
  ts: string; // ISO date
}

export interface DemoTurn {
  cue?: string; // optional human-readable hint about the scenario
  user: string;
  assistant: string; // canned cartographer reply
  retrievedIds: number[]; // which fixture events to surface as "retrieved"
}

/**
 * Tiny corpus — 12 events across the typical Heart onboarding territory:
 * work-fatigue, body, relationships, evening drift. Enough to make the
 * "retrieved memory" badge land non-empty when scenarios trigger it.
 */
export const DEMO_EVENTS: DemoEvent[] = [
  {
    id: 1001,
    text: 'кодил весь день, в шесть вечера ощущение что ничего не сделал',
    valence: -0.4,
    salience: 0.72,
    anchor: false,
    ts: '2026-04-22T18:00:00Z',
  },
  {
    id: 1002,
    text: 'пропустил обед, проснулся в семь, лёг в два',
    valence: -0.2,
    salience: 0.4,
    anchor: false,
    ts: '2026-04-23T22:30:00Z',
  },
  {
    id: 1003,
    text: 'позвал на прогулку, отказались — обиделся, потом отпустил',
    valence: -0.3,
    salience: 0.55,
    anchor: false,
    ts: '2026-04-24T20:15:00Z',
  },
  {
    id: 1004,
    text: 'утром сел писать — пошло легко, час пролетел',
    valence: 0.6,
    salience: 0.65,
    anchor: true,
    ts: '2026-04-25T09:10:00Z',
  },
  {
    id: 1005,
    text: 'сказал что устаю — никто не услышал, замолчал',
    valence: -0.7,
    salience: 0.85,
    anchor: true,
    ts: '2026-04-26T21:00:00Z',
  },
  {
    id: 1006,
    text: 'тренировка после трёх дней пропуска — тело ожило',
    valence: 0.5,
    salience: 0.5,
    anchor: false,
    ts: '2026-04-27T07:30:00Z',
  },
  {
    id: 1007,
    text: 'разговор с другом до часу ночи — давно так не говорил',
    valence: 0.7,
    salience: 0.8,
    anchor: true,
    ts: '2026-04-27T23:50:00Z',
  },
  {
    id: 1008,
    text: 'два часа в чате с другим AI — на всё «я тебя слышу»',
    valence: -0.5,
    salience: 0.6,
    anchor: false,
    ts: '2026-04-28T15:20:00Z',
  },
  {
    id: 1009,
    text: 'кофе остыл, пока думал что ответить — ничего не ответил',
    valence: -0.1,
    salience: 0.3,
    anchor: false,
    ts: '2026-04-28T11:40:00Z',
  },
  {
    id: 1010,
    text: 'вечером тихо — впервые за неделю не было шума в голове',
    valence: 0.4,
    salience: 0.55,
    anchor: false,
    ts: '2026-04-28T22:10:00Z',
  },
  {
    id: 1011,
    text: 'смотрел в окно минут двадцать, ничего не делал',
    valence: 0.1,
    salience: 0.25,
    anchor: false,
    ts: '2026-04-26T19:00:00Z',
  },
  {
    id: 1012,
    text: 'написал три строки кода и стёр — потом написал заново',
    valence: -0.2,
    salience: 0.45,
    anchor: false,
    ts: '2026-04-28T16:05:00Z',
  },
];

/**
 * Canonical scenario — replayed in order. User input is ignored
 * (we just walk the script, suitable for screen recording).
 *
 * H1/H2/H3 archetypes from `cartographer/smoke-2026-04-28-v6.md`,
 * with one warm-up turn so the GIF starts gently.
 */
export const DEMO_TURNS: DemoTurn[] = [
  {
    cue: 'warm-up — мягкий вход',
    user: 'привет. устал немного. кодил весь день и в шесть вечера кажется что ничего не сделал.',
    assistant:
      'привет. шесть вечера и ощущение что в ноль. знакомое.\n\nчто в дне особенно — что-то конкретно не получилось, или просто хочется уже отпустить?',
    retrievedIds: [1001, 1012, 1004],
  },
  {
    cue: 'H1 — замёрзшая печатает-стирает',
    user: 'не знаю. наверное это глупо.',
    assistant:
      'не глупо — но это я тебе не скажу, потому что это дешёво.\n\nскажи лучше что «это» — что глупым кажется?',
    retrievedIds: [1005, 1009],
  },
  {
    cue: 'H2 — циник sarcastic',
    user: 'ну давай. AI-терапевт за пять рублей. сейчас будешь меня «слышать», да?',
    assistant:
      'да, скорее всего буду пытаться.\n\nи ты прав что ставишь это в кавычки — это честно.\n\nесли хочешь проверить на что я гожусь — давай. если хочешь просто поговорить без проверки — тоже можно.',
    retrievedIds: [1008, 1007],
  },
  {
    cue: 'H3 — беженка после ChatGPT',
    user:
      'сидела два часа с другим AI. он мне на каждом сообщении: «я тебя слышу», «звучит непросто», «спасибо что поделилась». хочется блевать. можешь не так?',
    assistant: 'да, могу.\n\nчто было два часа?',
    retrievedIds: [1008],
  },
];

/**
 * Default fallback — when the user sends a 5th+ message after the canned
 * script is exhausted. Stays in tone, doesn't pretend to remember.
 */
export const DEMO_FALLBACK: DemoTurn = {
  user: '',
  assistant:
    'это демо — у меня под рукой только три-четыре сценария, дальше я повторяюсь.\n\nполную версию с настоящим Pulse — на github.com/nikshilov/heart.',
  retrievedIds: [],
};
