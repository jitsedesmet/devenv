import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** True when `rel` points at `base` itself or somewhere outside of it. */
function escapesRoot(base: string, rel: string): boolean {
  return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * Resolve `target` against `root` and guarantee the result stays inside `root`.
 * Throws when the path would escape the root (via `..`, an absolute segment,
 * etc.), so template files can never be written or probed outside the target
 * repository even if a snapshot ships a malicious relative path.
 */
export function resolveWithin(root: string, target: string): string {
  const base = resolve(root);
  const full = resolve(base, target);
  if (escapesRoot(base, relative(base, full))) {
    throw new Error(`Refusing to operate on "${target}": resolved path escapes "${root}".`);
  }
  return full;
}

/**
 * Recursively delete a scratch directory, but ONLY when it lives inside the OS
 * temp directory. This is a hard guard around recursive `rmSync`: it refuses to
 * touch the filesystem root, the temp root itself, an empty path, or anything
 * outside the temp directory, so a corrupted or empty path can never wipe out
 * `/`, a home directory, or a user's repository.
 */
export function removeTempDir(dir: string): void {
  if (typeof dir !== 'string' || dir.trim() === '') {
    throw new Error('Refusing to remove an empty path.');
  }
  const temp = resolve(tmpdir());
  const target = resolve(dir);
  if (target === temp || escapesRoot(temp, relative(temp, target))) {
    throw new Error(`Refusing to remove "${dir}": it is not inside the temp directory "${tmpdir()}".`);
  }
  rmSync(target, { recursive: true, force: true });
}
