/**
 * OPT-IN unrestricted lab mode — makes T3MP3ST's security guardrails OPTIONAL for
 * authorized local/lab testing of the full stack.
 *
 * EVERYTHING HERE IS OFF BY DEFAULT. With these env vars unset, every gate behaves
 * exactly as before (regression-safe baseline — bridge/scope/approval test suites
 * must stay green unchanged).
 *
 *   T3MP3ST_LAB_MODE=1            bypass the egress ScopeGuard AND the capability
 *                                 approval gate (dangerous/credential/intrusive tools
 *                                 run free) and unfence the HexStrike bridge.
 *   T3MP3ST_HEXSTRIKE_UNFENCED=1  lift ONLY the HexStrike fence (arbitrary-capability
 *                                 tools like execute_command get minted as `dangerous`
 *                                 tier and still hit the approval gate if one is wired).
 *
 * The mode is deliberately LOUD: a boot banner and a per-call warning print whenever a
 * gated-risk tool executes without a gate, so a lab run can never be mistaken for a
 * guardrail-protected run. Target authorization remains the operator's duty.
 */

const TRUE_RE = /^(1|true|yes|on)$/i;

export function labModeEnabled(): boolean {
  return TRUE_RE.test(process.env.T3MP3ST_LAB_MODE ?? '');
}

export function hexstrikeUnfenced(): boolean {
  return labModeEnabled() || TRUE_RE.test(process.env.T3MP3ST_HEXSTRIKE_UNFENCED ?? '');
}

export const LAB_MODE_WARNING = [
  '',
  '⚠️  ⚠️  ⚠️  T3MP3ST LAB MODE IS ACTIVE (T3MP3ST_LAB_MODE=1) — SECURITY GUARDRAILS BYPASSED ⚠️  ⚠️  ⚠️',
  `  - Egress ScopeGuard .......... OFF (no target restriction enforced)`,
  `  - Capability approval gate ... OFF (dangerous / credential / intrusive run free)`,
  `  - HexStrike tool fence ....... ${hexstrikeUnfenced() ? 'OFF (arbitrary-capability tools minted)' : 'ON (unchanged)'}`,
  '  Authorized lab / CTF / owned targets ONLY. Unset T3MP3ST_LAB_MODE to restore the safe default.',
  '',
].join('\n');

export const HEXSTRIKE_UNFENCED_WARNING = [
  '',
  '⚠️  HexStrike fence is UNFENCED (T3MP3ST_HEXSTRIKE_UNFENCED=1 / T3MP3ST_LAB_MODE) — arbitrary-capability tools',
  '    (execute_command, file writes, payload generation, proxy control) are minted into the callable surface.',
  '    They stay riskTier=dangerous and still hit the approval gate unless T3MP3ST_LAB_MODE also bypasses it.',
  '',
].join('\n');

/** Per-call banner printed whenever a gated-risk tool runs with the gates bypassed. */
export function labModeCallWarning(toolName: string, riskTier?: string): string {
  return `⚠️  LAB MODE executes ${toolName} (tier ${riskTier ?? 'active'}) WITHOUT scope/approval gates — authorized lab target only.`;
}
