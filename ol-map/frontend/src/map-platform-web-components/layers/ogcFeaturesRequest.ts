/**
 * What to ask an OGC API Features collection for, given what it says it
 * offers. Every choice degrades to the plain request the standard guarantees,
 * so a service that describes nothing is queried as one without any of this.
 */

import type { CrsCode, OgcFeaturesSource } from "@map-platform/core";
import type { OgcFeaturesOffer } from "@map-platform/core";
import type { ResolvedInspectField } from "@map-platform/core";

/** Services cap this at their own maximum and say so by returning fewer. */
export const DEFAULT_PAGE_REQUEST = 10000;

export type OgcRequestPlan = {
  /** Absent means the service's CRS84 default. */
  crs?: CrsCode;
  /** Absent means take whatever the service sends. */
  properties?: string[];
  pageSize: number;
};

/** The declared paths, the twins `extractHit` falls back to, and what link templates interpolate. */
function propertiesRead(fields: readonly ResolvedInspectField[]): string[] {
  const names = new Set<string>();
  for (const field of fields) {
    names.add(field.path);
    for (const alternate of field.alternatePaths) names.add(alternate);
    for (const [, path] of field.href?.matchAll(/\{props\.([^}]+)\}/g) ?? []) names.add(path);
  }
  return [...names];
}

export function planOgcRequest(
  source: OgcFeaturesSource,
  offer: OgcFeaturesOffer | undefined,
  viewCrs: CrsCode,
  fields: readonly ResolvedInspectField[],
): OgcRequestPlan {
  const wanted = propertiesRead(fields);

  // All-or-nothing: a partial selection silently blanks the fields left out,
  // and an unpublished name risks a rejected request.
  const trimmable =
    offer !== undefined &&
    offer.propertySelection &&
    offer.geometryProperty !== undefined &&
    wanted.length > 0 &&
    wanted.every((name) => offer.selectable.has(name));

  return {
    ...(offer?.crs.includes(viewCrs) === true ? { crs: viewCrs } : {}),
    ...(trimmable ? { properties: [offer.geometryProperty as string, ...wanted] } : {}),
    pageSize: source.pageSize ?? DEFAULT_PAGE_REQUEST,
  };
}
