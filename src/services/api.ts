import type { GameSlug, GameSnapshot } from '@shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

export interface FetchSnapshotOptions {
  /** Base URL of the scraper service, e.g. http://192.168.1.20:8787. Null means "no server configured". */
  baseUrl: string | null;
  /** The server's first request for a cold game can take several seconds. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DATA_SOURCES = ['thelott', 'import', 'sample'];

/** Cheap structural check so a wrong or truncated response fails loudly instead of crashing a screen. */
export function isGameSnapshot(value: unknown, slug: GameSlug): value is GameSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<GameSnapshot>;
  return (
    v.slug === slug &&
    Array.isArray(v.draws) &&
    typeof v.rules === 'object' &&
    v.rules !== null &&
    v.rules.slug === slug &&
    (v.rules.kind === 'pick' || v.rules.kind === 'allocated') &&
    typeof v.source === 'string' &&
    DATA_SOURCES.includes(v.source) &&
    typeof v.fetchedAt === 'string'
  );
}

export async function fetchSnapshot(slug: GameSlug, options: FetchSnapshotOptions): Promise<GameSnapshot> {
  if (!options.baseUrl) throw new ApiError('No data server is configured');
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.baseUrl}/api/games/${slug}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new ApiError(`Server answered HTTP ${response.status}`, response.status);
    const body: unknown = await response.json();
    if (!isGameSnapshot(body, slug)) throw new ApiError(`Unexpected response for ${slug}`, response.status);
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') throw new ApiError(`Timed out fetching ${slug}`, undefined, { cause: error });
    throw new ApiError(`Could not reach the data server: ${(error as Error).message}`, undefined, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
