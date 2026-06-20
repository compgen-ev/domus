import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/shared';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'accent';

@customElement('app-button')
export class AppButton extends LitElement {
  static styles = [
    baseStyles,
    css`
      button {
        font-family: var(--font-family);
        font-size: var(--font-size-sm);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--radius-md);
        cursor: pointer;
        border: none;
        transition: all var(--transition-fast);
        white-space: nowrap;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Primary - blue background */
      .primary {
        background: var(--color-primary);
        color: white;
      }

      .primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
      }

      /* Secondary - gray outline */
      .secondary {
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
      }

      .secondary:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-text-muted);
      }

      /* Outline - blue outline */
      .outline {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
      }

      .outline:hover:not(:disabled) {
        background: var(--color-primary);
        color: white;
      }

      /* Accent - gold background */
      .accent {
        background: var(--color-accent);
        color: var(--color-primary);
      }

      .accent:hover:not(:disabled) {
        background: var(--color-accent-dark);
      }
    `,
  ];

  @property({ type: String }) variant: ButtonVariant = 'secondary';
  @property({ type: Boolean }) disabled = false;

  render() {
    return html`
      <button class=${this.variant} ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-button': AppButton;
  }
}
