import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { inputStyles } from '../styles/design-tokens';
import {
  commonsFilenameFromInput,
  commonsFilesNear,
  fetchCommonsFile,
  searchCommonsFiles,
  type CommonsFile,
} from '../services/commons';

const SEARCH_DELAY_MS = 350;

/**
 * Picks an existing image from Wikimedia Commons. With an empty field it
 * offers images taken near `lat`/`lng`; typed text is resolved directly when
 * it is a Commons URL or `File:` name, and searched for otherwise.
 * Emits `select` (CustomEvent<CommonsFile>).
 */
@localized()
@customElement('commons-image-picker')
export class CommonsImagePicker extends LitElement {
  static styles = [
    inputStyles,
    css`
      :host {
        display: block;
      }

      input {
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2);
      }

      .heading {
        margin: var(--space-3) 0 var(--space-2);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }

      .status {
        margin-top: var(--space-2);
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: var(--space-2);
        max-height: 320px;
        overflow-y: auto;
      }

      .grid button {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-1);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-bg-primary);
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        min-width: 0;
      }

      .grid button:hover,
      .grid button:focus-visible {
        border-color: var(--color-primary);
      }

      .grid img {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: var(--radius-sm);
        background: var(--color-bg-secondary);
      }

      .grid span {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  @property({ type: Number }) lat?: number;
  @property({ type: Number }) lng?: number;
  @property({ type: Boolean }) disabled = false;

  @state() private query = '';
  @state() private results: CommonsFile[] = [];
  @state() private nearby: CommonsFile[] = [];
  @state() private loading = false;
  @state() private failed = false;

  private _controller?: AbortController;
  private _timer?: ReturnType<typeof setTimeout>;

  protected updated(changed: PropertyValues) {
    if ((changed.has('lat') || changed.has('lng')) && this.lat !== undefined && this.lng !== undefined) {
      this._loadNearby(this.lat, this.lng);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._timer);
    this._controller?.abort();
  }

  private async _loadNearby(lat: number, lng: number) {
    try {
      this.nearby = await commonsFilesNear(lat, lng);
    } catch (err) {
      // Suggestions are optional; the field still works without them.
      console.error('Nearby Commons images failed:', err);
    }
  }

  private _onInput(e: Event) {
    this.query = (e.target as HTMLInputElement).value;
    clearTimeout(this._timer);
    this._controller?.abort();
    this.failed = false;
    if (!this.query.trim()) {
      this.results = [];
      this.loading = false;
      return;
    }
    this.loading = true;
    this._timer = setTimeout(() => this._lookup(this.query), SEARCH_DELAY_MS);
  }

  private async _lookup(query: string) {
    const controller = new AbortController();
    this._controller = controller;
    try {
      const name = commonsFilenameFromInput(query);
      const results = name
        ? [await fetchCommonsFile(name, controller.signal)].filter((f): f is CommonsFile => !!f)
        : await searchCommonsFiles(query.trim(), controller.signal);
      if (controller.signal.aborted) return;
      this.results = results;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Commons lookup failed:', err);
      this.results = [];
      this.failed = true;
    } finally {
      if (this._controller === controller) this.loading = false;
    }
  }

  private _select(file: CommonsFile) {
    this.dispatchEvent(new CustomEvent<CommonsFile>('select', {
      detail: file,
      bubbles: true,
      composed: true,
    }));
  }

  private _renderGrid(files: CommonsFile[]) {
    return html`
      <div class="grid">
        ${files.map((f) => html`
          <button type="button" title=${f.name} @click=${() => this._select(f)} ?disabled=${this.disabled}>
            <img src=${f.thumbUrl} alt="" loading="lazy">
            <span>${f.name}</span>
          </button>
        `)}
      </div>
    `;
  }

  private _renderBody() {
    if (!this.query.trim()) {
      return this.nearby.length > 0
        ? html`<div class="heading">${msg('Bilder in der Nähe')}</div>${this._renderGrid(this.nearby)}`
        : '';
    }
    if (this.loading) return html`<div class="status">${msg('Suche läuft …')}</div>`;
    if (this.failed) return html`<div class="status">${msg('Suche auf Commons fehlgeschlagen')}</div>`;
    if (this.results.length === 0) return html`<div class="status">${msg('Keine Bilder gefunden')}</div>`;
    return this._renderGrid(this.results);
  }

  render() {
    return html`
      <input
        type="search"
        placeholder=${msg('Dateiname, Suchbegriff oder Commons-Link')}
        aria-label=${msg('Bild auf Wikimedia Commons suchen')}
        .value=${this.query}
        @input=${this._onInput}
        ?disabled=${this.disabled}>
      ${this._renderBody()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'commons-image-picker': CommonsImagePicker;
  }
}
