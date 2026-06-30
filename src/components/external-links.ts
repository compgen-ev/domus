import { html, type TemplateResult } from 'lit';
import IconOpenInNew from '~icons/mdi/open-in-new';

export interface ExternalLinksParams {
  id: string;
  ohmId?: string;
  govId?: string;
  hasOhmFootprint: boolean;
  ohmElementId?: string;
  ohmElementType?: 'way' | 'relation';
  linkClass?: string;
}

export function renderExternalLinks(params: ExternalLinksParams): TemplateResult {
  const { id, ohmId, govId, hasOhmFootprint, ohmElementId, ohmElementType, linkClass = '' } = params;

  return html`
    <a class=${linkClass} href="https://www.wikidata.org/wiki/${id}" target="_blank" rel="noopener">
      Wikidata
      <domus-icon .svg=${IconOpenInNew}></domus-icon>
    </a>
    ${ohmId || (hasOhmFootprint && ohmElementId) ? html`
      <a class=${linkClass} href=${ohmId
        ? `https://www.openhistoricalmap.org/relation/${ohmId}`
        : `https://www.openhistoricalmap.org/${ohmElementType}/${ohmElementId}`}
        target="_blank" rel="noopener">
        OpenHistoricalMap
        <domus-icon .svg=${IconOpenInNew}></domus-icon>
      </a>
    ` : ''}
    ${govId ? html`
      <a class=${linkClass} href="https://gov.genealogy.net/item/show/${govId}" target="_blank" rel="noopener">
        GOV
        <domus-icon .svg=${IconOpenInNew}></domus-icon>
      </a>
    ` : ''}
  `;
}
