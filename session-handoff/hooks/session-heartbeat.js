#!/usr/bin/env node
// session-heartbeat.js — UserPromptSubmit + Stop hook
//
// Writes a small, always-current record of what this session is doing, so a
// session that dies suddenly (crash, window close, host reboot) leaves a trail.
// Built 2026-09-10 after "Cola - Index Driver - Current Session" crashed and was
// unfindable: the 80%-threshold handoff had never fired, so nothing was written.
//
// The load-bearing idea is PHASE, not the file itself:
//   UserPromptSubmit -> phase "working"   (a turn has started)
//   Stop             -> phase "idle"      (the turn completed)
// A crash mid-turn freezes the record at "working". A clean /exit leaves "idle".
// That difference is what lets session-recover.js report ONLY real crashes
// instead of nagging about every session that ever ended.
//
// Spawn-free by design (no child_process) — this runs on every prompt and every
// turn end; see the protect-files.sh rewrite for why that matters.
// Never throws, never blocks, always exits 0.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HEARTBEAT_DIR = path.join(os.homedir(), '.claude', 'hooks', 'heartbeat');
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const TAIL = 256 * 1024;

function clip(s, n) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function readTail(file) {
  const size = fs.statSync(file).size;
  const start = Math.max(0, size - TAIL);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join(' ');
}

// Last main-thread assistant prose + the files this session recently wrote.
// Sidechain lines are subagent turns; their work is not this session's step.
function scanTranscript(file) {
  const out = { lastStep: '', files: [] };
  let lines;
  try {
    lines = readTail(file).split('\n');
  } catch {
    return out;
  }
  const seen = new Set();
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i] || lines[i][0] !== '{') continue;
    let j;
    try {
      j = JSON.parse(lines[i]);
    } catch {
      continue; // partial line at the buffer edge
    }
    if (j.isSidechain === true) continue;
    const msg = j.message;
    if (!msg) continue;

    if (Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b && b.type === 'tool_use' && /^(Edit|Write|NotebookEdit)$/.test(b.name || '')) {
          const f = b.input && b.input.file_path;
          if (f && !seen.has(f) && out.files.length < 12) {
            seen.add(f);
            out.files.push(f);
          }
        }
      }
    }
    if (!out.lastStep && j.type === 'assistant') {
      const t = textOf(msg.content);
      if (t && t.trim()) out.lastStep = clip(t, 600);
    }
    if (out.lastStep && out.files.length >= 12) break;
  }
  return out;
}

// The pid registry is the only place a session's human-readable name lives.
function lookupSession(sessionId) {
  try {
    for (const f of fs.readdirSync(SESSIONS_DIR)) {
      if (!f.endsWith('.json')) continue;
      let j;
      try {
        j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
      } catch {
        continue;
      }
      if (j.sessionId === sessionId) return { pid: j.pid, name: j.name || '' };
    }
  } catch { /* registry missing */ }
  return { pid: null, name: '' };
}

function main() {
  let hook;
  try {
    hook = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return;
  }
  const sessionId = hook.session_id;
  if (!sessionId) return;

  const event = hook.hook_event_name || '';
  const phase = event === 'Stop' ? 'idle' : 'working';

  const file = path.join(HEARTBEAT_DIR, sessionId + '.json');
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { /* first beat this session */ }

  // The goal is the user's own words, captured when the turn starts and then
  // held across Stop beats — the Stop event carries no prompt of its own.
  let goal = prev.goal || '';
  if (event === 'UserPromptSubmit' && hook.prompt) {
    const p = clip(hook.prompt, 400);
    if (p && !p.startsWith('<')) goal = p;
  }

  const scan = hook.transcript_path && fs.existsSync(hook.transcript_path)
    ? scanTranscript(hook.transcript_path)
    : { lastStep: '', files: [] };

  const reg = lookupSession(sessionId);

  const record = {
    sessionId,
    name: reg.name || prev.name || '',
    pid: reg.pid || prev.pid || null,
    cwd: hook.cwd || prev.cwd || '',
    transcriptPath: hook.transcript_path || prev.transcriptPath || '',
    phase,
    goal,
    lastStep: scan.lastStep || prev.lastStep || '',
    filesTouched: scan.files.length ? scan.files : (prev.filesTouched || []),
    turns: (prev.turns || 0) + (event === 'Stop' ? 1 : 0),
    startedAt: prev.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    fs.mkdirSync(HEARTBEAT_DIR, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(record, null, 1));
    fs.renameSync(tmp, file); // atomic: a crash mid-write never truncates the record
  } catch { /* non-fatal, never block the session */ }
}

try {
  main();
} catch { /* a heartbeat must never break a turn */ }
