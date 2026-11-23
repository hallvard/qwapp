import { LitElement, html, css } from 'lit';

interface Setting {
  key: string;
  value: string;
}

/** A single setting, identified by its key. Maps the id to data through the backend. */
export class SettingView extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }
  `;

  static properties = {
    settingKey: { attribute: false },
    setting: { state: true },
    error: { state: true },
  };

  declare settingKey: string;
  declare setting?: Setting;
  declare error?: string;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('settingKey')) {
      void this.load();
    }
  }

  private async load() {
    this.setting = undefined;
    this.error = undefined;
    const response = await fetch(`/api/settings/${encodeURIComponent(this.settingKey)}`);
    if (response.ok) {
      this.setting = (await response.json()) as Setting;
    } else {
      this.error = `No setting ${this.settingKey}`;
    }
  }

  render() {
    return html`
      <h2>Setting ${this.settingKey}</h2>
      ${this.error ? html`<p>${this.error}</p>` : ''}
      ${this.setting ? html`<p>${this.setting.key} = <strong>${this.setting.value}</strong></p>` : ''}
    `;
  }
}

customElements.define('setting-view', SettingView);
