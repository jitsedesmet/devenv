import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'jsonc-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../src/init.js';
import { readLock } from '../src/manifest.js';
import { runUpdate } from '../src/update.js';
import {
  cleanup,
  DEVCONTAINER_V1,
  DOCKERFILE_V1,
  tempDir,
  writeTemplate,
} from './helpers.js';

function read(targetDir: string, rel: string): string {
  return readFileSync(join(targetDir, rel), 'utf8');
}

function devcontainer(targetDir: string): Record<string, any> {
  return parse(read(targetDir, '.devcontainer/devcontainer.json'));
}

const DC = '.devcontainer/devcontainer.json';
const DF = '.devcontainer/Dockerfile';

describe('init + update workflow', () => {
  let templateRoot: string;
  let target: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    templateRoot = tempDir('devenv-tpl-');
    target = tempDir('devenv-repo-');
    writeTemplate(templateRoot, { devcontainer: DEVCONTAINER_V1, dockerfile: DOCKERFILE_V1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup(templateRoot, target);
  });

  function initProject(name = 'webapp'): void {
    runInit(target, name, { templateRoot });
  }

  function editProject(): void {
    // User customises both managed files.
    let dc = read(target, DC);
    dc = dc
      .replace('"remoteUser": "node"', '"remoteUser": "root"')
      .replace('"name": "webapp",', '"name": "webapp",\n  "forwardPorts": [3000],');
    writeFileSync(join(target, DC), dc);
  }
  function bumpTemplate(): void {
    const dc = DEVCONTAINER_V1.replace('"backend": "WebStorm"', '"backend": "IntelliJ"');
    const df = DOCKERFILE_V1.replace('less man-db sudo curl nano', 'less man-db sudo curl nano git');
    writeTemplate(templateRoot, { devcontainer: dc, dockerfile: df });
  }

  it('init writes the template with the name transferred and records a lock', () => {
    initProject('cool-app');
    expect(devcontainer(target)['name']).toBe('cool-app');
    expect(read(target, DF)).toBe(DOCKERFILE_V1);
    const lock = readLock(target);
    expect(lock?.name).toBe('cool-app');
    expect(Object.keys(lock?.files ?? {}).sort()).toEqual([DF, DC]);
  });

  it('update refreshes unmodified files to the new template, keeping the name', async () => {
    initProject('webapp');
    bumpTemplate();
    await runUpdate(target, { templateRoot });
    expect(read(target, DF)).toContain('less man-db sudo curl nano git');
    expect(devcontainer(target)['customizations'].jetbrains.backend).toBe('IntelliJ');
    // Name is never taken from the template.
    expect(devcontainer(target)['name']).toBe('webapp');
  });

  it('merge keeps user changes and applies upstream changes', async () => {
    initProject('webapp');
    editProject();
    bumpTemplate();
    await runUpdate(target, { strategy: 'merge', templateRoot });

    const dc = devcontainer(target);
    expect(dc['name']).toBe('webapp');
    expect(dc['forwardPorts']).toEqual([3000]); // user key preserved
    expect(dc['remoteUser']).toBe('node'); // template wins on shared key
    expect(dc['customizations'].jetbrains.backend).toBe('IntelliJ'); // upstream change
  });

  it('force overwrites user changes but still transfers the name', async () => {
    initProject('webapp');
    editProject();
    bumpTemplate();
    await runUpdate(target, { strategy: 'force', templateRoot });

    const dc = devcontainer(target);
    expect(dc['name']).toBe('webapp');
    expect(dc['forwardPorts']).toBeUndefined();
    expect(dc['remoteUser']).toBe('node');
    expect(dc['customizations'].jetbrains.backend).toBe('IntelliJ');
  });

  it('skip leaves user-modified files untouched', async () => {
    initProject('webapp');
    editProject();
    bumpTemplate();
    await runUpdate(target, { strategy: 'skip', templateRoot });

    const dc = devcontainer(target);
    expect(dc['remoteUser']).toBe('root'); // user value kept
    expect(dc['forwardPorts']).toEqual([3000]);
    expect(dc['customizations'].jetbrains.backend).toBe('WebStorm'); // not upgraded
  });

  it('preserves user customisations across repeated updates', async () => {
    initProject('webapp');
    // Add a user line to the Dockerfile.
    writeFileSync(
      join(target, DF),
      read(target, DF).replace('ENV DEVCONTAINER=true', 'ENV DEVCONTAINER=true\nENV MY_CUSTOM=1'),
    );

    bumpTemplate();
    await runUpdate(target, { strategy: 'merge', templateRoot });

    // Second upstream change.
    writeTemplate(templateRoot, {
      devcontainer: DEVCONTAINER_V1.replace('"backend": "WebStorm"', '"backend": "IntelliJ"'),
      dockerfile: DOCKERFILE_V1.replace(
        'less man-db sudo curl nano',
        'less man-db sudo curl nano git vim',
      ),
    });
    await runUpdate(target, { strategy: 'merge', templateRoot });

    const df = read(target, DF);
    expect(df).toContain('ENV MY_CUSTOM=1'); // user edit survives twice
    expect(df).toContain('less man-db sudo curl nano git vim'); // latest upstream
    expect(df).toContain("git config --global alias.gitm 'commit -am'"); // no data loss
  });
});
