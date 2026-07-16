import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/io.js';
import { listTemplates } from '../src/templates.js';
import { cleanup, DEVCONTAINER_V1, DOCKERFILE_V1, tempDir, writeTemplate } from './helpers.js';

const dirs: string[] = [];
afterEach(() => cleanup(...dirs.splice(0)));

describe('listTemplates', () => {
  it('discovers every file under .devcontainer, recursively', () => {
    const root = tempDir();
    dirs.push(root);
    writeTemplate(root, { devcontainer: DEVCONTAINER_V1, dockerfile: DOCKERFILE_V1 });
    // A nested file and a dot-prefixed file are both included.
    writeFile(join(root, '.devcontainer/scripts/setup.sh'), '#!/bin/sh\n');
    writeFile(join(root, '.devcontainer/.env'), 'FOO=bar\n');

    const rels = listTemplates(root)
      .map((t) => t.rel)
      .sort();
    expect(rels).toEqual([
      '.devcontainer/.env',
      '.devcontainer/Dockerfile',
      '.devcontainer/devcontainer.json',
      '.devcontainer/scripts/setup.sh',
    ]);
  });
});
