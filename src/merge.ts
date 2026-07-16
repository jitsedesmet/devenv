import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTempDir } from './safety.js';

export interface StringMergeResult {
  content: string;
  conflict: boolean;
}

/**
 * Perform a git-style 3-way merge of a text file using `git merge-file`. This is
 * the same well-tested algorithm git uses for merges, so it never loses lines and
 * never blocks for input: conflicting hunks are emitted with the usual
 * `<<<<<<<`/`=======`/`>>>>>>>` markers and reported back as a conflict.
 *
 * @param base   The pristine template content devenv last wrote.
 * @param ours   The user's current on-disk content.
 * @param theirs The new template content.
 */
export function mergeStrings(base: string, ours: string, theirs: string): StringMergeResult {
  const dir = mkdtempSync(join(tmpdir(), 'devenv-merge-'));
  try {
    const oursPath = join(dir, 'ours');
    const basePath = join(dir, 'base');
    const theirsPath = join(dir, 'theirs');
    writeFileSync(oursPath, ours);
    writeFileSync(basePath, base);
    writeFileSync(theirsPath, theirs);

    try {
      const content = execFileSync(
        'git',
        ['merge-file', '-p', '-L', 'yours', '-L', 'base', '-L', 'devenv', oursPath, basePath, theirsPath],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      return { content, conflict: false };
    } catch (error) {
      // `git merge-file` exits with the number of conflicts (1..127) while still
      // printing the merged result (with markers) to stdout.
      const err = error as { status?: number | null; stdout?: string | Buffer };
      if (typeof err.status === 'number' && err.status > 0 && err.status < 128 && err.stdout != null) {
        return { content: err.stdout.toString(), conflict: true };
      }
      // git is unavailable or failed outright: keep the user's file untouched.
      return { content: ours, conflict: true };
    }
  } finally {
    removeTempDir(dir);
  }
}
