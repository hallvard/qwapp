import { LitElement, html, css } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import {
  VIEW_EXTENSIONS_CAPABILITY,
  VIEW_MANAGER_CAPABILITY,
  resolveView,
} from 'qwapp-frontend-api';
import type { ExtensionRegistry, ViewContext, ViewExtension, ViewManager } from 'qwapp-frontend-api';
import './qwapp-nav-bar';
import { parseViewPath, viewPath } from './qwapp-nav-bar';

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

/**
 * The nav bar shell: shows one view at a time, selected through the nav bar or
 * the URL (`/name` for views, `/name/id` for entity views).
 */
export class QwappNavbarShell extends LitElement {
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
  private frontendPathPrefix = getFrontendPathPrefix();

  private onRegistryChange = () => {
    this.registryVersion++;
  };

  private onPopState = () => {
    this.currentPath = this.toRoutePath(window.location.pathname);
  };

  constructor() {
    super();
    this.currentPath = this.toRoutePath(window.location.pathname);
    this.registryVersion = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    this.registry.addEventListener('change', this.onRegistryChange);
    window.addEventListener('popstate', this.onPopState);
    this.registry.registerCapability(VIEW_MANAGER_CAPABILITY, this.viewManager);
  }

  disconnectedCallback() {
    this.registry.removeEventListener('change', this.onRegistryChange);
    window.removeEventListener('popstate', this.onPopState);
    super.disconnectedCallback();
  }

  private navigateTo(routePath: string) {
    const browserPath = this.isPrefixedBrowserPath(routePath)
      ? routePath
      : this.toBrowserPath(routePath);
    window.history.pushState(null, '', browserPath);
    this.currentPath = this.toRoutePath(browserPath);
  }

  /** Navigating is how this shell opens views; opening the current view again is a no-op. */
  private viewManager: ViewManager = {
    open: (name, id) => {
      const view = resolveView(this.views(), name, id);
      if (view) {
        this.navigateTo(viewPath(name, view.entity ? id : undefined));
      }
    },
  };

  private views(): ViewExtension[] {
    return this.registry.getCapabilities(VIEW_EXTENSIONS_CAPABILITY);
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

  private context(view: ViewExtension, id?: string): ViewContext {
    return { name: view.name, id, viewManager: this.viewManager };
  }

  render() {
    const views = this.views();
    const listed = views.filter((view) => !view.entity);
    const current = parseViewPath(this.currentPath);
    const currentView = current && views.find((view) => view.name === current.name);
    // Singleton views stay mounted (e.g. the map keeps its state), entity views
    // are created when navigated to, one at a time.
    const activeEntityId = currentView?.entity ? current?.id : undefined;

    return html`
      <header>
        <h1>qwapp</h1>
        <qwapp-nav-bar
          .views=${listed}
          .currentPath=${this.currentPath}
          @open-view=${(event: CustomEvent<{ viewName: string }>) =>
            this.navigateTo(viewPath(event.detail.viewName))}
        ></qwapp-nav-bar>
      </header>
      <main>
        ${views.length > 0
          ? html`
              ${listed.map(
                (view) => html`
                  <section class="view-panel" ?hidden=${currentView !== view}>
                    ${view.factory(this.context(view))}
                  </section>
                `
              )}
              ${currentView && activeEntityId !== undefined
                ? keyed(
                    this.currentPath,
                    html`<section class="view-panel">
                      ${currentView.factory(this.context(currentView, activeEntityId))}
                    </section>`
                  )
                : ''}
            `
          : this.renderEmpty()}
      </main>
    `;
  }

  private renderEmpty() {
    return 'No module(s) loaded.';
  }
}

customElements.define('qwapp-navbar-shell', QwappNavbarShell);
