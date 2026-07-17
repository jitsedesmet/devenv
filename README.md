# @jitsedesmet/devenv

Publish and sync a personal devcontainer setup across repositories.

The exact `.devcontainer` used in this repository is shipped inside the package,
so a single command drops it into any project and keeps it up to date later.

## Usage

```sh
# Add the devcontainer template to a repository
npx @jitsedesmet/devenv init [name]

# Refresh the template in a repository that already has it
npx @jitsedesmet/devenv update
```

The target directory is the root of the current git repository, or the current
working directory when you are not inside a git repository. You are asked to
confirm before anything is written; in a non-interactive shell (no TTY) devenv
proceeds with its defaults (confirm → yes, and modified files → merge) unless you
pass an explicit strategy flag.

### `init [name]`

Writes every file shipped in the template snapshot — currently
`.devcontainer/devcontainer.json` (with `name` set to `[name]`) and
`.devcontainer/Dockerfile` — and stamps a `devenvVersion` field into
`devcontainer.json` recording which template version was applied. When `name` is
omitted it defaults to the target directory's name.

If any file it would create already exists, `init` writes nothing and asks you
to run `update` instead.

`devcontainer.json` is always written canonically: keys are sorted
lexicographically (recursively) with two-space indentation, so comments and
custom key ordering are normalized.

### `update`

devenv keeps **no per-project state file** — everything it needs is discovered
from the repository itself (your files and the `devenvVersion` stamped in
`devcontainer.json`). The 3-way merge *base* is the template snapshot for that
recorded version, which is shipped inside the package (`versions/<version>/`).

For every managed file:

- **unchanged since devenv wrote it** – refreshed to the new template, keeping
  your project `name`, and the `devenvVersion` is bumped.
- **changed by you** – you are asked how to reconcile it:
  - **M – merge** (default): `devcontainer.json` is merged with recursive
    `{ ...old, ...new }` semantics (your extra keys are kept, the template wins on
    shared keys, your `name` is always preserved) and re-written with keys sorted
    lexicographically. Other files use a git-style 3-way merge (`git merge-file`)
    against the shipped base snapshot; conflicts are written with the usual
    `<<<<<<<` markers instead of prompting.
  - **f – force**: overwrite with the new template (the `name` is still transferred).
  - **s – skip**: leave your file untouched (its `devenvVersion` stays as-is).

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
yarn snapshot   # copy the current .devcontainer into versions/<version>/
```

Each published version's template is snapshotted under `versions/<version>/`
(done automatically by the `version` npm lifecycle) so it can serve as the merge
base for projects still on that version.

Dependencies are kept current automatically with Renovate.
