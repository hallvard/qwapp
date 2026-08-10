import {
  checkWmsDeclaration,
  unionScaleWindow,
  wmsOfferedScaleWindow,
  type ScaleWindow,
  type WmsCapabilities,
} from "@map-platform/core";

export type WmsService = { capabilities?: WmsCapabilities; problem?: string };

/** What the service says it will draw for a declaration; `LAYERS` may name several. */
export function offeredWindowOf(
  capabilities: WmsCapabilities | undefined,
  layer: string,
): ScaleWindow {
  const names = layer.split(",").map((name) => name.trim());
  return unionScaleWindow(
    names.map((name) => wmsOfferedScaleWindow(capabilities?.layers.get(name))),
  );
}

/** Why a WMS layer cannot render, once the service has answered. `null` while in flight or fine. */
export function wmsDeclarationProblem(
  service: WmsService,
  url: string,
  name: string,
): string | null {
  if (service.problem !== undefined) return service.problem;
  if (service.capabilities === undefined) return null;
  const problem = checkWmsDeclaration(service.capabilities, name);
  return problem === null ? null : `${url}: ${problem}`;
}
