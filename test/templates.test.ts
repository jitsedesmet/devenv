import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/io.js';
import { listTemplates } from '../src/templates.js';
import { cleanup, DEVCONTAINER_V1, DOCKERFILE_V1, tempDir, writeTemplate } from './helpers.js';

const dirs: string[] = [];
afterEach(() => cleanup(...dirs.splice(0)));

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
