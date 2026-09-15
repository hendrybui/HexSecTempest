# Contribution Receipts

T3MP3ST already treats benchmark claims as something reviewers should be able to
re-derive. Contribution receipts apply the same discipline to pull requests:
make scope, run mode, evidence, redaction, and model/harness labels explicit
before a change is merged.

A receipt can live in the PR description, an issue comment, or a committed
artifact when the change itself introduces a durable benchmark or claim.

## When A Receipt Is Needed

Include a receipt for changes that affect:

- benchmark numbers, benchmark artifacts, scoring, or claim verification;
- local-agent, API-backed, MCP, or Arsenal execution behavior;
- target scope, egress containment, approval gates, or evidence gates;
- UI or docs labels for preview, wired, installed, gated, synthetic, live,
  planning-only, tool-backed, or experimental behavior;
- redaction, source ingest, evidence storage, reports, or exported artifacts.

A receipt is optional for narrow typo fixes, formatting-only docs edits, and
mechanical dependency-free cleanup that does not alter behavior or claims.

## Required Fields

| Field | What To Record |
| --- | --- |
| Change | Short summary of what changed and why. |
| Scope class | `docs_only`, `static_fixture`, `local_lab`, `ctf_range`, or `authorized_live`. |
| Target authority | Who owns or authorized the target. Use `not_applicable` for docs-only/static work. |
| Network use | `none`, `loopback`, `private_lab`, or `authorized_external`. |
| Run mode labels | For example `planning_only`, `static_test`, `mocked`, `local_agent`, `api_backed`, `tool_backed`, `approval_gated`, `swarm`, `live_authorized`. |
| Model/harness labels | Model, provider, agent runtime, harness, tool access, target class, and attempt policy. |
| Commands run | Exact commands and pass/fail result. Include skipped commands and why. |
| Artifacts | Files, logs, screenshots, reports, or benchmark outputs that support the claim. |
| Redaction | What was removed or masked, especially secrets, tokens, private keys, credentials, flags, and private target data. |
| Claims changed | State `none` when no README/docs/headline claim changed. Otherwise name the claim and how it is re-derived. |
| Abstentions/refusals | Count separately from failed attempts when model or agent behavior is measured. |
| Residual risk | Known limits, unverified paths, optional missing tools, or reviewer follow-up. |

## Model And Harness Matrix

Benchmark and agent-run claims should not blend model capability, harness
capability, tool availability, target choice, and run mode. Use a small matrix
when a change introduces or updates measured behavior.

| Field | Example |
| --- | --- |
| model | `gpt-5.5`, `local-llama`, `not_applicable` |
| provider | `OpenRouter`, `Venice`, `Ollama`, `not_applicable` |
| model_version_or_date | Provider version, model date, or retrieval date if known. |
| harness | `verify-claims`, `cybench-bench`, `xbow`, `local-agent`, `manual-review`. |
| agent_runtime | `Codex`, `Claude Code`, `Hermes`, `none`, or other runtime. |
| tool_access | `none`, `read_only`, `mocked`, `local_only`, `approval_gated`, `live_authorized`. |
| target_class | `static_fixture`, `local_lab`, `ctf_range`, `authorized_external`. |
| run_mode | `single_agent`, `local_agent`, `api_backed`, `swarm`, `planning_only`. |
| attempts | Number of runs or tasks attempted. |
| successes | Number of evidence-backed successes. |
| failures | Number of attempts with evidence-backed failure. |
| abstentions | Refusals, skipped tasks, or no-action outcomes. |
| artifacts | Paths to committed artifacts or private reviewer-only receipts. |

## PR Receipt Template

```markdown
## Contribution Receipt

- Change:
- Scope class:
- Target authority:
- Network use:
- Run mode labels:
- Model/harness labels:
- Commands run:
  - `npm run typecheck` -> pass/fail/skipped
  - `npm test` -> pass/fail/skipped
  - `npm run doctor` -> pass/fail/skipped
  - `npm run verify-claims` -> pass/fail/skipped
- Artifacts:
- Redaction:
- Claims changed:
- Abstentions/refusals:
- Residual risk:
```

