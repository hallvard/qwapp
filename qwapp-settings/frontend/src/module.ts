import { html } from 'lit';
import './settings-view';
import './setting-view';
import { VIEW_EXTENSIONS_CAPABILITY } from 'qwapp-frontend-api';
import type { ExtensionRegistry, ViewExtension } from 'qwapp-frontend-api';
import { loadSettings } from './settings-store';

export function register(registry: ExtensionRegistry) {
  void loadSettings();

  // A list of the entities...
  registry.registerCapability(VIEW_EXTENSIONS_CAPABILITY, {
    name: 'settings',
    label: 'Settings',
    factory: (context) =>
      html`<settings-view .viewManager=${context.viewManager}></settings-view>`,
  } satisfies ViewExtension);

  // ...and a view of a single one, opened from the list. Instantiated once per id.
  registry.registerCapability(VIEW_EXTENSIONS_CAPABILITY, {
    name: 'setting',
    label: 'Setting',
    entity: true,
    factory: (context) => html`<setting-view .settingKey=${context.id}></setting-view>`,
  } satisfies ViewExtension);
}

register(window.qwappRegistry);
