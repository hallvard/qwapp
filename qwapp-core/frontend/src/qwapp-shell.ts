import { LitElement, html, css } from 'lit';
import {
  APP_STATE_STORE_CAPABILITY,
  ExtensionRegistry,
  PANE_CONTENT_EXTENSIONS_CAPABILITY,
  NAVBAR_EXTENSIONS_CAPABILITY,
} from './registry';
import type { AppStateStore, ShellContext } from './registry';
import { collectShellTabs, isTabActive } from './qwapp-nav-bar';

function normalizePrefix(prefix: string | null | undefined): string {
  if (!prefix) {
    return '';
  }
  const trimmed = prefix.trim();
  if (!trimmed) {
    return '';
  }
  const withoutSlashes = trimmed.replace(/^\/+|\/+$/g, '');
  return withoutSlashes ? `/${withoutSlashes}` : '';
}

function getFrontendPathPrefix(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="env.frontendPathPrefix"]');
  return normalizePrefix(meta?.content);
}

export class QwappShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }
    header {
      padding: 1rem;
      border-bottom: 1px solid #ddd;
    }
    nav {
      display: flex;
      gap: 1rem;
    }
    .view-panel[hidden] {
      display: none;
    }
    main {
      padding: 1rem;
      color: #666;
    }
  `;

  static properties = {
    currentPath: { state: true },
    registryVersion: { state: true },
  };

  declare currentPath: string;
  declare registryVersion: number;

  private registry: ExtensionRegistry = window.qwappRegistry;
  private appStateStore: AppStateStore | undefined;
  private frontendPathPrefix = getFrontendPathPrefix();

  private onRegistryChange = () => {
    this.registryVersion++;
    this.resolveAppStateStore();
  };

  private onPopState = () => {
    this.currentPath = this.toRoutePath(window.location.pathname);
  };

  private onAppStateStoreChange = () => {
    if (!this.appStateStore) {
      return;
    }
    const theme = this.appStateStore.getState().settings.theme;
    if (theme) {
      document.documentElement.dataset.theme = theme;
    }
  };

  private resolveAppStateStore() {
    const nextStore = this.registry.getCapability<AppStateStore>(APP_STATE_STORE_CAPABILITY);
    if (nextStore === this.appStateStore) {
      return;
    }
    if (this.appStateStore) {
      this.appStateStore.removeEventListener('change', this.onAppStateStoreChange);
    }
    this.appStateStore = nextStore;
    if (this.appStateStore) {
      this.appStateStore.addEventListener('change', this.onAppStateStoreChange);
      this.onAppStateStoreChange();
    }
  }

  constructor() {
    super();
    this.currentPath = this.toRoutePath(window.location.pathname);
    this.registryVersion = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    this.registry.addEventListener('change', this.onRegistryChange);
    window.addEventListener('popstate', this.onPopState);
    this.resolveAppStateStore();
  }

  disconnectedCallback() {
    this.registry.removeEventListener('change', this.onRegistryChange);
    window.removeEventListener('popstate', this.onPopState);
    if (this.appStateStore) {
      this.appStateStore.removeEventListener('change', this.onAppStateStoreChange);
    }
    super.disconnectedCallback();
  }

  private onNavClick(event: Event) {
    const navigateEvent = event as CustomEvent<{ routePath: string }>;
    const routePath = navigateEvent.detail?.routePath;
    if (!routePath || !routePath.startsWith('/')) {
      return;
    }
    const browserPath = this.isPrefixedBrowserPath(routePath)
      ? routePath
      : this.toBrowserPath(routePath);
    window.history.pushState(null, '', browserPath);
    this.currentPath = this.toRoutePath(browserPath);
  }

  private isPrefixedBrowserPath(pathname: string): boolean {
    if (!this.frontendPathPrefix) {
      return false;
    }
    return pathname === this.frontendPathPrefix || pathname.startsWith(this.frontendPathPrefix + '/');
  }

  private toRoutePath(pathname: string): string {
    if (!this.frontendPathPrefix) {
      return pathname || '/';
    }
    if (pathname === this.frontendPathPrefix) {
      return '/';
    }
    if (pathname.startsWith(this.frontendPathPrefix + '/')) {
      return pathname.substring(this.frontendPathPrefix.length);
    }
    return pathname || '/';
  }

  private toBrowserPath(routePath: string): string {
    if (!this.frontendPathPrefix) {
      return routePath;
    }
    if (routePath === '/') {
      return this.frontendPathPrefix;
    }
    return this.frontendPathPrefix + routePath;
  }

  render() {
    const context: ShellContext = { path: this.currentPath };
    const navExtensions = this.registry.getCapabilities(NAVBAR_EXTENSIONS_CAPABILITY);
    const viewExtensions = this.registry.getCapabilities(PANE_CONTENT_EXTENSIONS_CAPABILITY);
    const tabs = collectShellTabs(navExtensions, viewExtensions);

    return html`
      <header>
        <h1>qwapp</h1>
        <qwapp-nav-bar
          .tabs=${tabs}
          .currentPath=${this.currentPath}
          @navigate=${(event: Event) => this.onNavClick(event)}
        ></qwapp-nav-bar>
      </header>
      <main>
        ${tabs.length > 0
          ? tabs.map((tab) => {
              const active = isTabActive(tab.routePath, this.currentPath);
              return html`
                <section class="view-panel" ?hidden=${!active} data-route-path=${tab.routePath}>
                  ${tab.viewExtensions.map((extension) => extension.factory(context))}
                </section>
              `;
            })
          : this.renderEmpty()}
      </main>
    `;
  }

  private renderEmpty() {
    return 'No module(s) loaded.';
  }
}

customElements.define('qwapp-shell', QwappShell);
