// ─── SafeBet Guardian — merchant/payment normalisation (ARCH-V4-C4) ───────────
// Deterministic, provider-neutral. No raw card/bank data.
export interface MerchantNormalisation { canonicalReference: string; canonicalDescriptor: string }
export function normaliseMerchant(reference: string, descriptor: string): MerchantNormalisation {
  const canonicalReference = reference.trim().toUpperCase().replace(/\s+/g, '');
  const canonicalDescriptor = descriptor.trim().toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return { canonicalReference, canonicalDescriptor };
}
