---
name: session-handoff
description: Wrap up the current session at a good stopping point, write a complete handoff document, and spawn a fresh Claude Code session that continues the work. Use when a CONTEXT ALERT is injected (context past threshold), or when the user says "handoff", "hand off", "continue in a new session", or "fresh session with this work".
---

# Session Handoff

Purpose: long sessions degrade — compaction summaries lose instructions and every turn gets more expensive. This skill converts the current session's state into a handoff document a fresh session can execute from, then launches that fresh session automatically.

## When triggered mid-task

Do NOT abandon work mid-edit. Finish the current atomic unit first: complete the in-progress file edit, deploy step, or verification — something that leaves the workspace consistent. Then hand off. If the current request is nearly complete (one or two steps left), finish it entirely and hand off after.

## Step 0 — Name the handoff from the actual work

Before writing anything, derive a name from what this session was ACTUALLY doing. Ahmed has to scan a list of these later and know instantly which one is which — "handoff" tells him nothing.

Produce two forms of the same name:

- **Display name** — 3-6 words, Title Case, spaces allowed. Format: `<Project or subject> - <what is being done>`. Used for `-n` (prompt box, `/resume` picker, terminal title).
- **Slug** — the same thing lowercased and hyphenated, no spaces or punctuation. Used in the filename and the Remote Control session name.

| Session was about | Display name | Slug |
|---|---|---|
| Fixing spend caps + TLS on the voice agent | `Voice Agent - P0 Guardrails` | `voice-agent-p0-guardrails` |
| Cola source coverage after the host_index bug | `Cola - Source Coverage Fix` | `cola-source-coverage-fix` |
| Luke's Cal.com onboarding workflow | `Inner Mastery - Calcom Onboarding` | `inner-mastery-calcom-onboarding` |

Rules: name the PROJECT, not the activity ("Voice Agent - Guardrails", never "Bug Fixing"). No dates in the name — the filename already carries one. Never emit the literal word `handoff` as the whole name.

## Step 1 — Write the handoff document

Location: `<cwd>/.claude/handoffs/handoff-YYYYMMDD-HHmm-<slug>.md` (create the directory if needed). Use the actual current date/time and the Step 0 slug.

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

Launch a new Claude Code instance in a new Windows Terminal tab, in the same working directory. It must look and behave exactly like a session Ahmed started himself: **full color, not flagged as a child session**, recognizable name, verifiable log.

### The thing that actually breaks this: inherited environment

**Read this before touching the launch command.** A running Claude Code session injects variables into every process it spawns. `Start-Process` inherits them, the launcher batch passes them on, and the new `claude.exe` reads them off its own environment. Two of them ruin the session:

| Injected var | What it does to the spawned session |
|---|---|
| `CLAUDE_CODE_CHILD_SESSION=1` | The new session **declares itself a child session.** Root-caused 2026-08-14. |
| `NO_COLOR=1` | `process.stdout.getColorDepth()` returns **1 (monochrome)** → the TUI renders **colorless.** Root-caused 2026-08-14. |

Measured 2026-08-14: identical probe in a spawned Windows Terminal tab returned `getColorDepth() = 1` with `NO_COLOR` inherited and `= 24` with it cleared, in **both** cmd and PowerShell. So neither the shell nor the terminal was ever the cause.

**This is why the 2026-08-07 "detached, not a child" fix did not hold.** That fix hardened the *process tree* — the wrong layer. `CLAUDE_CODE_CHILD_SESSION` travels through the environment and no amount of process-tree detachment removes it. If a future session reports "still a child" or "still no color," check the spawned process's environment first, not its ancestry.

Full injected set on this machine (diff of session env vs. persistent User+Machine env), for reference when auditing:
`NO_COLOR`, `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_BRIDGE_SESSION_ID`, `CLAUDE_PID`, `AI_AGENT`, `GIT_ASKPASS`, `GIT_EDITOR`, `GCM_INTERACTIVE`. Scrub all of these.
Do NOT scrub `KIE_API_KEY` or `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` — those come from `settings.json` and the new session sets them itself.

