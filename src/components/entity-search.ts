import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import type { WikidataItem } from '../types/building';
import { inputStyles } from '../styles/design-tokens';

/**
 * Autocomplete search for Wikidata entities
 */
@localized()
@customElement('entity-search')
export class EntitySearch extends LitElement {
  static styles = [
    inputStyles,
    css`
      :host {
        display: block;
        position: relative;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }

      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-top: none;
        border-radius: 0 0 var(--radius-md) var(--radius-md);
        max-height: 300px;
        overflow-y: auto;
        z-index: var(--z-dropdown);
        box-shadow: var(--shadow-md);
      }

      .result-item {
        padding: var(--space-3) var(--space-4);
        cursor: pointer;
        border-bottom: 1px solid var(--color-border-light);
        transition: background var(--transition-fast);
      }

      .result-item:hover {
        background: var(--color-bg-secondary);
      }

      .result-item:last-child {
        border-bottom: none;
      }

      .result-label {
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
      }

      .result-description {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-top: var(--space-1);
      }

      .result-id {
        font-size: var(--font-size-xs);
        color: var(--color-text-tertiary);
        font-family: monospace;
      }

      .no-results {
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        text-align: center;
      }

      .loading {
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
        text-align: center;
      }

      input {
        width: 100%;
        box-sizing: border-box;
      }
    `,
  ];

  @property({ type: String }) placeholder = '';
  @property({ type: String }) value = '';

  @state() private searchQuery = '';
  @state() private results: Array<{ id: string; label: string; description?: string }> = [];
  @state() private loading = false;
  @state() private showResults = false;

  private searchTimeout: number | null = null;

  private async _searchEntities(query: string) {
    if (!query || query.length < 2) {
      this.results = [];
      this.showResults = false;
      return;
    }

    this.loading = true;
    this.showResults = true;

    try {
      // Wikidata search API
      const url = new URL('https://www.wikidata.org/w/api.php');
      url.searchParams.set('action', 'wbsearchentities');
      url.searchParams.set('search', query);
      url.searchParams.set('language', 'de');
      url.searchParams.set('limit', '10');
      url.searchParams.set('format', 'json');
      url.searchParams.set('origin', '*');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.search) {
        this.results = data.search.map((item: any) => ({
          id: item.id,
          label: item.label || item.id,
          description: item.description,
        }));
      } else {
        this.results = [];
      }
    } catch (err) {
      console.error('Entity search failed:', err);
      this.results = [];
    } finally {
      this.loading = false;
    }
  }

  private _onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(() => {
      this._searchEntities(this.searchQuery);
    }, 300);
  }

  private _onSelect(item: { id: string; label: string; description?: string }) {
    this.searchQuery = item.label;
    this.showResults = false;

    const wikidataItem: WikidataItem = {
      id: item.id,
      label: item.label,
    };

    this.dispatchEvent(new CustomEvent('select', {
      detail: wikidataItem,
      bubbles: true,
      composed: true,
    }));
  }

  private _onFocus() {
    if (this.results.length > 0) {
      this.showResults = true;
    }
  }

  private _onBlur() {
    // Delay to allow click on results
    setTimeout(() => {
      this.showResults = false;
    }, 200);
  }

  render() {
    return html`
      <input
        type="text"
        class="input"
        .value=${this.searchQuery}
        .placeholder=${this.placeholder}
        @input=${this._onInput}
        @focus=${this._onFocus}
        @blur=${this._onBlur}
      />

      ${this.showResults ? html`
        <div class="search-results">
          ${this.loading ? html`
            <div class="loading">${msg('Suche läuft...')}</div>
          ` : this.results.length > 0 ? this.results.map(item => html`
            <div class="result-item" @click=${() => this._onSelect(item)}>
              <div class="result-label">${item.label}</div>
              ${item.description ? html`
                <div class="result-description">${item.description}</div>
              ` : ''}
              <div class="result-id">${item.id}</div>
            </div>
          `) : html`
            <div class="no-results">${msg('Keine Ergebnisse')}</div>
          `}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'entity-search': EntitySearch;
  }
}
