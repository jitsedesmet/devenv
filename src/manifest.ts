import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Location (relative to the repository root) of the devenv state file. */
export const LOCK_REL = '.devcontainer/.devenv.lock.json';

export interface Lock {
  /** Project name transferred into `devcontainer.json`. */
  name: string;
  /** Version of `@jitsedesmet/devenv` that last wrote the managed files. */
  devenvVersion: string;
  /**
   * Pristine template content, keyed by repo-relative path, exactly as devenv
   * last rendered it. Used both to detect user edits and as the base for 3-way
   * merges.
   */
  files: Record<string, string>;
}

export function lockPath(targetDir: string): string {
  return join(targetDir, LOCK_REL);
}

export function readLock(targetDir: string): Lock | undefined {
  const file = lockPath(targetDir);
  if (!existsSync(file)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Lock>;
    if (parsed && typeof parsed === 'object' && parsed.files) {
      return {
        name: parsed.name ?? '',
        devenvVersion: parsed.devenvVersion ?? '0.0.0',
        files: parsed.files,
      };
    }
  } catch {
    // Corrupt lock file: behave as if there was none.
  }
  return undefined;
}

export function writeLock(targetDir: string, lock: Lock): void {
  const file = lockPath(targetDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
}
