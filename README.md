# bfl-claude-skills

A collection of Claude Code skills, in one place. Each subfolder is a
self-contained skill you can drop straight into `~/.claude/skills/`.

Skills are also mirrored as standalone repos (linked below) in case you
just want one of them without cloning the whole collection.

## Skills

| Skill | What it does | Standalone repo |
|---|---|---|
| [`second-pass/`](second-pass) | Self-judging revision loop for non-measurable outputs (writing, proposals, plans) — grades a draft, revises if it doesn't clear the bar, repeats up to a cap. | [HubWizard/second-pass](https://github.com/HubWizard/second-pass) |
| [`session-handoff/`](session-handoff) | Auto-handoff to a fresh Claude Code session when context usage crosses a threshold — writes a handoff doc, spawns a new session, no lost instructions from compaction. | [HubWizard/bfl-handoffskill](https://github.com/HubWizard/bfl-handoffskill) |

## Install

Each skill folder has its own README/SKILL.md with install steps. In
general: copy the skill's directory into `~/.claude/skills/<name>/`, and
if it ships a hook (like `session-handoff`), follow that skill's README to
wire it into `~/.claude/settings.json`.

```
cp -r second-pass ~/.claude/skills/second-pass
cp -r session-handoff/session-handoff ~/.claude/skills/session-handoff
cp session-handoff/hooks/context-handoff-monitor.js ~/.claude/hooks/
```

Then follow [`session-handoff/README.md`](session-handoff/README.md) to
register the hook.
