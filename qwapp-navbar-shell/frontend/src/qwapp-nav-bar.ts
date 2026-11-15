import { LitElement, css, html } from 'lit';
import type { ViewExtension } from 'qwapp-frontend-api';

export function viewPath(name: string, id?: string): string {
  return id === undefined ? `/${name}` : `/${name}/${encodeURIComponent(id)}`;
}

/** Splits a route path into view name and (optional) id: `/setting/theme` is `setting` and `theme`. */
export function parseViewPath(path: string): { name: string; id?: string } | undefined {
  const [, name, ...rest] = path.split('/');
  if (!name) {
    return undefined;
  }
  return rest.length > 0 ? { name, id: decodeURIComponent(rest.join('/')) } : { name };
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
    views: { attribute: false },
  };

  declare currentPath: string;
  /** The views to list, i.e. those not needing an id. */
  declare views: ViewExtension[];

  constructor() {
    super();
    this.currentPath = '/';
    this.views = [];
  }

  private onNavClick(event: Event) {
    const anchor = (event.target as HTMLElement).closest('a');
    const viewName = anchor?.dataset.viewName;
    if (!anchor || !viewName) {
      return;
    }
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent<{ viewName: string }>('open-view', {
        detail: { viewName },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <nav @click=${(event: Event) => this.onNavClick(event)}>
        ${this.views.map((view) => {
          const path = viewPath(view.name);
          return html`
            <div class=${this.currentPath === path ? 'tab active' : 'tab'}>
              <a href=${path} data-view-name=${view.name}>${view.label}</a>
            </div>
          `;
        })}
      </nav>
    `;
  }
}

customElements.define('qwapp-nav-bar', QwappNavBar);
