import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  recordStallPostmortem,
  clearPairing,
  checkPairing,
  resetPostmortemStoreForTest,
  type StallPostmortem,
} from '../mission/postmortem.js';

const STALL: StallPostmortem = {
  provider: 'local-agent',
  model: 'glm/glm-5.3-flash',
  reason: 'stalled in reconnaissance: 2 required task(s) failed',
  firstError: 'unknown local agent: glm/glm-5.3-flash',
  missionId: 'mission_test_1',
  failedTasks: [{ id: 't1', error: 'unknown local agent: glm/glm-5.3-flash' }],
  recordedAt: new Date().toISOString(),
};

let tmpFile: string;

beforeAll(() => {
  tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'postmortem-')), 'pairings.json');
  resetPostmortemStoreForTest(tmpFile);
});

afterAll(() => {
  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
  resetPostmortemStoreForTest();
});

describe('stall postmortem pairings', () => {
  it('unknown pairing passes', () => {
    expect(checkPairing('local-agent', 'codex')).toEqual({ ok: true });
  });

  it('stalled pairing is refused with a pointed error', () => {
    recordStallPostmortem(STALL);
    const result = checkPairing('local-agent', 'glm/glm-5.3-flash');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('mission_test_1');
      expect(result.error).toContain('unknown local agent');
    }
  });

  it('refusal survives restart (persisted to disk and reloaded)', () => {
    resetPostmortemStoreForTest(tmpFile); // simulates fresh process loading same store
    const result = checkPairing('local-agent', 'glm/glm-5.3-flash');
    expect(result.ok).toBe(false);
  });

  it('clearPairing restores acceptance and persists the clear', () => {
    clearPairing('local-agent', 'glm/glm-5.3-flash');
    expect(checkPairing('local-agent', 'glm/glm-5.3-flash')).toEqual({ ok: true });
    resetPostmortemStoreForTest(tmpFile);
    expect(checkPairing('local-agent', 'glm/glm-5.3-flash')).toEqual({ ok: true });
  });
});
