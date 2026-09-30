#!/usr/bin/env node
/**
 * HexStrike status poller — snapshots /api/status/full and diffs
 * verified_working / available over time.
 *
 * Ground truth for "can this tool actually run here". Never mutates the
 * backend. Writes the latest snapshot under reports/hexstrike-status/
 * (gitignored, same convention as other reports/).
 *
 * Usage:
 *   node scripts/hexstrike-status.mjs
 *   node scripts/hexstrike-status.mjs --json
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = process.env.HEXSTRIKE_SERVER_URL || 'http://127.0.0.1:8888';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP_DIR = join(ROOT, 'reports', 'hexstrike-status');
const LATEST = join(SNAP_DIR, 'latest.json');
const asJson = process.argv.includes('--json');

const res = await fetch(`${SERVER}/api/status/full`, { signal: AbortSignal.timeout(20_000) });
if (!res.ok) {
  console.error(`GET ${SERVER}/api/status/full → HTTP ${res.status}`);
  process.exit(1);
}
const full = await res.json();
const tools = Array.isArray(full.tools) ? full.tools : [];

const classify = (t) => {
  const last = t.last_run;
  if (t.verified_working === true) return 'verified';
  if (!last) return 'never_run';
  if (last.exit !== 0) return 'failed';
  return 'other';
};

const groups = { verified: [], never_run: [], failed: [], other: [] };
for (const t of tools) groups[classify(t)].push(t);

const snapshot = {
  ts: new Date().toISOString(),
  server: SERVER,
  tool_count: tools.length,
  available: tools.filter((t) => t.available === true).length,
  verified_working: groups.verified.length,
  never_run: groups.never_run.length,
  failed_last_run: groups.failed.map((t) => ({
    name: t.name,
    available: t.available,
    exit: t.last_run?.exit,
    notes: t.notes,
    last_output: String(t.last_output || '').slice(0, 160),
  })),
  mcp_sync: full.mcp_sync ?? null,
  jobs: full.jobs ?? null,
  category: (() => {
    const cats = {};
    for (const t of tools) {
      const c = t.category || 'unknown';
      cats[c] ??= { total: 0, available: 0, verified: 0 };
      cats[c].total++;
      if (t.available) cats[c].available++;
      if (t.verified_working) cats[c].verified++;
    }
    return cats;
  })(),
};

mkdirSync(SNAP_DIR, { recursive: true });
let previous = null;
if (existsSync(LATEST)) {
  try { previous = JSON.parse(readFileSync(LATEST, 'utf8')); } catch { previous = null; }
}
writeFileSync(LATEST, JSON.stringify(snapshot, null, 2));
writeFileSync(join(SNAP_DIR, `snap-${snapshot.ts.replace(/[:.]/g, '-')}.json`), JSON.stringify(snapshot, null, 2));

if (asJson) {
  console.log(JSON.stringify({ snapshot, previous: previous && {
    ts: previous.ts,
    available_delta: snapshot.available - (previous.available ?? 0),
    verified_delta: snapshot.verified_working - (previous.verified_working ?? 0),
  } }, null, 2));
  process.exit(0);
}

console.log(`HexStrike status @ ${SERVER}  (${snapshot.ts})`);
console.log(`  tools=${snapshot.tool_count} available=${snapshot.available} verified_working=${snapshot.verified_working} never_run=${snapshot.never_run} failed=${snapshot.failed_last_run.length}`);
if (snapshot.mcp_sync) {
  const m = snapshot.mcp_sync;
  console.log(`  mcp_sync discovered=${m.discovered} fenced=${m.fenced} callable=${m.callable} mapping_mismatches=${(m.mapping_mismatches || []).length}`);
}
if (snapshot.jobs) {
  console.log(`  jobs queue_depth=${snapshot.jobs.queue_depth} running=${snapshot.jobs.running} total=${snapshot.jobs.total}`);
}
if (snapshot.failed_last_run.length) {
  console.log('  failed last run (execution-bug candidates):');
  for (const f of snapshot.failed_last_run) {
    console.log(`    - ${f.name} exit=${f.exit} available=${f.available} ${f.last_output.replace(/\n/g, ' ').slice(0, 80)}`);
  }
} else {
  console.log('  failed last run: none — available-but-unverified rows are never-run, not execution bugs');
}
if (previous) {
  const dA = snapshot.available - (previous.available ?? 0);
  const dV = snapshot.verified_working - (previous.verified_working ?? 0);
  console.log(`  delta vs ${previous.ts}: available ${dA >= 0 ? '+' : ''}${dA}  verified_working ${dV >= 0 ? '+' : ''}${dV}`);
}
console.log(`  snapshot: ${LATEST}`);
