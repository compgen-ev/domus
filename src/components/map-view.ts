import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import maplibregl, { type Map, type MapLayerMouseEvent, type MapMouseEvent, type GeoJSONSource } from 'maplibre-gl';
import maplibreCSS from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { fetchBuildings, buildingsToGeoJSON } from '../services/wikidata';
import { fetchOhmRelationGeometry, fetchOhmByWikidataId, fetchOhmWayTags } from '../services/ohm';
import type { WikidataBuilding } from '../types/building';
import './search-box';
import type { PlaceSelectedEvent } from './search-box';
import { baseStyles, iconButtonStyles } from '../styles/shared';
import './icon';
import './app-button';
import IconEye from '~icons/mdi/eye';
import IconEyeOff from '~icons/mdi/eye-off';
import IconMapMarker from '~icons/mdi/map-marker';
import IconHomePlus from '~icons/mdi/home-plus';

const MIN_ZOOM_FOR_BUILDINGS = 14;
const DEBOUNCE_MS = 400;
const MAP_STORAGE_KEY = 'domus.map';

function loadSavedView(): { center: [number, number]; zoom: number } | null {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveView(map: Map): void {
  const { lng, lat } = map.getCenter();
  localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ center: [lng, lat], zoom: map.getZoom() }));
}

@localized()
@customElement('map-view')
export class MapView extends LitElement {
  static styles = [
    baseStyles,
    iconButtonStyles,
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
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-family: inherit;
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
      color: white;
      font-family: inherit;
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

    @media (max-width: 700px) {
      .loading-indicator {
        top: 64px;
      }
    }

    .time-controls {
      position: absolute;
      bottom: var(--space-3);
      left: var(--space-3);
      background: var(--color-bg-primary);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 200px;
      z-index: var(--z-dropdown);
    }

    .time-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }

    .time-header h4 {
      margin: 0;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
    }

    .year-input {
      width: 80px;
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      text-align: center;
      font-family: inherit;
    }

