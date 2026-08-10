import { groupLayersOf, type ResolvedGroup, type ResolvedLayer } from "@map-platform/core";
import { DEFAULT_CATALOG_LABELS, type LayerCatalogLabels } from "./labels";
import { RowController } from "./row";

export type VisibilityChangeDetail = { ids: readonly string[]; visible: boolean };
export type OpacityChangeDetail = { id: string; opacity: number };

const CSS = `
.mp-layer-catalog, .mp-catalog-content { display: flex; flex-direction: column; }
.mp-catalog-row-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: calc(var(--mp-catalog-depth, 0) * 1rem);
}
.mp-catalog-details { flex: 1 1 auto; }
.mp-catalog-opacity { display: block; width: 100%; margin-block-start: 0.25rem; }
`;

/**
 * `<mp-layer-catalog>`: a resolved catalog (`ResolvedConfig.catalog`) in,
 * expand/collapse plus visibility and opacity `CustomEvent`s out. A smaller
 * surface than `@map-platform/react-ui`'s `LayerCatalog` on purpose — no
 * status, color or legend controls, since those need either a load-status
 * store or a vector layer to act on, and this element's map counterpart
 * (`MapPlatformViewElement`) doesn't carry either yet.
 */
export class MapLayerCatalogElement extends HTMLElement {
  #groups: readonly ResolvedGroup[] = [];
  #labels: LayerCatalogLabels = DEFAULT_CATALOG_LABELS;
  readonly #root: HTMLDivElement;
  readonly #rows = new Map<string, RowController>();

  constructor() {
    super();
    // A child of this element, not `document.head`: a host may place this
    // element inside another component's shadow root (a Lit view, say), and
    // a shadow root is its own CSS tree scope — a stylesheet in the outer
    // document's head never reaches into it. A `<style>` sharing this
    // element's own tree scope does, wherever that scope turns out to be.
    const style = document.createElement("style");
    style.textContent = CSS;
    this.append(style);
    this.#root = document.createElement("div");
    this.#root.className = "mp-layer-catalog";
    this.append(this.#root);
  }

  connectedCallback(): void {
    if (getComputedStyle(this).display === "inline") this.style.display = "block";
  }

  get groups(): readonly ResolvedGroup[] {
    return this.#groups;
  }
  set groups(value: readonly ResolvedGroup[]) {
    this.#groups = value;
    this.#reconcile();
  }

  get labels(): LayerCatalogLabels {
    return this.#labels;
  }
  set labels(value: Partial<LayerCatalogLabels>) {
    this.#labels = { ...DEFAULT_CATALOG_LABELS, ...value };
    this.#reconcile();
  }

  #reconcile(): void {
    reconcileChildren(
      this.#root,
      this.#rows,
      [],
      this.#groups,
      0,
      this.#labels,
      (ids, visible) => this.#emitVisibility(ids, visible),
      (id, opacity) => this.#emitOpacity(id, opacity),
    );
  }

  #emitVisibility(ids: readonly string[], visible: boolean): void {
    this.dispatchEvent(
      new CustomEvent<VisibilityChangeDetail>("visibilitychange", { detail: { ids, visible } }),
    );
  }

  #emitOpacity(id: string, opacity: number): void {
    this.dispatchEvent(
      new CustomEvent<OpacityChangeDetail>("opacitychange", { detail: { id, opacity } }),
    );
  }
}

function reconcileChildren(
  container: HTMLElement,
  rowMap: Map<string, RowController>,
  layers: readonly ResolvedLayer[],
  groups: readonly ResolvedGroup[],
  depth: number,
  labels: LayerCatalogLabels,
  onVisibility: (ids: readonly string[], visible: boolean) => void,
  onOpacity: (id: string, opacity: number) => void,
): void {
  const orderedKeys: string[] = [];

  for (const layer of layers) {
    const key = `layer:${layer.id}`;
    orderedKeys.push(key);
    let row = rowMap.get(key);
    if (row === undefined) {
      row = new RowController("layer");
      rowMap.set(key, row);
    }
    row.update({
      title: layer.title,
      checked: layer.visible,
      indeterminate: false,
      toggleLabel: labels.toggleLayer(layer.title),
      depth,
      onToggle: (checked) => onVisibility([layer.id], checked),
    });
    row.setOpacityControl({
      value: layer.opacity,
      label: labels.opacity,
      onChange: (value) => onOpacity(layer.id, value),
    });
  }

  for (const group of groups) {
    const key = `group:${group.id}`;
    const isNew = !rowMap.has(key);
    orderedKeys.push(key);
    let row = rowMap.get(key);
    if (row === undefined) {
      row = new RowController("group");
      rowMap.set(key, row);
    }
    const members = groupLayersOf(group);
    const visibleCount = members.filter((member) => member.visible).length;
    row.update({
      title: group.title,
      checked: members.length > 0 && visibleCount === members.length,
      indeterminate: visibleCount > 0 && visibleCount < members.length,
      toggleLabel: labels.toggleGroup(group.title),
      depth,
      ...(isNew ? { defaultOpen: visibleCount > 0 } : {}),
      onToggle: (checked) =>
        onVisibility(
          members.map((member) => member.id),
          checked,
        ),
    });
    reconcileChildren(
      row.content,
      row.childRows,
      group.layers,
      group.groups,
      depth + 1,
      labels,
      onVisibility,
      onOpacity,
    );
  }

  for (const [key, row] of [...rowMap]) {
    if (orderedKeys.includes(key)) continue;
    row.element.remove();
    rowMap.delete(key);
  }
  orderedKeys.forEach((key, index) => {
    const row = rowMap.get(key);
    if (row === undefined) return;
    const currentAtIndex = container.children[index];
    if (currentAtIndex !== row.element) container.insertBefore(row.element, currentAtIndex ?? null);
  });
}

export function defineMapLayerCatalog(tagName = "mp-layer-catalog"): void {
  if (customElements.get(tagName) === undefined) {
    customElements.define(tagName, MapLayerCatalogElement);
  }
}
