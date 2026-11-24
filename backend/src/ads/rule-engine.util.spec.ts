import { describe, expect, it } from 'vitest';
import { evaluateCampaignRule } from './rule-engine.util.js';

describe('rule-engine.util', () => {
  it('should pause when daily budget is reached', () => {
    const result = evaluateCampaignRule({
      campaignId: 1,
      createdAt: new Date(),
      currentSpend: 100000,
      dailyBudget: 100000,
      validCommissions: 50000,
      pendingCommissions: 20000,
    });

    expect(result.action).toBe('pause');
    expect(result.reason).toContain('Batas budget harian');
  });

  it('should keep campaign in observation window even if ROAS is low', () => {
    // Campaign is 2 hours old (< 24h) and spend is 40.000 (< 100.000)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = evaluateCampaignRule({
      campaignId: 2,
      createdAt: twoHoursAgo,
      currentSpend: 40000,
      dailyBudget: 200000,
      validCommissions: 0,
      pendingCommissions: 0,
      minObservationHours: 24,
      minSpendThreshold: 50000,
      targetMinRoas: 0.6,
    });

    expect(result.action).toBe('keep');
    expect(result.inObservationWindow).toBe(true);
    expect(result.reason).toContain('jeda observasi');
  });

  it('should trigger kill-rule after observation window if ROAS is below target', () => {
    // Campaign is 48 hours old (> 24h) and spend is 80.000 (> 50.000 threshold)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const result = evaluateCampaignRule({
      campaignId: 3,
      createdAt: twoDaysAgo,
      currentSpend: 80000,
      dailyBudget: 200000,
      validCommissions: 10000,
      pendingCommissions: 10000, // total revenue 20.000, ROAS = 20k / 80k = 0.25 (< 0.6)
      minObservationHours: 24,
      minSpendThreshold: 50000,
      targetMinRoas: 0.6,
    });

    expect(result.action).toBe('pause');
    expect(result.inObservationWindow).toBe(false);
    expect(result.roas).toBe(0.25);
    expect(result.reason).toContain('Kill-rule');
  });

  it('should keep campaign running when ROAS is profitable based on valid + pending', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const result = evaluateCampaignRule({
      campaignId: 4,
      createdAt: twoDaysAgo,
      currentSpend: 100000,
      dailyBudget: 200000,
      validCommissions: 70000,
      pendingCommissions: 80000, // total revenue 150.000, ROAS = 1.5 (> 0.6)
      minObservationHours: 24,
      minSpendThreshold: 50000,
      targetMinRoas: 0.6,
    });

    expect(result.action).toBe('keep');
    expect(result.roas).toBe(1.5);
    expect(result.netProfit).toBe(50000);
  });
});
