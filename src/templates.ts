import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { packageRoot } from './paths.js';

/** Directory (relative to a repository root) that holds the managed template. */
export const TEMPLATE_DIR = '.devcontainer';

export interface Template {
  /** Path relative to the repository root, using forward slashes. */
  rel: string;
  /** Verbatim template content as shipped in the package. */
  content: string;
}

function toPosix(p: string): string {
  return p.split(/[\\/]/).join('/');
}

/**
 * Discover every file that makes up the devcontainer template shipped with this
 * package. Entries whose name starts with a dot (mount folders such as
 * `.copilot`/`.claude`, or our own lock file) are ignored so they are neither
 * shipped nor managed.
 *
 * @param templateRoot Root that contains the `.devcontainer` template directory.
 *                     Defaults to the installed package root.
 */
export function listTemplates(templateRoot: string = packageRoot()): Template[] {
  const base = join(templateRoot, TEMPLATE_DIR);
  const result: Template[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        result.push({
          rel: toPosix(join(TEMPLATE_DIR, relative(base, full))),
          content: readFileSync(full, 'utf8'),
        });
      }
    }
  };

  walk(base);
  return result.sort((a, b) => a.rel.localeCompare(b.rel));
}
