import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { searchPlaces, type NominatimResult } from '../services/nominatim';
import { baseStyles } from '../styles/shared';

const DEBOUNCE_MS = 400;

export interface PlaceSelectedEvent {
  lat: number;
  lng: number;
  boundingbox: [string, string, string, string];
}

@localized()
@customElement('search-box')
export class SearchBox extends LitElement {
  static styles = [baseStyles, css`
    :host {
      display: block;
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 10;
      width: 280px;
    }

    .input-row {
      display: flex;
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      padding: 9px 12px;
      font-size: 14px;
      font-family: inherit;
      background: transparent;
      min-width: 0;
    }

    button.search-btn {
      border: none;
      background: none;
      cursor: pointer;
      padding: 0 11px;
      color: #555;
      font-size: 22px;
      display: flex;
      align-items: center;
    }

    button.search-btn:hover {
      color: #111;
    }

    .results {
      margin-top: 4px;
      background: #fff;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .result-item {
      padding: 9px 12px;
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      line-height: 1.3;
      border-bottom: 1px solid #f0f0f0;
      color: #222;
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-item:hover {
      background: #f5f5f5;
    }

    .no-results {
      padding: 9px 12px;
      font-size: 13px;
      font-family: inherit;
      color: #888;
    }
  `];

  @state() private query = '';
  @state() private results: NominatimResult[] = [];
  @state() private showResults = false;
  @state() private loading = false;

  private _debounce = 0;
  private _controller: AbortController | null = null;

  private _onInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    clearTimeout(this._debounce);
    if (!this.query.trim()) {
      this.results = [];
      this.showResults = false;
      return;
    }
    this._debounce = window.setTimeout(() => this._search(), DEBOUNCE_MS);
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.showResults = false;
    }
  }

  private async _search() {
    this._controller?.abort();
    this._controller = new AbortController();
    this.loading = true;
    try {
      this.results = await searchPlaces(this.query, this._controller.signal);
      this.showResults = true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Nominatim error:', err);
    } finally {
      this.loading = false;
    }
  }

  private _select(r: NominatimResult) {
    this.query = r.display_name;
    this.showResults = false;
    this.dispatchEvent(
      new CustomEvent<PlaceSelectedEvent>('place-selected', {
        bubbles: true,
        composed: true,
        detail: {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          boundingbox: r.boundingbox,
        },
      }),
    );
  }

  render() {
    return html`
      <div class="input-row">
        <input
          type="search"
          placeholder=${msg('Orte suchen …')}
          .value=${this.query}
          @input=${this._onInput}
          @keydown=${this._onKeydown}
          aria-label=${msg('Orte suchen')}
        />
        <button class="search-btn" @click=${this._search} aria-label=${msg('Suchen')}>
          ${this.loading ? '⟳' : '⌕'}
        </button>
      </div>
      ${this.showResults
        ? html`
            <div class="results">
              ${this.results.length
                ? this.results.map(
                    (r) => html`
                      <div class="result-item" @click=${() => this._select(r)}>
                        ${r.display_name}
                      </div>
                    `,
                  )
                : html`<div class="no-results">${msg('Keine Ergebnisse')}</div>`}
            </div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-box': SearchBox;
  }
}
