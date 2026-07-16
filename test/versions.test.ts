import { afterEach, describe, expect, it } from 'vitest';
import { availableVersions, compareVersions, resolveBase, versionsRoot } from '../src/versions.js';
import { cleanup, DEVCONTAINER_V1, DOCKERFILE_V1, tempDir, writeVersionSnapshot } from './helpers.js';

const dirs: string[] = [];
afterEach(() => cleanup(...dirs.splice(0)));

describe('compareVersions', () => {
  it('orders dotted numeric versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });
});

describe('resolveBase', () => {
  function seed(): string {
    const root = tempDir('devenv-versions-');
    dirs.push(root);
    writeVersionSnapshot(root, '1.0.0', { devcontainer: DEVCONTAINER_V1, dockerfile: DOCKERFILE_V1 });
    writeVersionSnapshot(root, '1.2.0', { devcontainer: DEVCONTAINER_V1, dockerfile: 'FROM node:22\n' });
    return root;
  }

  it('lists available versions oldest first', () => {
    const root = seed();
    expect(availableVersions(root)).toEqual(['1.0.0', '1.2.0']);
  });

  it('returns the exact snapshot when present', () => {
    const root = seed();
    const base = resolveBase('1.0.0', root);
    expect(base?.get('.devcontainer/Dockerfile')).toBe(DOCKERFILE_V1);
  });

  it('falls back to the newest snapshot not newer than the version', () => {
    const root = seed();
    const base = resolveBase('1.5.0', root);
    // 1.2.0 is the newest <= 1.5.0
    expect(base?.get('.devcontainer/Dockerfile')).toBe('FROM node:22\n');
  });

  it('returns undefined when no snapshot is old enough or no version is given', () => {
    const root = seed();
    expect(resolveBase('0.9.0', root)).toBeUndefined();
    expect(resolveBase(undefined, root)).toBeUndefined();
  });

  it('defaults its root under the package root', () => {
    // Sanity check the default argument wiring (does not assert contents).
    expect(versionsRoot()).toMatch(/versions$/);
  });
});
