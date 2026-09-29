import { describe, it, expect } from 'vitest';
import { ARCHETYPE_PROFILES } from '../operators/index.js';
import { BUILTIN_TOOLS, EXTERNAL_TOOLS } from '../arsenal/index.js';
import { buildAdapterTools } from '../arsenal/adapter-tools.js';
import { TOOL_ADAPTERS } from '../arsenal/catalog.js';
import { OPERATOR_SYSTEM_PROMPTS } from '../prompts/index.js';
import {
  BRIDGE_KNOWN_TOOLS,
  NON_CALLABLE_TOOLS,
  OPERATOR_TOOLKIT_BRIDGE_TOOLS,
  riskTierForTool,
} from '../arsenal/hexstrike-bridge.js';

// ─────────────────────────────────────────────────────────────────────────────
// NO PHANTOM TOOLS — the "advertised = wired" guard for the arsenal.
//
// An operator must never advertise a tool the harness can't call. Phantom names
// (metasploit/mimikatz, or a bare "nmap" when the real tool is "nmap_scan")
// burn the agent's iterations on calls that 404. This test makes that fail the
// build by construction — the same discipline as test:no-fitting, applied to tools.
//
// ONE conditional surface: HexStrike bridge tools are minted from the external MCP
// server at runtime (T3MP3ST_HEXSTRIKE=1), so they cannot be statically registered
// here. They are admitted only through the reviewed OPERATOR_TOOLKIT_BRIDGE_TOOLS
// declaration, and only because the arsenal's name allowlist INTERSECTS with
// registered tools — an unarmed bridge advertises none of them (pinned below).
// ─────────────────────────────────────────────────────────────────────────────

const REGISTERED = new Set([...BUILTIN_TOOLS, ...EXTERNAL_TOOLS].map((t) => t.name));
// FULL-arsenal adapters are minted per-mission; toolkits may reference them by
// their minted names (e.g. sqlmap_tool) — count them as wired too.
const ADAPTER_MINTED = new Set(
  buildAdapterTools(TOOL_ADAPTERS, {
    runSubprocess: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    isToolAvailable: async () => true,
    scopeOk: () => true,
    createReportWorkspace: async () => ({ reportBase: '', cleanup: () => Promise.resolve() }),
    readToolReport: async () => '',
  }, new Set()).map((t) => t.name),
);
// Bridge-only names: reviewed, conditionally minted (see the header note).
const BRIDGE_MINTED = new Set(OPERATOR_TOOLKIT_BRIDGE_TOOLS);
const WIRED = new Set([...REGISTERED, ...ADAPTER_MINTED, ...BRIDGE_MINTED]);
const TOOLKIT_ENTRIES = Object.entries(ARCHETYPE_PROFILES)
  .flatMap(([archetype, profile]) => profile.defaultTools.map((tool) => ({ archetype, tool })));

describe('no phantom tools (advertised = wired)', () => {
  it('the arsenal registers a non-trivial, unique set of callable tools', () => {
    const all = [...BUILTIN_TOOLS, ...EXTERNAL_TOOLS].map((t) => t.name);
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(new Set(all).size).toBe(all.length); // no duplicate tool names
  });

  it('every archetype defaultTool is a REGISTERED, callable tool', () => {
    const phantoms: string[] = [];
    for (const [archetype, profile] of Object.entries(ARCHETYPE_PROFILES)) {
      for (const tool of profile.defaultTools) {
        if (!WIRED.has(tool)) phantoms.push(`${archetype} → "${tool}"`);
      }
    }
    expect(
      phantoms,
      `phantom tools advertised by archetypes but not registered in the arsenal: ${phantoms.join(', ')}`,
    ).toEqual([]);
  });

  it('bridge names offered to toolkits are reviewed, recognised, non-fenced, and non-dangerous', () => {
    for (const name of OPERATOR_TOOLKIT_BRIDGE_TOOLS) {
      expect(BRIDGE_KNOWN_TOOLS.has(name), `"${name}" is not a name the HexStrike bridge recognises`).toBe(true);
      expect(NON_CALLABLE_TOOLS.has(name), `"${name}" is fenced and must never be offered to an operator`).toBe(false);
      expect(riskTierForTool(name), `"${name}" must not be danger-tier`).not.toBe('dangerous');
      expect(REGISTERED.has(name), `"${name}" is statically registered — it is not bridge-only`).toBe(false);
      expect(ADAPTER_MINTED.has(name), `"${name}" is adapter-minted — it is not bridge-only`).toBe(false);
    }
  });

  it('the bridge-toolkit declaration and the toolkits agree exactly (no unreviewed, no stale)', () => {
    const usedByToolkits = new Set(
      TOOLKIT_ENTRIES.map(e => e.tool).filter(t => !REGISTERED.has(t) && !ADAPTER_MINTED.has(t)),
    );
    const declared = new Set(OPERATOR_TOOLKIT_BRIDGE_TOOLS);
    expect(
      [...usedByToolkits].filter(n => !declared.has(n)).sort(),
      'toolkit entries minted by no static source and not declared in OPERATOR_TOOLKIT_BRIDGE_TOOLS',
    ).toEqual([]);
    expect(
      [...declared].filter(n => !usedByToolkits.has(n)).sort(),
      'declared bridge names no archetype toolkit actually uses (stale declaration)',
    ).toEqual([]);
  });

  it('operator system prompts reference no phantom binaries (advertise only what is wired)', () => {
    // Classic phantoms we do NOT wrap. Backtick-bare forms (`nmap`) distinguish the phantom
    // bare binary from the real registered tool (nmap_scan, which is `nmap_scan`).
    const PHANTOMS = ['metasploit', 'mimikatz', 'sqlmap', 'bloodhound', 'crackmapexec', 'nikto', 'wpscan', 'psexec', '`nmap`', '`nuclei`', '`burp`'];
    const hits: string[] = [];
    for (const [archetype, prompt] of Object.entries(OPERATOR_SYSTEM_PROMPTS)) {
      const low = String(prompt).toLowerCase();
      for (const p of PHANTOMS) if (low.includes(p.toLowerCase())) hits.push(`${archetype}: ${p}`);
    }
    expect(hits, `phantom binaries named in operator prompts: ${hits.join(', ')}`).toEqual([]);
  });

  it('every registered tool has a real handler (no metadata-only stubs)', () => {
    const noHandler = [...BUILTIN_TOOLS, ...EXTERNAL_TOOLS]
      .filter((t) => typeof t.handler !== 'function')
      .map((t) => t.name);
    expect(noHandler, `registered tools missing an executable handler: ${noHandler.join(', ')}`).toEqual([]);
  });
});
