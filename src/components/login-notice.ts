import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { buttonStyles } from '../styles/design-tokens';
import './app-button';

@localized()
@customElement('login-notice')
export class LoginNotice extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        align-items: center;
        justify-content: center;
      }

      :host([open]) {
        display: flex;
      }

      .dialog {
        background: var(--color-bg-primary);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        max-width: 480px;
        margin: var(--space-4);
        padding: var(--space-6);
      }

      h2 {
        margin: 0 0 var(--space-4);
        font-size: var(--font-size-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      ul {
        margin: var(--space-4) 0;
        padding-left: var(--space-6);
        color: var(--color-text-primary);
        line-height: 1.6;
      }

      li {
        margin-bottom: var(--space-2);
      }

      .footer {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--color-border);
      }

      .link {
        color: var(--color-primary);
        text-decoration: underline;
        cursor: pointer;
      }

      .link:hover {
        text-decoration: none;
      }

      p {
        margin: 0 0 var(--space-3);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  private _cancel() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private _confirm() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <h2>${msg('Mit Wikidata-Konto anmelden')}</h2>
        <ul>
          <li>${msg('Änderungen öffentlich unter deinem Benutzernamen')}</li>
          <li>${msg('Gemeinfrei lizenziert (CC0)')}</li>
        </ul>
        <p>
          ${msg('Bitte')}
          <a
            href="https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Terms_of_Use"
            target="_blank"
            rel="noopener noreferrer"
            class="link"
          >${msg('Nutzungsbedingungen')}</a>
          ${msg('beachten')}.
        </p>
        <div class="footer">
          <app-button variant="secondary" @click=${this._cancel} style="flex: 1">
            ${msg('Abbrechen')}
          </app-button>
          <app-button variant="primary" @click=${this._confirm} style="flex: 1">
            ${msg('Fortfahren')}
          </app-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'login-notice': LoginNotice;
  }
}
