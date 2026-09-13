# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

T3MP3ST is a TypeScript multi-agent framework for **authorized** security testing: it turns an AI coding agent into a kill-chain operator (recon → exploit → report) driven from a CLI, an Express "War Room" UI, or MCP. Node >= 22.19.0, ESM throughout.

Local-env caveats (verified 2026-09-09): CI pins Node 22 — on Node 24 the mock-based tests in `src/__tests__/local-agent-path-resolution.test.ts` fail (13 tests); prefer Node 22 locally. Run `npm install` after pulling — a stale `node_modules` breaks `typecheck`/`build` with misleading TS errors in `src/arsenal/browser.ts`.

## Git layout (this checkout)

- `origin` = the fork `hendrybui/T3MP3ST`; `upstream` = `elder-plinius/T3MP3ST`.
- Never commit to or push `main` — keep it mirroring `upstream/main`. Work goes on feature branches pushed to `origin` only.
- Commits are conventional with PR number: `feat(arsenal): ... (#203)`, `fix(obsidivm): ...`, `docs: ...`.

## Commands

```bash
npm run build            # tsc
npm run dev              # tsx src/cli.ts (CLI)
npm run server           # tsx src/server.ts — War Room UI at http://127.0.0.1:3333/ui/
npm run doctor           # env/config sanity check
npm run lint             # eslint src/**/*.ts (no fix variant)
npm run typecheck        # tsc --noEmit

npm test                 # vitest run src + ops-preflight + model-matrix + refusal-frontier self-tests
npx vitest run src/__tests__/<name>.test.ts   # single test file

npm run test:pr          # lint + typecheck + test + doctor (what CI runs on PRs)
npm run test:pr-coverage # enforces 50% changed-line coverage floor
npm run test:release     # full release certification chain (verify-claims, gates, build, smoke, docs:check)
npm run verify-claims    # re-derives every README claim number from committed data (must stay green)
npm run docs:check       # validates the Pagenary docsite in docs/
```

Setup: copy `.env.example` to `.env`. Provider keys (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `NOVITA_API_KEY`, ...) or fully offline via `TEMPEST_LOCAL_BASE_URL`/`TEMPEST_LOCAL_MODEL`; `T3MP3ST_SOURCE_ROOT` scopes binary analysis reads; `T3MP3ST_TRUST_CLAUDE_SESSION` gates session reuse (default 0). `npm run setup` is the interactive wizard.

Domain benches/smokes follow the `npm run <domain>:bench[:live]` pattern (`cve:`, `cloud:`, `mobile:`, `binary:`, `cybench`, `obsidivm:`, plus `arsenal:smoke`, `exploit:smoke`, `smoke`). They benchmark the platform against committed fixture corpora in `bench/` — they are not unit tests.

## Architecture

**Mission flow (the core loop, spans several files):**
`src/server.ts` (Express API, large) or `src/cli.ts` (Commander) → `src/mission/` (`MissionControl`, `http-lifecycle`, `adjudicate`, `recovery`) → `src/operators/` OperatorAgents, one archetype per kill-chain phase (`KILL_CHAIN_ORDER`: RECON → WEAPONIZE → DELIVER → EXPLOIT → INSTALL → C2 → ACTIONS) → `src/arsenal/catalog.ts` tool adapters (risk-tiered) → `src/evidence/` ledger with secret redaction (`src/redact.ts`).

**Key extension points:**
- New tool → `src/arsenal/catalog.ts` (id/risk/execution/evidenceKinds checklist) — the canonical extension point per CONTRIBUTING.md.
- New LLM provider → `LLMProvider` union in `src/types/index.ts`, wiring in `src/config/provider-models.ts` + `src/llm/index.ts` (LLMBackbone abstraction; context compression and tool-call repair boundaries live in `src/llm/`).
- Local coding agents (Claude Code, Codex, OpenCode, Oh My Pi...) are treated as providers via `src/agent/local-agents.ts`.

**Other subsystems:** `src/general/` (OpGeneral planning over Directives), `src/admiral/` (plain-English intake), `src/recon/` (whitebox repo ingest via web-tree-sitter + attack graph), `src/prompts/` + `src/resources/` (operator doctrine, mission-family prompt packs), `src/mcp-server.ts` (MCP exposure of the same arsenal), plus `threat-intel/`, `deception/`, `dfir/`, `opsec/`, `net/proxy`, `persistence/`, `reporting/`.

**ScopeGuard:** active/networked tools require approval receipts enforced in `src/mission/` + `src/arsenal/approval.ts` — see `docs/SCOPE_AND_AUTHORIZATION.md`. Do not weaken these gates.

**CTF labs vs benches:** `ctf/` holds isolated deterministic labs (blind-SQLi, stored-XSS, SSRF, format-string, ...) each driven by `scripts/test-ctf-*.mjs`; `bench/` holds fixture corpora scored by `scripts/*-bench.mjs`.

**Capability maturity:** the README "What it hunts" table separates stable from scaffolding — web recon→exploit, CTF solves, whitebox ingest, and the OSS coordinated-disclosure pipeline are stable; cloud/mobile/binary are static-detection scaffolding only, smart contracts reproduce known vulns, and later kill-chain phases are scaffolded (README ~line 302). Don't overclaim beyond that table.

## Workflow rules that gate merging

- **Evidence-honest culture:** every quantitative claim (README scores, status tables) must be re-derivable — `npm run verify-claims` re-derives README numbers (27/27) from committed data. Never hand-edit a claimed number.
- **Contribution receipts:** changes touching claims/modes/execution/scope/egress/redaction/bench require an entry in `docs/CONTRIBUTION_RECEIPTS.md`.
- CI (`ci.yml`): PRs to main run `test:pr` + 50% changed-line coverage; `v*` tags run the full release certification (`test:release`, `npm audit`, deterministic `git archive` zip + clean-build smoke).
- PRs must stay scoped to their title (check `git diff --name-status upstream/main...HEAD`); squash merges; no force-pushing published review history. Untested behavior changes are blocked.
- `AGENTS.override.md`: maintainers may finish low-risk mechanical cleanup on an otherwise-approved PR (re-run gates, tell the contributor) — but never take over a branch needing product/architectural judgment.
- `.aiwg/` holds maintainer workflow artifacts (`bt6-maintainer.yaml` via `maintainer:check`/`maintainer:sync`) — sync don't hand-edit.

## Docs

`docs/` (~40 flat topic guides: GETTING_STARTED, DEVELOPER_GUIDE, SCOPE_AND_AUTHORIZATION, MODEL_MATRIX, RELEASE_CHECKLIST, ...) is the source for the Pagenary docsite built into `docsite/` (`npm run docs:build`, checked by `docs:check`).