**Do NOT build the command inline with `cmd /c start "<title>" ... claude <flag> "<prompt>"`.** That construct mangles the arguments: `start` misparses a spaces-containing window title, so `claude.exe` receives the leftover tokens (`Handoff /D <cwd> claude ...`) as its own argv instead of a clean flag + prompt. That is exactly what produced the `unknown option '--remotecontrol'` and the "expecting stdin / behaving like --print mode" failures. Root-caused 2026-07-16 by inspecting the spawned process's `CommandLine`. The batch-file approach below avoids every layer of this.

**Flag facts that matter (all verified 2026-08-07):**
- `-n "<Display Name>"` sets the session display name and lands in session data as `agentName` — this is what the prompt box and the `/resume` picker show, and it is the flag that makes the session recognizable. It is NOT the same thing as the Remote Control name. (The CLI docs also list the terminal title; in a plain `cmd` window the title read back empty, so don't rely on that part.)
- The flag is `--remote-control` (hyphenated) — NOT `--remotecontrol`.
- `--remote-control [name]` takes an *optional name argument*. Written bare as `--remote-control "<prompt>"`, it **swallows your prompt as the session name**. Bind the name with `=` so the prompt stays a separate positional: `--remote-control=<slug> "<prompt>"`. Use the kebab **slug** here (no spaces — a spaces-containing value after `=` is not worth the quoting risk).
- `--session-id <uuid>` pins the session ID up front. Pass it so Step 3b can find this exact session's artifacts instead of guessing. Must be a real UUID.
- `--debug-file <path>` writes a full startup/API/hook/tool log. **Always pass it.** It is the only session log that appears within seconds and is therefore the only one you can actually verify at spawn time (see the transcript caveat in Notes).

**Launch through `wt.exe`, not `cmd`/`start`.** Ahmed works in Windows Terminal. `wt.exe new-tab` opens the session as a tab in his existing terminal (his stated preference, 2026-08-14) and hands off to the already-running `WindowsTerminal.exe`, so the tab is never inside this session's process tree — detachment comes free, no intermediate `start` needed.

The two obsolete workarounds below are **no longer used**, recorded so nobody reintroduces them: the intermediate `Start-Process cmd /c start ...` chain (its job — breaking the parent chain — `wt.exe` now does), and the `-WindowStyle Hidden` trap (the show state propagated through `start` into the spawned console and produced a session with **no visible window at all**; cost real time on 2026-08-07).

```powershell
$cwd   = "<cwd>"
$file  = "<filename>"                      # e.g. handoff-20260807-1630-voice-agent-p0-guardrails.md
$name  = "<Display Name>"                  # e.g. Voice Agent - P0 Guardrails
$slug  = "<slug>"                          # e.g. voice-agent-p0-guardrails
$sid   = [guid]::NewGuid().ToString()
$dbg   = Join-Path $cwd ".claude\handoffs\logs\$slug.log"
New-Item -ItemType Directory -Force -Path (Split-Path $dbg) | Out-Null
$bat   = Join-Path $env:TEMP "claude-handoff-launch.cmd"
# TEMP, never the repo: `set >` dumps EVERY var, including KIE_API_KEY.
$envDump = Join-Path $env:TEMP "claude-handoff-env-$slug.txt"

$prompt = "Read .claude/handoffs/$file and continue that work. Verify the 'done' items still hold before building on them."

# The scrub block is load-bearing: without it the session is a colorless child session.
$lines = @(
  '@echo off'
  'set "NO_COLOR="'
  'set "CLAUDECODE="'
  'set "CLAUDE_CODE_CHILD_SESSION="'
  'set "CLAUDE_CODE_ENTRYPOINT="'
  'set "CLAUDE_CODE_SESSION_ID="'
  'set "CLAUDE_CODE_BRIDGE_SESSION_ID="'
  'set "CLAUDE_CODE_SSE_PORT="'
  'set "CLAUDE_PID="'
  'set "AI_AGENT="'
  'set "GIT_EDITOR="'
  'set "GIT_ASKPASS="'
  'set "GCM_INTERACTIVE="'
  "cd /d `"$cwd`""
  "set > `"$envDump`""          # snapshot of the REAL spawned env, for Step 3b
  "claude --remote-control=$slug -n `"$name`" --session-id $sid --debug-file `"$dbg`" `"$prompt`""
)
Set-Content -Path $bat -Value ($lines -join "`r`n") -Encoding ASCII

# New tab in Ahmed's existing Windows Terminal. `cmd /k` keeps the tab open after exit.
Start-Process -FilePath "wt.exe" -ArgumentList "new-tab --title `"$name`" cmd /k `"$bat`""
```

`--remote-control=$slug` stays — Ahmed reconfirmed 2026-08-14 that he wants the session pairable from claude.ai. Note the scrub of `CLAUDE_CODE_BRIDGE_SESSION_ID` matters especially here: leaving it would point the new session at *this* session's remote bridge.

Keep `$sid`, `$dbg`, `$slug`, `$cwd` and `$envDump` — Step 3b needs all five.

### Step 3b — Verify the spawn

Process-count alone is NOT enough: a print-mode hang also shows a live process. And **process checks alone can't see the two failures Ahmed actually reports** — colorless, and "child session" — because both live in the environment. Verify the environment explicitly.

Note the process shape: `claude.exe`'s parent is the hosting `cmd`, whose parent is `WindowsTerminal.exe`. That is correct and is NOT a detachment failure — `WindowsTerminal.exe` is the pre-existing terminal app, not this session's tree.

Do not poll with a bare `Start-Sleep`; wait on the debug log appearing.

```powershell
# Wait for boot (the debug log is the first artifact to appear).
$deadline = (Get-Date).AddMinutes(3)
while (-not (Test-Path $dbg) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2 }

$p = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'claude.exe' -and $_.CommandLine -like "*$sid*" }
if (-not $p) { "FAIL: no claude.exe for session id $sid" }
foreach ($proc in $p) {
  "ARGV : $($proc.CommandLine)"
  $h = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)"
  "HOST : $($h.Name) PID $($h.ProcessId)"
  $gp = Get-CimInstance Win32_Process -Filter "ProcessId=$($h.ParentProcessId)" -ErrorAction SilentlyContinue
  "HOST PARENT: $(if ($null -eq $gp) { 'gone' } else { "$($gp.Name) PID $($gp.ProcessId)" })"
}
if (Test-Path $dbg) { "DEBUG LOG: $((Get-Item $dbg).Length) bytes"; Get-Content $dbg -Tail 5 } else { "FAIL: no debug log" }
```

Then assert on `$envDump` (the batch wrote it in Step 3) — it is the spawned process's real environment, which no process-tree check can show you:

```powershell
$bad = Select-String -Path $envDump -Pattern '^(NO_COLOR|CLAUDECODE|CLAUDE_CODE_CHILD_SESSION|CLAUDE_CODE_SESSION_ID|CLAUDE_PID|AI_AGENT)=' 
if ($bad) { "FAIL - leaked into spawned session:"; $bad.Line } else { "ENV CLEAN: no child/color pollution" }
(Select-String -Path $envDump -Pattern '^WT_SESSION=').Line  # must differ from this session's $env:WT_SESSION
Remove-Item $envDump -Force -ErrorAction SilentlyContinue   # it holds KIE_API_KEY — delete after asserting
```

All of these must hold before you report success:

1. **ARGV clean** — `claude.exe --remote-control=<slug> -n "<Display Name>" --session-id <uuid> --debug-file "..." "Read .claude/handoffs/<file> ..."`, flags and prompt intact as separate args. Leftover tokens like `Handoff /D <cwd> claude ...` mean the launch mangled.
2. **ENV CLEAN** — none of `NO_COLOR`, `CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, `AI_AGENT` present in the dump. A leak here is the colorless/child-session bug returning.
3. **Fresh `WT_SESSION`** — present and different from this session's, confirming a real Windows Terminal pane.
4. **HOST PARENT is `WindowsTerminal.exe`** — the tab survives this session closing.
5. **DEBUG LOG exists and is growing** — proof the session booted, loaded settings/hooks, and started processing the handoff prompt. Tail it: lines mentioning `tool_dispatch_start tool=Read` mean it has actually opened the handoff document. A live process with an empty debug log is a hung spawn.

