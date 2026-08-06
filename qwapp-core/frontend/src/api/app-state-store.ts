import { defineSingleCapability } from './capability';
import type { Settings } from './settings-store';

export interface AppState {
  settings: Settings;
  moduleStates: Record<string, unknown>;
}

export interface SliceSubscriptionOptions<T> {
  fireImmediately?: boolean;
  equals?: (previous: T, next: T) => boolean;
}

/**
 * Core-owned global state contract.
 *
 * Feature modules can update relevant slices through this interface without
 * relying on any concrete store implementation.
 */
export interface AppStateStore extends EventTarget {
  getState(): AppState;
  setSettings(settings: Settings): void;
  patchSettings(partial: Settings): void;
  getModuleState<T>(moduleId: string): T | undefined;
  setModuleState<T>(moduleId: string, state: T): void;
  patchModuleState<T extends object>(moduleId: string, partial: Partial<T>): void;
  subscribeSlice<T>(
    selector: (state: AppState) => T,
    listener: (slice: T) => void,
    options?: SliceSubscriptionOptions<T>
  ): () => void;
  subscribeModuleState<T>(
    moduleId: string,
    listener: (moduleState: T | undefined) => void,
    options?: SliceSubscriptionOptions<T | undefined>
  ): () => void;
}

/** Capability for the shared app state store. */
export const APP_STATE_STORE_CAPABILITY = defineSingleCapability<AppStateStore>('qwapp.app-state.store');

export class DefaultAppStateStore extends EventTarget implements AppStateStore {
  private state: AppState = {
    settings: {},
    moduleStates: {},
  };

  getState(): AppState {
    return this.state;
  }

  setSettings(settings: Settings): void {
    this.state = {
      ...this.state,
      settings: { ...settings },
    };
    this.dispatchEvent(new Event('change'));
  }

  patchSettings(partial: Settings): void {
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        ...partial,
      },
    };
    this.dispatchEvent(new Event('change'));
  }

  getModuleState<T>(moduleId: string): T | undefined {
    return this.state.moduleStates[moduleId] as T | undefined;
  }

  setModuleState<T>(moduleId: string, moduleState: T): void {
    this.state = {
      ...this.state,
      moduleStates: {
        ...this.state.moduleStates,
        [moduleId]: moduleState,
      },
    };
    this.dispatchEvent(new Event('change'));
  }

  patchModuleState<T extends object>(moduleId: string, partial: Partial<T>): void {
    const currentState = this.getModuleState<T>(moduleId);
    const currentObject =
      currentState && typeof currentState === 'object'
        ? (currentState as Record<string, unknown>)
        : {};
    this.setModuleState(moduleId, {
      ...currentObject,
      ...partial,
    } as T);
  }

  subscribeSlice<T>(
    selector: (state: AppState) => T,
    listener: (slice: T) => void,
    options: SliceSubscriptionOptions<T> = {}
  ): () => void {
    const equals = options.equals ?? Object.is;
    let previousSlice = selector(this.state);
    if (options.fireImmediately) {
      listener(previousSlice);
    }

    const onStoreChange = () => {
      const nextSlice = selector(this.state);
      if (equals(previousSlice, nextSlice)) {
        return;
      }
      previousSlice = nextSlice;
      listener(nextSlice);
    };

    this.addEventListener('change', onStoreChange);
    return () => {
      this.removeEventListener('change', onStoreChange);
    };
  }

  subscribeModuleState<T>(
    moduleId: string,
    listener: (moduleState: T | undefined) => void,
    options?: SliceSubscriptionOptions<T | undefined>
  ): () => void {
    return this.subscribeSlice((state) => state.moduleStates[moduleId] as T | undefined, listener, options);
  }
}