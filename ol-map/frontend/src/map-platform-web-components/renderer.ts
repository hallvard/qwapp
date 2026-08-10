import type OlMap from "ol/Map";
import { planWmsBatches, type CrsCode, type ResolvedLayer } from "@map-platform/core";
import type { CapabilitiesCache } from "./capabilities";
import { crsToLonLat, resolutionToScaleDenominator } from "./crs";
import { DatasetLayerController } from "./datasetLayer";
import { createLayerStatusStore, type LayerStatus } from "./layerStatus";
import { vectorLayerUnit } from "./layers/vectorLayer";
import { wcsLayerUnit } from "./layers/wcsLayer";
import { wmsBatchUnit } from "./layers/wmsBatchLayer";
import { wmtsLayerUnit } from "./layers/wmtsLayer";
import { xyzLayerUnit } from "./layers/xyzLayer";

export type RendererCallbacks = {
  onStatusChange: (layerId: string, status: LayerStatus) => void;
};

export type Renderer = {
  /** Re-derives every OL layer from a fresh resolved-layer list. Cheap to call
   *  often: each unit's own reconcile decides whether anything actually moves. */
  update(layers: readonly ResolvedLayer[], viewCrs: CrsCode): void;
  dispose(): void;
};

function scaleDenominatorOf(map: OlMap, crs: CrsCode): number | undefined {
  const view = map.getView();
  const resolution = view.getResolution();
  const center = view.getCenter();
  if (resolution === undefined || center === undefined) return undefined;
  return resolutionToScaleDenominator(
    resolution,
    crs,
    crsToLonLat(center, crs) as [number, number],
  );
}

export function createRenderer(
  map: OlMap,
  cache: CapabilitiesCache,
  callbacks: RendererCallbacks,
): Renderer {
  const controllers = new Map<string, DatasetLayerController>();
  const statusStore = createLayerStatusStore(callbacks.onStatusChange);

  let currentLayers: readonly ResolvedLayer[] = [];
  let currentViewCrs: CrsCode = "EPSG:3857";

  const controllerFor = (key: string): DatasetLayerController => {
    let controller = controllers.get(key);
    if (controller === undefined) {
      controller = new DatasetLayerController(map, statusStore);
      controllers.set(key, controller);
    }
    return controller;
  };

  const reconcileAll = (): void => {
    const usedKeys = new Set<string>();
    const usedLayerIds: string[] = [];
    const scaleDenominator = scaleDenominatorOf(map, currentViewCrs);

    for (const batch of planWmsBatches(currentLayers, currentViewCrs)) {
      usedKeys.add(batch.key);
      const { unit, options, problems } = wmsBatchUnit(batch, cache, scaleDenominator);
      controllerFor(batch.key).reconcile(unit, options);
      for (const [layerId, problem] of problems) {
        usedLayerIds.push(layerId);
        statusStore.setDeclarationProblem(layerId, problem);
      }
    }

    for (const layer of currentLayers) {
      if (layer.type === "wms") continue;

      const result =
        layer.type === "wmts"
          ? wmtsLayerUnit(layer, currentViewCrs, cache)
          : layer.type === "xyz"
            ? xyzLayerUnit(layer, currentViewCrs)
            : layer.type === "wcs"
              ? wcsLayerUnit(layer)
              : vectorLayerUnit(layer, currentViewCrs, cache);

      usedKeys.add(layer.id);
      usedLayerIds.push(layer.id);
      controllerFor(layer.id).reconcile(result.unit, result.options);
      statusStore.setDeclarationProblem(layer.id, result.declarationProblem);
    }

    for (const [key, controller] of controllers) {
      if (usedKeys.has(key)) continue;
      controller.dispose();
      controllers.delete(key);
    }
    statusStore.retain(usedLayerIds);
  };

  const onViewSettled = (): void => reconcileAll();
  // Bound to the map, not the view: `setView` swaps the view instance, and
  // `change:view` is how a listener attached once survives that swap.
  map.on("moveend", onViewSettled);
  map.on("change:view", onViewSettled);

  const unsubscribeCache = cache.onChange(() => reconcileAll());

  return {
    update(layers, viewCrs) {
      currentLayers = layers;
      currentViewCrs = viewCrs;
      reconcileAll();
    },
    dispose() {
      map.un("moveend", onViewSettled);
      map.un("change:view", onViewSettled);
      unsubscribeCache();
      for (const controller of controllers.values()) controller.dispose();
      controllers.clear();
    },
  };
}
