import { isDevcontainerJson, setName } from './devcontainer.js';
import { writeFile } from './io.js';
import { writeLock } from './manifest.js';
import { devenvVersion } from './paths.js';
import { listTemplates } from './templates.js';
import { join } from 'node:path';

export interface InitOptions {
  /** Root that holds the `.devcontainer` template. Defaults to the package root. */
  templateRoot?: string;
}

/**
 * Initialise a repository with the devcontainer template, transferring the given
 * project name into `devcontainer.json`.
 */
export function runInit(targetDir: string, name: string, options: InitOptions = {}): void {
  const files: Record<string, string> = {};

  for (const template of listTemplates(options.templateRoot)) {
    const content = isDevcontainerJson(template.rel)
      ? setName(template.content, name)
      : template.content;
    writeFile(join(targetDir, template.rel), content);
    files[template.rel] = content;
    console.log(`  + ${template.rel}`);
  }

  writeLock(targetDir, { name, devenvVersion: devenvVersion(), files });
  console.log(`\nInitialised devenv for "${name}".`);
}
