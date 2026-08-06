import { html } from 'lit';
import './map-view';
import {
  NAVBAR_EXTENSIONS_CAPABILITY,
  PANE_CONTENT_EXTENSIONS_CAPABILITY,
} from 'qwapp-frontend-api';
import type { ContentExtension, ExtensionRegistry, NavbarExtension, ShellContext } from 'qwapp-frontend-api';

export function register(registry: ExtensionRegistry) {
  registry.registerCapability(NAVBAR_EXTENSIONS_CAPABILITY, {
    qualifier: 'ol-map-nav-button',
    routePath: '/map',
    label: 'Map',
  } satisfies NavbarExtension);

  registry.registerCapability(PANE_CONTENT_EXTENSIONS_CAPABILITY, {
    qualifier: 'ol-map-view',
    predicate: (context) => context.path === '/map',
    factory: () => html`<ol-map-view></ol-map-view>`,
  } satisfies ContentExtension<ShellContext, unknown>);
}

register(window.qwappRegistry);
