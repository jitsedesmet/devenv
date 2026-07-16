import { describe, it, expect } from 'vitest';
import { mergeStrings } from '../src/merge.js';
import { DOCKERFILE_V1 } from './helpers.js';

describe('mergeStrings (git 3-way merge)', () => {
  it('merges non-overlapping changes from both sides without losing lines', () => {
    const base = DOCKERFILE_V1;
    const ours = base.replace('ENV DEVCONTAINER=true', 'ENV DEVCONTAINER=true\nENV MY_CUSTOM=1');
    const theirs = base.replace('less man-db sudo curl nano', 'less man-db sudo curl nano git');

    const { content, conflict } = mergeStrings(base, ours, theirs);

    expect(conflict).toBe(false);
    // Regression: an unchanged line near repeated prefixes must not be dropped.
    expect(content).toContain("git config --global alias.gitm 'commit -am'");
    // User change kept.
    expect(content).toContain('ENV MY_CUSTOM=1');
    // Upstream change applied.
    expect(content).toContain('less man-db sudo curl nano git');
  });

  it('emits git-style conflict markers when both sides change the same line', () => {
    const base = DOCKERFILE_V1;
    const ours = base.replace('curl nano', 'curl nano htop');
    const theirs = base.replace('curl nano', 'curl nano git');

    const { content, conflict } = mergeStrings(base, ours, theirs);

    expect(conflict).toBe(true);
    expect(content).toContain('<<<<<<<');
    expect(content).toContain('>>>>>>>');
  });

  it('is a no-op when neither side changed', () => {
    const { content, conflict } = mergeStrings(DOCKERFILE_V1, DOCKERFILE_V1, DOCKERFILE_V1);
    expect(conflict).toBe(false);
    expect(content).toBe(DOCKERFILE_V1);
  });
});
