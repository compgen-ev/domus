import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './icon';
import IconChevronDown from '~icons/mdi/chevron-down';
import IconChevronUp from '~icons/mdi/chevron-up';
import IconCheck from '~icons/mdi/check';

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * A <select> replacement with full style control over the option list —
 * native mobile <select> dropdowns render as an OS picker whose font size
 * ignores page CSS, which this sidesteps entirely.
 */
@customElement('dropdown-select')
export class DropdownSelect extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-family: inherit;
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      box-sizing: border-box;
      cursor: pointer;
      text-align: left;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .trigger:focus-visible {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--shadow-focus);
    }

    .trigger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .trigger-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .list {
      margin-top: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .option {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-2);
      border: none;
      border-bottom: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
      font-family: inherit;
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      text-align: left;
      cursor: pointer;
    }

    .option:last-child {
      border-bottom: none;
    }

    .option:hover {
      background: var(--color-bg-secondary);
    }

    .option[aria-selected='true'] {
      background: rgba(0, 0, 82, 0.08);
      font-weight: var(--font-weight-semibold);
    }

    .option[aria-selected='true']:hover {
      background: rgba(0, 0, 82, 0.12);
    }

    .option-check {
      flex-shrink: 0;
      visibility: hidden;
      color: var(--color-primary);
    }

    .option[aria-selected='true'] .option-check {
      visibility: visible;
    }
  `;

  @property() value = '';
  @property({ attribute: false }) options: DropdownOption[] = [];
  @property() placeholder = '';
  @property({ type: Boolean }) disabled = false;

  @state() private open = false;

  private _outsideClickHandler = (e: MouseEvent) => {
    if (!e.composedPath().includes(this)) {
      this.open = false;
    }
  };

  protected updated(changed: PropertyValues) {
    if (changed.has('open')) {
      if (this.open) {
        document.addEventListener('click', this._outsideClickHandler);
      } else {
        document.removeEventListener('click', this._outsideClickHandler);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._outsideClickHandler);
  }

  private _toggle() {
    if (this.disabled) return;
    this.open = !this.open;
  }

  private _select(value: string) {
    this.value = value;
    this.open = false;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { value },
    }));
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.open = false;
  }

  render() {
    const selected = this.options.find((o) => o.value === this.value);
    return html`
      <button
        class="trigger"
        ?disabled=${this.disabled}
        @click=${this._toggle}
        @keydown=${this._onKeydown}
        aria-haspopup="listbox"
        aria-expanded=${this.open}
      >
        <span class="trigger-label">${selected?.label ?? this.placeholder}</span>
        <domus-icon .svg=${this.open ? IconChevronUp : IconChevronDown}></domus-icon>
      </button>
      ${this.open ? html`
        <div class="list" role="listbox">
          ${this.options.map((opt) => html`
            <button
              class="option"
              role="option"
              aria-selected=${opt.value === this.value}
              @click=${() => this._select(opt.value)}
            >
              <domus-icon class="option-check" .svg=${IconCheck}></domus-icon>
              ${opt.label}
            </button>
          `)}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dropdown-select': DropdownSelect;
  }
}
