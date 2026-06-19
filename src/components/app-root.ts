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
      flex-direction: column;
      width: 100dvw;
      height: 100dvh;
      overflow: hidden;
    }

    .app-bar {
      height: 44px;
      flex-shrink: 0;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      z-index: 20;
    }

    .app-bar a {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #000052;
      text-decoration: none;
    }

    map-view {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  `;

  @state() private selectedBuilding: WikidataBuilding | null = null;

  render() {
    return html`
      <div class="app-bar">
        <a href="/">Domus</a>
      </div>
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
