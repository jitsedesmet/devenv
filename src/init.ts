import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDevcontainerJson, renderDevcontainer } from './devcontainer.js';
import { writeFile } from './io.js';
import { devenvVersion } from './paths.js';
import { listTemplates } from './templates.js';

export interface InitOptions {
  /** Root that holds the `.devcontainer` template. Defaults to the package root. */
  templateRoot?: string;
  /** devenv version to stamp into `devcontainer.json`. Defaults to the running version. */
  version?: string;
}

/**
 * Initialise a repository with the devcontainer template, transferring the given
 * project name into `devcontainer.json` and stamping the devenv version.
 *
 * Refuses to touch anything if any of the files it would create already exist,
 * pointing the user at `update` instead.
 */
export function runInit(targetDir: string, name: string, options: InitOptions = {}): void {
  const templates = listTemplates(options.templateRoot);
  const version = options.version ?? devenvVersion();

  const existing = templates.map((t) => t.rel).filter((rel) => existsSync(join(targetDir, rel)));
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
    writeFile(join(targetDir, template.rel), content);
    console.log(`  + ${template.rel}`);
  }

  console.log(`\nInitialised devenv for "${name}".`);
}
