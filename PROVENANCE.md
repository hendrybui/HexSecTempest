# Provenance and Attribution

HexSecTempest is a **derivative work** of T3MP3ST. This file records where it came
from, what was changed, and the license terms that carry over.

## Upstream

| | |
|---|---|
| **Original project** | T3MP3ST ("Tactical Execution Multi-agent Platform for Elite Security Testing") |
| **Upstream repository** | https://github.com/elder-plinius/T3MP3ST |
| **Upstream author** | elder-plinius and the T3MP3ST contributors |
| **License** | GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`) |

The upstream project is the origin of essentially all of this codebase: the
operator/kill-chain architecture, the Arsenal and its catalog, the War Room,
the mission lifecycle, ScopeGuard and the approval gates, the evidence ledger,
the benchmark harnesses, and the documentation.

## This derivative

| | |
|---|---|
| **Project** | HexSecTempest |
| **Repository** | https://github.com/hendrybui/HexSecTempest |
| **Maintainer** | hendrybui |
| **License** | `AGPL-3.0-or-later` — unchanged |

### What HexSecTempest adds

The distinguishing change is a **HexStrike tool backbone**: [HexStrike AI](https://github.com/0x4m4/hexstrike-ai)
exposes ~150 offensive-security tools (recon, network, web, API, cloud, binary,
OSINT) over MCP, and HexSecTempest bridges that surface into T3MP3ST's Arsenal so
every HexStrike call runs through the existing egress scope gate and approval
gate.

| Change | Where |
|---|---|
| HexStrike MCP bridge (150 tools; 24 arbitrary-capability tools fenced) | `src/arsenal/hexstrike-bridge.ts` |
| Bridge wired into the engine, opt-in via `T3MP3ST_HEXSTRIKE=1` | `src/index.ts` |
| Bridge verification harness | `scripts/hexstrike-doctor.mjs` |
| Bridge test suite (21 tests; live block self-skips without a backend) | `src/__tests__/hexstrike-bridge.test.ts` |
| Contribution receipt for the above | `docs/CONTRIBUTION_RECEIPTS.md` |
| Project identity: repository/homepage/bugs/author/bin | `package.json` |

HexStrike itself is **not vendored** into this repository. It is installed
separately at `/mnt/Pandora/Workshop/HexStrike` (or wherever `HEXSTRIKE_*` points)
and is governed by its own license — see https://github.com/0x4m4/hexstrike-ai.

### What is deliberately unchanged

Internal identifiers are retained on purpose, because renaming them would break
existing installs rather than rebrand them:

- the npm package `name` (`t3mp3st`) and the `T3MP3ST_*` environment variables;
- the `~/.t3mp3st/` config directory and `t3mp3st_state/v1` state path;
- the `t3mp3st_snapshots` SQL migrations;
- upstream's code structure, module layout, and benchmark harnesses.

`tempest` and `t3mp3st` remain valid CLI names; `hexsectempest` is added as an
alias. If you are a downstream user, nothing about your configuration needs to
change.

## License obligations

HexSecTempest is distributed under **AGPL-3.0-or-later**, the same license as
upstream. Redistribution therefore requires:

1. **Keeping this notice and the `LICENSE` file** — the AGPL text and upstream
   copyright are preserved verbatim in [`LICENSE`](LICENSE).
2. **Stating that changes were made** — itemised above.
3. **Providing complete corresponding source** to anyone who interacts with the
   software over a network (AGPL §13). This repository *is* that source.
4. **Not relicensing.** You may not relicense HexSecTempest or its upstream
   portions under more permissive terms.

Nothing in HexSecTempest is intended to weaken upstream's terms. Where this file
and `LICENSE` disagree, `LICENSE` governs.

## Reporting and contributions

- **HexSecTempest issues and pull requests** → https://github.com/hendrybui/HexSecTempest
- **Upstream T3MP3ST issues** → https://github.com/elder-plinius/T3MP3ST

Please do not route HexSecTempest-specific bugs (the HexStrike bridge especially)
to upstream. Conversely, defects that reproduce in unmodified upstream T3MP3ST
are upstream's to triage.

## Authorized use

Both upstream and this derivative are offensive-security tooling intended for
**authorized** testing only — penetration tests, red-team engagements, CTFs,
bug-bounty programs within their published scope, and systems you own. The
in-repo gates (ScopeGuard, approval receipts, the command allowlist, and the
bridge's fenced-tool set) exist to enforce that boundary. They are load-bearing;
do not remove or weaken them.
