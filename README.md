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

## What's in here

- `session-handoff/SKILL.md` — the skill itself (what to put in the handoff
  doc, how to spawn the new session, how to verify it worked).
- `hooks/context-handoff-monitor.js` — a `UserPromptSubmit` hook that reads
  real token usage from the session transcript and injects a `CONTEXT
  ALERT` once you cross the threshold. No hardcoded paths, no external
  dependencies — pure Node, uses only `fs`/`path`/`os`.

## Install

1. Copy the skill folder into your Claude Code skills directory:

   ```
   cp -r session-handoff ~/.claude/skills/session-handoff
   ```

2. Copy the hook script:

   ```
   mkdir -p ~/.claude/hooks
   cp hooks/context-handoff-monitor.js ~/.claude/hooks/context-handoff-monitor.js
   ```

3. Register the hook in `~/.claude/settings.json` under `UserPromptSubmit`
   (create the array/section if it doesn't exist yet):

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
             }
           ]
         }
       ]
     }
   }
   ```

   If you already have other `UserPromptSubmit` hooks, add this as another
   entry in the same array rather than replacing it. On Windows, use the
   full path (e.g. `node C:/Users/you/.claude/hooks/context-handoff-monitor.js`).

4. Restart Claude Code (or start a new session) so it picks up the skill
   and hook.

## Configuration

Set these env vars (e.g. in `~/.claude/settings.json` under `env`) to tune
behavior:

- `CLAUDE_HANDOFF_THRESHOLD` — fraction of context window that triggers a
  handoff warning. Default `0.80`.
- `CLAUDE_CTX_WINDOW` — total context window size in tokens. Default
  `200000`.

## Notes

- The hook only fires on prompt submit — it won't interrupt a long
  autonomous run mid-turn, only on your next message.
- Handoff documents are written to `<project>/.claude/handoffs/` and are
  disposable — delete old ones freely.
- The skill spawns a new terminal window running `claude --remotecontrol`
  in the same working directory (PowerShell-based spawn commands are in the
  skill). Adjust that step if you're not on Windows.
