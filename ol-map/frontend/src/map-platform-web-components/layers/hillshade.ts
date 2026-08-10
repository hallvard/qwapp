import type { Style } from "ol/layer/WebGLTile";
import type { LightConfig } from "@map-platform/core";

type Expression = unknown[] | number;

const band = (index: number, dx = 0, dy = 0): Expression => ["band", index, dx, dy];

const sum = (parts: Expression[]): Expression => parts.reduce((left, right) => ["+", left, right]);

/**
 * Relief shading over an elevation band and a validity band, as an OpenLayers
 * WebGL tile style. Band 1 is the coverage's own values; band 2 is 1 where a
 * value is real and 0 where the service returned its nodata, which is what
 * lets the edge of the data fade out instead of shading a cliff into nothing.
 */
export function hillshadeStyle(light: Required<LightConfig>): Style {
  const azimuth = (light.azimuth * Math.PI) / 180;
  const altitude = (light.altitude * Math.PI) / 180;

  const valid = sum([
    band(2, -1, -1),
    band(2, 0, -1),
    band(2, 1, -1),
    band(2, -1, 0),
    band(2, 0, 0),
    band(2, 1, 0),
    band(2, -1, 1),
    band(2, 0, 1),
    band(2, 1, 1),
  ]);
  const alpha: Expression = ["case", ["<", valid, 9], 0, 1];

  const elevation = (dx: number, dy: number): Expression => band(1, dx, dy);
  const run: Expression = ["*", 8, ["resolution"]];

  const slopeX: Expression = [
    "*",
    light.exaggeration,
    [
      "/",
      [
        "-",
        sum([elevation(1, -1), ["*", 2, elevation(1, 0)], elevation(1, 1)]),
        sum([elevation(-1, -1), ["*", 2, elevation(-1, 0)], elevation(-1, 1)]),
      ],
      run,
    ],
  ];

  const slopeY: Expression = [
    "*",
    light.exaggeration,
    [
      "/",
      [
        "-",
        sum([elevation(-1, 1), ["*", 2, elevation(0, 1)], elevation(1, 1)]),
        sum([elevation(-1, -1), ["*", 2, elevation(0, -1)], elevation(1, -1)]),
      ],
      run,
    ],
  ];

  const normalX: Expression = ["*", -1, slopeX];
  const normalY: Expression = ["*", -1, slopeY];
  const inverseLength: Expression = [
    "/",
    1,
    ["sqrt", sum([1, ["*", normalX, normalX], ["*", normalY, normalY]])],
  ];

  const lambert = sum([
    ["*", normalX, Math.cos(altitude) * Math.cos(azimuth)],
    ["*", normalY, Math.cos(altitude) * Math.sin(azimuth)],
    Math.sin(altitude),
  ]);

  const shaded: Expression = ["clamp", ["*", lambert, inverseLength], 0, 1];
  const contrasted: Expression = [
    "clamp",
    ["+", 0.5, ["*", ["-", shaded, 0.5], 1 + (light.contrast / 100) * 2]],
    0,
    1,
  ];

  return {
    color: ["color", ["*", 255, contrasted], ["*", 255, contrasted], ["*", 255, contrasted], alpha],
  };
}
