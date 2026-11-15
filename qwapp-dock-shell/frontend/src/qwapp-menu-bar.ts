import { LitElement, css, html } from 'lit';
import type { Menu } from './menu';

/** A menu bar with drop-down menus, built on native popovers (light dismiss, Escape). */
export class QwappMenuBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: 0.25rem;
    }
    button {
      font: inherit;
      border: none;
      background: none;
      padding: 0.25rem 0.75rem;
      cursor: pointer;
    }
    button:hover {
      background: rgba(127, 127, 127, 0.2);
    }
    [popover] {
      position: fixed;
      margin: 0;
      padding: 0.25rem 0;
      min-width: 10rem;
      border: 1px solid #ccc;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    [popover] button {
      display: block;
      width: 100%;
      text-align: left;
    }
  `;

  static properties = {
    menus: { attribute: false },
  };

  declare menus: Menu[];

  constructor() {
    super();
    this.menus = [];
  }

  /** Places the menu under its button as it opens. */
  private position(event: Event, index: number) {
    if ((event as ToggleEvent).newState !== 'open') {
      return;
    }
    const rect = this.renderRoot.querySelector<HTMLElement>(`#button-${index}`)!.getBoundingClientRect();
    const popover = event.currentTarget as HTMLElement;
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom}px`;
  }

  private choose(index: number, run: () => void) {
    this.renderRoot.querySelector<HTMLElement>(`#menu-${index}`)!.hidePopover();
    run();
  }

  render() {
    return this.menus.map(
      (menu, index) => html`
        <button id="button-${index}" popovertarget="menu-${index}">${menu.name}</button>
        <div id="menu-${index}" popover @beforetoggle=${(event: Event) => this.position(event, index)}>
          ${menu.items.map((item) => html`<button @click=${() => this.choose(index, item.run)}>${item.label}</button>`)}
        </div>
      `
    );
  }
}

customElements.define('qwapp-menu-bar', QwappMenuBar);
