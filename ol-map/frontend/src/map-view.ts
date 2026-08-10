import { LitElement, html } from 'lit';
import { defineMapCatalogView, MapCatalogViewElement, type LayerStatusEventDetail } from './map-platform-web-components';

defineMapCatalogView();

// Resolves relative to this module's own URL, not the page's — correct both
// as the built contribution bundle (module.js and these files sit side by
// side under /modules/ol-map/) and under plain `vite dev`.
const CONFIG_URL = new URL('mineralleting.yaml', import.meta.url).href;
const DESIGNSYSTEMET_CSS_URL = new URL('designsystemet.css', import.meta.url).href;
const DESIGNSYSTEMET_THEME_URL = new URL('designsystemet-theme.css', import.meta.url).href;

/** `qwapp.frontend.meta-tag.showLayerCatalog`, injected by FrontendShellResource. */
function showLayerCatalog(): boolean {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="env.showLayerCatalog"]');
  return meta?.content !== 'false';
}

let designsystemetTokensLinked = false;
/**
 * Two different CSS mechanisms need Designsystemet's stylesheets present in
 * two different places, and this covers the one `<ol-map-view>` itself can't:
 *
 * `:root{--ds-size-base: ...}` and friends only ever match the *real*
 * document's `<html>` — never a shadow host, at any depth — so these tokens
 * only get defined at all if linked here, at the true top level. Once
 * defined, though, their *values* inherit through shadow boundaries like any
 * other custom property (unlike selector-matched rules, which don't cross
 * them), reaching every `calc()`/`var()` that depends on them no matter how
 * many shadow roots sit in between — including qwapp-shell's, and now
 * `<mp-map-catalog>`'s own — neither of which this module owns or can change.
 *
 * The actual component rules (`.ds-input`, `.ds-details`) still need linking
 * a second time, in whatever scope those classes are actually used in — see
 * `render()` below. `<mp-map-catalog>` projects `<mp-layer-catalog>` through a
 * slot rather than holding it in a shadow tree of its own, so that scope is
 * still wherever this element's own light DOM ends up (qwapp-shell's shadow
 * root), same as before.
 */
function ensureDesignsystemetTokens(): void {
  if (designsystemetTokensLinked) return;
  designsystemetTokensLinked = true;
  for (const href of [DESIGNSYSTEMET_CSS_URL, DESIGNSYSTEMET_THEME_URL]) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }
}

/**
 * A plain layout rule like `display: flex` carries no value to inherit — it
 * has to be matched by selector in the same scope as what it targets, same
 * as the Designsystemet component rules below. `document.head` doesn't reach
 * across qwapp-shell's shadow boundary for that any more than it does for
 * those, so this has to be part of `render()`'s own light-DOM output too,
 * not a separate global injection.
 */
const LAYOUT_STYLE = html`
  <style>
    ol-map-view {
      display: block;
      font-family: system-ui, sans-serif;
    }
    ol-map-view h2 {
      margin: 0 0 0.75rem;
    }
    ol-map-view p {
      margin: 0 0 1rem;
      color: #444;
    }
    ol-map-view .map-container {
      height: min(65vh, 560px);
      border: 1px solid #d4d4d8;
      border-radius: 0.5rem;
      overflow: hidden;
    }
    ol-map-view mp-map-catalog {
      width: 100%;
      height: 100%;
    }
  </style>
`;

export class OlMapView extends LitElement {
  private error?: string;

  // Light DOM, not a shadow root: qwapp-shell (which hosts this element) has
  // a shadow root of its own already — a second one here would mean the
  // component-rule stylesheet linked in render() below has to cross *two*
  // shadow boundaries to reach <mp-layer-catalog> instead of one, and a
  // stylesheet's selector-matched rules don't cross any.
  protected createRenderRoot(): this {
    return this;
  }

  private readonly onLayerStatus = (event: Event): void => {
    const { layerId, status } = (event as CustomEvent<LayerStatusEventDetail>).detail;
    const problem = status.declarationProblem ?? status.error;
    if (problem !== null) console.warn(`[ol-map] ${layerId}: ${problem}`);
  };

  protected firstUpdated(): void {
    const target = this.renderRoot.querySelector<HTMLDivElement>('#map');
    if (!target) return;

    const el = new MapCatalogViewElement();
    el.showCatalog = showLayerCatalog();
    el.addEventListener('layerstatuschange', this.onLayerStatus);
    el.addEventListener('loaderror', (event) => {
      this.error = (event as CustomEvent<{ message: string }>).detail.message;
      this.requestUpdate();
    });
    target.replaceChildren(el);
    // Setting `src` last: it kicks off the load immediately, after everything
    // else (listeners, showCatalog) is already in place to react to it.
    el.src = CONFIG_URL;
  }

  render() {
    const showCatalog = showLayerCatalog();
    if (showCatalog) ensureDesignsystemetTokens();
    return html`
      ${LAYOUT_STYLE}
      ${showCatalog
        ? html`
            <link rel="stylesheet" href=${DESIGNSYSTEMET_CSS_URL} />
            <link rel="stylesheet" href=${DESIGNSYSTEMET_THEME_URL} />
          `
        : ''}
      <h2>Map</h2>
      <p>@map-platform/web-components loading mineralleting.yaml, catalog linked to map.</p>
      ${this.error ? html`<p style="color: #b91c1c">${this.error}</p>` : ''}
      <div class="map-container" id="map"></div>
    `;
  }
}

customElements.define('ol-map-view', OlMapView);
