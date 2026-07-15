# Changelog

All notable changes to Second Pass are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-04-29

### Positioning
Second Pass is now framed as a **universal skill enhancement layer** — not a writing critic. It sees the skill, the input, the output, and judges what the skill should have achieved. Same mechanism for any skill whose output is judged rather than tested. README and SKILL.md overview rewritten to lead with this. Verified across 6 tests covering 5 distinct output types: strict-format text (internal-comms), personal voice writing (custom voice skill), HTML/CSS code (frontend-design), structural document (skill-creator), implementation plan (writing-plans), and a calibration control on already-A output.

### Added
- `confirm_revisions` config field (default `false`) — controls whether revisions are re-judged in a loop or shipped after one pass.
- `/second-pass:confirm-revisions <true|false>` slash command.
- `/second-pass:strict` preset — bar A, cap 5, confirm-revisions on. One-shot strict mode for high-stakes artifacts.
- `/second-pass:lenient` preset — bar C, cap 2, confirm-revisions off. One-shot lenient mode for quick drafts.
- Skill compatibility table in README listing high-value pairings (`anthropics/skills`, `obra/superpowers`, ComposioHQ awesome-list) and skills to skip.

### Changed
- Default behavior: when a baseline grades below bar, Second Pass now applies the judge's feedback once and ships, without re-judging. Re-judge loop is opt-in via `confirm_revisions: true`. Saves ~30k tokens per revision in the common case.
- New status line `Second Pass revised (original grade X). Shipping without re-judge.` reflects single-shot mode.
- `/second-pass:reset` now also restores `confirm_revisions: false` alongside the other defaults.

### Why
Test against `anthropics/skills:internal-comms` showed re-judge added ~30k tokens for marginal confidence (judge grades own revision, near-zero false-negative rate on its own feedback). Default flipped to ship-after-one-pass; confirm mode preserved as opt-in for proposals and public-facing copy.

## [1.0.0] — 2026-04-24

Initial public release.

### Added
- Self-judge subagent (`agents/self-judge.md`) that grades non-measurable outputs on a universal A–F rubric, grounded in the originating skill's intent and the user's request.
- Auto-trigger behavior — Claude invokes Second Pass automatically before returning any non-measurable artifact (writing, proposals, plans, explanations, designs, drafts).
- Iteration loop with user-visible status lines: `Second Pass [attempt N/MAX]: grading output...`, `grade X, revising...`, `passed at attempt N/MAX (grade X)`, `hit iteration cap`.
- `/second-pass:passing-grade <A|B|C|D|F>` — set the passing bar. Default `B`.
- `/second-pass:iteration-cap <positive integer>` — set max revision attempts. Default `3`. Cap of 1 disables iteration.
- `/second-pass:reset` — restore all settings to defaults.
- Config file at `~/.claude/second-pass/config.json` with defaults `{passing_grade: B, iteration_cap: 3}`.
- Example config files under `examples/` showing strict, default, and lenient setups.
- README with install, configuration, optional CLAUDE.md reinforcement, and what-it-does-not-do.
- MIT license.
