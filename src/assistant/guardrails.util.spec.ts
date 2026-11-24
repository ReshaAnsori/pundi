import { describe, expect, it } from 'vitest';
import { validateContentGuardrails } from './guardrails.util.js';

describe('guardrails.util', () => {
  it('should pass content that complies with policies', () => {
    const text = 'Termos ini terbuat dari bahan stainless steel kokoh dan menjaga minuman tetap dingin.';
    const result = validateContentGuardrails(text);
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should fail content with medical claims', () => {
    const text = 'Suplemen ini bisa menyembuhkan penyakit diabetes dan kanker dalam 3 hari!';
    const result = validateContentGuardrails(text);
    expect(result.passed).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('Klaim medis');
  });

  it('should fail content with extreme overclaims', () => {
    const text = 'Gunakan alat ini dan kamu dijamin 100% kaya mendadak!';
    const result = validateContentGuardrails(text);
    expect(result.passed).toBe(false);
    expect(result.warnings[0]).toContain('Klaim berlebihan');
  });
});
