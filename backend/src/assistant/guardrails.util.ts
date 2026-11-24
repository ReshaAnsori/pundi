export interface GuardrailResult {
  passed: boolean;
  warnings: string[];
}

const FORBIDDEN_MEDICAL_KEYWORDS = [
  'menyembuhkan',
  'mengobati',
  'obat penyakit',
  'kanker',
  'diabetes',
  'terapi medis',
  'resep dokter',
  'menghilangkan racun tubuh',
  'detox darah',
];

const FORBIDDEN_OVERCLAIMS = [
  'dijamin 100% kaya',
  'pasti untung miliaran',
  'tanpa efek samping selamanya',
  'satu-satunya di dunia',
  'paling sempurna di muka bumi',
  'mustahil rusak selamanya',
];

export function validateContentGuardrails(text: string): GuardrailResult {
  const warnings: string[] = [];
  const lower = text.toLowerCase();

  for (const kw of FORBIDDEN_MEDICAL_KEYWORDS) {
    if (lower.includes(kw)) {
      warnings.push(
        `Klaim medis terdeteksi: kata "${kw}" melanggar kebijakan affiliate tanpa sertifikasi resmi.`,
      );
    }
  }

  for (const kw of FORBIDDEN_OVERCLAIMS) {
    if (lower.includes(kw)) {
      warnings.push(
        `Klaim berlebihan (overclaim) terdeteksi: "${kw}". Harap gunakan klaim yang objektif dan realistis.`,
      );
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}
