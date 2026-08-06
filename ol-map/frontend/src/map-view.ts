import { LitElement, css, html, unsafeCSS } from 'lit';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import olCss from 'ol/ol.css?inline';

export class OlMapView extends LitElement {
  private map?: Map;

  static styles = [
    unsafeCSS(olCss),
    css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }

    h2 {
      margin: 0 0 0.75rem;
    }

    p {
      margin: 0 0 1rem;
      color: #444;
    }

    .map-container {
      width: 100%;
      height: min(65vh, 560px);
      border: 1px solid #d4d4d8;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    #map {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  ];

  protected firstUpdated(): void {
    const target = this.renderRoot.querySelector<HTMLDivElement>('#map');
    if (!target) {
      return;
    }

    this.map = new Map({
      target,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([10.7522, 59.9139]),
        zoom: 10,
      }),
    });
  }

  disconnectedCallback(): void {
    this.map?.setTarget(undefined);
    this.map = undefined;
    super.disconnectedCallback();
  }

  render() {
    return html`
      <h2>Map</h2>
      <p>OpenLayers 10.10 sample contribution.</p>
      <div class="map-container">
        <div id="map"></div>
      </div>
    `;
  }
}

customElements.define('ol-map-view', OlMapView);
