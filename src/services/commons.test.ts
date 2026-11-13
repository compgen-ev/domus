import { describe, it, expect, vi, afterEach } from 'vitest';
import { commonsFilenameFromInput, commonsFilesNear, fetchCommonsFile, searchCommonsFiles } from './commons';

describe('commonsFilenameFromInput', () => {
  it.each([
    ['https://commons.wikimedia.org/wiki/File:Casa_natale_Galilei_800.jpg', 'Casa natale Galilei 800.jpg'],
    ['https://de.wikipedia.org/wiki/Datei:M%C3%BCllerhof.JPG', 'Müllerhof.JPG'],
    ['https://it.wikipedia.org/wiki/Pisa#/media/File:Pisa_lungarno.jpg', 'Pisa lungarno.jpg'],
    ['https://commons.wikimedia.org/w/index.php?title=File:Haus_1.png&oldid=1', 'Haus 1.png'],
    ['https://upload.wikimedia.org/wikipedia/commons/a/a1/Casa_natale.jpg', 'Casa natale.jpg'],
    ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Casa_natale.jpg/250px-Casa_natale.jpg', 'Casa natale.jpg'],
    ['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Casa_natale.jpg/250px-Casa_natale.jpg?utm_source=x', 'Casa natale.jpg'],
    ['http://commons.wikimedia.org/wiki/Special:FilePath/Casa%20natale.jpg', 'Casa natale.jpg'],
    ['File:Haus am See.jpg', 'Haus am See.jpg'],
    ['  Datei:Haus_am_See.jpg ', 'Haus am See.jpg'],
  ])('reads %s', (input, expected) => {
    expect(commonsFilenameFromInput(input)).toBe(expected);
  });

  it.each([
    ['Casa natale Galileo'],
    ['Haus am See.jpg'],
    ['https://example.com/File:Haus.jpg'],
    ['https://de.wikipedia.org/wiki/Pisa'],
    ['File:'],
    [''],
  ])('treats %j as a search term', (input) => {
    expect(commonsFilenameFromInput(input)).toBeNull();
  });
});

describe('Commons queries', () => {
  afterEach(() => vi.unstubAllGlobals());

  function respondWith(pages: unknown[]) {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ query: { pages } })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const image = (title: string, extra: object = {}) => ({
    title,
    imageinfo: [{ mime: 'image/jpeg', thumburl: `https://thumb/${title}` }],
    ...extra,
  });

  it('keeps search ranking and drops non-images', async () => {
    const fetchMock = respondWith([
      image('File:B.jpg', { index: 2 }),
      { title: 'File:Plan.pdf', index: 1, imageinfo: [{ mime: 'application/pdf', thumburl: 'x' }] },
      image('File:A.jpg', { index: 1 }),
    ]);
    const files = await searchCommonsFiles('Haus');
    expect(files.map(f => f.name)).toEqual(['A.jpg', 'B.jpg']);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('gsrsearch')).toBe('Haus filetype:bitmap');
  });

  it('sorts nearby images by distance', async () => {
    respondWith([
      image('File:Far.jpg', { coordinates: [{ dist: 120 }] }),
      image('File:Near.jpg', { coordinates: [{ dist: 8 }] }),
    ]);
    const files = await commonsFilesNear(43.7, 10.4);
    expect(files.map(f => f.name)).toEqual(['Near.jpg', 'Far.jpg']);
  });

  it('returns null for a missing file', async () => {
    respondWith([{ title: 'File:Nope.jpg', missing: true }]);
    expect(await fetchCommonsFile('Nope.jpg')).toBeNull();
  });

  it('returns the file when it exists', async () => {
    respondWith([image('File:Haus.jpg')]);
    expect(await fetchCommonsFile('Haus.jpg')).toEqual({ name: 'Haus.jpg', thumbUrl: 'https://thumb/File:Haus.jpg' });
  });
});
