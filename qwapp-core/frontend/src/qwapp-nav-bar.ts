import { LitElement, css, html } from 'lit';
import type { ContentExtension, NavbarExtension, ShellContext } from './registry';

export interface ShellTab {
  routePath: string;
  navExtension: NavbarExtension;
  viewExtensions: ContentExtension<ShellContext, unknown>[];
}

function normalizeRoutePath(routePath: string | undefined): string | undefined {
  if (!routePath) {
    return undefined;
  }
  const trimmed = routePath.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === '/') {
    return '/';
  }
  const withoutTrailingSlash = trimmed.replace(/\/+$/g, '');
  return withoutTrailingSlash.startsWith('/') ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
}

export function isTabActive(routePath: string, currentPath: string): boolean {
  if (routePath === '/') {
    return currentPath === '/';
  }
  return currentPath === routePath || currentPath.startsWith(routePath + '/');
}

export function collectShellTabs(
  navExtensions: NavbarExtension[],
  viewExtensions: ContentExtension<ShellContext, unknown>[]
): ShellTab[] {
  return navExtensions.flatMap((navExtension) => {
    const routePath = normalizeRoutePath(navExtension.routePath);
    if (!routePath) {
      return [];
    }
    const context: ShellContext = { path: routePath };
    return {
      routePath,
      navExtension,
      viewExtensions: viewExtensions.filter((viewExtension) => viewExtension.predicate(context)),
    };
  });
}

export class QwappNavBar extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    nav {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      border-bottom: 2px solid transparent;
      padding-bottom: 0.25rem;
    }

    .tab.active {
      border-bottom-color: currentColor;
      font-weight: 600;
    }
  `;

  static properties = {
    currentPath: { attribute: false },
    tabs: { attribute: false },
  };

  declare currentPath: string;
  declare tabs: ShellTab[];

  constructor() {
    super();
    this.currentPath = '/';
    this.tabs = [];
  }

  private onNavClick(event: Event) {
    const anchor = (event.target as HTMLElement).closest('a');
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-route-path]');
    const routePath = tab?.dataset.routePath;
    if (!anchor || !routePath) {
      return;
    }
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent<{ routePath: string }>('navigate', {
        detail: { routePath },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <nav @click=${(event: Event) => this.onNavClick(event)}>
        ${this.tabs.map((tab) => {
          const active = isTabActive(tab.routePath, this.currentPath);
          return html`
            <div class=${active ? 'tab active' : 'tab'} data-route-path=${tab.routePath}>
              <a href=${tab.routePath}>${tab.navExtension.label}</a>
            </div>
          `;
        })}
      </nav>
    `;
  }
}

customElements.define('qwapp-nav-bar', QwappNavBar);
