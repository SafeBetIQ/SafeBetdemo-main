// ─── SafeBet Guardian — deterministic app signals (ARCH-V4-C3) ────────────────
// Bounded, deterministic. NO AI, NO binary/device analysis. Signals are intelligence
// only — never establish illegality.

import type { AppFixture, AppContentSignal, AppTechnicalSignal } from './types.ts';

const GAMBLING = ['casino', 'bet', 'betting', 'wager', 'odds', 'jackpot', 'slots', 'poker'];
const DEPOSIT = ['deposit', 'bonus', 'payout', 'withdraw', 'promo'];
const REG = ['register', 'sign up', 'sign-up', 'join now', 'create account'];
const AGE = ['18+', 'over 18', 'age', 'responsible'];

const has = (t: string, w: string[]) => { const s = t.toLowerCase(); return w.some((x) => s.includes(x)); };

export function appContentSignals(fx: AppFixture): AppContentSignal[] {
  const text = `${fx.displayName} ${fx.description}`;
  return [
    { signalType: 'GAMBLING_TERMINOLOGY', present: has(text, GAMBLING), detail: 'casino/betting terms' },
    { signalType: 'BETTING_CTA', present: /\b(bet now|place bet|bet online)\b/i.test(text), detail: 'betting CTA' },
    { signalType: 'REGISTRATION_CTA', present: has(text, REG), detail: 'registration CTA' },
    { signalType: 'DEPOSIT_LANGUAGE', present: has(text, DEPOSIT), detail: 'deposit/bonus language' },
    { signalType: 'AGE_REFERENCE', present: has(text, AGE), detail: 'age/responsible messaging' },
    { signalType: 'DECLARED_OPERATOR', present: !!fx.declaredOperatorName, detail: fx.declaredOperatorName ?? '' },
    { signalType: 'DECLARED_BRAND', present: !!fx.declaredBrand, detail: fx.declaredBrand ?? '' },
    { signalType: 'DECLARED_LICENCE_REFERENCE', present: !!fx.declaredLicenceReference, detail: fx.declaredLicenceReference ?? '' },
    { signalType: 'DECLARED_WEBSITE', present: !!fx.declaredWebsite, detail: fx.declaredWebsite ?? '' },
  ];
}

export function appTechnicalSignals(fx: AppFixture): AppTechnicalSignal[] {
  return [
    { signalType: 'APP_IDENTIFIER', value: fx.appIdentifier },
    { signalType: 'PLATFORM_TYPE', value: fx.platformType },
    { signalType: 'VERSION', value: fx.version },
    { signalType: 'PUBLISHER', value: fx.developer },
    { signalType: 'METADATA_FINGERPRINT', value: fx.metadataHash },
    { signalType: 'CONTENT_FINGERPRINT', value: fx.contentHash },
  ];
}

export function extractAppLicenceReference(fx: AppFixture): string | null {
  if (fx.declaredLicenceReference) return fx.declaredLicenceReference;
  const m = `${fx.displayName} ${fx.description}`.match(/\bLIC-[A-Z]{2}-[A-Z]{2}-[A-Z0-9-]+/i);
  return m ? m[0].toUpperCase() : null;
}
