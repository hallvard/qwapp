import { APP_STATE_STORE_CAPABILITY } from '@hallvard/qwapp-api';
import type { AppStateStore, Settings } from '@hallvard/qwapp-api';

function getAppStateStore(): AppStateStore | undefined {
  return window.qwappRegistry.getCapability<AppStateStore>(APP_STATE_STORE_CAPABILITY);
}

export function getSettings(): Settings {
  return getAppStateStore()?.getState().settings ?? {};
}

export function addSettingsListener(listener: EventListenerOrEventListenerObject): void {
  getAppStateStore()?.addEventListener('change', listener);
}

export function removeSettingsListener(listener: EventListenerOrEventListenerObject): void {
  getAppStateStore()?.removeEventListener('change', listener);
}

export async function loadSettings(): Promise<void> {
  const response = await fetch('/api/settings');
  const settings = (await response.json()) as Settings;
  getAppStateStore()?.setSettings(settings);
}

export async function updateSettings(partial: Settings): Promise<void> {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  const settings = (await response.json()) as Settings;
  getAppStateStore()?.setSettings(settings);
}