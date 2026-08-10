import VectorSource from "ol/source/Vector";
import WFS from "ol/format/WFS";
import type { Extent } from "ol/extent";
import type { CrsCode, WfsSource as WfsSourceConfig } from "@map-platform/core";
import type { TrackedLayerStatus } from "../layerStatus";
import { createCoverage, type Box } from "./ogcFeaturesCoverage";

export function wfsRequestCrs(
  viewCrs: CrsCode,
  supportedCrs: readonly CrsCode[] | undefined,
): CrsCode {
  if (supportedCrs === undefined || supportedCrs.includes(viewCrs)) return viewCrs;
  return supportedCrs[0] ?? viewCrs;
}

/**
 * Bbox-limited because that is all the protocol offers: with
 * `ImplementsResultPaging FALSE` there is no offset to walk.
 */
export function createWfsSource(
  config: WfsSourceConfig,
  requestCrs: CrsCode,
  status: TrackedLayerStatus,
): VectorSource {
  const format = new WFS({ version: config.version });
  const coverage = createCoverage();

  const source: VectorSource = new VectorSource({
    strategy: (extent: Extent, resolution: number) => coverage.remaining(extent as Box, resolution),
    loader: (extent: Extent, _resolution, projection, success, failure) => {
      const load = async (): Promise<void> => {
        const url = new URL(config.url);
        url.searchParams.set("SERVICE", "WFS");
        url.searchParams.set("VERSION", config.version);
        url.searchParams.set("REQUEST", "GetFeature");
        url.searchParams.set(
          config.version === "2.0.0" ? "TYPENAMES" : "TYPENAME",
          config.typeName,
        );
        url.searchParams.set("SRSNAME", requestCrs);
        // The fifth element is not optional: without it the service answers with nothing.
        url.searchParams.set("BBOX", [...extent.map(Math.round), requestCrs].join(","));

        status.begin();
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const features = format.readFeatures(await response.text(), {
            // What was asked for, not what the response echoes: a URN srsName
            // names no projection OpenLayers has registered.
            dataProjection: requestCrs,
            featureProjection: projection,
          });
          source.addFeatures(features);
          coverage.cover(extent as Box);
          status.end();
          success?.(source.getFeaturesInExtent(extent));
        } catch {
          status.fail(`${config.url}: feature type "${config.typeName}" could not be read`);
          // The extent stays marked loaded: handing it back has the strategy
          // ask again on the next frame, forever, for a reproducible failure.
          failure?.();
        }
      };
      void load();
    },
  });

  return source;
}
