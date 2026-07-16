import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeTempDir, resolveWithin } from '../src/safety.js';

describe('resolveWithin', () => {
  const root = resolve(tmpdir(), 'devenv-root');

  it('resolves a normal nested path inside the root', () => {
    expect(resolveWithin(root, '.devcontainer/devcontainer.json')).toBe(
      join(root, '.devcontainer/devcontainer.json'),
    );
  });

  it('rejects parent-directory traversal', () => {
    expect(() => resolveWithin(root, '../evil')).toThrow(/escapes/i);
    expect(() => resolveWithin(root, '.devcontainer/../../evil')).toThrow(/escapes/i);
  });

  it('rejects absolute paths that point outside the root', () => {
    expect(() => resolveWithin(root, `${sep}etc${sep}passwd`)).toThrow(/escapes/i);
  });

  it('rejects the root itself (not a file target)', () => {
    expect(() => resolveWithin(root, '')).toThrow(/escapes/i);
    expect(() => resolveWithin(root, '.')).toThrow(/escapes/i);
  });
});

describe('removeTempDir', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const dir of created.splice(0)) {
      if (existsSync(dir)) {
        removeTempDir(dir);
      }
    }
  });

  it('removes a directory tree that lives inside the OS temp dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'devenv-safe-'));
    writeFileSync(join(dir, 'file.txt'), 'hi');
    removeTempDir(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('refuses to remove the filesystem root', () => {
    expect(() => removeTempDir(sep)).toThrow(/not inside the temp directory/i);
  });

  it('refuses to remove an empty path', () => {
    expect(() => removeTempDir('')).toThrow(/empty path/i);
    expect(() => removeTempDir('   ')).toThrow(/empty path/i);
  });

  it('refuses to remove the temp root itself', () => {
    expect(() => removeTempDir(tmpdir())).toThrow(/not inside the temp directory/i);
  });

  it('refuses to remove a path outside the temp dir (e.g. the home directory)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'devenv-safe-'));
    created.push(dir);
    expect(() => removeTempDir(homedir())).toThrow(/not inside the temp directory/i);
    // The legitimate temp dir is untouched by the refusal above.
    expect(existsSync(dir)).toBe(true);
  });

  it('refuses to escape the temp dir via traversal', () => {
    expect(() => removeTempDir(join(tmpdir(), '..'))).toThrow(/not inside the temp directory/i);
  });
});
