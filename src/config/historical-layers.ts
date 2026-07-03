// Registry for the historical-layer picker.
export interface HistoricalLayerSource {
  id: string;
  title: string;
  region: string;
  yearRange: [number, number];
  tiles: string[];
  tileSize?: number; // default 256
  minzoom?: number; // hide below this zoom
  maxzoom?: number; // cap MapLibre tile requests; it over-zooms (upscales) above this
  attribution: string;
  attributionUrl?: string;
  attributionLinkText?: string; // substring of `attribution` to link
  bounds?: [west: number, south: number, east: number, north: number]; // omit if global
}

export const HISTORICAL_LAYERS: HistoricalLayerSource[] = [
  {
    id: 'lgl-bw-flurkarte-1825',
    title: 'Historische Flurkarte Württemberg 1:2.500',
    region: 'Baden-Württemberg',
    yearRange: [1818, 1840],
    // Public WMS, no token needed, EPSG:3857 native. WIDTH/HEIGHT=512 + minzoom
    // work around the server's on-the-fly rendering, which aliases into black
    // speckle below native scan resolution (no pre-built overviews).
    tiles: [
      'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_HIST_FKWue_25_K' +
      '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true' +
      '&LAYERS=RDS.LY_HISTFK25_SWKOMBI&STYLES=&CRS=EPSG:3857&WIDTH=512&HEIGHT=512' +
      '&BBOX={bbox-epsg-3857}',
    ],
    tileSize: 512,
    minzoom: 17,
    // EX_GeographicBoundingBox from the WMS GetCapabilities
    bounds: [7.20, 47.40, 10.70, 50.00],
    attribution: '© LGL-BW, Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)',
    attributionUrl: 'https://www.lgl-bw.de',
    attributionLinkText: 'LGL-BW',
  },
  {
    id: 'lgl-bw-gemarkung-baden',
    title: 'Historische Gemarkungsübersicht Baden 1:10.000',
    region: 'Baden-Württemberg (Baden)',
    yearRange: [1857, 1935],
    // Same LGL-BW WMS family as above. tileSize/minzoom left at defaults on
    // purpose — untested whether this one needs the same fix.
    tiles: [
      'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_HIST_GMKUeBad_10_K' +
      '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true' +
      '&LAYERS=RDS.LY_HISTGEM_COL&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256' +
      '&BBOX={bbox-epsg-3857}',
    ],
    // LGL-BW's capabilities declare the whole-state bbox (wrong — copy-pasted
    // default), but this only covers Baden. Bounds below are an empirically
    // tested envelope (blank over Stuttgart/Tübingen/Heilbronn, real content
    // over Freiburg/Karlsruhe/Mannheim/Konstanz), erring toward inclusion.
    bounds: [7.50, 47.50, 9.30, 49.80],
    attribution: '© LGL-BW, Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)',
    attributionUrl: 'https://www.lgl-bw.de',
    attributionLinkText: 'LGL-BW',
  },
  {
    id: 'swisstopo-siegfried',
    title: 'Siegfriedkarte Schweiz 1:25.000/1:50.000',
    region: 'Schweiz',
    yearRange: [1870, 1949],
    // Pre-rendered WMTS pyramid — clean at every zoom, no oversampling/minzoom
    // fix needed unlike the LGL-BW WMS above. {z}/{x}/{y} = TileMatrix/Col/Row.
    tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.hiks-siegfried/default/1949/3857/{z}/{x}/{y}.png'],
    // TileMatrixSet for this layer is "3857_17" — 17 is the real max zoom;
    // without this, MapLibre requests nonexistent z18+ tiles (server 400s).
    maxzoom: 17,
    bounds: [5.14, 45.40, 11.48, 48.23],
    attribution: '©swisstopo',
    attributionUrl: 'https://www.swisstopo.admin.ch/de/historische-karten',
    attributionLinkText: 'swisstopo',
  },
  {
    id: 'geobasis-bb-dr25',
    title: 'Karte des Deutschen Reiches 1:25.000 (Messtischblatt) Brandenburg',
    region: 'Brandenburg/Berlin',
    yearRange: [1901, 1945],
    // Served via MapProxy (cached, not live-rendered), no token, EPSG:3857 native —
    // stays legible even zoomed out, unlike the raw LGL-BW WMS above.
    tiles: [
      'https://isk.geobasis-bb.de/mapproxy/dr25/service/wms' +
      '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true' +
      '&LAYERS=dr25&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    ],
    bounds: [11.15, 51.26, 15.39, 53.61],
    attribution: '© Staatsbibliothek zu Berlin – Preußischer Kulturbesitz, dl-de/by-2-0',
    attributionUrl: 'https://staatsbibliothek-berlin.de',
    attributionLinkText: 'Staatsbibliothek zu Berlin',
  },
];
