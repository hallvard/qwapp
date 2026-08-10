import WMTS, { optionsFromCapabilities } from "ol/source/WMTS";

/** WMTS source for one layer/matrixSet out of a parsed capabilities document. */
export function wmtsSourceFromCapabilities(
  capabilities: unknown,
  layer: string,
  matrixSet: string,
): WMTS | null {
  const options = optionsFromCapabilities(capabilities as object, { layer, matrixSet });
  if (options === null) return null;
  return new WMTS({ ...options, crossOrigin: "anonymous" });
}
