// ─── SafeBet Guardian — deterministic payment signals (ARCH-V4-C4) ────────────
import type { PaymentFixture } from './types.ts';
export interface PaymentSignal { signalType: string; value: string }
export function paymentSignals(fx: PaymentFixture): PaymentSignal[] {
  const s: PaymentSignal[] = [
    { signalType: 'MERCHANT_REFERENCE', value: fx.merchantReference },
    { signalType: 'MERCHANT_DESCRIPTOR', value: fx.merchantDescriptor },
    { signalType: 'PAYMENT_CHANNEL', value: fx.channel },
    { signalType: 'PROVIDER_TYPE', value: fx.providerType },
    { signalType: 'PROVIDER_REFERENCE_CATEGORY', value: fx.providerReference ? 'DECLARED' : 'UNKNOWN' },
    { signalType: 'CONTENT_FINGERPRINT', value: fx.contentHash },
  ];
  if (fx.currency) s.push({ signalType: 'CURRENCY', value: fx.currency });
  return s;
}