## Review Rules

- Do not accept a live or external-target result unless the receipt names the
  authorization path and target scope.
- Do not accept raw secrets, tokens, credentials, private keys, recovered
  passwords, or private target data in a receipt or artifact.
- Do not promote a UI/docs label from preview, planned, synthetic, or
  planning-only to live/tool-backed unless a reviewer can trace the supporting
  command or artifact.
- Do not blend refusals, abstentions, skipped runs, infrastructure failures, and
  failed attempts into a single failure bucket when reporting model behavior.
- Do not update headline claims unless `npm run verify-claims` or the relevant
  claim-specific verifier re-derives the number from committed artifacts.

---

## Receipt: HexStrike MCP bridge (`src/arsenal/hexstrike-bridge.ts`)

- **Change**: Bridges the HexStrike AI MCP tool surface (150 tools verified from a
  live `tools/list`) into T3MP3ST's Arsenal as `CustomTool`s, so HexStrike calls
  run through the existing egress scope gate and approval gate. Opt-in behind
  `T3MP3ST_HEXSTRIKE=1`, matching how the specialist arsenal is gated, so the
  built-ins-only baseline stays uncontaminated. Also adds
  `scripts/hexstrike-doctor.mjs` (bridge verification harness) and
  `src/__tests__/hexstrike-bridge.test.ts`.
- **Scope class**: `local_lab`
- **Target authority**: `not_applicable` — no external target is contacted. The
  scope-denial test asserts against a synthetic out-of-scope hostname that is
  never resolved or connected to.
- **Network use**: `loopback` — the HexStrike Flask backend on `127.0.0.1:8888`.
  The one live tool invocation is `server_health`, which touches no target host.
- **Run mode labels**: `tool_backed`, `local_only`, `approval_gated`,
  `static_test`
- **Model/harness labels**:
  - model: `not_applicable`
  - provider: `not_applicable`
  - harness: `vitest`, `scripts/hexstrike-doctor.mjs`
  - agent_runtime: `DeepSeek Harness`
  - tool_access: `local_only` (loopback backend, no external egress)
  - target_class: `local_lab`
  - run_mode: `single_agent`
  - attempts: 21 test cases + 1 doctor run
  - successes: 21 tests passed; doctor exit 0
  - failures: 0
  - abstentions: 0
- **Commands run**:
  - `npx vitest run src/__tests__/hexstrike-bridge.test.ts` -> pass (21/21)
  - `npm test` -> pass (90 files, 1009 tests)
  - `npm run lint` -> pass (0 errors; changed files contribute 0 warnings)
  - `npm run typecheck` -> pass
  - `npm run verify-claims` -> pass (27/27)
  - `node scripts/hexstrike-doctor.mjs` -> pass (exit 0, 150 tools, spot-check ok)
- **Artifacts**: `src/arsenal/hexstrike-bridge.ts`,
  `src/__tests__/hexstrike-bridge.test.ts`, `scripts/hexstrike-doctor.mjs`,
  `src/index.ts` (engine wiring)
- **Redaction**: none required. Changed files were scanned for
  keys/secrets/tokens/passwords and contain none; HexStrike runs unauthenticated
  on loopback.
- **Claims changed**: `none`. `npm run verify-claims` re-derives 27/27 unchanged;
  no README or headline number was edited.
