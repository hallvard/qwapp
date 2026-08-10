export type LayerStatus = {
  /** Number of in-flight requests (tiles or coverage windows). */
  pending: number;
  /** The most recent request failure. */
  error: string | null;
  /** A declaration the service contradicts — outranks `error`, since it's the cause. */
  declarationProblem: string | null;
};

export const IDLE_LAYER_STATUS: LayerStatus = { pending: 0, error: null, declarationProblem: null };

export function problemOf(status: LayerStatus): string | null {
  return status.declarationProblem ?? status.error;
}

export type LayerStatusStore = {
  begin(layerId: string): void;
  end(layerId: string): void;
  fail(layerId: string, message: string): void;
  clearError(layerId: string): void;
  setDeclarationProblem(layerId: string, message: string | null): void;
  statusOf(layerId: string): LayerStatus;
  /** Drops everything about layers no longer drawn, so a removed layer stops reporting itself broken. */
  retain(layerIds: readonly string[]): void;
};

export function createLayerStatusStore(
  onChange: (layerId: string, status: LayerStatus) => void,
): LayerStatusStore {
  const statuses = new Map<string, LayerStatus>();

  const update = (layerId: string, change: (status: LayerStatus) => LayerStatus): void => {
    const before = statuses.get(layerId) ?? IDLE_LAYER_STATUS;
    const after = change(before);
    if (after === before) return;
    statuses.set(layerId, after);
    onChange(layerId, after);
  };

  return {
    begin: (id) => update(id, (s) => ({ ...s, pending: s.pending + 1 })),
    end: (id) => update(id, (s) => ({ ...s, pending: Math.max(0, s.pending - 1) })),
    fail: (id, message) =>
      update(id, (s) => ({ ...s, pending: Math.max(0, s.pending - 1), error: message })),
    clearError: (id) => update(id, (s) => (s.error === null ? s : { ...s, error: null })),
    setDeclarationProblem: (id, message) =>
      update(id, (s) =>
        s.declarationProblem === message ? s : { ...s, declarationProblem: message },
      ),
    statusOf: (id) => statuses.get(id) ?? IDLE_LAYER_STATUS,
    retain: (layerIds) => {
      const keep = new Set(layerIds);
      for (const id of statuses.keys()) if (!keep.has(id)) statuses.delete(id);
    },
  };
}

/** A layer's status counter, scoped to one OL layer's lifetime. */
export type TrackedLayerStatus = {
  begin: () => void;
  end: () => void;
  fail: (message: string) => void;
  succeed: () => void;
  /** Settles whatever is still outstanding. Call on teardown. */
  dispose: () => void;
};

/**
 * Nothing guarantees the events balancing a `begin()` ever arrive — a source
 * torn down before it settles never fires its load-end event. Counting per
 * request closes both ends: `dispose()` unwinds what is outstanding, and a
 * late `end()` is a no-op against the next instance.
 */
export function trackLayerStatus(
  drawing: () => readonly string[],
  store: LayerStatusStore,
): TrackedLayerStatus {
  const outstanding: (readonly string[])[] = [];
  const settle = (apply: (layerId: string) => void): void => {
    const layerIds = outstanding.shift();
    if (layerIds === undefined) return;
    for (const layerId of layerIds) apply(layerId);
  };
  return {
    begin: () => {
      const layerIds = drawing();
      outstanding.push(layerIds);
      for (const layerId of layerIds) store.begin(layerId);
    },
    end: () => settle((id) => store.end(id)),
    fail: (message) => settle((id) => store.fail(id, message)),
    succeed: () => {
      for (const id of drawing()) store.clearError(id);
    },
    dispose: () => {
      while (outstanding.length > 0) settle((id) => store.end(id));
    },
  };
}
