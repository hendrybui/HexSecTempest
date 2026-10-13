#!/usr/bin/env node
/**
 * War Room driver for HexSecTempest (T3MP3ST) — agent harness for the local server.
 *
 * Zero-dependency Node >= 22 (global fetch). Run from the repo root:
 *
 *   .claude/skills/run-hexsectempest/driver.mjs up      # launch server in background, wait for /health
 *   .claude/skills/run-hexsectempest/driver.mjs status  # print key health fields
 *   .claude/skills/run-hexsectempest/driver.mjs smoke   # read-only sweep + approvals request/approve/reject cycle
 *   .claude/skills/run-hexsectempest/driver.mjs get arsenal/catalog
 *   .claude/skills/run-hexsectempest/driver.mjs post approvals/request '{"action":"network_request","target":"http://127.0.0.1:3333"}'
 *   .claude/skills/run-hexsectempest/driver.mjs down    # stop the server
 *
 * UI: http://127.0.0.1:3333/ui/  (drive with the playwright MCP tools or any headless browser)
 * Log: /tmp/t3mp3st-war-room.log   PID file: /tmp/t3mp3st-war-room.pid
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, openSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const PORT = Number(process.env.T3MP3ST_PORT || 3333);
const BASE = `http://127.0.0.1:${PORT}`;
const LOG = `/tmp/t3mp3st-war-room.log`;
const PID_FILE = `/tmp/t3mp3st-war-room.pid`;

const j = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

async function healthy() {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.status !== 200) return null;
    return await j(res);
  } catch { return null; }
}

async function up() {
  const already = await healthy();
  if (already) {
    console.log(`Server already up on :${PORT} (mode=${already.mode}, llm=${already.llm?.provider ?? '?'})`);
    return;
  }
  if (!existsSync(`${ROOT}/src/server.ts`)) {
    console.error(`Run this from the HexSecTempest repo root (cwd=${ROOT} has no src/server.ts)`);
    process.exit(1);
  }
  const logFd = openSync(LOG, 'a');
  const child = spawn('npm', ['run', 'server'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  process.stdout.write('Waiting for /health');
  for (let i = 0; i < 60; i++) {
    const h = await healthy();
    if (h) {
      console.log(`\nUP (pid ${child.pid}) — mode=${h.mode}, llm=${h.llm?.provider}/${h.llm?.model}, arsenal=${h.arsenal?.total}`);
      console.log(`UI:  ${BASE}/ui/\nLog: ${LOG}`);
      return;
    }
    process.stdout.write('.');
    await sleep(1000);
  }
  console.error(`\nServer did not become healthy within 60s — check ${LOG}`);
  process.exit(1);
}

async function listenerPid(port) {
  // Fallback for a server this driver didn't launch (no pid file): find who owns the port.
  try {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' });
    const m = out.match(/pid=(\d+)/);
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

async function down() {
  let pid = existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, 'utf8').trim()) : await listenerPid(PORT);
  if (!pid) {
    if (await healthy()) { console.error(`Could not identify the process on :${PORT} — kill it manually (ss -ltnp 'sport = :${PORT}').`); process.exit(1); }
    console.log('Server not running.'); return;
  }
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch {} }
  for (let i = 0; i < 15; i++) {
    if (!(await healthy())) { console.log(`Server stopped (pid ${pid}).`); return; }
    await sleep(1000);
  }
  try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} }
  console.log('Server force-killed.');
}

function status(h) {
  if (!h) { console.error(`Server not responding on :${PORT} — run the 'up' command.`); process.exit(1); }
  const p = (v) => console.log(v);
  p(`war-room    ${BASE}/ui/`);
  p(`mode        ${h.mode}  version=${h.version}`);
  p(`llm         ${h.llm?.configured ? `${h.llm.provider}/${h.llm.model}` : 'NOT CONFIGURED'} connected=${h.llm?.connected}`);
  p(`mission     ${h.mission?.active ? h.mission.id : 'standby'}`);
  p(`arsenal     ${h.arsenal?.total} adapters / ${h.arsenal?.commandReady} command-ready`);
  p(`ledgers     ${JSON.stringify(h.ledgers)}`);
  p(`approvals   pending=${h.approvals?.pending}  endpoint=${h.approvals?.endpoint}`);
}

async function smoke() {
  const fails = [];
  const check = (name, ok, detail = '') =>
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) || (ok || fails.push(name));

  const h = await healthy();
  check('GET /health', !!h && h.ok === true, h && `mode=${h.mode} llm=${h.llm?.provider}`);

  const cat = await j(await fetch(`${BASE}/api/arsenal/catalog`));
  const total = cat.summary?.total ?? 0;
  check('GET /api/arsenal/catalog', total > 0, `${total} tools, ${cat.summary?.commandReady} command-ready`);

  const st = await j(await fetch(`${BASE}/api/arsenal/status`));
  const stOk = st && (st.installed ?? st.ready ?? st.summary) !== undefined;
  check('GET /api/arsenal/status', !!stOk);

  // Full ScopeGuard receipt cycle: request -> pending -> approve -> rejected second receipt
  const target = BASE; // loopback only — never point smoke at a host you don't own
  const mk = async () => j(await fetch(`${BASE}/api/approvals/request`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'network_request', target, reason: 'driver.mjs smoke' }),
  }));
  const a1 = await mk();
  check('POST /api/approvals/request', a1.id && a1.status === 'pending', a1.id);
  const listPending = await j(await fetch(`${BASE}/api/approvals?status=pending`));
  check('GET  /api/approvals?status=pending', listPending.approvals.some(a => a.id === a1.id));
  const ap = await j(await fetch(`${BASE}/api/approvals/${a1.id}/approve`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ttlMinutes: 5, approvedBy: 'driver-smoke' }),
  }));
  check('POST /api/approvals/:id/approve', ap.status === 'approved', `expires=${ap.expiresAt}`);
  const a2 = await mk();
  const rj = await j(await fetch(`${BASE}/api/approvals/${a2.id}/reject`, { method: 'POST' }));
  check('POST /api/approvals/:id/reject', rj.status === 'rejected');

  const ui = await fetch(`${BASE}/ui/`);
  const html = await ui.text();
  check('GET  /ui/ (dashboard SPA)', ui.status === 200 && html.includes('War Room'));

  if (fails.length) { console.error(`\n${fails.length} check(s) failed: ${fails.join(', ')}`); process.exit(1); }
  console.log('\nAll smoke checks passed.');
}

const [cmd, path, ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'up': await up(); break;
  case 'down': await down(); break;
  case 'status': status(await healthy()); break;
  case 'smoke': await smoke(); break;
  case 'get': {
    if (!path) { console.error('usage: driver.mjs get <api-path-without-/api-prefix>'); process.exit(2); }
    const res = await fetch(`${BASE}/api/${path.replace(/^\/+/, '')}`);
    console.log(JSON.stringify(await j(res), null, 2));
    break;
  }
  case 'post': {
    if (!path) { console.error('usage: driver.mjs post <api-path> \'{"json":"body"}\''); process.exit(2); }
    const res = await fetch(`${BASE}/api/${path.replace(/^\/+/, '')}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: rest.join(' ') || '{}',
    });
    console.log(`HTTP ${res.status}`);
    console.log(JSON.stringify(await j(res), null, 2));
    break;
  }
  default:
    console.log(__doc__ ?? 'commands: up | down | status | smoke | get <path> | post <path> <json>');
}
