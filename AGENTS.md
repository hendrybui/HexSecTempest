# AGENTS.md

T3MP3ST — TypeScript multi-agent framework for **authorized** security testing: turns an AI coding agent into a kill-chain operator (recon → exploit → report) driven from a CLI, an Express "War Room" UI, or MCP. Node >= 22.19.0, ESM throughout, no native deps. `CLAUDE.md` holds a longer variant of this guidance.

## Commands

```bash
npm run build            # tsc → dist/
npm run dev              # tsx src/cli.ts (CLI)
npm run server           # tsx src/server.ts — War Room UI at http://127.0.0.1:3333/ui/
npm run lint             # eslint src/**/*.ts (no fix variant)
npm run typecheck        # tsc --noEmit
npm test                 # vitest src + ops-preflight + model-matrix + refusal-frontier self-tests
npx vitest run src/__tests__/<name>.test.ts   # single test file
npm run test:pr          # lint + typecheck + test + doctor (what CI runs on PRs)
npm run test:pr-coverage # enforces 50% changed-line coverage floor
npm run verify-claims    # re-derives every README claim number from committed data (must stay green)
npm run doctor           # env/config sanity check
```

Setup: copy `.env.example` → `.env`, or run `npm run setup` (interactive wizard). Provider keys (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, ...) or fully offline via `TEMPEST_LOCAL_BASE_URL`/`TEMPEST_LOCAL_MODEL`.

Domain benches/smokes follow `npm run <domain>:bench[:live]` (`cve:`, `cloud:`, `mobile:`, `binary:`, `cybench`, `obsidivm:`, plus `arsenal:smoke`, `exploit:smoke`, `smoke`). They score committed fixture corpora in `bench/` — they are benchmarks, not unit tests. CTF labs in `ctf/` are driven by `scripts/test-ctf-*.mjs`.

## Rebuild & update

- **After pulling, always `npm install`** — a stale `node_modules` breaks `typecheck`/`build` with misleading TS errors in `src/arsenal/browser.ts`. Then `npm run build` to regenerate `dist/` (used by `npm start`, `server:prod`, `mcp:prod`, `test:gate`).
- **Update from upstream:** `npm run update:dry` (preview the plan) → `npm run update` (interactive merge from upstream) → `npm run update:hard` (opt-in hard reset). Dispatches to `scripts/update.sh` / `update.ps1`; local secrets and run artifacts listed in `scripts/update-protected.txt` are preserved.
- **Arsenal tools Docker image:** `npm run tools:build` (`tools/build.sh`); verify with `tools:check`, install host tools with `install:tools`.
- **Docsite:** `docs/` is the source; `npm run docs:build` syncs + builds the Pagenary site, `npm run docs:check` validates it.
- **Obsidivm accumulator:** rebuilt from alive proposals via `node scripts/obsidivm-ablate.mjs rebuild` — don't hand-edit `bench/obsidivm-evolution/current.md`.
- **Releases:** publish only the retained, checksum-matched source ZIP — do not rebuild a different ZIP (`docs/RELEASE_CHECKLIST.md`).

## Architecture

Mission flow (the core loop): `src/server.ts` (Express API, large) or `src/cli.ts` (Commander) → `src/mission/` (`MissionControl`, `http-lifecycle`, `adjudicate`, `recovery`) → `src/operators/` (one OperatorAgent archetype per kill-chain phase; order in `KILL_CHAIN_ORDER`) → `src/arsenal/catalog.ts` (risk-tiered tool adapters) → `src/evidence/` ledger with secret redaction (`src/redact.ts`).

Extension points:
- New tool → `src/arsenal/catalog.ts` (id/risk/execution/evidenceKinds checklist) — the canonical extension point per CONTRIBUTING.md.
- New LLM provider → `LLMProvider` union in `src/types/index.ts`, wiring in `src/config/provider-models.ts` + `src/llm/index.ts`.
- Local coding agents (Claude Code, Codex, OpenCode...) are providers via `src/agent/local-agents.ts`.

Other subsystems: `src/general/`, `src/admiral/`, `src/recon/` (web-tree-sitter ingest), `src/prompts/` + `src/resources/`, `src/mcp-server.ts`, plus `threat-intel/`, `deception/`, `dfir/`, `opsec/`, `net/proxy`, `persistence/`, `reporting/`.

## Hard rules

- **ScopeGuard:** active/networked tools require approval receipts enforced in `src/mission/` + `src/arsenal/approval.ts` — see `docs/SCOPE_AND_AUTHORIZATION.md`. Do not weaken these gates.
- **Evidence honesty:** every quantitative claim must be re-derivable — `npm run verify-claims` must stay green. Never hand-edit a claimed number.
- **Contribution receipts:** changes touching claims/modes/execution/scope/egress/redaction/bench need an entry in `docs/CONTRIBUTION_RECEIPTS.md`.
- **Don't overclaim capability:** the README "What it hunts" table separates stable from scaffolding (cloud/mobile/binary = static-detection scaffolding; later kill-chain phases scaffolded). Match new claims to that table.

## Git layout & workflow

- `origin` = fork `hendrybui/T3MP3ST`; `upstream` = `elder-plinius/T3MP3ST`.
- **Never commit to or push `main`** — keep it mirroring `upstream/main`. Work on feature branches pushed to `origin` only.
- Conventional commits with PR number: `feat(arsenal): ... (#203)`.
- PRs stay scoped to their title (`git diff --name-status upstream/main...HEAD`); squash merges; no force-pushing published review history.
- `AGENTS.override.md`: maintainers may finish low-risk mechanical merge cleanup on an approved PR, never take over a branch needing product/architectural judgment.
- `.aiwg/` holds generated maintainer workflow artifacts (`maintainer:check` / `maintainer:sync`) — sync, don't hand-edit. Same for `WORKSPACE.md` (AIWG-managed).

## Local-env gotchas

- CI pins Node 22 (`.nvmrc`). A local Node 22 lives at `~/.local/node22` alongside the system Node — run repo commands with `PATH="$HOME/.local/node22/bin:$PATH" npm test`. (System Node 24 also satisfies `engines` and runs the suite green since the agent-path tests were made host-hermetic.)
- `src/__tests__/local-agent-path-resolution.test.ts` pins PATH isolation via `agentlessPath()` — hosts with real `claude`/`opencode` CLIs on `/usr/bin` used to leak them into these fixtures (13 spurious failures); don't reintroduce host PATHs there.
- The War Room server binds `127.0.0.1` by default; don't expose it. Outbound test traffic can go through `TEMPEST_PROXY_URL` (SOCKS5).
- `T3MP3ST_SOURCE_ROOT` scopes binary-analysis reads; `T3MP3ST_TRUST_CLAUDE_SESSION` gates session reuse (default 0).

## Docs to read before sensitive edits

`docs/DEVELOPER_GUIDE.md`, `docs/SCOPE_AND_AUTHORIZATION.md` (approval gates), `docs/TOOL_CALL_BOUNDARIES.md`, `docs/MODEL_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `docs/CONTRIBUTION_RECEIPTS.md`.
