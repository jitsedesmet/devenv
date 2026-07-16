import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readName } from './devcontainer.js';

/**
 * Determine the project name to carry into `devcontainer.json`. We prefer the
 * name already on disk (so it is preserved across updates) and otherwise fall
 * back to the repository directory name — everything is discovered from the repo
 * itself, no external state is kept.
 */
export function resolveName(targetDir: string): string {
  const devcontainer = join(targetDir, '.devcontainer/devcontainer.json');
  if (existsSync(devcontainer)) {
    const name = readName(readFileSync(devcontainer, 'utf8'));
    if (name) {
      return name;
    }
  }
  return basename(targetDir);
}
