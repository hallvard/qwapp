import { defineMultiCapability, defineSingleCapability } from './capability';

/**
 * A named view contributed by a module. Shells decide how views are laid out
 * (one at a time behind a nav bar, side by side in a dock, ...), but all of
 * them consume this same contract and provide the same {@link ViewManager}.
 */
export interface ViewExtension {
  /** Identifies the view, e.g. when opening it through the {@link ViewManager}. */
  name: string;
  /** Human-readable label, used for nav items and as the default tab title. */
  label: string;
  /**
   * `false` (default): a singleton view, listed by shells as something the user can open directly.
   * `true`: an entity view, instantiated per id (at most once for each id) and opened
   * from other views through the {@link ViewManager}, so not listed by shells.
   */
  entity?: boolean;
  /** Overrides the default title (`label`, or `label id` for entity views). */
  title?: (id?: string) => string;
  /** Renders the view; the result is a Lit template or a DOM node. */
  factory: (context: ViewContext) => unknown;
}

export interface ViewContext {
  name: string;
  /** Set for entity views. Views map this to actual data themselves, e.g. through a backend call. */
  id?: string;
  viewManager: ViewManager;
}

/**
 * Opens views by name. Provided by every shell, so views don't need to know
 * which shell they live in. Opening an already open view (same name and id)
 * activates it rather than creating a second instance.
 */
export interface ViewManager {
  /** `id` is required for entity views and ignored otherwise. */
  open(name: string, id?: string): void;
}

export const VIEW_EXTENSIONS_CAPABILITY = defineMultiCapability<ViewExtension>('qwapp.view-extension');

export const VIEW_MANAGER_CAPABILITY = defineSingleCapability<ViewManager>('qwapp.view-manager');

/** The key identifying one view instance: `name` for singleton views, `name/id` for entity views. */
export function viewKey(name: string, id?: string): string {
  return id === undefined ? name : `${name}/${id}`;
}

export function viewTitle(view: ViewExtension, id?: string): string {
  return view.title?.(id) ?? (id === undefined ? view.label : `${view.label} ${id}`);
}

/** Looks up the view for `name` and checks that `id` is given exactly when the view is an entity view. */
export function resolveView(views: ViewExtension[], name: string, id?: string): ViewExtension | undefined {
  const view = views.find((candidate) => candidate.name === name);
  if (!view) {
    console.warn(`[qwapp] unknown view: ${name}`);
    return undefined;
  }
  if (view.entity && id === undefined) {
    console.warn(`[qwapp] entity view ${name} needs an id`);
    return undefined;
  }
  return view;
}

/**
 * The shell, contributed by exactly one module (a nav bar shell, a dock shell, ...).
 * The core mounts the element named by `tagName`; the shell reads
 * {@link VIEW_EXTENSIONS_CAPABILITY} and registers {@link VIEW_MANAGER_CAPABILITY}.
 */
export interface ShellExtension {
  tagName: string;
}

export const SHELL_CAPABILITY = defineSingleCapability<ShellExtension>('qwapp.shell');
