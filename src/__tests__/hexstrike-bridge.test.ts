/**
 * HexStrike bridge tests.
 *
 * The pure conversion/classification functions run everywhere (no HexStrike
 * needed). The live integration block is skipped unless a HexStrike backend is
 * reachable, so CI without HexStrike stays green while a local operator with the
 * service running gets real end-to-end coverage.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  HexStrikeBridge,
  NON_CALLABLE_TOOLS,
  riskTierForTool,
  convertInputSchema,
  normalizeToolResult,
  DEFAULT_HEXSTRIKE_CONFIG,
} from '../arsenal/hexstrike-bridge.js';
import { Arsenal } from '../arsenal/index.js';

// =============================================================================
// PURE: risk classification
// =============================================================================

describe('riskTierForTool', () => {
  it('fences arbitrary local capability as dangerous', () => {
    for (const name of ['execute_command', 'create_file', 'delete_file', 'install_python_package']) {
      expect(riskTierForTool(name)).toBe('dangerous');
      expect(NON_CALLABLE_TOOLS.has(name)).toBe(true);
    }
  });

  it('classifies credential attack tooling as credential', () => {
    expect(riskTierForTool('hydra_attack')).toBe('credential');
    expect(riskTierForTool('hashcat_crack')).toBe('credential');
  });

  it('classifies injection testing as intrusive', () => {
    expect(riskTierForTool('sqlmap_scan')).toBe('intrusive');
    expect(riskTierForTool('dalfox_xss_scan')).toBe('intrusive');
  });

  it('classifies passive collection as passive', () => {
    expect(riskTierForTool('subfinder_scan')).toBe('passive');
    expect(riskTierForTool('waybackurls_discovery')).toBe('passive');
  });

  it('classifies local artifact analysis as local_read', () => {
    expect(riskTierForTool('strings_extract')).toBe('local_read');
    expect(riskTierForTool('checksec_analyze')).toBe('local_read');
  });

  it('defaults unknown tools to active — never silently trusted', () => {
    // The conservative default is the point: a newly-added HexStrike tool that
    // nobody classified must be gated as a network action, not waved through.
    expect(riskTierForTool('some_future_tool_nobody_classified')).toBe('active');
  });
});

// =============================================================================
// PURE: schema conversion
// =============================================================================

describe('convertInputSchema', () => {
  it('maps required flags and descriptions', () => {
    const params = convertInputSchema({
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Host to scan' },
        ports: { type: 'string', description: 'Port list' },
      },
      required: ['target'],
    });
    expect(params).toHaveLength(2);
    const byName = new Map(params.map((p) => [p.name, p]));
    const target = byName.get('target');
    const ports = byName.get('ports');
    expect(target?.required).toBe(true);
    expect(target?.description).toBe('Host to scan');
    expect(ports?.required).toBe(false);
  });

  it('preserves enum members and drops non-scalar ones', () => {
    const params = convertInputSchema({
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['low', 'high', { bad: true }] },
      },
    });
    expect(params[0].enum).toEqual(['low', 'high']);
  });

  it('handles a missing schema without throwing', () => {
    expect(convertInputSchema(undefined)).toEqual([]);
    expect(convertInputSchema({})).toEqual([]);
  });

  it('falls back to string for an unknown type', () => {
    const params = convertInputSchema({
      type: 'object',
      properties: { weird: { type: 'integer64' } },
    });
    expect(params[0].type).toBe('string');
  });
});

// =============================================================================
// PURE: result normalization
// =============================================================================

describe('normalizeToolResult', () => {
  it('unwraps MCP content blocks and recovers the JSON payload', () => {
    const raw = {
      content: [{ type: 'text', text: JSON.stringify({ success: true, stdout: 'port 80 open' }) }],
    };
    const result = normalizeToolResult('nmap_scan', raw, 12);
    expect(result.success).toBe(true);
    expect(result.output).toContain('port 80 open');
    expect(result.duration).toBe(12);
  });

  it('treats success:false as a failure and surfaces the error', () => {
    const raw = {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'nmap not found' }) }],
    };
    const result = normalizeToolResult('nmap_scan', raw, 5);
    expect(result.success).toBe(false);
    expect(result.error).toContain('nmap not found');
  });

  it('treats an absent success key as success (the call itself worked)', () => {
    const raw = { content: [{ type: 'text', text: JSON.stringify({ stdout: 'ok' }) }] };
    expect(normalizeToolResult('x_tool', raw, 1).success).toBe(true);
  });

  it('does not throw on a non-JSON text payload', () => {
    const raw = { content: [{ type: 'text', text: 'plain text output' }] };
    const result = normalizeToolResult('x_tool', raw, 1);
    expect(result.success).toBe(true);
    expect(result.output).toContain('plain text output');
  });
});

// =============================================================================
// LIVE: bridge against a running HexStrike
// =============================================================================

async function hexstrikeReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${DEFAULT_HEXSTRIKE_CONFIG.serverUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('HexStrikeBridge (live)', () => {
  let reachable = false;
  const bridge = new HexStrikeBridge();

  beforeAll(async () => {
    reachable = await hexstrikeReachable();
    if (!reachable) {
      console.warn('[hexstrike-bridge] backend unreachable — skipping live block');
      return;
    }
    await bridge.connect();
  }, 120_000);

  afterAll(async () => {
    if (reachable) await bridge.disconnect();
  });

  it('discovers the HexStrike tool surface', () => {
    if (!reachable) return;
    const status = bridge.getStatus();
    expect(status.connected).toBe(true);
    expect(status.discovered).toBeGreaterThan(100);
    // Fenced tools are discovered (so they are visible/auditable) but excluded
    // from the callable surface.
    expect(status.fenced).toBeGreaterThan(0);
    expect(status.callable).toBe(status.discovered - status.fenced);
  });

  it('never mints a fenced tool into the callable surface', () => {
    if (!reachable) return;
    for (const name of bridge.getDiscoveredToolNames()) {
      if (NON_CALLABLE_TOOLS.has(name)) {
        expect(bridge.toCustomTool(name)).toBeNull();
        expect(bridge.getAllCustomTools().some((t) => t.name === name)).toBe(false);
      }
    }
  });

  it('mints real CustomTools carrying a risk tier and schema', () => {
    if (!reachable) return;
    const tools = bridge.getAllCustomTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.riskTier).toBeDefined();
      expect(tool.category).toBe('hexstrike');
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('executes a real local tool end-to-end', async () => {
    if (!reachable) return;
    // server_health is local-only and touches no target host.
    const result = await bridge.execute('server_health', {});
    expect(result.success).toBe(true);
    expect(result.output).toBeTruthy();
  }, 120_000);

  it('refuses to execute a fenced tool', async () => {
    if (!reachable) return;
    const result = await bridge.execute('execute_command', { command: 'id' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('fenced');
  });

  it('registers into a real Arsenal and becomes an LLM tool definition', async () => {
    if (!reachable) return;
    const arsenal = new Arsenal();
    arsenal.registerMany(bridge.getAllCustomTools());

    // The point of the bridge: HexStrike tools must reach the model as callable
    // tool definitions AND stay behind the arsenal's gates.
    const defs = arsenal.getToolDefinitions();
    const names = defs.map((d) => d.name);
    expect(names).toContain('nmap_scan');
    expect(names).toContain('nuclei_scan');
    // Fenced tools must not appear in the model-visible surface.
    expect(names).not.toContain('execute_command');
    expect(names).not.toContain('delete_file');

    // A gated HexStrike tool keeps its risk tier through registration, so
    // Arsenal.execute() can refuse it without an approval receipt.
    const sqlmap = arsenal.getTool('sqlmap_scan');
    expect(sqlmap?.riskTier).toBe('intrusive');
  });

  it('denies an out-of-scope HexStrike target at the arsenal gate', async () => {
    if (!reachable) return;
    const arsenal = new Arsenal();
    arsenal.registerMany(bridge.getAllCustomTools());
    // Scope authorizes only example.test; the model asks for an unrelated host.
    arsenal.setScope({ allowedHosts: ['example.test'], allowLoopback: false, allowPrivate: false });

    const result = await arsenal.execute('nmap_scan', {
      target: 'out-of-scope.example.com',
      parameters: { target: 'out-of-scope.example.com' },
    } as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain('SCOPE DENIED');
  });
});
