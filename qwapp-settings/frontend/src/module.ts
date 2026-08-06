import { html } from 'lit';
import './settings-view';
import {
  NAVBAR_EXTENSIONS_CAPABILITY,
  PANE_CONTENT_EXTENSIONS_CAPABILITY,
} from 'qwapp-frontend-api';
import type { ContentExtension, ExtensionRegistry, NavbarExtension, ShellContext } from 'qwapp-frontend-api';
import { loadSettings } from './settings-store';

export function register(registry: ExtensionRegistry) {
  void loadSettings();

  registry.registerCapability(NAVBAR_EXTENSIONS_CAPABILITY, {
    qualifier: 'settings-nav-button',
    routePath: '/settings',
    label: 'Settings',
  } satisfies NavbarExtension);

  registry.registerCapability(PANE_CONTENT_EXTENSIONS_CAPABILITY, {
    qualifier: 'settings-view',
    predicate: (context) => context.path === '/settings',
    factory: () => html`<settings-view></settings-view>`,
  } satisfies ContentExtension<ShellContext, unknown>);
}

register(window.qwappRegistry);
