import { LitElement, html, css, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, PersonRef, AddressEntry } from '../types/building';
import { baseStyles } from '../styles/shared';
import { login } from '../services/wikimedia-auth';
import './building-edit-form';

function extractYear(iso: string): string {
  return iso.match(/^(-?\d{1,4})/)?.[1] ?? '';
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
    css`
      :host {
        display: block;
        position: fixed;
        top: 44px;
        right: 0;
        bottom: 0;
        width: 400px;
        background: #fff;
        border-left: 1px solid #e2e8f0;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        z-index: 10;
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
          height: 70vh;
          border-left: none;
          box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
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
        background: #f1f5f9;
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
        gap: 0.5rem;
        padding: 1rem 1rem 0;
      }

      .title { flex: 1; min-width: 0; }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 0.4rem;
      }

      .badge {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #fff;
        padding: 2px 7px;
        border-radius: 10px;
        display: inline-block;
      }

      .badge-type { background: #000052; }
      .badge-heritage { background: #b45309; }

      h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        margin: 0 0 0.25rem;
      }

      .dates {
        font-size: 0.85rem;
        color: #64748b;
        margin: 0;
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        font-size: 1rem;
        line-height: 1;
        padding: 0.25rem;
        border-radius: 4px;
        flex-shrink: 0;
        font-family: inherit;
      }

      .close-btn:hover { background: #f1f5f9; color: #475569; }

      .body {
        padding: 0.75rem 1rem;
        flex: 1;
      }

      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 0.5rem 0;
      }

      .skel-line {
        height: 12px;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: 4px;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .section {
        margin-bottom: 1rem;
      }

      .section-title {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
        margin: 0 0 0.4rem;
      }

      .entry {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.3rem 0;
        border-bottom: 1px solid #f8fafc;
        font-size: 0.875rem;
        color: #1e293b;
      }

      .entry:last-child { border-bottom: none; }

      .entry-label { flex: 1; min-width: 0; }

      .entry-dates {
        font-size: 0.8rem;
        color: #94a3b8;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .entry-label a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: #cbd5e1;
        text-underline-offset: 2px;
      }

      .entry-label a:hover {
        text-decoration-color: currentColor;
      }

      .footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      a.ext-link, button.detail-btn, button.action-btn {
        font-size: 0.8rem;
        padding: 0.35rem 0.875rem;
        border-radius: 1rem;
        text-decoration: none;
        cursor: pointer;
        font-family: inherit;
      }

      a.ext-link {
        color: #000052;
        border: 1px solid #000052;
      }

      a.ext-link:hover { background: #000052; color: #fff; }

      button.detail-btn {
        background: #eef0fa;
        color: #000052;
        border: none;
        font-weight: 600;
      }

      button.detail-btn:hover { background: #dde0f5; }

      button.action-btn {
        color: #fff;
        background: #000052;
        border: none;
        margin-left: auto;
      }

      button.action-btn:hover { background: #00003a; }
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;
  @property({ attribute: false }) detailLoading = false;
  @property({ attribute: false }) hasOhmFootprint = false;
  @property({ attribute: false }) ohmElementId: string | undefined;
  @property({ attribute: false }) ohmElementType: 'way' | 'relation' | undefined;
  @property({ attribute: false }) authenticated = false;

  @state() private editMode = false;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('building')) {
      this.toggleAttribute('open', this.building !== null);
    }
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _showDetail() {
    this.dispatchEvent(new CustomEvent('show-detail', { bubbles: true, composed: true }));
  }

  private _login() {
    login(); // Redirects to OAuth, never resolves
  }

  private _edit() {
    this.editMode = true;
  }

  private _cancelEdit() {
    this.editMode = false;
  }

  private _datesLine(): string {
    const builtYear = this.building?.inception ? extractYear(this.building.inception) : '';
    const demoYear = this.detail?.demolished ? extractYear(this.detail.demolished) : '';
    if (builtYear && demoYear) return `${builtYear}–${demoYear}`;
    if (builtYear) return msg(str`Erbaut um ${builtYear}`);
    if (demoYear) return msg(str`Abgerissen ${demoYear}`);
    return '';
  }

  private _renderSection(
    title: string,
    items: Array<{ primary: string; href?: string; range?: string }>,
  ): TemplateResult {
    return html`
      <div class="section">
        <p class="section-title">${title}</p>
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

  render() {
    if (!this.building) return html`<div class="panel"></div>`;
    const { label, type, image, id } = this.building;
    const { detail, detailLoading } = this;
    const datesLine = this._datesLine();

    if (this.editMode) {
      return html`
        <div class="panel">
          <building-edit-form
            .building=${this.building}
            .detail=${this.detail}
            @cancel=${this._cancelEdit}
          ></building-edit-form>
        </div>
      `;
    }

    return html`
      <div class="panel">
        ${image ? keyed(image, html`<div class="image-wrap"><img src=${image} alt=${label}></div>`) : ''}

        <div class="header">
          <div class="title">
            <div class="badges">
              ${detail?.heritages.map((h) => html`<span class="badge badge-heritage">${h}</span>`)}
              ${type ? html`<span class="badge badge-type">${type}</span>` : ''}
            </div>
            <h2>${label}</h2>
            ${datesLine ? html`<p class="dates">${datesLine}</p>` : ''}
          </div>
          <button class="close-btn" @click=${this._close} aria-label=${msg('Schließen')}>✕</button>
        </div>

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
          <a class="ext-link" href="https://www.wikidata.org/wiki/${id}" target="_blank" rel="noopener">
            Wikidata ↗
          </a>
          ${detail?.ohmId || (this.hasOhmFootprint && this.ohmElementId) ? html`
            <a class="ext-link" href=${detail?.ohmId
              ? `https://www.openhistoricalmap.org/relation/${detail.ohmId}`
              : `https://www.openhistoricalmap.org/${this.ohmElementType}/${this.ohmElementId}`}
              target="_blank" rel="noopener">
              OpenHistoricalMap ↗
            </a>
          ` : ''}
          <button class="detail-btn" @click=${this._showDetail}>
            ${msg('Vollständige Details')} →
          </button>
          ${this.authenticated ? html`
            <button class="action-btn" @click=${this._edit}>${msg('Bearbeiten')}</button>
          ` : html`
            <button class="action-btn" @click=${this._login}>${msg('Anmelden zum Bearbeiten')}</button>
          `}
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
