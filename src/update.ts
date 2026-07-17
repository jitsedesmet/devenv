import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isDevcontainerJson,
  mergeDevcontainer,
  readVersion,
  renderDevcontainer,
} from './devcontainer.js';
import { writeFile } from './io.js';
import { mergeStrings } from './merge.js';
import { devenvVersion } from './paths.js';
import { chooseStrategy, type Strategy } from './prompt.js';
import { resolveName } from './project.js';
import { resolveWithin } from './safety.js';
import { resolveBase, resolveTemplates } from './versions.js';

export interface UpdateOptions {
  /** Force a strategy for every modified file instead of prompting. */
  strategy?: Strategy;
  /** devenv version to update to (selects the shipped snapshot). Defaults to the running version. */
  version?: string;
  /** Root that holds the versioned snapshots. Defaults to the package root's `versions/`. */
  versionsRoot?: string;
}

/**
 * Update a repository's devcontainer template. Both the new template and the
 * 3-way merge base come from the shipped `versions/` snapshots — the base is the
 * one matching the `devenvVersion` recorded in the project's `devcontainer.json`,
 * so no per-project state is stored outside the repo.
 *
 * Files the user has not touched since devenv wrote them are refreshed to the
 * new template (keeping the project name); files the user modified trigger a
 * merge/force/skip decision.
 */
export async function runUpdate(targetDir: string, options: UpdateOptions = {}): Promise<void> {
  const name = resolveName(targetDir);
  const version = options.version ?? devenvVersion();

  const templates = resolveTemplates(version, options.versionsRoot);
  if (!templates) {
    throw new Error(`No template snapshot is shipped for version ${version}.`);
  }

  const devcontainerPath = join(targetDir, '.devcontainer/devcontainer.json');
  const baseVersion = existsSync(devcontainerPath)
    ? readVersion(readFileSync(devcontainerPath, 'utf8'))
    : undefined;
  const base = resolveBase(baseVersion, options.versionsRoot);

  for (const template of templates) {
    const { rel } = template;
    const dest = resolveWithin(targetDir, rel);
    const isJson = isDevcontainerJson(rel);
    const theirs = isJson ? renderDevcontainer(template.content, name, version) : template.content;

    if (!existsSync(dest)) {
      writeFile(dest, theirs);
      console.log(`  + ${rel} (created)`);
      continue;
    }

    const ours = readFileSync(dest, 'utf8');
    const baseRaw = base?.get(rel);
    const baseContent =
      baseRaw === undefined ? undefined : isJson ? renderDevcontainer(baseRaw, name, baseVersion) : baseRaw;
    const modified = baseContent === undefined ? ours !== theirs : ours !== baseContent;

    if (!modified) {
      if (ours !== theirs) {
        writeFile(dest, theirs);
        console.log(`  ~ ${rel} (updated)`);
      } else {
        console.log(`  = ${rel} (up to date)`);
      }
      continue;
    }

    const strategy = options.strategy ?? (await chooseStrategy(rel));

    if (strategy === 'skip') {
      console.log(`  s ${rel} (skipped)`);
      continue;
    }

    if (strategy === 'force') {
      writeFile(dest, theirs);
      console.log(`  ! ${rel} (forced)`);
      continue;
    }

    if (isJson) {
      writeFile(dest, mergeDevcontainer(ours, theirs, name, version));
      console.log(`  m ${rel} (merged)`);
    } else {
      // With no shipped base snapshot we cannot tell the user's edits from the
      // upstream ones, so merge against an empty base: this never drops upstream
      // lines, it surfaces them as a conflict for the user to reconcile.
      const result = mergeStrings(baseContent ?? '', ours, theirs);
      writeFile(dest, result.content);
      if (result.failed) {
        console.log(`  m ${rel} (unchanged — git unavailable, could not merge)`);
      } else {
        console.log(
          `  m ${rel} (merged${result.conflict ? ' with conflicts — please resolve manually' : ''})`,
        );
      }
    }
  }

  console.log(`\nUpdated devenv for "${name}".`);
}
