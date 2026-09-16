/**
 * T3MP3ST × HexStrike bridge — VERIFIED against HexStrike AI v6.0.
 *
 * HexStrike exposes 150 MCP tools (`tools/list`, verified) over a stdio frontend
 * (`hexstrike_mcp.py`) that proxies each call to a Flask backend
 * (`hexstrike_server.py`) on http://127.0.0.1:8888.
 *
 * This module turns those tools into T3MP3ST `CustomTool`s so the engine's
 * Arsenal can register them and operators can call them.
 *
 * ── Safety design (do not weaken) ────────────────────────────────────────────
 * T3MP3ST's guarantees live in `Arsenal.execute()`: the egress scope gate
 * (`scopeViolation`) and the capability-approval gate (`ApprovalController`)
 * both run BEFORE any handler body. This bridge adds no bypass — it only maps
 * HexStrike's surface onto that pipeline.
 *
 * Three deliberate restrictions:
 *
 *  1. NON_CALLABLE_TOOLS are discovered but NEVER minted into CustomTools.
 *     Several HexStrike tools are arbitrary local capability — `execute_command`
 *     (shell), `create_file`/`modify_file`/`delete_file` (filesystem writes),
 *     `execute_python_script`, `install_python_package`, and the payload
 *     generators. Minting those would hand the model a shell and a filesystem
 *     that T3MP3ST's command allowlist was built to deny. This mirrors how
 *     `catalog.ts` fences metasploit/hydra/frida as `catalog_only`.
 *
 *  2. Every minted tool carries an explicit `riskTier`, so the approval gate
 *     treats credential/intrusive tools as inert-until-approved.
 *
 *  3. Tool output that becomes a finding is stamped `provenance: 'tool'` with
 *     the raw output attached — it came from a real subprocess, so it MAY be
 *     verified. Nothing here fabricates evidence.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { EventEmitter } from 'eventemitter3';
import type { CustomTool, ToolContext, ToolParameter, ToolResult, RiskTier, Severity } from '../types/index.js';
import { hexstrikeUnfenced, HEXSTRIKE_UNFENCED_WARNING } from './lab-mode.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface HexStrikeBridgeConfig {
  /** Absolute path to the venv python that runs the MCP frontend. */
  pythonBin: string;
  /** Absolute path to hexstrike_mcp.py. */
  mcpScript: string;
  /** Working directory for the MCP frontend process. */
  cwd: string;
  /** Flask backend base URL. */
  serverUrl: string;
  /** Per-call timeout in ms (HexStrike scans are long-running). */
  toolCallTimeoutMs: number;
  /**
   * OPT-IN (T3MP3ST_HEXSTRIKE_UNFENCED=1 / T3MP3ST_LAB_MODE=1): mint HexStrike's fenced
   * arbitrary-capability tools as callable `dangerous`-tier CustomTools. Default false —
   * the fence stays, safe by default. Minted tools still sit behind the approval gate
   * unless lab mode also bypasses it.
   */
  includeFenced?: boolean;
  /** Tool-name prefixes to exclude from the callable surface (extra fences). */
  extraExcluded?: string[];
}

export const DEFAULT_HEXSTRIKE_CONFIG: HexStrikeBridgeConfig = {
  pythonBin: process.env.HEXSTRIKE_PYTHON
    || '/mnt/Pandora/Workshop/HexStrike/hexstrike_env/bin/python',
  mcpScript: process.env.HEXSTRIKE_MCP_SCRIPT
    || '/mnt/Pandora/Workshop/HexStrike/hexstrike-ai/hexstrike_mcp.py',
  cwd: process.env.HEXSTRIKE_MCP_CWD
    || '/mnt/Pandora/Workshop/HexStrike/hexstrike-ai',
  serverUrl: process.env.HEXSTRIKE_SERVER_URL || 'http://127.0.0.1:8888',
  toolCallTimeoutMs: Number(process.env.HEXSTRIKE_TOOL_TIMEOUT_MS || 300_000),
  includeFenced: hexstrikeUnfenced(),
};

// =============================================================================
// RISK CLASSIFICATION
// =============================================================================

/**
 * Tools that grant arbitrary local capability. Discovered, never minted.
 *
 * Rationale per family:
 *  - shell/python/package: arbitrary code execution on the operator host.
 *  - file write: arbitrary filesystem mutation outside any scope model.
 *  - payload generation: produces weaponised artifacts; T3MP3ST keeps
 *    weaponisation behind `catalog_only` for the same reason.
 *  - process control: can terminate/pause arbitrary host processes.
 *  - exploitation frameworks: per-module adapters required (as with metasploit).
 *  - intercepting-proxy control: reroutes the host's own traffic.
 */
