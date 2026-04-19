/**
 * Centralized chart color palette for SafeBet IQ.
 *
 * These values are intentionally concrete hex strings — Recharts (and most
 * charting libraries) cannot consume CSS custom properties directly, so we
 * keep the palette here and keep it aligned with the design-system tokens
 * defined in tailwind.config.ts and app/globals.css.
 *
 * Mapping to design tokens:
 *   brand-500  #6bc235  → primary brand green
 *   blue-500   #3b82f6  → chart-2 info blue
 *   amber-500  #f59e0b  → chart-3 warning amber
 *   red-500    #ef4444  → chart-4 / destructive
 *   emerald-500 #10b981 → chart-5 success green
 *   violet-500 #8b5cf6  → chart-6 purple accent
 *   orange-500 #f97316  → supplemental orange
 *   yellow-500 #eab308  → supplemental yellow
 *   cyan-500   #06b6d4  → supplemental cyan
 *   lime-400   #84cc16  → supplemental lime
 *   pink-500   #ec4899  → supplemental pink
 */

/** Risk severity: CRITICAL → HIGH → MEDIUM → LOW */
export const SEVERITY_COLORS = [
  '#ef4444', // red-500    CRITICAL
  '#f97316', // orange-500 HIGH
  '#eab308', // yellow-500 MEDIUM
  '#10b981', // emerald-500 LOW
] as const;

/** Nine South African provinces — distinct, accessible colours. */
export const PROVINCE_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-400
  '#ec4899', // pink-500
] as const;

/** Generic multi-series chart palette (mirrors --chart-1 … --chart-6). */
export const CHART_PALETTE = [
  '#6bc235', // brand-500   (chart-1)
  '#3b82f6', // blue-500    (chart-2)
  '#f59e0b', // amber-500   (chart-3)
  '#ef4444', // red-500     (chart-4)
  '#10b981', // emerald-500 (chart-5)
  '#8b5cf6', // violet-500  (chart-6)
] as const;
