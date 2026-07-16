import { existsSync } from 'node:fs';
import { isDevcontainerJson, renderDevcontainer } from './devcontainer.js';
import { writeFile } from './io.js';
import { devenvVersion } from './paths.js';
import { resolveWithin } from './safety.js';
import { resolveTemplates } from './versions.js';

export interface InitOptions {
  /** devenv version to install (selects the shipped snapshot). Defaults to the running version. */
  version?: string;
  /** Root that holds the versioned snapshots. Defaults to the package root's `versions/`. */
  versionsRoot?: string;
}

/**
 * Initialise a repository with the devcontainer template, transferring the given
 * project name into `devcontainer.json` and stamping the devenv version.
 *
 * Refuses to touch anything if any of the files it would create already exist,
 * pointing the user at `update` instead.
 */
export function runInit(targetDir: string, name: string, options: InitOptions = {}): void {
  const version = options.version ?? devenvVersion();
  const templates = resolveTemplates(version, options.versionsRoot);
  if (!templates) {
    throw new Error(`No template snapshot is shipped for version ${version}.`);
  }

  const existing = templates.map((t) => t.rel).filter((rel) => existsSync(resolveWithin(targetDir, rel)));
  if (existing.length > 0) {
    throw new Error(
      `Refusing to init: the following file(s) already exist:\n` +
        existing.map((rel) => `  - ${rel}`).join('\n') +
        `\nNothing was written. Run "npx @jitsedesmet/devenv update" to update an existing setup instead.`,
    );
  }

  for (const template of templates) {
    const content = isDevcontainerJson(template.rel)
      ? renderDevcontainer(template.content, name, version)
      : template.content;
    writeFile(resolveWithin(targetDir, template.rel), content);
    console.log(`  + ${template.rel}`);
  }

  console.log(`\nInitialised devenv for "${name}".`);
}
