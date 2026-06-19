import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WikidataBuilding } from '../types/building';
import './map-view';
import './building-panel';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: flex;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
    }

    map-view {
      flex: 1;
      min-width: 0;
    }
  `;

  @state() private selectedBuilding: WikidataBuilding | null = null;

  render() {
    return html`
      <map-view
        @building-selected=${(e: CustomEvent<WikidataBuilding>) => { this.selectedBuilding = e.detail; }}
      ></map-view>
      <building-panel
        .building=${this.selectedBuilding}
        @close=${() => { this.selectedBuilding = null; }}
      ></building-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
