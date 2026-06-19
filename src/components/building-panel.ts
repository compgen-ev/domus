import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import type { WikidataBuilding } from '../types/building';
import { baseStyles } from '../styles/shared';

@localized()
@customElement('building-panel')
export class BuildingPanel extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
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

      .type-badge {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #fff;
        background: #000052;
        padding: 2px 7px;
        border-radius: 10px;
        display: inline-block;
        margin-bottom: 0.4rem;
      }

      h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
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

      .inception { font-size: 0.875rem; color: #666; }

      .footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 0.5rem;
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

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('building')) {
      this.toggleAttribute('open', this.building !== null);
    }
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _formatInception(raw: string): string {
    const year = raw.match(/^(\d{1,4})/)?.[1];
    return year ? msg(str`Erbaut um ${year}`) : raw;
  }

  render() {
    if (!this.building) return html`<div class="panel"></div>`;
    const { label, type, image, inception, id } = this.building;

    return html`
      <div class="panel">
        ${image ? html`<div class="image-wrap"><img src=${image} alt=${label}></div>` : ''}
        <div class="header">
          <div class="title">
            ${type ? html`<span class="type-badge">${type}</span>` : ''}
            <h2>${label}</h2>
          </div>
          <button class="close-btn" @click=${this._close} aria-label=${msg('Schließen')}>✕</button>
        </div>
        <div class="body">
          ${inception ? html`<p class="inception">${this._formatInception(inception)}</p>` : ''}
        </div>
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
    'building-panel': BuildingPanel;
  }
}
