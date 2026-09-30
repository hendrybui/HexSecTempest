#!/usr/bin/env node
/**
 * HexStrike live smoke — loopback only, no lab-mode, no gate weakening.
 *
 * Checks:
 *   1. Flask /health
 *   2. nmap dry_run against 127.0.0.1 (command dump, no scan)
 *   3. /api/jobs snapshot
 *   4. mapping_mismatches empty
 *   5. War Room /api/hexstrike/status if :3333 is up (SSE mission path needs an engine)
 *
 * Exit 0 if Flask checks pass. War Room absence is reported, not a fail —
 * starting a full LLM mission is out of band for this harness.
 */
const FLASK = process.env.HEXSTRIKE_SERVER_URL || 'http://127.0.0.1:8888';
const WAR = process.env.T3MP3ST_SERVER_URL || 'http://127.0.0.1:3333';

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);
let failures = 0;
const fail = (m) => { bad(m); failures++; };

const get = async (url, ms = 15_000) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* raw */ }
  return { status: r.status, json, text };
};
const post = async (url, body, ms = 30_000) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const json = await r.json();
  return { status: r.status, json };
};

console.log('\n[smoke] HexStrike loopback (lab mode OFF)');
if (/^(1|true|on)$/i.test(process.env.T3MP3ST_LAB_MODE ?? '')) {
  fail('T3MP3ST_LAB_MODE is set — smoke refuses to run with guardrails bypassed');
  process.exit(1);
}

try {
  const h = await get(`${FLASK}/health`);
  if (h.status !== 200 || h.json?.status !== 'healthy') fail(`Flask /health ${h.status} ${h.json?.status}`);
  else ok(`Flask healthy essential=${h.json.all_essential_tools_available}`);
} catch (e) {
  fail(`Flask /health: ${e.message}`);
}

try {
  const n = await post(`${FLASK}/api/tools/nmap`, { target: '127.0.0.1', dry_run: true });
  if (n.status !== 200 || n.json?.dry_run !== true) fail(`nmap dry_run HTTP ${n.status}`);
  else ok(`nmap dry_run → ${n.json.command}`);
} catch (e) {
  fail(`nmap dry_run: ${e.message}`);
}

try {
  const j = await get(`${FLASK}/api/jobs`);
  if (j.status !== 200) fail(`/api/jobs HTTP ${j.status}`);
  else ok(`jobs queue_depth=${j.json?.queue_depth ?? 0} running=${j.json?.running ?? 0}`);
} catch (e) {
  fail(`/api/jobs: ${e.message}`);
}

try {
  const f = await get(`${FLASK}/api/status/full`, 20_000);
  const mm = f.json?.mcp_sync?.mapping_mismatches;
  if (!Array.isArray(mm)) fail('mapping_mismatches missing');
  else if (mm.length) fail(`mapping_mismatches=${mm.length}`);
  else ok('mapping_mismatches=[]');
} catch (e) {
  fail(`/api/status/full: ${e.message}`);
}

console.log('\n[smoke] War Room (optional)');
try {
  const s = await get(`${WAR}/api/hexstrike/status`, 5_000);
  if (s.status !== 200) {
    console.log(`  · War Room not serving /api/hexstrike/status (HTTP ${s.status}) — SSE hexstrike.tool.* needs npm run server + a mission`);
  } else {
    ok(`War Room hexstrike/status armed=${s.json?.armed} labMode=${s.json?.labMode} jobs=${JSON.stringify(s.json?.backend?.jobs || null)}`);
    if (s.json?.labMode) fail('War Room reports labMode=true — smoke expects gates ON');
  }
} catch {
  console.log('  · War Room :3333 down — Flask checks still stand. Start `npm run server` for SSE proof.');
}

console.log(failures === 0 ? '\nHEXSTRIKE SMOKE: OK\n' : `\nHEXSTRIKE SMOKE: ${failures} FAIL\n`);
process.exit(failures === 0 ? 0 : 1);
