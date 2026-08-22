/**
 * Aliases travel as one comma-separated string: that is how the edit field
 * takes them, and how Wikidata's label service hands them back. This is the
 * single rule for turning that text into the list Wikidata stores.
 */
export function normalizeAliases(text: string): string[] {
  const seen = new Set<string>();
  for (const alias of text.split(',')) {
    const trimmed = alias.trim();
    if (trimmed.length > 0) seen.add(trimmed);
  }
  return [...seen];
}
