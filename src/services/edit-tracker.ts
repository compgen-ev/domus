/**
 * Tracks local edits to Wikidata entities to detect stale SPARQL data
 */

const STORAGE_KEY = 'wikidata-edits';
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

interface EditTimestamps {
  [entityId: string]: string; // ISO timestamp
}

function getEdits(): EditTimestamps {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setEdits(edits: EditTimestamps): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch (err) {
    console.error('Failed to store edit timestamps:', err);
  }
}

/**
 * Record that we just edited an entity
 */
export function recordEdit(entityId: string): void {
  const edits = getEdits();
  edits[entityId] = new Date().toISOString();
  setEdits(edits);
}

/**
 * Get the timestamp when we last edited this entity
 */
export function getLastEdit(entityId: string): string | null {
  const edits = getEdits();
  return edits[entityId] || null;
}

/**
 * Check if SPARQL data is stale (modified before our last edit)
 */
export function isStale(entityId: string, sparqlModified?: string): boolean {
  const lastEdit = getLastEdit(entityId);
  if (!lastEdit || !sparqlModified) return false;

  try {
    return new Date(sparqlModified) < new Date(lastEdit);
  } catch {
    return false;
  }
}

/**
 * Clear edit timestamp (data is now fresh)
 */
export function clearEdit(entityId: string): void {
  const edits = getEdits();
  delete edits[entityId];
  setEdits(edits);
}

/**
 * Remove expired timestamps (older than 1 hour)
 */
export function cleanupExpired(): void {
  const edits = getEdits();
  const now = Date.now();
  let changed = false;

  for (const [id, timestamp] of Object.entries(edits)) {
    try {
      const time = new Date(timestamp).getTime();
      if (isNaN(time) || now - time > EXPIRY_MS) {
        delete edits[id];
        changed = true;
      }
    } catch {
      delete edits[id];
      changed = true;
    }
  }

  if (changed) {
    setEdits(edits);
  }
}

/**
 * Schedule auto-refresh attempts with backoff: 5s, 10s, 15s, 30s, 60s
 */
export function scheduleRefreshes(
  entityId: string,
  refetchFn: () => Promise<void>,
  checkStaleFn: () => boolean,
): void {
  const intervals = [5000, 5000, 5000, 15000, 30000]; // deltas between attempts
  let cumulative = 0;

  for (const delta of intervals) {
    cumulative += delta;
    setTimeout(async () => {
      if (checkStaleFn()) {
        console.log(`Auto-refresh attempt for ${entityId} at +${cumulative}ms`);
        await refetchFn();
      }
    }, cumulative);
  }
}
