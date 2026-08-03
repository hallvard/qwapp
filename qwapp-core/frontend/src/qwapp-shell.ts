import { LitElement, html, css } from 'lit';
import { ExtensionRegistry, NAV_EXTENSION_ID, VIEW_EXTENSION_ID } from './registry';
import type { ShellContext, SettingsStore } from './registry';

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
  private settingsStore: SettingsStore = window.qwappSettingsStore;

  private onRegistryChange = () => {
    this.registryVersion++;
  };

  private onPopState = () => {
    this.currentPath = window.location.pathname;
  };

  private onSettingsChange = () => {
    const theme = this.settingsStore.get().theme;
    if (theme) {
      document.documentElement.dataset.theme = theme;
    }
  };

  constructor() {
    super();
    this.currentPath = window.location.pathname;
    this.registryVersion = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    this.registry.addEventListener('change', this.onRegistryChange);
    window.addEventListener('popstate', this.onPopState);
    this.settingsStore.addEventListener('change', this.onSettingsChange);
    this.onSettingsChange();
  }

  disconnectedCallback() {
    this.registry.removeEventListener('change', this.onRegistryChange);
    window.removeEventListener('popstate', this.onPopState);
    this.settingsStore.removeEventListener('change', this.onSettingsChange);
    super.disconnectedCallback();
  }

  private onNavClick(event: Event) {
    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (href && href.startsWith('/')) {
      event.preventDefault();
      window.history.pushState(null, '', href);
      this.currentPath = href;
    }
  }

  render() {
    const context: ShellContext = { path: this.currentPath };
    const navExtensions = this.registry.getExtensions(NAV_EXTENSION_ID, context);
    const viewExtensions = this.registry.getExtensions(VIEW_EXTENSION_ID, context);

    return html`
      <header>
        <h1>qwapp</h1>
        <nav @click=${(e: Event) => this.onNavClick(e)}>
          ${navExtensions.map((extension) => extension.factory(context))}
        </nav>
      </header>
      <main>
        ${viewExtensions.length > 0
          ? viewExtensions.map((extension) => extension.factory(context))
          : this.renderEmpty()}
      </main>
    `;
  }

  private renderEmpty() {
    return 'No modules loaded.';
  }
}

customElements.define('qwapp-shell', QwappShell);
