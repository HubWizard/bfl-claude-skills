---
name: session-handoff
description: Wrap up the current session at a good stopping point, write a complete handoff document, and spawn a fresh Claude Code session that continues the work. Use when a CONTEXT ALERT is injected (context past threshold), or when the user says "handoff", "hand off", "continue in a new session", or "fresh session with this work".
---

# Session Handoff

Purpose: long sessions degrade — compaction summaries lose instructions and every turn gets more expensive. This skill converts the current session's state into a handoff document a fresh session can execute from, then launches that fresh session automatically.

## When triggered mid-task

Do NOT abandon work mid-edit. Finish the current atomic unit first: complete the in-progress file edit, deploy step, or verification — something that leaves the workspace consistent. Then hand off. If the current request is nearly complete (one or two steps left), finish it entirely and hand off after.

## Step 1 — Write the handoff document

Location: `<cwd>/.claude/handoffs/handoff-YYYYMMDD-HHmm.md` (create the directory if needed). Use the actual current date/time.

Required sections — write for a reader with ZERO context; no session shorthand, no "as discussed":

```markdown
# Handoff: <one-line task title>

## Goal
What the user ultimately wants, in 2-3 sentences. Include the user's own key phrasing for anything they were exact about.

## State: done and verified
Each completed item + HOW it was verified (test output, status code, read-back). Unverified items must say "NOT VERIFIED".

## Next steps (ordered)
Specific, executable steps. Each one names files/commands/endpoints. The first step should be startable immediately.

## Key files and resources
Absolute paths, workflow IDs, URLs, container names touched or needed.

## Gotchas discovered this session
Anything that cost time: wrong assumptions, environment quirks, failed approaches. This is the most valuable section — do not skip it.

## Do NOT redo
Work that looks incomplete but is intentionally so, decisions the user already made (with the decision), things that must not be touched.

## Standing instructions from the user this session
Any directive the user gave ("always X", "never Y", tone/format preferences) that isn't already in CLAUDE.md or memory.
```

## Step 2 — Verify the handoff

Read the file back. Check every "Next steps" entry is executable without asking the user anything a fresh session couldn't know. If a step depends on unstated context, add that context.

## Step 3 — Spawn the continuation session

Launch a new Claude Code instance in a new terminal window, in the same working directory. Always pass the `--remotecontrol` flag:

```powershell
Start-Process -FilePath "cmd" -ArgumentList '/c','start','Claude Handoff','/D',"<cwd>",'claude','--remotecontrol',"`"Read .claude/handoffs/<filename> and continue that work. Verify the 'done' items still hold before building on them.`""
```

If `claude` is not found via `cmd start`, fall back to:

```powershell
Start-Process -FilePath "claude" -WorkingDirectory "<cwd>" -ArgumentList '--remotecontrol',"`"Read .claude/handoffs/<filename> and continue that work.`""
```

Verify the spawn: check a new `claude` process exists (`Get-Process | Where-Object {$_.ProcessName -like '*claude*'}` count increased, or the window appeared).

## Step 4 — Tell the user and stop

Report: handoff file path, what the fresh session was told to do, and that this session should now be closed (suggest `/exit`). Do not start new work in this session after handoff.

## Notes

- Threshold and window are configurable in `~/.claude/settings.json` env: `CLAUDE_HANDOFF_THRESHOLD` (default 0.80), `CLAUDE_CTX_WINDOW` (default 200000).
- The monitor only fires on prompt submit. During a very long autonomous run it will not interrupt mid-turn; it fires on the next user prompt.
- Handoff files are project-local and disposable; old ones can be deleted freely.
