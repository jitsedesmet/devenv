# @jitsedesmet/devenv

A [Copier](https://copier.readthedocs.io/) template that publishes a personal
`.devcontainer` setup and keeps it in sync across repositories.

This setup sandboxes agentic coding tools so you can run them in yolo mode without them touching your host system.

The exact `.devcontainer` used for my projects lives in `template/`, so a single
command drops it into any project and `copier update` later reconciles your local
tweaks with new template versions using a git-style 3-way merge.

## Requirements

- [Copier](https://copier.readthedocs.io/en/latest/#installation) 9 or newer
  (`pipx install copier` / `uv tool install copier` / `brew install copier`)
- Git 2.27 or newer

## Usage

### Add the devcontainer to a repository

```sh
# Run from the root of the target repository
copier copy gh:jitsedesmet/devenv .
```

You are asked for:

- `name` — the devcontainer name shown in your editor / IDE; defaults to the
  target directory name.
- `setup_type` — `node` (default) or `java`. This picks the base image and
  toolchain; everything else (sudo access, the `claude`/`copilot` CLIs, the
  `gitm`/`claude-yolo`/`copilot-yolo` shortcuts) is identical between the two. The `java` setup targets JDK 21 +
  Maven, i.e. what you need to build [Apache Jena](https://github.com/apache/jena)
  — it does not clone Jena or fetch its dependencies, it just gets the tooling
  in place.
- `git_user_name` / `git_user_email` — the identity written to the container's
  global git config (`user.name` / `user.email`), so every commit made inside
  it — yours or an agent's — is authored by you. Leave either empty to skip it
  and configure git yourself. Both are recorded in `.copier-answers.yml` like
  every other answer, so for a public repository consider your GitHub noreply
  address (`<id>+<username>@users.noreply.github.com`).

Copier writes:

- `.devcontainer/devcontainer.json` — with `name` filled in
- `.devcontainer/Dockerfile`
- `.devcontainer/git-hooks/commit-msg` — strips AI attribution from commits (see below)
- `.devcontainer/agent-instructions/AGENTS.md` — tells the agents not to
  attribute their work to themselves (see below)
- `.copier-answers.yml` — records the template version and your answers so future
  updates know where you started. **Do not edit it by hand.**

Copier refuses to overwrite existing files unless you pass `--force`, so it is safe
to run in a populated repository.

Use `--defaults` to accept every default without prompting (handy in CI / scripts).

### Refresh the template later

```sh
# Run from the root of a repository that was created with this template
copier update
```

Copier checks out the newest release tag of the template, replays your recorded
answers, and merges the new template into your project:

- Files you never touched are refreshed to the new template.
- Files you changed are merged with the upstream changes. Non-overlapping edits are
  combined automatically; overlapping edits are surfaced as conflicts.

Conflicts are written inline with the usual `<<<<<<<` / `=======` / `>>>>>>>`
markers (`--conflict inline`, the default). Pass `--conflict rej` to get `.rej`
files instead. Review and resolve conflicts before committing — a
[pre-commit](https://pre-commit.com/) `check-merge-conflict` hook is recommended.

## How it works

- `copier.yml` declares the questions (`name`, `setup_type`, `git_user_name`
  and `git_user_email`) and points Copier
  at the `template/` subdirectory via `_subdirectory`. A hidden value,
  `container_user`, is derived from `setup_type` (`node` for the Node.js setup,
  `ubuntu` for the Java one — its base image ships its own ready-made UID/GID
  1000 user, just under that name) and used by the templates below so they
  only need to key off one thing.
- Everything under `template/` is rendered into the target project. Only files
  ending in `.jinja` are processed as templates (the suffix is stripped).
- `template/.devcontainer/Dockerfile.jinja` branches on `setup_type` to pick the
  base image and its install step (`node:22`, or `maven:3.9-eclipse-temurin-21`
  for JDK 21 + Maven); the rest — sudo access, the `claude`/`copilot` CLI
  installs, the `gitm`/`claude-yolo`/`copilot-yolo` shortcuts, the git
  identity from `git_user_name`/`git_user_email` — is shared between both branches.
- `template/.devcontainer/devcontainer.json.jinja` injects your `name`, the
  `container_user`-based paths/`remoteUser`, and a matching JetBrains backend
  (WebStorm for Node.js, IntelliJ for Java). The `${localWorkspaceFolder}` mount
  variables are left untouched because Copier uses `{{ ... }}` delimiters.
- `template/{{_copier_conf.answers_file}}.jinja` renders the `.copier-answers.yml`
  file that powers `copier update`.

## No AI attribution

Claude Code and Copilot CLI both add attribution to the commits they make, which
makes "Claude" and "Copilot" show up in GitHub's contributor list, and tend to
sign PR descriptions and comments too. Work done in this container is yours, so
it suppresses this in three ways:

- **Claude Code managed settings.** The Dockerfile writes
  `/etc/claude-code/managed-settings.json` with
  `{"attribution": {"commit": "", "pr": ""}, "includeCoAuthoredBy": false}`
  (`includeCoAuthoredBy` is deprecated, but older CLI versions still read it).
  The system-wide managed path is used instead of `~/.claude/settings.json`
  because `~/.claude` is bind-mounted per project from `.devcontainer/.claude`,
  which would shadow anything baked into the image.
- **A global `commit-msg` hook.** Copilot CLI has no opt-out setting, so
  `template/.devcontainer/git-hooks/commit-msg` is copied to
  `/usr/local/share/git-hooks/` and enabled with
  `git config --global core.hooksPath`. It removes `Co-authored-by:` trailers
  for `…+Copilot@users.noreply.github.com` and `…@anthropic.com` addresses and
  the "🤖 Generated with [Claude Code]" footer, then trims trailing blank lines.
  Human `Co-authored-by:` and `Signed-off-by:` trailers are kept. Because a
  global `core.hooksPath` disables a repository's own `.git/hooks`, the hook
  chains to the repo's `commit-msg` hook when one is present and executable.
- **Instructions to the agents.** The two mechanisms above only cover commit
  trailers and Claude's PR footer, so
  `template/.devcontainer/agent-instructions/AGENTS.md` spells the rule out for
  the agents themselves: no AI co-author trailers or "Generated with" lines in
  commits, PRs, issues, reviews, comments, code or docs; commit with the
  configured git identity rather than an AI one (never `--author`, never
  changing `user.name`/`user.email`); and don't skip the hook with
  `--no-verify`. The Dockerfile installs it as Claude Code's managed
  `/etc/claude-code/CLAUDE.md`, which loads in every session and can't be
  excluded, and points Copilot CLI at it through
  `COPILOT_CUSTOM_INSTRUCTIONS_DIRS=/usr/local/share/agent-instructions`
  (again avoiding the bind-mounted `~/.claude` and `~/.copilot`).

Limitations:

- `git commit --no-verify` skips the hook.
- The agent instructions are guidance, not enforcement: they cover PR
  descriptions and comments that no hook can see, but an agent can still
  ignore them.
- A repo-local `core.hooksPath` (e.g. set by Husky) overrides the global one,
  so the hook doesn't run in such repositories.
- Commits made by Copilot's cloud agent on github.com, and PR descriptions
  written by Copilot, are not affected.
- Existing history is not rewritten.

## Development

The template content lives in `template/`. To try changes locally:

```sh
# Render into a scratch directory
copier copy --defaults --vcs-ref=HEAD . /tmp/devenv-test
```

`--vcs-ref=HEAD` renders the current commit instead of the latest tag, which is
useful while iterating.

## Releasing

Copier selects the newest git tag that is a valid
[PEP 440](https://peps.python.org/pep-0440/) version. To publish a new template
version, commit your changes and push an annotated tag:

```sh
git tag -a 1.2.0 -m "1.2.0"
git push --follow-tags
```

Consumers pick it up the next time they run `copier update`.

Dependencies referenced by the template (e.g. the Docker base image) are kept
current automatically with Renovate.
