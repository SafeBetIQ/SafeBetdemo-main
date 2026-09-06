// ─── SafeBet Guardian — deterministic hostname normalisation (ARCH-V4-C2) ─────
//
// Canonicalisation rules (recorded here, not hidden in call sites). Distinct hosts
// are NOT silently collapsed except where a rule justifies it (only the leading
// `www.` is treated as equivalent, as a policy decision).

export interface HostNormalisation { canonical: string; display: string; changed: boolean }

export function normaliseHostname(input: string): HostNormalisation {
  const display = input.trim();
  let h = display.toLowerCase();
  // scheme + path + query/fragment removal
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  h = h.replace(/[/?#].*$/, '');
  // credentials + port removal
  h = h.replace(/^[^@]*@/, '');
  h = h.replace(/:\d+$/, '');
  // trailing dot
  h = h.replace(/\.$/, '');
  // www. is treated as equivalent (policy decision — recorded)
  const canonical = h.replace(/^www\./, '');
  return { canonical, display, changed: canonical !== display.toLowerCase() };
}

/** IDN/punycode is preserved as-is at C2 (no silent transliteration) — recorded as a
 *  policy decision; a future rule may add explicit punycode canonicalisation. */
export function isPunycode(host: string): boolean {
  return host.split('.').some((label) => label.startsWith('xn--'));
}
