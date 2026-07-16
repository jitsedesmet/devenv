import { applyEdits, modify, parse } from 'jsonc-parser';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

/** True when the managed file is a `devcontainer.json` document. */
export function isDevcontainerJson(rel: string): boolean {
  return rel === '.devcontainer/devcontainer.json' || rel.endsWith('/devcontainer.json');
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Set the `name` field of a devcontainer document while preserving the original
 * comments and formatting (surgical JSONC edit rather than a full re-serialize).
 */
export function setName(content: string, name: string): string {
  return applyEdits(content, modify(content, ['name'], name, FORMATTING));
}

/** Read the `name` field of a devcontainer document, if present. */
export function readName(content: string): string | undefined {
  const value = parse(content) as unknown;
  if (isPlainObject(value) && typeof value['name'] === 'string') {
    return value['name'] as string;
  }
  return undefined;
}

function applyLeafEdits(content: string, value: JsonValue, path: (string | number)[]): string {
  if (isPlainObject(value) && Object.keys(value).length > 0) {
    let next = content;
    for (const key of Object.keys(value)) {
      next = applyLeafEdits(next, value[key] as JsonValue, [...path, key]);
    }
    return next;
  }
  return applyEdits(content, modify(content, path, value, FORMATTING));
}

/**
 * Merge a new devcontainer template into the user's document following the
 * `{ ...old, ...new }` recursive semantics: object keys are merged, arrays and
 * scalars are overridden by the template. The template values are written on top
 * of the user's document so their extra keys, comments and formatting survive.
 * The provided `name` is always transferred onto the result.
 */
export function mergeDevcontainer(oursContent: string, theirs: JsonValue, name: string): string {
  const merged = applyLeafEdits(oursContent, theirs, []);
  return setName(merged, name);
}
