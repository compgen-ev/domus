import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import type { ExternalLink } from '../types/building';
import { designTokens } from '../styles/design-tokens';
import './icon';
import IconLinkVariant from '~icons/mdi/link-variant';
import IconOpenInNew from '~icons/mdi/open-in-new';

/**
 * Trigger plus popover listing an entity's external resources by name.
 *
 * The trigger renders nothing without links, so it marks the entries that
 * have something beyond Wikidata. Resources are named in plain text and in
 * the order they are passed in; no platform gets a logo or a colour.
 */
@localized()
@customElement('domus-link-menu')
export class LinkMenu extends LitElement {
  static styles = [
    designTokens,
    css`
      :host {
        position: relative;
        display: inline-block;
        /* Centres the icon on the text's midline instead of its baseline. */
        vertical-align: middle;
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-primary);
        font: inherit;
      }

      .trigger:hover {
        color: var(--color-primary-hover);
      }

      .trigger domus-icon {
        width: 1em;
        height: 1em;
      }

      .dropdown {
        position: absolute;
        top: calc(100% + var(--space-1));
        left: 0;
        min-width: 160px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-xl);
        padding: var(--space-2);
        z-index: var(--z-dropdown);
      }

      .dropdown a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2);
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        font-size: var(--font-size-sm);
        text-decoration: none;
        white-space: nowrap;
      }

      .dropdown a:hover {
        background: var(--color-bg-secondary);
      }
    `,
  ];

  @property({ attribute: false }) links: ExternalLink[] = [];

  @state() private open = false;

  private _registerTimer?: ReturnType<typeof setTimeout>;

  connectedCallback() {
    super.connectedCallback();
    this._onOutsideClick = this._onOutsideClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._removeListeners();
  }

  /**
   * Also drops a registration that is still pending, so closing or
   * disconnecting within the same tick as opening leaves nothing behind.
   */
  private _removeListeners() {
    clearTimeout(this._registerTimer);
    this._registerTimer = undefined;
    document.removeEventListener('click', this._onOutsideClick);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  private _close() {
    this.open = false;
    this._removeListeners();
  }

  private _toggle() {
    this.open = !this.open;
    if (this.open) {
      // Deferred so the click that opened the menu does not close it again.
      this._registerTimer = setTimeout(() => {
        this._registerTimer = undefined;
        document.addEventListener('click', this._onOutsideClick);
        document.addEventListener('keydown', this._onKeyDown);
      }, 0);
    } else {
      this._removeListeners();
    }
  }

  private _onOutsideClick() {
    this._close();
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this._close();
      this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus();
    }
  }

  render() {
    if (this.links.length === 0) return html``;
    const names = this.links.map((l) => l.label).join(', ');
    const label = msg(str`Weitere Links: ${names}`);

    return html`
      <button
        class="trigger"
        title=${label}
        aria-label=${label}
        aria-expanded=${this.open}
        @click=${this._toggle}
      >
        <domus-icon .svg=${IconLinkVariant}></domus-icon>
      </button>

      ${this.open ? html`
        <div class="dropdown" @click=${(e: Event) => e.stopPropagation()}>
          ${this.links.map((link) => html`
            <a href=${link.url} target="_blank" rel="noopener" @click=${() => this._close()}>
              ${link.label}
              <domus-icon .svg=${IconOpenInNew}></domus-icon>
            </a>
          `)}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'domus-link-menu': LinkMenu;
  }
}
