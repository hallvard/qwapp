import {
  defaultLanguage,
  resolveConfig,
  type AppConfig,
  type Language,
  type LayerDeparture,
  type ResolvedConfig,
} from "@map-platform/core";
import { createUrlAppConfigProvider, type AppConfigProvider } from "./appConfigProvider";
import type { FetchLike } from "./capabilities";
import {
  MapLayerCatalogElement,
  type OpacityChangeDetail,
  type VisibilityChangeDetail,
} from "./catalog/element";
import type { LayerCatalogLabels } from "./catalog/labels";
import { MapPlatformViewElement, type LayerStatusEventDetail } from "./element";

const TEMPLATE_CSS = `
:host { display: flex; gap: 1rem; }
::slotted([slot="catalog"]) { flex: 0 0 18rem; overflow: auto; }
::slotted([slot="map"]) { flex: 1 1 auto; }
`;

/**
 * `<mp-map-catalog>`: a config URL in, a linked map and layer catalog out.
 * Owns the controller that `@map-platform/react-ui`'s app leaves to the app
 * and qwapp's `ol-map` module used to hand-roll — fetch the config, resolve
 * it, wire the catalog's `visibilitychange`/`opacitychange` events into a
 * fresh resolve on every change, push the result back into both.
 *
 * `<mp-map-view>` and `<mp-layer-catalog>` are created internally and
 * projected through named slots (`map`, `catalog`) rather than held in a
 * shadow tree of their own: a host's Designsystemet (or any other) styling
 * reaches slotted content in its own original scope, same as if the host had
 * placed them directly — this element only owns their layout, not their
 * tree scope.
 */
export class MapCatalogViewElement extends HTMLElement {
  #src: string | undefined;
  #showCatalog = true;
  #labels: Partial<LayerCatalogLabels> | undefined;
  #fetchImpl: FetchLike = fetch.bind(globalThis);
  #configProvider: AppConfigProvider = createUrlAppConfigProvider();

  #config: AppConfig | undefined;
  #language: Language = "nb";
  #overrides = new Map<string, LayerDeparture>();
  #resolved: ResolvedConfig | undefined;

  readonly #mapEl: MapPlatformViewElement;
  #catalogEl: MapLayerCatalogElement | undefined;

  static get observedAttributes(): string[] {
    return ["src", "show-catalog"];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = TEMPLATE_CSS;
    const catalogSlot = document.createElement("slot");
    catalogSlot.name = "catalog";
    const mapSlot = document.createElement("slot");
    mapSlot.name = "map";
    shadow.append(style, catalogSlot, mapSlot);

    this.#mapEl = new MapPlatformViewElement();
    this.#mapEl.slot = "map";
    this.#mapEl.addEventListener("layerstatuschange", (event) => {
      this.dispatchEvent(
        new CustomEvent<LayerStatusEventDetail>("layerstatuschange", {
          detail: (event as CustomEvent<LayerStatusEventDetail>).detail,
        }),
      );
    });
    this.append(this.#mapEl);
    this.#syncCatalogPresence();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "src") this.src = value ?? undefined;
    else if (name === "show-catalog") this.showCatalog = value !== "false";
  }

  get src(): string | undefined {
    return this.#src;
  }
  set src(value: string | undefined) {
    if (value === this.#src) return;
    this.#src = value;
    if (value !== undefined) void this.#load(value);
  }

  get showCatalog(): boolean {
    return this.#showCatalog;
  }
  set showCatalog(value: boolean) {
    if (value === this.#showCatalog) return;
    this.#showCatalog = value;
    this.#syncCatalogPresence();
  }

  get labels(): Partial<LayerCatalogLabels> | undefined {
    return this.#labels;
  }
  set labels(value: Partial<LayerCatalogLabels> | undefined) {
    this.#labels = value;
    if (this.#catalogEl !== undefined && value !== undefined) this.#catalogEl.labels = value;
  }

  /** Swaps how the map's own capabilities are fetched — auth headers, a proxy, a test double. */
  get fetchImpl(): FetchLike {
    return this.#fetchImpl;
  }
  set fetchImpl(value: FetchLike) {
    this.#fetchImpl = value;
    this.#mapEl.fetchImpl = value;
  }

  /**
   * How `src` becomes an `AppConfig` — a URL fetched and parsed as YAML by
   * default (`createUrlAppConfigProvider`), but `src` could just as well be
   * an id a REST-backed provider resolves instead. Independent of
   * `fetchImpl`: that only ever affects the map's capabilities fetches, not
   * this one, since a custom provider might not use `fetch` at all. Pass
   * `createUrlAppConfigProvider(fetchImpl)` explicitly to reuse one.
   */
  get configProvider(): AppConfigProvider {
    return this.#configProvider;
  }
  set configProvider(value: AppConfigProvider) {
    this.#configProvider = value;
    if (this.#src !== undefined) void this.#load(this.#src);
  }

  async #load(src: string): Promise<void> {
    try {
      this.#config = await this.#configProvider(src);
      this.#language = defaultLanguage(this.#config);
      this.#overrides = new Map();
      this.#resolved = undefined;
      this.#applyMapView(this.#config);
      this.#reresolve();
      this.dispatchEvent(new Event("load"));
    } catch (error) {
      // Not "error": that name is reserved for the DOM's own `ErrorEvent`,
      // which carries no `detail` — reusing it would misdeclare this one.
      this.dispatchEvent(
        new CustomEvent("loaderror", {
          detail: { message: error instanceof Error ? error.message : String(error) },
        }),
      );
    }
  }

  #applyMapView(config: AppConfig): void {
    this.#mapEl.viewCrs = config.map.defaultCrs;
    this.#mapEl.center = config.map.center;
    this.#mapEl.resolution = config.map.resolution;
    if (config.map.minScale !== undefined) this.#mapEl.minScale = config.map.minScale;
    if (config.map.maxScale !== undefined) this.#mapEl.maxScale = config.map.maxScale;
  }

  #setOverride(id: string, patch: LayerDeparture): void {
    this.#overrides.set(id, { ...this.#overrides.get(id), ...patch });
  }

  #reresolve(): void {
    if (this.#config === undefined) return;
    this.#resolved = resolveConfig(this.#config, this.#overrides, this.#language, this.#resolved);
    this.#mapEl.layers = this.#resolved.layers;
    if (this.#catalogEl !== undefined) this.#catalogEl.groups = this.#resolved.catalog;
  }

  #syncCatalogPresence(): void {
    if (this.#showCatalog && this.#catalogEl === undefined) {
      const catalogEl = new MapLayerCatalogElement();
      catalogEl.slot = "catalog";
      if (this.#labels !== undefined) catalogEl.labels = this.#labels;
      catalogEl.addEventListener("visibilitychange", (event) => {
        const { ids, visible } = (event as CustomEvent<VisibilityChangeDetail>).detail;
        for (const id of ids) this.#setOverride(id, { visible });
        this.#reresolve();
      });
      catalogEl.addEventListener("opacitychange", (event) => {
        const { id, opacity } = (event as CustomEvent<OpacityChangeDetail>).detail;
        this.#setOverride(id, { opacity });
        this.#reresolve();
      });
      this.append(catalogEl);
      this.#catalogEl = catalogEl;
      if (this.#resolved !== undefined) catalogEl.groups = this.#resolved.catalog;
    } else if (!this.#showCatalog && this.#catalogEl !== undefined) {
      this.#catalogEl.remove();
      this.#catalogEl = undefined;
    }
  }
}

export function defineMapCatalogView(tagName = "mp-map-catalog"): void {
  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, MapCatalogViewElement);
  }
}
