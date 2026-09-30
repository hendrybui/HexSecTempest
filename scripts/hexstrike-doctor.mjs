#!/usr/bin/env node
/**
 * HexStrike bridge doctor — verifies the T3MP3ST → HexStrike link for real.
 *
 * Checks, in order:
 *   1. Flask backend reachable on HEXSTRIKE_SERVER_URL (default http://127.0.0.1:8888)
 *   2. Backend /health reports which external security tools are present
 *   3. MCP stdio frontend spawns and completes a real `initialize` handshake
 *      and `tools/list` returns the tool surface, with a count and a name sample
 *   4. Flask checkout is pinned to feat/unified-flask (warn if HEAD is upstream master)
 *   5. /api/status/full mcp_sync.mapping_mismatches is empty (MCP ↔ Flask route drift)
 *
 * Exit codes: 0 = bridge healthy, 1 = a check failed, 2 = misconfiguration.
 *
 * This is a VERIFICATION harness: it never mutates state and never targets a
 * remote host. It only connects to the local HexStrike service.
 */

import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER_URL = process.env.HEXSTRIKE_SERVER_URL || 'http://127.0.0.1:8888';
const MCP_PY = process.env.HEXSTRIKE_MCP_PY
  || '/mnt/Pandora/Workshop/HexStrike/hexstrike_env/bin/python';
const MCP_SCRIPT = process.env.HEXSTRIKE_MCP_SCRIPT
  || '/mnt/Pandora/Workshop/HexStrike/hexstrike-ai/hexstrike_mcp.py';
const MCP_CWD = process.env.HEXSTRIKE_MCP_CWD
  || '/mnt/Pandora/Workshop/HexStrike/hexstrike-ai';

const ok = (m) => console.log(`  \u2713 ${m}`);
const bad = (m) => console.log(`  \u2717 ${m}`);
const info = (m) => console.log(`    ${m}`);

let failures = 0;
const fail = (m) => { bad(m); failures++; };

// ── 1. Backend health ───────────────────────────────────────────────────────
console.log(`\n[1/5] HexStrike Flask backend @ ${SERVER_URL}`);
let health = null;
try {
  const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  health = await res.json();
  ok(`backend healthy (status=${health.status})`);
  info(`all_essential_tools_available=${health.all_essential_tools_available}`);
} catch (err) {
  fail(`backend unreachable: ${err.message}`);
  info('Start it with:');
  info(`  cd ${MCP_CWD} && setsid nohup ${MCP_PY} hexstrike_server.py --port 8888 > ../logs/hexstrike_server.log 2>&1 < /dev/null &`);
}

// ── 2. External tool availability ───────────────────────────────────────────
if (health) {
  console.log('\n[2/5] External security tool availability (from /health)');
  const cats = health.category_stats || {};
  for (const [name, s] of Object.entries(cats)) {
    const avail = s.available ?? 0;
    const total = s.total ?? 0;
    const mark = avail === total ? '\u2713' : avail > 0 ? '\u25cf' : '\u2717';
    console.log(`  ${mark} ${name.padEnd(16)} ${avail}/${total}`);
  }
  const status = health.tools_status || {};
  const missing = Object.entries(status).filter(([, v]) => v === false).map(([k]) => k);
  if (missing.length) info(`absent (optional): ${missing.length} tools — e.g. ${missing.slice(0, 8).join(', ')}`);
}

// ── 3. MCP stdio handshake + tools/list ─────────────────────────────────────
console.log('\n[3/5] MCP stdio frontend (tools/list)');
const transport = new StdioClientTransport({
  command: MCP_PY,
  args: [MCP_SCRIPT, '--server', SERVER_URL],
  cwd: MCP_CWD,
  stderr: 'ignore',
});
const client = new Client({ name: 't3mp3st-hexstrike-doctor', version: '1.0.0' }, { capabilities: {} });

try {
  await client.connect(transport);
  ok('MCP initialize handshake completed');

  const { tools } = await client.listTools();
  if (!tools?.length) {
    fail('tools/list returned zero tools');
  } else {
    ok(`tools/list returned ${tools.length} tools`);
    const withSchema = tools.filter((t) => t.inputSchema?.properties).length;
    info(`${withSchema}/${tools.length} expose an input schema`);
    info(`sample: ${tools.slice(0, 6).map((t) => t.name).join(', ')}`);
    // Spot-check the tool names the agent preset depends on.
    const expected = ['nmap_scan', 'nuclei_scan', 'gobuster_scan', 'subfinder_scan', 'httpx_probe'];
    const names = new Set(tools.map((t) => t.name));
    const missing = expected.filter((n) => !names.has(n));
    if (missing.length) fail(`expected tools missing: ${missing.join(', ')}`);
    else ok(`spot-check passed (${expected.join(', ')})`);
  }
} catch (err) {
  fail(`MCP connection failed: ${err.message}`);
} finally {
  try { await client.close(); } catch { /* already closed */ }
}

// ── 4. Flask branch pin (warn-only unless HEAD is upstream master) ──────────
console.log('\n[4/5] Flask checkout pin (feat/unified-flask)');
{
  const git = (args) => spawnSync('git', args, { cwd: MCP_CWD, encoding: 'utf8', timeout: 5000 });
  const branch = (git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim();
  const head = (git(['rev-parse', '--short', 'HEAD']).stdout || '').trim();
  const master = (git(['rev-parse', '--short', 'master']).stdout || '').trim();
  if (!branch || !head) {
    info(`git probe failed in ${MCP_CWD} — skip pin check`);
  } else if (branch === 'master' || (master && head === master)) {
    fail(`Flask HEAD ${head} is upstream master — unified-flask pin lost (branch=${branch})`);
    info('Expected: feat/unified-flask. Do not revert the P0–P4 commits.');
  } else if (branch !== 'feat/unified-flask') {
    bad(`branch is ${branch} @ ${head} (expected feat/unified-flask) — warning only`);
    info('Doctor does not fail on a named feature branch; it fails if HEAD == master.');
  } else {
    ok(`pinned feat/unified-flask @ ${head}`);
  }
}

// ── 5. MCP ↔ Flask mapping mismatches (CI watch) ────────────────────────────
console.log('\n[5/5] MCP ↔ Flask mapping_mismatches');
try {
  const res = await fetch(`${SERVER_URL}/api/status/full`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const full = await res.json();
  const mismatches = full?.mcp_sync?.mapping_mismatches;
  if (!Array.isArray(mismatches)) {
    fail('mcp_sync.mapping_mismatches missing from /api/status/full');
  } else if (mismatches.length) {
    fail(`mapping_mismatches not empty (${mismatches.length}) — MCP tool ↔ Flask route drift`);
    info(JSON.stringify(mismatches).slice(0, 400));
  } else {
    ok('mapping_mismatches=[]');
    const dups = full?.mcp_sync?.duplicate_defs;
    if (Array.isArray(dups) && dups.length) {
      info(`duplicate_defs (documented, not a fail): ${dups.map((d) => d.tool).join(', ')}`);
    }
  }
} catch (err) {
  fail(`/api/status/full unreachable: ${err.message}`);
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(failures === 0
  ? '\nHEXSTRIKE BRIDGE: OK\n'
  : `\nHEXSTRIKE BRIDGE: ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
