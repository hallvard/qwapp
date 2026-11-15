import { LitElement, html, nothing, render } from 'lit';
import { createDockview, themeDark, themeLight } from 'dockview';
import type { DockviewApi } from 'dockview';
import dockviewCss from 'dockview/dist/styles/dockview.css?inline';
import {
  APP_STATE_STORE_CAPABILITY,
  VIEW_EXTENSIONS_CAPABILITY,
  VIEW_MANAGER_CAPABILITY,
  resolveView,
  viewKey,
  viewTitle,
} from 'qwapp-frontend-api';
import type { AppStateStore, ViewExtension, ViewManager } from 'qwapp-frontend-api';
import { MENU_CONTRIBUTIONS_CAPABILITY, collectMenus } from './menu';
import './qwapp-menu-bar';

interface PanelParams {
  name: string;
  id?: string;
}

let dockviewCssInjected = false;
function ensureDockviewCss() {
  if (dockviewCssInjected) {
    return;
  }
  dockviewCssInjected = true;
  const style = document.createElement('style');
  style.textContent = dockviewCss;
  document.head.append(style);
}

/**
 * The dock shell: views open as tabs in a dock where they can be dragged
 * side by side, so several views (and several entity views of the same kind)
 * are open at the same time. Uses the same view capability and provides the
 * same view manager as the nav bar shell. Views are reached through the menu bar,
 * whose menus are contributed through `MENU_CONTRIBUTIONS_CAPABILITY`.
 */
export class QwappDockShell extends LitElement {
  // Light DOM, so views get the same styling scope as in the document.
  protected createRenderRoot(): this {
    return this;
  }

  static properties = {
    registryVersion: { state: true },
  };

  declare registryVersion: number;

  private registry = window.qwappRegistry;
  private api?: DockviewApi;
  private autoOpened = new Set<string>();
  private appStateStore?: AppStateStore;

  private viewManager: ViewManager = {
    open: (name, id) => this.openView(name, id),
  };

  constructor() {
    super();
    this.registryVersion = 0;
  }

  private views(): ViewExtension[] {
    return this.registry.getCapabilities(VIEW_EXTENSIONS_CAPABILITY);
  }

  private onRegistryChange = () => {
    this.registryVersion++;
    this.openNewViews();
  };

  private onAppStateChange = () => {
    const theme = this.appStateStore?.getState().settings.theme;
    if (theme) {
      this.api?.updateOptions({ theme: theme === 'dark' ? themeDark : themeLight });
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this.registry.addEventListener('change', this.onRegistryChange);
    this.registry.registerCapability(VIEW_MANAGER_CAPABILITY, this.viewManager);
    this.appStateStore = this.registry.getCapability(APP_STATE_STORE_CAPABILITY);
    this.appStateStore?.addEventListener('change', this.onAppStateChange);
  }

  disconnectedCallback() {
    this.registry.removeEventListener('change', this.onRegistryChange);
    this.appStateStore?.removeEventListener('change', this.onAppStateChange);
    this.api?.dispose();
    this.api = undefined;
    super.disconnectedCallback();
  }

  protected firstUpdated() {
    ensureDockviewCss();
    const theme = this.appStateStore?.getState().settings.theme === 'dark' ? themeDark : themeLight;
    this.api = createDockview(this.querySelector<HTMLElement>('.dock')!, {
      theme,
      createComponent: () => {
        const element = document.createElement('div');
        element.className = 'view-content';
        return {
          element,
          init: ({ params }) => {
            const { name, id } = params as PanelParams;
            const view = this.views().find((candidate) => candidate.name === name);
            if (view) {
              render(view.factory({ name, id, viewManager: this.viewManager }), element);
            }
          },
          dispose: () => render(nothing, element),
        };
      },
    });
    this.openNewViews();
  }

  /** Opens each singleton view once as it becomes available, the next one beside the previous. */
  private openNewViews() {
    if (!this.api) {
      return;
    }
    for (const view of this.views()) {
      if (!view.entity && !this.autoOpened.has(view.name)) {
        this.autoOpened.add(view.name);
        const last = this.api.panels.at(-1);
        this.openView(view.name, undefined, last && { referencePanel: last, direction: 'right' });
      }
    }
  }

  private openView(
    name: string,
    id?: string,
    position?: { referencePanel: NonNullable<DockviewApi['activePanel']>; direction: 'right' }
  ) {
    const view = resolveView(this.views(), name, id);
    if (!this.api || !view) {
      return;
    }
    const instanceId = view.entity ? id : undefined;
    const key = viewKey(name, instanceId);
    const existing = this.api.getPanel(key);
    if (existing) {
      existing.api.setActive();
      return;
    }
    this.api.addPanel<PanelParams>({
      id: key,
      component: 'view',
      title: viewTitle(view, instanceId),
      params: { name, id: instanceId },
      // Keeps views mounted while their tab is in the background.
      renderer: 'always',
      ...(position && { position }),
    });
  }

  render() {
    return html`
      <style>
        qwapp-dock-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: system-ui, sans-serif;
        }
        qwapp-dock-shell header {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid #ddd;
        }
        qwapp-dock-shell h1 {
          margin: 0;
          font-size: 1.25rem;
        }
        qwapp-dock-shell .dock {
          flex: 1;
          min-height: 0;
        }
        qwapp-dock-shell .view-content {
          height: 100%;
          box-sizing: border-box;
          overflow: auto;
          padding: 1rem;
        }
      </style>
      <header>
        <h1>qwapp</h1>
        <qwapp-menu-bar
          .menus=${collectMenus(this.registry.getCapabilities(MENU_CONTRIBUTIONS_CAPABILITY), this.registry)}
        ></qwapp-menu-bar>
      </header>
      <div class="dock"></div>
    `;
  }
}

customElements.define('qwapp-dock-shell', QwappDockShell);
