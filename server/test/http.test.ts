import { describe, expect, it, vi } from 'vitest';

import { UpstreamBlockedError, UpstreamError, createHttpClient } from '../src/http';

const config = { userAgent: 'LuckyApeTest/1.0', requestDelayMs: 500, requestTimeoutMs: 1000 };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function harness(responses: (Response | Error)[]) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => {
    const next = responses.shift();
    if (!next) throw new Error('no more fake responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const client = createHttpClient(config, {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    blockedBackoffMs: 60_000,
  });
  return { client, fetchImpl, sleeps, advance: (ms: number) => (clock += ms) };
}

describe('createHttpClient', () => {
  it('identifies itself and posts JSON', async () => {
    const { client, fetchImpl } = harness([json({ ok: 1 })]);
    await expect(client.postJson('https://x.test/a', { q: 1 })).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://x.test/a');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"q":1}');
    expect(init?.headers).toMatchObject({ 'User-Agent': 'LuckyApeTest/1.0', 'Content-Type': 'application/json' });
  });

  it('spaces requests out by the configured delay', async () => {
    const { client, sleeps } = harness([json(1), json(2), json(3)]);
    await client.postJson('https://x.test/a', {});
    await client.postJson('https://x.test/a', {});
    await client.postJson('https://x.test/a', {});
    expect(sleeps).toEqual([500, 500]); // none before the first request
  });

  it('runs concurrent callers one at a time', async () => {
    const { client, sleeps } = harness([json(1), json(2), json(3)]);
    await Promise.all([1, 2, 3].map(() => client.postJson('https://x.test/a', {})));
    expect(sleeps).toEqual([500, 500]);
  });

  it('stops asking after being refused, then resumes after the back-off', async () => {
    const { client, fetchImpl, advance } = harness([new Response('no', { status: 403 }), json({ back: true })]);
    await expect(client.postJson('https://x.test/a', {})).rejects.toBeInstanceOf(UpstreamBlockedError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(client.postJson('https://x.test/a', {})).rejects.toBeInstanceOf(UpstreamBlockedError);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // refused locally, no request sent

    advance(61_000);
    await expect(client.postJson('https://x.test/a', {})).resolves.toEqual({ back: true });
  });

  it.each([401, 429])('treats HTTP %i as a refusal too', async (status) => {
    const { client } = harness([new Response('no', { status })]);
    await expect(client.getText('https://x.test/a')).rejects.toBeInstanceOf(UpstreamBlockedError);
  });

  it('retries a server error once', async () => {
    const { client, fetchImpl, sleeps } = harness([new Response('oops', { status: 503 }), json({ ok: true })]);
    await expect(client.postJson('https://x.test/a', {})).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps).toContain(1000);
  });

  it('gives up after the retry and reports the status', async () => {
    const { client, fetchImpl } = harness([new Response('x', { status: 500 }), new Response('x', { status: 502 })]);
    await expect(client.postJson('https://x.test/a', {})).rejects.toMatchObject({ name: 'UpstreamError', status: 502 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors', async () => {
    const { client, fetchImpl } = harness([new Response('missing', { status: 404 })]);
    await expect(client.getText('https://x.test/a')).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure once, then reports it with the cause', async () => {
    const { client, fetchImpl } = harness([new Error('ECONNRESET'), new Error('ECONNRESET')]);
    const error = await client.getText('https://x.test/a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).message).toMatch(/ECONNRESET/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports invalid JSON as an upstream error', async () => {
    const { client } = harness([new Response('<html>not json</html>', { status: 200 })]);
    await expect(client.postJson('https://x.test/a', {})).rejects.toThrow(/invalid JSON/);
  });

  it('returns page text for GET', async () => {
    const { client } = harness([new Response('<p>hello</p>')]);
    await expect(client.getText('https://x.test/page')).resolves.toBe('<p>hello</p>');
  });
});
