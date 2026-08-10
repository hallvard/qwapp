import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import type { CrsCode, ResolvedXyzLayer } from "@map-platform/core";
import { drawnLayer, type LayerUnitResult } from "../datasetLayer";

/**
 * Interprets a `type: xyz` declaration. The scheme cuts its tiles for
 * EPSG:3857 and nothing else, so it renders only there rather than have OL
 * reproject pre-rendered tiles and resample them.
 */
export function xyzLayerUnit(layer: ResolvedXyzLayer, viewCrs: CrsCode): LayerUnitResult {
  const { source } = layer;
  const servable = viewCrs === "EPSG:3857";

  return {
    unit: drawnLayer(layer),
    options: {
      create: (options, status) => {
        const xyzSource = new XYZ({
          url: source.url,
          crossOrigin: "anonymous",
          ...(source.attributions !== undefined ? { attributions: source.attributions } : {}),
          ...(source.maxZoom !== undefined ? { maxZoom: source.maxZoom } : {}),
        });
        xyzSource.on("tileloadstart", () => status.begin());
        xyzSource.on("tileloadend", () => {
          status.end();
          status.succeed();
        });
        xyzSource.on("tileloaderror", () => status.fail(`${source.url}: a tile failed to load`));
        return new TileLayer({ source: xyzSource, ...options });
      },
      deps: [source],
      enabled: servable,
    },
    declarationProblem: servable ? null : `slippy-map tiles are EPSG:3857 only, not ${viewCrs}`,
  };
}
