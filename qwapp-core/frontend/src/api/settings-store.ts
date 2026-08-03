export interface Settings {
  [key: string]: string;
}

/**
 * Global settings, loaded from and saved back to the settings module's REST
 * resource. A single instance lives on `window.qwappSettingsStore`, shared
 * across separately-bundled modules the same way `window.qwappRegistry` is.
 */
export class SettingsStore extends EventTarget {
  private settings: Settings = {};

  get(): Settings {
    return this.settings;
  }

  async load(): Promise<void> {
    const response = await fetch('/api/settings');
    this.settings = await response.json();
    this.dispatchEvent(new Event('change'));
  }

  async update(partial: Settings): Promise<void> {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    this.settings = await response.json();
    this.dispatchEvent(new Event('change'));
  }
}

declare global {
  interface Window {
    qwappSettingsStore: SettingsStore;
  }
}
