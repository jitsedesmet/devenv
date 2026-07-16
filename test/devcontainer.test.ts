import { describe, it, expect } from 'vitest';
import { parse } from 'jsonc-parser';
import {
  isDevcontainerJson,
  mergeDevcontainer,
  readName,
  readVersion,
  renderDevcontainer,
} from '../src/devcontainer.js';
import { DEVCONTAINER_V1 } from './helpers.js';

function keyOrder(json: string): string[] {
  return [...json.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
}

describe('isDevcontainerJson', () => {
  it('matches the managed devcontainer document', () => {
    expect(isDevcontainerJson('.devcontainer/devcontainer.json')).toBe(true);
    expect(isDevcontainerJson('some/nested/devcontainer.json')).toBe(true);
    expect(isDevcontainerJson('.devcontainer/Dockerfile')).toBe(false);
  });
});

describe('renderDevcontainer', () => {
  it('transfers the name, stamps the version and sorts keys lexicographically', () => {
    const out = renderDevcontainer(DEVCONTAINER_V1, 'my-app', '1.2.3');
    expect(readName(out)).toBe('my-app');
    expect(readVersion(out)).toBe('1.2.3');
    expect(keyOrder(out)).toEqual(['build', 'customizations', 'devenvVersion', 'name', 'remoteUser']);
  });

  it('omits the version key when none is provided and sorts recursively', () => {
    const out = renderDevcontainer('{ "z": { "b": 1, "a": 2 }, "m": 3 }', 'x');
    expect(parse(out)).toEqual({ z: { a: 2, b: 1 }, m: 3, name: 'x' });
    expect(out.indexOf('"a": 2')).toBeLessThan(out.indexOf('"b": 1'));
    expect(keyOrder(out)).toEqual(['m', 'name', 'z']);
  });
});

describe('mergeDevcontainer', () => {
  it('applies { ...old, ...new } recursively, stamps name/version and sorts keys', () => {
    const ours = renderDevcontainer(DEVCONTAINER_V1, 'my-app', '1.0.0')
      .replace('"remoteUser": "node"', '"remoteUser": "root"')
      .replace('"name": "my-app"', '"forwardPorts": [3000],\n  "name": "my-app"');

    const theirs = DEVCONTAINER_V1.replace('"backend": "WebStorm"', '"backend": "IntelliJ"').replace(
      '"remoteUser": "node"',
      '"remoteUser": "node",\n  "updateRemoteUserUID": true',
    );

    const mergedText = mergeDevcontainer(ours, theirs, 'my-app', '2.0.0');
    const merged = parse(mergedText) as Record<string, any>;

    expect(merged['name']).toBe('my-app'); // transferred, not from template
    expect(merged['devenvVersion']).toBe('2.0.0'); // stamped to the new version
    expect(merged['forwardPorts']).toEqual([3000]); // user-only key kept
    expect(merged['remoteUser']).toBe('node'); // template wins on shared key
    expect(merged['customizations'].jetbrains.backend).toBe('IntelliJ');
    expect(merged['updateRemoteUserUID']).toBe(true); // new template key added
    expect(keyOrder(mergedText)).toEqual([
      'build',
      'customizations',
      'devenvVersion',
      'forwardPorts',
      'name',
      'remoteUser',
      'updateRemoteUserUID',
    ]);
  });
});
