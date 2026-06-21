import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('app-toast')
export class AppToast extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      bottom: var(--space-6);
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      opacity: 0;
      transition: all var(--transition-fast);
      z-index: var(--z-toast, 9999);
      pointer-events: none;
    }

    :host([visible]) {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .toast {
      background: var(--color-text-primary);
      color: var(--color-bg-primary);
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-lg);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      box-shadow: var(--shadow-lg);
      white-space: nowrap;
    }
  `;

  @property({ type: String }) message = '';
  @property({ type: Boolean, reflect: true }) visible = false;

  show(message: string, duration = 3000) {
    this.message = message;
    this.visible = true;

    setTimeout(() => {
      this.visible = false;
    }, duration);
  }

  render() {
    return html`<div class="toast">${this.message}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-toast': AppToast;
  }
}
