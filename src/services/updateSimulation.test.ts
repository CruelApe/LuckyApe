import { describe, expect, it } from 'vitest';

import { simulatedUpdate } from './updateSimulation';

const REPO = 'https://github.com/CruelApe/LuckyApe';

describe('simulatedUpdate', () => {
  it('does nothing unless asked to', () => {
    for (const flag of [undefined, '', '  ', '0', 'false', 'off', 'no']) {
      expect(simulatedUpdate(flag, '1.0.5', REPO)).toBeNull();
    }
  });

  it('pretends a patch release is out when switched on', () => {
    for (const flag of ['1', 'true', 'ON', ' yes ']) {
      const result = simulatedUpdate(flag, '1.0.5', REPO);
      expect(result?.status).toBe('available');
      if (result?.status === 'available') expect(result.update.version).toBe('1.0.6');
    }
  });

  it('builds an update that cannot be installed, only browsed to', () => {
    const result = simulatedUpdate('1', '1.0.5', REPO);
    if (result?.status !== 'available') throw new Error('expected an update');
    expect(result.update.apkUrl).toBeNull();
    expect(result.update.apkSize).toBeNull();
    expect(result.update.downloadUrl).toBe(`${REPO}/releases/latest`);
    expect(result.update.releaseUrl.startsWith(`${REPO}/`)).toBe(true);
    expect(result.update.title).toContain('simulated');
  });

  it('takes a specific version as the latest release', () => {
    const result = simulatedUpdate('v2.1.0', '1.0.5', REPO);
    expect(result?.status === 'available' && result.update.version).toBe('2.1.0');
  });

  it('reports "current" when the version given is not newer', () => {
    expect(simulatedUpdate('1.0.5', '1.0.5', REPO)).toEqual({ status: 'current', latestVersion: '1.0.5' });
    expect(simulatedUpdate('0.9.0', '1.0.5', REPO)).toEqual({ status: 'current', latestVersion: '0.9.0' });
  });

  it('ignores a flag it does not understand, so a typo cannot hide the real check', () => {
    expect(simulatedUpdate('banana', '1.0.5', REPO)).toBeNull();
  });
});
