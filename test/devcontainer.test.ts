import { describe, it, expect } from 'vitest';
import { parse } from 'jsonc-parser';
import {
  isDevcontainerJson,
  mergeDevcontainer,
  readName,
  setName,
} from '../src/devcontainer.js';
import { DEVCONTAINER_V1 } from './helpers.js';

describe('isDevcontainerJson', () => {
  it('matches the managed devcontainer document', () => {
    expect(isDevcontainerJson('.devcontainer/devcontainer.json')).toBe(true);
    expect(isDevcontainerJson('.devcontainer/Dockerfile')).toBe(false);
  });
});

describe('setName / readName', () => {
  it('sets the name while preserving comments and formatting', () => {
    const out = setName(DEVCONTAINER_V1, 'my-app');
    expect(readName(out)).toBe('my-app');
    // The leading JSONC comment must survive the surgical edit.
    expect(out).toContain('// See https://containers.dev/');
  });
});

describe('mergeDevcontainer', () => {
  it('applies { ...old, ...new } recursively and transfers the name', () => {
    const ours = setName(DEVCONTAINER_V1, 'my-app')
      .replace('"remoteUser": "node"', '"remoteUser": "root"')
      .replace('"name": "my-app",', '"name": "my-app",\n  "forwardPorts": [3000],');

    const theirs = parse(
      DEVCONTAINER_V1.replace('"backend": "WebStorm"', '"backend": "IntelliJ"').replace(
        '"remoteUser": "node",',
        '"remoteUser": "node",\n  "updateRemoteUserUID": true,',
      ),
    );

    const merged = parse(mergeDevcontainer(ours, theirs, 'my-app')) as Record<string, unknown>;

    // name is transferred from the target, not the template.
    expect(merged['name']).toBe('my-app');
    // user-only key survives.
    expect(merged['forwardPorts']).toEqual([3000]);
    // template wins on shared scalar keys.
    expect(merged['remoteUser']).toBe('node');
    expect((merged['customizations'] as any).jetbrains.backend).toBe('IntelliJ');
    // brand new template key is added.
    expect(merged['updateRemoteUserUID']).toBe(true);
  });
});
