import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { inputStyles } from '../styles/design-tokens';
import { getDateValidationError } from '../utils/dates';

/**
 * Text input for a Wikidata date (YYYY, YYYY-MM, or YYYY-MM-DD) with
 * inline validation. Emits `value-changed` (CustomEvent<string>) on input.
 */
@localized()
@customElement('date-input')
export class DateInput extends LitElement {
  static styles = [
    inputStyles,
    css`
      :host {
        display: block;
        width: 100%;
      }

      input {
        width: 100%;
        box-sizing: border-box;
      }

      input[aria-invalid="true"] {
        border-color: var(--color-error);
      }

      .error {
        font-size: var(--font-size-xs);
        color: var(--color-error);
        margin-top: var(--space-1);
      }
    `,
  ];

  @property() value = '';
  @property() placeholder = 'YYYY / YYYY-MM / YYYY-MM-DD';
  @property({ type: Boolean }) disabled = false;

  private _onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent<string>('value-changed', {
      detail: this.value,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const error = getDateValidationError(this.value);
    return html`
      <input
        type="text"
        placeholder=${this.placeholder}
        .value=${this.value}
        aria-invalid=${error ? 'true' : 'false'}
        @input=${this._onInput}
        ?disabled=${this.disabled}>
      ${error ? html`<div class="error">${error}</div>` : ''}
    `;
  }
}

/**
 * "Von (Jahr)" / "Bis (Jahr)" year pair used for qualified statements
 * (addresses, owners, occupants). Emits `start-changed` and `end-changed`
 * (CustomEvent<string>).
 */
@localized()
@customElement('date-range-input')
export class DateRangeInput extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }

    .date-field {
      flex: 1;
    }

    label {
      display: block;
      font-size: var(--font-size-xs);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }
  `;

  @property() start = '';
  @property() end = '';
  @property({ type: Boolean }) disabled = false;

  private _emit(name: 'start-changed' | 'end-changed', e: CustomEvent<string>) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent<string>(name, {
      detail: e.detail,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="date-field">
        <label>${msg('Von (Jahr)')}</label>
        <date-input
          placeholder="YYYY"
          .value=${this.start}
          @value-changed=${(e: CustomEvent<string>) => this._emit('start-changed', e)}
          ?disabled=${this.disabled}
        ></date-input>
      </div>
      <div class="date-field">
        <label>${msg('Bis (Jahr)')}</label>
        <date-input
          placeholder="YYYY"
          .value=${this.end}
          @value-changed=${(e: CustomEvent<string>) => this._emit('end-changed', e)}
          ?disabled=${this.disabled}
        ></date-input>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'date-input': DateInput;
    'date-range-input': DateRangeInput;
  }
}
