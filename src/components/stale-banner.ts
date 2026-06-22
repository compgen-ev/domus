import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import './icon';
import IconRefresh from '~icons/mdi/refresh';

@localized()
@customElement('stale-banner')
export class StaleBanner extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-warning-bg, #fff4e6);
      color: var(--color-warning-text, #663c00);
    }

    .banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      font-size: var(--font-size-sm);
    }

    domus-icon {
      color: var(--color-warning-text, #663c00);
      flex-shrink: 0;
    }

    span {
      flex: 1;
    }

    button {
      background: none;
      border: 1px solid currentColor;
      color: inherit;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      transition: all var(--transition-fast);
    }

    button:hover {
      background: var(--color-warning-text, #663c00);
      color: var(--color-warning-bg, #fff4e6);
    }
  `;

  private _handleRefresh() {
    this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="banner">
        <domus-icon .svg=${IconRefresh}></domus-icon>
        <span>${msg('Deine Änderungen sind möglicherweise noch nicht sichtbar.')}</span>
        <button @click=${this._handleRefresh}>${msg('Aktualisieren')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'stale-banner': StaleBanner;
  }
}
