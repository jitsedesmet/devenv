import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export type Strategy = 'merge' | 'force' | 'skip';

/**
 * Resolve the non-interactive strategy from the CLI flags, ensuring at most one
 * of `--merge`, `--force` or `--skip` was given. Returns `undefined` when none
 * was passed (the caller should then prompt).
 */
export function resolveStrategy(values: { merge?: boolean; force?: boolean; skip?: boolean }): Strategy | undefined {
  const chosen = (['merge', 'force', 'skip'] as const).filter((key) => values[key]);
  if (chosen.length > 1) {
    throw new Error(`Only one of --merge, --force or --skip may be used (got ${chosen.join(', ')}).`);
  }
  return chosen[0];
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Ask a yes/no question. Non-interactive shells fall back to the default. */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  if (!stdin.isTTY) {
    return defaultYes;
  }
  const answer = (await ask(`${question} ${defaultYes ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
  if (!answer) {
    return defaultYes;
  }
  return answer === 'y' || answer === 'yes';
}

/**
 * Prompt for the update strategy of a file the user has modified. Defaults to a
 * merge, both when the user just presses enter and in non-interactive shells.
 */
export async function chooseStrategy(file: string): Promise<Strategy> {
  if (!stdin.isTTY) {
    return 'merge';
  }
  for (;;) {
    const answer = (
      await ask(`"${file}" was changed since devenv wrote it. [M]erge / [f]orce / [s]kip? `)
    ).toLowerCase();
    if (!answer || answer === 'm' || answer === 'merge') {
      return 'merge';
    }
    if (answer === 'f' || answer === 'force') {
      return 'force';
    }
    if (answer === 's' || answer === 'skip') {
      return 'skip';
    }
    stdout.write('Please answer m, f or s.\n');
  }
}
