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

Launch a new Claude Code instance in a new terminal window, in the same working directory.

**Do NOT build the command inline with `cmd /c start "<title>" ... claude <flag> "<prompt>"`.** That construct mangles the arguments: `start` misparses a spaces-containing window title, so `claude.exe` receives the leftover tokens (`Handoff /D <cwd> claude ...`) as its own argv instead of a clean flag + prompt. That is exactly what produced the `unknown option '--remotecontrol'` and the "expecting stdin / behaving like --print mode" failures. Root-caused 2026-07-16 by inspecting the spawned process's `CommandLine`.

**Two flag facts that matter:**
- The flag is `--remote-control` (hyphenated) — NOT `--remotecontrol`.
- `--remote-control [name]` takes an *optional name argument*. Written bare as `--remote-control "<prompt>"`, it **swallows your prompt as the session name**. Bind the name explicitly with `=` so the prompt stays a separate positional: `--remote-control=handoff "<prompt>"`.

**Working approach — write the exact command to a temp batch file, then launch it.** The batch file holds the prompt literally, so no PowerShell→cmd→start nested-quote layers can corrupt it:

```powershell
$cwd  = "<cwd>"
$file = "<filename>"   # e.g. handoff-20260716-1430.md
$bat  = Join-Path $env:TEMP "claude-handoff-launch.cmd"
$body = "@echo off`r`ncd /d `"$cwd`"`r`nclaude --remote-control=handoff `"Read .claude/handoffs/$file and continue that work. Verify the 'done' items still hold before building on them.`"`r`n"
Set-Content -Path $bat -Value $body -Encoding ASCII
Start-Process -FilePath "cmd.exe" -ArgumentList '/k', $bat
```

`Start-Process cmd /k` opens a fresh console window (real TTY → interactive mode, not print mode) and keeps it open. `--remote-control=handoff` satisfies Ahmed's 2026-07-15 request for a remote-controllable continuation session.

**Verify the spawn PROPERLY — process-count alone is NOT enough (a print-mode hang also shows a live process).** Inspect the spawned process's actual argv and confirm it is clean:

```powershell
Start-Sleep -Seconds 7
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'claude.exe' -and $_.CommandLine -like '*remote-control=handoff*' } | ForEach-Object { "PID $($_.ProcessId): $($_.CommandLine)" }
```

A correct spawn shows `claude.exe    --remote-control=handoff "Read .claude/handoffs/<file> ..."` — flag and prompt intact as separate args. If instead you see leftover tokens like `Handoff /D <cwd> claude ...` in the argv, the launch mangled and the continuation session is broken — report the raw command line to the user, do NOT tell them to `/exit`.

## Step 4 — Tell the user and stop

Report: handoff file path, what the fresh session was told to do, and that this session should now be closed (suggest `/exit`). Do not start new work in this session after handoff.

## Notes

- The monitor (`~/.claude/hooks/context-handoff-monitor.js`) resolves the context window **per model** from `message.model` in the transcript (Opus/Sonnet/Fable 5 = 1M, Haiku = 200k), so switching models keeps the trigger honest. It fires at `CLAUDE_HANDOFF_THRESHOLD` (default 0.80) of that window. `CLAUDE_CTX_WINDOW` still works as a hard global override for every model; unknown models fall back to 200k.
- The monitor only fires on prompt submit. During a very long autonomous run it will not interrupt mid-turn; it fires on the next user prompt.
- It reads only the main thread's usage (`isSidechain` lines from background subagents are skipped) and measures true context occupancy (prompt tokens only, not this turn's output).
- Handoff files are project-local and disposable; old ones can be deleted freely.
