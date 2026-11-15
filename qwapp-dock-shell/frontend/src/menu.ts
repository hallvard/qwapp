import { defineMultiCapability } from 'qwapp-frontend-api';
import type { ExtensionRegistry } from 'qwapp-frontend-api';

export interface MenuItem {
  label: string;
  /** Runs when the item is chosen. */
  run: () => void;
}

/**
 * Items for a named menu of the dock shell's menu bar. Several contributions can
 * share a menu name; their items are shown together, ordered by `order`.
 */
export interface MenuContribution {
  /** The menu the items belong to, e.g. `View`. */
  menu: string;
  /** Orders contributions, within a menu and among the menus (default 0). */
  order?: number;
  /** Computed whenever the menu bar renders, so items can depend on what is registered. */
  items: (registry: ExtensionRegistry) => MenuItem[];
}

export const MENU_CONTRIBUTIONS_CAPABILITY = defineMultiCapability<MenuContribution>('qwapp.dock-shell.menu-contribution');

export interface Menu {
  name: string;
  items: MenuItem[];
}

/** Groups the contributions by menu name; menus and items are ordered by `order`, then registration. */
export function collectMenus(contributions: MenuContribution[], registry: ExtensionRegistry): Menu[] {
  const menus = new Map<string, MenuItem[]>();
  const ordered = contributions
    .map((contribution, index) => ({ contribution, index }))
    .sort((a, b) => (a.contribution.order ?? 0) - (b.contribution.order ?? 0) || a.index - b.index);
  for (const { contribution } of ordered) {
    const items = menus.get(contribution.menu) ?? [];
    items.push(...contribution.items(registry));
    menus.set(contribution.menu, items);
  }
  return [...menus].filter(([, items]) => items.length > 0).map(([name, items]) => ({ name, items }));
}
