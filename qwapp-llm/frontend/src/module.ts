import { html } from 'lit';
import './llm-families-view';
import './llm-family-view';
import './llm-model-view';
import { VIEW_EXTENSIONS_CAPABILITY } from 'qwapp-frontend-api';
import type { ExtensionRegistry, ViewExtension } from 'qwapp-frontend-api';
import { parseModelViewId } from './api';

export function register(registry: ExtensionRegistry) {
  // The families to choose from...
  registry.registerCapability(VIEW_EXTENSIONS_CAPABILITY, {
    name: 'llm-families',
    label: 'Language models',
    factory: (context) =>
      html`<llm-families-view .viewManager=${context.viewManager}></llm-families-view>`,
  } satisfies ViewExtension);

  // ...a family (id: its name), with its models...
  registry.registerCapability(VIEW_EXTENSIONS_CAPABILITY, {
    name: 'llm-family',
    label: 'Family',
    entity: true,
    title: (id) => id ?? 'Family',
    factory: (context) =>
      html`<llm-family-view .familyName=${context.id} .viewManager=${context.viewManager}></llm-family-view>`,
  } satisfies ViewExtension);

  // ...and a single model (id: family/variant).
  registry.registerCapability(VIEW_EXTENSIONS_CAPABILITY, {
    name: 'llm-model',
    label: 'Model',
    entity: true,
    title: (id) => (id ? parseModelViewId(id).variant : 'Model'),
    factory: (context) =>
      html`<llm-model-view .modelId=${context.id} .viewManager=${context.viewManager}></llm-model-view>`,
  } satisfies ViewExtension);
}

register(window.qwappRegistry);
