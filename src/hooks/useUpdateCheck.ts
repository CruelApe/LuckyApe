import { useQuery } from '@tanstack/react-query';

import { APP_INFO } from '@/constants/config';
import { checkForUpdate } from '@/services/updateCheck';

export const updateQueryKey = ['update'] as const;

/** Once per launch is plenty; "Check for updates" on the About screen always asks again. */
const STALE_MS = 6 * 60 * 60_000;

/**
 * Whether a newer Lucky Ape has been released. Every screen that calls this shares one request, so the
 * check made when the app opens is the same one About shows.
 */
export function useUpdateCheck() {
  const query = useQuery({
    queryKey: updateQueryKey,
    queryFn: () =>
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
