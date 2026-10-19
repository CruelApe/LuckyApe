import { describe, expect, it, vi } from 'vitest';

import { UpdateCheckError, checkForUpdate, describeUpdateState, parseVersion, type UpdateResult } from './updateCheck';

const REPO = 'https://github.com/CruelApe/LuckyApe';
const API = 'https://api.github.com/repos/CruelApe/LuckyApe/releases/latest';

const release = (overrides: Record<string, unknown> = {}) => ({
  tag_name: 'v1.0.3',
  name: 'Lucky Ape v1.0.3 — more combinations',
  html_url: `${REPO}/releases/tag/v1.0.3`,
  draft: false,
  prerelease: false,
  assets: [
    { name: 'notes.txt', browser_download_url: `${REPO}/releases/download/v1.0.3/notes.txt` },
    {
      name: 'lucky-ape-1.0.3.apk',
      browser_download_url: `${REPO}/releases/download/v1.0.3/lucky-ape-1.0.3.apk`,
      size: 31_457_280,
    },
  ],
  ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const check = (response: () => Response | Promise<Response>, currentVersion = '1.0.2') =>
  checkForUpdate({
    currentVersion,
    releaseApiUrl: API,
    trustedUrlPrefix: `${REPO}/`,
    fetchImpl: (async () => response()) as typeof fetch,
  });

describe('parseVersion', () => {
  it.each([
    ['1.0.2', [1, 0, 2]],
    ['v1.10.0', [1, 10, 0]],
    ['2.1', [2, 1, 0]],
    ['3', [3, 0, 0]],
    [' v1.2.3-beta.1 ', [1, 2, 3]],
  ] as const)('reads %s', (text, expected) => expect(parseVersion(text)).toEqual(expected));

  it.each(['', 'latest', 'release-1.0.2', 'vv1.0.2'])('rejects %j', (text) => expect(parseVersion(text)).toBeNull());
});

describe('checkForUpdate', () => {
  it('offers a newer release, with its APK as the download', async () => {
    const result = await check(() => json(release()));
    expect(result).toEqual({
      status: 'available',
      update: {
        version: '1.0.3',
        title: 'Lucky Ape v1.0.3 — more combinations',
        releaseUrl: `${REPO}/releases/tag/v1.0.3`,
        downloadUrl: `${REPO}/releases/download/v1.0.3/lucky-ape-1.0.3.apk`,
        apkUrl: `${REPO}/releases/download/v1.0.3/lucky-ape-1.0.3.apk`,
        apkSize: 31_457_280,
      },
    });
  });

  it('does not trust a missing or nonsensical APK size', async () => {
    const apk = (size: unknown) => ({
      name: 'a.apk',
      browser_download_url: `${REPO}/releases/download/v1.0.3/a.apk`,
      size,
    });
    for (const size of [undefined, 0, -5, 12.5, '30000000']) {
      const result = await check(() => json(release({ assets: [apk(size)] })));
      expect(result).toMatchObject({ update: { apkSize: null, apkUrl: `${REPO}/releases/download/v1.0.3/a.apk` } });
    }
  });

  it('compares numbers, not text: 1.10.0 is newer than 1.9.0', async () => {
    const result = await check(() => json(release({ tag_name: 'v1.10.0' })), '1.9.0');
    expect(result.status).toBe('available');
  });

  it('is current when the release is the one installed, or older (a development build)', async () => {
    expect(await check(() => json(release({ tag_name: 'v1.0.2' })))).toEqual({ status: 'current', latestVersion: '1.0.2' });
    expect(await check(() => json(release({ tag_name: 'v1.0.2' })), '1.1.0')).toEqual({
      status: 'current',
      latestVersion: '1.0.2',
    });
  });

  it('falls back to the release page when there is no APK', async () => {
    const result = await check(() => json(release({ assets: [] })));
    expect(result).toMatchObject({
      status: 'available',
      update: { downloadUrl: `${REPO}/releases/tag/v1.0.3`, apkUrl: null, apkSize: null },
    });
  });

  it('never offers a download link that is not on the project repository', async () => {
    const result = await check(() =>
      json(release({ assets: [{ name: 'evil.apk', browser_download_url: 'https://evil.example/evil.apk' }] })),
    );
    expect(result).toMatchObject({
      status: 'available',
      update: { downloadUrl: `${REPO}/releases/tag/v1.0.3`, apkUrl: null },
    });
  });

  it('refuses a release page that is not on the project repository', async () => {
    await expect(check(() => json(release({ html_url: 'https://evil.example/v1.0.3' })))).rejects.toThrow(/unexpected/);
  });

  it('uses a plain title when the release is unnamed', async () => {
    const result = await check(() => json(release({ name: null })));
    expect(result).toMatchObject({ update: { title: 'Lucky Ape 1.0.3' } });
  });

  it('asks for GitHub JSON', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => json(release()));
    await checkForUpdate({ currentVersion: '1.0.2', releaseApiUrl: API, trustedUrlPrefix: `${REPO}/`, fetchImpl: fetchImpl as never });
    expect(fetchImpl.mock.calls[0][0]).toBe(API);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { Accept: 'application/vnd.github+json' } });
  });

  describe('when it cannot tell', () => {
    it.each([
      ['no release exists', () => json({ message: 'Not Found' }, 404), /No release has been published/],
      ['GitHub is rate limiting', () => json({ message: 'rate limit' }, 403), /HTTP 403/],
      ['GitHub is down', () => json({}, 503), /HTTP 503/],
      ['the body is not JSON', () => new Response('<html>', { status: 200 }), /unreadable/],
      ['the body is not a release', () => json({ hello: 'world' }), /unexpected response/],
      ['the tag is not a version', () => json(release({ tag_name: 'nightly' })), /unrecognised version \("nightly"\)/],
      ['the release is a draft', () => json(release({ draft: true })), /not a public release/],
      ['the release is a prerelease', () => json(release({ prerelease: true })), /not a public release/],
    ] as const)('rejects when %s', async (_name, response, message) => {
      const error = await check(response).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UpdateCheckError);
      expect((error as Error).message).toMatch(message);
    });

    it('rejects when there is no network', async () => {
      const error = await check(() => {
        throw new TypeError('Network request failed');
      }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UpdateCheckError);
      expect((error as Error).message).toBe('Could not reach the update server: Network request failed');
      expect((error as Error).cause).toBeInstanceOf(TypeError);
    });

    it('rejects when the app does not know its own version', async () => {
      await expect(check(() => json(release()), 'dev')).rejects.toThrow(/own version \("dev"\)/);
    });

    it('times out a server that never answers', async () => {
      const fetchImpl = (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });
      await expect(
        checkForUpdate({
          currentVersion: '1.0.2',
          releaseApiUrl: API,
          trustedUrlPrefix: `${REPO}/`,
          timeoutMs: 20,
          fetchImpl: fetchImpl as never,
        }),
      ).rejects.toThrow('Timed out checking for updates');
    });
  });
});

