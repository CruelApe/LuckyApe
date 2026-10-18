/**
 * A deliberately polite HTTP client for talking to The Lott, shared by the scraper service
 * (Node) and the app itself (React Native). It has no dependency on either runtime.
 */

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'UpstreamError';
  }
}

/** The upstream refused us (401/403/429). We back off rather than retry. */
export class UpstreamBlockedError extends UpstreamError {
  constructor(message: string, url: string, status: number) {
    super(message, url, status);
    this.name = 'UpstreamBlockedError';
  }
}

export interface HttpClient {
  getText(url: string): Promise<string>;
  postJson<T>(url: string, body: unknown): Promise<T>;
}

export interface HttpClientConfig {
  userAgent: string;
  /** Pause between requests. */
  requestDelayMs: number;
  requestTimeoutMs: number;
}

export interface HttpOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** How long to refuse requests after being blocked. Default 15 minutes. */
  blockedBackoffMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `AbortSignal.timeout` where it exists (Node), otherwise an AbortController on a timer
 * (React Native's Hermes). The timer deliberately keeps running until it fires, so a slow
 * response body is covered by the timeout too; aborting a finished request does nothing.
 */
function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  if (typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(ms), cancel: () => undefined };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/**
 * Identifies itself, spaces requests out, runs them one at a time, retries transient
 * failures once, and stops asking for a while if the site says no.
 */
export function createHttpClient(config: HttpClientConfig, options: HttpOptions = {}): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const blockedBackoffMs = options.blockedBackoffMs ?? 15 * 60_000;

  let lastRequestAt = 0;
  let blockedUntil = 0;
  // Serialises requests so concurrent callers still respect the delay.
  let queue: Promise<unknown> = Promise.resolve();

  async function attempt(url: string, init: RequestInit): Promise<Response> {
    const wait = lastRequestAt + config.requestDelayMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    const { signal, cancel } = timeoutSignal(config.requestTimeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal });
    } catch (cause) {
      cancel();
      throw new UpstreamError(`Request failed: ${(cause as Error).message}`, url, undefined, { cause });
    }
  }

  async function request(url: string, init: RequestInit): Promise<Response> {
    if (now() < blockedUntil) {
      throw new UpstreamBlockedError('Upstream previously refused requests; backing off', url, 429);
    }
    const headers = { 'User-Agent': config.userAgent, ...(init.headers as Record<string, string>) };
    let lastError: unknown;
    for (let tries = 0; tries < 2; tries++) {
      try {
        const response = await attempt(url, { ...init, headers });
        if ([401, 403, 429].includes(response.status)) {
          blockedUntil = now() + blockedBackoffMs;
          throw new UpstreamBlockedError(`Upstream refused the request (HTTP ${response.status})`, url, response.status);
        }
        if (response.status >= 500) {
          lastError = new UpstreamError(`Upstream error (HTTP ${response.status})`, url, response.status);
          await sleep(1000);
          continue;
        }
        if (!response.ok) {
          throw new UpstreamError(`Unexpected HTTP ${response.status}`, url, response.status);
        }
        return response;
      } catch (error) {
        if (error instanceof UpstreamBlockedError) throw error;
        if (error instanceof UpstreamError && error.status !== undefined && error.status < 500) throw error;
        lastError = error;
        await sleep(1000);
      }
    }
    throw lastError instanceof Error ? lastError : new UpstreamError('Request failed', url);
  }

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    getText: (url) =>
      enqueue(async () => (await request(url, { headers: { Accept: 'text/html' } })).text()),
    postJson: <T>(url: string, body: unknown) =>
      enqueue(async () => {
        const response = await request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
        try {
          return (await response.json()) as T;
        } catch (cause) {
          throw new UpstreamError('Upstream returned invalid JSON', url, response.status, { cause });
        }
      }),
  };
}
