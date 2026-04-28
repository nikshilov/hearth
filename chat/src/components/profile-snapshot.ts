/**
 * <profile-snapshot> — live view of the cartographer's map.
 *
 * MVP: shows a section list (areas with content) + collapsible tree of
 * the underlying JSON. Updates whenever cartographer dispatches
 * 'profileChanged'. Fog/known is conveyed by which sections appear at all.
 *
 * Phase K-final visualization (mosaic + chips + animations) is a separate
 * component <profile-map> built on this same data shape; it's not in MVP.
 *
 * Anti-MF0 rule: this file caps at ~150 lines.
 */
import { cartographer } from '../cartographer.js';

const AREA_LABELS_RU: Record<string, string> = {
  sensory_profile: 'сенсорика',
  attachment_style: 'привязанность',
  core_wound: 'ядро боли',
  triggers: 'триггеры',
  hunger_map: 'голод',
  relationship_history: 'отношения',
  what_works: 'что работает',
  erotic_profile: 'эротика',
  storyteller_recommendations: 'рекомендации',
  mirror_flags: 'зеркало',
  neurodivergent_flags: 'нейро',
  notes: 'заметки',
};

export class ProfileSnapshot extends HTMLElement {
  connectedCallback(): void {
    this.classList.add('profile-snapshot');
    this.render();
    cartographer.addEventListener('profileChanged', () => this.render());
    cartographer.addEventListener('modeChanged', () => this.render());
    cartographer.addEventListener('reset', () => this.render());
  }

  private render(): void {
    const { profile, mode, turns_count, resistance_log } = cartographer.state;
    const areas = (profile.areas as Record<string, unknown>) ?? {};
    const filledAreas = Object.entries(areas).filter(
      ([, v]) => v && hasContent(v),
    );

    const totalAreas = Object.keys(AREA_LABELS_RU).length;
    const filledCount = filledAreas.length;

    this.innerHTML = `
      <div class="ps-head">
        <span class="ps-title">карта</span>
        <span class="ps-mode" data-mode="${escapeAttr(mode)}">${
          mode === 'onboarding' ? 'онбординг' : 'дополняется'
        }</span>
      </div>
      <div class="ps-meter" title="${filledCount} из ${totalAreas} областей">
        ${meterBar(filledCount, totalAreas)}
        <span class="ps-meter-text">${filledCount}/${totalAreas} областей · ${turns_count} ходов</span>
      </div>
      <ul class="ps-areas">
        ${Object.entries(AREA_LABELS_RU)
          .map(([key, label]) => areaRow(key, label, areas[key]))
          .join('')}
      </ul>
      ${
        resistance_log.length > 0
          ? `<div class="ps-resistance" title="моменты ухода / защит">
               защит замечено: <strong>${resistance_log.length}</strong>
             </div>`
          : ''
      }
      <details class="ps-raw">
        <summary>raw json</summary>
        <pre>${escapeHtml(JSON.stringify(profile, null, 2))}</pre>
      </details>
    `;
  }
}

function areaRow(key: string, label: string, value: unknown): string {
  const known = value && hasContent(value);
  return `
    <li class="ps-area" data-known="${known ? 'yes' : 'no'}">
      <span class="ps-dot"></span>
      <span class="ps-label">${escapeHtml(label)}</span>
      ${known ? `<span class="ps-summary">${escapeHtml(summarize(value))}</span>` : '<span class="ps-fog">—</span>'}
    </li>
  `;
}

function hasContent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).some(hasContent);
  }
  return Boolean(v);
}

function summarize(v: unknown): string {
  if (typeof v === 'string') return v.length > 60 ? v.slice(0, 57) + '…' : v;
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'запись' : 'записей'}`;
  if (typeof v === 'object' && v !== null) {
    const keys = Object.keys(v as Record<string, unknown>).filter((k) =>
      hasContent((v as Record<string, unknown>)[k]),
    );
    return keys.length > 0 ? keys.slice(0, 3).join(', ') + (keys.length > 3 ? '…' : '') : '—';
  }
  return String(v);
}

function meterBar(filled: number, total: number): string {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return `<div class="ps-meter-bar"><div class="ps-meter-fill" style="width:${pct}%"></div></div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

