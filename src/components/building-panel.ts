import { LitElement, html, css, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, PersonRef, AddressEntry } from '../types/building';
import type { OhmBuildingPrefill } from '../services/ohm';
import { baseStyles } from '../styles/shared';
import { buttonStyles, badgeStyles } from '../styles/design-tokens';
import { formatDate } from '../utils/dates';
import './building-edit-form';
import './building-create-form';
import './app-button';
import './icon';
import './stale-banner';
import IconClose from '~icons/mdi/close';
import IconPencil from '~icons/mdi/pencil';
import IconLogin from '~icons/mdi/login';
import IconArrowRight from '~icons/mdi/arrow-right';
import IconOpenInNew from '~icons/mdi/open-in-new';
import IconContentCopy from '~icons/mdi/content-copy';
import IconCheck from '~icons/mdi/check';

function extractYear(iso: string): string {
  return iso.match(/^[+-]?(\d{1,4})/)?.[1] ?? '';
}

function yearRange(start?: string, end?: string): string {
  const s = start ? extractYear(start) : '';
  const e = end ? extractYear(end) : '';
  if (!s && !e) return '';
  return `${s}–${e}`;
}

@localized()
@customElement('building-panel')
export class BuildingPanel extends LitElement {
  static styles = [
    baseStyles,
    buttonStyles,
    badgeStyles,
    css`
      :host {
        display: block;
        position: fixed;
        top: var(--appbar-height);
        right: 0;
        bottom: 0;
        width: var(--panel-width-desktop);
        background: var(--color-bg-primary);
        border-left: 1px solid var(--color-border);
        transform: translateX(100%);
        transition: transform var(--transition-slow);
        z-index: var(--z-dropdown);
        overflow: hidden;
      }

      :host([open]) {
        transform: translateX(0);
      }

      @media (max-width: 700px) {
        :host {
          top: auto;
          left: 0;
          width: 100%;
          height: var(--panel-height-mobile);
          border-left: none;
          box-shadow: var(--shadow-lg);
          transform: translateY(100%);
        }

        :host([open]) {
          transform: translateY(0);
        }
      }

      .panel {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }

      .image-wrap {
        width: 100%;
        height: 180px;
        flex-shrink: 0;
        overflow: hidden;
        background: var(--color-bg-tertiary);
      }

      .image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .header {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-6) var(--space-4) 0;
      }

      .title {
        flex: 1;
        min-width: 0;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-bottom: var(--space-6);
      }

      .badge-heritage {
        background: var(--color-primary);
        color: white;
      }

      h2 {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: var(--line-height-tight);
        margin: 0 0 var(--space-1);
      }

      .type-label {
        font-size: var(--font-size-base);
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-4);
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        font-size: var(--font-size-lg);
        line-height: 1;
        padding: var(--space-1);
        border-radius: var(--radius-sm);
        flex-shrink: 0;
        transition: all var(--transition-fast);
      }

      .close-btn:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      stale-banner {
        border-top: 1px solid var(--color-warning-border, #ffd699);
        border-bottom: 1px solid var(--color-warning-border, #ffd699);
      }

      .body {
        padding: var(--space-5) var(--space-4);
        flex: 1;
      }

      .skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-2) 0;
      }

      .skel-line {
        height: 12px;
        background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: var(--radius-sm);
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .section {
        margin-bottom: var(--space-8);
      }

      .dates-section {
        margin-bottom: var(--space-8);
      }

      .date-item {
        font-size: var(--font-size-base);
        color: var(--color-text-primary);
        margin-bottom: var(--space-2);
      }

      .date-label {
        color: var(--color-text-secondary);
        margin-right: var(--space-2);
      }

      h3 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-2);
      }

      .entry {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border-light);
        font-size: var(--font-size-base);
        color: var(--color-text-primary);
      }

      .entry:last-child { border-bottom: none; }

      .entry-label { flex: 1; min-width: 0; }

      .entry-dates {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .entry-label a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: var(--color-border);
        text-underline-offset: 2px;
        transition: text-decoration-color var(--transition-fast);
      }

      .entry-label a:hover {
        text-decoration-color: currentColor;
      }

      .footer {
        padding: var(--space-4);
        border-top: 1px solid var(--color-border-light);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .footer-primary {
        display: flex;
        gap: var(--space-2);
      }

      .footer-tertiary {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .footer-tertiary a {
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        text-decoration: none;
        padding: var(--space-2) var(--space-4);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-md);
        background: transparent;
        transition: all var(--transition-fast);
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }

      .footer-tertiary a:hover {
        background: var(--color-primary);
        color: white;
      }

      .footer-primary app-button {
        flex: 1;
      }
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;
  @property({ attribute: false }) detailLoading = false;
  @property({ attribute: false }) dataIsStale = false;
  @property({ attribute: false }) hasOhmFootprint = false;
  @property({ attribute: false }) ohmElementId: string | undefined;
  @property({ attribute: false }) ohmElementType: 'way' | 'relation' | undefined;
  @property({ attribute: false }) authenticated = false;
  @property({ attribute: false }) newBuildingCoords: { lat: number; lng: number } | null = null;
  @property({ attribute: false }) ohmPrefill: OhmBuildingPrefill | null = null;

  @state() private editMode = false;
  @state() private linkCopied = false;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('building') || changed.has('newBuildingCoords')) {
      this.toggleAttribute('open', this.building !== null || this.newBuildingCoords !== null);
      if (changed.has('building') && this.editMode) {
        this.editMode = false;
      }
    }
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _refresh() {
    this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
  }

  private _showDetail() {
    this.dispatchEvent(new CustomEvent('show-detail', { bubbles: true, composed: true }));
  }

  private _login() {
    this.dispatchEvent(new CustomEvent('login', { bubbles: true, composed: true }));
  }

  private _edit() {
    this.editMode = true;
  }

  private _cancelEdit() {
    this.editMode = false;
  }

  private _onSaveSuccess() {
    this.editMode = false;
    // Dispatch event to parent to re-fetch building data
    this.dispatchEvent(new CustomEvent('save-success-refresh', { bubbles: true, composed: true }));
    // Show toast notification
    this._showToast(msg('Änderungen gespeichert'));
  }

  private _showToast(message: string) {
    this.dispatchEvent(new CustomEvent('show-toast', {
      bubbles: true,
      composed: true,
      detail: { message }
    }));
  }

  private async _copyLink() {
    try {
      const url = new URL(location.href);
      const cleanParams = new URLSearchParams();
      if (url.searchParams.has('id')) cleanParams.set('id', url.searchParams.get('id')!);
      url.search = cleanParams.toString();
      await navigator.clipboard.writeText(url.toString());
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }

  private _renderSection(
    title: string,
    items: Array<{ primary: string; href?: string; range?: string }>,
  ): TemplateResult {
    return html`
      <div class="section">
        <h3>${title}</h3>
        ${items.map(({ primary, href, range }) => html`
          <div class="entry">
            <span class="entry-label">
              ${href
                ? html`<a href=${href} target="_blank" rel="noopener">${primary}</a>`
                : primary}
            </span>
            ${range ? html`<span class="entry-dates">${range}</span>` : ''}
          </div>
        `)}
      </div>
    `;
  }

  private _personItems(people: PersonRef[]) {
    return people.map((p) => ({
      primary: p.label,
      href: `https://www.wikidata.org/wiki/${p.id}`,
      range: yearRange(p.start, p.end),
    }));
  }

  private _entityItems(entities: PersonRef[]) {
    return entities.map((e) => ({
      primary: e.label,
      href: `https://www.wikidata.org/wiki/${e.id}`,
    }));
  }

  private _addressItems(addresses: AddressEntry[]) {
    return addresses.map((a) => ({ primary: a.text, range: yearRange(a.start, a.end) }));
  }

  private _onBuildingCreated(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('building-created', {
      bubbles: true,
      composed: true,
      detail: e.detail,
    }));
  }

  render() {
    if (!this.building && this.newBuildingCoords) {
      return html`
        <div class="panel">
          <building-create-form
            .lat=${this.newBuildingCoords.lat}
            .lng=${this.newBuildingCoords.lng}
            .ohmPrefill=${this.ohmPrefill}
            @cancel=${this._close}
            @building-created=${this._onBuildingCreated}
          ></building-create-form>
        </div>
      `;
    }

    if (!this.building) return html`<div class="panel"></div>`;
    const { label, type, image, id } = this.building;
    const { detail, detailLoading } = this;

    if (this.editMode) {
      return html`
        <div class="panel">
          <building-edit-form
            .building=${this.building}
            .detail=${this.detail}
            @cancel=${this._cancelEdit}
            @save-success=${this._onSaveSuccess}
          ></building-edit-form>
        </div>
      `;
    }

    return html`
      <div class="panel">
        ${image ? keyed(image, html`<div class="image-wrap"><img src=${image} alt=${label}></div>`) : ''}

        <div class="header">
          <div class="title">
            ${detail?.heritages && detail.heritages.length > 0 ? html`
              <div class="badges">
                ${detail.heritages.map((h) => html`<span class="badge badge-heritage">${h}</span>`)}
              </div>
            ` : ''}
            <h2>${label}</h2>
            ${type ? html`<p class="type-label">${type.label}</p>` : ''}
          </div>
          <button class="close-btn" @click=${this._close} aria-label=${msg('Schließen')}>
            <domus-icon .svg=${IconClose}></domus-icon>
          </button>
        </div>

        ${this.dataIsStale ? html`<stale-banner @refresh=${this._refresh}></stale-banner>` : ''}

        <div class="body">
          ${detailLoading ? html`
            <div class="skeleton">
              <div class="skel-line" style="width:40%"></div>
              <div class="skel-line" style="width:80%"></div>
              <div class="skel-line" style="width:65%"></div>
              <div class="skel-line" style="width:40%; margin-top:8px"></div>
              <div class="skel-line" style="width:72%"></div>
            </div>
          ` : ''}

          ${this.building.inception || detail?.demolished ? html`
            <div class="dates-section">
              <h3>${msg('Daten')}</h3>
              ${this.building.inception ? html`
                <div class="date-item">
                  <span class="date-label">${msg('Erbaut')}</span>
                  <span>${formatDate(this.building.inception)}</span>
                </div>
              ` : ''}
              ${detail?.demolished ? html`
                <div class="date-item">
                  <span class="date-label">${msg('Abgerissen')}</span>
                  <span>${formatDate(detail.demolished)}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${detail && detail.addresses.length > 0
            ? this._renderSection(msg('Adressgeschichte'), this._addressItems(detail.addresses))
            : ''}

          ${detail && detail.occupants.length > 0
            ? this._renderSection(msg('Bewohner'), this._personItems(detail.occupants))
            : ''}

          ${detail && detail.owners.length > 0
            ? this._renderSection(msg('Eigentümer'), this._personItems(detail.owners))
            : ''}

          ${detail && detail.architects.length > 0
            ? this._renderSection(msg('Architekt'), this._entityItems(detail.architects))
            : ''}

          ${detail && detail.commissionedBy.length > 0
            ? this._renderSection(msg('Bauherr'), this._entityItems(detail.commissionedBy))
            : ''}
        </div>

        <div class="footer">
          <div class="footer-primary">
            <app-button variant="accent" .trailingIcon=${IconArrowRight} @click=${this._showDetail}>
            ${msg('Vollständige Details')}
          </app-button>
          ${this.authenticated ? html`
            <app-button variant="primary" .leadingIcon=${IconPencil} @click=${this._edit}>
              ${msg('Bearbeiten')}
            </app-button>
          ` : html`
            <app-button variant="primary" .leadingIcon=${IconLogin} @click=${this._login}>
              ${msg('Anmelden')}
            </app-button>
          `}
          </div>
          <div class="footer-tertiary">
            <a href="https://www.wikidata.org/wiki/${id}" target="_blank" rel="noopener">
              Wikidata
              <domus-icon .svg=${IconOpenInNew}></domus-icon>
            </a>
            ${detail?.ohmId || (this.hasOhmFootprint && this.ohmElementId) ? html`
              <a href=${detail?.ohmId
                ? `https://www.openhistoricalmap.org/relation/${detail.ohmId}`
                : `https://www.openhistoricalmap.org/${this.ohmElementType}/${this.ohmElementId}`}
                target="_blank" rel="noopener">
                OpenHistoricalMap
                <domus-icon .svg=${IconOpenInNew}></domus-icon>
              </a>
            ` : ''}
            <app-button
              variant="outline"
              .trailingIcon=${this.linkCopied ? IconCheck : IconContentCopy}
              @click=${this._copyLink}>
              ${this.linkCopied ? msg('Kopiert!') : msg('Link kopieren')}
            </app-button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-panel': BuildingPanel;
  }
}
