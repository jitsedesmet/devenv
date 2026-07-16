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
const V3: TemplateFiles = { devcontainer: DEVCONTAINER_V2, dockerfile: DOCKERFILE_V3 };

function read(targetDir: string, rel: string): string {
  return readFileSync(join(targetDir, rel), 'utf8');
}

function devcontainer(targetDir: string): Record<string, any> {
  return parse(read(targetDir, DC));
}

describe('init + update workflow', () => {
  let versionsRoot: string;
  let target: string;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    versionsRoot = tempDir('devenv-ver-');
    target = tempDir('devenv-repo-');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup(versionsRoot, target);
  });

  /** Init the project at version 1.0.0 from its shipped snapshot. */
  function initProject(name = 'webapp'): void {
    writeVersionSnapshot(versionsRoot, '1.0.0', V1);
    runInit(target, name, { versionsRoot, version: '1.0.0' });
  }

  /** Publish v2 as a shipped snapshot (the upstream upgrade). */
  function shipV2(): void {
    writeVersionSnapshot(versionsRoot, '2.0.0', V2);
  }

  function update(strategy?: 'merge' | 'force' | 'skip', version = '2.0.0'): Promise<void> {
    return runUpdate(target, { strategy, versionsRoot, version });
  }

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
    expect(existsSync(join(target, '.devcontainer/.devenv.lock.json'))).toBe(false);
  });

  it('init refuses and writes nothing when a managed file already exists', () => {
    initProject('webapp');
    const before = read(target, DC);
    expect(() => runInit(target, 'other', { versionsRoot, version: '1.0.0' })).toThrow(/already exist/i);
    expect(() => runInit(target, 'other', { versionsRoot, version: '1.0.0' })).toThrow(/update/i);
    expect(read(target, DC)).toBe(before);
  });

  it('init creates no file at all when only one target pre-exists', () => {
    writeVersionSnapshot(versionsRoot, '1.0.0', V1);
    writeFile(join(target, DC), '{}\n');
    expect(existsSync(join(target, DF))).toBe(false);
    expect(() => runInit(target, 'webapp', { versionsRoot, version: '1.0.0' })).toThrow(/already exist/i);
    expect(existsSync(join(target, DF))).toBe(false);
  });

  it('update refreshes unmodified files to the new template and bumps the version', async () => {
    initProject('webapp');
    shipV2();
    await update();
    expect(read(target, DF)).toContain('less man-db sudo curl nano git');
    expect(devcontainer(target)['customizations'].jetbrains.backend).toBe('IntelliJ');
    expect(devcontainer(target)['name']).toBe('webapp');
    expect(devcontainer(target)['devenvVersion']).toBe('2.0.0');
  });

  it('merge keeps user changes and applies upstream changes', async () => {
    initProject('webapp');
    editDevcontainer();
    shipV2();
    await update('merge');

    const dc = devcontainer(target);
    expect(dc['name']).toBe('webapp');
    expect(dc['devenvVersion']).toBe('2.0.0');
    expect(dc['forwardPorts']).toEqual([3000]);
    expect(dc['remoteUser']).toBe('node');
    expect(dc['customizations'].jetbrains.backend).toBe('IntelliJ');
  });

  it('force overwrites user changes but still transfers the name', async () => {
    initProject('webapp');
    editDevcontainer();
    shipV2();
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
    shipV2();
    await update('skip');

    const dc = devcontainer(target);
    expect(dc['remoteUser']).toBe('root');
    expect(dc['forwardPorts']).toEqual([3000]);
    expect(dc['customizations'].jetbrains.backend).toBe('WebStorm');
    expect(dc['devenvVersion']).toBe('1.0.0');
  });

  it('preserves user customisations across repeated updates', async () => {
    initProject('webapp');
    writeFileSync(
      join(target, DF),
      read(target, DF).replace('ENV DEVCONTAINER=true', 'ENV DEVCONTAINER=true\nENV MY_CUSTOM=1'),
    );

    shipV2();
    await update('merge', '2.0.0');

    // Next release ships v3.
    writeVersionSnapshot(versionsRoot, '3.0.0', V3);
    await update('merge', '3.0.0');

    const df = read(target, DF);
    expect(df).toContain('ENV MY_CUSTOM=1');
    expect(df).toContain('less man-db sudo curl nano git vim');
    expect(df).toContain("git config --global alias.gitm 'commit -am'");
    expect(devcontainer(target)['devenvVersion']).toBe('3.0.0');
  });
});
