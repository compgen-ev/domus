import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, WikidataItem } from '../types/building';
import { baseStyles } from '../styles/shared';
import { buttonStyles, inputStyles } from '../styles/design-tokens';

@localized()
@customElement('building-edit-form')
export class BuildingEditForm extends LitElement {
  static styles = [
    baseStyles,
    buttonStyles,
    inputStyles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow-y: auto;
      }

      .form-header {
        padding: var(--space-4) var(--space-4) var(--space-2);
        border-bottom: 1px solid var(--color-border);
        position: sticky;
        top: 0;
        background: var(--color-bg-primary);
        z-index: var(--z-sticky);
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

      .form-body {
        padding: var(--space-4);
      }

      .section {
        margin-bottom: var(--space-10);
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-2);
      }

      h3 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        margin: 0;
      }

      .add-btn {
        background: none;
        border: 1.5px dashed var(--color-text-muted);
        color: var(--color-primary);
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: inherit;
        transition: all var(--transition-fast);
      }

      .add-btn:hover {
        background: var(--color-bg-secondary);
        border-color: var(--color-primary);
        border-style: solid;
      }

      .field-group {
        margin-bottom: var(--space-4);
      }

      input, textarea, select {
        width: 100%;
        padding: var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-family: inherit;
        font-size: var(--font-size-sm);
        color: var(--color-text-primary);
        box-sizing: border-box;
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      }

      input:focus, textarea:focus, select:focus {
        outline: none;
        border-color: var(--color-border-focus);
        box-shadow: var(--shadow-focus);
      }

      textarea {
        resize: vertical;
        min-height: 80px;
      }

      .source-section {
        background: var(--color-accent-light);
        border: 2px solid var(--color-accent);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin-top: var(--space-8);
        box-sizing: border-box;
      }

      .source-section h3 {
        color: var(--color-primary);
        margin-bottom: var(--space-2);
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

      .form-footer {
        position: sticky;
        bottom: 0;
        background: var(--color-bg-primary);
        border-top: 1px solid var(--color-border);
        padding: var(--space-4);
        display: flex;
        gap: var(--space-3);
      }

      .btn-primary {
        flex: 1;
        background: var(--color-primary);
        color: white;
        border: none;
        padding: 0.65rem;
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-primary:hover { background: var(--color-primary-hover); }
      .btn-primary:disabled {
        background: var(--color-border);
        cursor: not-allowed;
      }

      .btn-secondary {
        padding: 0.65rem 1.25rem;
        background: none;
        border: 1px solid var(--color-border);
        color: var(--color-text-tertiary);
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }

      .btn-secondary:hover {
        background: var(--color-bg-secondary);
        border-color: var(--color-text-muted);
      }
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;

  @state() private sourceType: 'url' | 'archive' = 'url';

  // Common building types - Q-codes only
  private readonly buildingTypeIds = [
    'Q3947',      // dwelling
    'Q188869',    // farmhouse
    'Q1021106',   // apartment building
    'Q20034440',  // single-family home
    'Q16970',     // church building
    'Q108325',    // chapel
    'Q149566',    // school building
    'Q25550691',  // town hall
    'Q44494',     // mill
    'Q162113',    // barn
    'Q1662011',   // stable
    'Q1662536',   // storehouse
    'Q879050',    // manor house
    'Q23413',     // palace
    'Q23691',     // castle
    'Q1542143',   // factory building
    'Q656720',    // workshop
    'Q27686',     // inn
    'Q18543139',  // railway station building
  ];

  private _getTypeLabel(id: string): string {
    switch (id) {
      case 'Q3947': return msg('Wohnhaus');
      case 'Q188869': return msg('Bauernhaus');
      case 'Q1021106': return msg('Mehrfamilienhaus');
      case 'Q20034440': return msg('Einfamilienhaus');
      case 'Q16970': return msg('Kirchengebäude');
      case 'Q108325': return msg('Kapelle');
      case 'Q149566': return msg('Schulgebäude');
      case 'Q25550691': return msg('Rathaus');
      case 'Q44494': return msg('Mühle');
      case 'Q162113': return msg('Scheune');
      case 'Q1662011': return msg('Stall');
      case 'Q1662536': return msg('Speicher');
      case 'Q879050': return msg('Herrenhaus');
      case 'Q23413': return msg('Schloss');
      case 'Q23691': return msg('Burg');
      case 'Q1542143': return msg('Fabrikgebäude');
      case 'Q656720': return msg('Werkstatt');
      case 'Q27686': return msg('Gasthaus');
      case 'Q18543139': return msg('Bahnhofsgebäude');
      default: return id; // Fallback to Q-code if unknown
    }
  }

  private _getBuildingTypeOptions(): WikidataItem[] {
    const currentType = this.building?.type;
    const options = this.buildingTypeIds.map(id => ({
      id,
      label: this._getTypeLabel(id),
    }));

    // If current type exists and is not in predefined list, add it at the top
    if (currentType && !this.buildingTypeIds.includes(currentType.id)) {
      return [currentType, ...options];
    }
    return options;
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _save() {
    // TODO: Implement Wikidata write
    console.log('Save clicked');
  }

  render() {
    if (!this.building) return html``;
    const building = this.building;

    return keyed(building.id, html`
      <div class="form-header">
        <h2 class="form-title">${building.label} ${msg('bearbeiten')}</h2>
        <p class="form-subtitle">${msg('Änderungen werden direkt in Wikidata gespeichert')}</p>
      </div>

      <div class="form-body">
        <!-- Section 1: Basic Facts -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Grunddaten')}</h3>
          </div>
          <div class="field-group">
            <label>${msg('Name')}</label>
            <input type="text" .value=${building.label}>
          </div>
          <div class="field-group">
            <label>${msg('Typ')}</label>
            <select>
              <option value="" ?selected=${!building.type}>${msg('Nicht angegeben')}</option>
              ${this._getBuildingTypeOptions().map(type => html`
                <option value=${type.id} ?selected=${building.type?.id === type.id}>
                  ${type.label}
                </option>
              `)}
            </select>
          </div>
          <div class="field-group">
            <label>${msg('Erbaut')}</label>
            <input type="text" placeholder="YYYY" .value=${building.inception || ''}>
          </div>
          <div class="field-group">
            <label>${msg('Abgerissen')}</label>
            <input type="text" placeholder="YYYY" .value=${this.detail?.demolished || ''}>
          </div>
        </div>

        <!-- Section 2: Address History -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Adressgeschichte')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing addresses -->
        </div>

        <!-- Section 3: Residents -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Bewohner')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing residents -->
        </div>

        <!-- Section 4: Owners -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Eigentümer')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing owners -->
        </div>

        <!-- Section 5: Events -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Ereignisse')}</h3>
            <button class="add-btn">+ ${msg('Hinzufügen')}</button>
          </div>
          <!-- TODO: List existing events -->
        </div>

        <!-- Section 6: External Links -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Externe Links')}</h3>
          </div>
          <div class="field-group">
            <label>OpenHistoricalMap Relation ID</label>
            <input type="text" .value=${this.detail?.ohmId || ''}>
          </div>
        </div>

        <!-- Source (required) -->
        <div class="source-section">
          <h3 >${msg('Quelle')} (${msg('erforderlich')})</h3>
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
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-edit-form': BuildingEditForm;
  }
}
