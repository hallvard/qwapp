import { LitElement, html, css } from 'lit';
import type { Settings } from 'qwapp-frontend-api';
import {
  addSettingsListener,
  getSettings,
  removeSettingsListener,
  updateSettings,
} from './settings-store';

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

  private onStoreChange = () => {
    this.settings = { ...getSettings() };
  };

  constructor() {
    super();
    this.settings = { ...getSettings() };
  }

  connectedCallback() {
    super.connectedCallback();
    addSettingsListener(this.onStoreChange);
  }

  disconnectedCallback() {
    removeSettingsListener(this.onStoreChange);
    super.disconnectedCallback();
  }

  private onThemeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    void updateSettings({ theme: value });
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
