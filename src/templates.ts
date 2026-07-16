import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Directory (relative to a snapshot root) that holds the managed template. */
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
 * Discover every file that makes up the devcontainer template inside a snapshot
 * root (a `versions/<version>` directory). Entries whose name starts with a dot
 * (mount folders such as `.copilot`/`.claude`) are ignored.
 *
 * @param templateRoot Root that contains the `.devcontainer` template directory.
 */
export function listTemplates(templateRoot: string): Template[] {
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
