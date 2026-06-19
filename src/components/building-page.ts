import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, PersonRef, AddressEntry } from '../types/building';
import { baseStyles } from '../styles/shared';

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
@customElement('building-page')
export class BuildingPage extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        flex: 1;
        overflow-y: auto;
        background: #fff;
        min-height: 0;
      }

      .hero {
        width: 100%;
        height: 280px;
        background: #f1f5f9;
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
        max-width: 680px;
        margin: 0 auto;
        padding: 1.75rem 1.25rem 4rem;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 0.75rem;
      }

      .badge {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #fff;
        padding: 2px 7px;
        border-radius: 10px;
      }

      .badge-type { background: #000052; }
      .badge-heritage { background: #b45309; }

      h1 {
        font-size: 1.75rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
        margin: 0 0 0.35rem;
        letter-spacing: -0.02em;
      }

      .dates {
        font-size: 0.9rem;
        color: #64748b;
        margin: 0 0 2rem;
      }

      .section {
        margin-bottom: 1.5rem;
      }

      .section-title {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
        margin: 0 0 0.5rem;
      }

      .entry {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.4rem 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.9375rem;
        color: #1e293b;
      }

      .entry:last-child { border-bottom: none; }

      .entry-label { flex: 1; min-width: 0; }

      .entry-label a {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: #cbd5e1;
        text-underline-offset: 2px;
      }

      .entry-label a:hover { text-decoration-color: currentColor; }

      .entry-dates {
        font-size: 0.85rem;
        color: #94a3b8;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 0.5rem 0 2rem;
      }

      .skel-line {
        height: 14px;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        border-radius: 4px;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      a.ext-link {
        font-size: 0.8rem;
        color: #000052;
        text-decoration: none;
        padding: 0.35rem 0.875rem;
        border: 1px solid #000052;
        border-radius: 1rem;
      }

      a.ext-link:hover { background: #000052; color: #fff; }
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;
  @property({ attribute: false }) detailLoading = false;

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
    if (!this.building) return html``;
    const { label, type, image, id } = this.building;
    const { detail, detailLoading } = this;
    const datesLine = this._datesLine();

    return html`
      ${image ? keyed(image, html`
        <div class="hero"><img src=${image} alt=${label}></div>
      `) : ''}

      <div class="content">
        <div class="badges">
          ${detail?.heritages.map((h) => html`<span class="badge badge-heritage">${h}</span>`)}
          ${type ? html`<span class="badge badge-type">${type}</span>` : ''}
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