export const NON_CALLABLE_TOOLS: ReadonlySet<string> = new Set([
  // arbitrary execution
  'execute_command',
  'execute_python_script',
  'install_python_package',
  // filesystem mutation
  'create_file',
  'modify_file',
  'delete_file',
  'list_files',
  // payload / exploit development
  'generate_payload',
  'ai_generate_payload',
  'advanced_payload_generation',
  'msfvenom_generate',
  'pwntools_exploit',
  'pwninit_setup',
  'metasploit_run',
  'pacu_exploitation',
  // host process control
  'terminate_process',
  'pause_process',
  'resume_process',
  // host traffic interception
  'http_set_rules',
  'http_set_scope',
  'http_repeater',
  'http_intruder',
  'burpsuite_scan',
  'zap_scan',
]);

/** Credential-attack tooling — minted, but gated as `credential` (loud audit warning). */
const CREDENTIAL_TOOLS: ReadonlySet<string> = new Set([
  'hydra_attack',
  'john_crack',
  'hashcat_crack',
  'responder_credential_harvest',
  'hashpump_attack',
  'medusa_attack',
  'patator_attack',
]);

/** Injection / exploitation testing — minted, gated as `intrusive`. */
const INTRUSIVE_TOOLS: ReadonlySet<string> = new Set([
  'sqlmap_scan',
  'dalfox_xss_scan',
  'xsser_scan',
  'wpscan_analyze',
  'dotdotpwn_scan',
  'jaeles_vulnerability_scan',
  'wfuzz_scan',
  'api_fuzzer',
]);

/** Passive collection only — no packets directed at the target. */
const PASSIVE_TOOLS: ReadonlySet<string> = new Set([
  'subfinder_scan',
  'amass_scan',
  'gau_discovery',
  'waybackurls_discovery',
  'monitor_cve_feeds',
  'correlate_threat_intelligence',
  'threat_hunting_assistant',
  'research_zero_day_opportunities',
]);

/** Local artifact analysis — reads files, opens no sockets. */
const LOCAL_READ_TOOLS: ReadonlySet<string> = new Set([
  'strings_extract', 'checksec_analyze', 'objdump_analyze', 'radare2_analyze',
  'binwalk_analyze', 'ropgadget_search', 'ropper_gadget_search', 'xxd_hexdump',
  'exiftool_extract', 'foremost_carving', 'steghide_analysis', 'ghidra_analysis',
  'one_gadget_search', 'libc_database_lookup', 'volatility_analyze',
  'volatility3_analyze', 'gdb_analyze', 'gdb_peda_debug', 'angr_symbolic_execution',
  'trivy_scan', 'checkov_iac_scan', 'terrascan_iac_scan', 'clair_vulnerability_scan',
  'docker_bench_security_scan', 'server_health', 'get_cache_stats', 'get_telemetry',
  'get_process_dashboard', 'display_system_metrics', 'error_handling_statistics',
  'test_error_recovery', 'list_active_processes', 'get_process_status',
]);

/**
 * Risk tier for a HexStrike tool.
 *
 * Conservative by construction: anything not explicitly recognised as passive or
 * local-read falls through to `active`, so an unfamiliar new tool is gated as a
 * network-probing action rather than silently trusted.
 */
export function riskTierForTool(toolName: string): RiskTier {
  if (NON_CALLABLE_TOOLS.has(toolName)) return 'dangerous';
  if (CREDENTIAL_TOOLS.has(toolName)) return 'credential';
  if (INTRUSIVE_TOOLS.has(toolName)) return 'intrusive';
  if (PASSIVE_TOOLS.has(toolName)) return 'passive';
  if (LOCAL_READ_TOOLS.has(toolName)) return 'local_read';
  return 'active';
}

// =============================================================================
// SCHEMA CONVERSION
// =============================================================================

/** MCP JSON-Schema property as returned by `tools/list`. */
interface McpSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: { type?: string };
  properties?: Record<string, McpSchemaProperty>;
  additionalProperties?: boolean;
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, McpSchemaProperty>;
    required?: string[];
  };
}

const SUPPORTED_TYPES = new Set(['string', 'number', 'boolean', 'array', 'object']);

