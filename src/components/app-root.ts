import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './map-view';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
    }

    map-view {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return html`<map-view></map-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
