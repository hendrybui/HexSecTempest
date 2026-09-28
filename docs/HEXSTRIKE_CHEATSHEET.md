# HexStrike × T3MP3ST Cheatsheet — revamped stack (2026-09-28)

**Version markers (eyeball these to confirm a fresh build):**

| Component | Version | Where to see it |
|---|---|---|
| HexStrike Flask | `6.1.0-unified.p4` | startup banner `🏷️ Version:`, `GET /health` → `version`, `GET /api/version`, first row of `/api/config` |
| T3MP3ST War Room | `0.3.0` | server boot banner, `GET :3333/api/health` → `version` |
| Bridge passthrough | — | `GET :3333/api/hexstrike/status` → `backend.serverVersion` + `backend.configApi` |

Quick version check:
```bash
curl -s 127.0.0.1:8888/health | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["version"], d["config_api"])'
# → 6.1.0-unified.p4 True
curl -s 127.0.0.1:3333/api/health | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])'
# → 0.3.0
```

Everything that exists and works in this checkout. No phantom commands.
Ground truth: `docs/CONTRIBUTION_RECEIPTS.md`, commits `c82b261` / `44a0d12` / `7541389`.

## 1. Boot sequence

```bash
# 1. HexStrike Flask backend (the real engine)
cd /mnt/Pandora/Workshop/HexStrike/hexstrike-ai
setsid nohup ../hexstrike_env/bin/python hexstrike_server.py --port 8888 \
  > ../logs/hexstrike_server.log 2>&1 < /dev/null &

# 2. T3MP3ST War Room (reads ~/.t3mp3st/.env — NOT the repo .env)
cd /mnt/Pandora/Workshop/HexSecTempest
setsid nohup npx tsx src/server.ts > /tmp/t3mp3st-server.log 2>&1 < /dev/null &

# 3. Verify the whole chain (exit 0 = healthy)
node scripts/hexstrike-doctor.mjs
```

## 2. Environment variables — T3MP3ST side

⚠️ **These go in `~/.t3mp3st/.env`** — T3MP3ST deliberately does not read the
repo-local `.env` (`src/config/index.ts:765`). Real env exports also work.

| Variable | Effect | Default |
|---|---|---|
| `T3MP3ST_HEXSTRIKE=1` | Arm the bridge; mint HexStrike tools into the arsenal | off |
| `T3MP3ST_LAB_MODE=1` | Bypass ScopeGuard + approval gate, lift fence → **150/150 callable**. Loud banners per gated call. Lab/CTF/owned only | off |
| `T3MP3ST_HEXSTRIKE_UNFENCED=1` | Lift ONLY the bridge fence; fenced tools mint as `dangerous`, approval gate still applies | off |
| `T3MP3ST_APPROVED_TOOLS=a,b,c` | Pre-authorize specific gated tools (headless approval) | none |
| `T3MP3ST_FULL_ARSENAL=1` | Arm specialist arsenal (metasploit/hydra adapters, gated) | off |
| `T3MP3ST_GATE_BUILTINS=1` | Stamp risky built-ins with risk tiers (approval gate applies) | off |
| `HEXSTRIKE_SERVER_URL` | Flask backend URL | `http://127.0.0.1:8888` |
| `HEXSTRIKE_PYTHON` / `HEXSTRIKE_MCP_SCRIPT` / `HEXSTRIKE_MCP_CWD` | Bridge spawn paths | `/mnt/Pandora/Workshop/HexStrike/…` |
| `HEXSTRIKE_TOOL_TIMEOUT_MS` | MCP call timeout | `300000` |

## 3. Environment variables — Flask side (NEW: all live in `/api/config`)

Set in env or `hexstrike-ai/.env` before starting the backend:

