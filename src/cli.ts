#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import { findTargetDir, devenvVersion } from './paths.js';
import { confirm } from './prompt.js';
import { runInit } from './init.js';
import { runUpdate } from './update.js';
import { resolveStrategy } from './prompt.js';

const HELP = `devenv — publish and sync a personal devcontainer setup

Usage:
  npx @jitsedesmet/devenv init <name>   Add the devcontainer template to a repo
  npx @jitsedesmet/devenv update        Refresh the template in an existing repo

Options:
  -y, --yes      Do not ask for confirmation before writing
      --merge    On update, merge every modified file (default when prompted)
      --force    On update, overwrite every modified file with the new template
      --skip     On update, leave every modified file untouched
  -h, --help     Show this help
  -v, --version  Show the devenv version

The target directory is the root of the current git repository, or the current
working directory when it is not a git repository.`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y', default: false },
      merge: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      skip: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });

  if (values.version) {
    console.log(devenvVersion());
    return 0;
  }

  const command = positionals[0];

  if (values.help) {
    console.log(HELP);
    return 0;
  }

  if (!command) {
    console.error(HELP);
    return 1;
  }

  if (command !== 'init' && command !== 'update') {
    console.error(`Unknown command "${command}".\n`);
    console.error(HELP);
    return 1;
  }

  const { dir, isGitRoot } = findTargetDir();
  const location = isGitRoot ? `git repository root ${dir}` : `current directory ${dir}`;

  if (command === 'init') {
    const name = positionals[1] ?? basename(dir);
    const ok = values.yes || (await confirm(`Initialise devenv for "${name}" in the ${location}?`));
    if (!ok) {
      console.log('Aborted.');
      return 1;
    }
    runInit(dir, name);
    return 0;
  }

  const ok = values.yes || (await confirm(`Update devenv in the ${location}?`));
  if (!ok) {
    console.log('Aborted.');
    return 1;
  }
  await runUpdate(dir, { strategy: resolveStrategy(values) });
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
