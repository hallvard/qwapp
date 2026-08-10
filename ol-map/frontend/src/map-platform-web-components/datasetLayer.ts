import type BaseLayer from "ol/layer/Base";
import type OlMap from "ol/Map";
import {
  scaleDenominatorToResolution,
  type ResolvedLayer,
  type ScaleWindow,
} from "@map-platform/core";
import { trackLayerStatus, type LayerStatusStore, type TrackedLayerStatus } from "./layerStatus";

export type DrawnMember = { id: string; window: ScaleWindow };

/** A physical unit: one or more resolved layers drawn by a single OL layer. */
export type DrawnUnit = {
  key: string;
  covers: readonly DrawnMember[];
  drawing: () => readonly string[];
  visible: boolean;
  opacity: number;
  zIndex: number;
  window: ScaleWindow;
};

export function drawnLayer(layer: ResolvedLayer, offered?: ScaleWindow): DrawnUnit {
  const window = {
    minScale: offered?.minScale ?? layer.minScale,
    maxScale: offered?.maxScale ?? layer.maxScale,
  };
  return {
    key: layer.id,
    covers: [{ id: layer.id, window }],
    drawing: () => [layer.id],
    visible: layer.visible,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    window,
  };
}

export type OlLayerOptions = {
  visible: boolean;
  opacity: number;
  zIndex: number;
  minResolution: number | undefined;
  maxResolution: number | undefined;
};

/** What one interpreter hands the renderer for one drawn unit. */
export type LayerUnitResult = {
  unit: DrawnUnit;
  options: DatasetLayerOptions;
  declarationProblem: string | null;
};

export type DatasetLayerOptions = {
  /** `null` means the declaration cannot produce a layer right now. */
  create: (options: OlLayerOptions, status: TrackedLayerStatus) => BaseLayer | null;
  /** Values beyond the unit's own that force a rebuild. */
  deps: readonly unknown[];
  enabled?: boolean;
  /** Applied alongside visibility and opacity whenever the unit changes without rebuilding. */
  update?: (olLayer: BaseLayer) => void;
};

const sameDeps = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

const sameCovers = (a: readonly DrawnMember[], b: readonly DrawnMember[]): boolean =>
  a.length === b.length && a.every((member, i) => member.id === b[i].id);

/**
 * One controller per `DrawnUnit`, holding the OL layer it built. `reconcile`
 * is `useDatasetLayer`'s two effects collapsed into a single call: a
 * dependency-array-shaped comparison decides between a full rebuild (new OL
 * layer, tiles discarded) and an in-place sync (visibility/opacity/zIndex and
 * the interpreter's own `update`, same OL layer, same tile cache) — the host
 * calls it again whenever an input that might matter has changed, instead of
 * a render loop deciding that automatically.
 */
export class DatasetLayerController {
  readonly #map: OlMap;
  readonly #statusStore: LayerStatusStore;
  #olLayer: BaseLayer | null = null;
  #status: TrackedLayerStatus | null = null;
  #unit: DrawnUnit | null = null;
  #deps: readonly unknown[] = [];
  #enabled = true;

  constructor(map: OlMap, statusStore: LayerStatusStore) {
    this.#map = map;
    this.#statusStore = statusStore;
  }

  reconcile(unit: DrawnUnit, options: DatasetLayerOptions): void {
    const { create, deps, enabled = true, update } = options;
    const before = this.#unit;
    const rebuild =
      this.#olLayer === null ||
      before === null ||
      unit.key !== before.key ||
      enabled !== this.#enabled ||
      unit.window.minScale !== before.window.minScale ||
      unit.window.maxScale !== before.window.maxScale ||
      !sameCovers(unit.covers, before.covers) ||
      !sameDeps(deps, this.#deps);

    this.#unit = unit;
    this.#deps = deps;
    this.#enabled = enabled;

    if (rebuild) {
      this.#teardown();
      if (!enabled) return;
      const status = trackLayerStatus(() => unit.drawing(), this.#statusStore);
      const olLayer = create(
        {
          visible: unit.visible,
          opacity: unit.opacity,
          zIndex: unit.zIndex,
          minResolution:
            unit.window.minScale !== undefined
              ? scaleDenominatorToResolution(unit.window.minScale)
              : undefined,
          maxResolution:
            unit.window.maxScale !== undefined
              ? scaleDenominatorToResolution(unit.window.maxScale)
              : undefined,
        },
        status,
      );
      if (olLayer === null) {
        status.dispose();
        return;
      }
      olLayer.set(
        "layerIds",
        unit.covers.map((member) => member.id),
      );
      update?.(olLayer);
      this.#map.addLayer(olLayer);
      this.#olLayer = olLayer;
      this.#status = status;
      return;
    }

    if (this.#olLayer === null) return;
    this.#olLayer.setVisible(unit.visible);
    this.#olLayer.setOpacity(unit.opacity);
    this.#olLayer.setZIndex(unit.zIndex);
    update?.(this.#olLayer);
  }

  dispose(): void {
    this.#teardown();
  }

  #teardown(): void {
    this.#status?.dispose();
    this.#status = null;
    if (this.#olLayer === null) return;
    // Dispose before removing: removeLayer clears the WebGL renderer's
    // helper, and disposing afterwards releases GPU buffers through the gone
    // helper.
    this.#olLayer.dispose();
    this.#map.removeLayer(this.#olLayer);
    this.#olLayer = null;
  }
}