Colour itself is the one thing you cannot confirm from here — you have no view of the rendered tab. Do not assert it. Either state it as unverified, or ask Ahmed to glance at the tab. If you need an objective proxy, `node -e "console.log(process.stdout.getColorDepth())"` inside that same batch must print **24**, not 1.

If any check fails, report the raw command line and which check failed. Do NOT tell the user to `/exit` — this session is still their working copy.

## Step 4 — Tell the user and stop

Report: the handoff file path, the **display name** the new session was given (so Ahmed can find it in `/resume`), the transcript path, what the fresh session was told to do, and that this session should now be closed (suggest `/exit`). Do not start new work in this session after handoff.

## Notes

- The monitor (`~/.claude/hooks/context-handoff-monitor.js`) resolves the context window **per model** from `message.model` in the transcript, so switching models keeps the trigger honest. Current map: **Opus 5 = 1M**, Opus 4.5/4.6/4.7/4.8 = 1M, **Sonnet 5** / 4.6 = 1M, Fable/Mythos 5 = 1M, Haiku 4.5 = 200k, legacy Claude 3 Opus/Sonnet = 200k.
  - **When a new model ships, add it to `windowForModel()` explicitly.** The `m.includes('opus')`/`includes('sonnet')` line at the bottom is a **200k catch-all for LEGACY models**, so any new Opus/Sonnet that isn't matched by a version pattern above it gets silently capped at 200k — it does NOT reach the "unknown → null" fallback. That is exactly how `claude-opus-5` got treated as a 200k model until 2026-07-25, firing handoff at ~128% (256k/200k) when the session was really at ~26% of its 1M window. The version arms are now open-ended (`opus-(4-(5|6|7|8)|[5-9])`, `sonnet-([5-9]|4-6)`) so Opus/Sonnet 6-9 are already covered. It fires at `CLAUDE_HANDOFF_THRESHOLD` (default 0.80) of that window. `CLAUDE_CTX_WINDOW` still works as a hard global override for every model; unknown models fall back to 200k.
