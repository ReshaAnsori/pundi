import { describe, expect, it } from 'vitest';
import { calculateProductScore } from './scoring.util.js';

describe('scoring.util', () => {
  it('should calculate high score for high commission, popular, well-rated product in sweet spot price', () => {
    const result = calculateProductScore({
      commissionRate: 15, // 35 pts
      soldCount: 12000,   // 30 pts
      rating: 4.9,        // 20 pts
      price: 85000,       // 15 pts
    });

    expect(result.score).toBe(100);
    expect(result.breakdown.commissionScore).toBe(35);
    expect(result.breakdown.soldScore).toBe(30);
    expect(result.breakdown.ratingScore).toBe(20);
    expect(result.breakdown.priceScore).toBe(15);
  });

  it('should score reasonably for lower stats', () => {
    const result = calculateProductScore({
      commissionRate: 3,
      soldCount: 50,
      rating: 3.8,
      price: 500000,
    });

    expect(result.score).toBeLessThan(50);
    expect(result.breakdown.commissionScore).toBeLessThan(15);
  });

  it('should handle undefined or null fields gracefully', () => {
    const result = calculateProductScore({});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
