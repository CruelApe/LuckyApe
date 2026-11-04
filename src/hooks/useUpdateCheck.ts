import { useQuery } from '@tanstack/react-query';

import { APP_INFO } from '@/constants/config';
import { checkForUpdate } from '@/services/updateCheck';
import { SIMULATED_CHECK_MS, simulatedUpdate } from '@/services/updateSimulation';

export const updateQueryKey = ['update'] as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Development only (`__DEV__` is false in a release build, so this can never fire there): pretend a newer
 * release exists so the banner and About card can be seen without publishing one. See the README.
 */
async function simulatedCheck() {
  if (!__DEV__) return null;
  const result = simulatedUpdate(process.env.EXPO_PUBLIC_SIMULATE_UPDATE, APP_INFO.version, APP_INFO.repoUrl);
  if (result) await wait(SIMULATED_CHECK_MS);
  return result;
}

/** Once per launch is plenty; "Check for updates" on the About screen always asks again. */
const STALE_MS = 6 * 60 * 60_000;

/**
 * Whether a newer Lucky Ape has been released. Every screen that calls this shares one request, so the
 * check made when the app opens is the same one About shows.
 */
export function useUpdateCheck() {
  const query = useQuery({
    queryKey: updateQueryKey,
    queryFn: async () =>
      (await simulatedCheck()) ??
      checkForUpdate({
        currentVersion: APP_INFO.version,
        releaseApiUrl: APP_INFO.latestReleaseApiUrl,
        trustedUrlPrefix: `${APP_INFO.repoUrl}/`,
      }).catch((error: unknown) => {
        console.warn('[LuckyApe] update check failed', error);
        throw error;
      }),
    staleTime: STALE_MS,
    retry: false,
  });
  return { ...query, result: query.data };
}
