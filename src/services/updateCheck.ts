export class UpdateCheckError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UpdateCheckError';
  }
}

export interface AvailableUpdate {
  /** Normalised, e.g. "1.0.3". */
  version: string;
  /** The release's own title, e.g. "Lucky Ape v1.0.3 — more combinations". */
  title: string;
  /** The release page, with its notes. */
  releaseUrl: string;
  /** The APK itself when the release has one, otherwise the release page. For opening in a browser. */
  downloadUrl: string;
  /** The release's APK, when it has one: what an Android phone can download and install itself. */
  apkUrl: string | null;
  /** The APK's size in bytes, when the release says; used to spot a truncated download. */
  apkSize: number | null;
}

export type UpdateResult =
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'current'; latestVersion: string };

export interface UpdateCheckOptions {
  /** The version of the running app. */
  currentVersion: string;
  /** GitHub's "latest release" endpoint for the repository. */
  releaseApiUrl: string;
  /** Links in the response are only trusted (and later opened) if they start with this. */
  trustedUrlPrefix: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type Version = readonly [major: number, minor: number, patch: number];

/** "v1.2.3", "1.2" and "1.2.3-beta" all parse; anything that does not start with a number does not. */
export function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

const formatVersion = (version: Version) => version.join('.');

/** Positive when `a` is newer than `b`. */
function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

interface Release {
  version: Version;
  title: string;
  releaseUrl: string;
  apkUrl: string | null;
  apkSize: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Reads the parts of a GitHub release the app needs, refusing anything unexpected. */
function readRelease(body: unknown, trustedUrlPrefix: string): Release {
  if (!isRecord(body) || typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') {
    throw new UpdateCheckError('The update server sent an unexpected response');
  }
  if (body.draft === true || body.prerelease === true) {
    throw new UpdateCheckError('The latest release is not a public release');
  }
  const version = parseVersion(body.tag_name);
  if (!version) throw new UpdateCheckError(`The latest release has an unrecognised version ("${body.tag_name}")`);
  if (!body.html_url.startsWith(trustedUrlPrefix)) {
    throw new UpdateCheckError('The latest release points somewhere unexpected');
  }

  const apk = (Array.isArray(body.assets) ? body.assets : []).find(
    (asset): asset is { name: string; browser_download_url: string; size?: unknown } =>
      isRecord(asset) &&
      typeof asset.name === 'string' &&
      asset.name.toLowerCase().endsWith('.apk') &&
      typeof asset.browser_download_url === 'string' &&
      asset.browser_download_url.startsWith(trustedUrlPrefix),
  );
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  return {
    version,
    title: name || `Lucky Ape ${formatVersion(version)}`,
    releaseUrl: body.html_url,
    apkUrl: apk?.browser_download_url ?? null,
    apkSize: typeof apk?.size === 'number' && Number.isInteger(apk.size) && apk.size > 0 ? apk.size : null,
  };
}

/**
 * Asks GitHub for the newest published release and compares it with the running version.
 * Rejects with an `UpdateCheckError` (never anything vaguer) when the answer cannot be trusted or reached,
 * so a caller can tell "no update" from "could not check".
 */
export async function checkForUpdate(options: UpdateCheckOptions): Promise<UpdateResult> {
  const current = parseVersion(options.currentVersion);
  if (!current) throw new UpdateCheckError(`The app's own version ("${options.currentVersion}") is not recognised`);

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  let body: unknown;
  try {
    const response = await fetchImpl(options.releaseApiUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (response.status === 404) throw new UpdateCheckError('No release has been published yet');
    if (!response.ok) throw new UpdateCheckError(`The update server answered HTTP ${response.status}`);
    try {
      body = await response.json();
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') throw cause;
      throw new UpdateCheckError('The update server sent an unreadable response', { cause });
    }
  } catch (error) {
    if (error instanceof UpdateCheckError) throw error;
    if ((error as Error).name === 'AbortError') throw new UpdateCheckError('Timed out checking for updates', { cause: error });
    throw new UpdateCheckError(`Could not reach the update server: ${(error as Error).message}`, { cause: error });
  } finally {
    clearTimeout(timer);
  }

  const release = readRelease(body, options.trustedUrlPrefix);
  const version = formatVersion(release.version);
  if (compareVersions(release.version, current) <= 0) return { status: 'current', latestVersion: version };
  return {
    status: 'available',
    update: {
      version,
      title: release.title,
      releaseUrl: release.releaseUrl,
      downloadUrl: release.apkUrl ?? release.releaseUrl,
      apkUrl: release.apkUrl,
      apkSize: release.apkSize,
    },
  };
}

export interface UpdateView {
  state: 'idle' | 'checking' | 'available' | 'current' | 'failed';
  title: string;
  detail: string;
}

/** What the About screen says, from the state of the check. A failed check outranks an older success. */
export function describeUpdateState(
  input: { isChecking: boolean; result: UpdateResult | undefined; error: unknown },
  currentVersion: string,
): UpdateView {
  const { isChecking, result, error } = input;
  if (isChecking) return { state: 'checking', title: 'Checking for updates…', detail: `You have version ${currentVersion}.` };
  if (error) {
    return {
      state: 'failed',
      title: "Couldn't check for updates",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (result?.status === 'available') {
    return { state: 'available', title: `Version ${result.update.version} is available`, detail: result.update.title };
  }
  if (result?.status === 'current') {
    return { state: 'current', title: "You're up to date", detail: `Version ${currentVersion} is the latest release.` };
  }
  return { state: 'idle', title: 'Updates', detail: `You have version ${currentVersion}.` };
}
