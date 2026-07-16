import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'jsonc-parser';
import { isDevcontainerJson, mergeDevcontainer, setName } from './devcontainer.js';
import { writeFile } from './io.js';
import { mergeStrings } from './merge.js';
import { readLock, writeLock } from './manifest.js';
import { devenvVersion } from './paths.js';
import { chooseStrategy, type Strategy } from './prompt.js';
import { resolveName } from './project.js';
import { listTemplates } from './templates.js';

export interface UpdateOptions {
  /** Force a strategy for every modified file instead of prompting. */
  strategy?: Strategy;
  /** Root that holds the `.devcontainer` template. Defaults to the package root. */
  templateRoot?: string;
}

/**
 * Update a repository's devcontainer template. Files the user has not touched
 * since devenv last wrote them are refreshed to the new template (keeping the
 * project name). Files the user modified trigger a merge/force/skip decision.
 */
export async function runUpdate(targetDir: string, options: UpdateOptions = {}): Promise<void> {
  const lock = readLock(targetDir);
  const name = resolveName(targetDir, lock);
  const files: Record<string, string> = {};

  for (const template of listTemplates(options.templateRoot)) {
    const { rel } = template;
    const dest = join(targetDir, rel);
    const theirs = isDevcontainerJson(rel) ? setName(template.content, name) : template.content;

    if (!existsSync(dest)) {
      writeFile(dest, theirs);
      files[rel] = theirs;
      console.log(`  + ${rel} (created)`);
      continue;
    }

    const ours = readFileSync(dest, 'utf8');
    const base = lock?.files?.[rel];
    const modified = base === undefined ? ours !== theirs : ours !== base;

    if (!modified) {
      if (ours !== theirs) {
        writeFile(dest, theirs);
        console.log(`  ~ ${rel} (updated)`);
      } else {
        console.log(`  = ${rel} (up to date)`);
      }
      files[rel] = theirs;
      continue;
    }

    const strategy = options.strategy ?? (await chooseStrategy(rel));

    if (strategy === 'skip') {
      files[rel] = base ?? theirs;
      console.log(`  s ${rel} (skipped)`);
      continue;
    }

    if (strategy === 'force') {
      writeFile(dest, theirs);
      files[rel] = theirs;
      console.log(`  ! ${rel} (forced)`);
      continue;
    }

    if (isDevcontainerJson(rel)) {
      const merged = mergeDevcontainer(ours, parse(theirs), name);
      writeFile(dest, merged);
      files[rel] = theirs;
      console.log(`  m ${rel} (merged)`);
    } else {
      const result = mergeStrings(base ?? theirs, ours, theirs);
      writeFile(dest, result.content);
      files[rel] = theirs;
      console.log(
        `  m ${rel} (merged${result.conflict ? ' with conflicts — please resolve manually' : ''})`,
      );
    }
  }

  writeLock(targetDir, { name, devenvVersion: devenvVersion(), files });
  console.log(`\nUpdated devenv for "${name}".`);
}
