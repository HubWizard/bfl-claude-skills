# Example configs

Drop any of these into `~/.claude/second-pass/config.json` to get a preconfigured setup. Or use the slash commands — `/second-pass:passing-grade`, `/second-pass:iteration-cap`, `/second-pass:reset` — to change the same values interactively.

## `config-default.json`

Recommended for most users. `B` is achievable on a reasonable attempt, so most outputs ship after one or two passes.

```json
{
  "passing_grade": "B",
  "iteration_cap": 3
}
```

## `config-strict.json`

For high-stakes output (client-facing proposals, published content). `A` is a demanding bar — expect most drafts to trigger revision. Higher iteration cap gives the loop room to converge.

```json
{
  "passing_grade": "A",
  "iteration_cap": 5
}
```

Token cost per output will be significantly higher. Use when the quality of the final artifact matters more than the cost of getting there.

## `config-lenient.json`

For internal notes, quick drafts, or iterative brainstorming where polish doesn't matter yet. `C` passes almost anything coherent; cap of 2 keeps the loop from spinning on low-priority work.

```json
{
  "passing_grade": "C",
  "iteration_cap": 2
}
```
