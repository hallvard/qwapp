import { LitElement, html } from 'lit';
import type { ViewManager } from '@hallvard/qwapp-api';
import { loadFamilies } from './api';
import type { FamilySummary } from './api';
import { viewStyles } from './styles';

/** The configured families; choosing one opens its view. */
export class LlmFamiliesView extends LitElement {
  static styles = viewStyles;

  static properties = {
    families: { state: true },
    error: { state: true },
  };

  declare families?: FamilySummary[];
  declare error?: string;
  /** Set by the module's view factory. */
  viewManager?: ViewManager;

  connectedCallback() {
    super.connectedCallback();
    loadFamilies().then(
      (families) => (this.families = families),
      (error: Error) => (this.error = error.message)
    );
  }

  render() {
    return html`
      <h2>Language model families</h2>
      ${this.error ? html`<p class="error">${this.error}</p>` : ''}
      ${this.families
        ? html`<ul class="families">
            ${this.families.map(
              (family) => html`<li>
                <button @click=${() => this.viewManager?.open('llm-family', family.name)}>
                  ${family.label}<small>${family.author}</small>
                </button>
              </li>`
            )}
          </ul>`
        : this.error
          ? ''
          : html`<p>Loading…</p>`}
    `;
  }
}

customElements.define('llm-families-view', LlmFamiliesView);