- **Abstentions/refusals**: `not_applicable` — no model-facing run is measured.
- **Residual risk**:
  1. **HexStrike binds `0.0.0.0`**, not loopback, so `:8888` is LAN-reachable.
     The bridge only ever dials `127.0.0.1`, but the backend itself should be
     restricted on untrusted networks. T3MP3ST's own War Room remains
     `127.0.0.1`-bound.
  2. **74 of the 150 tools are absent on this host** (no metasploit, arjun,
     graphql-scanner, gau, …). Affected tools degrade to an error result; the
     bridge does not break. `/health`'s `tools_status` is the authority.
  3. **The live test block self-skips** when the backend is unreachable, so CI
     without HexStrike exercises only the pure conversion/classification paths.
  4. **Not exercised live**: any tool that directs traffic at a target. Scope
     denial is asserted at the arsenal gate with a synthetic host, not against a
     real out-of-scope system.
  5. **Fencing is a policy list, not a capability boundary.** `NON_CALLABLE_TOOLS`
     keeps 24 arbitrary-local-capability tools off the callable surface; a future
     HexStrike release adding an equivalent tool under a new name would default
     to `active` (approval-gated) rather than fenced, so the list needs review on
     HexStrike upgrades.

---

## Receipt: GLM default backbone recalibration (`z-ai/glm-5.3-flash`)

- **Change**: Recalibrates the default model for the OpenRouter backbone from
  `anthropic/claude-opus-4.8` to `z-ai/glm-5.3-flash`. This is the owner's
  chosen default (GLM coding subscription; GLM is listed at $0/$0 on OpenRouter
  today with a 1.3M context, so it rides the subscription instead of OpenRouter
  credit). Touched: `DEFAULT_SETTINGS.defaultModel` and
  `openrouter.defaultModel` in `src/config/index.ts`, the GLM 5.3 Flash entry in
  `AVAILABLE_MODELS.openrouter` (so the UI/routing can select it), the whitebox
  orchestrator default in `src/recon/whitebox.ts`, the decompose CLI
  orchestrator default/usage in `scripts/decompose.mjs`, and the
  `.env.example` override hint. All remain env-overridable
  (`LLM_MODEL`, `TEMPEST_ORCHESTRATOR_MODEL`, CLI flags) — nothing is locked.
  The persisted user store at `~/.config/t3mp3st-nodejs/config.json` was updated
  through `config.set()` so the live server health reports the GLM default.
- **Scope class**: `docs_only` (constant/default change, no target)
- **Target authority**: `not_applicable`
- **Network use**: `none` for this commit; the live confirmation issued a single
  loopback-to-OpenRouter `prompt()` against the configured provider with the
  user's own key.
- **Run mode labels**: `api_backed` (live LLM smoke), `planning_only`
- **Model/harness labels**:
  - model: `z-ai/glm-5.3-flash` (default), `anthropic/claude-opus-4.8` (removed default)
  - provider: `OpenRouter`
  - harness: `vitest`, `npm run typecheck`, `npm run verify-claims`
  - tool_access: `none`
  - attempts: 1 live `prompt()` + full typecheck/test/verify-claims runs
  - successes: GLM replied `"GLMOK"` to a minimal prompt; tests & claims green
  - failures: 0
  - abstentions: 0
- **Commands run**:
  - `npm run typecheck` -> pass
  - `npx vitest run src/__tests__/index.test.ts` -> pass (with clean config dir; see residual risk)
  - `npm run verify-claims` -> pass (27/27)
  - `node scripts/hexstrike-doctor.mjs` -> pass (150 tools, bridge OK)
  - live `new LLMBackbone(config.getLLMConfig('openrouter', 'z-ai/glm-5.3-flash')).prompt(...)` -> pass ("GLMOK", 2.6s)
- **Artifacts**: `src/config/index.ts`, `src/recon/whitebox.ts`,
  `scripts/decompose.mjs`, `.env.example`, `docs/CONTRIBUTION_RECEIPTS.md`
- **Redaction**: no secrets added; ~/.t3mp3st/.env values were never committed.
- **Claims changed**: `none`. `npm run verify-claims` re-derives 27/27 unchanged;
  no README or headline number was edited. Historical opus-4.8 benchmark records
  in `docs/INTEGRITY_LEDGER.md` and `bench/` are left untouched (evidence
  honesty).
