import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import type { WikidataBuilding } from '../types/building';

@localized()
@customElement('building-popup')
export class BuildingPopup extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 10;
      display: block;
    }

    .card {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
      max-width: 280px;
      overflow: hidden;
      font-family: sans-serif;
    }

    .image-wrapper {
      width: 100%;
      height: 160px;
      background: #e8e8e8;
      position: relative;
      overflow: hidden;
    }

    .image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      position: absolute;
      inset: 0;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .image.loaded {
      opacity: 1;
    }

    .body {
      padding: 14px 16px 16px;
    }

    .type {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 4px;
    }

    .name {
      font-size: 16px;
      font-weight: 600;
      color: #111;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .inception {
      font-size: 13px;
      color: #555;
      margin-bottom: 10px;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    a.wikidata-link {
      display: inline-block;
      font-size: 12px;
      color: #3366cc;
      text-decoration: none;
      padding: 4px 10px;
      border: 1px solid #3366cc;
      border-radius: 14px;
    }

    a.wikidata-link:hover {
      background: #3366cc;
      color: #fff;
    }

    button.close {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #888;
      padding: 4px 8px;
      border-radius: 50%;
      line-height: 1;
    }

    button.close:hover {
      background: #f0f0f0;
    }
  `;

  @property({ attribute: false }) building!: WikidataBuilding;
  @state() private imageLoaded = false;

  updated(changed: PropertyValues) {
    if (changed.has('building')) {
      this.imageLoaded = false;
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
    const { label, type, image, inception, id } = this.building;
    const wikidataUrl = `https://www.wikidata.org/wiki/${id}`;

    return html`
      <div class="card">
        ${image
          ? html`<div class="image-wrapper">
              <img
                class="image ${this.imageLoaded ? 'loaded' : ''}"
                src="${image}"
                alt="${label}"
                @load=${() => { this.imageLoaded = true; }}
              />
            </div>`
          : ''}
        <div class="body">
          ${type ? html`<div class="type">${type}</div>` : ''}
          <div class="name">${label}</div>
          ${inception
            ? html`<div class="inception">${this._formatInception(inception)}</div>`
            : ''}
          <div class="actions">
            <a class="wikidata-link" href="${wikidataUrl}" target="_blank" rel="noopener">
              Wikidata
            </a>
            <button class="close" @click=${this._close} aria-label=${msg('Schließen')}>&#x2715;</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-popup': BuildingPopup;
  }
}
