import { parse } from 'jsonc-parser';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Key stored in `devcontainer.json` recording the devenv version last applied. */
export const VERSION_KEY = 'devenvVersion';

/** True when the managed file is a `devcontainer.json` document. */
export function isDevcontainerJson(rel: string): boolean {
  return rel.endsWith('/devcontainer.json');
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively sort every object's keys lexicographically (arrays keep order). */
function sortKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isPlainObject(value)) {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

function serialize(value: JsonValue): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function toObject(content: string): Record<string, JsonValue> {
  const value = parse(content) as unknown;
  return isPlainObject(value) ? value : {};
}

/** Read the `name` field of a devcontainer document, if present. */
export function readName(content: string): string | undefined {
  const name = toObject(content)['name'];
  return typeof name === 'string' ? name : undefined;
}

/** Read the recorded devenv version of a devcontainer document, if present. */
export function readVersion(content: string): string | undefined {
  const version = toObject(content)[VERSION_KEY];
  return typeof version === 'string' ? version : undefined;
}

function withMetadata(
  object: Record<string, JsonValue>,
  name: string,
  version: string | undefined,
): Record<string, JsonValue> {
  object['name'] = name;
  if (version !== undefined) {
    object[VERSION_KEY] = version;
  }
  return object;
}

/**
 * Render a devcontainer document: transfer `name`, stamp the devenv `version`,
 * and write it out with keys sorted lexicographically (recursively) using
 * two-space indentation.
 */
export function renderDevcontainer(content: string, name: string, version?: string): string {
  return serialize(withMetadata(toObject(content), name, version));
}

/** Recursive `{ ...old, ...new }`: objects merge, arrays and scalars are replaced. */
function deepMerge(oldValue: JsonValue, newValue: JsonValue): JsonValue {
  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const merged: Record<string, JsonValue> = { ...oldValue };
    for (const key of Object.keys(newValue)) {
      merged[key] =
        key in oldValue ? deepMerge(oldValue[key] as JsonValue, newValue[key] as JsonValue) : newValue[key];
    }
    return merged;
  }
  return newValue;
}

/**
 * Merge a new devcontainer template into the user's document following the
 * `{ ...old, ...new }` recursive semantics: object keys are merged, arrays and
 * scalars are overridden by the template, and any keys unique to the user are
 * kept. The provided `name` and `version` are always stamped onto the result,
 * which is written with keys sorted lexicographically.
 */
export function mergeDevcontainer(
  oursContent: string,
  theirsContent: string,
  name: string,
  version?: string,
): string {
  const merged = deepMerge(toObject(oursContent), toObject(theirsContent)) as Record<string, JsonValue>;
  return serialize(withMetadata(merged, name, version));
}
