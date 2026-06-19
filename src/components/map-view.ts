import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import maplibregl, { type Map, type MapLayerMouseEvent, type GeoJSONSource } from 'maplibre-gl';
import maplibreCSS from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { fetchBuildings, buildingsToGeoJSON } from '../services/wikidata';
import type { WikidataBuilding } from '../types/building';
import './building-popup';
import './search-box';
import type { PlaceSelectedEvent } from './search-box';

const MIN_ZOOM_FOR_BUILDINGS = 14;
const DEBOUNCE_MS = 400;

@localized()
@customElement('map-view')
export class MapView extends LitElement {
  static styles = [
    unsafeCSS(maplibreCSS),
    css`
    :host {
      display: block;
      position: relative;
    }

    #map {
      width: 100%;
      height: 100%;
    }

    .zoom-hint {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      padding: 6px 14px;
      border-radius: 20px;
      font-family: sans-serif;
      font-size: 13px;
      pointer-events: none;
      transition: opacity 0.3s;
    }

    .zoom-hint[hidden] {
      opacity: 0;
    }

    .loading-indicator {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-family: sans-serif;
      font-size: 12px;
      padding: 5px 12px 5px 10px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 7px;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    .loading-indicator[hidden] {
      opacity: 0;
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
  ];

  @state() private selectedBuilding: WikidataBuilding | null = null;
  @state() private showHint = true;
  @state() private loading = false;

  private map!: Map;
  private debounceTimer = 0;
  private fetchController: AbortController | null = null;

  render() {
    return html`
      <div id="map"></div>
      <search-box @place-selected=${this._onPlaceSelected}></search-box>
      <div class="zoom-hint" ?hidden=${!this.showHint}>
        ${msg('Hineinzoomen, um Gebäude zu entdecken')}
      </div>
      <div class="loading-indicator" ?hidden=${!this.loading}>
        <div class="spinner"></div>
        ${msg('Gebäude werden geladen …')}
      </div>
      ${this.selectedBuilding
        ? html`<building-popup
            .building=${this.selectedBuilding}
            @close=${this._closePopup}
          ></building-popup>`
        : ''}
    `;
  }

  firstUpdated() {
    const container = this.shadowRoot!.getElementById('map')!;

    this.map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [13.4, 52.52],
      zoom: 12,
      attributionControl: false,
    });

    this.map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://openfreemap.org">OpenFreeMap</a>',
        compact: true,
      }),
      'bottom-right',
    );
    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.map.on('load', () => this._onMapLoad());
    this.map.on('moveend', () => this._scheduleFetch());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.map?.remove();
  }

  private _onMapLoad() {
    this.map.addSource('buildings', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: 'buildings-circle',
      type: 'circle',
      source: 'buildings',
      paint: {
        'circle-radius': 7,
        'circle-color': '#c0392b',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.85,
      },
    });

    this.map.addLayer({
      id: 'buildings-label',
      type: 'symbol',
      source: 'buildings',
      minzoom: 16,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#1a1a1a',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    });

    this.map.on('click', 'buildings-circle', (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as Record<string, string | null>;
      this.selectedBuilding = {
        id: p['id'] ?? '',
        label: p['label'] ?? '',
        type: p['type'] ?? undefined,
        lat: (feature.geometry as GeoJSON.Point).coordinates[1],
        lng: (feature.geometry as GeoJSON.Point).coordinates[0],
        image: p['image'] ?? undefined,
        inception: p['inception'] ?? undefined,
      };
    });

    this.map.on('mouseenter', 'buildings-circle', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'buildings-circle', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  private _scheduleFetch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this._maybeLoadBuildings(), DEBOUNCE_MS);
  }

  private async _maybeLoadBuildings() {
    const zoom = this.map.getZoom();

    if (zoom < MIN_ZOOM_FOR_BUILDINGS) {
      this.showHint = true;
      this._clearBuildings();
      return;
    }

    this.showHint = false;
    this.fetchController?.abort();
    this.fetchController = new AbortController();
    this.loading = true;

    const bounds = this.map.getBounds();
    try {
      const buildings = await fetchBuildings(
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
        this.fetchController.signal,
      );
      const source = this.map.getSource('buildings') as GeoJSONSource | undefined;
      source?.setData(buildingsToGeoJSON(buildings));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Building fetch failed:', err);
    } finally {
      this.loading = false;
    }
  }

  private _clearBuildings() {
    const source = this.map.getSource('buildings') as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: [] });
  }

  private _onPlaceSelected(e: CustomEvent<PlaceSelectedEvent>) {
    const { boundingbox } = e.detail;
    const [south, north, west, east] = boundingbox;
    const camera = this.map.cameraForBounds(
      [[parseFloat(west), parseFloat(south)], [parseFloat(east), parseFloat(north)]],
      { padding: 40, maxZoom: 17 },
    );
    if (camera) this.map.jumpTo(camera);
  }

  private _closePopup() {
    this.selectedBuilding = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'map-view': MapView;
  }
}
