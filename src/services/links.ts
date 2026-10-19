import { Linking } from 'react-native';

import { notify } from './dialog';

/** Open a link in the browser (or whatever handles it). Says so, rather than silently doing nothing, if it cannot. */
export async function openLink(url: string, failureTitle = 'Could not open the link'): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error('[LuckyApe] could not open link', url, error);
    notify(failureTitle, `Nothing on this device could open ${url}`);
  }
}
