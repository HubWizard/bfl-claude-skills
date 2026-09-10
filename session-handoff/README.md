# Session Handoff Skill for Claude Code

Long Claude Code sessions degrade: context-compaction summaries lose
instructions, and every turn gets more expensive as the transcript grows.

This skill fixes that. When your session crosses a context-usage threshold
(default 80%), a hook injects a warning telling Claude to finish its current
step, write a complete handoff document, and spawn a fresh Claude Code
session that picks up exactly where the old one left off — no lost
instructions, no re-explaining yourself.

You can also trigger it manually any time by saying "handoff" or "continue
in a new session."

A session that *crashes* never reaches that threshold, so a second, smaller
mechanism covers the other failure: see **Crash watchdog** below.

## What's in here

- `session-handoff/SKILL.md` — the skill itself (what to put in the handoff
  doc, how to spawn the new session, how to verify it worked).
- `hooks/context-handoff-monitor.js` — a `UserPromptSubmit` hook that reads
  real token usage from the session transcript and injects a `CONTEXT
  ALERT` once you cross the threshold.
- `hooks/session-heartbeat.js` — records what the session is doing, on every
  prompt and every turn end.
- `hooks/session-recover.js` — a `SessionStart` hook that reports sessions
  which died mid-turn. Also runnable by hand.

All pure Node, no external dependencies — only `fs`/`path`/`os`, and no
subprocess spawning.

## Install

1. Copy the skill folder into your Claude Code skills directory:

   ```
   cp -r session-handoff ~/.claude/skills/session-handoff
   ```

2. Copy the hook scripts:

   ```
   mkdir -p ~/.claude/hooks
   cp hooks/*.js ~/.claude/hooks/
   ```

3. Register the hooks in `~/.claude/settings.json` (create any section that
   doesn't exist yet):

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "node ~/.claude/hooks/context-handoff-monitor.js",
               "timeout": 10,
               "statusMessage": "Checking context usage..."
             },
             {
               "type": "command",
               "command": "node ~/.claude/hooks/session-heartbeat.js",
               "async": true
             }
           ]
         }
       ],
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "node ~/.claude/hooks/session-heartbeat.js",
               "async": true
             }
           ]
         }
       ],
       "SessionStart": [
         {
           "matcher": "startup|resume",
           "hooks": [
             {
               "type": "command",
               "command": "node ~/.claude/hooks/session-recover.js",
               "statusMessage": "Checking for unfinished sessions..."
             }
           ]
         }
       ]
     }
   }
   ```

   If you already have hooks on these events, add these as further entries in
   the same arrays rather than replacing them. On Windows, use full paths
   (e.g. `node C:/Users/you/.claude/hooks/session-heartbeat.js`).

   **`session-recover.js` must stay synchronous.** An `async` hook has its
   stdout discarded, and this one works by injecting context.

4. Restart Claude Code (or start a new session) so it picks up the skill
   and hooks.

## Configuration

Set these env vars (e.g. in `~/.claude/settings.json` under `env`) to tune
behavior:

- `CLAUDE_HANDOFF_THRESHOLD` — fraction of context window that triggers a
  handoff warning. Default `0.80`.
- `CLAUDE_CTX_WINDOW` — hard global override for the context window, in tokens.
  Normally unnecessary: the hook resolves the window **per model** from the
  transcript (Opus 4.5+/5+, Sonnet 4.6/5+, Fable/Mythos 5 = 1M; Haiku 4.5 and
  legacy Opus/Sonnet = 200k). Unknown models fall back to 200k.

## Crash watchdog

The threshold handoff only helps a session that lives long enough to reach the
threshold. A session that crashes, is closed, or dies with the host leaves
nothing behind — no doc, no successor, no pointer. The heartbeat covers that
gap.

`session-heartbeat.js` writes one small JSON file per session to
`~/.claude/hooks/heartbeat/<session-id>.json`, holding the session's name, pid,
working directory, the user's stated goal, the last completed step, and the
files it recently wrote.

The load-bearing field is **`phase`**, and it is what makes this quiet enough
to run on every session start:

| event | phase written |
|---|---|
| `UserPromptSubmit` | `working` — a turn has started |
| `Stop` | `idle` — the turn completed |

A crash mid-turn freezes the record at `working`. A clean exit leaves it at
`idle`. `session-recover.js` reports **only** `working` records whose process
is gone — so a normal session ending is never mistaken for a crash, and you are
not nagged about every session you have ever closed.

Guards: nothing older than 7 days is reported, at most 3 sessions at a time,
and each crash is mentioned at most 3 times before it goes quiet. Liveness is
checked against `~/.claude/sessions/<pid>.json` **and** the pid itself, so a
stale registry entry left by a hard kill does not read as alive.

Run it by hand any time:

```
node ~/.claude/hooks/session-recover.js          # sessions that died mid-turn
node ~/.claude/hooks/session-recover.js --all    # every session, alive or not
```

Each entry prints the working directory and a ready-to-paste
`claude --resume <session-id>`.

## Notes

- The context hook only fires on prompt submit — it won't interrupt a long
  autonomous run mid-turn, only on your next message.
- **Handoff documents and the spawned session are pinned to one root
  workspace**, not to whatever sub-directory the dying session happened to be
  working in. `/resume` only lists sessions whose cwd hashes to the current
  directory's project slug, so a successor spawned inside a sub-project becomes
  invisible to `/resume` run from the root — which is exactly how a crashed
  session gets lost. The handoff doc's `Working directory` section tells the
  successor where the code actually lives, so it starts somewhere findable and
  `cd`s to the work. Set the root path in the skill's Step 1 and spawn block.
- Handoff documents are disposable — delete old ones freely. So are the
  `.claude/handoffs/logs/` debug logs, which can get large.
- The skill spawns the continuation session as a new **Windows Terminal tab**
  (`wt.exe new-tab`) running `claude --remote-control=<slug>`. The flag is
  hyphenated — `--remotecontrol` is not a real flag. PowerShell spawn commands
  are in the skill; adjust that step if you're not on Windows.
- **If you port the spawn step to another platform, carry the environment
  scrub with it.** A running Claude Code session injects vars into everything
  it spawns; `NO_COLOR=1` makes the new session render colorless and
  `CLAUDE_CODE_CHILD_SESSION=1` makes it declare itself a child session. Both
  travel through the environment, so detaching the process tree does not fix
  either. The launcher must clear them before invoking `claude`.
