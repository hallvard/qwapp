import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { transformExtent } from "ol/proj";
import type { Extent } from "ol/extent";
import type { OgcFeaturesSource as OgcSourceConfig } from "@map-platform/core";
import { crsUri } from "@map-platform/core";
import type { TrackedLayerStatus } from "../layerStatus";
import { createCoverage, type Box } from "./ogcFeaturesCoverage";
import type { OgcRequestPlan } from "./ogcFeaturesRequest";

const PARALLEL_REQUESTS = 4;

type ItemsPage = {
  numberMatched?: number;
  features?: unknown[];
};

/**
 * OGC API Features as a bbox-limited vector source, asked only for ground it
 * has not already loaded. Page 1 reveals both how many features match and how
 * many the service will serve at once; the rest are fetched concurrently.
 */
export function createOgcFeaturesSource(
  config: OgcSourceConfig,
  plan: OgcRequestPlan,
  status: TrackedLayerStatus,
): VectorSource {
  const format = new GeoJSON({ dataProjection: plan.crs ?? "EPSG:4326" });
  const coverage = createCoverage();

  const source: VectorSource = new VectorSource({
    strategy: (extent: Extent, resolution: number) => coverage.remaining(extent as Box, resolution),
    loader: (extent: Extent, _resolution, projection, success, failure) => {
      const load = async (): Promise<void> => {
        const bbox =
          plan.crs !== undefined
            ? extent.map(Math.round).join(",")
            : transformExtent(extent, projection, "EPSG:4326")
                .map((n) => n.toFixed(6))
                .join(",");

        const pageUrl = (offset: number, limit: number): string => {
          const url = new URL(`${config.url}/collections/${config.collection}/items`);
          url.searchParams.set("f", "json");
          url.searchParams.set("bbox", bbox);
          url.searchParams.set("limit", String(limit));
          if (offset > 0) url.searchParams.set("offset", String(offset));
          if (plan.crs !== undefined) {
            url.searchParams.set("crs", crsUri(plan.crs));
            url.searchParams.set("bbox-crs", crsUri(plan.crs));
          }
          // Comma-joined, as OpenAPI serialises an array parameter by default.
          if (plan.properties !== undefined) {
            url.searchParams.set("properties", plan.properties.join(","));
          }
          return url.toString();
        };

        const readPage = async (offset: number, limit: number): Promise<ItemsPage> => {
          const res = await fetch(pageUrl(offset, limit));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as ItemsPage;
        };

        const addFeatures = (page: ItemsPage) => {
          const features = format.readFeatures(page, { featureProjection: projection });
          source.addFeatures(features);
          return features;
        };

        status.begin();
        try {
          const first = await readPage(0, plan.pageSize);
          const served = addFeatures(first).length;

          const matched = first.numberMatched ?? served;
          const offsets: number[] = [];
          if (served > 0) {
            for (let offset = served; offset < matched; offset += served) offsets.push(offset);
          }

          let cursor = 0;
          const worker = async (): Promise<void> => {
            while (cursor < offsets.length) {
              const offset = offsets[cursor++];
              addFeatures(await readPage(offset, served));
            }
          };
          await Promise.all(
            Array.from({ length: Math.min(PARALLEL_REQUESTS, offsets.length) }, worker),
          );

          coverage.cover(extent as Box);
          status.end();
          success?.(source.getFeaturesInExtent(extent));
        } catch {
          status.fail(`${config.url}: collection "${config.collection}" could not be read`);
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
