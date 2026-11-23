import { LitElement, html } from 'lit';
import type { ViewManager } from '@hallvard/qwapp-api';
import { formatCount, formatDate, formatParameters, loadFamily, modelViewId } from './api';
import type { FamilyModels } from './api';
import { viewStyles } from './styles';

/** The models of one family; choosing one opens its view. */
export class LlmFamilyView extends LitElement {
  static styles = viewStyles;

  static properties = {
    familyName: { attribute: false },
    family: { state: true },
    error: { state: true },
  };

  declare familyName: string;
  declare family?: FamilyModels;
  declare error?: string;
  /** Set by the module's view factory. */
  viewManager?: ViewManager;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('familyName')) {
      void this.load();
    }
  }

  private async load() {
    this.family = undefined;
    this.error = undefined;
    try {
      this.family = await loadFamily(this.familyName);
    } catch (error) {
      this.error = (error as Error).message;
    }
  }

  private open(event: Event, variant: string) {
    event.preventDefault();
    this.viewManager?.open('llm-model', modelViewId(this.familyName, variant));
  }

  render() {
    return html`
      <h2>${this.family?.label ?? this.familyName}</h2>
      ${this.error ? html`<p class="error">${this.error}</p>` : ''}
      ${this.family
        ? html`
            <p>${this.family.models.length} text generation models by ${this.family.author}, most downloaded first.</p>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th class="number">Parameters</th>
                  <th class="number">Downloads</th>
                  <th class="number">Likes</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                ${this.family.models.map(
                  (model) => html`<tr>
                    <td><a href="#" @click=${(e: Event) => this.open(e, model.variant)}>${model.variant}</a>${model.gated ? ' 🔒' : ''}</td>
                    <td class="number">${formatParameters(model.parameters)}</td>
                    <td class="number">${formatCount(model.downloads)}</td>
                    <td class="number">${formatCount(model.likes)}</td>
                    <td>${formatDate(model.lastModified)}</td>
                  </tr>`
                )}
              </tbody>
            </table>
          `
        : this.error
          ? ''
          : html`<p>Loading…</p>`}
    `;
  }
}

customElements.define('llm-family-view', LlmFamilyView);
