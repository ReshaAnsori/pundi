export const DEFAULT_CHANNEL_LIMITS: Record<string, number> = {
  tiktok: 4,
  instagram: 3,
  youtube: 4,
  shopee_video: 5,
};

export interface FrequencyCheckResult {
  allowed: boolean;
  channel: string;
  currentCount: number;
  maxLimit: number;
  message: string;
}

export function checkPostingFrequency(
  channel: string,
  existingCountOnDate: number,
  customLimit?: number,
): FrequencyCheckResult {
  const normalizedChannel = channel.toLowerCase();
  const maxLimit = customLimit ?? (DEFAULT_CHANNEL_LIMITS[normalizedChannel] || 4);

  if (existingCountOnDate >= maxLimit) {
    return {
      allowed: false,
      channel: normalizedChannel,
      currentCount: existingCountOnDate,
      maxLimit,
      message: `Batas frekuensi posting untuk channel "${normalizedChannel}" tercapai (${existingCountOnDate}/${maxLimit} konten per hari). Terlalu banyak posting dalam satu hari dapat memicu deteksi spam algoritma platform.`,
    };
  }

  return {
    allowed: true,
    channel: normalizedChannel,
    currentCount: existingCountOnDate,
    maxLimit,
    message: `Aman. Frekuensi posting saat ini: ${existingCountOnDate + 1}/${maxLimit} konten per hari.`,
  };
}