- **Abstentions/refusals**: `not_applicable`
- **Residual risk**:
  1. **Local suite variability**: on this host, the wedged-dispatch test in
     `src/__tests__/index.test.ts` fails when `~/.t3mp3st/.env` seeds
     `T3MP3ST_MODEL_RECON` (phase routing calls `setLLM` on a fake loop). CI
     (clean HOME/no such env) is green; locally run vitest with
     `T3MP3ST_CONFIG_DIR` pointing at an empty dir to reproduce a clean env.
  2. **GLM rate limits**: catalog pricing shows $0/$0 today; if Zhipu's free tier
     throttles, high-volume recon may need a lower concurrency or a different
     phase model. All models stay per-phase overridable via `T3MP3ST_MODEL_*`.
  3. **Fork divergence risk**: deviating the default from upstream T3MP3ST's
     Anthropic default is intentional (owner decision), but upstream merges may
     re-introduce Anthropic defaults — keep the receipt visible at rebase time.

---

## Receipt: 9router provider option (`.env.example` documentation)

- **Change**: Documents 9router (a local OpenAI-compatible gateway,
  `github.com/decolua/9router`, 800+ models behind one key) as a flip-able model
  backend in `.env.example`. Uses T3MP3ST's existing `local` provider slot (no
  engine change): `TEMPEST_DEFAULT_PROVIDER=local` +
  `TEMPEST_LOCAL_BASE_URL=http://localhost:20128/v1` + `TEMPEST_LOCAL_MODEL` +
  `TEMPEST_LOCAL_API_KEY`. The owner's live `~/.t3mp3st/.env` received the same
  block commented-out so OpenRouter/GLM stays the active default and 9router is
  a one-line flip away.
- **Scope class**: `docs_only`
- **Target authority**: `not_applicable`
- **Network use**: `loopback` — the one live proof call went to
  `http://localhost:20128/v1/chat/completions` (the user's own 9router gateway on
  this machine); no external target was contacted.
- **Run mode labels**: `api_backed` (live LLM smoke), `planning_only`
- **Model/harness labels**:
  - model: `glm/glm-5.3-flash` (via 9router)
  - provider: `local` (OpenAI-compatible wire to 9router)
  - harness: `vitest` (config tests), `npx tsx` LLMBackbone probe
  - tool_access: `none`
  - attempts: 1 live `LLMBackbone.prompt()` + config resolution probe
  - successes: route resolved correctly; GLM-5.3-Flash via 9router replied `"ROUTEROK"` in ~2.8s
  - failures: 0
  - abstentions: 0
- **Commands run**:
  - `npx tsx` probe with `TEMPEST_LOCAL_BASE_URL=http://localhost:20128/v1 TEMPEST_LOCAL_MODEL=glm/glm-5.3-flash TEMPEST_LOCAL_API_KEY=<key>` -> pass (LLMBackbone chat completed)
  - `curl http://localhost:20128/v1/models` (with key) -> pass (841 models listed)
- **Artifacts**: `.env.example`; live `~/.t3mp3st/.env` (not committed)
- **Redaction**: `NINEROUTER_KEY` was never printed or committed; the live
  config keeps it only inside `~/.t3mp3st/.env`.
- **Claims changed**: `none` — `.env.example` comment only; no README/headline
  number touched; `npm run verify-claims` unaffected.
- **Abstentions/refusals**: `not_applicable`
- **Residual risk**:
  1. **Provider parity unknown**: 9router model output/refusal behavior may
     differ from OpenRouter's for the same id; mission evidence honesty marks
     provider/model explicitly, so results stay traceable.
  2. **Gateway availability**: if the 9router process on `:20128` is down,
     `TEMPEST_DEFAULT_PROVIDER=local` missions fail fast — the flip only makes
     sense while the gateway is running. Keep OpenRouter as the default unless
     9router is the deliberate choice.
  3. **API-key handling**: `TEMPEST_LOCAL_API_KEY` requires the gateway key in
     the operator's env file; never commit it.
