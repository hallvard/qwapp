import WebGLTileLayer from "ol/layer/WebGLTile";
import DataTileSource from "ol/source/DataTile";
import { createXYZ } from "ol/tilegrid";
import { grownWindow, wcsCoverageUrls, type ResolvedWcsLayer } from "@map-platform/core";
import { drawnLayer, type LayerUnitResult } from "../datasetLayer";
import { hillshadeStyle } from "./hillshade";
import { readCoverageTile } from "./wcsTile";

const GUTTER = 16;
const BAND_COUNT = 2;
const MAX_ZOOM = 24;

/**
 * Interprets a `type: wcs` declaration. A coverage carries values rather than
 * pictures, so the tiles are decoded into an elevation band and a validity
 * band and shaded here — which is the whole reason to ask a WCS for something
 * a WMS would have drawn already.
 */
export function wcsLayerUnit(layer: ResolvedWcsLayer): LayerUnitResult {
  const { source, light } = layer;

  return {
    unit: drawnLayer(layer),
    options: {
      create: (options, status) => {
        const tileGrid = createXYZ({
          ...(source.extent !== undefined ? { extent: source.extent } : {}),
          tileSize: source.tileSize,
          maxZoom: MAX_ZOOM,
        });

        const dataSource = new DataTileSource({
          projection: source.crs,
          tileGrid,
          bandCount: BAND_COUNT,
          gutter: GUTTER,
          interpolate: true,
          transition: 250,
          ...(source.attributions !== undefined ? { attributions: source.attributions } : {}),
          loader: async (z, x, y, loaderOptions) => {
            const extent = tileGrid.getTileCoordExtent([z, x, y]) as [
              number,
              number,
              number,
              number,
            ];
            const window = grownWindow(extent, source.tileSize, GUTTER);
            status.begin();
            try {
              const tile = await readCoverageTile({
                urls: wcsCoverageUrls(source, window),
                size: window.width,
                bandCount: BAND_COUNT,
                ...(source.noData !== undefined ? { noData: source.noData } : {}),
                signal: loaderOptions.signal,
              });
              status.end();
              status.succeed();
              return tile;
            } catch (error) {
              status.fail(
                `${source.url}: ${error instanceof Error ? error.message : "a coverage tile failed"}`,
              );
              throw error;
            }
          },
        });

        return new WebGLTileLayer({ source: dataSource, style: hillshadeStyle(light), ...options });
      },
      deps: [source, light],
    },
    declarationProblem: null,
  };
}
