import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { BUILDING_TYPE_IDS, getBuildingTypeLabel, BUILDING_TYPE_SET } from '../services/building-type-options';
import type { WikidataItem } from '../types/building';
import { buttonStyles, inputStyles } from '../styles/design-tokens';
import { createBuilding, type SourceRef } from '../services/wikidata-edit-rest';
import type { OhmBuildingPrefill } from '../services/ohm';
import { buildingTagToWikidataType } from '../services/ohm';
import './entity-search';
import './app-button';
import './icon';
import IconCheck from '~icons/mdi/check';
import IconClose from '~icons/mdi/close';

@localized()
@customElement('building-create-form')
export class BuildingCreateForm extends LitElement {
  static styles = [
    inputStyles,
    buttonStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .form-header {
        padding: var(--space-4) var(--space-4) var(--space-2);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .form-title {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-1);
      }

      .form-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-tertiary);
        margin: 0;
      }

      .error-message {
        margin-top: var(--space-3);
        padding: var(--space-3);
        background: #fee;
        border: 1px solid #f88;
        border-radius: var(--radius-md);
        color: #c00;
        font-size: var(--font-size-sm);
      }

      .form-body {
        padding: var(--space-4);
        overflow-y: auto;
        flex: 1;
        box-sizing: border-box;
      }

      .field-group {
        margin-bottom: var(--space-4);
      }

      label {
        display: block;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-1);
      }

      input, select {
        width: 100%;
        padding: var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-sizing: border-box;
        font-family: inherit;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      }

      input:focus, select:focus {
        outline: none;
        border-color: var(--color-border-focus);
        box-shadow: var(--shadow-focus);
      }

      input:read-only {
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
      }

      .source-section {
        background: var(--color-accent-light);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin-top: var(--space-4);
        box-sizing: border-box;
      }

      .source-section h3 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
        margin: 0 0 var(--space-2);
      }

      .source-note {
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        margin: 0 0 var(--space-4);
      }

      .source-type-picker {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }

      .source-type-btn {
        flex: 1;
        padding: var(--space-2);
        border: 2px solid var(--color-accent);
        background: var(--color-bg-primary);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        color: var(--color-primary);
        cursor: pointer;
        font-family: inherit;
        transition: all var(--transition-fast);
      }

      .source-type-btn.active {
        background: var(--color-accent);
        color: var(--color-primary);
      }

      .btn-link {
        background: none;
        border: none;
        padding: 0;
        color: var(--color-primary);
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        text-decoration: underline;
      }

      .form-footer {
        flex-shrink: 0;
        border-top: 1px solid var(--color-border);
        padding: var(--space-4);
        display: flex;
        gap: var(--space-3);
        box-sizing: border-box;
      }

      .form-footer app-button:last-child {
        flex: 1;
      }

      .ohm-banner {
        margin-top: var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: var(--color-accent-light);
        border: 1px solid var(--color-accent);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
    `,
  ];

  @property({ type: Number }) lat = 0;
  @property({ type: Number }) lng = 0;
  @property({ attribute: false }) ohmPrefill: OhmBuildingPrefill | null = null;

  @state() private formLabel = '';
  @state() private formType: WikidataItem | undefined;
  @state() private formInception = '';
  @state() private sourceType: 'url' | 'archive' | 'book' = 'url';
  @state() private sourceUrl = '';
  @state() private sourcePage = '';
  @state() private archiveItem: WikidataItem | undefined;
  @state() private archiveCallNumber = '';
  @state() private archivePage = '';
  @state() private bookMode: 'item' | 'freetext' = 'item';
  @state() private bookItem: WikidataItem | undefined;
  @state() private bookTitle = '';
  @state() private bookAuthor = '';
  @state() private bookYear = '';
  @state() private bookPage = '';
  @state() private saving = false;
  @state() private saveError: string | null = null;

  updated(changed: PropertyValues) {
    if (changed.has('ohmPrefill') && this.ohmPrefill) {
      this.formLabel = this.ohmPrefill.name ?? '';
      const type = buildingTagToWikidataType(this.ohmPrefill.buildingTag);
      if (type) this.formType = type;
      if (this.ohmPrefill.startDate) this.formInception = this.ohmPrefill.startDate;
    }
  }

  private get _typeSuggestions(): WikidataItem[] {
    return ['Q41176', ...BUILDING_TYPE_IDS].map(id => ({ id, label: getBuildingTypeLabel(id) }));
  }

  private get _canSave(): boolean {
    if (!this.formLabel.trim()) return false;
    if (this.sourceType === 'url' && !this.sourceUrl.trim()) return false;
    if (this.sourceType === 'archive' && (!this.archiveItem || !this.archiveCallNumber.trim())) return false;
    if (this.sourceType === 'book') {
      if (this.bookMode === 'item' && !this.bookItem) return false;
      if (this.bookMode === 'freetext' && !this.bookTitle.trim()) return false;
    }
    return true;
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private async _save() {
    if (!this._canSave) return;

    this.saving = true;
    this.saveError = null;

    let source: SourceRef;
    if (this.sourceType === 'url') {
      source = { type: 'url', url: this.sourceUrl.trim(), page: this.sourcePage.trim() || undefined };
    } else if (this.sourceType === 'archive') {
      source = {
        type: 'archive',
        archive: this.archiveItem!,
        callNumber: this.archiveCallNumber.trim(),
        page: this.archivePage.trim() || undefined,
      };
    } else if (this.bookMode === 'item') {
      source = { type: 'book', mode: 'item', book: this.bookItem!, page: this.bookPage.trim() || undefined };
    } else {
      source = {
        type: 'book',
        mode: 'freetext',
        title: this.bookTitle.trim(),
        titleLanguage: navigator.language.split('-')[0] || 'de',
        author: this.bookAuthor.trim() || undefined,
        year: this.bookYear.trim() || undefined,
        page: this.bookPage.trim() || undefined,
      };
    }

    try {
      const item = await createBuilding({
        label: this.formLabel.trim(),
        type: this.formType,
        lat: this.lat,
        lng: this.lng,
        inception: this.formInception.trim() || undefined,
        source,
      });

      this.dispatchEvent(new CustomEvent('building-created', {
        detail: { id: item.id, label: item.label, lat: this.lat, lng: this.lng },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this.saveError = err instanceof Error ? err.message : String(err);
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div class="form-header">
        <h2 class="form-title">${msg('Neues Gebäude anlegen')}</h2>
        <p class="form-subtitle">${msg('Wird als neuer Wikidata-Eintrag angelegt')}</p>
        <p class="form-subtitle">${msg('Koordinaten')}: ${this.lat.toFixed(5)}, ${this.lng.toFixed(5)}</p>
        ${this.ohmPrefill ? html`
          <div class="ohm-banner">${msg('Vorausgefüllt aus OpenHistoricalMap')}</div>
        ` : ''}
        ${this.saveError ? html`
          <div class="error-message" role="alert">${this.saveError}</div>
        ` : ''}
      </div>

      <div class="form-body">
        <div class="field-group">
          <label>${msg('Name')} *</label>
          <input
            type="text"
            .value=${this.formLabel}
            placeholder="${msg('z.B. Müllerhof')}"
            @input=${(e: Event) => this.formLabel = (e.target as HTMLInputElement).value}
            ?disabled=${this.saving}
            autofocus>
        </div>

        <div class="field-group">
          <label>${msg('Typ')}</label>
          <entity-search
            .value=${this.formType?.label ?? ''}
            .suggestions=${this._typeSuggestions}
            .filterFn=${(id: string) => BUILDING_TYPE_SET.has(id)}
            placeholder=${msg('Gebäude')}
            @select=${(e: CustomEvent) => this.formType = e.detail}
            @clear=${() => this.formType = undefined}
            ?disabled=${this.saving}
          ></entity-search>
        </div>

        <div class="field-group">
          <label>${msg('Erbaut')}</label>
          <input
            type="text"
            placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
            .value=${this.formInception}
            @input=${(e: Event) => this.formInception = (e.target as HTMLInputElement).value}
            ?disabled=${this.saving}>
        </div>

        <div class="source-section">
          <h3>${msg('Quelle')} (${msg('erforderlich')})</h3>
          <p class="source-note">${msg('Alle Änderungen müssen mit einer Quelle belegt werden.')}</p>

          <div class="source-type-picker">
            <button
              class="source-type-btn ${this.sourceType === 'url' ? 'active' : ''}"
              @click=${() => this.sourceType = 'url'}>
              ${msg('Online')}
            </button>
            <button
              class="source-type-btn ${this.sourceType === 'archive' ? 'active' : ''}"
              @click=${() => this.sourceType = 'archive'}>
              ${msg('Archivdokument')}
            </button>
            <button
              class="source-type-btn ${this.sourceType === 'book' ? 'active' : ''}"
              @click=${() => this.sourceType = 'book'}>
              ${msg('Buch')}
            </button>
          </div>

          ${this.sourceType === 'url' ? html`
            <div class="field-group">
              <label>URL</label>
              <input
                type="url"
                placeholder="https://"
                .value=${this.sourceUrl}
                @input=${(e: Event) => this.sourceUrl = (e.target as HTMLInputElement).value}
                ?disabled=${this.saving}>
            </div>
            <div class="field-group">
              <label>${msg('Beschreibung / Seite')} (${msg('optional')})</label>
              <input
                type="text"
                .value=${this.sourcePage}
                @input=${(e: Event) => this.sourcePage = (e.target as HTMLInputElement).value}
                ?disabled=${this.saving}>
            </div>
          ` : this.sourceType === 'archive' ? html`
            <div class="field-group">
              <label>${msg('Archivname')}</label>
              <entity-search
                placeholder="${msg('Archiv suchen...')}"
                @select=${(e: CustomEvent) => this.archiveItem = e.detail}
                @clear=${() => this.archiveItem = undefined}
              ></entity-search>
              ${this.archiveItem ? html`
                <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                  ${msg('Ausgewählt:')} ${this.archiveItem.label}
                </div>
              ` : ''}
            </div>
            <div class="field-group">
              <label>${msg('Signatur')}</label>
              <input
                type="text"
                .value=${this.archiveCallNumber}
                @input=${(e: Event) => this.archiveCallNumber = (e.target as HTMLInputElement).value}
                ?disabled=${this.saving}>
            </div>
            <div class="field-group">
              <label>${msg('Beschreibung / Seite')} (${msg('optional')})</label>
              <input
                type="text"
                .value=${this.archivePage}
                @input=${(e: Event) => this.archivePage = (e.target as HTMLInputElement).value}
                ?disabled=${this.saving}>
            </div>
          ` : html`
            ${this.bookMode === 'item' ? html`
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">
                ${msg('Buch nicht auf Wikidata?')}
                <button class="btn-link" @click=${() => this.bookMode = 'freetext'}>
                  ${msg('Manuell eingeben')}
                </button>
              </div>
              <div class="field-group">
                <label>${msg('Buchtitel')}</label>
                <entity-search
                  placeholder="${msg('Buch suchen...')}"
                  @select=${(e: CustomEvent) => this.bookItem = e.detail}
                  @clear=${() => this.bookItem = undefined}
                ></entity-search>
                ${this.bookItem ? html`
                  <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                    ${msg('Ausgewählt:')} ${this.bookItem.label}
                  </div>
                ` : ''}
              </div>
              <div class="field-group">
                <label>${msg('Seite')} (${msg('optional')})</label>
                <input
                  type="text"
                  .value=${this.bookPage}
                  @input=${(e: Event) => this.bookPage = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
            ` : html`
              <div class="field-group">
                <label>${msg('Titel')} *</label>
                <input
                  type="text"
                  .value=${this.bookTitle}
                  @input=${(e: Event) => this.bookTitle = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
              <div class="field-group">
                <label>${msg('Autor')} (${msg('optional')})</label>
                <input
                  type="text"
                  .value=${this.bookAuthor}
                  @input=${(e: Event) => this.bookAuthor = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
              <div class="field-group">
                <label>${msg('Jahr')} (${msg('optional')})</label>
                <input
                  type="text"
                  placeholder="YYYY"
                  maxlength="4"
                  .value=${this.bookYear}
                  @input=${(e: Event) => this.bookYear = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
              <div class="field-group">
                <label>${msg('Seite')} (${msg('optional')})</label>
                <input
                  type="text"
                  .value=${this.bookPage}
                  @input=${(e: Event) => this.bookPage = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
                <button class="btn-link" @click=${() => this.bookMode = 'item'}>
                  ${msg('← Auf Wikidata suchen')}
                </button>
              </div>
            `}
          `}
        </div>
      </div>

      <div class="form-footer">
        <app-button variant="secondary" .leadingIcon=${IconClose} @click=${this._cancel} ?disabled=${this.saving}>
          ${msg('Abbrechen')}
        </app-button>
        <app-button
          variant="primary"
          .leadingIcon=${IconCheck}
          @click=${this._save}
          ?disabled=${this.saving || !this._canSave}>
          ${this.saving ? msg('Wird angelegt…') : msg('Gebäude anlegen')}
        </app-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-create-form': BuildingCreateForm;
  }
}
