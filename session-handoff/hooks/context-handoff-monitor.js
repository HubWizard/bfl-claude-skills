#!/usr/bin/env node
// context-handoff-monitor.js — UserPromptSubmit hook
// Reads real token usage from the session transcript. When context passes the
// threshold (default 80% of the *model's* context window), injects a directive
// telling Claude to wrap up at the next good stopping point and run the
// session-handoff skill. Re-warns only after context grows another 15k tokens.
//
// The context window is a per-MODEL property, not a constant — the hook reads
// the model from the transcript and resolves its window (Opus/Sonnet/Fable = 1M,
// Haiku = 200k). Hardcoding 200k made handoff fire at 16% on a 1M-window model.
// Config via env:
//   CLAUDE_CTX_WINDOW       hard global override for every model (default: per-model map)
//   CLAUDE_HANDOFF_THRESHOLD fraction of the window to fire at (default 0.80)

const fs = require('fs');
const path = require('path');
const os = require('os');

// Context window per model, in tokens. Keyed by substring/pattern match so
// date-suffixed IDs (e.g. claude-haiku-4-5-20251001) resolve correctly.
// Source: Claude model catalog. Update here when new models ship — one line each.
function windowForModel(model) {
  if (!model) return null;
  const m = String(model).toLowerCase();
  if (m.includes('haiku')) return 200000;            // Haiku 4.5 = 200k
  if (/opus-4-(5|6|7|8)/.test(m)) return 1000000;    // Opus 4.5/4.6/4.7/4.8 = 1M
  if (/sonnet-(5|4-6)/.test(m)) return 1000000;      // Sonnet 5 / 4.6 = 1M
  if (m.includes('fable') || m.includes('mythos')) return 1000000; // Fable/Mythos 5 = 1M
  if (m.includes('opus') || m.includes('sonnet')) return 200000;   // older Opus/Sonnet
  return null;                                       // unknown → caller falls back
}

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

  // Find the most recent MAIN-THREAD assistant message with usage data.
  // Skip isSidechain lines: background subagents (knowledge-extractor etc.)
  // write their own usage into this transcript, and their context is not ours.
  const lines = buf.toString('utf8').split('\n');
  let used = 0;
  let model = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"usage"')) continue;
    try {
      const j = JSON.parse(lines[i]);
      if (j.isSidechain === true) continue; // subagent turn — not the main thread
      const u = j.message && j.message.usage;
      if (u && (u.input_tokens || u.cache_read_input_tokens)) {
        // Context occupancy = the full prompt the model saw this turn.
        // Do NOT add output_tokens — the prompt already contains prior outputs;
        // adding this turn's output double-counts and fires early.
        used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) +
               (u.cache_creation_input_tokens || 0);
        model = (j.message && j.message.model) || '';
        break;
      }
    } catch { /* partial line at buffer start */ }
  }
  if (!used) return;

  // Window: hard env override wins; else per-model; else conservative 200k.
  const envWindow = parseInt(process.env.CLAUDE_CTX_WINDOW || '', 10);
  const WINDOW = (Number.isFinite(envWindow) && envWindow > 0)
    ? envWindow
    : (windowForModel(model) || 200000);
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
