# Contributing to Second Pass

Thanks for considering a contribution. This is a small project — the contribution surface is intentionally narrow.

## What contributions are most welcome

1. **Compatibility reports.** Tested Second Pass against a skill not in the README compatibility table? Open an issue with the skill name, source repo, output type, and a paragraph on whether the judge grades it sensibly. These reports are the single most valuable contribution.
2. **Skill rule-set translations.** If you maintain a popular skill and want Second Pass to grade it well, the highest-impact thing is making sure your `SKILL.md` clearly describes what success looks like. The judge reads that file. If you want help auditing your skill for "Second-Pass legibility," open an issue.
3. **Bug fixes.** If the loop misbehaves (mis-grading, infinite iteration, status line wrong), file an issue with the exact prompt, skill, output, and observed behavior.
4. **Rubric improvements.** The A–F rubric in `agents/self-judge.md` is a single point of judgment. If you have evidence that a specific clause is mis-grading a class of outputs, propose a change with reasoning.

## What's out of scope (for now)

- Multi-skill orchestration. Tracked as a public issue.
- External-grader (different model judging) support. Tracked as a public issue.
- Per-skill custom rubrics. Deliberately deferred — the universal rubric is the value prop.
- Caching of judge output. Not planned.

## Filing an issue

Use the templates in `.github/ISSUE_TEMPLATE/`. Bug reports need:
- The originating skill name + source link
- The user request that produced the artifact
- The artifact (output) being graded
- Self-judge response (grade + feedback)
- Expected vs actual

## Pull requests

1. Fork, branch, edit, push.
2. Keep the PR scope tight — one change per PR.
3. Update `CHANGELOG.md` under `## [Unreleased]` with a one-line description.
4. If you change rubric behavior, include a before/after example showing the grade shift.
5. Don't break existing slash command interfaces or config schema without a major version bump.

## Code style

- Markdown skill files: keep frontmatter minimal, lead body with overview.
- Slash command `.md` files: imperative voice, terse, do not explain what the skill is.
- JSON config: 2-space indent, no trailing commas.

## Questions

Open a GitHub Discussion (if enabled) or an issue tagged `question`. There is no Discord, no mailing list — keep the conversation in the repo.
