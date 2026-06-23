import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, WikidataItem } from '../types/building';
import { baseStyles } from '../styles/shared';
import { buttonStyles, inputStyles } from '../styles/design-tokens';
import { editBuilding, type BuildingEditData } from '../services/wikidata-edit-rest';
import './entity-search';
import './app-button';
import './icon';
import IconCheck from '~icons/mdi/check';
import IconClose from '~icons/mdi/close';
import IconUnfoldMore from '~icons/mdi/unfold-more-horizontal';

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
        overflow-x: hidden;
        width: 100%;
        max-width: 100%;
      }

      .form-header {
        padding: var(--space-4) var(--space-4) var(--space-2);
        border-bottom: 1px solid var(--color-border);
        position: sticky;
        top: 0;
        background: var(--color-bg-primary);
        z-index: var(--z-sticky);
        box-sizing: border-box;
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

      .error-details {
        margin-top: var(--space-2);
        padding-top: var(--space-2);
        border-top: 1px solid #fcc;
      }

      .error-details summary {
        cursor: pointer;
        font-size: var(--font-size-xs);
        color: #a00;
        user-select: none;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      .error-details summary:hover {
        color: #c00;
      }

      .error-details-content {
        margin-top: var(--space-2);
        padding: var(--space-2);
        background: #fff;
        border: 1px solid #fcc;
        border-radius: var(--radius-sm);
        font-family: monospace;
        font-size: 11px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
      }

      .copy-btn {
        margin-top: var(--space-2);
        padding: var(--space-1) var(--space-2);
        background: #fff;
        border: 1px solid #fcc;
        border-radius: var(--radius-sm);
        color: #c00;
        font-size: var(--font-size-xs);
        cursor: pointer;
        font-family: inherit;
      }

      .copy-btn:hover {
        background: #fff5f5;
      }

      .form-body {
        padding: var(--space-4);
        box-sizing: border-box;
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

      .date-range {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-2);
      }

      .date-field {
        flex: 1;
      }

      .date-field label {
        font-size: var(--font-size-xs);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-1);
      }

      input, textarea, select {
        width: 100%;
        padding: var(--space-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-sizing: border-box;
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
        box-sizing: border-box;
      }

      .btn-primary {
        flex: 1;
        background: var(--color-accent);
        color: var(--color-primary);
        border: none;
        padding: 0.65rem;
        border-radius: var(--radius-md);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background var(--transition-fast);
      }

      .btn-primary:hover {
        background: var(--color-accent-dark);
        color: white;
      }
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
  @state() private sourceUrl = '';
  @state() private formLabel = '';
  @state() private formAliases = '';
  @state() private formType: WikidataItem | undefined;
  @state() private formInception = '';
  @state() private formDemolished = '';
  @state() private formAddress = '';
  @state() private formAddressStartDate = '';
  @state() private formAddressEndDate = '';
  @state() private formArchitect: WikidataItem | undefined;
  @state() private formCommissionedBy: WikidataItem | undefined;
  @state() private formOwner: WikidataItem | undefined;
  @state() private formOwnerStartDate = '';
  @state() private formOwnerEndDate = '';
  @state() private formOccupant: WikidataItem | undefined;
  @state() private formOccupantStartDate = '';
  @state() private formOccupantEndDate = '';
  @state() private saving = false;
  @state() private saveError: string | null = null;
  @state() private saveErrorDetails: any = null;

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

  protected willUpdate(changed: PropertyValues) {
    // Reset form state when building changes
    if (changed.has('building') && this.building) {
      this.formLabel = this.building.label;
      this.formType = this.building.type;
      this.formInception = this.building.inception || '';
      this.formDemolished = this.detail?.demolished || '';
      this.sourceUrl = '';
      this.saveError = null;
      this.saveErrorDetails = null;
    }
  }

  private get _canSave(): boolean {
    // Check if there are any changes or additions
    const hasChanges =
      (this.formLabel !== this.building?.label) ||
      (this.formType !== undefined && this.formType !== this.building?.type) ||
      (this.formInception !== (this.building?.inception || '')) ||
      (this.formDemolished !== (this.detail?.demolished || '')) ||
      (this.formAddress.trim() !== '') ||
      (this.formAliases.trim() !== '') ||
      (this.formArchitect !== undefined) ||
      (this.formCommissionedBy !== undefined) ||
      (this.formOwner !== undefined) ||
      (this.formOccupant !== undefined);

    // No changes = can't save
    if (!hasChanges) {
      return false;
    }

    // Check if there are any claim changes (not label/aliases)
    const hasClaimChanges =
      (this.formType !== undefined && this.formType !== this.building?.type) ||
      (this.formInception !== (this.building?.inception || '')) ||
      (this.formDemolished !== (this.detail?.demolished || '')) ||
      (this.formAddress.trim() !== '') ||
      (this.formArchitect !== undefined) ||
      (this.formCommissionedBy !== undefined) ||
      (this.formOwner !== undefined) ||
      (this.formOccupant !== undefined);

    // Source URL is required when there are claim changes
    if (hasClaimChanges && !this.sourceUrl.trim()) {
      return false;
    }

    return true;
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private async _copyErrorDetails() {
    if (!this.saveErrorDetails) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.saveErrorDetails, null, 2));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  private async _save() {
    if (!this.building) return;

    this.saving = true;
    this.saveError = null;
    this.saveErrorDetails = null;

    const editData: BuildingEditData = {
      id: this.building.id,
      label: this.formLabel !== this.building.label ? this.formLabel : undefined,
      aliases: this.formAliases || undefined,
      type: this.formType?.id !== this.building.type?.id ? this.formType : undefined,
      inception: this.formInception !== this.building.inception ? this.formInception : undefined,
      demolished: this.formDemolished !== this.detail?.demolished ? this.formDemolished : undefined,
      address: this.formAddress || undefined,
      addressStartDate: this.formAddressStartDate || undefined,
      addressEndDate: this.formAddressEndDate || undefined,
      architect: this.formArchitect || undefined,
      commissionedBy: this.formCommissionedBy || undefined,
      owner: this.formOwner || undefined,
      ownerStartDate: this.formOwnerStartDate || undefined,
      ownerEndDate: this.formOwnerEndDate || undefined,
      occupant: this.formOccupant || undefined,
      occupantStartDate: this.formOccupantStartDate || undefined,
      occupantEndDate: this.formOccupantEndDate || undefined,
      sourceUrl: this.sourceUrl || undefined,
    };

    try {
      await editBuilding(editData);

      // Success - dispatch event to notify parent
      this.dispatchEvent(new CustomEvent('save-success', {
        bubbles: true,
        composed: true,
        detail: { buildingId: this.building.id },
      }));
    } catch (err) {
      this.saveError = err instanceof Error ? err.message : 'Unknown error';
      this.saveErrorDetails = {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : 'Error',
        timestamp: new Date().toISOString(),
        editData: {
          id: editData.id,
          hasLabel: !!editData.label,
          hasType: !!editData.type,
          hasInception: !!editData.inception,
          hasDemolished: !!editData.demolished,
          hasAddress: !!editData.address,
          hasArchitect: !!editData.architect,
          hasCommissionedBy: !!editData.commissionedBy,
          hasOwner: !!editData.owner,
          hasOccupant: !!editData.occupant,
          hasSourceUrl: !!editData.sourceUrl,
        },
      };
      console.error('Save failed:', err);
    } finally {
      this.saving = false;
    }
  }

  render() {
    if (!this.building) return html``;
    const building = this.building;

    return keyed(building.id, html`
      <div class="form-header">
        <h2 class="form-title">${building.label} ${msg('bearbeiten')}</h2>
        <p class="form-subtitle">${msg('Änderungen werden direkt in Wikidata gespeichert')}</p>
        ${this.saveError ? html`
          <div class="error-message" role="alert">
            ${this.saveError}
            ${this.saveErrorDetails ? html`
              <div class="error-details">
                <details>
                  <summary><domus-icon .svg=${IconUnfoldMore}></domus-icon> Debug details</summary>
                  <div class="error-details-content">${JSON.stringify(this.saveErrorDetails, null, 2)}</div>
                  <button class="copy-btn" @click=${this._copyErrorDetails}>
                    Copy to clipboard
                  </button>
                </details>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <div class="form-body">
        <!-- Section 1: Basic Facts -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Grunddaten')}</h3>
          </div>
          <div class="field-group">
            <label>${msg('Name')}</label>
            <input
              type="text"
              .value=${this.formLabel}
              @input=${(e: Event) => this.formLabel = (e.target as HTMLInputElement).value}
              ?disabled=${this.saving}>
          </div>
          <div class="field-group">
            <label>${msg('Alternative Namen')}</label>
            <input
              type="text"
              placeholder="${msg('z.B. Müllerhof, Alte Schmiede')}"
              .value=${this.formAliases}
              @input=${(e: Event) => this.formAliases = (e.target as HTMLInputElement).value}
              ?disabled=${this.saving}>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-1);">
              ${msg('Mehrere Namen durch Komma trennen')}
            </div>
          </div>
          <div class="field-group">
            <label>${msg('Typ')}</label>
            <select
              @change=${(e: Event) => {
                const value = (e.target as HTMLSelectElement).value;
                this.formType = value ? this._getBuildingTypeOptions().find(t => t.id === value) : undefined;
              }}
              ?disabled=${this.saving}>
              <option value="" ?selected=${!this.formType}>${msg('Nicht angegeben')}</option>
              ${this._getBuildingTypeOptions().map(type => html`
                <option value=${type.id} ?selected=${this.formType?.id === type.id}>
                  ${type.label}
                </option>
              `)}
            </select>
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
          <div class="field-group">
            <label>${msg('Abgerissen')}</label>
            <input
              type="text"
              placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
              .value=${this.formDemolished}
              @input=${(e: Event) => this.formDemolished = (e.target as HTMLInputElement).value}
              ?disabled=${this.saving}>
          </div>
        </div>

        <!-- Section 2: Address -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Adresse')}</h3>
          </div>
          ${this.detail?.addresses && this.detail.addresses.length > 0 ? html`
            <div style="margin-bottom: var(--space-3); font-size: var(--font-size-sm); color: var(--color-text-muted);">
              ${msg('Vorhandene Adressen:')} ${this.detail.addresses.map(a => a.text).join(', ')}
            </div>
          ` : ''}
          <div class="field-group">
            <label>${msg('Neue Adresse hinzufügen')}</label>
            <input
              type="text"
              placeholder="${msg('z.B. Hauptstraße 1')}"
              .value=${this.formAddress}
              @input=${(e: Event) => this.formAddress = (e.target as HTMLInputElement).value}
              ?disabled=${this.saving}>
            <div class="date-range">
              <div class="date-field">
                <label>${msg('Von (Jahr)')}</label>
                <input
                  type="text"
                  placeholder="YYYY"
                  .value=${this.formAddressStartDate}
                  @input=${(e: Event) => this.formAddressStartDate = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
              <div class="date-field">
                <label>${msg('Bis (Jahr)')}</label>
                <input
                  type="text"
                  placeholder="YYYY"
                  .value=${this.formAddressEndDate}
                  @input=${(e: Event) => this.formAddressEndDate = (e.target as HTMLInputElement).value}
                  ?disabled=${this.saving}>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: People -->
        <div class="section">
          <div class="section-header">
            <h3 >${msg('Personen & Organisationen')}</h3>
          </div>

          <div class="field-group">
            <label>${msg('Architekt hinzufügen')}</label>
            ${this.detail?.architects && this.detail.architects.length > 0 ? html`
              <div style="margin-bottom: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                ${msg('Vorhanden:')} ${this.detail.architects.map(a => a.label).join(', ')}
              </div>
            ` : ''}
            <entity-search
              placeholder="${msg('Architekt suchen...')}"
              allow-create
              @select=${(e: CustomEvent) => this.formArchitect = e.detail}
            ></entity-search>
            ${this.formArchitect ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formArchitect.label}
              </div>
            ` : ''}
          </div>

          <div class="field-group">
            <label>${msg('Bauherr hinzufügen')}</label>
            ${this.detail?.commissionedBy && this.detail.commissionedBy.length > 0 ? html`
              <div style="margin-bottom: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                ${msg('Vorhanden:')} ${this.detail.commissionedBy.map(c => c.label).join(', ')}
              </div>
            ` : ''}
            <entity-search
              placeholder="${msg('Bauherr suchen...')}"
              allow-create
              @select=${(e: CustomEvent) => this.formCommissionedBy = e.detail}
            ></entity-search>
            ${this.formCommissionedBy ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formCommissionedBy.label}
              </div>
            ` : ''}
          </div>

          <div class="field-group">
            <label>${msg('Eigentümer hinzufügen')}</label>
            ${this.detail?.owners && this.detail.owners.length > 0 ? html`
              <div style="margin-bottom: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                ${msg('Vorhanden:')} ${this.detail.owners.map(o => o.label).join(', ')}
              </div>
            ` : ''}
            <entity-search
              placeholder="${msg('Eigentümer suchen...')}"
              allow-create
              @select=${(e: CustomEvent) => this.formOwner = e.detail}
            ></entity-search>
            ${this.formOwner ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formOwner.label}
              </div>
              <div class="date-range">
                <div class="date-field">
                  <label>${msg('Von (Jahr)')}</label>
                  <input
                    type="text"
                    placeholder="YYYY"
                    .value=${this.formOwnerStartDate}
                    @input=${(e: Event) => this.formOwnerStartDate = (e.target as HTMLInputElement).value}
                    ?disabled=${this.saving}>
                </div>
                <div class="date-field">
                  <label>${msg('Bis (Jahr)')}</label>
                  <input
                    type="text"
                    placeholder="YYYY"
                    .value=${this.formOwnerEndDate}
                    @input=${(e: Event) => this.formOwnerEndDate = (e.target as HTMLInputElement).value}
                    ?disabled=${this.saving}>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="field-group">
            <label>${msg('Bewohner hinzufügen')}</label>
            ${this.detail?.occupants && this.detail.occupants.length > 0 ? html`
              <div style="margin-bottom: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-muted);">
                ${msg('Vorhanden:')} ${this.detail.occupants.map(o => o.label).join(', ')}
              </div>
            ` : ''}
            <entity-search
              placeholder="${msg('Bewohner suchen...')}"
              allow-create
              @select=${(e: CustomEvent) => this.formOccupant = e.detail}
            ></entity-search>
            ${this.formOccupant ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formOccupant.label}
              </div>
              <div class="date-range">
                <div class="date-field">
                  <label>${msg('Von (Jahr)')}</label>
                  <input
                    type="text"
                    placeholder="YYYY"
                    .value=${this.formOccupantStartDate}
                    @input=${(e: Event) => this.formOccupantStartDate = (e.target as HTMLInputElement).value}
                    ?disabled=${this.saving}>
                </div>
                <div class="date-field">
                  <label>${msg('Bis (Jahr)')}</label>
                  <input
                    type="text"
                    placeholder="YYYY"
                    .value=${this.formOccupantEndDate}
                    @input=${(e: Event) => this.formOccupantEndDate = (e.target as HTMLInputElement).value}
                    ?disabled=${this.saving}>
                </div>
              </div>
            ` : ''}
          </div>
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
              <input
                type="url"
                placeholder="https://"
                .value=${this.sourceUrl}
                @input=${(e: Event) => this.sourceUrl = (e.target as HTMLInputElement).value}
                ?disabled=${this.saving}
                required>
            </div>
            <div class="field-group">
              <label>${msg('Beschreibung / Seite')} (${msg('optional')})</label>
              <input type="text" ?disabled=${this.saving}>
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
        <app-button variant="secondary" .leadingIcon=${IconClose} @click=${this._cancel} ?disabled=${this.saving}>
          ${msg('Abbrechen')}
        </app-button>
        <app-button variant="primary" .leadingIcon=${IconCheck} @click=${this._save} ?disabled=${this.saving || !this._canSave}>
          ${this.saving ? msg('Wird gespeichert …') : msg('Änderungen speichern')}
        </button>
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-edit-form': BuildingEditForm;
  }
}
