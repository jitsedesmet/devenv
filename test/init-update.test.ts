import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'jsonc-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../src/init.js';
import { writeFile } from '../src/io.js';
import { runUpdate } from '../src/update.js';
import {
  cleanup,
  DEVCONTAINER_V1,
  DOCKERFILE_V1,
  tempDir,
  writeTemplate,
  writeVersionSnapshot,
  type TemplateFiles,
} from './helpers.js';

const DC = '.devcontainer/devcontainer.json';
const DF = '.devcontainer/Dockerfile';

const DEVCONTAINER_V2 = DEVCONTAINER_V1.replace('"backend": "WebStorm"', '"backend": "IntelliJ"');
const DOCKERFILE_V2 = DOCKERFILE_V1.replace(
  'less man-db sudo curl nano',
  'less man-db sudo curl nano git',
);
const DOCKERFILE_V3 = DOCKERFILE_V2.replace(
  'less man-db sudo curl nano git',
  'less man-db sudo curl nano git vim',
);

const V1: TemplateFiles = { devcontainer: DEVCONTAINER_V1, dockerfile: DOCKERFILE_V1 };
const V2: TemplateFiles = { devcontainer: DEVCONTAINER_V2, dockerfile: DOCKERFILE_V2 };

function read(targetDir: string, rel: string): string {
  return readFileSync(join(targetDir, rel), 'utf8');
}

function devcontainer(targetDir: string): Record<string, any> {
  return parse(read(targetDir, DC));
}

describe('init + update workflow', () => {
  let templateRoot: string;
  let versionsRoot: string;
  let target: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    templateRoot = tempDir('devenv-tpl-');
    versionsRoot = tempDir('devenv-ver-');
    target = tempDir('devenv-repo-');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup(templateRoot, versionsRoot, target);
  });

  /** Init the project at version 1.0.0 and record its snapshot as the merge base. */
  function initProject(name = 'webapp'): void {
    writeTemplate(templateRoot, V1);
    writeVersionSnapshot(versionsRoot, '1.0.0', V1);
    runInit(target, name, { templateRoot, version: '1.0.0' });
  }

  /** Make the current template v2 (the upstream upgrade). */
  function bumpToV2(): void {
    writeTemplate(templateRoot, V2);
  }

  function update(strategy?: 'merge' | 'force' | 'skip', version = '2.0.0'): Promise<void> {
    return runUpdate(target, { strategy, templateRoot, versionsRoot, version });
  }

  /** User customises devcontainer.json on disk (rendered form). */
  function editDevcontainer(): void {
    const edited = read(target, DC)
      .replace('"remoteUser": "node"', '"remoteUser": "root"')
      .replace('"name": "webapp",', '"forwardPorts": [3000],\n  "name": "webapp",');
    writeFileSync(join(target, DC), edited);
  }

  it('init writes the template with name + version and no lock file', () => {
    initProject('cool-app');
    expect(devcontainer(target)['name']).toBe('cool-app');
    expect(devcontainer(target)['devenvVersion']).toBe('1.0.0');
    expect(read(target, DF)).toBe(DOCKERFILE_V1);
    // No external state is written into the repo.
    expect(existsSync(join(target, '.devcontainer/.devenv.lock.json'))).toBe(false);
  });

  it('init refuses and writes nothing when a managed file already exists', () => {
    initProject('webapp');
    const before = read(target, DC);
    expect(() => runInit(target, 'other', { templateRoot, version: '1.0.0' })).toThrow(/already exist/i);
    expect(() => runInit(target, 'other', { templateRoot, version: '1.0.0' })).toThrow(/update/i);
    expect(read(target, DC)).toBe(before);
  });

  it('init creates no file at all when only one target pre-exists', () => {
    writeTemplate(templateRoot, V1);
    writeFile(join(target, DC), '{}\n');
    expect(existsSync(join(target, DF))).toBe(false);
    expect(() => runInit(target, 'webapp', { templateRoot, version: '1.0.0' })).toThrow(/already exist/i);
    expect(existsSync(join(target, DF))).toBe(false);
  });

  it('update refreshes unmodified files to the new template and bumps the version', async () => {
    initProject('webapp');
    bumpToV2();
    await update();
    expect(read(target, DF)).toContain('less man-db sudo curl nano git');
    expect(devcontainer(target)['customizations'].jetbrains.backend).toBe('IntelliJ');
    expect(devcontainer(target)['name']).toBe('webapp');
    expect(devcontainer(target)['devenvVersion']).toBe('2.0.0');
  });

  it('merge keeps user changes and applies upstream changes', async () => {
    initProject('webapp');
    editDevcontainer();
    bumpToV2();
    await update('merge');

    const dc = devcontainer(target);
    expect(dc['name']).toBe('webapp');
    expect(dc['devenvVersion']).toBe('2.0.0');
    expect(dc['forwardPorts']).toEqual([3000]); // user key preserved
    expect(dc['remoteUser']).toBe('node'); // template wins
    expect(dc['customizations'].jetbrains.backend).toBe('IntelliJ'); // upstream change
  });

  it('force overwrites user changes but still transfers the name', async () => {
    initProject('webapp');
    editDevcontainer();
    bumpToV2();
    await update('force');

    const dc = devcontainer(target);
    expect(dc['name']).toBe('webapp');
    expect(dc['devenvVersion']).toBe('2.0.0');
    expect(dc['forwardPorts']).toBeUndefined();
    expect(dc['remoteUser']).toBe('node');
  });

  it('skip leaves user-modified files and keeps their recorded version', async () => {
    initProject('webapp');
    editDevcontainer();
    bumpToV2();
    await update('skip');

    const dc = devcontainer(target);
    expect(dc['remoteUser']).toBe('root'); // user value kept
    expect(dc['forwardPorts']).toEqual([3000]);
    expect(dc['customizations'].jetbrains.backend).toBe('WebStorm'); // not upgraded
    expect(dc['devenvVersion']).toBe('1.0.0'); // still based on the old version
  });

  it('preserves user customisations across repeated updates', async () => {
    initProject('webapp');
    // Add a user line to the Dockerfile.
    writeFileSync(
      join(target, DF),
      read(target, DF).replace('ENV DEVCONTAINER=true', 'ENV DEVCONTAINER=true\nENV MY_CUSTOM=1'),
    );

    bumpToV2();
    await update('merge', '2.0.0');

    // Next release: snapshot 2.0.0 as the new base and ship v3 as the template.
    writeVersionSnapshot(versionsRoot, '2.0.0', V2);
    writeTemplate(templateRoot, { devcontainer: DEVCONTAINER_V2, dockerfile: DOCKERFILE_V3 });
    await update('merge', '3.0.0');

    const df = read(target, DF);
    expect(df).toContain('ENV MY_CUSTOM=1'); // user edit survives twice
    expect(df).toContain('less man-db sudo curl nano git vim'); // latest upstream
    expect(df).toContain("git config --global alias.gitm 'commit -am'"); // no data loss
    expect(devcontainer(target)['devenvVersion']).toBe('3.0.0');
  });
});
