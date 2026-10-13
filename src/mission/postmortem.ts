// Postmortem learning (tier 1): stalls register known-bad provider/model pairings;
// future launches refuse the same pairing early with a pointed error.
// Data-only: no source is read or modified by this module.

import fs from 'node:fs';
import path from 'node:path';

export interface StallPostmortem {
  provider: string;
  model: string;
  reason: string;
  firstError: string | null;
  missionId: string;
  failedTasks: Array<{ id: string; error: string | null }>;
  recordedAt: string;
}

const pairings = new Map<string, StallPostmortem>();

function pairingKey(provider: string, model: string): string {
  return `${provider}::${model}`;
}

function storeFile(): string {
  const dir = process.env.T3MP3ST_REPORTS_DIR || 'reports';
  return process.env.T3MP3ST_POSTMORTEM_FILE || path.join(dir, '.postmortem-pairings.json');
}

function persist(): void {
  try {
    const file = storeFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([...pairings.values()], null, 2));
  } catch (err) {
    console.error('[postmortem] persist failed (non-fatal):', err);
  }
}

function load(): void {
  try {
    const raw = fs.readFileSync(storeFile(), 'utf8');
    const entries = JSON.parse(raw) as StallPostmortem[];
    if (Array.isArray(entries)) {
      for (const entry of entries) pairings.set(pairingKey(entry.provider, entry.model), entry);
    }
  } catch {
    // Missing or corrupt store — start empty.
  }
}

load();

export function recordStallPostmortem(entry: StallPostmortem): void {
  pairings.set(pairingKey(entry.provider, entry.model), entry);
  persist();
}

export function clearPairing(provider: string, model: string): void {
  if (!pairings.delete(pairingKey(provider, model))) return;
  persist();
}

export function checkPairing(provider: string, model: string): { ok: true } | { ok: false; error: string } {
  const prior = pairings.get(pairingKey(provider, model));
  if (!prior) return { ok: true };
  return {
    ok: false,
    error:
      `provider/model pairing "${provider}/${model}" previously stalled mission ${prior.missionId}` +
      ` (${prior.reason}${prior.firstError ? ` — ${prior.firstError}` : ''});` +
      ` fix the pairing or clear it via clearPairing before retrying`,
  };
}

export function resetPostmortemStoreForTest(file?: string): void {
  pairings.clear();
  if (file) process.env.T3MP3ST_POSTMORTEM_FILE = file;
  else delete process.env.T3MP3ST_POSTMORTEM_FILE;
  load();
}
