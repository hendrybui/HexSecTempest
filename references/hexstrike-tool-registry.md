# HexStrike tool-registry availability notes

Live snapshot from Flask `/health` `tools_status` on 2026-09-30 after the Phase-1
tool batches (unified-flask + honest probe fixes). Re-derive with
`curl -s 127.0.0.1:8888/health`.

**Present: 110 / 127 families.** Per-family counts and the present/absent lists are
re-derivable from `/health`; do not hand-edit numbers here.

## Absent (17) — categorized, not all fixable

**Fenced by design — must NOT be installed (6).** Installing adds nothing callable; the
T3MP3ST bridge keeps them inert (`NON_CALLABLE_TOOLS`): `burpsuite`, `metasploit`,
`msfconsole`, `msfvenom`, `pwntools`, `zaproxy`.

**No installable upstream (11):**

| Tool | Why absent |
|---|---|
| `hashpump` | Original upstream repo removed; the `hashpump` Rust crate ships an unrelated CLI. Installing it would report a false "available" that fails at call time — absent is the honest state. Route degrades cleanly. |
| `wfuzz` | Pins `pycurl<=7.43.0.3`, which cannot build on Python 3.12. Not packaged in noble. |
| `volatility` | v2 (Python 2). `volatility3` + `vol` are present and served by `/api/tools/volatility3`. |
| `maltego`, `postman`, `insomnia` | Proprietary GUI applications; no headless CLI distribution. |
| `autopsy`, `kismet` | No route in this Flask build — vestigial probe names. Autopsy is a Java GUI; the Sleuthkit CLI is present (`sleuthkit` → `fls`). |
| `clair`, `falco` | Container-runtime scanners; routes exist but need a container runtime/root and kernel instrumentation. |
| `have-i-been-pwned` | No upstream CLI by this name; no route in this build. |

## Honest probe fixes (false negatives corrected 2026-09-30)

`/health` probes PATH with `which`, which under-reported working tools. Fixes are
probe-only — no route, gate, or tool behaviour changed:

- `sleuthkit` → `fls` (Debian package installs `fls`, not `sleuthkit`)
- `ropgadget` → `ROPgadget` (pipx casing)
- `ghidra` → `analyzeHeadless` (Ghidra is a tree, not a PATH binary — the route already
  executed `success:true rc 0` while being reported absent)
- `shodan-cli` → `shodan`, `censys-cli` → `censys` (CLI install names)
- `exploit-db` → `searchsploit` (exploit-db IS the DB `searchsploit` queries)
- **In-process tools** (`graphql-scanner`, `jwt-analyzer`, `api-schema-analyzer`): the
  capability ships inside the Flask app and only shells out to `curl`; no upstream binary
  by those names exists. Probed by route definition + `curl`. All three verified
  end-to-end against loopback on 2026-09-30.

## Notes

- `password` **5/5** · `network` **10/10** · `vuln_scanning` **4/4** · `essential` **8/8** ·
  `forensics` **15/16** · `binary` **12/13**.
- `verified_working` is last-run `exit==0`, not availability — and the ring is in-process,
  so it resets on backend restart. Never-run ≠ execution bug.

