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
