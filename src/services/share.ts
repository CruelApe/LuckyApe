import { Platform, Share } from 'react-native';

import { notify } from './dialog';

/** Share text via the native sheet; on the web, use the Web Share API or copy to the clipboard. */
export async function shareText(text: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        notify('Copied', 'The combination was copied to your clipboard.');
      } else {
        throw new Error('Sharing is not available in this browser');
      }
      return;
    }
    await Share.share({ message: text });
  } catch (error) {
    // Dismissing the share sheet is not an error worth reporting.
    if ((error as Error).name === 'AbortError') return;
    console.warn('[LuckyApe] share failed', error);
    notify('Could not share', (error as Error).message);
  }
}
