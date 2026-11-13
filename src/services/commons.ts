/**
 * Read-only Wikimedia Commons lookups for picking a building image.
 * All requests are anonymous (`origin=*`), so they need no login.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = '240';

/** A Commons file, named without its `File:` prefix. */
export interface CommonsFile {
  name: string;
  thumbUrl: string;
}

/** Namespace prefixes that name a file on Commons, in the languages users are likely to paste. */
const FILE_PREFIX = /^(file|datei|image|bild|fichier|immagine|bestand):/i;

function cleanName(raw: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(raw);
  } catch {
    name = raw;
  }
  name = name.replace(FILE_PREFIX, '').replace(/_/g, ' ').trim();
  return name && /\.[a-z0-9]{2,5}$/i.test(name) ? name : null;
}

/**
 * The Commons filename a user's input points to, or null when the input is
 * a search term. Understands file page URLs (any Wikimedia wiki, any
 * language), upload and thumbnail URLs, Special:FilePath URLs and
 * `File:`/`Datei:` names.
 */
export function commonsFilenameFromInput(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!/(^|\.)(wikimedia|wikipedia|wikidata)\.org$/i.test(url.hostname)) return null;

    const filePath = url.pathname.match(/Special:FilePath\/(.+)$/i);
    if (filePath) return cleanName(filePath[1]);

    if (url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org') {
      const parts = url.pathname.split('/').filter(Boolean);
      const thumb = parts.indexOf('thumb');
      return cleanName(thumb >= 0 ? parts[thumb + 3] ?? '' : parts[parts.length - 1] ?? '');
    }

    const title = url.searchParams.get('title') ?? url.pathname.match(/\/wiki\/(.+)$/)?.[1] ?? '';
    // A file page shown in a media viewer: .../wiki/Article#/media/File:X.jpg
    const media = url.hash.match(/\/media\/(.+)$/)?.[1];
    const candidate = media ?? title;
    return FILE_PREFIX.test(decodeURIComponentSafe(candidate)) ? cleanName(candidate) : null;
  }

  return FILE_PREFIX.test(text) ? cleanName(text) : null;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

interface ApiPage {
  title: string;
  missing?: boolean;
  index?: number;
  imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
  coordinates?: Array<{ dist?: number }>;
}

async function queryFiles(params: Record<string, string>, signal?: AbortSignal): Promise<ApiPage[]> {
  const search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: THUMB_WIDTH,
    ...params,
  });
  const response = await fetch(`${COMMONS_API}?${search}`, { signal });
  if (!response.ok) throw new Error(`Commons API error: ${response.status}`);
  const data: { query?: { pages?: ApiPage[] } } = await response.json();
  return data.query?.pages ?? [];
}

/** Still images only: Commons also holds PDFs, audio and video. */
function toFiles(pages: ApiPage[]): CommonsFile[] {
  return pages.flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (p.missing || !info?.mime?.startsWith('image/')) return [];
    const thumbUrl = info.thumburl ?? info.url;
    return thumbUrl ? [{ name: p.title.replace(/^File:/, ''), thumbUrl }] : [];
  });
}

/** The named file if it exists on Commons and is an image, otherwise null. */
export async function fetchCommonsFile(name: string, signal?: AbortSignal): Promise<CommonsFile | null> {
  const pages = await queryFiles({ titles: `File:${name}`, redirects: '1' }, signal);
  return toFiles(pages)[0] ?? null;
}

/** Images whose title or description matches `term`, best match first. */
export async function searchCommonsFiles(term: string, signal?: AbortSignal): Promise<CommonsFile[]> {
  const pages = await queryFiles({
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${term} filetype:bitmap`,
    gsrlimit: '24',
  }, signal);
  return toFiles([...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)));
}

/** Images taken within `radius` metres of a point, nearest first. */
export async function commonsFilesNear(
  lat: number,
  lng: number,
  signal?: AbortSignal,
  radius = 150,
): Promise<CommonsFile[]> {
  const point = `${lat}|${lng}`;
  const pages = await queryFiles({
    generator: 'geosearch',
    ggscoord: point,
    ggsradius: String(radius),
    ggsnamespace: '6',
    ggslimit: '24',
    prop: 'imageinfo|coordinates',
    codistancefrompoint: point,
  }, signal);
  const dist = (p: ApiPage) => p.coordinates?.[0]?.dist ?? Infinity;
  return toFiles([...pages].sort((a, b) => dist(a) - dist(b)));
}
