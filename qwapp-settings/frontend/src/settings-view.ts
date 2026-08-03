import { LitElement, html, css } from 'lit';
import type { SettingsStore, Settings } from 'qwapp-frontend-api';

export class SettingsView extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 1rem;
    }
    dt {
      font-weight: bold;
    }
  `;

  static properties = {
    settings: { state: true },
  };

  declare settings: Settings;

  private store: SettingsStore = window.qwappSettingsStore;

  private onStoreChange = () => {
    this.settings = { ...this.store.get() };
  };

  constructor() {
    super();
    this.settings = { ...this.store.get() };
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener('change', this.onStoreChange);
  }

  disconnectedCallback() {
    this.store.removeEventListener('change', this.onStoreChange);
    super.disconnectedCallback();
  }

  private onThemeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.store.update({ theme: value });
  }

  render() {
    return html`
      <h2>Settings</h2>
      <dl>
        ${Object.entries(this.settings).map(
          ([key, value]) => html`<dt>${key}</dt>
            <dd>${value}</dd>`
        )}
      </dl>
      <label>
        Theme
        <select @change=${(e: Event) => this.onThemeChange(e)}>
          <option value="light" ?selected=${this.settings.theme === 'light'}>Light</option>
          <option value="dark" ?selected=${this.settings.theme === 'dark'}>Dark</option>
        </select>
      </label>
    `;
  }
}

customElements.define('settings-view', SettingsView);
