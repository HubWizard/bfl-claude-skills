# Second Pass

**A universal skill enhancement layer.** Sees the skill being invoked, the user's input, the produced output — and judges based on what the skill should have achieved. Returns a grade and concrete feedback, drives a revision loop, ships a better artifact.

Works across **any** Claude Code skill whose output is judged rather than tested. The judge is not bound to a single domain — it reads the originating skill's `SKILL.md` on the fly, infers what success looks like for that specific skill, and grades against that intent. Designed and tested for writing, design, planning, structural documents, and code.

## What problem it solves

Most Claude Code skills produce outputs that have no automatic quality floor. A test either passes or fails, a deploy either succeeds or fails — those are measurable. But a LinkedIn post, a proposal, an implementation plan, a designed landing page, a SKILL.md you just authored, an architecture write-up — those are judged, not tested. If the skill produces a weak output on the first pass, the user ships the weak output.

The naive fix is to write a critic for each skill: a writing critic, a design critic, a plan critic. That doesn't scale — there are hundreds of public skills, and most users won't author their own critic for each one they install.

Second Pass takes the universal route. **One skill enhancement layer that adapts to whatever skill produced the output.** It reads the originating skill, understands its intent, and applies a single A–F rubric grounded in *that* skill's standards. Same machinery for `internal-comms`, `frontend-design`, `writing-plans`, or any community skill from `obra/superpowers`, `anthropics/skills`, or `ComposioHQ/awesome-claude-skills`.

## How it works

1. Claude finishes a task using one or more skills (or directly).
2. If the output is non-measurable (writing, plan, explanation, proposal, design, etc.), Claude auto-invokes Second Pass.
3. Second Pass reads the originating skill's `SKILL.md` to understand what "good" looks like for *this specific skill*, then spawns the `self-judge` subagent with three inputs: skill(s) used, user request, output.
4. The subagent grades the output (A, B, C, D, or F) on a universal rubric grounded in skill intent + user request, and returns concrete drop-in feedback.
5. If the grade meets the passing bar, the output ships with the grade attached. If not, Claude revises using the feedback (and optionally re-judges, in strict mode).
6. Status line tells the user what is happening: `Second Pass [attempt 1/3]: grading output...` → `passed at attempt 1/3 (grade B).`

No user invocation required. It auto-triggers based on output type, then steps out of the way.

## Why a universal layer (vs. per-skill critics)

The first instinct when you want better skill outputs is to write a critic for each skill. That instinct is wrong at scale:

- **You don't own the skills.** Most installed skills come from `obra/superpowers`, `anthropics/skills`, community awesome-lists. You can't author a critic for each one.
- **Per-skill critics drift.** When the source skill updates, the critic doesn't.
- **Critics that hardcode rules become a maintenance burden.** The judge that reads `SKILL.md` on the fly stays correct as long as the skill's own description is correct.

Second Pass spends a fixed token budget on the universal grader, then reads each target skill's intent live. One layer, every skill.

## Install

Second Pass ships as three installable pieces. The skill itself, the slash commands, and the config file live in separate Claude Code directories by convention — see the steps below.

### 1. Install the skill

Copy or symlink this folder to `~/.claude/skills/second-pass/`:

```bash
# macOS / Linux
ln -s "/path/to/second-pass" ~/.claude/skills/second-pass

# Windows (PowerShell, admin or dev mode enabled)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\second-pass" -Target "C:\path\to\second-pass"
```

### 2. Install the slash commands (separate step)

Claude Code loads slash commands from `~/.claude/commands/`, not from the skill folder. You must install these separately — copy the three files from this skill's `commands/` directory:

```bash
# macOS / Linux
mkdir -p ~/.claude/commands/second-pass
cp commands/*.md ~/.claude/commands/second-pass/

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\commands\second-pass" | Out-Null
Copy-Item commands\*.md "$env:USERPROFILE\.claude\commands\second-pass\"
```

This registers `/second-pass:passing-grade`, `/second-pass:iteration-cap`, and `/second-pass:reset` with Claude Code.

### 3. Config (auto-managed)

The config file at `~/.claude/second-pass/config.json` is created the first time you run any slash command. Until then, defaults apply (`passing_grade: B`, `iteration_cap: 3`). See `examples/` for preconfigured setups (strict, default, lenient).

## Configuration

### Passing grade

```
/second-pass:passing-grade A
/second-pass:passing-grade B
/second-pass:passing-grade C
/second-pass:passing-grade D
/second-pass:passing-grade F
```

Setting the bar to `A` makes Second Pass strict — most first drafts will trigger revisions. Setting it to `D` or `F` effectively disables revisions. `B` is the recommended default.

### Iteration cap

```
/second-pass:iteration-cap 3       # default
/second-pass:iteration-cap 5       # allow more revision attempts
/second-pass:iteration-cap 1       # disable iteration — one grading pass, then ship
```

Higher caps mean more revisions per output (more tokens). Lower caps mean faster delivery but more outputs may ship below bar. A cap of `1` disables iteration entirely.

### Confirm revisions (re-judge after revising)

```
/second-pass:confirm-revisions true     # re-judge after revision in a loop (more tokens, more confidence)
/second-pass:confirm-revisions false    # default — apply feedback once, ship without re-judging
```

