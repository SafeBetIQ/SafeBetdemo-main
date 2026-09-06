// ─── SafeBet Guardian — app identity normalisation (ARCH-V4-C3) ───────────────
// Deterministic, provider-neutral. Recorded canonicalisation rules; no silent collapse.

export interface AppIdNormalisation { canonical: string; display: string; changed: boolean }

/** Canonical app identifier: lowercase, trim, strip a leading platform scheme, collapse
 *  repeated separators. Distinct identifiers are NOT collapsed. */
export function normaliseAppIdentifier(input: string): AppIdNormalisation {
  const display = input.trim();
  let a = display.toLowerCase();
  a = a.replace(/^(app|market|store):\/\//, '');   // provider-neutral scheme strip
  a = a.replace(/[/?#].*$/, '');                    // any path/query
  a = a.replace(/\s+/g, '');                        // no whitespace in identifiers
  a = a.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
  return { canonical: a, display, changed: a !== display.toLowerCase() };
}