    .year-slider {
      width: 100%;
      margin: var(--space-1) 0;
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .add-building-btn {
      position: absolute;
      top: var(--space-3);
      left: var(--space-3);
      margin-top: calc(var(--space-3) + 40px); /* below search box */
      box-shadow: var(--shadow-md);
      z-index: var(--z-dropdown);
    }

  `,
  ];

  @property({ attribute: false }) ohmId: string | undefined = undefined;
  @property({ attribute: false }) wikidataId: string | undefined = undefined;
  @property({ attribute: false }) selectedBuilding: WikidataBuilding | null = null;
  @property({ type: Boolean }) authenticated = false;
  @property({ attribute: false }) pendingLocation: { lat: number; lng: number } | null = null;

  @state() private showHint = true;
  @state() private loading = false;
  @state() private selectedYear = new Date().getFullYear();
  @state() private ohmLayerVisible = true;
  @state() private addingBuilding = false;

  private _pendingMarker: maplibregl.Marker | null = null;
  private _addingClickHandler: ((e: MapMouseEvent) => void) | null = null;
  private _addingFetchController: AbortController | null = null;

  private map!: Map;
  private debounceTimer = 0;
  private fetchController: AbortController | null = null;
  private ohmController: AbortController | null = null;
  private ohmDebounceTimer: number | null = null;
  private resizeObserver!: ResizeObserver;
  private _shouldCenterOnBuilding = false;

  protected updated(changed: PropertyValues) {
    if (changed.has('ohmId') || changed.has('wikidataId')) {
      this._scheduleOhmFetch();
    }
    if (changed.has('selectedBuilding') && this.selectedBuilding && this._shouldCenterOnBuilding) {
      this.map.flyTo({
        center: [this.selectedBuilding.lng, this.selectedBuilding.lat],
        zoom: 17,
        duration: 1000,
      });
      this._shouldCenterOnBuilding = false;
    }
    if (changed.has('addingBuilding')) {
      if (this.addingBuilding) {
        this._addingClickHandler = (e: MapMouseEvent) => {
          const features = this.map.queryRenderedFeatures(e.point, { layers: ['ohm-buildings-fill'] });
          if (features.length > 0) {
            const feat = features[0];
            const props = feat.properties as Record<string, string | number | undefined>;
            const { lat, lng } = e.lngLat;
            const osmId = typeof props['osm_id'] === 'number' ? props['osm_id'] : undefined;
            const tileType = typeof props['type'] === 'string' && props['type'] !== 'yes'
              ? props['type'] : undefined;

            // Remove handler to prevent double-clicks; keep addingBuilding=true while fetching
            this.map.off('click', this._addingClickHandler!);
            this._addingClickHandler = null;
            this.map.getCanvas().style.cursor = 'wait';

            this._addingFetchController = new AbortController();
            const signal = this._addingFetchController.signal;

            (async () => {
              const tags = osmId ? await fetchOhmWayTags(osmId, signal) : {};
              this._addingFetchController = null;
              this.addingBuilding = false; // resets cursor via updated()
              if (!signal.aborted) {
                this.dispatchEvent(new CustomEvent('ohm-feature-picked', {
                  bubbles: true,
                  composed: true,
                  detail: {
                    lat, lng,
                    ohmId: osmId ? String(osmId) : undefined,
                    name: tags['name'],
                    buildingTag: tags['building'] ?? tileType,
                    startDate: tags['start_date'],
                    endDate: tags['end_date'],
                  },
                }));
              }
            })();
          } else {
            this.addingBuilding = false;
            this.dispatchEvent(new CustomEvent('location-picked', {
              bubbles: true,
              composed: true,
              detail: { lat: e.lngLat.lat, lng: e.lngLat.lng },
            }));
          }
        };
        this.map?.on('click', this._addingClickHandler);
        if (this.map) this.map.getCanvas().style.cursor = 'crosshair';
      } else {
        if (this._addingClickHandler && this.map) {
          this.map.off('click', this._addingClickHandler);
        }
        this._addingClickHandler = null;
        this._addingFetchController?.abort();
        this._addingFetchController = null;
        if (this.map) this.map.getCanvas().style.cursor = '';
      }
    }
    if (changed.has('pendingLocation')) {
      if (!this.map) return;
      if (this.pendingLocation) {
        const lngLat: [number, number] = [this.pendingLocation.lng, this.pendingLocation.lat];
        if (!this._pendingMarker) {
          this._pendingMarker = new maplibregl.Marker({
            element: this._makePinElement(),
            anchor: 'bottom',
          })
            .setLngLat(lngLat)
            .addTo(this.map);
        } else {
          this._pendingMarker.setLngLat(lngLat);
        }
      } else {
        this._pendingMarker?.remove();
        this._pendingMarker = null;
      }
    }
  }

  private _makePinElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:40px;color:#c0392b;filter:drop-shadow(0 2px 6px rgba(0,0,0,.35));line-height:0;';
    el.innerHTML = IconMapMarker;
    return el;
  }

  render() {
    return html`
      <div id="map"></div>
      ${this.authenticated ? html`
        <app-button
          class="add-building-btn"
          variant=${this.addingBuilding ? 'primary' : 'secondary'}
          .leadingIcon=${IconHomePlus}
          @click=${this._onAddBuildingClick}>
          ${this.addingBuilding ? msg('Standort wählen …') : msg('Gebäude hinzufügen')}
        </app-button>
      ` : ''}

      <search-box @place-selected=${this._onPlaceSelected}></search-box>

      <div class="time-controls">
        <div class="time-header">
          <h4>${msg('Historische Gebäudeumrisse')}</h4>
          <button class="btn-icon" @click=${this._toggleOhmLayer}>
            <domus-icon .svg=${this.ohmLayerVisible ? IconEye : IconEyeOff}></domus-icon>
          </button>
        </div>
        <input
          type="number"
          class="year-input"
          .valueAsNumber=${this.selectedYear}
          @input=${this._onYearInput}
          min="500"
          max=${new Date().getFullYear()}
          ?disabled=${!this.ohmLayerVisible}
        />
        <input
          type="range"
          class="year-slider"
          .value=${String(this.selectedYear)}
          @input=${this._onYearSlide}
          min="500"
          max=${new Date().getFullYear()}
          ?disabled=${!this.ohmLayerVisible}
        />
      </div>

      <div class="zoom-hint" ?hidden=${!this.showHint}>
        ${msg('Hineinzoomen, um Gebäude zu entdecken')}
      </div>
      <div class="loading-indicator" ?hidden=${!this.loading}>
        <div class="spinner"></div>
        ${msg('Gebäude werden geladen …')}
      </div>
    `;
  }

  async firstUpdated() {
    const container = this.shadowRoot!.getElementById('map')!;

    // Expose maplibregl to window and load dates library before creating map
    (window as any).maplibregl = maplibregl;
    await import('@openhistoricalmap/maplibre-gl-dates');

    // Check if URL has building ID - if so, don't restore saved view
    const hasUrlId = new URLSearchParams(window.location.search).has('id');
    if (hasUrlId) {
      this._shouldCenterOnBuilding = true;
    }

    const saved = !hasUrlId ? loadSavedView() : null;
    this.map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: saved?.center ?? [13.4, 52.52],
      zoom: saved?.zoom ?? 12,
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
    this.map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right');

    this.map.on('load', () => this._onMapLoad());
    this.map.on('moveend', () => { saveView(this.map); this._scheduleFetch(); });

    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(container);

    // Force slider to sync with selectedYear value
    const slider = this.shadowRoot!.querySelector('.year-slider') as HTMLInputElement;
    if (slider) {
      slider.value = this.selectedYear.toString();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.ohmController?.abort();
    this._pendingMarker?.remove();
    if (this._addingClickHandler && this.map) {
      this.map.off('click', this._addingClickHandler);
    }
    this._addingFetchController?.abort();
    this.map?.remove();
  }

  private _scheduleOhmFetch() {
    if (this.ohmDebounceTimer) {
      clearTimeout(this.ohmDebounceTimer);
    }
    this.ohmDebounceTimer = window.setTimeout(() => {
      this._updateOhmFootprint();
    }, 500); // 500ms debounce to prevent duplicate queries
  }

  private async _updateOhmFootprint() {
    this.ohmController?.abort();
    const source = this.map?.getSource('ohm-footprint') as GeoJSONSource | undefined;
    if (!source) return;

    if (!this.ohmId && !this.wikidataId) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    this.ohmController = new AbortController();
    try {
      const result = this.ohmId
        ? await fetchOhmRelationGeometry(this.ohmId, this.ohmController.signal)
        : await fetchOhmByWikidataId(this.wikidataId!, this.ohmController.signal);
      source.setData(result.geojson);

      if (result.geojson.features.length > 0) {
        this.dispatchEvent(new CustomEvent('ohm-data-loaded', {
          bubbles: true,
          composed: true,
          detail: {
            elementId: result.elementId,
            elementType: result.elementType,
          },
        }));
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('OHM fetch failed:', err);
      }
    }
  }

  private _onMapLoad() {
    this.map.addSource('ohm-footprint', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: 'ohm-footprint-fill',
      type: 'fill',
      source: 'ohm-footprint',
      paint: { 'fill-color': '#000052', 'fill-opacity': 0.12 },
    });

    this.map.addLayer({
      id: 'ohm-footprint-outline',
      type: 'line',
      source: 'ohm-footprint',
      paint: { 'line-color': '#000052', 'line-width': 2, 'line-opacity': 0.7 },
    });

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
        'circle-stroke-color': '#ffffff',
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
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });

    this.map.on('click', 'buildings-circle', (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as Record<string, string | null>;
      const building: WikidataBuilding = {
        id: p['id'] ?? '',
        label: p['label'] ?? '',
        type: p['typeId'] && p['typeLabel']
          ? { id: p['typeId'], label: p['typeLabel'] }
          : undefined,
        lat: (feature.geometry as GeoJSON.Point).coordinates[1],
        lng: (feature.geometry as GeoJSON.Point).coordinates[0],
        image: p['image'] ?? undefined,
        inception: p['inception'] ?? undefined,
      };
      this.dispatchEvent(new CustomEvent<WikidataBuilding>('building-selected', {
        bubbles: true,
        composed: true,
        detail: building,
      }));
    });

    this.map.on('mouseenter', 'buildings-circle', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'buildings-circle', () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add OHM historical building overlay
    this.map.addSource('ohm-historical', {
      type: 'vector',
      tiles: ['https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf'],
    });

    this.map.addLayer({
      id: 'ohm-buildings-fill',
      source: 'ohm-historical',
      'source-layer': 'buildings',
      type: 'fill',
      minzoom: 14,
      paint: {
        'fill-color': '#f2c14e',
        'fill-opacity': 0.3,
      },
    }, 'buildings-circle'); // Insert below Wikidata pins

    this.map.addLayer({
      id: 'ohm-buildings-outline',
      source: 'ohm-historical',
      'source-layer': 'buildings',
      type: 'line',
      minzoom: 14,
      paint: {
        'line-color': '#c0392b',
        'line-width': 1,
        'line-opacity': 0.6,
      },
    }, 'buildings-circle');

    // Initialize date filter to current year
    (this.map as any).filterByDate(new Date().getFullYear().toString());

    this._scheduleFetch();

    // If ohmId/wikidataId were set before map loaded, fetch now
    if (this.ohmId || this.wikidataId) {
      this._scheduleOhmFetch();
    }
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

  private _onYearChange(year: number) {
    this.selectedYear = year;
    (this.map as any).filterByDate(year.toString());
  }

  private _onYearInput(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this._onYearChange(value);
    }
  }

  private _onYearSlide(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    this._onYearChange(value);
  }

  private _toggleOhmLayer() {
    this.ohmLayerVisible = !this.ohmLayerVisible;
    const visibility = this.ohmLayerVisible ? 'visible' : 'none';
    this.map.setLayoutProperty('ohm-buildings-fill', 'visibility', visibility);
    this.map.setLayoutProperty('ohm-buildings-outline', 'visibility', visibility);
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

  private _onAddBuildingClick() {
    this.addingBuilding = !this.addingBuilding;
  }


}

declare global {
  interface HTMLElementTagNameMap {
    'map-view': MapView;
  }
}
