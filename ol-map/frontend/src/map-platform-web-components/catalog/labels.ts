export type LayerCatalogLabels = {
  toggleGroup: (groupTitle: string) => string;
  toggleLayer: (layerTitle: string) => string;
  opacity: string;
};

export const DEFAULT_CATALOG_LABELS: LayerCatalogLabels = {
  toggleGroup: (title) => `Toggle ${title}`,
  toggleLayer: (title) => `Toggle ${title}`,
  opacity: "Opacity",
};
