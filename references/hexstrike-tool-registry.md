# HexStrike tool-registry availability notes

Live snapshot from Flask `/health` `tools_status` on 2026-09-30 after Phase-1 batch
(unified-flask + probe aliases). Re-derive with `curl -s 127.0.0.1:8888/health`.

**Present (83):** previous 77 plus `outguess`, `sleuthkit` (PATH alias → `fls`), `ropgadget` (PATH alias → `ROPgadget`), `ropper`, `one-gadget`, `social-analyzer`.

**Absent (optional):** api-schema-analyzer autopsy autorecon burpsuite censys-cli clair dotdotpwn enum4linux evil-winrm exploit-db falco ghidra graphql-scanner hashpump have-i-been-pwned httpie insomnia jaeles jwt-analyzer kismet libc-database maltego metasploit msfconsole msfvenom paramspider postman pwninit pwntools recon-ng responder shodan-cli spiderfoot stegsolve volatility wfuzz wireshark x8 xsser zaproxy zsteg

## Notes

- `password` family is **5/5** (hashcat, john, hash-identifier, hashcat-utils, ophcrack).
- `ghidra` is listed absent in `tools_status` (PATH probe) but the `/api/tools/ghidra` route **executes** via the installed Ghidra 12.1.3 tree — PATH probe ≠ invocation correctness. Certified 2026-09-30 `success:true rc 0`.
- `burpsuite` / `metasploit` / `msfvenom` / `zaproxy` / `pwntools` stay **SKIP** (fenced in T3MP3ST — installing adds nothing callable).
- `verified_working` is last-run `exit==0`, not availability. Never-run tools are not execution bugs.
