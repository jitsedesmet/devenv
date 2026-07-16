import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readName } from './devcontainer.js';
import type { Lock } from './manifest.js';

/**
 * Determine the project name to carry into `devcontainer.json` on update. We
 * prefer the name the user already has on disk (so it is preserved across
 * updates), then the recorded lock name, and finally the directory name.
 */
export function resolveName(targetDir: string, lock: Lock | undefined): string {
  const devcontainer = join(targetDir, '.devcontainer/devcontainer.json');
  if (existsSync(devcontainer)) {
    const name = readName(readFileSync(devcontainer, 'utf8'));
    if (name) {
      return name;
    }
  }
  if (lock?.name) {
    return lock.name;
  }
  return basename(targetDir);
}
