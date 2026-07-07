import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import {
  editToStatementDate,
  formatStatementDate,
  usesJulianCalendar,
  type StatementDate,
  type StatementDateEdit,
  type DateMode,
} from '../utils/dates';
import './date-input';
import './dropdown-select';

/**
 * Editor for a full statement date: a mode dropdown (genau / vor / nach /
 * zwischen) with one or two date inputs, and a live echo line showing the
 * structured interpretation of what was typed.
 *
 * Emits `edit-changed` (CustomEvent<StatementDateEdit>) on any change.
 * `previous` is the currently stored date, used to preserve calendar
 * models and bounds qualifiers (see editToStatementDate).
 */
@localized()
@customElement('statement-date-input')
export class StatementDateInput extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .row {
      display: flex;
      /* Wrap in narrow panels (drawer) so two "zwischen" inputs never get
         squeezed; in the wide edit view everything fits on one line */
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: flex-start;
    }

    dropdown-select {
      flex: 0 0 auto;
      min-width: 7em;
    }

    date-input {
      flex: 1 1 8em;
      min-width: 8em;
    }

    .echo {
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .echo-error {
      font-size: var(--font-size-xs);
      color: var(--color-error);
      margin-top: var(--space-1);
    }
  `;

  @property({ attribute: false }) edit: StatementDateEdit = { mode: 'value', value: '', earliest: '', latest: '' };
  @property({ attribute: false }) previous?: StatementDate;
  @property({ type: Boolean }) disabled = false;

  private _emit(patch: Partial<StatementDateEdit>) {
    this.edit = { ...this.edit, ...patch };
    this.dispatchEvent(new CustomEvent<StatementDateEdit>('edit-changed', {
      detail: this.edit,
      bubbles: true,
      composed: true,
    }));
  }

  private get _modeOptions() {
    return [
      { value: 'value', label: msg('genau') },
      { value: 'before', label: msg('vor') },
      { value: 'after', label: msg('nach') },
      { value: 'between', label: msg('zwischen') },
    ];
  }

  private _renderEcho() {
    const result = editToStatementDate(this.edit, this.previous);
    if (result === undefined) return '';
    if (result === null) {
      // Per-field format errors are shown by the date inputs themselves;
      // only cross-field problems need a message here
      const { mode, earliest, latest } = this.edit;
      if (mode === 'between' && (!earliest.trim() || !latest.trim())) {
        return html`<div class="echo">${msg('Beide Daten angeben')}</div>`;
      }
      if (mode === 'between') {
        return html`<div class="echo-error">${msg('Frühestes Datum muss vor spätestem liegen')}</div>`;
      }
      return '';
    }
    const text = formatStatementDate(result);
    const julian = usesJulianCalendar(result) ? ` ${msg('(julianischer Kalender)')}` : '';
    return html`<div class="echo">→ ${text}${julian}</div>`;
  }

  render() {
    const { mode } = this.edit;
    return html`
      <div class="row">
        <dropdown-select
          .value=${mode}
          .options=${this._modeOptions}
          ?disabled=${this.disabled}
          @change=${(e: CustomEvent<{ value: string }>) => {
            e.stopPropagation();
            this._emit({ mode: e.detail.value as DateMode });
          }}
        ></dropdown-select>
        ${mode === 'value' ? html`
          <date-input
            .value=${this.edit.value}
            placeholder=${msg('z.B. 1409, 1409-06-15, 15. Jh.')}
            ?disabled=${this.disabled}
            @value-changed=${(e: CustomEvent<string>) => { e.stopPropagation(); this._emit({ value: e.detail }); }}
          ></date-input>
        ` : ''}
        ${mode === 'before' || mode === 'between' ? html`
          ${mode === 'between' ? html`
            <date-input
              .value=${this.edit.earliest}
              ?disabled=${this.disabled}
              @value-changed=${(e: CustomEvent<string>) => { e.stopPropagation(); this._emit({ earliest: e.detail }); }}
            ></date-input>
          ` : ''}
          <date-input
            .value=${this.edit.latest}
            ?disabled=${this.disabled}
            @value-changed=${(e: CustomEvent<string>) => { e.stopPropagation(); this._emit({ latest: e.detail }); }}
          ></date-input>
        ` : ''}
        ${mode === 'after' ? html`
          <date-input
            .value=${this.edit.earliest}
            ?disabled=${this.disabled}
            @value-changed=${(e: CustomEvent<string>) => { e.stopPropagation(); this._emit({ earliest: e.detail }); }}
          ></date-input>
        ` : ''}
      </div>
      ${this._renderEcho()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'statement-date-input': StatementDateInput;
  }
}
