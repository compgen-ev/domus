import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { designTokens, buttonStyles } from '../styles/design-tokens';
import type { WikidataBuilding, BuildingDetail } from '../types/building';
import { fetchBuildingById, fetchBuildingDetail, fetchDepictingPhotos } from '../services/wikidata';
import { handleOAuthCallback, isAuthenticated, logout, login, getStoredUsername, fetchAndStoreUsername, getValidAccessToken } from '../services/wikimedia-auth';
import { handleOhmOAuthCallback, isOhmAuthenticated, ohmLogin, ohmLogout, getStoredOhmUsername } from '../services/ohm-auth';
import { cleanupExpired, isStale, clearEdit, recordEdit, scheduleRefreshes } from '../services/edit-tracker';
import type { OhmBuildingPrefill } from '../services/ohm';
import './map-view';
import './building-detail';
import './app-toast';
import './app-button';
import './login-notice';
import './account-menu';
import IconLogin from '~icons/mdi/login';

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


    map-view {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `;

  @state() private selectedBuilding: WikidataBuilding | null = null;
  @state() private buildingDetail: BuildingDetail | null = null;
  @state() private detailLoading = false;
  @state() private dataIsStale = false;
  @state() private hasOhmFootprint = false;
  @state() private ohmElementId: string | undefined;
  @state() private ohmElementType: 'way' | 'relation' | undefined;
  @state() private authenticated = false;
  @state() private ohmAuthenticated = false;
  @state() private showLoginNotice = false;
  @state() private wikimediaUsername: string | null = null;
  @state() private ohmUsername: string | null = null;
  @state() private newBuildingCoords: { lat: number; lng: number } | null = null;
  @state() private ohmPrefill: OhmBuildingPrefill | null = null;
  @state() private depictingPhotos: string[] = [];

  private detailController: AbortController | null = null;
  private depictingController: AbortController | null = null;

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this._onPopState);

    // Clean up expired edit timestamps
    cleanupExpired();

    // Handle OAuth callbacks (Wikimedia and OHM use different sessionStorage keys, safe to call both)
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

    try {
      await handleOhmOAuthCallback();
    } catch (err) {
      console.error('OHM OAuth callback failed:', err);
    }
    this.ohmAuthenticated = isOhmAuthenticated();

    // Load usernames — from storage if available, else fetch from API
    this.wikimediaUsername = getStoredUsername();
    if (this.authenticated && !this.wikimediaUsername) {
      const token = await getValidAccessToken();
      if (token) this.wikimediaUsername = await fetchAndStoreUsername(token);
    }
    this.ohmUsername = getStoredOhmUsername();

    // Dev mode: stub usernames
    if (import.meta.env.DEV) {
      this.wikimediaUsername = this.wikimediaUsername ?? 'DevUser';
      this.ohmAuthenticated = true;
      this.ohmUsername = this.ohmUsername ?? 'DevUserOHM';
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
    this.depictingController?.abort();
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
    }
  };

  private async _loadBuildingById(id: string) {
    try {
      const building = await fetchBuildingById(id);
      if (building) {
        // SPARQL returns the QID as label when the item isn't indexed yet — keep any
        // real label we already have rather than overwriting it with the QID fallback
        if (building.label === id && this.selectedBuilding?.id === id && this.selectedBuilding.label !== id) {
          building.label = this.selectedBuilding.label;
        }
        this.selectedBuilding = building;
        this._checkStaleness(id, building.modified);
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
      this._checkStaleness(id, detail.modified);
    }).catch((err) => {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Detail fetch failed:', err);
      }
    }).finally(() => {
      this.detailLoading = false;
    });

    this.depictingController?.abort();
    this.depictingController = new AbortController();
    this.depictingPhotos = [];
    fetchDepictingPhotos(id, this.depictingController.signal).then((photos) => {
      this.depictingPhotos = photos;
    }).catch((err) => {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Depicting photos fetch failed:', err);
      }
    });
  }

  private _checkStaleness(id: string, modified?: string) {
    this.dataIsStale = isStale(id, modified);
    // Clear edit timestamp if data is fresh
    if (!this.dataIsStale) {
      clearEdit(id);
    }
  }

  private async _refreshBuilding() {
    if (this.selectedBuilding) {
      await this._loadBuildingById(this.selectedBuilding.id);
    }
  }

  private _onBuildingSelected(e: CustomEvent<WikidataBuilding>) {
    this.selectedBuilding = e.detail;
    this.newBuildingCoords = null;
    this.hasOhmFootprint = false;
    this.ohmElementId = undefined;
    this.ohmElementType = undefined;
    const params = new URLSearchParams(location.search);
    params.set('id', e.detail.id);
    history.pushState(null, '', `?${params}`);
    this._fetchDetail(e.detail.id);
  }

  private _onPanelClose() {
    this.selectedBuilding = null;
    this.buildingDetail = null;
    this.depictingPhotos = [];
    this.newBuildingCoords = null;
    this.ohmPrefill = null;
    this.hasOhmFootprint = false;
    this.ohmElementId = undefined;
    this.ohmElementType = undefined;
    const params = new URLSearchParams(location.search);
    params.delete('id');
    const qs = params.toString();
    history.pushState(null, '', qs ? `?${qs}` : location.pathname);
  }

  private _onOhmDataLoaded(e: CustomEvent<{ elementId?: string; elementType?: 'way' | 'relation' }>) {
    this.hasOhmFootprint = true;
    this.ohmElementId = e.detail.elementId;
    this.ohmElementType = e.detail.elementType;
  }

  private _onLogin() {
    this.showLoginNotice = true;
  }

  private _onLoginConfirm() {
    this.showLoginNotice = false;
    login(); // Redirects, never resolves
  }

  private _onLoginCancel() {
    this.showLoginNotice = false;
  }

  private _onLogoutAll() {
    logout();
    ohmLogout();
    this.authenticated = false;
    this.ohmAuthenticated = false;
    this.wikimediaUsername = null;
    this.ohmUsername = null;
  }

  private _onOhmLogin() {
    ohmLogin(); // Redirects, never resolves
  }

  private _onOhmLogout() {
    ohmLogout();
    this.ohmAuthenticated = false;
    this.ohmUsername = null;
  }

  private _onSaveSuccessRefresh() {
    // Re-fetch building data after successful edit
    if (this.selectedBuilding) {
      const id = this.selectedBuilding.id;
      this._loadBuildingById(id);

      // Schedule auto-refreshes with backoff (5s, 10s, 15s, 30s, 60s)
      scheduleRefreshes(
        id,
        () => this._refreshBuilding(),
        () => this.dataIsStale
      );
    }
  }

  private _onLocationPicked(e: CustomEvent<{ lat: number; lng: number }>) {
    this.selectedBuilding = null;
    this.buildingDetail = null;
    this.ohmPrefill = null;
    this.newBuildingCoords = e.detail;
  }

  private _onOhmFeaturePicked(e: CustomEvent<OhmBuildingPrefill>) {
    this.selectedBuilding = null;
    this.buildingDetail = null;
    this.newBuildingCoords = { lat: e.detail.lat, lng: e.detail.lng };
    this.ohmPrefill = e.detail;
  }

  private async _onBuildingCreated(e: CustomEvent<{ id: string; label: string; lat: number; lng: number }>) {
    this.newBuildingCoords = null;
    this.ohmPrefill = null;
    const { id, label, lat, lng } = e.detail;
    const params = new URLSearchParams(location.search);
    params.set('id', id);
    history.pushState(null, '', `?${params}`);

    // Show drawer immediately with stub; stale banner will show until SPARQL propagates
    recordEdit(id);
    this.selectedBuilding = { id, label, lat, lng };
    this.dataIsStale = true;
    this._showToast(msg('Gebäude angelegt'));

    await this._loadBuildingById(id);
    scheduleRefreshes(
      id,
      () => this._refreshBuilding(),
      () => this.dataIsStale,
    );
  }

  private _showToast(message: string) {
    const toast = this.shadowRoot?.querySelector('app-toast');
    if (toast) {
      (toast as any).show(message);
    }
  }

  private _onShowToast(e: CustomEvent<{ message: string }>) {
    this._showToast(e.detail.message);
  }

  render() {
    return html`
      <div class="app-bar">
        <a href="/"><img src="/map/domus.svg" alt="">Domus</a>
        <div class="auth-section">
          ${this.authenticated ? html`
            <account-menu
              .wikimediaUsername=${this.wikimediaUsername}
              .ohmUsername=${this.ohmUsername}
              .ohmAuthenticated=${this.ohmAuthenticated}
              @logout-all=${this._onLogoutAll}
              @ohm-login=${this._onOhmLogin}
              @ohm-logout=${this._onOhmLogout}
            ></account-menu>
          ` : html`
            <app-button variant="primary" .leadingIcon=${IconLogin} @click=${this._onLogin}>
              ${msg('Anmelden')}
            </app-button>
          `}
        </div>
      </div>
      <map-view
        .ohmId=${this.buildingDetail?.ohmId}
        .wikidataId=${this.selectedBuilding?.id}
        .selectedBuilding=${this.selectedBuilding}
        .authenticated=${this.authenticated}
        .pendingLocation=${this.newBuildingCoords}
        .pendingOhmWayId=${this.ohmPrefill?.ohmId}
        @building-selected=${this._onBuildingSelected}
        @ohm-data-loaded=${this._onOhmDataLoaded}
        @location-picked=${this._onLocationPicked}
        @ohm-feature-picked=${this._onOhmFeaturePicked}
      ></map-view>
      <building-detail
        .building=${this.selectedBuilding}
        .detail=${this.buildingDetail}
        .detailLoading=${this.detailLoading}
        .dataIsStale=${this.dataIsStale}
        .hasOhmFootprint=${this.hasOhmFootprint}
        .ohmElementId=${this.ohmElementId}
        .ohmElementType=${this.ohmElementType}
        .authenticated=${this.authenticated}
        .ohmAuthenticated=${this.ohmAuthenticated}
        .newBuildingCoords=${this.newBuildingCoords}
        .ohmPrefill=${this.ohmPrefill}
        .depictingPhotos=${this.depictingPhotos}
        @close=${this._onPanelClose}
        @login=${this._onLogin}
        @logout=${this._onLogoutAll}
        @save-success-refresh=${this._onSaveSuccessRefresh}
        @show-toast=${this._onShowToast}
        @refresh=${this._refreshBuilding}
        @building-created=${this._onBuildingCreated}
      ></building-detail>
      <app-toast></app-toast>
      <login-notice
        ?open=${this.showLoginNotice}
        @confirm=${this._onLoginConfirm}
        @cancel=${this._onLoginCancel}
      ></login-notice>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
