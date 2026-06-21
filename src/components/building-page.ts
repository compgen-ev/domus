import { LitElement, html, css, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, PersonRef, AddressEntry } from '../types/building';
import { baseStyles } from '../styles/shared';
import { buttonStyles, badgeStyles } from '../styles/design-tokens';
import { formatDate } from '../utils/dates';
import './building-edit-form';
import './app-button';

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
@customElement('building-page')
export class BuildingPage extends LitElement {
  static styles = [
    baseStyles,
    buttonStyles,
    badgeStyles,
    css`
      :host {
        display: block;
        flex: 1;
        overflow-y: auto;
        background: var(--color-bg-primary);
        min-height: 0;
      }

      .hero {
        width: 100%;
        height: 280px;
        background: var(--color-bg-tertiary);
        overflow: hidden;
        flex-shrink: 0;
      }

      .hero img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .content {
        max-width: var(--content-max-width);
        margin: 0 auto;
        padding: var(--space-6) var(--space-5) var(--space-12);
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-bottom: var(--space-3);
      }

      .badge-type {
        background: var(--color-primary);
        color: white;
      }

      h1 {
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: var(--line-height-tight);
        margin: 0 0 var(--space-2);
        letter-spacing: -0.02em;
      }

      .dates {
        font-size: var(--font-size-sm);
        color: var(--color-text-tertiary);
        margin: 0 0 var(--space-8);
      }

      .section {
        margin-bottom: var(--space-10);
      }

      h3 {
        font-size: var(--font-size-lg);
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

      .entry-label a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: var(--color-border);
        text-underline-offset: 2px;
        transition: text-decoration-color var(--transition-fast);
      }

      .entry-label a:hover { text-decoration-color: currentColor; }

      .entry-dates {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .skeleton {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-2) 0 var(--space-8);
      }

      .skel-line {
        height: 14px;
        background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-border) 50%, var(--color-bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: var(--radius-sm);
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .footer {
        margin-top: var(--space-8);
        padding-top: var(--space-4);
        border-top: 1px solid var(--color-border-light);
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      a.ext-link {
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        text-decoration: none;
        padding: var(--space-2) var(--space-4);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-md);
        background: transparent;
        transition: all var(--transition-fast);
      }

      a.ext-link:hover {
        background: var(--color-primary);
        color: white;
      }

      .back-btn {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        cursor: pointer;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-6);
        display: inline-block;
        transition: all var(--transition-fast);
      }

      .back-btn:hover {
        background: var(--color-primary);
        color: white;
      }

      .edit-btn {
        background: var(--color-primary);
        color: white;
        border: none;
        cursor: pointer;
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        transition: background var(--transition-fast);
      }

      .edit-btn:hover {
        background: var(--color-primary-hover);
      }

      .edit-wrapper {
        max-width: 680px;
        margin: 0 auto;
        padding: 1rem;
      }
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
  @state() private linkCopied = false;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('building')) {
      // Close edit mode when switching buildings
      if (this.editMode) {
        this.editMode = false;
      }
    }
  }

  private _backToMap() {
    this.dispatchEvent(new CustomEvent('back-to-map', { bubbles: true, composed: true }));
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
      await navigator.clipboard.writeText(window.location.href);
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }

  private _datesLine(): string {
    const builtDate = this.building?.inception ? formatDate(this.building.inception) : '';
    const demoDate = this.detail?.demolished ? formatDate(this.detail.demolished) : '';
    if (builtDate && demoDate) return `${builtDate}–${demoDate}`;
    if (builtDate) return msg(str`Erbaut ${builtDate}`);
    if (demoDate) return msg(str`Abgerissen ${demoDate}`);
    return '';
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

  render() {
    if (!this.building) return html``;
    const { label, type, image, id } = this.building;
    const { detail, detailLoading } = this;
    const datesLine = this._datesLine();

    if (this.editMode) {
      return html`
        <div class="edit-wrapper">
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
      ${image ? keyed(image, html`
        <div class="hero"><img src=${image} alt=${label}></div>
      `) : ''}

      <div class="content">
        <button class="back-btn" @click=${this._backToMap}>← ${msg('Zur Karte')}</button>
        <div class="badges">
          ${detail?.heritages.map((h) => html`<span class="badge badge-heritage">${h}</span>`)}
          ${type ? html`<span class="badge badge-type">${type.label}</span>` : ''}
        </div>
        <h1>${label}</h1>
        ${datesLine ? html`<p class="dates">${datesLine}</p>` : ''}

        ${detailLoading ? html`
          <div class="skeleton">
            <div class="skel-line" style="width:35%"></div>
            <div class="skel-line" style="width:75%"></div>
            <div class="skel-line" style="width:60%"></div>
            <div class="skel-line" style="width:35%; margin-top:8px"></div>
            <div class="skel-line" style="width:80%"></div>
            <div class="skel-line" style="width:55%"></div>
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
          <app-button variant="outline" @click=${this._copyLink}>
            ${this.linkCopied ? msg('Kopiert!') : msg('Link kopieren')}
          </app-button>
          ${this.authenticated ? html`
            <button class="edit-btn" @click=${this._edit}>${msg('Bearbeiten')}</button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-page': BuildingPage;
  }
}
