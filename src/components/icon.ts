import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/**
 * Icon component for MDI icons via unplugin-icons.
 *
 * Usage:
 *   import IconEye from '~icons/mdi/eye';
 *   html`<domus-icon .svg=${IconEye}></domus-icon>`
 */
@customElement('domus-icon')
export class Icon extends LitElement {
  @property() svg = '';
  @property() size = '24px';

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.125em;
      height: 1.125em;
      flex-shrink: 0;
    }

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
      display: block;
    }
  `;

  override render() {
    return html`${unsafeSVG(this.svg)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'domus-icon': Icon;
  }
}
