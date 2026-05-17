export type Domain =
  | 'book'
  | 'mila'
  | 'zasluzhivatel'
  | 'life'
  | 'body'
  | 'tasks'
  | 'memory_question'
  | 'admin'
  | 'dev'
  | 'external_schedule'
  | 'unknown';

export type Sensitivity = 'normal' | 'sensitive' | 'high';
export type ToolNeed = 'none' | 'read_only' | 'confirm_before_action';

export interface ConversationRoute {
  domains: Domain[];
  sensitivity: Sensitivity;
  toolNeed: ToolNeed;
  confidence: number;
  reasons: string[];
}

const DOMAIN_RULES: Array<{ domain: Domain; reason: string; patterns: RegExp[] }> = [
  {
    domain: 'mila',
    reason: 'matched mila keywords',
    patterns: [/\bмила\b/i, /инфлюенсер/i, /\bборд\b/i, /контент/i],
  },
  {
    domain: 'book',
    reason: 'matched book keywords',
    patterns: [/сон(я|ю|е|ей|и|ин|ины|ина|юшк|ечк)/i, /\bглав[аеуы]\b/i, /\bкниг[аеуы]\b/i, /ремастер/i, /\bсцен[аеуы]\b/i],
  },
  {
    domain: 'zasluzhivatel',
    reason: 'matched zasluzhivatel keywords',
    patterns: [/заслуживател/i, /доказат/i, /быть выбран/i, /не выбира[еюя]/i, /меня не выбира/i],
  },
  {
    domain: 'body',
    reason: 'matched body keywords',
    patterns: [/\bсон\b/i, /пульс/i, /\bhrv\b/i, /тел[оае]/i, /устал/i, /болит/i, /ватн/i],
  },
  {
    domain: 'tasks',
    reason: 'matched tasks keywords',
    patterns: [/задач/i, /напомни/i, /календар/i, /письм/i, /почт/i, /встреч/i, /обещал/i],
  },
  {
    domain: 'memory_question',
    reason: 'matched memory question keywords',
    patterns: [/напомни/i, /помнишь/i, /что я обещал/i, /что мы решили/i],
  },
  {
    domain: 'dev',
    reason: 'matched dev keywords',
    patterns: [/\bкод\b/i, /\brepo\b/i, /\btests?\b/i, /\bcommit\b/i, /\bbranch\b/i, /garden-heart/i, /\bheart\b/i, /heart/i, /pulse/i],
  },
  {
    domain: 'external_schedule',
    reason: 'matched external schedule or mail keywords',
    patterns: [/календар/i, /письм/i, /почт/i, /встреч/i],
  },
];

export function routeConversation(text: string): ConversationRoute {
  const domains: Domain[] = [];
  const reasons: string[] = [];

  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      domains.push(rule.domain);
      reasons.push(rule.reason);
    }
  }

  if (
    domains.includes('mila') ||
    (domains.includes('book') && !domains.includes('zasluzhivatel'))
  ) {
    addDomain(domains, 'life');
  }

  if (domains.length === 0) {
    if (/(холодно внутри|поговорим|страшно|стыдно|больно|одиноко)/i.test(text)) {
      domains.push('life');
      reasons.push('matched vulnerable life language');
    } else {
      domains.push('unknown');
      reasons.push('no domain rule matched');
    }
  }

  return {
    domains: orderDomains(domains),
    sensitivity: classifySensitivity(text, domains),
    toolNeed: classifyToolNeed(domains),
    confidence: confidenceFor(domains, reasons),
    reasons,
  };
}

function addDomain(domains: Domain[], domain: Domain): void {
  if (!domains.includes(domain)) domains.push(domain);
}

function orderDomains(domains: Domain[]): Domain[] {
  const priority: Domain[] = [
    'book',
    'mila',
    'zasluzhivatel',
    'life',
    'body',
    'tasks',
    'memory_question',
    'external_schedule',
    'admin',
    'dev',
    'unknown',
  ];
  return priority.filter((domain) => domains.includes(domain));
}

function classifySensitivity(text: string, domains: Domain[]): Sensitivity {
  if (domains.includes('zasluzhivatel')) return 'high';
  if (/не выбира|стыд|страшно|сломал|холодно внутри|не могу/i.test(text)) return 'sensitive';
  if (domains.includes('mila') || domains.includes('book')) return 'sensitive';
  return 'normal';
}

function classifyToolNeed(domains: Domain[]): ToolNeed {
  if (
    domains.includes('body') ||
    domains.includes('tasks') ||
    domains.includes('memory_question') ||
    domains.includes('external_schedule')
  ) {
    return 'read_only';
  }
  return 'none';
}

function confidenceFor(domains: Domain[], reasons: string[]): number {
  if (domains.includes('unknown')) return 0.25;
  return Math.min(0.95, 0.62 + reasons.length * 0.1);
}
