#!/usr/bin/env node
// context-handoff-monitor.js — UserPromptSubmit hook
// Reads real token usage from the session transcript. When context passes the
// threshold (default 80% of 200k), injects a directive telling Claude to wrap
// up at the next good stopping point and run the session-handoff skill.
// Re-warns only after context grows another 15k tokens (no nagging).
// Config via env: CLAUDE_CTX_WINDOW (default 200000), CLAUDE_HANDOFF_THRESHOLD (default 0.80)

const fs = require('fs');
const path = require('path');
const os = require('os');

function main() {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { return; }
  let hook;
  try { hook = JSON.parse(input); } catch { return; }

  const transcript = hook.transcript_path;
  if (!transcript || !fs.existsSync(transcript)) return;

  // Read only the tail of the transcript (sessions can be 25MB+)
  const TAIL = 512 * 1024;
  const size = fs.statSync(transcript).size;
  const start = Math.max(0, size - TAIL);
  const fd = fs.openSync(transcript, 'r');
  const buf = Buffer.alloc(size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);

  // Find the most recent assistant message with usage data (walk lines in reverse)
  const lines = buf.toString('utf8').split('\n');
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    try {
      const j = JSON.parse(lines[i]);
      const u = j.message && j.message.usage;
      if (u && (u.input_tokens || u.cache_read_input_tokens)) {
        used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) +
               (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);
        break;
      }
    } catch { /* partial line at buffer start */ }
  }
  if (!used) return;

  const WINDOW = parseInt(process.env.CLAUDE_CTX_WINDOW || '200000', 10);
  const THRESHOLD = parseFloat(process.env.CLAUDE_HANDOFF_THRESHOLD || '0.80');
  const pct = used / WINDOW;
  if (pct < THRESHOLD) return;

  // Cooldown: only re-warn after 15k more tokens accumulated
  const stateDir = path.join(os.homedir(), '.claude', 'hooks', 'handoff-state');
  const stateFile = path.join(stateDir, (hook.session_id || 'unknown') + '.json');
  try {
    const prev = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (used - (prev.lastWarnTokens || 0) < 15000) return;
  } catch { /* first warning this session */ }
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ lastWarnTokens: used, ts: Date.now() }));
  } catch { /* non-fatal */ }

  const pctDisplay = Math.round(pct * 100);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        `CONTEXT ALERT: this session is at ~${pctDisplay}% of its context window (${used.toLocaleString()} tokens). ` +
        `Handle the user's current request only up to the next good stopping point (do not start new major work), ` +
        `then invoke the "session-handoff" skill: write a handoff document and spawn a fresh Claude Code session to continue. ` +
        `Tell the user you are doing this.`
    }
  }));
}

main();
