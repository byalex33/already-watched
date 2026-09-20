import { expect, it } from 'vitest';
import manifest from '../manifest.json';
import packageInfo from '../package.json';
import lock from '../package-lock.json';

it('keeps release and lockfile versions consistent', () => {
  expect(manifest.version).toBe(packageInfo.version);
  expect(lock.version).toBe(packageInfo.version);
  expect(lock.packages[''].version).toBe(packageInfo.version);
  expect(packageInfo.version).toMatch(/^1\.\d+\.\d+$/);
});
