#!/usr/bin/env node
// session-recover.js — SessionStart hook, and a manual report
//
// Reads the heartbeats written by session-heartbeat.js and surfaces sessions
// that died MID-TURN: phase "working" with no live process behind them. A
// session that exited cleanly is left at phase "idle" and is never reported,
// which is what keeps this quiet enough to run on every session start.
//
// As a hook (stdin = hook JSON): prints additionalContext only when there is
//   something real to say. Silent otherwise. MUST stay sync — an async
//   SessionStart/UserPromptSubmit hook has its stdout discarded.
// Manually:  node session-recover.js         -> crashed sessions
//            node session-recover.js --all   -> every known session
//
// Spawn-free. Never throws.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HEARTBEAT_DIR = path.join(os.homedir(), '.claude', 'hooks', 'heartbeat');
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const MAX_AGE_DAYS = 7;   // older than this and it is history, not a recovery
const MAX_REPORTS = 3;    // stop nagging after this many session starts
const MAX_SHOWN = 3;

function liveSessionIds() {
  // The pid registry is the authority: Claude Code removes a session's entry
  // when it exits. Cross-check the pid too, because a stale entry left by a
  // hard kill would otherwise read as alive.
  const live = new Set();
  try {
    for (const f of fs.readdirSync(SESSIONS_DIR)) {
      if (!f.endsWith('.json')) continue;
      let j;
      try {
        j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
      } catch {
        continue;
      }
      if (!j.sessionId || !j.pid) continue;
      let alive = false;
      try {
        process.kill(j.pid, 0);
        alive = true;
      } catch (e) {
        alive = e && e.code === 'EPERM'; // exists, just not ours to signal
      }
      if (alive) live.add(j.sessionId);
    }
  } catch { /* no registry */ }
  return live;
}

function loadBeats() {
  const out = [];
  let files;
  try {
    files = fs.readdirSync(HEARTBEAT_DIR);
  } catch {
    return out;
  }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(HEARTBEAT_DIR, f), 'utf8'));
      if (rec && rec.sessionId) out.push(rec);
    } catch { /* skip unreadable */ }
  }
  return out;
}

function ageHours(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 3600000;
}

function fmtAge(h) {
  if (h < 1) return Math.round(h * 60) + 'm ago';
  if (h < 48) return Math.round(h) + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

function describe(r) {
  const lines = [];
  lines.push(`  - "${r.name || '(unnamed)'}"  [${fmtAge(ageHours(r.updatedAt))}]`);
  if (r.goal) lines.push(`      was asked: ${r.goal}`);
  if (r.lastStep) lines.push(`      last step: ${r.lastStep.slice(0, 220)}`);
  if (r.filesTouched && r.filesTouched.length) {
    lines.push(`      touched: ${r.filesTouched.slice(0, 4).join(', ')}`);
  }
  lines.push(`      resume:  cd "${r.cwd}"  then  claude --resume ${r.sessionId}`);
  return lines.join('\n');
}

function crashed(beats, live) {
  return beats
    .filter((r) => r.phase === 'working')
    .filter((r) => !live.has(r.sessionId))
    .filter((r) => ageHours(r.updatedAt) <= MAX_AGE_DAYS * 24)
    .sort((a, b) => ageHours(a.updatedAt) - ageHours(b.updatedAt));
}

function markReported(rec) {
  try {
    const file = path.join(HEARTBEAT_DIR, rec.sessionId + '.json');
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    cur.reportedCount = (cur.reportedCount || 0) + 1;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cur, null, 1));
    fs.renameSync(tmp, file);
  } catch { /* non-fatal */ }
}

function runManual(all) {
  const live = liveSessionIds();
  const beats = loadBeats().sort((a, b) => ageHours(a.updatedAt) - ageHours(b.updatedAt));
  if (!beats.length) {
    process.stdout.write('No heartbeats recorded yet.\n');
    return;
  }
  if (all) {
    process.stdout.write('All known sessions (newest first):\n\n');
    for (const r of beats) {
      const state = live.has(r.sessionId) ? 'ALIVE ' : (r.phase === 'working' ? 'CRASHED' : 'ended ');
      process.stdout.write(`[${state}] ${fmtAge(ageHours(r.updatedAt)).padEnd(8)} ${r.name || '(unnamed)'}\n`);
      process.stdout.write(`          ${r.cwd}\n`);
      process.stdout.write(`          claude --resume ${r.sessionId}\n\n`);
    }
    return;
  }
  const dead = crashed(beats, live);
  if (!dead.length) {
    process.stdout.write('No sessions died mid-turn. Nothing to recover.\n');
    return;
  }
  process.stdout.write(`${dead.length} session(s) died mid-turn:\n\n`);
  for (const r of dead) process.stdout.write(describe(r) + '\n\n');
}

function runHook(hook) {
  const live = liveSessionIds();
  // Never report the session that is starting right now.
  if (hook && hook.session_id) live.add(hook.session_id);

  const dead = crashed(loadBeats(), live)
    .filter((r) => (r.reportedCount || 0) < MAX_REPORTS)
    .slice(0, MAX_SHOWN);
  if (!dead.length) return;

  for (const r of dead) markReported(r);

  const body =
    `UNFINISHED SESSION${dead.length > 1 ? 'S' : ''}: ${dead.length} Claude Code session(s) stopped mid-turn ` +
    `without finishing and without writing a handoff. Mention this to Ahmed in one short line and offer to resume; ` +
    `do not act on it unless he asks.\n` +
    dead.map(describe).join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: body
    }
  }));
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return runManual(true);
  if (process.stdin.isTTY || args.includes('--report')) return runManual(false);

  let hook = null;
  try {
    hook = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return runManual(false); // piped nothing usable — behave like the manual report
  }
  runHook(hook);
}

try {
  main();
} catch { /* recovery reporting must never break a session start */ }
