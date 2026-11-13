import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { inputStyles } from '../styles/design-tokens';
import { getLocale } from '../locale';

/**
 * Languages offered for monolingual text values (addresses, source titles).
 * Covers the languages of Central Europe and its neighbours plus Latin, which
 * is common in older records.
 */
export const TEXT_LANGUAGES = [
  'de', 'en', 'fr', 'it', 'nl', 'pl', 'cs', 'sk', 'hu', 'sl', 'hr',
  'da', 'sv', 'nb', 'lb', 'rm', 'es', 'pt', 'la',
] as const;

/** The browser's primary language when it is one of TEXT_LANGUAGES, otherwise German. */
export function defaultTextLanguage(): string {
  const browser = navigator.language.split('-')[0]?.toLowerCase();
  return (TEXT_LANGUAGES as readonly string[]).includes(browser) ? browser : 'de';
}

function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([getLocale()], { type: 'language' }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

/**
 * Picker for the language code of a monolingual text value. Emits
 * `value-changed` (CustomEvent<string>) with the selected code.
 */
@localized()
@customElement('language-select')
export class LanguageSelect extends LitElement {
  static styles = [
    inputStyles,
    css`
      :host {
        display: block;
        width: 100%;
      }

      select {
        width: 100%;
        box-sizing: border-box;
        padding: var(--space-2);
      }
    `,
  ];

  @property() value = 'de';
  @property({ type: Boolean }) disabled = false;

  private _onChange(e: Event) {
    this.value = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(new CustomEvent<string>('value-changed', {
      detail: this.value,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const codes: string[] = [...TEXT_LANGUAGES];
    if (!codes.includes(this.value)) codes.unshift(this.value);
    return html`
      <select
        aria-label=${msg('Sprache')}
        @change=${this._onChange}
        ?disabled=${this.disabled}>
        ${codes.map(code => html`
          <option value=${code} ?selected=${code === this.value}>${languageName(code)}</option>
        `)}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'language-select': LanguageSelect;
  }
}