- The monitor only fires on prompt submit. During a very long autonomous run it will not interrupt mid-turn; it fires on the next user prompt.
- It reads only the main thread's usage (`isSidechain` lines from background subagents are skipped) and measures true context occupancy (prompt tokens only, not this turn's output).
- Handoff files are project-local and disposable; old ones can be deleted freely. The `.claude/handoffs/logs/` debug logs are disposable too and can get large — clear them out periodically.
- **Session-logging caveat, measured 2026-08-07.** The `~/.claude/projects/<cwd-slug>/<session-id>.jsonl` conversation transcript is NOT a spawn-time verification signal. A spawned interactive session was left alive and idle for 7+ minutes after completing a full turn (9 messages, subagents run, `idle_prompt` fired) and **no `<sid>.jsonl` was ever written** — neither in `~/.claude/projects/` nor in the temp staging area. Reproduced with and without `--session-id`, so that flag is not the cause. Only a `<sid>/subagents/` directory appeared. By contrast a `claude -p` run writes its jsonl immediately (88KB, confirmed). Whether the interactive transcript flushes on a clean `/exit` was NOT tested — a console app cannot be closed with `taskkill` without `/F`, and driving it with SendKeys on a live desktop was not worth the risk. So: do not assert "transcript logging is on" from the jsonl's presence or absence at spawn time. `--debug-file` is the log to check, and the one to point Ahmed at.
