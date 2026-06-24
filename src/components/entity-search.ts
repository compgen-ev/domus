import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import type { WikidataItem } from '../types/building';
import { inputStyles } from '../styles/design-tokens';
import { createPerson } from '../services/wikidata-edit-rest';
import { getLocale } from '../locale';

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

      .create-option {
        padding: var(--space-3) var(--space-4);
        cursor: pointer;
        border-top: 1px solid var(--color-border);
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        display: flex;
        align-items: center;
        gap: var(--space-2);
        transition: background var(--transition-fast);
        position: sticky;
        bottom: 0;
        background: var(--color-bg-primary);
      }

      .create-option:hover {
        background: var(--color-bg-secondary);
      }

      .create-form {
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border);
        border-top: none;
        border-radius: 0 0 var(--radius-md) var(--radius-md);
        background: var(--color-bg-primary);
        box-shadow: var(--shadow-md);
      }

      .create-form-title {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin-bottom: var(--space-2);
      }

      .create-form input {
        margin-bottom: var(--space-2);
      }

      .create-form-hint {
        font-size: var(--font-size-xs);
        color: var(--color-text-muted);
        margin-bottom: var(--space-3);
      }

      .create-form-actions {
        display: flex;
        gap: var(--space-2);
      }

      .create-btn {
        flex: 1;
        padding: var(--space-2) var(--space-3);
        background: var(--color-accent);
        color: var(--color-primary);
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        font-family: inherit;
        transition: background var(--transition-fast);
      }

      .create-btn:hover:not(:disabled) {
        background: var(--color-accent-dark);
        color: white;
      }

      .create-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .cancel-btn {
        padding: var(--space-2) var(--space-3);
        background: none;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        color: var(--color-text-tertiary);
        cursor: pointer;
        font-family: inherit;
      }

      .cancel-btn:hover {
        background: var(--color-bg-secondary);
      }

      .create-error {
        font-size: var(--font-size-xs);
        color: #c00;
        margin-top: var(--space-2);
      }

      input {
        width: 100%;
        box-sizing: border-box;
      }
    `,
  ];

  @property({ type: String }) placeholder = '';  
  @property({ type: String }) value = '';
  @property({ type: Boolean, attribute: 'allow-create' }) allowCreate = false;

  @state() private searchQuery = '';
  @state() private results: Array<{ id: string; label: string; description?: string }> = [];
  @state() private loading = false;
  @state() private showResults = false;
  @state() private createMode = false;
  @state() private createName = '';
  @state() private createDescription = '';
  @state() private creating = false;
  @state() private createError: string | null = null;

  private searchTimeout: number | null = null;
  private searchAbort: AbortController | null = null;

  private async _searchEntities(query: string) {
    if (!query || query.length < 2) {
      this.results = [];
      this.showResults = false;
      return;
    }

    // Cancel any in-flight request so stale results never overwrite newer ones
    this.searchAbort?.abort();
    const controller = new AbortController();
    this.searchAbort = controller;

    this.loading = true;
    this.showResults = true;

    try {
      await this._searchGeneric(query, controller.signal);
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return; // superseded by newer query
      console.error('Entity search failed:', err);
      this.results = [];
    } finally {
      if (this.searchAbort === controller) {
        this.loading = false;
        this.searchAbort = null;
      }
    }
  }

  private async _searchGeneric(query: string, signal: AbortSignal) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    const lang = getLocale();
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', query);
    url.searchParams.set('language', lang);
    url.searchParams.set('uselang', lang);
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const response = await fetch(url.toString(), { signal });
    if (!response.ok) throw new Error(`wbsearchentities failed: ${response.status}`);
    const data = await response.json();

    this.results = data.search?.map((item: any) => ({
      id: item.id,
      label: item.label || item.id,
      description: item.description,
    })) ?? [];
  }

  private _onInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;

    if (!input.value) {
      this.dispatchEvent(new CustomEvent('clear', { bubbles: true, composed: true }));
    }

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
    // Delay to allow click on results or create form
    setTimeout(() => {
      if (!this.createMode) {
        this.showResults = false;
      }
    }, 200);
  }

  private _startCreate() {
    this.createMode = true;
    this.createName = this.searchQuery;
    this.createDescription = '';
    this.createError = null;
    this.showResults = false;
  }

  private _cancelCreate() {
    this.createMode = false;
    this.createError = null;
  }

  private async _submitCreate() {
    if (!this.createName.trim()) return;

    this.creating = true;
    this.createError = null;

    try {
      const item = await createPerson(
        this.createName.trim(),
        this.createDescription.trim() || undefined,
      );
      this.searchQuery = item.label;
      this.results = [];
      this.createMode = false;
      this.dispatchEvent(new CustomEvent('select', {
        detail: item,
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this.createError = err instanceof Error ? err.message : String(err);
    } finally {
      this.creating = false;
    }
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
        ?disabled=${this.creating}
      />

      ${this.createMode ? html`
        <div class="create-form">
          <div class="create-form-title">${msg('Neue Person anlegen')}</div>
          <input
            type="text"
            .value=${this.createName}
            placeholder="${msg('Name')}"
            @input=${(e: Event) => this.createName = (e.target as HTMLInputElement).value}
            ?disabled=${this.creating}
          />
          <input
            type="text"
            .value=${this.createDescription}
            placeholder="${msg('Beschreibung (optional, z.B. Bauer aus Musterstadt)')}"
            @input=${(e: Event) => this.createDescription = (e.target as HTMLInputElement).value}
            ?disabled=${this.creating}
          />
          <div class="create-form-hint">${msg('Erstellt einen neuen Wikidata-Eintrag (Mensch, Q5)')}</div>
          <div class="create-form-actions">
            <button class="cancel-btn" @click=${this._cancelCreate} ?disabled=${this.creating}>
              ${msg('Abbrechen')}
            </button>
            <button
              class="create-btn"
              @click=${this._submitCreate}
              ?disabled=${this.creating || !this.createName.trim()}
            >
              ${this.creating ? msg('Wird angelegt…') : msg('Person anlegen')}
            </button>
          </div>
          ${this.createError ? html`
            <div class="create-error">${this.createError}</div>
          ` : ''}
        </div>
      ` : this.showResults ? html`
        <div class="search-results">
          ${this.loading ? html`
            <div class="loading">${msg('Suche läuft...')}</div>
          ` : this.results.length > 0 ? html`
            ${this.results.map(item => html`
              <div class="result-item" @click=${() => this._onSelect(item)}>
                <div class="result-label">${item.label}</div>
                ${item.description ? html`
                  <div class="result-description">${item.description}</div>
                ` : ''}
                <div class="result-id">${item.id}</div>
              </div>
            `)}
            ${this.allowCreate ? html`
              <div class="create-option" @click=${this._startCreate}>
                + ${msg('Neue Person anlegen')}
              </div>
            ` : ''}
          ` : html`
            <div class="no-results">${msg('Keine Ergebnisse')}</div>
            ${this.allowCreate ? html`
              <div class="create-option" @click=${this._startCreate}>
                + ${msg(str`"${this.searchQuery}" als neue Person anlegen`)}
              </div>
            ` : ''}
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
