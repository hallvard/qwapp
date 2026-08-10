import { fromArrayBuffer } from "geotiff";

export type CoverageTileRequest = {
  /** Tried in order; a service that refuses one version may answer another. */
  urls: string[];
  size: number;
  bandCount: number;
  noData?: number;
  signal?: AbortSignal | null;
};

const isXml = (contentType: string): boolean =>
  contentType.includes("xml") || contentType.includes("se_xml");

/**
 * One coverage window as interleaved [value, valid] pairs.
 *
 * A service that cannot answer reports it as an OGC exception with HTTP 200
 * and an XML body, so the content type is checked rather than the status.
 */
export async function readCoverageTile(request: CoverageTileRequest): Promise<Float32Array> {
  const failures: string[] = [];

  for (const url of request.urls) {
    try {
      const response = await fetch(url, { signal: request.signal ?? null });
      if (!response.ok) {
        failures.push(`HTTP ${response.status}`);
        continue;
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      const payload = await response.arrayBuffer();
      if (isXml(contentType)) {
        failures.push(exceptionTextOf(payload) ?? "the service returned an exception");
        continue;
      }
      return await decodeCoverage(payload, request);
    } catch (error) {
      if (request.signal?.aborted === true) throw error;
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(failures[0] ?? "no coverage request succeeded");
}

function exceptionTextOf(payload: ArrayBuffer): string | undefined {
  const body = new TextDecoder().decode(payload);
  const match = /<(?:[a-z0-9]+:)?(?:ExceptionText|ServiceException)[^>]*>([^<]+)</i.exec(body);
  return match?.[1].trim();
}

async function decodeCoverage(
  payload: ArrayBuffer,
  request: CoverageTileRequest,
): Promise<Float32Array> {
  const tiff = await fromArrayBuffer(payload);
  const image = await tiff.getImage();
  const rasters = await image.readRasters({
    width: request.size,
    height: request.size,
    fillValue: request.noData,
  });
  const values = Array.isArray(rasters) ? rasters[0] : rasters;
  if (typeof values === "number" || values === undefined) {
    throw new Error("the coverage carried no raster band");
  }

  const pixels = request.size * request.size;
  const tile = new Float32Array(pixels * request.bandCount);
  const declaredNoData = request.noData;
  const fileNoData = Number(image.getGDALNoData());
  const noData = declaredNoData ?? (Number.isFinite(fileNoData) ? fileNoData : undefined);

  for (let index = 0; index < pixels; index += 1) {
    const value = Number((values as ArrayLike<number>)[index]);
    const valid = Number.isFinite(value) && (noData === undefined || value !== noData);
    const base = index * request.bandCount;
    tile[base] = valid ? value : 0;
    tile[base + 1] = valid ? 1 : 0;
  }
  return tile;
}
