export interface ProductScoreBreakdown {
  commissionScore: number; // max 35
  soldScore: number; // max 30
  ratingScore: number; // max 20
  priceScore: number; // max 15
}

export function calculateProductScore(product: {
  price?: number | null;
  commissionRate?: number | null;
  rating?: number | null;
  soldCount?: number | null;
}): { score: number; breakdown: ProductScoreBreakdown } {
  // 1. Commission Score (0 - 35)
  let commissionScore = 0;
  const rate = product.commissionRate ?? 0;
  if (rate >= 15) {
    commissionScore = 35;
  } else if (rate >= 10) {
    commissionScore = 25 + ((rate - 10) / 5) * 10;
  } else if (rate >= 5) {
    commissionScore = 15 + ((rate - 5) / 5) * 10;
  } else {
    commissionScore = Math.max(0, (rate / 5) * 15);
  }

  // 2. Sold Count / Popularity (0 - 30)
  let soldScore = 0;
  const sold = product.soldCount ?? 0;
  if (sold >= 10000) {
    soldScore = 30;
  } else if (sold >= 1000) {
    soldScore = 20 + ((sold - 1000) / 9000) * 10;
  } else if (sold >= 100) {
    soldScore = 10 + ((sold - 100) / 900) * 10;
  } else {
    soldScore = Math.max(0, (sold / 100) * 10);
  }

  // 3. Rating Score (0 - 20)
  let ratingScore = 0;
  const rating = product.rating ?? 0;
  if (rating >= 4.8) {
    ratingScore = 20;
  } else if (rating >= 4.5) {
    ratingScore = 15 + ((rating - 4.5) / 0.3) * 5;
  } else if (rating >= 4.0) {
    ratingScore = 10 + ((rating - 4.0) / 0.5) * 5;
  } else {
    ratingScore = Math.max(0, (rating / 4.0) * 10);
  }

  // 4. Price Sweet Spot (0 - 15)
  // E-commerce affiliate impulse-buy sweet spot: Rp 30.000 - Rp 200.000
  let priceScore = 5;
  const price = product.price ?? 0;
  if (price >= 30000 && price <= 200000) {
    priceScore = 15;
  } else if (
    (price >= 15000 && price < 30000) ||
    (price > 200000 && price <= 350000)
  ) {
    priceScore = 10;
  } else if (price > 350000) {
    priceScore = 7;
  }

  const totalScore = Math.round(
    commissionScore + soldScore + ratingScore + priceScore,
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown: {
      commissionScore: Math.round(commissionScore * 10) / 10,
      soldScore: Math.round(soldScore * 10) / 10,
      ratingScore: Math.round(ratingScore * 10) / 10,
      priceScore: Math.round(priceScore * 10) / 10,
    },
  };
}
