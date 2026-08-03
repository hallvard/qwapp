export * from './settings-store';

export interface ShellContext {
  path: string;
}

/** Extension point: nav items shown in the shell header, for every path. */
export const NAV_EXTENSION_ID = 'qwapp.nav';
/** Extension point: main content for the current path. */
export const VIEW_EXTENSION_ID = 'qwapp.view';

export interface Extension<C = unknown, T = unknown> {
  extensionId: string;
  qualifier: string;
  predicate: (context: C) => boolean;
  factory: (context: C) => T;
}

export class ExtensionRegistry extends EventTarget {
  private extensions: Extension[] = [];

  register<C, T>(extension: Extension<C, T>) {
    this.extensions.push(extension as unknown as Extension);
    this.dispatchEvent(new Event('change'));
  }

  getExtensions<C, T>(extensionId: string, context: C): Extension<C, T>[] {
    return this.extensions.filter(
      (extension) => extension.extensionId === extensionId && extension.predicate(context)
    ) as unknown as Extension<C, T>[];
  }
}

declare global {
  interface Window {
    qwappRegistry: ExtensionRegistry;
  }
}
