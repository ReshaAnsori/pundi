export interface EvaluationParams {
  campaignId: number;
  createdAt: Date;
  currentSpend: number;
  dailyBudget: number;
  validCommissions: number;
  pendingCommissions: number;
  minObservationHours?: number;
  minSpendThreshold?: number;
  targetMinRoas?: number;
}

export interface EvaluationResult {
  campaignId: number;
  action: 'keep' | 'pause';
  reason: string;
  roas: number;
  spend: number;
  revenue: number;
  netProfit: number;
  inObservationWindow: boolean;
}

export function evaluateCampaignRule(params: EvaluationParams): EvaluationResult {
  const minObsHours = params.minObservationHours ?? 24;
  const minSpend = params.minSpendThreshold ?? 50000;
  const targetMinRoas = params.targetMinRoas ?? 0.6;

  const revenue = params.validCommissions + params.pendingCommissions;
  const netProfit = revenue - params.currentSpend;
  const roas = params.currentSpend > 0 ? revenue / params.currentSpend : 1.0;

  // 1. Hard campaign budget check
  if (params.dailyBudget > 0 && params.currentSpend >= params.dailyBudget) {
    return {
      campaignId: params.campaignId,
      action: 'pause',
      reason: `Batas budget harian campaign tercapai (Spend: Rp ${params.currentSpend.toLocaleString('id-ID')} / Budget: Rp ${params.dailyBudget.toLocaleString('id-ID')}).`,
      roas,
      spend: params.currentSpend,
      revenue,
      netProfit,
      inObservationWindow: false,
    };
  }

  // 2. Observation window check
  // Avoid killing campaigns too early before affiliate conversions can be tracked/attributed
  const ageHours = (Date.now() - params.createdAt.getTime()) / (1000 * 60 * 60);
  const inObservationWindow = ageHours < minObsHours && params.currentSpend < minSpend * 2;

  if (inObservationWindow) {
    return {
      campaignId: params.campaignId,
      action: 'keep',
      reason: `Dalam masa jeda observasi (${ageHours.toFixed(1)} jam / ${minObsHours} jam). Kill-rule ditunda agar data atribusi komisi affiliate masuk.`,
      roas,
      spend: params.currentSpend,
      revenue,
      netProfit,
      inObservationWindow: true,
    };
  }

  // 3. Kill-rule based on valid + pending commissions
  if (params.currentSpend >= minSpend && roas < targetMinRoas) {
    return {
      campaignId: params.campaignId,
      action: 'pause',
      reason: `Kill-rule: ROAS (${roas.toFixed(2)}) di bawah target ${targetMinRoas} dengan spend Rp ${params.currentSpend.toLocaleString('id-ID')} (Pendapatan valid+pending: Rp ${revenue.toLocaleString('id-ID')}).`,
      roas,
      spend: params.currentSpend,
      revenue,
      netProfit,
      inObservationWindow: false,
    };
  }

  return {
    campaignId: params.campaignId,
    action: 'keep',
    reason: `Performa sehat. ROAS: ${roas.toFixed(2)}, Laba Bersih: Rp ${netProfit.toLocaleString('id-ID')}.`,
    roas,
    spend: params.currentSpend,
    revenue,
    netProfit,
    inObservationWindow: false,
  };
}
