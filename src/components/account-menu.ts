import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';
import { buttonStyles, designTokens } from '../styles/design-tokens';
import './app-button';
import './icon';
import IconAccount from '~icons/mdi/account';
import IconCheck from '~icons/mdi/check';
import IconLogout from '~icons/mdi/logout';

@localized()
@customElement('account-menu')
export class AccountMenu extends LitElement {
  static styles = [
    designTokens,
    buttonStyles,
    css`
      :host {
        position: relative;
        display: inline-block;
      }

      .trigger {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        font-family: inherit;
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .trigger:hover {
        background: var(--color-bg-secondary);
      }

      .dropdown {
        position: absolute;
        top: calc(100% + var(--space-2));
        right: 0;
        min-width: 260px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        padding: var(--space-3);
        z-index: var(--z-dropdown);
      }

      .service {
        padding: var(--space-3) 0;
      }

      .service + .service {
        border-top: 1px solid var(--color-border-light);
      }

      .service-name {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-2);
      }

      .service-status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }

      .service-user {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }

      .service-user domus-icon {
        color: var(--color-success);
      }

      .service-desc {
        font-size: var(--font-size-sm);
        color: var(--color-text-secondary);
        margin: 0;
      }

      .btn-link {
        background: none;
        border: none;
        padding: 0;
        font-size: var(--font-size-sm);
        font-family: inherit;
        color: var(--color-primary);
        cursor: pointer;
        text-decoration: underline;
        flex-shrink: 0;
      }

      .btn-link:hover { text-decoration: none; }

      .divider {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: var(--space-1) 0;
      }

      .footer {
        padding-top: var(--space-2);
      }
    `,
  ];

  @property() wikimediaUsername: string | null = null;
  @property() ohmUsername: string | null = null;
  @property({ type: Boolean }) ohmAuthenticated = false;

  @state() private open = false;

  connectedCallback() {
    super.connectedCallback();
    this._onOutsideClick = this._onOutsideClick.bind(this);
  }

  private _toggle() {
    this.open = !this.open;
    if (this.open) {
      setTimeout(() => document.addEventListener('click', this._onOutsideClick), 0);
    } else {
      document.removeEventListener('click', this._onOutsideClick);
    }
  }

  private _onOutsideClick() {
    this.open = false;
    document.removeEventListener('click', this._onOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onOutsideClick);
  }

  private _dispatch(type: string) {
    this.open = false;
    document.removeEventListener('click', this._onOutsideClick);
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <button class="trigger" @click=${this._toggle}>
        <domus-icon .svg=${IconAccount}></domus-icon>
        ${this.wikimediaUsername ?? msg('Konto')}
      </button>

      ${this.open ? html`
        <div class="dropdown" @click=${(e: Event) => e.stopPropagation()}>

          <div class="service">
            <div class="service-name">Wikidata</div>
            <div class="service-status">
              <span class="service-user">
                <domus-icon .svg=${IconCheck}></domus-icon>
                ${this.wikimediaUsername ?? msg('Angemeldet')}
              </span>
            </div>
          </div>

          <div class="service">
            <div class="service-name">OpenHistoricalMap</div>
            ${this.ohmAuthenticated ? html`
              <div class="service-status">
                <span class="service-user">
                  <domus-icon .svg=${IconCheck}></domus-icon>
                  ${this.ohmUsername ?? msg('Verbunden')}
                </span>
              </div>
            ` : html`
              <p class="service-desc">
                ${msg('Für automatische Verknüpfung beim Anlegen von Gebäuden.')}
                <button class="btn-link" @click=${() => this._dispatch('ohm-login')}>${msg('Anmelden')}</button>
              </p>
            `}
          </div>

          <hr class="divider">

          <div class="footer">
            <app-button variant="secondary" .leadingIcon=${IconLogout} style="width:100%" @click=${() => this._dispatch('logout-all')}>
              ${msg('Alle abmelden')}
            </app-button>
          </div>

        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'account-menu': AccountMenu;
  }
}
