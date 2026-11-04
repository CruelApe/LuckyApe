import * as Notifications from 'expo-notifications';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { gameSlugFromNotificationData } from '@/services/jackpotAlerts';

/** The splash screen is the app's entry route; nothing can be opened on top of it yet. */
const SPLASH_PATH = '/';

/**
 * Opens the game a jackpot notification is about when the user taps it. Mount once, inside the router's
 * layout, and only where notifications exist (it renders nothing).
 *
 * The tap can arrive while the app is open, in the background, or is what launched it. In the last case
 * the splash screen is still loading and will replace itself with the home screen, so the game is only
 * opened once the app has left the splash: the game then sits on top of home and Back goes there.
 */
export function useNotificationNavigation(): void {
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = useRootNavigationState()?.key !== undefined;
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const slug = gameSlugFromNotificationData(response.notification.request.content.data);
    if (!slug) return;

    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current.has(key)) return;
    if (!navigationReady || pathname === SPLASH_PATH) return; // not yet: runs again when the route changes

    handled.current.add(key);
    if (pathname !== `/games/${slug}`) router.push({ pathname: '/games/[slug]', params: { slug } });
  }, [response, pathname, navigationReady, router]);
}
