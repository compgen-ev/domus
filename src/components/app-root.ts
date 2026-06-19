import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized } from '@lit/localize';
import type { WikidataBuilding, BuildingDetail } from '../types/building';
import { fetchBuildingById, fetchBuildingDetail } from '../services/wikidata';
import './map-view';
import './building-panel';
import './building-page';

@localized()
@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
    }

    .app-bar {
      height: 44px;
      flex-shrink: 0;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1rem;
      z-index: 20;
    }

    .back-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.875rem;
      color: #64748b;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
    }

    .back-btn:hover { background: #f1f5f9; color: #0f172a; }

    .app-bar a {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #000052;
      text-decoration: none;
    }

    .app-bar a img {
      height: 20px;
      width: auto;
      display: block;
      padding-bottom: 2px;
    }

    map-view {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `;

  @state() private selectedBuilding: WikidataBuilding | null = null;
  @state() private buildingDetail: BuildingDetail | null = null;
  @state() private detailLoading = false;
  @state() private view: 'map' | 'detail' = 'map';
  @state() private hasOhmFootprint = false;
  @state() private ohmElementId: string | undefined;
  @state() private ohmElementType: 'way' | 'relation' | undefined;

  private detailController: AbortController | null = null;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this._onPopState);
    const id = new URLSearchParams(location.search).get('id');
    if (id) this._loadBuildingById(id);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this._onPopState);
    this.detailController?.abort();
  }

  private _onPopState = () => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      if (!this.selectedBuilding || this.selectedBuilding.id !== id) {
        this._loadBuildingById(id);
      }
    } else {
      this.selectedBuilding = null;
      this.buildingDetail = null;
      this.view = 'map';
    }
  };

  private async _loadBuildingById(id: string) {
    try {
      const building = await fetchBuildingById(id);
      if (building) {
        this.selectedBuilding = building;
        this._fetchDetail(id);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Failed to load building by ID:', err);
      }
    }
  }

  private _fetchDetail(id: string) {
    this.detailController?.abort();
    this.detailController = new AbortController();
    this.buildingDetail = null;
    this.detailLoading = true;
    fetchBuildingDetail(id, this.detailController.signal).then((detail) => {
      this.buildingDetail = detail;
    }).catch((err) => {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Detail fetch failed:', err);
      }
    }).finally(() => {
      this.detailLoading = false;
    });
  }

  private _onBuildingSelected(e: CustomEvent<WikidataBuilding>) {
    this.selectedBuilding = e.detail;
    this.view = 'map';
    this.hasOhmFootprint = false;
    this.ohmElementId = undefined;
    this.ohmElementType = undefined;
    history.pushState(null, '', `?id=${e.detail.id}`);
    this._fetchDetail(e.detail.id);
  }

  private _onPanelClose() {
    this.selectedBuilding = null;
    this.buildingDetail = null;
    this.hasOhmFootprint = false;
    this.ohmElementId = undefined;
    this.ohmElementType = undefined;
    this.view = 'map';
    history.pushState(null, '', location.pathname);
  }

  private _onOhmDataLoaded(e: CustomEvent<{ elementId?: string; elementType?: 'way' | 'relation' }>) {
    this.hasOhmFootprint = true;
    this.ohmElementId = e.detail.elementId;
    this.ohmElementType = e.detail.elementType;
  }

  private _onShowDetail() {
    this.view = 'detail';
  }

  private _onBackToMap() {
    this.view = 'map';
  }

  render() {
    return html`
      <div class="app-bar">
        <a href="/"><img src="/map/logo.svg" alt="">Domus</a>
      </div>
      ${this.view === 'detail'
        ? html`<building-page
            .building=${this.selectedBuilding}
            .detail=${this.buildingDetail}
            .detailLoading=${this.detailLoading}
            .hasOhmFootprint=${this.hasOhmFootprint}
            .ohmElementId=${this.ohmElementId}
            .ohmElementType=${this.ohmElementType}
            @back-to-map=${this._onBackToMap}
          ></building-page>`
        : html`
          <map-view
            .ohmId=${this.buildingDetail?.ohmId}
            .wikidataId=${this.selectedBuilding?.id}
            @building-selected=${this._onBuildingSelected}
            @ohm-data-loaded=${this._onOhmDataLoaded}
          ></map-view>
          <building-panel
            .building=${this.selectedBuilding}
            .detail=${this.buildingDetail}
            .detailLoading=${this.detailLoading}
            .hasOhmFootprint=${this.hasOhmFootprint}
            .ohmElementId=${this.ohmElementId}
            .ohmElementType=${this.ohmElementType}
            @close=${this._onPanelClose}
            @show-detail=${this._onShowDetail}
          ></building-panel>
        `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
