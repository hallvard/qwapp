// `ol/ol.css` (no `?inline`) relies on the consuming bundler emitting an app
// HTML page it can link a stylesheet into. This module is built as a bare
// library bundle with no HTML output, so the CSS is pulled in as text and
// injected as a real `<style>` element instead, as a child of this element
// rather than `document.head`: a host may place this element inside another
// component's shadow root (a Lit view, say), and a shadow root is its own CSS
// tree scope that a stylesheet in the outer document's head never reaches.
import olCss from "ol/ol.css?inline";
import OlMap from "ol/Map";
import View from "ol/View";
import Attribution from "ol/control/Attribution";
import ScaleLine from "ol/control/ScaleLine";
import Zoom from "ol/control/Zoom";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import { scaleDenominatorToResolution, type CrsCode, type ResolvedLayer } from "@map-platform/core";
import { CapabilitiesCache, type FetchLike } from "./capabilities";
import { crsToLonLat, lonLatToCrs, projectionFor, registerProjections } from "./crs";
import type { LayerStatus } from "./layerStatus";
import { createRenderer, type Renderer } from "./renderer";

export type LayerStatusEventDetail = { layerId: string; status: LayerStatus };
export type ViewChangeEventDetail = { center: [number, number]; resolution: number };

/**
 * A resolved-layers-in, DOM-events-out map. No React, no state library, no
 * query cache: `layers`/`viewCrs`/`center`/`resolution` are plain properties,
 * `layerstatuschange` and `viewchange` are plain `CustomEvent`s, and the only
 * required dependency besides `@map-platform/core` is OpenLayers itself.
 *
 * Click/inspection is deliberately not part of this element yet — a resolved
 * layer's `inspect` field is carried through untouched for a host to use, but
 * nothing here reads it.
 */
export class MapPlatformViewElement extends HTMLElement {
  readonly #root: HTMLDivElement;
  #map: OlMap | null = null;
  #renderer: Renderer | null = null;
  #cache: CapabilitiesCache;
  #fetchImpl: FetchLike;

  #layers: readonly ResolvedLayer[] = [];
  #viewCrs: CrsCode = "EPSG:3857";
  #center: [number, number] = [10.75, 59.91];
  #resolution = 1000;
  #minScale: number | undefined;
  #maxScale: number | undefined;

  constructor() {
    super();
    const style = document.createElement("style");
    style.textContent = olCss;
    this.append(style);
    this.#root = document.createElement("div");
    this.#root.style.width = "100%";
    this.#root.style.height = "100%";
    this.append(this.#root);
    this.#fetchImpl = fetch.bind(globalThis);
    this.#cache = new CapabilitiesCache(this.#fetchImpl);
  }

  /** Swaps how capabilities are fetched — auth headers, a proxy, a test double. */
  get fetchImpl(): FetchLike {
    return this.#fetchImpl;
  }
  set fetchImpl(value: FetchLike) {
    this.#fetchImpl = value;
    this.#cache = new CapabilitiesCache(value);
    this.#rebuildRenderer();
  }

  /** proj4 definitions for any CRS beyond what OL knows built in. */
  set projections(defs: Record<string, string>) {
    registerProjections(defs);
  }

  get layers(): readonly ResolvedLayer[] {
    return this.#layers;
  }
  set layers(value: readonly ResolvedLayer[]) {
    this.#layers = value;
    this.#reconcile();
  }

  get viewCrs(): CrsCode {
    return this.#viewCrs;
  }
  set viewCrs(value: CrsCode) {
    if (value === this.#viewCrs) return;
    this.#viewCrs = value;
    this.#rebuildView();
  }

  /** lon/lat. */
  get center(): [number, number] {
    return this.#center;
  }
  set center(value: [number, number]) {
    this.#center = value;
    this.#syncView();
  }

  /** Meters per pixel. */
  get resolution(): number {
    return this.#resolution;
  }
  set resolution(value: number) {
    this.#resolution = value;
    this.#syncView();
  }

  set minScale(value: number | undefined) {
    this.#minScale = value;
    this.#rebuildView();
  }
  set maxScale(value: number | undefined) {
    this.#maxScale = value;
    this.#rebuildView();
  }

  connectedCallback(): void {
    if (this.#map !== null) return;
    // No shadow root, so there is no `:host` to give this element a box by
    // default — an author who never set `display` on the tag would otherwise
    // get a zero-height element with no visible failure.
    if (getComputedStyle(this).display === "inline") this.style.display = "block";
    const map = new OlMap({
      target: this.#root,
      controls: [new Zoom(), new ScaleLine(), new Attribution({ collapsible: false })],
      // Shift-drag is left free for a host's own inspection gesture, the same
      // reason @map-platform/react disables it.
      interactions: defaultInteractions({ shiftDragZoom: false }),
      view: this.#buildView(),
    });
    map.on("moveend", () => this.#emitViewChange());
    this.#map = map;
    this.#renderer = createRenderer(map, this.#cache, {
      onStatusChange: (layerId, status) => this.#emitStatus(layerId, status),
    });
    this.#reconcile();
  }

  disconnectedCallback(): void {
    this.#renderer?.dispose();
    this.#renderer = null;
    this.#map?.setTarget(undefined);
    this.#map = null;
  }

  #buildView(): View {
    const projection = projectionFor(this.#viewCrs);
    return new View({
      projection,
      center: lonLatToCrs(this.#center, this.#viewCrs),
      resolution: this.#resolution,
      ...(this.#minScale !== undefined
        ? { minResolution: scaleDenominatorToResolution(this.#minScale) }
        : {}),
      ...(this.#maxScale !== undefined
        ? { maxResolution: scaleDenominatorToResolution(this.#maxScale) }
        : {}),
    });
  }

  #rebuildView(): void {
    if (this.#map === null) return;
    this.#map.setView(this.#buildView());
  }

  #syncView(): void {
    if (this.#map === null) return;
    const view = this.#map.getView();
    view.setCenter(lonLatToCrs(this.#center, this.#viewCrs));
    view.setResolution(this.#resolution);
  }

  #rebuildRenderer(): void {
    if (this.#map === null) return;
    this.#renderer?.dispose();
    this.#renderer = createRenderer(this.#map, this.#cache, {
      onStatusChange: (layerId, status) => this.#emitStatus(layerId, status),
    });
    this.#reconcile();
  }

  #reconcile(): void {
    this.#renderer?.update(this.#layers, this.#viewCrs);
  }

  #emitStatus(layerId: string, status: LayerStatus): void {
    this.dispatchEvent(
      new CustomEvent<LayerStatusEventDetail>("layerstatuschange", { detail: { layerId, status } }),
    );
  }

  #emitViewChange(): void {
    const view = this.#map?.getView();
    const center = view?.getCenter();
    const resolution = view?.getResolution();
    if (center === undefined || resolution === undefined) return;
    const lonLat = crsToLonLat(center, this.#viewCrs) as [number, number];
    this.dispatchEvent(
      new CustomEvent<ViewChangeEventDetail>("viewchange", {
        detail: { center: lonLat, resolution },
      }),
    );
  }
}

export function defineMapPlatformView(tagName = "mp-map-view"): void {
  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, MapPlatformViewElement);
  }
}
