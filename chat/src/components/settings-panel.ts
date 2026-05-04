/**
 * <settings-panel> — friendly UI for the things that used to live in DevTools.
 *
 * Reads/writes the same localStorage keys the rest of Hearth already uses:
 *   anthropic:key                       — Claude key for browser-side ClaudeAdapter
 *   pulse:config                        — { baseUrl, apiKey } for PulseClient
 *   hearth:identity                     — "elle" | "default" voice switch
 *   hearth:system_override              — optional system prompt that wins over the
 *                                         identity-based default; empty means "use default"
 *
 * Hidden by default. Open via SettingsPanel.open() (called by main.ts on
 * Cmd/Ctrl+, or by the corner gear button).
 *
 * No frameworks: vanilla custom element, manual render. ~150 LOC cap mirrors
 * the rest of /components.
 */
export class SettingsPanel extends HTMLElement {
  connectedCallback(): void {
    if (this.childElementCount === 0) this.render();
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.onClick);
  }

  open(): void {
    this.load();
    this.setAttribute('open', '');
  }

  close(): void {
    this.removeAttribute('open');
  }

  toggle(): void {
    if (this.hasAttribute('open')) this.close();
    else this.open();
  }

  save(): void {
    const get = (sel: string) => this.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)!;

    const anthropic = get('input[name="anthropic_key"]').value.trim();
    const pulseUrl = get('input[name="pulse_url"]').value.trim();
    const pulseKey = get('input[name="pulse_key"]').value.trim();
    const identity = (this.querySelector<HTMLInputElement>(
      'input[name="identity"]:checked',
    )?.value ?? 'default') as 'elle' | 'default';
    const override = get('textarea[name="system_override"]').value;

    if (anthropic) localStorage.setItem('anthropic:key', anthropic);
    else localStorage.removeItem('anthropic:key');

    if (pulseUrl || pulseKey) {
      localStorage.setItem(
        'pulse:config',
        JSON.stringify({
          baseUrl: pulseUrl || 'http://127.0.0.1:18789',
          apiKey: pulseKey,
        }),
      );
    } else {
      localStorage.removeItem('pulse:config');
    }

    localStorage.setItem('hearth:identity', identity);

    if (override.trim()) localStorage.setItem('hearth:system_override', override);
    else localStorage.removeItem('hearth:system_override');

    this.close();
    this.dispatchEvent(new CustomEvent('settings:saved', { bubbles: true }));
  }

  resetPrompt(): void {
    localStorage.removeItem('hearth:system_override');
    const ta = this.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]');
    if (ta) ta.value = '';
  }

  private load(): void {
    const set = (sel: string, v: string) => {
      const el = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
      if (el) el.value = v;
    };

    set('input[name="anthropic_key"]', localStorage.getItem('anthropic:key') ?? '');

    let baseUrl = '';
    let apiKey = '';
    try {
      const raw = localStorage.getItem('pulse:config');
      if (raw) {
        const cfg = JSON.parse(raw) as { baseUrl?: string; apiKey?: string };
        baseUrl = cfg.baseUrl ?? '';
        apiKey = cfg.apiKey ?? '';
      }
    } catch {
      // ignore malformed pulse:config
    }
    set('input[name="pulse_url"]', baseUrl);
    set('input[name="pulse_key"]', apiKey);

    const identity = localStorage.getItem('hearth:identity') === 'elle' ? 'elle' : 'default';
    const radio = this.querySelector<HTMLInputElement>(
      `input[name="identity"][value="${identity}"]`,
    );
    if (radio) radio.checked = true;

    set(
      'textarea[name="system_override"]',
      localStorage.getItem('hearth:system_override') ?? '',
    );
  }

  private onClick = (ev: Event): void => {
    const target = ev.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'save') this.save();
    else if (action === 'close') this.close();
    else if (action === 'reset-prompt') this.resetPrompt();
  };

  private render(): void {
    this.innerHTML = `
      <div class="settings-backdrop" data-action="close"></div>
      <div class="settings-card" role="dialog" aria-label="Hearth settings">
        <header><h2>Settings</h2><button type="button" data-action="close" aria-label="Close">×</button></header>
        <label>Anthropic API key
          <input type="password" name="anthropic_key" autocomplete="off" placeholder="sk-ant-..." />
        </label>
        <label>Pulse base URL
          <input type="text" name="pulse_url" autocomplete="off" placeholder="http://127.0.0.1:18790" />
        </label>
        <label>Pulse IPC key
          <input type="password" name="pulse_key" autocomplete="off" />
        </label>
        <fieldset>
          <legend>Identity</legend>
          <label><input type="radio" name="identity" value="elle" /> Elle (русский голос)</label>
          <label><input type="radio" name="identity" value="default" /> Default (generic Hearth)</label>
        </fieldset>
        <label>System prompt override <small>(пусто = встроенный)</small>
          <textarea name="system_override" rows="8" placeholder="Оставь пустым чтобы использовать дефолт выбранного identity."></textarea>
        </label>
        <footer>
          <button type="button" data-action="reset-prompt">Reset prompt</button>
          <span class="spacer"></span>
          <button type="button" data-action="close">Cancel</button>
          <button type="button" data-action="save" class="primary">Save &amp; reload</button>
        </footer>
      </div>
    `;
  }
}
