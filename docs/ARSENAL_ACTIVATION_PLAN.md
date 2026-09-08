# T3MP3ST Arsenal Activation Plan

This plan turns the visual 100+ tool loadout into a real local operator workstation without pretending missing binaries are ready. The backend reports three separate numbers:

- Catalog tools: the full UI loadout vocabulary.
- Wired adapters: tools the backend knows how to reason about, gate, and attach to evidence.
- Installed command adapters: wired tools present on this machine right now.

## Phase 1: Core Evidence And Recon

These unlock the baseline web, DNS, repo, and report loops.

If Homebrew is owned by a different macOS user, repair the prefix first:

```bash
sudo chown -R "$(whoami)":admin /opt/homebrew
brew doctor
```

```bash
brew install pipx
brew install nmap ffuf gobuster feroxbuster nikto dalfox sqlmap exiftool yara binwalk radamsa
brew install projectdiscovery/tap/subfinder projectdiscovery/tap/httpx projectdiscovery/tap/naabu projectdiscovery/tap/katana projectdiscovery/tap/nuclei
```

## Phase 2: Repository, Package, And Cloud

These make T3MP3ST useful as a package and supply-chain hunter.

```bash
brew install semgrep gitleaks trufflehog syft grype osv-scanner checkov
brew install aquasecurity/trivy/trivy
pipx install prowler
```

## Phase 3: AI And Agent Boundary Testing

These power prompt, tool, memory, and model-boundary regression packs.

```bash
npm install -g promptfoo
pipx install garak
```

## Phase 4: Smart Contract And Crypto

These fill the previously hollow smart-contract and crypto lanes.

```bash
npm install -g solhint
pipx install slither-analyzer mythril
brew install crytic/tap/echidna hashcat john
```

Foundry should be installed from the official Foundry installer, then verified with `forge --version` and `cast --version`.

## Phase 5: Reverse, Firmware, And Mobile

These move the harness toward local artifact and binary zero-day hunting.

```bash
brew install radare2 afl++ apktool jadx
```

## Held Behind Gates

Some tools should remain catalog-only or import-only until T3MP3ST has narrow adapters, scope receipts, and evidence redaction for each workflow:

- Metasploit: no generic shell-through execution.
- Hydra: no generic credential attack runner.
- BloodHound: import graph evidence first; collector execution needs explicit directory scope.

## Ship Criteria

Call the arsenal operational only when:

- `/api/arsenal/status` shows nonzero command-ready adapters for every mission family.
- High-value adapters for the active mission are installed or intentionally waived.
- Active or networked commands require ScopeGuard approval receipts.
- Tool output can be attached to evidence, linked to findings, and retested.
- Recovered secrets, credentials, tokens, and private keys are never written to the ledger.

## Linux Workstation Activation Record (2026-08-28)

The commands above are macOS/Homebrew-oriented. This workstation is Linux Mint
22.3 (Ubuntu Noble base), so the same loadout was installed with the native
package managers:

| Phase | Tools | Linux method |
| --- | --- | --- |
| Core evidence & recon | `yara`, `radamsa`, `whatweb`, `testssl`, `checksec` | apt / source build (radamsa from GitLab) |
| Web/API pressure | `feroxbuster`, `dalfox`, `naabu`, `dnsx`, `waybackurls` | upstream tarball / `go install` |
| Repo, package & cloud | `semgrep`, `checkov`, `prowler`, `syft`, `grype`, `osv-scanner`, `scoutsuite`, `pmapper`, `awscli`, `azure-cli` | pipx / Anchore installers / `go install` |
| AI & agent boundary | `garak`, `promptfoo` | pipx / npm |
| Smart contract & crypto | `slither-analyzer`, `mythril`, `echidna`, `solhint`, `cast` | pipx / GitHub releases / npm / Foundry release |
| Reverse, firmware & mobile | `radare2`, `afl++`, `apktool`, `jadx`, `ghidra` (+ OpenJDK 21) | apt / GitHub releases |
| Cloud CLI lane | `cloudfox`, `gcloud` (gcloud/gsutil/bq) | GitHub release / Google SDK tarball |
| Mobile extras | `apkleaks`, `mobsfscan`, `objection`, `drozer`, `wafw00f` | pipx |

Platform note: Ubuntu ships `testssl` (not `testssl.sh`); a
`~/.local/bin/testssl.sh -> /usr/bin/testssl` symlink matches the catalog's
expected binary name.

**Verified state**

- `npm run arsenal:doctor`: **67/68 command-ready tools (99%)**.
- `npm run arsenal:smoke` (against `npm run server`): **125/125 checks pass** —
  catalog spine, approval gates, evidence pipeline, local command execution,
  and mission control all green.

**Intentional waiver**

- `class-dump` is macOS-only (dumps Objective-C headers from Mach-O binaries
  via Apple tooling); it cannot run on Linux and is waived on this host. macOS
  operators should `brew install class-dump`.