describe('describeUpdateState', () => {
  const available: UpdateResult = {
    status: 'available',
    update: {
      version: '1.0.3',
      title: 'Lucky Ape v1.0.3',
      releaseUrl: `${REPO}/r`,
      downloadUrl: `${REPO}/d`,
      apkUrl: `${REPO}/d`,
      apkSize: 1000,
    },
  };
  const current: UpdateResult = { status: 'current', latestVersion: '1.0.2' };
  const view = (input: Partial<Parameters<typeof describeUpdateState>[0]>) =>
    describeUpdateState({ isChecking: false, result: undefined, error: null, ...input }, '1.0.2');

  it('says it is checking, whatever it knew before', () => {
    expect(view({ isChecking: true, result: current })).toMatchObject({ state: 'checking' });
  });

  it('announces a new version with the release title', () => {
    expect(view({ result: available })).toEqual({
      state: 'available',
      title: 'Version 1.0.3 is available',
      detail: 'Lucky Ape v1.0.3',
    });
  });

  it('confirms the app is up to date', () => {
    expect(view({ result: current })).toMatchObject({ state: 'current', title: "You're up to date" });
  });

  it('reports a failed check, and lets it outrank an older answer', () => {
    expect(view({ error: new UpdateCheckError('Timed out checking for updates') })).toEqual({
      state: 'failed',
      title: "Couldn't check for updates",
      detail: 'Timed out checking for updates',
    });
    expect(view({ result: available, error: new Error('offline') })).toMatchObject({ state: 'failed' });
  });

  it('starts idle, showing the installed version', () => {
    expect(view({})).toEqual({ state: 'idle', title: 'Updates', detail: 'You have version 1.0.2.' });
  });
});
