import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import type { Map } from 'maplibre-gl';
import { HISTORICAL_LAYERS, type HistoricalLayerSource } from '../config/historical-layers';
import { isLayerRelevant, splitAttribution, type Bounds } from '../utils/historical-layers';
import { controlPanelStyles } from '../styles/shared';
import './icon';
import IconLayers from '~icons/mdi/layers';
import IconChevronDown from '~icons/mdi/chevron-down';
import IconChevronUp from '~icons/mdi/chevron-up';

const SOURCE_ID = 'historical-raster';
const LAYER_ID = 'historical-raster';

@localized()
@customElement('historical-layer-picker')
export class HistoricalLayerPicker extends LitElement {
  static styles = [
    controlPanelStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        max-height: 100%;
        min-height: 0;
      }
    `,
  ];

  // The layer is inserted below this id so it sits above the base style but
  // below OHM's building outlines/footprint/pins.
  @property() insertBeforeLayerId: string | undefined = undefined;
  @property({ attribute: false }) map: Map | undefined = undefined;

  @state() private historicalLayerId: string | null = null;
  @state() private historicalOpacity = 1;
  @state() private controlsExpanded = false;
  @state() private zoomHintVisible = false;
  @state() private viewportBounds: Bounds | null = null;

  private _moveendHandler = () => {
    this._updateZoomHint();
    this._updateViewportBounds();
  };

  protected updated(changed: PropertyValues) {
    if (changed.has('map')) {
      const previousMap = changed.get('map') as Map | undefined;
      previousMap?.off('moveend', this._moveendHandler);
      if (this.map) {
        this.map.on('moveend', this._moveendHandler);
        this._updateZoomHint();
        this._updateViewportBounds();
      }
    }
    if (changed.has('controlsExpanded') && this.controlsExpanded) {
      // Range inputs don't reliably pick up Lit's `.value` binding on the render
      // where they're first created (e.g. right after the panel expands), so force it.
      const opacitySlider = this.shadowRoot!.querySelector('.opacity-slider') as HTMLInputElement | null;
      if (opacitySlider) opacitySlider.value = this.historicalOpacity.toString();
    }
    if (changed.has('zoomHintVisible')) {
      this.dispatchEvent(new CustomEvent('zoom-hint-changed', {
        bubbles: true,
        composed: true,
        detail: { visible: this.zoomHintVisible },
      }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.map?.off('moveend', this._moveendHandler);
  }

  private _activeLayer(): HistoricalLayerSource | undefined {
    return HISTORICAL_LAYERS.find((l) => l.id === this.historicalLayerId);
  }

  private _isLayerRelevant(layer: HistoricalLayerSource): boolean {
    return isLayerRelevant(layer, this.viewportBounds, this.historicalLayerId);
  }

  private _updateZoomHint() {
    const layer = this._activeLayer();
    this.zoomHintVisible = !!this.map && !!layer?.minzoom && this.map.getZoom() < layer.minzoom;
  }

  private _updateViewportBounds() {
    if (!this.map) return;
    const b = this.map.getBounds();
    this.viewportBounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }

  private _renderAttribution(layer: HistoricalLayerSource | undefined) {
    if (!layer) return '';
    const parts = splitAttribution(layer);
    if (!parts) return layer.attribution;
    return html`${parts.before}<a href=${layer.attributionUrl!} target="_blank" rel="noopener">${parts.linked}</a>${parts.after}`;
  }

  private _onSelect(e: Event) {
    const id = (e.target as HTMLSelectElement).value || null;
    this._setLayer(id);
  }

  private _setLayer(id: string | null) {
    if (this.map?.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    if (this.map?.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);

    this.historicalLayerId = id;
    if (!id || !this.map) {
      this.zoomHintVisible = false;
      return;
    }

    const layer = HISTORICAL_LAYERS.find((l) => l.id === id);
    if (!layer) return;

    this.map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: layer.tiles,
      tileSize: layer.tileSize ?? 256,
      ...(layer.maxzoom !== undefined ? { maxzoom: layer.maxzoom } : {}),
    });
    this.map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      minzoom: layer.minzoom ?? 0,
      paint: { 'raster-opacity': this.historicalOpacity },
    }, this.insertBeforeLayerId);

    this._updateZoomHint();
  }

  private _onOpacity(e: Event) {
    this.historicalOpacity = parseFloat((e.target as HTMLInputElement).value);
    if (this.map?.getLayer(LAYER_ID)) {
      this.map.setPaintProperty(LAYER_ID, 'raster-opacity', this.historicalOpacity);
    }
  }

  render() {
    return html`
      <div class="control-panel">
        <button
          class="control-summary"
          @click=${() => { this.controlsExpanded = !this.controlsExpanded; }}
        >
          <span class="control-summary-icon">
            <domus-icon .svg=${IconLayers}></domus-icon>
            ${this.historicalLayerId ? html`<span class="control-summary-dot"></span>` : ''}
          </span>
          <span class="control-summary-text">${msg('Historische Karte')}</span>
          <domus-icon .svg=${this.controlsExpanded ? IconChevronDown : IconChevronUp}></domus-icon>
        </button>

        ${this.controlsExpanded ? html`
          <select
            class="historical-select"
            .value=${this.historicalLayerId ?? ''}
            @change=${this._onSelect}
            ?disabled=${!this.map}
          >
            <option value="">${msg('Keine')}</option>
            ${HISTORICAL_LAYERS.filter((layer) => this._isLayerRelevant(layer)).map((layer) => html`
              <option value=${layer.id}>${layer.title} (${layer.yearRange[0]}–${layer.yearRange[1]})</option>
            `)}
          </select>
          ${this.historicalLayerId ? html`
            <label class="slider-label">
              ${msg('Transparenz')}: ${Math.round(this.historicalOpacity * 100)}%
            </label>
            <input
              type="range"
              class="year-slider opacity-slider"
              min="0"
              max="1"
              step="0.05"
              .value=${String(this.historicalOpacity)}
              @input=${this._onOpacity}
            />
            <div class="attribution-note">${this._renderAttribution(this._activeLayer())}</div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'historical-layer-picker': HistoricalLayerPicker;
  }
}
