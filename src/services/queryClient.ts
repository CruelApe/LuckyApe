import { QueryClient } from '@tanstack/react-query';

/**
 * `loadGame` never rejects (it degrades to cache, then sample data), so retries would only add
 * delay. Data is considered fresh for ten minutes; the server decides when to re-scrape.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 10 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
