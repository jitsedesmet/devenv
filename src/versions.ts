import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packageRoot } from './paths.js';
import { listTemplates, type Template } from './templates.js';

/** Directory (under the package root) that holds versioned template snapshots. */
export function versionsRoot(root: string = packageRoot()): string {
  return join(root, 'versions');
}

/** Compare two dotted numeric versions. Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

/** List the snapshot versions shipped in the package, oldest first. */
export function availableVersions(root: string = versionsRoot()): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareVersions);
}

/**
 * Pick the snapshot directory name to use for `version`: the exact match if it
 * exists, otherwise the newest snapshot that is not newer than `version`.
 */
export function pickVersion(version: string | undefined, root: string = versionsRoot()): string | undefined {
  if (!version) {
    return undefined;
  }
  const versions = availableVersions(root);
  if (versions.includes(version)) {
    return version;
  }
  let chosen: string | undefined;
  for (const candidate of versions) {
    if (compareVersions(candidate, version) <= 0) {
      chosen = candidate;
    }
  }
  return chosen;
}

/** Resolve the template files shipped for `version`, or `undefined` if none fit. */
export function resolveTemplates(
  version: string | undefined,
  root: string = versionsRoot(),
): Template[] | undefined {
  const chosen = pickVersion(version, root);
  return chosen ? listTemplates(join(root, chosen)) : undefined;
}

/**
 * Resolve the base template snapshot for a project that was last written by
 * `version`, as a map of repo-relative path to raw template content. Returns
 * `undefined` when no suitable snapshot is shipped.
 */
export function resolveBase(
  version: string | undefined,
  root: string = versionsRoot(),
): Map<string, string> | undefined {
  const templates = resolveTemplates(version, root);
  return templates ? new Map(templates.map((template) => [template.rel, template.content])) : undefined;
}