function convertProperty(prop: McpSchemaProperty): Omit<ToolParameter, 'name' | 'description' | 'required'> {
  const raw = prop.type ?? 'string';
  const type = (SUPPORTED_TYPES.has(raw) ? raw : 'string') as ToolParameter['type'];
  const out: Omit<ToolParameter, 'name' | 'description' | 'required'> = { type };

  if (Array.isArray(prop.enum)) {
    out.enum = prop.enum.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number');
  }
  if (prop.default !== undefined) out.default = prop.default;
  if (type === 'array' && prop.items?.type) out.items = { type: prop.items.type };
  if (type === 'object' && prop.properties) {
    out.properties = Object.fromEntries(
      Object.entries(prop.properties).map(([k, v]) => [
        k,
        { name: k, description: v.description ?? '', required: false, ...convertProperty(v) },
      ]),
    );
    if (prop.additionalProperties !== undefined) out.additionalProperties = prop.additionalProperties;
  }
  return out;
}

/** Convert an MCP `inputSchema` into T3MP3ST `ToolParameter[]`. */
export function convertInputSchema(schema: McpToolDefinition['inputSchema']): ToolParameter[] {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  return Object.entries(props).map(([name, prop]) => ({
    name,
    description: prop.description ?? '',
    required: required.has(name),
    ...convertProperty(prop),
  }));
}

// =============================================================================
// RESULT NORMALIZATION
// =============================================================================

