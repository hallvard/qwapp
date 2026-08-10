import type { FlatStyle } from "ol/style/flat";
import type { VectorStyle } from "@map-platform/core";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Interpret the config's declarative vector style as an OL flat style (canvas + WebGL). */
export function toFlatStyle(style: VectorStyle): FlatStyle {
  return {
    "circle-radius": style.pointRadius,
    "circle-fill-color": hexToRgba(style.color, 0.85),
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
    "stroke-color": style.color,
    "stroke-width": style.strokeWidth,
    "fill-color": hexToRgba(style.color, style.fillOpacity),
  };
}
