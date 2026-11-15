import { VIEW_EXTENSIONS_CAPABILITY, VIEW_MANAGER_CAPABILITY } from 'qwapp-frontend-api';
import type { ExtensionRegistry } from 'qwapp-frontend-api';
import type { MenuContribution } from './menu';

/**
 * The View menu: an item for each singleton view. Choosing one asks the view manager
 * to open it, which activates the view if it is already open.
 */
export const viewMenu: MenuContribution = {
  menu: 'View',
  order: -100,
  items: (registry: ExtensionRegistry) =>
    registry
      .getCapabilities(VIEW_EXTENSIONS_CAPABILITY)
      .filter((view) => !view.entity)
      .map((view) => ({
        label: view.label,
        run: () => registry.getCapability(VIEW_MANAGER_CAPABILITY)?.open(view.name),
      })),
};
