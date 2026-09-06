// ─── SafeBet Guardian — deterministic domain signals (ARCH-V4-C2) ─────────────
//
// Bounded, deterministic signal extraction from a SYNTHETIC website fixture. NO AI.
// Signal presence is intelligence only — it never establishes illegality.

import type { WebsiteFixture, TechnicalSignal, ContentSignal } from './types.ts';

const GAMBLING_TERMS = ['casino', 'betting', 'bet', 'wager', 'odds', 'jackpot', 'slots', 'poker'];
const DEPOSIT_TERMS = ['deposit', 'bonus', 'payout', 'withdraw', 'promo'];
const REGISTRATION_TERMS = ['register', 'sign up', 'sign-up', 'join now', 'create account'];
const AGE_TERMS = ['18+', 'over 18', 'age', 'responsible'];

function hasAny(text: string, terms: string[]): boolean {
  const t = text.toLowerCase();
  return terms.some((w) => t.includes(w));
}

export function technicalSignals(fx: WebsiteFixture): TechnicalSignal[] {
  const s: TechnicalSignal[] = [
    { signalType: 'HOSTNAME', value: fx.hostname },
    { signalType: 'HTTP_STATUS', value: String(fx.httpStatus) },
    { signalType: 'TLS_PRESENT', value: String(fx.tlsPresent) },
    { signalType: 'CONTENT_FINGERPRINT', value: fx.contentHash },
  ];
  if (fx.redirectTarget) s.push({ signalType: 'REDIRECT_TARGET', value: fx.redirectTarget });
  return s;
}

export function contentSignals(fx: WebsiteFixture): ContentSignal[] {
  const text = `${fx.pageTitle} ${fx.visibleText}`;
  return [
    { signalType: 'GAMBLING_TERMINOLOGY', present: hasAny(text, GAMBLING_TERMS), detail: 'casino/betting terms' },
    { signalType: 'DEPOSIT_LANGUAGE', present: hasAny(text, DEPOSIT_TERMS), detail: 'deposit/bonus language' },
    { signalType: 'REGISTRATION_CTA', present: hasAny(text, REGISTRATION_TERMS), detail: 'registration CTA' },
    { signalType: 'AGE_MESSAGING', present: hasAny(text, AGE_TERMS), detail: 'age/responsible messaging' },
    { signalType: 'LICENCE_TEXT_PRESENT', present: /\bLIC-[A-Z0-9-]+/i.test(text), detail: 'licence-reference-like text' },
  ];
}

/** Extract a candidate licence reference embedded in synthetic page text (deterministic). */
export function extractLicenceReference(fx: WebsiteFixture): string | null {
  if (fx.claimedLicenceReference) return fx.claimedLicenceReference;
  const m = `${fx.pageTitle} ${fx.visibleText}`.match(/\bLIC-[A-Z]{2}-[A-Z]{2}-[A-Z0-9-]+/i);
  return m ? m[0].toUpperCase() : null;
}
