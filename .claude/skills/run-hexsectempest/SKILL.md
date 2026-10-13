---
name: run-hexsectempest
description: Build, run, and drive HexSecTempest (T3MP3ST). Use when asked to start the War Room server, open or screenshot the dashboard UI, smoke-test the API, run the CLI, request or approve scope receipts, or interact with the running app.
---

HexSecTempest is a multi-agent security-testing framework. Its runnable surface is the
**War Room**: an Express server ([src/server.ts](src/server.ts)) on `http://127.0.0.1:3333`
that serves a REST API under `/api/*` and the dashboard SPA at `/ui/` (statically served
from `docs/index.html`). Drive it with the zero-dep driver
`.claude/skills/run-hexsectempest/driver.mjs` (launch, health, smoke, arbitrary API calls),
and drive the browser UI with the playwright MCP tools. All paths below are relative to the
repo root.

## Prerequisites

- Node >= 22.19. System node works; the pinned local Node 22 also works:

```bash
PATH="$HOME/.local/node22/bin:$PATH" node --version   # v22.23.2
```

- Deps installed and `.env` present (offline LLM via `TEMPEST_LOCAL_BASE_URL`/`TEMPEST_LOCAL_MODEL`/`TEMPEST_LOCAL_API_KEY` is enough — the server boots and `/health` reports `llm.connected=true` with no cloud keys):

```bash
npm install                # skip if node_modules exists — stale node_modules breaks typecheck/build
test -f .env || cp .env.example .env
```

No system packages beyond Node are needed for the server+UI (verified headless). Optional arsenal binaries (nmap, nuclei, dig, ...) are checked by `npm run doctor`.

## Run (agent path)

```bash
PATH="$HOME/.local/node22/bin:$PATH" .claude/skills/run-hexsectempest/driver.mjs up
```

Spawns `npm run server` detached (log: `/tmp/t3mp3st-war-room.log`, pidfile:
`/tmp/t3mp3st-war-room.pid`), polls `/health`, and prints the UI URL. Boots in ~2s.
Safe by default: the server binds **127.0.0.1 only** unless `T3MP3ST_HOST=0.0.0.0` is set (don't).

| command | what it does |
|---|---|
| `up` | start server in background, wait for `/health` |
| `status` | print mode, LLM provider/model, mission state, arsenal counts |
| `smoke` | 8 checks: health, arsenal catalog/status, full receipt cycle, UI serving |
| `get <path>` | `GET /api/<path>`, pretty JSON (e.g. `get arsenal/catalog`) |
| `post <path> '<json>'` | `POST /api/<path>`, prints HTTP status + JSON |
| `down` | stop the server (kills by pidfile, or by port owner if launched elsewhere) |

Run it from the repo root (it spawns `npm run server` in `$PWD`).

### Browser UI

Use the playwright MCP tools against `http://127.0.0.1:3333/ui/`:

1. `browser_navigate` → the dashboard renders (mission STANDBY bar, sidebar: War Room /
   Live Scan / Scope Receipts / Operatives / Evidence Vault / CVE Vault / Arsenal / Terminal).
   A welcome modal appears on first load — dismiss via `Got it — I'll explore on my own`.
2. Navigate pages by clicking `div.nav-item[data-page="<id>"]` (e.g. `receipts`), NOT by
   text — sidebar labels match 3+ elements each.
3. `browser_take_screenshot` with a `filename` → lands at the **workspace root** (e.g.
   `war-room-dashboard.png`); accessibility snapshots land in `.playwright-mcp/`.

Verified UI flow: create a receipt via the API, click Scope Receipts — the receipt shows
in the panel with correct PENDING/APPROVED counters.

## Run (human path)

```bash
npm run server   # -> prints http://127.0.0.1:3333/ui — Ctrl-C to stop
```

CLI instead of server:

```bash
npm run dev -- --help   # t3mp3st CLI: interactive | setup | status | test | models
```

## Test

```bash
npx vitest run src/__tests__/hexstrike-job-receipt-static.test.ts   # fast single file (2 tests, <1s)
npm run doctor      # env/config sanity; also probes the live /health if the server is up
npm test            # full suite — slower, run before claiming anything passes
```

## Gotchas

- **`/ui/` is `docs/`** — `app.use('/ui', express.static('docs'))`. The dashboard SPA is
  `docs/index.html`; editing docs assets changes the app UI. `npm run docs:check` validates it.
- **State is in-memory** — approvals, missions, evidence reset on server restart
  (`storage.driver: "memory"` in `/health`). Don't expect a receipt created before a restart
  to still exist.
- **Approvals reject wildcards** — `POST /api/approvals/request` with `target: "*"` returns
  400 by design (ScopeGuard); use a concrete target, e.g. `http://127.0.0.1:3333`.
- **`/api/arsenal/catalog` is not a flat list** — the tool count is `summary.total`
  (`{schema_version, summary:{total, commandReady, ...}, ...}`), not `tools[]`.
- **Playwright text locators are ambiguous on this SPA** — `text=Scope Receipts` matches the
  nav item, a mission-spine cell, and the page heading. Target `div.nav-item[data-page=...]`.
- **Server started outside the driver has no pidfile** — `driver.mjs down` falls back to
  finding the port owner via `ss -ltnp`, so it still stops it.
- **Args after `--`** — `npm run dev --help` shows npm's help; the CLI needs
  `npm run dev -- --help`.

## Troubleshooting

- **`Server did not become healthy within 60s`**: read `/tmp/t3mp3st-war-room.log` — a TS
  error from a stale `node_modules` is the usual cause; `npm install` and retry.
- **`ENOENT ... t3mp3st-war-room.pid`** on `down`: server wasn't launched by the driver
  (fixed in current driver via the ss fallback — if you see this, the driver is an old copy).
- **`driver.mjs status` prints `Server not responding`**: server isn't running — run `up`.
