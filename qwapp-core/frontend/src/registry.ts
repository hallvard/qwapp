import { ExtensionRegistry, SettingsStore } from './api';

export * from './api';

window.qwappRegistry = new ExtensionRegistry();
window.qwappSettingsStore = new SettingsStore();
window.qwappSettingsStore.load();
