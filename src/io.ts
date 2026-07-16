import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Write a file, creating parent directories as needed. */
export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
