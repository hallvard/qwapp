import { APP_STATE_STORE_CAPABILITY, DefaultAppStateStore, ExtensionRegistry } from './api';

export * from './api';

window.qwappRegistry = new ExtensionRegistry();
window.qwappRegistry.registerCapability(APP_STATE_STORE_CAPABILITY, new DefaultAppStateStore());
