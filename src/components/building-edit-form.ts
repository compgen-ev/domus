import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { BUILDING_TYPE_IDS, getBuildingTypeLabel, BUILDING_TYPE_SET } from '../services/building-type-options';
import { keyed } from 'lit/directives/keyed.js';
import type { WikidataBuilding, BuildingDetail, WikidataItem, SavedBuildingValues } from '../types/building';
import { baseStyles } from '../styles/shared';
import { buttonStyles, inputStyles } from '../styles/design-tokens';
import { editBuilding, type BuildingEditData, type SourceRef } from '../services/wikidata-edit-rest';
import { statementDateToEdit, editToStatementDate, type StatementDateEdit } from '../utils/dates';
import { normalizeAliases } from '../utils/aliases';
import './entity-search';
import './app-button';
import './icon';
import './date-input';
import './statement-date-input';
import IconCheck from '~icons/mdi/check';
import IconClose from '~icons/mdi/close';
import IconUnfoldMore from '~icons/mdi/unfold-more-horizontal';

function dateEditsEqual(a: StatementDateEdit, b: StatementDateEdit): boolean {
  return a.mode === b.mode && a.value === b.value && a.earliest === b.earliest && a.latest === b.latest;
}

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
        box-sizing: border-box;
      }

      .form-footer-buttons {
        display: flex;
        gap: var(--space-3);
      }

      .save-hint {
        margin-top: var(--space-2);
        font-size: var(--font-size-xs);
        color: var(--color-error);
        text-align: center;
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
    `,
  ];

  @property({ attribute: false }) building: WikidataBuilding | null = null;
  @property({ attribute: false }) detail: BuildingDetail | null = null;
  /** Confirmed-but-not-yet-indexed values from a previous save in this session.
   *  Takes precedence over the SPARQL-derived building/detail props. */
  @property({ attribute: false }) savedValues: SavedBuildingValues | null = null;

  @state() private sourceType: 'url' | 'archive' | 'book' = 'url';
  @state() private sourceUrl = '';
  @state() private sourceTitle = '';
  @state() private archiveItem: WikidataItem | undefined;
  @state() private archiveCallNumber = '';
  @state() private archivePage = '';
  @state() private bookMode: 'item' | 'freetext' = 'item';
  @state() private bookItem: WikidataItem | undefined;
  @state() private bookTitle = '';
  @state() private bookAuthor = '';
  @state() private bookYear = '';
  @state() private bookPage = '';
  @state() private formLabel = '';
  @state() private formAliases = '';
  @state() private formType: WikidataItem | undefined;
  @state() private formInception: StatementDateEdit = statementDateToEdit(undefined);
  @state() private formDemolished: StatementDateEdit = statementDateToEdit(undefined);
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

  private get _inceptionChanged(): boolean {
    return !dateEditsEqual(this.formInception, this._currentInceptionEdit);
  }

  private get _demolishedChanged(): boolean {
    return !dateEditsEqual(this.formDemolished, this._currentDemolishedEdit);
  }

  /**
   * The values this edit session started from. Captured once when the form
   * opens and never moved afterwards — a refresh landing mid-edit must not
   * change what counts as "the user changed something".
   *
   * The form only exists while edit mode is on (building-detail renders a
   * separate template for it), so one instance means exactly one edit session.
   */
  private _base: SavedBuildingValues | null = null;

  private _captureBaseline(building: WikidataBuilding) {
    // A confirmed-but-not-yet-indexed save wins over the queried data wholesale.
    const saved = this.savedValues?.id === building.id ? this.savedValues : null;
    this._base = saved ?? {
      id: building.id,
      label: building.label,
      aliases: this.detail?.aliases ?? [],
      type: building.type,
      inception: building.inception,
      demolished: this.detail?.demolished,
    };
  }

  private get _currentInceptionEdit(): StatementDateEdit {
    return statementDateToEdit(this._base?.inception);
  }

  private get _currentDemolishedEdit(): StatementDateEdit {
    return statementDateToEdit(this._base?.demolished);
  }

  private get _typeSuggestions(): WikidataItem[] {
    return BUILDING_TYPE_IDS.map(id => ({ id, label: getBuildingTypeLabel(id) }));
  }

  protected willUpdate(changed: PropertyValues) {
    // Capture the baseline the first time we see a building, and again only if
    // a genuinely different one is shown. Same-building refreshes are ignored:
    // the frozen baseline is what makes them harmless.
    if (changed.has('building') && this.building && this._base?.id !== this.building.id) {
      this._captureBaseline(this.building);
      this.formLabel = this._base!.label;
      this.formType = this._base!.type;
      this.formInception = this._currentInceptionEdit;
      this.formDemolished = this._currentDemolishedEdit;
      this.sourceUrl = '';
      this.sourceTitle = '';
      this.archiveItem = undefined;
      this.archiveCallNumber = '';
      this.archivePage = '';
      this.bookMode = 'item';
      this.bookItem = undefined;
      this.bookTitle = '';
      this.bookAuthor = '';
      this.bookYear = '';
      this.bookPage = '';
      this.formAliases = this._baseAliasText;
      this.formAddress = '';
      this.formAddressStartDate = '';
      this.formAddressEndDate = '';
      this.formArchitect = undefined;
      this.formCommissionedBy = undefined;
      this.formOwner = undefined;
      this.formOwnerStartDate = '';
      this.formOwnerEndDate = '';
      this.formOccupant = undefined;
      this.formOccupantStartDate = '';
      this.formOccupantEndDate = '';
      this.saveError = null;
      this.saveErrorDetails = null;
    }
  }

  /** The item's current aliases in the form's comma-separated notation. */
  private get _baseAliasText(): string {
    return (this._base?.aliases ?? []).join(', ');
  }

  private get _aliasesChanged(): boolean {
    return normalizeAliases(this.formAliases).join(', ') !== this._baseAliasText;
  }

  private get _hasChanges(): boolean {
    return (this.formLabel !== (this._base?.label ?? '')) ||
      (this.formType !== undefined && this.formType.id !== this._base?.type?.id) ||
      this._inceptionChanged ||
      this._demolishedChanged ||
      (this.formAddress.trim() !== '') ||
      this._aliasesChanged ||
      (this.formArchitect !== undefined) ||
      (this.formCommissionedBy !== undefined) ||
      (this.formOwner !== undefined) ||
      (this.formOccupant !== undefined);
  }

  private get _hasClaimChanges(): boolean {
    // Same as _hasChanges but excludes label/aliases, which don't need a source
    return (this.formType !== undefined && this.formType.id !== this._base?.type?.id) ||
      this._inceptionChanged ||
      this._demolishedChanged ||
      (this.formAddress.trim() !== '') ||
      (this.formArchitect !== undefined) ||
      (this.formCommissionedBy !== undefined) ||
      (this.formOwner !== undefined) ||
      (this.formOccupant !== undefined);
  }

  private get _sourceIncomplete(): boolean {
    if (this.sourceType === 'url') return !this.sourceUrl.trim();
    if (this.sourceType === 'archive') return !this.archiveItem || !this.archiveCallNumber.trim();
    if (this.bookMode === 'item') return !this.bookItem;
    return !this.bookTitle.trim();
  }

  /** Why the save button is disabled, or null if it isn't. Drives both
   * the button state and the hint shown next to it. */
  private get _saveBlockedReason(): string | null {
    if (!this._hasChanges) return null; // nothing to save — no hint needed
    if (this._hasClaimChanges && this._sourceIncomplete) {
      return msg('Quelle erforderlich, um Änderungen zu speichern');
    }
    return null;
  }

  private get _canSave(): boolean {
    return this._hasChanges && this._saveBlockedReason === null;
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

    let source: SourceRef | undefined;
    if (this.sourceType === 'url' && this.sourceUrl) {
      source = {
        type: 'url',
        url: this.sourceUrl,
        title: this.sourceTitle.trim() || undefined,
        titleLanguage: this.sourceTitle.trim() ? (navigator.language.split('-')[0] || 'de') : undefined,
      };
    } else if (this.sourceType === 'archive' && this.archiveItem) {
      source = {
        type: 'archive',
        archive: this.archiveItem,
        callNumber: this.archiveCallNumber,
        page: this.archivePage || undefined,
      };
    } else if (this.sourceType === 'book') {
      if (this.bookMode === 'item' && this.bookItem) {
        source = { type: 'book', mode: 'item', book: this.bookItem, page: this.bookPage || undefined };
      } else if (this.bookMode === 'freetext' && this.bookTitle.trim()) {
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
    }

    // Parse changed dates; null means invalid input — abort with a message
    const inceptionDate = this._inceptionChanged
      ? editToStatementDate(this.formInception, this._base?.inception)
      : undefined;
    const demolishedDate = this._demolishedChanged
      ? editToStatementDate(this.formDemolished, this._base?.demolished)
      : undefined;
    if (inceptionDate === null || demolishedDate === null) {
      this.saveError = msg('Ungültiges Datum');
      this.saving = false;
      return;
    }

    const editData: BuildingEditData = {
      id: this.building.id,
      label: this.formLabel !== (this._base?.label ?? '') ? this.formLabel : undefined,
      aliases: this._aliasesChanged ? this.formAliases : undefined,
      type: this.formType?.id !== this._base?.type?.id ? this.formType : undefined,
      inception: inceptionDate ?? undefined,
      demolished: demolishedDate ?? undefined,
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
      source,
    };

    try {
      await editBuilding(editData);

      // The PATCH is atomic and threw above on any non-2xx, so these values are
      // now durably in Wikidata. Hand them up so a follow-up edit starts from
      // them instead of from SPARQL, which lags by up to a minute.
      const savedValues: SavedBuildingValues = {
        id: this.building.id,
        label: this.formLabel,
        aliases: normalizeAliases(this.formAliases),
        type: this.formType ?? this._base?.type,
        inception: inceptionDate ?? this._base?.inception,
        demolished: demolishedDate ?? this._base?.demolished,
      };

      // Success - dispatch event to notify parent
      this.dispatchEvent(new CustomEvent('save-success', {
        bubbles: true,
        composed: true,
        detail: { buildingId: this.building.id, savedValues },
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
          hasSource: !!editData.source,
          sourceType: editData.source?.type,
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
            <entity-search
              .value=${this.formType?.label ?? ''}
              .suggestions=${this._typeSuggestions}
              .filterFn=${(id: string) => BUILDING_TYPE_SET.has(id)}
              placeholder=${msg('Nicht angegeben')}
              @select=${(e: CustomEvent) => this.formType = e.detail}
              @clear=${() => this.formType = undefined}
              ?disabled=${this.saving}
            ></entity-search>
          </div>
          <div class="field-group">
            <label>${msg('Erbaut')}</label>
            <statement-date-input
              .edit=${this.formInception}
              .previous=${this._base?.inception}
              @edit-changed=${(e: CustomEvent<StatementDateEdit>) => this.formInception = e.detail}
              ?disabled=${this.saving}
            ></statement-date-input>
          </div>
          <div class="field-group">
            <label>${msg('Abgerissen')}</label>
            <statement-date-input
              .edit=${this.formDemolished}
              .previous=${this._base?.demolished}
              @edit-changed=${(e: CustomEvent<StatementDateEdit>) => this.formDemolished = e.detail}
              ?disabled=${this.saving}
            ></statement-date-input>
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
            <date-range-input
              .start=${this.formAddressStartDate}
              .end=${this.formAddressEndDate}
              @start-changed=${(e: CustomEvent<string>) => this.formAddressStartDate = e.detail}
              @end-changed=${(e: CustomEvent<string>) => this.formAddressEndDate = e.detail}
              ?disabled=${this.saving}
            ></date-range-input>
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
              @clear=${() => this.formArchitect = undefined}
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
              @clear=${() => this.formCommissionedBy = undefined}
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
              @clear=${() => { this.formOwner = undefined; this.formOwnerStartDate = ''; this.formOwnerEndDate = ''; }}
            ></entity-search>
            ${this.formOwner ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formOwner.label}
              </div>
              <date-range-input
                .start=${this.formOwnerStartDate}
                .end=${this.formOwnerEndDate}
                @start-changed=${(e: CustomEvent<string>) => this.formOwnerStartDate = e.detail}
                @end-changed=${(e: CustomEvent<string>) => this.formOwnerEndDate = e.detail}
                ?disabled=${this.saving}
              ></date-range-input>
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
              @clear=${() => { this.formOccupant = undefined; this.formOccupantStartDate = ''; this.formOccupantEndDate = ''; }}
            ></entity-search>
            ${this.formOccupant ? html`
              <div style="margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-primary);">
                ${msg('Ausgewählt:')} ${this.formOccupant.label}
              </div>
              <date-range-input
                .start=${this.formOccupantStartDate}
                .end=${this.formOccupantEndDate}
                @start-changed=${(e: CustomEvent<string>) => this.formOccupantStartDate = e.detail}
                @end-changed=${(e: CustomEvent<string>) => this.formOccupantEndDate = e.detail}
                ?disabled=${this.saving}
              ></date-range-input>
            ` : ''}
          </div>
        </div>

        <!-- Section 6: External Links — not yet implemented -->
        <!-- <div class="section">
          <div class="section-header">
            <h3>${msg('Externe Links')}</h3>
          </div>
          <div class="field-group">
            <label>OpenHistoricalMap Relation ID</label>
            <input type="text" .value=${this.detail?.ohmId || ''}>
          </div>
        </div> -->

        <!-- Source (required) -->
        <div class="source-section">
          <h3 >${msg('Quelle')} (${msg('erforderlich')})</h3>
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
                ?disabled=${this.saving}
                required>
            </div>
            <div class="field-group">
              <label>${msg('Titel')} (${msg('optional')})</label>
              <input
                type="text"
                .value=${this.sourceTitle}
                @input=${(e: Event) => this.sourceTitle = (e.target as HTMLInputElement).value}
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
        <div class="form-footer-buttons">
          <app-button variant="secondary" .leadingIcon=${IconClose} @click=${this._cancel} ?disabled=${this.saving}>
            ${msg('Abbrechen')}
          </app-button>
          <app-button variant="primary" .leadingIcon=${IconCheck} @click=${this._save} ?disabled=${this.saving || !this._canSave}>
            ${this.saving ? msg('Wird gespeichert …') : msg('Änderungen speichern')}
          </app-button>
        </div>
        ${!this.saving && this._saveBlockedReason ? html`
          <div class="save-hint">${this._saveBlockedReason}</div>
        ` : ''}
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'building-edit-form': BuildingEditForm;
  }
}
