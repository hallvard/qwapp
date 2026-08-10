import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { get as getProjection, getPointResolution, transform } from "ol/proj";
import type { Coordinate } from "ol/coordinate";
import type { CrsCode } from "@map-platform/core";

/**
 * Teach OpenLayers the projections this config uses. Has to run before a view
 * is built — the element calls it as soon as `projections` is set.
 */
export function registerProjections(defs: Record<string, string>): void {
  for (const [code, definition] of Object.entries(defs)) proj4.defs(code, definition);
  register(proj4);
}

export function projectionFor(crs: CrsCode) {
  const projection = getProjection(crs);
  if (projection === null) throw new Error(`projection ${crs} is not registered`);
  return projection;
}

export function lonLatToCrs(lonLat: Coordinate, crs: CrsCode): Coordinate {
  return transform(lonLat, "EPSG:4326", crs);
}

export function crsToLonLat(coordinate: Coordinate, crs: CrsCode): Coordinate {
  return transform(coordinate, crs, "EPSG:4326");
}

/** Ground meters per pixel → scale denominator, at the OGC 0.28 mm pixel. */
export function resolutionToScaleDenominator(
  resolution: number,
  crs: CrsCode,
  centerLonLat: Coordinate,
): number {
  const ground = getPointResolution(projectionFor(crs), resolution, lonLatToCrs(centerLonLat, crs));
  return ground / 0.00028;
}