| Variable | Default | Notes |
|---|---|---|
| `HEXSTRIKE_BIND` | `127.0.0.1` | `0.0.0.0` = LAN-exposed — pair with `HEXSTRIKE_AUTH_TOKEN` |
| `HEXSTRIKE_PORT` | `8888` | also `--port` |
| `HEXSTRIKE_COMMAND_TIMEOUT` | `300` | per-command seconds; **runtime-tunable** |
| `HEXSTRIKE_CACHE_SIZE` | `1000` | LRU entries; **runtime-tunable** |
| `HEXSTRIKE_CACHE_TTL` | `3600` | cache seconds; **runtime-tunable** |
| `HEXSTRIKE_JOB_CONCURRENCY` | `2` | background job workers |
| `HEXSTRIKE_AUTH_TOKEN` | unset | bearer token for non-loopback clients |
| `HEXSTRIKE_LOG_PATH` | `../logs/hexstrike_server.log` | |
| `DEBUG_MODE` | `0` | Flask debug + verbose logs; **runtime-tunable** |

## 4. New API surface (revamped)

```bash
# Flask — unified config registry (secrets redacted)
curl -s 127.0.0.1:8888/api/config

# Flask — runtime tuning, no restart (clamped: timeout 10–7200, size 0–100000, ttl 0–86400)
curl -s -X POST 127.0.0.1:8888/api/config -H 'Content-Type: application/json' \
  -d '{"command_timeout": 600, "cache_ttl": 1800}'

# Flask — per-tool truth: availability, verified_working, last_run, fence sync
curl -s 127.0.0.1:8888/api/status/full | python3 -m json.tool | less

# War Room — bridge + backend in one call (armed / labMode / unfenced / mcpSync / availability)
curl -s 127.0.0.1:3333/api/hexstrike/status
```

## 5. SSE mission events (NEW)

Subscribe: `GET 127.0.0.1:3333/api/events` (Server-Sent Events). During missions,
HexStrike activity now appears live:

| SSE event | Payload | Meaning |
|---|---|---|
| `hexstrike.connected` | `{toolCount, callableCount, fencedCount}` | Bridge armed for the mission engine |
| `hexstrike.tool` | `{name, durationMs, success, riskTier}` | A HexStrike tool finished (success or failure) |
| `hexstrike.fenced` | `{name, riskTier}` | A fenced tool was refused (only fires when fence is ON) |
| `arsenal.approval` | approval record | Pre-existing approval-gate feed |

## 6. Power-ups shipped this revamp

- **150/150 tools callable** with `T3MP3ST_LAB_MODE=1` (proven: `callable:150, fenced:0`).
- **47/150 tools have their binary on this host** (was 40): added `arjun`, `gau`,
  `anew`, `qsreplace`, `theharvester`, `volatility3`, `uro`, `sleuthkit`, `scalpel`,
  `testdisk`, `fierce`, `medusa`, `patator`, `nbtscan`.
- **Executor timeout fix**: `EnhancedCommandExecutor` reads `COMMAND_TIMEOUT` at call
  time — runtime tuning and env values actually reach executions now.
- **Fence sync is live**: Flask parses `NON_CALLABLE_TOOLS` from the bridge source —
  keep that set's format stable or `/api/status/full` fence counts go null.

## 7. Troubleshooting fast table

| Symptom | Fix |
|---|---|
| `armed:false` in `/api/hexstrike/status` | `T3MP3ST_HEXSTRIKE=1` missing from **`~/.t3mp3st/.env`** (repo `.env` is ignored!) |
| Env changes ignored | Restart War Room; check the right env file; `/proc/<pid>/environ` shows exec-time env only |
| `engine:null` | Normal until first mission starts (TempestCommand is lazy) |
| `tools/list` zero tools | Flask backend down → boot sequence §1, then doctor |
| Tool "command not found" | Binary absent → `/health` `tools_status`; install, or pick another tool |
| go tools undetected after install | `~/go/bin` not in server PATH → `ln -sf ~/go/bin/* ~/.local/bin/` |
| apt "Unable to locate package" | Distro lacks Kali repos — use pipx/git/source (`enum4linux-ng`, `bulk-extractor`, `exploitdb`) |
| Call hangs | Raise `HEXSTRIKE_TOOL_TIMEOUT_MS` (T3MP3ST) or `command_timeout` (Flask, live-tunable) |

## 8. Restore the guarded default

```bash
# ~/.t3mp3st/.env — comment out both lines, then restart the War Room:
#T3MP3ST_HEXSTRIKE=1
#T3MP3ST_LAB_MODE=1
pkill -f '[t]sx src/server.ts'   # bracket trick — a bare pattern kills YOUR shell too
# then boot sequence §1, step 2
```

