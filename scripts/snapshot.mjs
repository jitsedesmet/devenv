// Snapshot the current `.devcontainer` template into `versions/<version>/` so it
// can serve as the 3-way merge base for projects still on that version. Run
// automatically by the `version` npm lifecycle; can also be run manually.
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_ONLY_DIRS } from './runtime-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const source = join(root, '.devcontainer');
const destination = join(root, 'versions', version, '.devcontainer');

function copyTree(from, to) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    // Skip only the runtime-only bind-mount dirs; every other file (including
    // regular dot files) is part of the template and must be shipped.
    if (RUNTIME_ONLY_DIRS.includes(entry.name)) {
      continue;
    }
    const fromPath = join(from, entry.name);
    const toPath = join(to, entry.name);
    if (entry.isDirectory()) {
      copyTree(fromPath, toPath);
    } else if (entry.isFile()) {
      mkdirSync(dirname(toPath), { recursive: true });
      copyFileSync(fromPath, toPath);
    }
  }
}

mkdirSync(destination, { recursive: true });
copyTree(source, destination);
console.log(`Snapshotted .devcontainer -> versions/${version}`);
