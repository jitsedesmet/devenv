import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from '../src/io.js';

/** Create a throwaway directory that is cleaned up by `cleanup()`. */
export function tempDir(prefix = 'devenv-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanup(...dirs: string[]): void {
  for (const dir of dirs) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface TemplateFiles {
  devcontainer: string;
  dockerfile: string;
}

/** Write a `.devcontainer` template into `root` and return that root. */
export function writeTemplate(root: string, files: TemplateFiles): string {
  writeFile(join(root, '.devcontainer/devcontainer.json'), files.devcontainer);
  writeFile(join(root, '.devcontainer/Dockerfile'), files.dockerfile);
  return root;
}

export const DEVCONTAINER_V1 = `// See https://containers.dev/ for configuration reference
{
  "name": "template",
  "build": {
    "dockerfile": "Dockerfile"
  },
  "remoteUser": "node",
  "customizations": {
    "jetbrains": {
      "backend": "WebStorm"
    }
  }
}
`;

export const DOCKERFILE_V1 = `FROM node:22

RUN apt update && apt install -y less man-db sudo curl nano

ENV DEVCONTAINER=true

USER node
RUN git config --global alias.gitm 'commit -am' \\
    && git config --global push.autoSetupRemote true \\
    && git config --global core.editor nano
USER root
`;
