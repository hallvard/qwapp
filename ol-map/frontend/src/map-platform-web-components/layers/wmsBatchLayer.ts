import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import type BaseLayer from "ol/layer/Base";
import {
  effectiveScaleWindow,
  isInScaleWindow,
  unionScaleWindow,
  wmsBatchRequest,
  type ResolvedWmsLayer,
  type ScaleWindow,
  type WmsBatch,
} from "@map-platform/core";
import type { CapabilitiesCache } from "../capabilities";
import type { DatasetLayerOptions, DrawnUnit } from "../datasetLayer";
import { offeredWindowOf, wmsDeclarationProblem, type WmsService } from "./wms";

const GUTTER = 20;

export type WmsBatchUnitResult = {
  unit: DrawnUnit;
  options: DatasetLayerOptions;
  /** Per member id — `LAYERS` may draw several declarations from one request. */
  problems: ReadonlyMap<string, string | null>;
};

/**
 * Interprets one WMS batch: several declarations sharing a `TileWMS` request.
 * `create` builds the OL layer once per URL/CRS; `update` rewrites `LAYERS`
 * on the existing source as scale and visibility change which members are
 * currently drawable, so the tile cache survives a zoom instead of a rebuild.
 */
export function wmsBatchUnit(
  batch: WmsBatch,
  cache: CapabilitiesCache,
  scaleDenominator: number | undefined,
): WmsBatchUnitResult {
  const capState = cache.wms(batch.url);
  const service: WmsService = {
    ...(capState.data !== undefined ? { capabilities: capState.data } : {}),
    ...(capState.error !== undefined ? { problem: capState.error } : {}),
  };

  const windows = new Map<string, ScaleWindow>();
  const problems = new Map<string, string | null>();
  for (const member of batch.members) {
    windows.set(
      member.id,
      effectiveScaleWindow(
        { minScale: member.minScale, maxScale: member.maxScale },
        offeredWindowOf(service.capabilities, member.source.layer),
      ),
    );
    problems.set(member.id, wmsDeclarationProblem(service, batch.url, member.source.layer));
  }

  const drawable = (member: ResolvedWmsLayer): boolean => {
    if (!member.visible || problems.get(member.id) !== null) return false;
    if (scaleDenominator === undefined) return true;
    const window = windows.get(member.id) ?? {};
    return isInScaleWindow(scaleDenominator, window.minScale, window.maxScale);
  };

  const request = wmsBatchRequest(batch, drawable);

  const unit: DrawnUnit = {
    key: batch.key,
    covers: batch.members.map((member) => ({
      id: member.id,
      window: windows.get(member.id) ?? {},
    })),
    drawing: () => request?.drawing.map((member) => member.id) ?? [],
    visible: request !== undefined,
    opacity: batch.opacity,
    zIndex: batch.zIndex,
    window: unionScaleWindow([...windows.values()]),
  };

  const update = (olLayer: BaseLayer): void => {
    if (request === undefined) return;
    const source = (olLayer as TileLayer<TileWMS>).getSource();
    if (source === null) return;
    const current = source.getParams() as { LAYERS?: string; STYLES?: string };
    if (current.LAYERS === request.layers && current.STYLES === request.styles) return;
    source.updateParams({
      LAYERS: request.layers,
      ...(request.styles !== undefined ? { STYLES: request.styles } : {}),
    });
  };

  return {
    unit,
    options: {
      create: (options, status) => {
        const source = new TileWMS({
          url: batch.url,
          params: { LAYERS: "", TILED: true },
          projection: batch.requestCrs,
          gutter: GUTTER,
          crossOrigin: "anonymous",
          ...(batch.attributions !== undefined ? { attributions: batch.attributions } : {}),
        });
        source.on("tileloadstart", () => status.begin());
        source.on("tileloadend", () => {
          status.end();
          status.succeed();
        });
        source.on("tileloaderror", () => status.fail(`${batch.url}: a tile failed to load`));
        return new TileLayer({ source, ...options });
      },
      update,
      deps: [batch.url, batch.requestCrs],
    },
    problems,
  };
}
