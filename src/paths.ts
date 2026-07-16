import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the root of the installed `@jitsedesmet/devenv` package.
 * At runtime this file lives in `<packageRoot>/dist`, so the root is one level up.
 */
export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** Version of the `@jitsedesmet/devenv` package that is currently running. */
export function devenvVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface TargetDir {
  dir: string;
  isGitRoot: boolean;
}

/**
 * Resolve the directory we should operate on: the root of the git repository the
 * command is invoked from, falling back to the current working directory when we
 * are not inside a git repository.
 */
export function findTargetDir(cwd: string = process.cwd()): TargetDir {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (out) {
      return { dir: out, isGitRoot: true };
    }
  } catch {
    // Not a git repository (or git is unavailable): fall back to the cwd.
  }
  return { dir: cwd, isGitRoot: false };
}
