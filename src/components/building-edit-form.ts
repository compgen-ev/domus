import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import type { WikidataBuilding, BuildingDetail } from '../types/building';
import { baseStyles } from '../styles/shared';

@localized()
@customElement('building-edit-form')
export class BuildingEditForm extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
      }

      .form-header {
        padding: 1rem 1rem 0.5rem;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        background: #fff;
        z-index: 10;
      }

      .form-title {
        font-size: 1rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.25rem;
      }

      .form-subtitle {
        font-size: 0.8rem;
        color: #64748b;
        margin: 0;
      }

      .form-body {
        padding: 1rem;
      }

      .section {
        margin-bottom: 2rem;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }

      .section-title {
        font-size: 0.875rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
      }

      .add-btn {
        background: none;
        border: 1px dashed #cbd5e1;
        color: #000052;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.3rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
      }

      .add-btn:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }

      .field-group {
        margin-bottom: 1rem;
      }

      label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 0.3rem;
      }

      input, textarea, select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.875rem;
        color: #0f172a;
      }

      input:focus, textarea:focus, select:focus {
        outline: none;
        border-color: #000052;
        box-shadow: 0 0 0 3px rgba(0, 0, 82, 0.1);
      }

      textarea {
        resize: vertical;
        min-height: 80px;
      }

      .source-section {
        background: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 8px;
        padding: 1rem;
        margin-top: 2rem;
      }

      .source-section .section-title {
        color: #92400e;
        margin-bottom: 0.5rem;
      }

      .source-note {
        font-size: 0.8rem;
        color: #92400e;
        margin: 0 0 1rem;
      }

      .source-type-picker {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .source-type-btn {
        flex: 1;
        padding: 0.5rem;
        border: 2px solid #fbbf24;
        background: #fff;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #92400e;
        cursor: pointer;
        font-family: inherit;
      }

      .source-type-btn.active {
        background: #fbbf24;
        color: #fff;
      }

      .form-footer {
        position: sticky;
        bottom: 0;
        background: #fff;
        border-top: 1px solid #e2e8f0;
        padding: 1rem;
        display: flex;
        gap: 0.75rem;
      }

      .btn-primary {
        flex: 1;
        background: #000052;
        color: #fff;
        border: none;
        padding: 0.65rem;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-primary:hover { background: #00003a; }
      .btn-primary:disabled {
        background: #cbd5e1;
        cursor: not-allowed;
      }

      .btn-secondary {
        padding: 0.65rem 1.25rem;
        background: none;
        border: 1px solid #cbd5e1;
        color: #64748b;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-secondary:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;

  @state() private sourceType: 'url' | 'archive' = 'url';

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _save() {
    // TODO: Implement Wikidata write
    console.log('Save clicked');
  }

  render() {
    if (!this.building) return html``;

    return html`
      <div class="form-header">
        <h2 class="form-title">${this.building.label} ${msg('bearbeiten')}</h2>
        <p class="form-subtitle">${msg('Änderungen werden direkt in Wikidata gespeichert')}</p>
      </div>

      <div class="form-body">
        <!-- Section 1: Basic Facts -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Grunddaten')}</h3>
          </div>
          <div class="field-group">
            <label>${msg('Name')}</label>
            <input type="text" .value=${this.building.label}>
          </div>
          <div class="field-group">
            <label>${msg('Typ')}</label>
            <select>
              <option>${msg('Haus')}</option>
              <option>${msg('Bauernhaus')}</option>
              <option>${msg('Mehrfamilienhaus')}</option>
              <option>${msg('Mühle')}</option>
              <option>${msg('Herrenhaus')}</option>
              <option>${msg('Sonstiges')}</option>
            </select>
          </div>
          <div class="field-group">
            <label>${msg('Erbaut')}</label>
            <input type="text" placeholder="YYYY" .value=${this.building.inception || ''}>
          </div>
          <div class="field-group">
            <label>${msg('Abgerissen')}</label>
            <input type="text" placeholder="YYYY" .value=${this.detail?.demolished || ''}>
          </div>
        </div>

        <!-- Section 2: Address History -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Adressgeschichte')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing addresses -->
        </div>

        <!-- Section 3: Residents -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Bewohner')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing residents -->
        </div>

        <!-- Section 4: Owners -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Eigentümer')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing owners -->
        </div>

        <!-- Section 5: Events -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Ereignisse')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing events -->
        </div>

        <!-- Section 6: External Links -->
        <div class="section">
          <div class="section-header">
            <h3 class="section-title">${msg('Externe Links')}</h3>
          </div>
          <div class="field-group">
            <label>OpenHistoricalMap Relation ID</label>
            <input type="text" .value=${this.detail?.ohmId || ''}>
          </div>
        </div>

        <!-- Source (required) -->
        <div class="source-section">
          <h3 class="section-title">${msg('Quelle')} (${msg('erforderlich')})</h3>
          <p class="source-note">${msg('Alle Änderungen müssen mit einer Quelle belegt werden.')}</p>

          <div class="source-type-picker">
            <button
              class="source-type-btn ${this.sourceType === 'url' ? 'active' : ''}"
              @click=${() => this.sourceType = 'url'}>
              ${msg('Online-Quelle')}
            </button>
            <button
              class="source-type-btn ${this.sourceType === 'archive' ? 'active' : ''}"
              @click=${() => this.sourceType = 'archive'}>
              ${msg('Archivdokument')}
            </button>
          </div>

          ${this.sourceType === 'url' ? html`
            <div class="field-group">
              <label>URL</label>
              <input type="url" placeholder="https://">
            </div>
            <div class="field-group">
              <label>${msg('Beschreibung / Seite')} (${msg('optional')})</label>
              <input type="text">
            </div>
          ` : html`
            <div class="field-group">
              <label>${msg('Archivname')}</label>
              <input type="text">
            </div>
            <div class="field-group">
              <label>${msg('Signatur')}</label>
              <input type="text">
            </div>
            <div class="field-group">
              <label>${msg('Beschreibung / Seite')} (${msg('optional')})</label>
              <input type="text">
            </div>
          `}
        </div>
      </div>

      <div class="form-footer">
        <button class="btn-secondary" @click=${this._cancel}>${msg('Abbrechen')}</button>
        <button class="btn-primary" @click=${this._save}>${msg('Änderungen speichern')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-edit-form': BuildingEditForm;
  }
}
