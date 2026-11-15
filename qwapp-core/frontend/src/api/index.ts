export * from './capability';
export * from './settings-store';
export * from './app-state-store';
export * from './views';

import type { CapabilityDescriptor, MultiCapability, SingleCapability } from './capability';

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
