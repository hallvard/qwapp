import { parseAppConfig, type AppConfig } from "@map-platform/core";
import type { FetchLike } from "./capabilities";

/**
 * Resolves a `src` string into a config. What `src` means is entirely the
 * provider's own choice — a URL for the default implementation below, a
 * config id for one backed by a REST service, anything else a host wants to
 * plug in instead. `MapCatalogViewElement` only ever calls it and awaits.
 */
export type AppConfigProvider = (src: string) => Promise<AppConfig>;

/** The default: `src` is a URL to a `layers.yaml`, fetched and parsed as-is. */
export function createUrlAppConfigProvider(
  fetchImpl: FetchLike = fetch.bind(globalThis),
): AppConfigProvider {
  return async (src: string): Promise<AppConfig> => {
    const res = await fetchImpl(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return parseAppConfig(await res.text());
  };
}
