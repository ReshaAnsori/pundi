import { describe, expect, it } from 'vitest';
import {
  checkPostingFrequency,
  DEFAULT_CHANNEL_LIMITS,
} from './anti-spam-guard.util.js';

describe('anti-spam-guard.util', () => {
  it('should allow posting when below limit for tiktok', () => {
    const res = checkPostingFrequency('tiktok', 2);
    expect(res.allowed).toBe(true);
    expect(res.currentCount).toBe(2);
    expect(res.maxLimit).toBe(DEFAULT_CHANNEL_LIMITS.tiktok);
  });

  it('should prevent posting when reaching limit for instagram', () => {
    const res = checkPostingFrequency('instagram', 3);
    expect(res.allowed).toBe(false);
    expect(res.currentCount).toBe(3);
    expect(res.maxLimit).toBe(3);
    expect(res.message).toContain('Batas frekuensi posting');
  });

  it('should respect custom limit', () => {
    const res = checkPostingFrequency('youtube', 1, 2);
    expect(res.allowed).toBe(true);

    const res2 = checkPostingFrequency('youtube', 2, 2);
    expect(res2.allowed).toBe(false);
  });
});