By default, when a baseline grades below the bar, Second Pass applies the judge's feedback once and ships. The judge already gave specific drop-in replacements; trust them. Set `confirm_revisions: true` only for high-stakes artifacts where you want the loop to verify the lift before shipping.

### Presets

```
/second-pass:strict      # bar A, cap 5, confirm-revisions true — high-stakes proposals, public copy
/second-pass:lenient     # bar C, cap 2, confirm-revisions false — quick drafts, speed beats polish
```

These shortcuts overwrite the full config in one call.

### Reset to defaults

```
/second-pass:reset
```

Restores all settings to defaults (`passing_grade: B`, `iteration_cap: 3`, `confirm_revisions: false`). Use when your config is in an unexpected state or after experimenting with stricter bars.

## Optional: reinforce auto-trigger in your CLAUDE.md

Second Pass's skill description tells Claude to auto-invoke before returning non-measurable outputs, and that is usually enough. If you want a belt-and-suspenders guarantee, add this line to your user or project `CLAUDE.md`:

```
Before returning any non-measurable output (writing, proposals, plans, explanations, designs, drafts), invoke the Second Pass skill to self-judge and iterate until the configured passing bar is met.
```

## Skill compatibility — what Second Pass enhances

Second Pass works against any skill whose final output is **judged, not tested**. The list below is a starting point covering the major output types (text writing, code/visual design, structural documents, implementation plans, voice content). If you've tested the skill against another, [open a compatibility report issue](./.github/ISSUE_TEMPLATE/compatibility_report.md) and we'll add it.

### High-value pairings (use Second Pass)

| Skill | Source | Output type | Why it benefits |
|---|---|---|---|
| `internal-comms` | anthropics/skills | 3P updates, FAQs, newsletters | Strict format + 1-3 sentence rule. Strong fit — judge catches density and AI-closer patterns. |
| `brand-guidelines` | anthropics/skills | Branded text/styled artifacts | Tone consistency, no AI tells. |
| `frontend-design` | anthropics/skills, plugin | Web components, landing pages | Catches generic AI aesthetics. |
| `skill-creator` | anthropics/skills | SKILL.md files | Trigger clarity, frontmatter discipline. |
| `content-research-writer` | ComposioHQ/awesome-claude-skills | Researched long-form | Citations, hook quality, AI tells. |
| `tailored-resume-generator` | ComposioHQ/awesome-claude-skills | Resumes | Specificity over fluff. |
| `superpowers:brainstorming` | obra/superpowers | Design exploration notes | Output coherence. |
| `superpowers:writing-plans` | obra/superpowers | Implementation plans | Plan completeness, step clarity. |
| Any custom voice / brand-style skill | (your own) | Tone-sensitive writing | AI-tell stripping, voice fidelity, rule adherence. |

### Skip (measurable output)

| Skill | Why skip |
|---|---|
| `superpowers:executing-plans` | Output is code/diff. Tests verify, not judges. |
| `superpowers:test-driven-development` | Pass/fail tests = measurable. |
| `superpowers:systematic-debugging` | Bug fixed or not — measurable. |
| `webapp-testing`, `mcp-builder`, `claude-api` | Code that compiles or runs — measurable. |
| `n8n-build`, `agent-browser`, `nano-banana` | API responses, image generation success — measurable. |
| `init`, `review`, `security-review` | Audit findings produce diffs/issues — measurable. |

If you're unsure, ask: *can I name a concrete pass/fail check for this output?* If yes — skip Second Pass. If no — use it.

## What it does not do

- **Does not generate content.** It only grades existing outputs and drives revision.
- **Does not rewrite drafts unilaterally.** Feedback flows back to the calling agent, which revises.
- **Does not cache rules per skill.** Grading reads skill intent on the fly; no rule database.
- **Does not fire on measurable outputs.** Test results, deploys, compile output, API codes are out of scope.
- **Does not require manual invocation.** It triggers itself based on output type.

## Grading rubric

- **A** — meets skill intent fully, serves the request precisely, no AI tells, concrete and clear
- **B** — meets intent with minor gaps, serves the request well, one or two small issues
- **C** — partial intent match or missed asks, noticeable issues
- **D** — significant gaps, wrong tone or format, missing key content, or strong AI smell
- **F** — does not meet intent or misses the request; rewrite from scratch

Default passing bar: `B`.

## Files

```
second-pass/
├── SKILL.md                    Entry point — flow, auto-trigger rules, status format
├── README.md                   This file
├── CHANGELOG.md                Release notes, follows Keep a Changelog / semver
├── LICENSE                     MIT
├── agents/
│   └── self-judge.md           Subagent that does the grading
├── commands/
│   ├── passing-grade.md        /second-pass:passing-grade (install to ~/.claude/commands/second-pass/)
│   ├── iteration-cap.md        /second-pass:iteration-cap
│   └── reset.md                /second-pass:reset
└── examples/
    ├── README.md               Explains the three preconfigured setups
    ├── config-default.json     B bar, cap 3 — recommended
    ├── config-strict.json      A bar, cap 5 — for high-stakes output
    └── config-lenient.json     C bar, cap 2 — for quick drafts
```

## License

MIT — see [`LICENSE`](LICENSE). Use it, fork it, improve it.
