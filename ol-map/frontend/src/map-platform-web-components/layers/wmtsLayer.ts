import TileLayer from "ol/layer/Tile";
import {
  checkWmtsDeclaration,
  effectiveScaleWindow,
  matrixSetFor,
  wmtsOfferedScaleWindow,
  type CrsCode,
  type ResolvedWmtsLayer,
} from "@map-platform/core";
import type { CapabilitiesCache } from "../capabilities";
import { drawnLayer, type LayerUnitResult } from "../datasetLayer";
import { wmtsSourceFromCapabilities } from "./wmtsSource";

/**
 * Interprets a `type: wmts` declaration. Renders only where the source
 * declares a TileMatrixSet for the view CRS: reprojecting pre-rendered tiles
 * would resample them.
 */
export function wmtsLayerUnit(
  layer: ResolvedWmtsLayer,
  viewCrs: CrsCode,
  cache: CapabilitiesCache,
): LayerUnitResult {
  const { source } = layer;
  const { data: capabilities, error } = cache.wmts(source.capabilitiesUrl);
  const matrixSet = matrixSetFor(source, viewCrs);

  const declared = { minScale: layer.minScale, maxScale: layer.maxScale };
  const offered =
    capabilities !== undefined && matrixSet !== undefined
      ? wmtsOfferedScaleWindow(capabilities, [matrixSet])
      : {};
  const scaleWindow = effectiveScaleWindow(declared, offered);

  const declarationProblem =
    error ??
    (capabilities !== undefined && matrixSet !== undefined
      ? checkWmtsDeclaration(capabilities, source.layer, matrixSet)
      : null);

  return {
    unit: drawnLayer(layer, scaleWindow),
    options: {
      create: (options, status) => {
        if (capabilities === undefined || matrixSet === undefined) return null;
        const wmtsSource = wmtsSourceFromCapabilities(capabilities, source.layer, matrixSet);
        if (wmtsSource === null) return null;
        if (source.attributions !== undefined) wmtsSource.setAttributions(source.attributions);
        wmtsSource.on("tileloadstart", () => status.begin());
        wmtsSource.on("tileloadend", () => {
          status.end();
          status.succeed();
        });
        wmtsSource.on("tileloaderror", () =>
          status.fail(`${source.capabilitiesUrl}: a tile failed to load`),
        );
        return new TileLayer({ source: wmtsSource, ...options });
      },
      deps: [source, matrixSet, capabilities],
      // A layer that declares no set for this CRS is opting out of it, not failing.
      enabled: matrixSet !== undefined && declarationProblem === null,
    },
    declarationProblem,
  };
}
