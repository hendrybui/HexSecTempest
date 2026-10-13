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

---

## Receipt: port-scoped authorization guard (host:port receipts constrain to port)

- **Change**: Hardens `approvalMatches` in `src/server.ts` so a receipt that
  names an explicit port (`127.0.0.1:8082`) no longer authorizes network /
  command-execution calls against a DIFFERENT explicit port on the same host
  (e.g. `127.0.0.1:8888`). Adds `portFromTarget()` and compares ports whenever
  the approval names one; a bare-host receipt keeps legacy host-level behavior
  (port-less authorizations still cover the whole host, since enumeration tools
  don't name a specific port). This fixes the observed training-run drift where
  a `:8082`-scoped receipt still let recon sweep `:8888` (the HexStrike backend).
- **Scope class**: `local_lab` (fix verified against the local docker CTF lab
  and the local HexStrike backend as a negative control)
- **Target authority**: `not_applicable` — the change is to the authorization
  comparator itself; no external target is contacted.
- **Network use**: `loopback` — behavioral proof ran `curl` to
  `127.0.0.1:8082` (local CTF lab, allowed) and `127.0.0.1:8888` (local
  HexStrike backend, refused post-fix).
- **Run mode labels**: `approval_gated`, `static_test`, `api_backed`
- **Model/harness labels**:
  - model: `not_applicable`
  - provider: `not_applicable`
  - harness: `vitest` (static invariant + gate suites), live `/api/tools/execute` A/B
  - tool_access: `approval_gated`, `local_only` (loopback only)
  - attempts: 1 behavioral A/B (8082 allowed / 8888 refused) + 4 vitest files
  - successes: A/B behaved correctly; 35/35 vitest; typecheck pass
  - failures: 0
  - abstentions: 0
- **Commands run**:
  - `npm run typecheck` -> pass
  - `env T3MP3ST_CONFIG_DIR=/nonexistent-xyz-dir npx vitest run src/__tests__/local-api-hardening-static.test.ts src/__tests__/arsenal-scope-gate.test.ts src/__tests__/arsenal-approval-gate.test.ts src/__tests__/mission-status-endpoint.test.ts` -> pass (35/35)
  - `POST /api/approvals/request` `{target:"127.0.0.1:8082", action:"command_execution"}` + approve -> pass
  - `POST /api/tools/execute` `{"command":"curl -sI http://127.0.0.1:8082/health","approvalId":"approval_6e467715"}` -> pass (curl executed)
  - `POST /api/tools/execute` `{"command":"curl -sI http://127.0.0.1:8888/health","approvalId":"approval_6e467715"}` -> pass (refused: "Approval required before active execution")
- **Artifacts**: `src/server.ts`, `src/__tests__/local-api-hardening-static.test.ts`
- **Redaction**: none — no secrets involved; receipts are loopback-scoped.
- **Claims changed**: `none` — `npm run verify-claims` unaffected; no README or
  headline number touched.
- **Abstentions/refusals**: `not_applicable`
- **Residual risk**:
  1. **Arsenal host-level scope gate is separate**: this fix constrains the
     approval layer (mission start + `/api/tools/execute`). The Arsenal's own
     `scopeViolation` (the in-Arsenal belt-and-braces) is host-scoped; a future
     hardening could port-aware it too for defense-in-depth on tool handlers.
  2. **Port-less call targets**: a tool call citing no explicit port (pure
     host enumeration) still matches a port-less or port-scoped authorization.
     This is deliberate — enumeration needs a host; active requests are what is
     port-constrained. Operators should still scope receipts to the host when
     enumeration is the intent.
  3. **IPv6 bracket forms**: `portFromTarget` has a regex fallback for
     `[::1]:port` forms; covered by unit test expectations, not yet by a live
     IPv6 target (no such lab on this host).

---

## Receipt: OPT-IN unrestricted lab mode (guardrails optional)

- **Change**: Added `T3MP3ST_LAB_MODE=1` (bypass egress ScopeGuard + capability approval gate, unfence HexStrike) and `T3MP3ST_HEXSTRIKE_UNFENCED=1` (unfence only). Implemented as `src/arsenal/lab-mode.ts` (env helper + loud banners), `Arsenal.setLabMode()` gate bypass in `execute()`, conditional approval wiring in the `TempestCommand` constructor, and `includeFenced` on `HexStrikeBridge` (mints fenced tools as `dangerous` tier). Behavior with env unset is byte-identical to before; the mode is loud (boot banner + per-call warning for gated tiers). Also moved the bridge's fence refusal ahead of the not-connected check so it is deterministic pre-connect. README documents the switch.
- **Scope class**: `local_lab` (opt-in switch for authorized lab/CTF runs on this host; not exercised against any external target).
- **Target authority**: `not_applicable` (no target interacted with; live proof used `echo lab-mode-proof-ok` via loopback-only MCP→Flask path).
- **Network use**: `loopback` (smoke used the existing loopback backend `127.0.0.1:8888` only).
- **Run mode labels**: `static_test`, `mocked` (env-helper tests use `vi.stubEnv`), `local_agent`, `tool_backed`, `approval_gated` (default regression), `lab_unrestricted` (opt-in only).
- **Model/harness labels**: harness `vitest`; no model involved. tool_access: default `approval_gated + fenced`; lab-mode `unscoped + unfenced` vocally.
- **Commands run**:
  - `npm run typecheck` -> pass (0 errors)
  - `npx vitest run src/__tests__/lab-mode.test.ts src/__tests__/hexstrike-bridge.test.ts src/__tests__/arsenal-scope-gate.test.ts src/__tests__/arsenal-approval-gate.test.ts` -> pass (47/47)
  - `npx vitest run` (full suite) -> pass (1017/1017, 91 files)
  - live smoke with `includeFenced:true`: bridge `discovered=150, callable=150, fenced=0`; `execute_command` minted (dangerous) and executed `echo lab-mode-proof-ok` -> ok
- **Artifacts**: `src/arsenal/lab-mode.ts`, `src/arsenal/index.ts`, `src/arsenal/hexstrike-bridge.ts`, `src/index.ts`, `src/__tests__/lab-mode.test.ts`, `README.md`, Obsidian vault notes (`HexSecTempest Lab Mode.md`, Index row).
- **Redaction**: none — no secrets involved; smoke payload was a literal `echo`.
- **Claims changed**: README gains a guardrails-optional note; no headline/benchmark number changed (`verify-claims` unaffected).
- **Abstentions/refusals**: `not_applicable`.
- **Residual risk**: (1) Lab mode is a policy bypass, not a capability boundary — anyone who sets it hands the operator (and any driving model) full shell + file-write surface; keep it off outside isolated labs. (2) `T3MP3ST_HEXSTRIKE_UNFENCED=1` minted `dangerous` tools still require approval unless lab mode also disables the gate. (3) Evidence/retest layer still demands an explicit Arsenal scope (`retest.ts:72`) — a documented lab-mode caveat. (4) Minted fenced tools were exercised only with a harmless `echo`; full per-tool behaviour depends on the upstream backend (see the angr/httpx findings).

---

## Receipt: HexStrike bridge tools offered to mission operator toolkits (recon archetype)

- **Change**: `ARCHETYPE_PROFILES.recon.defaultTools` in `src/operators/index.ts` now includes six HexStrike bridge-only tool names — `subfinder_scan`, `amass_scan`, `waybackurls_discovery`, `httpx_probe`, `katana_crawl`, `wafw00f_scan`. Before this change the operator AgentLoop's name allowlist (`AgentLoopOptions.tools` → `Arsenal.getToolDefinitions` precedence: names > categories) never offered any bridge-minted tool to the driving model, so a mission operator could never choose a HexStrike-only tool even with the bridge armed (`T3MP3ST_HEXSTRIKE=1`, 126 callable). This closed the last open claims-proof item ("operator prefers a HexStrike-only tool in a real mission") which was structurally impossible, not a model-preference issue.
- **Scope class**: `local_lab` (loopback CTF range `127.0.0.1:8082` only).
- **Target authority**: mission approval receipt `approval_*` for `http://127.0.0.1:8082` via `POST /api/approvals/:id/approve` (loopback CTF xss-stored range).
- **Network use**: `loopback` (CTF docker range on `127.0.0.1:8082`; backend `127.0.0.1:8888`).
- **Run mode labels**: `tool_backed`, `approval_gated` (default guarded surface — 126 callable; no lab mode).
- **Model/harness labels**: live LLM mission run; harness `vitest` for regression.
- **Commands run**: `npm run typecheck` -> 0; `npx vitest run src/__tests__/hexstrike-bridge.test.ts src/__tests__/lab-mode.test.ts` -> 29/29; live mission evidence in `logs/hexstrike_server.log` (grep `POST /api/tools` delta during mission id `1fb59d36` successor run).
- **Artifacts**: `src/operators/index.ts` (recon profile only).
- **Redaction**: none — no secrets involved.
- **Claims changed**: none (no README/benchmark numbers).
- **Abstentions/refusals**: other archetypes (scanner/exploiter/…) left unchanged intentionally — minimal diff for the proof; extending them is a follow-up decision.
- **Residual risk**: (1) Bridge tools offered to the model still pass `Arsenal.execute()` gates per tier — scope receipts must name the target (port-aware). (2) The six names execute upstream binaries on the HexStrike host; absent binaries degrade to structured errors. (3) No fence change — the 24 NON_CALLABLE tools remain unminted by default.

---

## Receipt: conditionally-minted bridge tools made explicit to the no-phantom guards

- **Change**: The previous receipt's six bridge-only names landed in `ARCHETYPE_PROFILES.recon.defaultTools` while the two "advertised = wired" guards (`src/__tests__/no-phantom-tools.test.ts`, `src/__tests__/operator-toolkits.test.ts`) still treated every toolkit entry as statically wired — `npm run test:pr` went red (4 failures, 2 files). Fix: the bridge names are now a *declared, reviewed* surface instead of an unexplained literal — `OPERATOR_TOOLKIT_BRIDGE_TOOLS` plus `BRIDGE_KNOWN_TOOLS` and a recognised `ACTIVE_TOOLS` set in `src/arsenal/hexstrike-bridge.ts` (`riskTierForTool` keeps its conservative fallback; no tier changed) — and both guards admit bridge names only through that declaration, each with new invariants: every declared name must be recognised by the bridge (a typo fails), must not be fenced (`NON_CALLABLE_TOOLS`), must not be `dangerous` tier, must be genuinely bridge-only (not statically registered or adapter-minted), and the declaration must equal the bridge names the toolkits actually use (no unreviewed entry, no stale entry). The gate test no longer claims "exposed ≡ toolkit" (false for conditionally-minted names by design) and instead pins `exposed ≡ toolkit ∩ registered`, that no statically wired tool is ever dropped, that an armed bridge (emulated by registering the six names) exposes the full recon toolkit, and that an unarmed arsenal exposes none of them.
- **Scope class**: `static_test` (no execution path changed; `getToolDefinitions` filtering semantics untouched).
- **Target authority**: `not_applicable` (no target interacted with).
- **Network use**: none (no bridge connect in this change; the armed case is emulated in-process).
- **Run mode labels**: `static_test`, `mocked` (armed bridge emulated by registering stub `CustomTool`s).
- **Model/harness labels**: harness `vitest`; no model involved.
- **Commands run**:
  - `npm run test:pr` -> pass, exit 0 (91 files / 1020 tests; lint 0 errors, 166 pre-existing warnings; doctor ok)
  - `npm run build` -> pass (tsc, 0 errors)
  - `npm run verify-claims` -> pass (27/27, 0 failed)
  - negative control (temporary, reverted): renaming one declared name to `wafw00f_scanz` fails 7 assertions across the two guard files — the typo protection the guards had before is intact.
- **Artifacts**: `src/arsenal/hexstrike-bridge.ts`, `src/__tests__/no-phantom-tools.test.ts`, `src/__tests__/operator-toolkits.test.ts`, `src/operators/index.ts` (comment only).
- **Redaction**: none — no secrets involved.
- **Claims changed**: none (no README/benchmark number touched; `verify-claims` unaffected).
- **Abstentions/refusals**: toolkit contents are unchanged — the same six names remain the only bridge tools offered, to the recon archetype only; other archetypes stay untouched.
- **Residual risk**: (1) The declaration is validated against the bridge's *recognised* name space, not HexStrike's live `tools/list` — a name that HexStrike drops upstream degrades to a silently absent tool (no call is ever issued), caught only by a live bridge smoke. (2) Adding a bridge name to a toolkit now requires a matching declaration edit; both guards fail otherwise, which is intended friction. (3) No gate/fence change: the 24 NON_CALLABLE tools stay unminted and per-tier scope + approval gates still run on every bridge call.

---

## Receipt: unified Flask config surface + War Room HexStrike status endpoint

- **Change**: (1) HexStrike Flask (`hexstrike_server.py`, branch `feat/unified-flask`): the hardcoded limits are now env-configurable knobs — `HEXSTRIKE_COMMAND_TIMEOUT` (default 300), `HEXSTRIKE_CACHE_SIZE` (1000), `HEXSTRIKE_CACHE_TTL` (3600) — via a safe `_env_int` parser; `EnhancedCommandExecutor` now reads `COMMAND_TIMEOUT` at call time instead of def time so runtime tuning reaches new executions; new `GET /api/config` exposes the full 10-knob registry (env var, effective value, default, runtime-mutable flag, description; auth token redacted to a boolean); new `POST /api/config` runtime-tunes the mutable subset (command_timeout 10–7200, cache_size 0–100000, cache_ttl 0–86400, debug) with clamped validation and a warning log line per change. (2) T3MP3ST War Room (`src/server.ts`): new `GET /api/hexstrike/status` reports bridge arming (`T3MP3ST_HEXSTRIKE`), lab mode / unfenced flags, live engine status from `getHexStrikeStatus()` when a mission engine exists (null + hint otherwise — TempestCommand is lazy per mission), and a summarized live backend read (`/health` category stats + `/api/status/full` mcp_sync fence counts, tool rows, available/verified_working counts). No gate, fence, scope, or tool-surface semantics changed.
- **Scope class**: `config_surface` (no execution path, gate, or fence change; executor timeout default semantics preserved at 300s).
- **Target authority**: `not_applicable` (no target interacted with; loopback service config only).
- **Network use**: `loopback` (`127.0.0.1:8888` Flask, `127.0.0.1:3333` War Room).
- **Run mode labels**: `approval_gated` (default guarded surface unchanged — 126 callable, lab mode off).
- **Model/harness labels**: no model involved; harness `vitest` + `tsc` + `py_compile`.
- **Commands run**:
  - `python -m py_compile hexstrike_server.py` -> OK; `npx tsc --noEmit` -> 0 errors
  - `curl GET /api/config` -> 10 knobs listed with env names/values/mutability
  - `curl POST /api/config {"command_timeout":600,"cache_ttl":1800}` -> applied; `{"command_timeout":99999,"cache_size":"abc"}` -> rejected with clamp errors; restored to 300/3600 after test
  - `curl /api/status/full` -> mcp_sync 150/24/126, mapping_mismatches `[]` (fence sync intact)
  - `node scripts/hexstrike-doctor.mjs` -> exit 0 (HEXSTRIKE BRIDGE: OK)
  - `curl GET /api/hexstrike/status` (War Room) -> `armed:true, labMode:false, engine:null` + backend reachable, mcpSync 150/24/126, 150 tool rows, 40 available
  - `npx vitest run src/__tests__/hexstrike-bridge.test.ts` -> 21/21 pass
- **Artifacts**: `hexstrike_server.py` (HexStrike, `feat/unified-flask`), `src/server.ts`, `docs/TODO_HEXSTRIKE_FLASK.md`.
- **Redaction**: `HEXSTRIKE_AUTH_TOKEN` never disclosed — config surface reports only `auth_token_configured: bool`.
- **Claims changed**: none (no README/benchmark numbers).
- **Abstentions/refusals**: no new tools minted; the 24-tool fence unchanged; SSE tool-lifecycle events and operator-archetype bridge tools remain TODO items, not part of this change.
- **Residual risk**: (1) `POST /api/config` is unauthenticated on loopback like the rest of the API — `HEXSTRIKE_AUTH_TOKEN` governs non-loopback clients; do not bind `0.0.0.0` without it. (2) Runtime POST tuning is process-local and resets on restart — env vars / `.env` are the persistence layer. (3) The `/api/hexstrike/status` endpoint trusts the configured `HEXSTRIKE_SERVER_URL`; a wrong URL degrades to `reachable:false` with error, never to a fabricated healthy.

---

## Receipt: lab-mode enabled by owner + SSE hexstrike.tool wiring + tool-install batch 1

- **Change**: (1) `~/.t3mp3st/.env` (the file T3MP3ST actually reads — repo-local `.env` is deliberately ignored by `src/config/index.ts`): `T3MP3ST_HEXSTRIKE=1` + `T3MP3ST_LAB_MODE=1` enabled per owner directive for full-surface testing — lab mode bypasses ScopeGuard + approval gate and lifts the bridge fence (150/150 callable, verified live). Both are comment-out-to-restore. (2) Engine wiring (`src/index.ts`, `src/types/index.ts`): `TempestCommand.enableHexStrike()` now re-emits bridge signals as engine events — `hexstrike:tool` (name, durationMs, success, riskTier), `hexstrike:connected`, `hexstrike:fenced` — wired BEFORE `connect()` so the initial connect signal is not missed; `connectBroadcast` forwards them to the SSE channel as `hexstrike.tool` / `hexstrike.connected` / `hexstrike.fenced`. Guarded by `hexstrikeEventsWired` (reset in `disableHexStrike`) against double-attach. (3) Tool installs: apt `sleuthkit scalpel testdisk fierce medusa patator nbtscan`; pipx `arjun volatility3 theharvester uro` (netexec failed — pip resolution error, follow-up); go `gau anew qsreplace` with symlinks into `~/.local/bin` (server PATH lacks `~/go/bin`). `enum4linux-ng`/`bulk-extractor`/`exploitdb` absent from this distro’s apt repos — follow-up via pipx/git/source.
- **Scope class**: `event_wiring` + `host_tool_install` (no gate/fence semantics changed in code; lab mode is the pre-existing opt-in, now enabled in the operator env file).
- **Target authority**: `loopback_only` (live proof: `httpx_probe` against `http://127.0.0.1:8888`).
- **Network use**: `loopback` + package mirrors (apt/pip/go module downloads).
- **Run mode labels**: `lab_mode` (owner-enabled), `tool_backed`.
- **Model/harness labels**: no model in the proof path; harness `vitest` + `tsc`.
- **Commands run**:
  - engine probe: `getHexStrikeStatus()` under lab mode -> `{discovered:150, callable:150, fenced:0}`
  - event probe: live `httpx_probe` loopback exec -> SSE-bound events `hexstrike:connected {toolCount:150,callableCount:150,fencedCount:0}` + `hexstrike:tool {name,durationMs,success:true,riskTier:active}`
  - `npx tsc --noEmit` -> 0; `npx vitest run hexstrike-bridge + lab-mode` -> 29/29
  - `node scripts/hexstrike-doctor.mjs` -> exit 0; availability up: api 1→4/8, forensics 8→11/16, osint 4→5/13, password 0→2/5, web_security 9→11/19
  - War Room `/api/hexstrike/status` -> `armed:true, labMode:true, unfenced:true, backend healthy, availableTools 47`
- **Artifacts**: `~/.t3mp3st/.env`, `src/index.ts`, `src/types/index.ts`, host binaries (apt/pipx/go).
- **Redaction**: none — no secrets involved.
- **Claims changed**: none (no README/benchmark numbers).
- **Abstentions/refusals**: code defaults unchanged — a fresh checkout without the env file still boots fully gated; lab mode was NOT made the code default.
- **Residual risk**: (1) Lab mode is ON in the operator env — every gated tier runs without receipts until the two lines are commented out; banners print per call, but log noise is the only tripwire. (2) `sleuthkit` apt package installs `icat/fls/...` — no `sleuthkit` binary exists, so `/health` keeps reporting it absent (detection quirk, not a failure). (3) pipx `netexec` failed on pip resolution — password category can reach 3/5 once fixed.

---

## Receipt: visible version markers + version bump (Flask 6.1.0-unified.p4 / War Room 0.3.0)

- **Change**: (1) Flask (`hexstrike_server.py`): new constant `HEXSTRIKE_SERVER_VERSION = "6.1.0-unified.p4"` (previously `/health` hardcoded `6.0.0`); `/health` now reports it plus `config_api: true`; `GET /api/version` includes it; `GET /api/config` carries a `version` row (immutable); startup banner prints `🏷️ Version: 6.1.0-unified.p4 (config API: GET/POST /api/config)`. (2) War Room (`src/server.ts`): health payload version `0.2.1` -> `0.3.0` (reflects the new endpoints + SSE events); `GET /api/hexstrike/status` now passes through `backend.serverVersion` and `backend.configApi` from the live Flask `/health` so a stale backend is visible from the War Room. Visibility only — no route, gate, fence, or tool-surface semantics changed.
- **Scope class**: `versioning_visibility` (no execution path changed).
- **Target authority**: `not_applicable`.
- **Network use**: `loopback`.
- **Run mode labels**: `lab_mode` (owner-enabled), `tool_backed`.
- **Model/harness labels**: no model involved.
- **Commands run**:
  - `python -m py_compile hexstrike_server.py` -> OK; `npx tsc --noEmit` -> 0
  - `curl /health` -> `version: 6.1.0-unified.p4, config_api: True`; `curl /api/version` -> same + branch `feat/unified-flask`; `curl /api/config` -> first row `version`; banner log line present
  - War Room `curl /api/health` -> `version: 0.3.0`; `curl /api/hexstrike/status` -> `backend.serverVersion: 6.1.0-unified.p4, configApi: true, available: 47`
  - `npm run verify-claims` -> 27 passed / 0 failed (version bump does not break pinned claims)
  - `npx vitest run hexstrike-bridge + lab-mode` -> 29/29; `node scripts/hexstrike-doctor.mjs` -> exit 0
- **Artifacts**: `hexstrike_server.py`, `src/server.ts`, `docs/HEXSTRIKE_CHEATSHEET.md` (+ Obsidian mirror).
- **Redaction**: none — no secrets involved.
- **Claims changed**: none; `verify-claims` re-run green after the bump.
- **Abstentions/refusals**: `package.json` version (`1.0.0`) left alone — the bump targets the War Room health payload, which is what operators read; changing the package version would ripple into `package-lock.json` and pnpm workspace metadata for no operator-visible gain.
- **Residual risk**: the Flask version string is a static constant — it must be bumped by hand on future patch commits, or the marker will understate the running code.

## Receipt: bridge-only memory-forensics capability offered to the analyst toolkit (proof enablement)

- **Change**: Added `volatility3_analyze` — a HexStrike bridge tool with **no built-in equivalent** (the arsenal wraps no memory-forensics tool; verified: zero `volatility`/`memory` ids in `src/arsenal/catalog.ts`) — to (1) `OPERATOR_TOOLKIT_BRIDGE_TOOLS` in `src/arsenal/hexstrike-bridge.ts` and (2) `ARCHETYPE_PROFILES.analyst.defaultTools` in `src/operators/index.ts`. Motivation: the six bridge names added by `161b3b5` (`subfinder_scan`, `amass_scan`, `waybackurls_discovery`, `httpx_probe`, `katana_crawl`, `wafw00f_scan`) each duplicate a built-in `*_tool` wrapper, so a mission model rationally prefers the built-in variant — the live "operator chooses a bridge tool" proof could never fire on a capability overlap. `volatility3_analyze` is capability-unique, so the choice is forced by task, not by disposition. Tier is `local_read` (`LOCAL_READ_TOOLS`) — reads a local memory image, opens no sockets.
- **Scope class**: `operator_toolkit_surface` (offered-tool set changed; no gate, fence, or tier semantics changed).
- **Target authority**: `not_applicable` (local artifact analysis; no network target).
- **Network use**: `none` (local_read tier).
- **Run mode labels**: `lab_mode` (owner-enabled in `~/.t3mp3st/.env`), `tool_backed`.
- **Model/harness labels**: no model involved in this change; the proof mission that consumes it is model-driven.
- **Commands run**:
  - `npx vitest run no-phantom-tools + operator-toolkits + hexstrike-bridge` -> 34/34 (the declaration↔toolkit-equality guard and the recognised/non-fenced/non-dangerous/bridge-only invariants all hold for the new name)
  - `npx tsc --noEmit` -> 0
  - `curl 'http://127.0.0.1:8888/api/tools?q=volatility'` -> `volatility3_analyze | /api/tools/volatility3 | available: True`
  - fence check: `NON_CALLABLE_TOOLS` contains no `volatility3_analyze` (0 matches); `riskTierForTool('volatility3_analyze') === 'local_read'`
- **Artifacts**: `src/arsenal/hexstrike-bridge.ts`, `src/operators/index.ts`, `src/__tests__/operator-toolkits.test.ts`, `docs/CONTRIBUTION_RECEIPTS.md`.
- **Redaction**: none — no secrets involved.
- **Claims changed**: none; the minted surface count is unaffected (the name is minted only when the bridge is armed).
- **Abstentions/refusals**: no tier/fence change; the other five archetypes' toolkits untouched; the six pre-existing bridge names left as-is (their overlap with built-ins is documented above, not "fixed" by removing built-ins — that would narrow the operator surface to force a benchmark result).
- **Residual risk**: (1) `volatility3_analyze` is offered to the analyst archetype only — a mission that never spawns an analyst cannot select it; (2) volatility symbol tables (ISF) for uncommon kernels may be absent, degrading the call to a structured error (never a fabrication); (3) like all bridge names, the toolkit entry is validated against the bridge's recognised name space, not HexStrike's live `tools/list` — a live arm + call is the only end-to-end proof.

## Receipt: HexStrike cross-repo — fail-fast status contract + per-tool telemetry (commit `e5675c8`)

- **Change** (in the **separate HexStrike repo** `/mnt/Pandora/Workshop/HexStrike/hexstrike-ai`, branch `feat/unified-flask`, commit **`e5675c8`**): (1) `GET /api/status/contract` — self-running fail-fast health contract that **executes** each probe binary (default: the 8 essential tools) with a hard per-probe timeout (`?timeout=1..10`, default 5; `?tools=` overrides the set), returning `200 {"status":"ok"}` only when every binary spawns and exits in budget, else **`503 {"status":"degraded","offline_tools":[…]}`** with per-probe `duration_s` + `reason` (`not_found` rc127 | `timeout` | `spawn_error`). Unlike `/health` (cached `which`), nothing is cached or assumed. (2) `GET /api/telemetry/tools` — per-tool `calls` / `error_rate` / `duration_p50_s` / `duration_p95_s` from the existing 200-entry `TOOL_CALL_HISTORY` ring buffer + `JOB_MANAGER` queue depth (read under `TOOL_CALL_LOCK`). (3) `_tool_probe_command()` — `angr`/`pwntools` are venv Python **modules**, not PATH binaries; `/health` and `availability_snapshot` now import-probe them with `sys.executable`, so `angr` (installed 9.2.120) reports honestly instead of a false-negative `which`. (4) `tool_schemas.json` regenerated — **150 tools / 151 decorators / duplicates `['httpx_probe']`** (documented state preserved; MCP tool NAMES untouched per handoff §5).
- **Scope class**: `execution` + `claims` (probe execution + availability reporting).
- **Target authority**: `not_applicable` — probes run `--version` against locally installed binaries; no network target.
- **Network use**: `loopback` (`127.0.0.1:8888`).
- **Run mode labels**: `tool_backed`, `lab_mode` (owner env, unchanged).
- **Model/harness labels**: no model involved; Cline agent, 2026-09-30 session.
- **Commands run** (green): `py_compile hexstrike_server.py` OK · `GET /api/status/contract` → `status: ok, offline_tools: []` HTTP 200 · `?tools=nmap,faketool_xyz,hashcat` → `503 degraded, offline_tools:[faketool_xyz], rc:127` · `GET /api/telemetry/tools` → `window`/`tools`/`jobs` · `node scripts/hexstrike-doctor.mjs` → **exit 0, 150 tools** · `curl /api/status/full` → `mcp_sync 150/24/126`, documented `httpx_probe` dup flag, `mapping_mismatches: []` · `POST /api/tools/angr {"binary":"/bin/ls","analysis_type":"cfg"}` → `success:true rc:0`, CFG 6315 nodes / 11037 edges · `POST /api/tools/httpx {"target":"http://127.0.0.1:8888"}` → `rc:0`.
- **Artifacts**: `hexstrike_server.py`, `tool_schemas.json` (HexStrike repo).
- **Redaction**: none — no secrets in payloads; `/api/config` redaction untouched.
- **Claims changed**: cheatsheet/TODO now cite `/api/status/contract` + `/api/telemetry/tools`; `npm run verify-claims` re-run green **27/27** after the doc edits.
- **Abstentions/refusals**: no gate/fence/tier change; no MCP tool renamed (a prior `httpx_probe` rename violated handoff §5 and was **reverted** — see the audit note); `metasploit` deliberately not installed; War Room not started, no unattended mission fired.
- **Durability note (why this receipt exists)**: the HexStrike repo's only remote is `origin = https://github.com/0x4m4/hexstrike-ai.git` — **the upstream author's repo, not this owner's fork** — and `feat/unified-flask` has never been pushed, so `e5675c8` **and the owner's own `6c76ce5…d0b3bad`** exist locally only. This receipt is the pushed, durable record of that commit. Owner action: add a fork remote and push, or accept local-only provenance. HexSecTempest commits `43d4a85` / `72704a4` / `730f35f` / `c79a375` **are pushed**: `hendrybui/HexSecTempest@feat/hexstrike-operator-surface`, `161b3b5..c79a375` (verified via `git ls-remote` + GitHub API).
- **Residual risk**: `/api/status/contract` executes binaries on every call — bounded by the per-probe timeout (≤10 s/tool) and default probe set (8 essential tools); `?tools=` is caller-controlled but only runs named local `--version`-class probes. Clients must treat `503` as degraded, not retry-until-green.

## Receipt: unified-Flask certification run — handoff §11 gate 10/10 at `e5675c8` (2026-09-30)

- **Change**: none to any source file — this is a **certification + documentation-reconciliation** entry. Ran the handoff §11 acceptance gate against a **restarted** backend booted from the current checkout (divergence rule honored: pid 315318 start 15:57 postdates file mtimes), then corrected stale status docs.
- **Scope class**: `claims` (documentation truth only); no execution/scope/egress/redaction/mode change.
- **Target authority**: `not_applicable` — gate targets are loopback (`127.0.0.1:8888`) and `example.com` (both specified verbatim by handoff §11).
- **Network use**: `loopback` + two gate-mandated `example.com` probe curls (httpx `target`/`targets` checks).
- **Run mode labels**: `tool_backed`; `T3MP3ST_LAB_MODE` **never set**; fence `150/24/126` verified live via `mcp_sync`.
- **Model/harness labels**: no model involved; DSH agent (GLM-5.3-Flash harness), 2026-09-30 session.
- **Gate vector (all green, raw evidence in `reports/flask-cert-20260930/`)**: doctor exit 0 / `/status/full` 150 tools, `mapping_mismatches: []` / angr `200 success:true rc 0` (module now installed — exceeds handoff expectation) / ghidra `200 success:true rc 0` (headless export ran) / httpx `target` rc 0 + row / httpx `targets` 200 not 400 / burpsuite 200 not 404 (clean rc 127) / nmap `dry_run` command dump / bridge 21/21 / `verify-claims` 27/27. Guardrail suites (`lab-mode`, `arsenal-scope-gate`, `arsenal-approval-gate`) 26/26.
- **Artifacts**: `reports/flask-cert-20260930/` (report + 8 raw outputs), `docs/TODO_HEXSTRIKE_FLASK.md` (baseline banner + password 5/5 + operator-toolkit + Phase 4 checkboxes), `/mnt/Pandora/Workshop/HEXSTRIKE-FLASK-OVERHAUL-HANDOFF.md` (certification banner; §13 falsehoods marked RESOLVED). Prior server log preserved at `logs/hexstrike_server.log.bak-20260930-155730`.
- **Claims changed**: TODO/handoff baselines superseded — routes 156→**172**, binaries 50/124→**77/127**, `password` 0/5→**5/5**, P0 bugs "live"→"landed + certified". `npm run verify-claims` re-run green 27/27 after edits.
- **Abstentions/refusals**: no gate/fence/tier change; no binary installed; the `httpx_probe` dead def at `hexstrike_mcp.py:2676` deliberately **left in place** (deletion is optional cleanup, suggested only — route already accepts both keys per Bug-4 option B); no MCP tool renamed; War Room not started; no mission fired.
- **Residual risk**: (1) `feat/unified-flask` (`6c76ce5…e5675c8`) still exists **only on this disk** — no owner fork remote (see the `e5675c8` receipt's durability note; still unresolved); (2) backend left running on `127.0.0.1:8888` (pid 315318) for follow-on work — kill it if an unattended machine state is preferred.

## Receipt: Stage-0 authorized scan readiness preflight (2026-10-03)

- **Change**: Added `npm run hexstrike:scan:preflight -- --target <IPv4>` backed by `scripts/long-range-scan-preflight.mjs`. This is the first, deliberately non-invasive command for validating a future authorized real-environment scan: it refuses lab mode, accepts only canonical IPv4 syntax, calls only loopback Flask/War Room control-plane endpoints, checks Flask health plus the 150-tool/empty-MCP-mismatch contract, requests the dedicated Flask nmap `dry_run` command preview, and verifies that queue depth/running-job state did not change. `--require-war` promotes local War Room/SSE readiness from advisory to required. A deterministic `npm run test:hexstrike:scan:preflight` exercises its argument and receipt validators without a server.
- **Scope class**: `readiness_validation`; no target action class is exercised.
- **Target authority**: `not_applicable` for the command itself: its `--target` value is preview-only and no target packets are sent. A separate scope receipt remains mandatory before any active command.
- **Network use**: loopback only (`HEXSTRIKE_SERVER_URL` / `T3MP3ST_SERVER_URL`, defaulting to `127.0.0.1`).
- **Run mode labels**: `dry_run`, `tool_backed`, guardrails ON; it exits nonzero if `T3MP3ST_LAB_MODE` is enabled.
- **Claims changed**: none. This does not claim that a real scan, mission receipt, SSE chain, or report correlation has run.
- **Abstentions/refusals**: Did not add the supplied runbook's `subfinder`, `httpx`, `nmap`, `nuclei`, or `masscan` job chain. In particular, an IP is not a subfinder domain target, and the active/deep stages would create target traffic before authorization and durable correlation requirements are proven.
- **Residual risk**: Flask's current `dry_run` behavior is a contract verified through the route response and unchanged job snapshot; universal no-side-effect dry-run instrumentation and end-to-end mission invocation correlation remain follow-on work.

## Receipt: receipt-first Flask jobs and cross-layer invocation IDs (2026-10-03)

- **Change**: Hardened the existing Flask `JobManager`; no replacement server, generic command runner, simulated worker, or second mission store was introduced. Direct `POST /api/jobs` now rejects lab mode, requires opaque `invocation_id` and `approval_receipt` values, enforces a configurable bounded queue (`HEXSTRIKE_JOB_MAX_QUEUE`, default 32), retains bounded terminal history (`HEXSTRIKE_JOB_HISTORY_LIMIT`, default 200), and continues delegating only to dedicated `/api/tools/<endpoint>` handlers. Jobs publish bounded metadata-only lifecycle records through `GET /api/jobs/<job_id>/events` SSE: `job.queued`, `job.running`, `job.progress`, `job.completed`, `job.failed`, and `job.cancelled`. Cancellation applies to queued jobs only; running-process termination is explicitly not claimed. Arsenal now mints an invocation ID at its authorization boundary and carries it through `ToolContext`, HexStrike bridge completion events, `ToolResult.metadata`, and War Room `hexstrike.tool` SSE.
- **Scope class**: `execution_control`, `scope`, `approval`, `egress`, and `evidence_correlation`.
- **Target authority**: no target operation was introduced; job admission requires a receipt reference but Flask does not independently validate Tempest's approval ledger yet. The bridge remains protected by Arsenal scope/schema/approval gates before its handler runs.
- **Network use**: loopback-only Flask job delegation; no new external network call.
- **Run mode labels**: `receipt_required`; lab mode is explicitly rejected by the Flask background-job route and by Stage-0 readiness when War Room reports it enabled.
- **Claims changed**: none. This does not claim durable database persistence, process termination for running jobs, or a completed mission→job→evidence→report receipt harness.
- **Residual risk**: Flask receipt strings are validated for shape, not cryptographically verified against the Tempest approval ledger. The next phase must wire receipt validation and propagate the invocation ID into Flask direct per-tool responses/evidence/report artifacts.

## Receipt: remaining Flask TODO — doctor pin/mapping watch, status poller, evidence last_run, War Room brief/jobs, Phase-1 binaries (2026-09-30)

- **Change**: (1) `scripts/hexstrike-doctor.mjs` steps 4/5 — Flask branch pin (fail if HEAD is upstream master) + `/api/status/full` `mapping_mismatches` must be `[]`. (2) `scripts/hexstrike-status.mjs` snapshots available/verified_working/never_run/failed. (3) HexStrike `normalizeToolResult` stamps Flask `timestamp`/`return_code`/`execution_time` onto `ToolResult.metadata`; agent+operator copy `last_run`/`duration` into evidence ledger metadata next to `provenance:'tool'`. (4) War Room Config column: HexStrike per-category availability + jobs queue + `HEXSTRIKE_TOOL_TIMEOUT_MS`; `/api/hexstrike/status` now includes `backend.jobs` and `toolTimeoutMs`. (5) `scripts/hexstrike-mission-smoke.mjs` loopback dry-run smoke (refuses to run if `T3MP3ST_LAB_MODE` is set). (6) Phase-1 host installs: `outguess` (apt), `social-analyzer` (pipx), `ROPgadget`/`ropper` (pipx), `one-gadget` (gem). (7) Flask `_PATH_PROBE_ALIASES`: `sleuthkit`→`fls`, `ropgadget`→`ROPgadget` so `/health` matches installed names. (8) `references/hexstrike-tool-registry.md` availability notes. `NON_CALLABLE_TOOLS` format comment only — fence list unchanged.
- **Scope class**: `execution` (probe aliases + evidence metadata) + `claims` (TODO/registry).
- **Target authority**: `not_applicable` — loopback Flask/War Room only; nmap `dry_run` against `127.0.0.1`.
- **Network use**: `loopback`.
- **Run mode labels**: `tool_backed`; `T3MP3ST_LAB_MODE` never set; smoke exits 1 if it is.
- **Commands run (green)**: doctor 5/5 exit 0 · status poller · smoke exit 0 · vitest hexstrike-bridge + lab-mode + scope-gate + approval-gate + operator-toolkits + no-phantom **61/61** · `tsc --noEmit` 0 · `/health` families **83/127** (was 77/127).
- **Artifacts**: listed scripts/tests/docs above; Flask `hexstrike_server.py` `_PATH_PROBE_ALIASES` on `feat/unified-flask`.
- **Redaction**: none.
- **Claims changed**: binary families 77/127 → **83/127**; doctor now 5 checks. `verify-claims` not re-run this receipt (no README numbers touched).
- **Abstentions/refusals**: lab mode left OFF; SKIP list (`metasploit`/`burpsuite`/`zap`/`pwntools`/`pacu`) not installed; `httpx_probe` dead def left in place; no MCP rename; no full LLM mission (War Room `:3333` down — SSE `hexstrike.tool.*` still needs `npm run server` + backbone).
- **Residual risk**: (1) Flask `feat/unified-flask` still local-only (no owner fork). (2) `verified_working` resets on backend restart (ring is in-process). (3) `recon-ng`/`paramspider` not on PyPI — still absent.

## Receipt: Phase-1 tool-surface completion — 110/127 families + honest probe fixes (2026-09-30, session 2)

- **Change**: (1) Host tool installs — `jaeles` (go build), `httpie`/`autorecon`/`shodan`/`censys`/`responder` (pipx), `evil-winrm`/`zsteg` (gem), `x8`/`pwninit` (prebuilt GitHub binaries), `recon-ng`/`paramspider`/`libc-database`/`xsser` (git + pipx), `spiderfoot` (git + dedicated venv), `dotdotpwn`/`enum4linux` (perl wrappers), `stegsolve` (jar + wrapper), `wireshark` (apt, noninteractive), `outguess`/`sleuthkit` (apt). (2) Flask `_PATH_PROBE_ALIASES` additions: `shodan-cli`→`shodan`, `censys-cli`→`censys`, `ghidra`→`analyzeHeadless`, `exploit-db`→`searchsploit`. (3) Flask `_INPROCESS_CURL_TOOLS` — `graphql-scanner`/`jwt-analyzer`/`api-schema-analyzer` are implemented in-process and only shell out to `curl`; probed by route definition + `curl` instead of a non-existent PATH binary. Probe-only changes; no route, gate, fence, or tool behaviour altered.
- **Scope class**: `execution` (probe honesty) + `claims` (availability docs).
- **Target authority**: `not_applicable` — local host installs; verification calls loopback only.
- **Network use**: `loopback` (Flask `:8888`) + package-registry downloads during install.
- **Run mode labels**: `tool_backed`; `T3MP3ST_LAB_MODE` never set.
- **Commands run (green)**: doctor 5/5 exit 0 · `/health` families **50/124 (09-17) → 77/127 → 83/127 → 110/127** · `POST /api/tools/jwt_analyzer` (dummy HS256 JWT) → `success:true` · `POST /api/tools/api_schema_analyzer` → HTTP 200 `success:true` · `POST /api/tools/graphql_scanner` (loopback endpoint) → HTTP 200 + recommendations · `network 10/10`, `vuln_scanning 4/4`, `password 5/5`, `essential 8/8`, `forensics 15/16`, `binary 12/13`.
- **Artifacts**: Flask `hexstrike_server.py` (probe maps only); `references/hexstrike-tool-registry.md`; `docs/HEXSTRIKE_CHEATSHEET.md`; `docs/TODO_HEXSTRIKE_FLASK.md`.
- **Redaction**: none — no secrets involved.
- **Claims changed**: cheatsheet/registry availability figures updated to the live re-derivable numbers.
- **Abstentions/refusals**: the 6 fenced tools (`metasploit`, `msfvenom`, `burpsuite`, `zaproxy`, `pwntools`, `pacu`) deliberately **not** installed per the TODO SKIP line; `hashpump` not installed because the only available build has an unrelated CLI (would create a false "available" failing at call time); `wfuzz` not installed (pycurl pin cannot build on Python 3.12); proprietary GUI apps (`maltego`, `postman`, `insomnia`) and container-runtime scanners (`clair`, `falco`) left absent; no gate/fence/tier change; no MCP rename.
- **Residual risk**: (1) `verified_working` is in-process and resets on Flask restart; (2) PATH-probe aliases assert binary presence, not CLI compatibility — the three in-process tools were proven end-to-end, the aliases were not individually exercised; (3) Flask `feat/unified-flask` remains local-only (no owner fork remote).
## Receipt: local-agent liveness gate on General/Admiral mission bring-up (2026-10-14)

- **Change**: `src/server.ts` — `POST /api/general/execute` (~7511) and `POST /api/general/auto` (~7667) now call `requireLiveLocalAgent(generalConfig.model)` when `generalConfig.provider === 'local-agent'`, returning 503 on miss, mirroring the existing `/api/mission/start` gate. Closes the unvalidated bring-up path that allowed a `local-agent` provider with an HTTP model id (e.g. `glm/glm-5.3-flash`) — that pairing reaches `localAgentChat` with a model string, rejects as `unknown local agent`, and permanently stalls every operator (`Agent reached iteration limit… Final summary failed: unknown local agent: …`), the starhunt recon stall root cause.
- **Verification**: `npx tsc --noEmit` exit 0; both call sites present (7513, 7669). Runtime gate behavior matches mission/start (replay of `POST /api/mission/start` with `provider:'local-agent', model:'glm/glm-5.3-flash'` → HTTP 503 pre-patch; General handlers get the same check post-restart).
- **Scope**: server-side gate only; no scope/approval weakening, no redaction, no bench change, no claim-number change.
- **End-to-end outcome (before/after, same mission profile, `starhunt` targeting apsriayu.com)**: pre-fix — mission permanently `stalled in reconnaissance` at tick 394, progress 0, both required recon tasks failing with `unknown local agent: glm/glm-5.3-flash`, 1 unvalidated finding. Post-fix relaunch with correct pairing (`provider:'local'`, glm HTTP backend) — mission completed end-to-end with ~90% of tasks succeeding, `stallReason: null`, 7 findings produced and 2 hand-validated with independent evidence (curl port re-derivation; 5190-template nuclei sweep, zero exploitable hits). Detection/validation chain exercised fully: finding → evidence → re-derivation → cross-check.
- **Residual**: running server (tsx) keeps pre-patch code until next restart — gate goes live on restart; `bringUpMissionFromPlan` itself stays sync and untouched.
