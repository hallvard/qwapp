import { LitElement, html } from 'lit';
import type { ViewManager } from 'qwapp-frontend-api';
import { formatCount, formatDate, formatParameters, loadModel, parseModelViewId } from './api';
import type { FamilyModel } from './api';
import { viewStyles } from './styles';

/** A single model, identified by `family/variant`. Maps the id to data through the backend. */
export class LlmModelView extends LitElement {
  static styles = viewStyles;

  static properties = {
    modelId: { attribute: false },
    familyModel: { state: true },
    error: { state: true },
  };

  declare modelId: string;
  declare familyModel?: FamilyModel;
  declare error?: string;
  /** Set by the module's view factory. */
  viewManager?: ViewManager;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('modelId')) {
      void this.load();
    }
  }

  private async load() {
    this.familyModel = undefined;
    this.error = undefined;
    const { family, variant } = parseModelViewId(this.modelId);
    try {
      this.familyModel = await loadModel(family, variant);
    } catch (error) {
      this.error = (error as Error).message;
    }
  }

  private openFamily(event: Event, family: string) {
    event.preventDefault();
    this.viewManager?.open('llm-family', family);
  }

  render() {
    const { variant } = parseModelViewId(this.modelId);
    const result = this.familyModel;
    const model = result?.model;
    return html`
      <h2>${variant}</h2>
      ${this.error ? html`<p class="error">${this.error}</p>` : ''}
      ${result && model
        ? html`
            <dl>
              <dt>Family</dt>
              <dd><a href="#" @click=${(e: Event) => this.openFamily(e, result.family)}>${result.familyLabel}</a></dd>
              <dt>Id</dt>
              <dd>${model.id}</dd>
              <dt>Task</dt>
              <dd>${model.task ?? '–'}</dd>
              <dt>Parameters</dt>
              <dd>${formatParameters(model.parameters)}</dd>
              <dt>Library</dt>
              <dd>${model.library ?? '–'}</dd>
              <dt>License</dt>
              <dd>${model.license ?? '–'}</dd>
              <dt>Base model</dt>
              <dd>${model.baseModels.length > 0 ? model.baseModels.join(', ') : '–'}</dd>
              <dt>Languages</dt>
              <dd>${model.languages.length > 0 ? model.languages.join(', ') : '–'}</dd>
              <dt>Access</dt>
              <dd>${model.gated ? `gated (${model.gated} approval)` : 'open'}</dd>
              <dt>Downloads</dt>
              <dd>${formatCount(model.downloads)}</dd>
              <dt>Likes</dt>
              <dd>${formatCount(model.likes)}</dd>
              <dt>Created</dt>
              <dd>${formatDate(model.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>${formatDate(model.lastModified)}</dd>
              <dt>Files</dt>
              <dd>${model.files.length}</dd>
              <dt>Spaces</dt>
              <dd>${model.spaces.length}</dd>
              <dt>On Hugging Face</dt>
              <dd><a href="https://huggingface.co/${model.id}" target="_blank" rel="noopener">huggingface.co/${model.id}</a></dd>
            </dl>
          `
        : this.error
          ? ''
          : html`<p>Loading…</p>`}
    `;
  }
}

customElements.define('llm-model-view', LlmModelView);
