import { html } from 'lit';
import './settings-view';
import { NAV_EXTENSION_ID, VIEW_EXTENSION_ID } from 'qwapp-frontend-api';
import type { ExtensionRegistry, ShellContext } from 'qwapp-frontend-api';

export function register(registry: ExtensionRegistry) {
  registry.register<ShellContext, unknown>({
    extensionId: NAV_EXTENSION_ID,
    qualifier: 'settings-nav-button',
    predicate: () => true,
    factory: () => html`<a href="/settings">Settings</a>`,
  });

  registry.register<ShellContext, unknown>({
    extensionId: VIEW_EXTENSION_ID,
    qualifier: 'settings-view',
    predicate: (context) => context.path === '/settings',
    factory: () => html`<settings-view></settings-view>`,
  });
}

register(window.qwappRegistry);
