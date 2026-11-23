import { APP_STATE_STORE_CAPABILITY, DefaultAppStateStore, ExtensionRegistry } from '@hallvard/qwapp-api';

export * from '@hallvard/qwapp-api';

window.qwappRegistry = new ExtensionRegistry();
window.qwappRegistry.registerCapability(APP_STATE_STORE_CAPABILITY, new DefaultAppStateStore());
