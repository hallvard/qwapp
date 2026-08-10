import VectorLayer from "ol/layer/Vector";
import WebGLVectorLayer from "ol/layer/WebGLVector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import type BaseLayer from "ol/layer/Base";
import type { CrsCode, ResolvedVectorLayer } from "@map-platform/core";
import type { CapabilitiesCache } from "../capabilities";
import { drawnLayer, type LayerUnitResult } from "../datasetLayer";
import { toFlatStyle } from "./flatStyle";
import { createOgcFeaturesSource } from "./ogcFeaturesSource";
import { planOgcRequest, type OgcRequestPlan } from "./ogcFeaturesRequest";
import { createWfsSource, wfsRequestCrs } from "./wfsSource";

/**
 * Interprets `type: geojson`, `type: wfs` and `type: ogc-features`
 * declarations. The declared `render` picks WebGL or canvas.
 */
export function vectorLayerUnit(
  layer: ResolvedVectorLayer,
  viewCrs: CrsCode,
  cache: CapabilitiesCache,
): LayerUnitResult {
  let ready = true;
  let plan: OgcRequestPlan | undefined;
  if (layer.type === "ogc-features") {
    const { data: offer, error } = cache.ogcFeaturesOffer(
      layer.source.url,
      layer.source.collection,
    );
    ready = offer !== undefined || error !== undefined;
    plan = planOgcRequest(layer.source, offer, viewCrs, layer.inspect ?? []);
  }

  const requestCrs = layer.type === "wfs" ? wfsRequestCrs(viewCrs, layer.supportedCrs) : undefined;

  return {
    unit: drawnLayer(layer),
    options: {
      create: (options, status) => {
        let vectorSource: VectorSource;
        if (layer.type === "ogc-features") {
          if (plan === undefined) return null;
          vectorSource = createOgcFeaturesSource(layer.source, plan, status);
        } else if (layer.type === "wfs") {
          vectorSource = createWfsSource(layer.source, requestCrs ?? viewCrs, status);
        } else {
          const { url } = layer.source;
          vectorSource = new VectorSource({ url, format: new GeoJSON() });
          vectorSource.on("featuresloadstart", () => status.begin());
          vectorSource.on("featuresloadend", () => status.end());
          vectorSource.on("featuresloaderror", () => status.fail(`${url}: could not be read`));
        }
        if (layer.source.attributions !== undefined) {
          vectorSource.setAttributions(layer.source.attributions);
        }
        const layerOptions = { source: vectorSource, style: toFlatStyle(layer.style), ...options };
        return layer.render === "webgl"
          ? new WebGLVectorLayer(layerOptions)
          : new VectorLayer(layerOptions);
      },
      update: (olLayer: BaseLayer) => {
        (olLayer as VectorLayer | WebGLVectorLayer).setStyle(
          toFlatStyle({ ...layer.style, color: layer.color }),
        );
      },
      enabled: ready,
      // viewCrs is a real dependency: features are stored in view coordinates.
      deps: [layer.source, layer.render, viewCrs, plan, requestCrs],
    },
    declarationProblem: null,
  };
}