/** Keys whose values carry the substance of a HexStrike response, in display order. */
const OUTPUT_KEYS = ['stdout', 'output', 'result', 'data', 'message', 'findings', 'vulnerabilities'];

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Turn an MCP `tools/call` result into a T3MP3ST `ToolResult`. */
export function normalizeToolResult(toolName: string, raw: unknown, durationMs: number): ToolResult {
  // MCP wraps tool output as { content: [{ type: 'text', text: '...' }] }.
  const content = (raw as { content?: Array<{ type?: string; text?: string }> })?.content;
  let payload: unknown = raw;
  let text: string | undefined;

  if (Array.isArray(content)) {
    const joined = content
      .filter((c) => c?.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    if (joined) {
      text = joined;
      // HexStrike's tools return JSON-as-text; try to recover the object so we
      // can read `success`/`stdout` rather than shipping a quoted blob.
      try {
        payload = JSON.parse(joined);
      } catch {
        payload = undefined;
      }
    }
  } else if (typeof raw === 'string') {
    text = raw;
  }

  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  // HexStrike signals failure with success:false; absence of the key means the
  // call itself succeeded.
  const success = obj.success === undefined ? true : obj.success !== false;

  if (!success) {
    const errText = obj.error ?? obj.message ?? text ?? `HexStrike tool ${toolName} reported failure`;
    return { success: false, error: stringifyValue(errText), duration: durationMs };
  }

  const parts = OUTPUT_KEYS
    .filter((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
    .map((k) => stringifyValue(obj[k]));
  const output = parts.length ? parts.join('\n') : (text ?? stringifyValue(obj));

  return { success: true, output, duration: durationMs };
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface HexStrikeBridgeEvents {
  'bridge:connected': { toolCount: number; callableCount: number; fencedCount: number };
  'bridge:disconnected': void;
  'bridge:error': { error: Error };
  'tool:executed': { name: string; durationMs: number; success: boolean };
  'tool:fenced': { name: string; riskTier: RiskTier };
}

// =============================================================================
// BRIDGE
// =============================================================================

export class HexStrikeBridge extends EventEmitter<HexStrikeBridgeEvents> {
  private client: Client | null = null;
  private readonly tools = new Map<string, McpToolDefinition>();
  private readonly config: HexStrikeBridgeConfig;
  private readonly extraExcluded: ReadonlySet<string>;

  constructor(config: Partial<HexStrikeBridgeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_HEXSTRIKE_CONFIG, ...config };
    this.extraExcluded = new Set(config.extraExcluded ?? []);
    if (this.config.includeFenced) {
      // eslint-disable-next-line no-console
      console.warn(HEXSTRIKE_UNFENCED_WARNING);
    }
  }

  /** True once `connect()` has completed an MCP handshake. */
  get isConnected(): boolean {
    return this.client !== null;
  }

  /** Live bridge state: connection, discovered tools, and how many are fenced. */
  getStatus(): { connected: boolean; discovered: number; callable: number; fenced: number } {
    const discovered = this.tools.size;
    const fenced = this.getFencedToolNames().length;
    return { connected: this.isConnected, discovered, callable: discovered - fenced, fenced };
  }

  /**
   * Spawn the HexStrike MCP frontend and complete the `initialize` handshake.
   * Throws if the handshake or `tools/list` fails — callers should treat a
   * bridge that cannot connect as unavailable and degrade, not crash.
   */
  async connect(): Promise<void> {
    if (this.client) return;

    const transport = new StdioClientTransport({
      command: this.config.pythonBin,
      args: [this.config.mcpScript, '--server', this.config.serverUrl],
      cwd: this.config.cwd,
      stderr: 'ignore',
    });
    const client = new Client(
      { name: 't3mp3st-hexstrike-bridge', version: '1.0.0' },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      for (const tool of tools as McpToolDefinition[]) this.tools.set(tool.name, tool);

      this.client = client;

      const fenced = this.getFencedToolNames();
      this.emit('bridge:connected', {
        toolCount: this.tools.size,
        callableCount: this.tools.size - fenced.length,
        fencedCount: fenced.length,
      });
    } catch (err) {
      try { await client.close(); } catch { /* best effort */ }
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('bridge:error', { error });
      throw new Error(`HexStrike bridge connect failed: ${error.message}`);
    }
  }

  /** Close the MCP transport. Idempotent. */
  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;

    this.tools.clear();
    if (client) {
      try { await client.close(); } catch { /* best effort */ }
    }
    this.emit('bridge:disconnected');
  }

  /** Names fenced off the callable surface (see NON_CALLABLE_TOOLS). */
  getFencedToolNames(): string[] {
    return [...this.tools.keys()].filter((n) => this.isFenced(n));
  }

  private isFenced(toolName: string): boolean {
    return (!this.config.includeFenced && NON_CALLABLE_TOOLS.has(toolName)) || this.extraExcluded.has(toolName);
  }

  /** Every discovered tool name, fenced ones included. */
  getDiscoveredToolNames(): string[] {
    return [...this.tools.keys()];
  }

  /** Risk tier assigned to a discovered tool. */
  getRiskTier(toolName: string): RiskTier {
    return riskTierForTool(toolName);
  }

  /**
   * Invoke a HexStrike tool over MCP.
   *
   * NOTE: this method performs NO scope or approval checking — that is
   * `Arsenal.execute()`'s job, and every minted CustomTool is called through it.
   * Calling this directly bypasses T3MP3ST's gates, so only the bridge's own
   * conversion test does so.
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    // Fence refusal first: a fenced tool is inert REGARDLESS of transport state, so the
    // check is deterministic even before connect() (or when the backend is down).
    if (this.isFenced(toolName)) {
      return {
        success: false,
        error: `HexStrike tool "${toolName}" is fenced off the callable surface (arbitrary local capability).`,
      };
    }
    if (!this.client) {
      return { success: false, error: 'HexStrike bridge is not connected' };
    }
    if (!this.tools.has(toolName)) {
      return { success: false, error: `HexStrike tool "${toolName}" was not discovered` };
    }

    const startedAt = Date.now();
    try {
      const raw = await this.client.callTool(
        { name: toolName, arguments: args },
        undefined,
        { timeout: this.config.toolCallTimeoutMs },
      );
      const result = normalizeToolResult(toolName, raw, Date.now() - startedAt);
      this.emit('tool:executed', { name: toolName, durationMs: Date.now() - startedAt, success: result.success });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit('tool:executed', { name: toolName, durationMs: Date.now() - startedAt, success: false });
      return { success: false, error: `HexStrike call failed: ${message}`, duration: Date.now() - startedAt };
    }
  }

  /**
   * Convert a discovered HexStrike tool into a T3MP3ST `CustomTool`.
   * Returns null for fenced tools so callers cannot accidentally register them.
   */
  toCustomTool(toolName: string): CustomTool | null {
    const meta = this.tools.get(toolName);
    if (!meta || this.isFenced(toolName)) return null;

    const parameters = convertInputSchema(meta.inputSchema);
    const declared = new Set(parameters.map((p) => p.name));

    return {
      name: toolName,
      description: meta.description?.trim() || `HexStrike tool ${toolName}`,
      category: 'hexstrike',
      riskTier: riskTierForTool(toolName),
      parameters,
      handler: async (context: ToolContext): Promise<ToolResult> => {
        // Only forward the declared parameters; a model-supplied extra key must
        // not reach the backend.
        const args: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(context.parameters ?? {})) {
          if (declared.has(k)) args[k] = v;
        }
        return this.execute(toolName, args);
      },
    };
  }

  /** Every callable HexStrike tool as a `CustomTool` (fenced tools excluded). */
  getAllCustomTools(): CustomTool[] {
    return this.getDiscoveredToolNames()
      .map((n) => this.toCustomTool(n))
      .filter((t): t is CustomTool => t !== null);
  }

  /** Findings parsed from a tool's own output, stamped as tool-provenance. */
  static buildFinding(
    toolName: string,
    rawOutput: string,
    finding: { title: string; severity: Severity; details: string; remediation?: string },
  ): { title: string; severity: Severity; details: string; remediation?: string; provenance: 'tool'; toolName: string; toolOutput: string } {
    return {
      ...finding,
      provenance: 'tool',
      toolName,
      toolOutput: rawOutput,
    };
  }
}
