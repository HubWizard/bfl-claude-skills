---
name: second-pass
version: 1.1.0
description: Use when about to return a non-measurable output — writing, proposals, plans, explanations, designs, drafts, or any artifact whose quality is judged rather than tested. Also use when the user says "second pass this", "grade this", "is this good enough?", "self-judge", "iterate on this". Do NOT use for measurable outputs (passing tests, successful deploys, compile output, API 200s). Invoke before delivery to the user, not after.
---

# Second Pass

## Overview

A universal **skill enhancement layer**. Sits over any Claude Code skill, sees what was invoked, the user's input, and the produced output — then judges based on what the skill should have achieved. Returns a grade (A–F) plus concrete drop-in feedback, drives revision (and optionally iterates) until a user-configurable passing bar is met.

The judge is not bound to any single domain. It reads the originating skill's `SKILL.md` on the fly, infers what success looks like for that specific skill, and grades against that. Same mechanism enhances `internal-comms`, `frontend-design`, `writing-plans`, or any community skill — verified across writing, design, code, structural documents, and implementation plans. Non-measurable = quality is a judgment call, not a pass/fail check.

## When to use

Invoke automatically — no user prompt needed — whenever all three are true:

1. You just produced an output as the final step of a task.
2. The output is non-measurable: quality is judged, not tested.
3. You were about to return it to the user.

When in doubt: if you cannot name a concrete pass/fail check for the output, invoke.

## The loop

1. Read config at `~/.claude/second-pass/config.json`. Defaults: `passing_grade: B`, `iteration_cap: 3`, `confirm_revisions: false`.
2. Emit status line: `Second Pass [attempt 1/MAX]: grading output...`
3. Spawn the `self-judge` subagent (`agents/self-judge.md`) with: skill(s) used, user request, output.
4. Receive grade (A–F) + concrete feedback.
5. Decide:
   - **Grade meets bar** → deliver with grade attached.
   - **Below bar, `confirm_revisions: false`** (default) → apply feedback once, deliver the revised output with `(revised, original grade: X)` attached. **No re-judge.** Trust the judge's feedback.
   - **Below bar, `confirm_revisions: true`** → apply feedback, increment attempt, loop from step 2 until bar met or cap hit.
   - **Cap hit** → deliver best attempt with "hit iteration cap" note.

The rubric lives in `agents/self-judge.md`. Grades are grounded in skill intent and user request, not taste.

### Why no re-judge by default

A re-judge after revision typically doubles token cost for marginal confidence: the judge already gave specific drop-in replacements; trust them. Set `confirm_revisions: true` for high-stakes artifacts where you want the loop to verify the lift.

## Quick reference

| When | Action |
|------|--------|
| About to return writing, proposal, plan, explanation, draft | Invoke |
| Test passed, deploy succeeded, compile/lint output, API 200 | Skip — measurable |
| Judgment call on "is it good?" | Invoke |

| Config key | Default | Slash command |
|------------|---------|---------------|
| `passing_grade` | `B` | `/second-pass:passing-grade <A-F>` |
| `iteration_cap` | `3` | `/second-pass:iteration-cap <n>` |
| `confirm_revisions` | `false` | `/second-pass:confirm-revisions <true\|false>` |
| (preset: A bar, cap 5, confirm) | — | `/second-pass:strict` |
| (preset: C bar, cap 2, no confirm) | — | `/second-pass:lenient` |
| (reset all) | — | `/second-pass:reset` |

| Status line | When to emit |
|-------------|--------------|
| `Second Pass [attempt N/MAX]: grading output...` | Start of each attempt |
| `Second Pass [attempt N/MAX]: grade X, revising...` | Below bar, iterating (confirm mode only) |
| `Second Pass [attempt 1/1]: grade X, applying feedback once...` | Below bar, single-shot revise mode |
| `Second Pass passed at attempt N/MAX (grade X).` | Bar met, delivering |
| `Second Pass revised (original grade X). Shipping without re-judge.` | Single-shot revise complete |
| `Second Pass hit iteration cap. Best grade: X (bar: Y).` | Cap reached |

## Common mistakes

- **Firing on measurable output.** Test results, deploy logs, compile errors have pass/fail criteria. Skip.
- **Skipping "just this once."** Consistency is the point. Skipping for convenience is exactly the behavior this skill prevents.
- **Using the subagent to rewrite.** Self-judge flags and suggests; the calling agent revises. Don't shortcut.
- **Shipping the original unchanged with a grade tag.** If the grade is below bar, actually revise before delivering.
- **Treating B-at-bar-A as passing.** B < A. Revise.

## Red flags — STOP and invoke anyway

- "This output is simple enough to ship."
- "I'll run Second Pass next time."
- "It's mostly measurable, close enough."
- "The user is in a hurry."
- "Grade B is fine even at bar A."

All of these mean: invoke Second Pass now.

## What this skill does NOT do

- Does not generate content — only grades existing outputs and drives revision.
- Does not rewrite unilaterally — it returns feedback; the calling agent revises.
- Does not cache rules per target skill — grades from intent on the fly.
- Does not fire on measurable outputs.
- Does not require user invocation — auto-triggers.
