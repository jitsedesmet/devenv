import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/io.js';
import { LOCK_REL, readLock, writeLock } from '../src/manifest.js';
import { listTemplates } from '../src/templates.js';
import {
  cleanup,
  DEVCONTAINER_V1,
  DOCKERFILE_V1,
  tempDir,
  writeTemplate,
} from './helpers.js';

const dirs: string[] = [];
afterEach(() => cleanup(...dirs.splice(0)));

describe('manifest lock', () => {
  it('round-trips a lock file', () => {
    const dir = tempDir();
    dirs.push(dir);
    expect(readLock(dir)).toBeUndefined();

    writeLock(dir, {
      name: 'demo',
      devenvVersion: '1.2.3',
      files: { '.devcontainer/Dockerfile': 'FROM node:22\n' },
    });

    const lock = readLock(dir);
    expect(lock?.name).toBe('demo');
    expect(lock?.devenvVersion).toBe('1.2.3');
    expect(lock?.files['.devcontainer/Dockerfile']).toBe('FROM node:22\n');
  });

  it('ignores a corrupt lock file', () => {
    const dir = tempDir();
    dirs.push(dir);
    writeLock(dir, { name: 'x', devenvVersion: '0', files: {} });
    writeFileSync(join(dir, LOCK_REL), '{ not json');
    expect(readLock(dir)).toBeUndefined();
  });
});

describe('listTemplates', () => {
  it('discovers the devcontainer template files and skips dot entries', () => {
    const root = tempDir();
    dirs.push(root);
    writeTemplate(root, { devcontainer: DEVCONTAINER_V1, dockerfile: DOCKERFILE_V1 });
    // A dot-prefixed mount folder that must be ignored.
    writeFile(join(root, '.devcontainer/.copilot/keep'), 'secret');

    const rels = listTemplates(root)
      .map((t) => t.rel)
      .sort();
    expect(rels).toEqual(['.devcontainer/Dockerfile', '.devcontainer/devcontainer.json']);
  });
});
