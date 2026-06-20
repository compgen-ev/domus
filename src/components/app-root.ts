import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { designTokens, buttonStyles } from '../styles/design-tokens';
import type { WikidataBuilding, BuildingDetail } from '../types/building';
import { fetchBuildingById, fetchBuildingDetail } from '../services/wikidata';
import { handleOAuthCallback, isAuthenticated, logout, login } from '../services/wikimedia-auth';
import './map-view';
import './building-panel';
import './building-page';

@localized()
@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    ${designTokens}
    ${buttonStyles}

    :host {
      display: flex;
      flex-direction: column;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
      font-family: var(--font-family);
    }

    .app-bar {
      height: var(--appbar-height);
      flex-shrink: 0;
      background: var(--color-bg-primary);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 0 var(--space-4);
      z-index: var(--z-sticky);
      justify-content: space-between;
    }

    .back-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--color-text-tertiary);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      white-space: nowrap;
      transition: all var(--transition-fast);
    }

    .back-btn:hover {
      background: var(--color-bg-tertiary);
      color: var(--color-text-primary);
    }

    .app-bar a {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      letter-spacing: -0.03em;
      color: var(--color-primary);
      text-decoration: none;
    }

    .app-bar a img {
      height: 20px;
      width: auto;
      display: block;
      padding-bottom: 2px;
    }

    .auth-section {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .sign-in-btn {
      background: var(--color-primary);
      color: white;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      white-space: nowrap;
      transition: background var(--transition-fast);
    }

    .sign-in-btn:hover {
      background: var(--color-primary-hover);
    }

    .sign-out-btn {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      white-space: nowrap;
      transition: all var(--transition-fast);
    }

    .sign-out-btn:hover {
      background: var(--color-bg-secondary);
      border-color: var(--color-text-muted);
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
  @state() private authenticated = false;

  private detailController: AbortController | null = null;

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this._onPopState);

    // Handle OAuth callback
    try {
      const hadCallback = await handleOAuthCallback();
      if (hadCallback) {
        this.authenticated = true;
      } else {
        this.authenticated = isAuthenticated();
      }
    } catch (err) {
      console.error('OAuth callback failed:', err);
      this.authenticated = false;
    }

    // Dev mode: auto-authenticate when running dev server
    if (import.meta.env.DEV) {
      this.authenticated = true;
    }

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

  private _onLogin() {
    login(); // Redirects, never resolves
  }

  private _onLogout() {
    logout();
    this.authenticated = false;
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
        <div class="auth-section">
          ${this.authenticated ? html`
            <button class="sign-out-btn" @click=${this._onLogout}>${msg('Abmelden')}</button>
          ` : html`
            <button class="sign-in-btn" @click=${this._onLogin}>${msg('Anmelden')}</button>
          `}
        </div>
      </div>
      ${this.view === 'detail'
        ? html`<building-page
            .building=${this.selectedBuilding}
            .detail=${this.buildingDetail}
            .detailLoading=${this.detailLoading}
            .hasOhmFootprint=${this.hasOhmFootprint}
            .ohmElementId=${this.ohmElementId}
            .ohmElementType=${this.ohmElementType}
            .authenticated=${this.authenticated}
            @back-to-map=${this._onBackToMap}
          ></building-page>`
        : html`
          <map-view
            .ohmId=${this.buildingDetail?.ohmId}
            .wikidataId=${this.selectedBuilding?.id}
            .selectedBuilding=${this.selectedBuilding}
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
            .authenticated=${this.authenticated}
            @close=${this._onPanelClose}
            @show-detail=${this._onShowDetail}
            @logout=${this._onLogout}
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
