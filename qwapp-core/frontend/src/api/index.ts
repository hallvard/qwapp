export * from './capability';
export * from './settings-store';
export * from './app-state-store';

import { defineMultiCapability } from './capability';
import type { CapabilityDescriptor, MultiCapability, SingleCapability } from './capability';

export interface ShellContext {
  path: string;
}

export interface Extension {
  qualifier: string;
}

export interface ContentExtension<C = unknown, T = unknown> extends Extension {
  predicate: (context: C) => boolean;
  factory: (context: C) => T;
}

export interface NavbarExtension extends Extension {
  routePath: string;
  label: string;
}

export const NAVBAR_EXTENSIONS_CAPABILITY = defineMultiCapability<NavbarExtension>('qwapp.navbar-extension');

export const PANE_CONTENT_EXTENSIONS_CAPABILITY = defineMultiCapability<ContentExtension<ShellContext, unknown>>('qwapp.pane-content-extension');

export class ExtensionRegistry extends EventTarget {
  private capabilities = new Map<string, unknown[]>();

  registerCapability<T>(capability: CapabilityDescriptor<T>, value: T) {
    const existing = this.capabilities.get(capability.key);
    if (existing) {
      existing.push(value);
    } else {
      this.capabilities.set(capability.key, [value]);
    }
    this.dispatchEvent(new Event('change'));
  }

  getCapabilities<T>(capability: MultiCapability<T>): T[] {
    return (this.capabilities.get(capability.key) ?? []) as T[];
  }

  getCapability<T>(capability: SingleCapability<T>): T | undefined {
    return (this.capabilities.get(capability.key) ?? [])[0] as T | undefined;
  }
}

declare global {
  interface Window {
    qwappRegistry: ExtensionRegistry;
  }
}
