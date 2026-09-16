/**
 * OPT-IN unrestricted lab mode tests.
 *
 * Proves two invariants:
 *  1. DEFAULT (env unset): every gate behaves exactly as before — SCOPE DENIED and
 *     APPROVAL REQUIRED still fire, the HexStrike fence still refuses fenced tools.
 *  2. OPT-IN (T3MP3ST_LAB_MODE / includeFenced config): the gates are bypassable, loudly.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Arsenal } from '../arsenal/index.js';
import type { CustomTool } from '../types/index.js';
import { ApprovalController } from '../arsenal/approval.js';
import { HexStrikeBridge } from '../arsenal/hexstrike-bridge.js';
import { labModeEnabled, hexstrikeUnfenced, labModeCallWarning } from '../arsenal/lab-mode.js';

const gateTool: CustomTool = {
  name: 'hydra_attack',
  description: 'gated lab-test tool',
  category: 'hexstrike',
  riskTier: 'credential',
  parameters: [],
  handler: async () => ({ success: true, output: 'ran-ok', duration: 1 }),
};

function spyWarnOn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('lab-mode env helpers', () => {
  it('defaults to fully guarded (regression-safe)', () => {
    vi.stubEnv('T3MP3ST_LAB_MODE', '');
    vi.stubEnv('T3MP3ST_HEXSTRIKE_UNFENCED', '');
    expect(labModeEnabled()).toBe(false);
    expect(hexstrikeUnfenced()).toBe(false);
  });

  it('T3MP3ST_LAB_MODE=1 turns the gates off', () => {
    vi.stubEnv('T3MP3ST_LAB_MODE', '1');
    vi.stubEnv('T3MP3ST_HEXSTRIKE_UNFENCED', '');
    expect(labModeEnabled()).toBe(true);
    expect(hexstrikeUnfenced()).toBe(true); // unfences the bridge too
  });

  it('T3MP3ST_HEXSTRIKE_UNFENCED alone lifts only the fence', () => {
    vi.stubEnv('T3MP3ST_LAB_MODE', '');
    vi.stubEnv('T3MP3ST_HEXSTRIKE_UNFENCED', 'true');
    expect(labModeEnabled()).toBe(false);
    expect(hexstrikeUnfenced()).toBe(true);
  });
});

describe('Arsenal.execute() — default guardrails unchanged', () => {
  it('refuses an out-of-scope gated tool before the handler runs', async () => {
    const arsenal = new Arsenal();
    arsenal.register(gateTool);
    arsenal.setScope({ allowedHosts: ['example.test'], allowLoopback: false, allowPrivate: false });
    arsenal.setApprovalController(new ApprovalController({}));
    const res = await arsenal.execute('hydra_attack', {
      target: { address: 'example.com' },
      parameters: { target: 'example.com' },
    } as never);
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('SCOPE DENIED');
  });

  it('refuses an in-scope but unapproved gated tool', async () => {
    const arsenal = new Arsenal();
    arsenal.register(gateTool);
    arsenal.setScope({ allowedHosts: ['example.com'], allowLoopback: false, allowPrivate: false });
    arsenal.setApprovalController(new ApprovalController({})); // no allowlist, no approver → fail-safe deny
    const res = await arsenal.execute('hydra_attack', {
      target: { address: 'example.com' },
      parameters: { target: 'example.com' },
    } as never);
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('APPROVAL REQUIRED');
  });
});

describe('Arsenal.execute() — lab mode makes the gates optional', () => {
  it('bypasses scope AND approval, still warns loudly, and runs the tool', async () => {
    const warn = spyWarnOn();
    const arsenal = new Arsenal();
    arsenal.register(gateTool);
    arsenal.setLabMode(true);
    arsenal.setScope({ allowedHosts: ['example.test'], allowLoopback: false, allowPrivate: false });
    arsenal.setApprovalController(new ApprovalController({})); // would deny — must be bypassed
    const res = await arsenal.execute('hydra_attack', {
      target: { address: 'example.com' },
      parameters: { target: 'example.com' },
    } as never);
    expect(res.success).toBe(true);
    expect(res.output).toBe('ran-ok');
    expect(warn).toHaveBeenCalled();
    expect(labModeCallWarning('hydra_attack', 'credential')).toContain('LAB MODE');
  });
});

describe('HexStrike bridge — fence stays by default, lifts on opt-in', () => {
  it('default config refuses a fenced tool', async () => {
    const bridge = new HexStrikeBridge({ includeFenced: false });
    const res = await bridge.execute('execute_command', { command: 'id' });
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('fenced');
  });

  it('includeFenced config pulls the fence (call now reaches the transport state, not the fence)', async () => {
    const warn = spyWarnOn();
    const bridge = new HexStrikeBridge({ includeFenced: true });
    const res = await bridge.execute('execute_command', { command: 'id' });
    expect(res.success).toBe(false);
    expect(String(res.error)).not.toContain('fenced');
    expect(String(res.error)).toContain('not connected'); // fence skipped; only transport missing
    expect(warn).toHaveBeenCalled(); // unfenced boot warning printed
  });
});
