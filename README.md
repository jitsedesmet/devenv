# @jitsedesmet/devenv

Publish and sync a personal devcontainer setup across repositories.

The exact `.devcontainer` used in this repository is shipped inside the package,
so a single command drops it into any project and keeps it up to date later.

## Usage

```sh
# Add the devcontainer template to a repository
npx @jitsedesmet/devenv init <name>

# Refresh the template in a repository that already has it
npx @jitsedesmet/devenv update
```

The target directory is the root of the current git repository, or the current
working directory when you are not inside a git repository. You are asked to
confirm before anything is written.

### `init <name>`

Writes `.devcontainer/devcontainer.json` (with `name` set to `<name>`) and
`.devcontainer/Dockerfile`, and records a `.devcontainer/.devenv.lock.json`
snapshot so later updates can tell what you changed.

### `update`

For every managed file:

- **unchanged since devenv wrote it** – refreshed to the new template, keeping
  your project `name`.
- **changed by you** – you are asked how to reconcile it:
  - **M – merge** (default): `devcontainer.json` is merged with recursive
    `{ ...old, ...new }` semantics (your extra keys are kept, the template wins on
    shared keys, your `name` is always preserved). Other files use a git-style
    3-way merge (`git merge-file`); conflicts are written with the usual
    `<<<<<<<` markers instead of prompting.
  - **f – force**: overwrite with the new template (the `name` is still transferred).
  - **s – skip**: leave your file untouched.

### Options

| Option              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `-y`, `--yes`       | Do not ask for confirmation before writing.             |
| `--merge`           | Merge every modified file (non-interactive).            |
| `--force`           | Overwrite every modified file (non-interactive).        |
| `--skip`            | Leave every modified file untouched (non-interactive).  |
| `-h`, `--help`      | Show help.                                              |
| `-v`, `--version`   | Show the devenv version.                                |

## Development

```sh
yarn install
yarn build:ts   # compile src/ -> dist/
yarn test       # run the vitest suite in test/
```

Dependencies are kept current automatically with Renovate.
