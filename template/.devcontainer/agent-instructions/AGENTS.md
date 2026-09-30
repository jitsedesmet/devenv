# Attribution

Your work is published as the developer's own, so never list yourself or any AI
tool as an author or contributor.

- Commits: no `Co-authored-by:` trailers for yourself or any AI tool.
- Commit with the configured git identity: don't change `user.name` /
  `user.email`, pass `--author` or set `GIT_AUTHOR_*` / `GIT_COMMITTER_*`. If
  none is configured, ask the developer.
- Don't bypass the commit-msg hook (e.g. `git commit --no-verify`).

"Generated with …" remarks are fine.
