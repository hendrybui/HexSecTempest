# TODO — HexStrike Flask: maximize tool surface + live status in missions

Verified baseline (2026-09-28): backend healthy on `127.0.0.1:8888`, doctor exits 0,
150/150 MCP tools register, bridge suite 21/21 green, War Room on `:3333` with
`T3MP3ST_HEXSTRIKE=1`. Flask runs local branch `feat/unified-flask` (6 commits on
upstream master) — **those commits are load-bearing, do not revert** (httpx `-u`
semantics, angr/ghidra timeout kwarg, burpsuite route, `/status/full`, venv
interpreter for angr/pwntools, ghidra headless export).

## Phase 0 — Guardrails & testing modes (before touching anything)

Gates default ON (fail-safe DENY) — that baseline never changes. For full-stack
testing the **sanctioned opt-in** already ships in `src/arsenal/lab-mode.ts`:

- `T3MP3ST_LAB_MODE=1` — bypasses ScopeGuard + approval gate AND unfences the
  HexStrike bridge (all 150 tools callable). Loud boot banner + per-call warning
  so a lab run can never be mistaken for a gated run. **Off by default.**
- `T3MP3ST_HEXSTRIKE_UNFENCED=1` — lifts ONLY the bridge fence; the 24 fenced
  tools mint as `dangerous` tier and still hit the approval gate.
- `T3MP3ST_APPROVED_TOOLS=a,b,c` — headless pre-authorization allowlist; those
  gated tools run free without disabling the gate for anything else.

- [ ] Use `T3MP3ST_LAB_MODE=1` for full-surface testing on loopback/CTF/owned
      targets only; unset it to restore the gated default. Do NOT change the
      default — an unattended run must never self-fire an exploit.
- [ ] Pin protection: confirm checkout stays on `feat/unified-flask`; add a
      `hexstrike-doctor.mjs` branch check (warn if HEAD == upstream master).
- [ ] Keep `NON_CALLABLE_TOOLS` in `src/arsenal/hexstrike-bridge.ts` regex-parseable —
      `hexstrike_server.py:17966` parses it live for `/api/status/full` fence counts.
- [ ] Any change touching scope, execution, or the tool surface gets an entry in
      `docs/CONTRIBUTION_RECEIPTS.md` (repo rule).

## Phase 1 — Widen the runnable tool surface (install missing binaries)

74 optional externals absent per `/health` `tools_status`. Install in priority order;
re-run `node scripts/hexstrike-doctor.mjs` and diff `tools_status` after each batch.

- [~] Recon/OSINT batch: DONE `gau` (go, symlinked to `~/.local/bin`), `anew`,
      `qsreplace`, `theharvester` (pipx). TODO `recon-ng`, `spiderfoot`,
      `paramspider`, `social-analyzer`
- [ ] Web/API batch: `arjun`, `wpscan`, `jaeles`, `graphql-scanner`,
      `api-schema-analyzer`, `jwt-analyzer`
- [ ] Network batch: `rustscan`, `enum4linux-ng`, `nxc`, `evil-winrm`, `medusa`,
      `patator`
- [ ] Forensics batch: `sleuthkit`, `autopsy`, `volatility3`, `bulk-extractor`,
      `scalpel`, `photorec`/`testdisk`, `outguess`, `stegsolve`
- [ ] Cloud/container batch: `scout-suite`, `kube-bench`, `kube-hunter`,
      `docker-bench-security`, `terrascan`, `clair`, `falco`
- [ ] Exploit-lookup batch: `searchsploit`/`exploit-db`, `libc-database`,
      `ropgadget`/`ropper`, `one-gadget`, `pwninit`
- [ ] SKIP (fenced in T3MP3ST — installing adds nothing callable): `metasploit`,
      `msfvenom`, `burpsuite`, `zap`, `pacu`, `pwntools` exploit path
- [ ] Password-family note: `hashcat`+`john` are present but category shows 0/5 —
      check which binaries `/health` expects (`hash-identifier`, `hashpump`,
      `ophcrack`, `hashcat-utils`) and install the cheap ones.

## Phase 2 — Consume the Flask status surface

`/api/status/full` already serves: 150 tool rows (`available`, `category`,
`endpoint`, `schema`, `last_run`, `last_output`, `verified_working`, `notes`),
`mcp_sync` (fence counts + duplicate-def + mapping-mismatch flags), `jobs` queue,
`activity` 200-call ring, `cache` stats, `host` telemetry.

- [ ] Write a small poller (`scripts/hexstrike-status.mjs`) that snapshots
      `/api/status/full` and diffs `verified_working` / `available` over time —
      this is the ground truth for "can this tool actually run here".
- [ ] Triage tools where `available:true` but `verified_working:false` — those are
      execution bugs (candidates for the next `feat/unified-flask` fix commit,
      same pattern as the httpx `-l`→`-u` heal).
- [ ] Watch `mcp_sync.mapping_mismatches` (currently `[]`) in CI — a non-empty list
      means MCP tool ↔ Flask route drift after any edit.

## Phase 3 — Surface HexStrike status during missions (War Room)

The War Room health payload was never extended (known gap) — SSE channel
`/api/events` already exists for mission updates.

- [x] Add `GET /api/hexstrike/status` to `src/server.ts`: proxy
      `getHexStrikeStatus()` + summarized `/api/status/full` (counts by
      available/verified_working, fence sync). DONE 2026-09-28 — also shipped
      the Flask unified config surface: `GET`/`POST /api/config`, env knobs
      `HEXSTRIKE_COMMAND_TIMEOUT` / `HEXSTRIKE_CACHE_SIZE` / `HEXSTRIKE_CACHE_TTL`,
      call-time timeout read in `EnhancedCommandExecutor`. Receipt in
      `docs/CONTRIBUTION_RECEIPTS.md`.
- [x] Emit SSE events on HexStrike tool lifecycle during a mission:
      `hexstrike.tool` (name, durationMs, success, riskTier), `hexstrike.connected`,
      `hexstrike.fenced` — DONE 2026-09-28. Engine re-emits bridge signals
      (wired before `connect()`), `connectBroadcast` forwards to SSE. Live-proven
      with loopback `httpx_probe`. (Start-event variant was dropped: the bridge
      emits on completion only — extending to start events needs a bridge hook.)
- [ ] Stamp `last_run`/`duration` from Flask `activity` ring into the evidence
      ledger entry alongside the existing `provenance:'tool'` + raw output.
- [ ] Give the relevant operator archetypes their HexStrike tools: add real MCP
      names (verbatim, no prefix) to `defaultTools` in `src/operators/index.ts`.
- [ ] Mission-brief panel: show per-category availability from doctor step 2 so an
      operator sees "exploitation 0/3, password 0/5" before dispatching agents.
- [ ] Long scans: tune `HEXSTRIKE_TOOL_TIMEOUT_MS` (default 300s) per mission
      profile; surface pending jobs from Flask `jobs` queue in the War Room.

## Phase 4 — Validation & receipts

- [ ] `npx vitest run src/__tests__/hexstrike-bridge.test.ts` — stays 21/21.
- [ ] `node scripts/hexstrike-doctor.mjs` — exit 0, category counts improved.
- [ ] Live mission smoke: start a scoped loopback mission, confirm SSE shows
      `hexstrike.tool.*` events and evidence ledger carries Flask telemetry.
- [ ] `docs/CONTRIBUTION_RECEIPTS.md` entries for every Phase 1/3 change.
- [ ] Update `references/hexstrike-tool-registry.md` availability notes if tool
      families move from absent → present.
