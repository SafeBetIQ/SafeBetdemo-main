// ─── Certified regulator financial export (FIN-UI-2A2) ───────────────────────
// Serializes the certified regulator financial result to CSV. It performs NO
// financial arithmetic of its own — every value comes from the certified
// FinancialPostureView via the shared lib/certifiedFinancial selectors, so the
// exported numbers are byte-identical to what the Report and Evidence show
// (Report ↔ Evidence ↔ Export reconcile). One row per certified period.
//
// null certified value → empty cell (never a false 0); genuine 0 → "0"; a
// negative certified GGR keeps its sign. Numeric cells bypass csvCell so a
// leading "-" on a real number is NOT treated as formula injection; text cells
// (operator, status, jurisdiction, refs) go through csvCell for CSV-escaping +
// formula-injection neutralisation.

// ARCH-V4-A4: shared evidence framework (Shared Platform Foundation).
import { csvCell } from './platform/evidence/index.ts';
import type { FinancialPostureView } from './consumerPlatform/contracts.ts';
import {
  FINANCIAL_PERIODS, ggrForPeriod, stakesForPeriod, winningsForPeriod, financialStatusLabel,
} from './certifiedFinancial.ts';

export interface RegulatorExportMeta {
  operatorName: string;
  jurisdiction: string;
  currency: string;
  timezone: string;
  generatedAt: string;
  evidenceRef: string;
}

export const REGULATOR_FINANCIAL_EXPORT_COLUMNS = [
  'operator', 'jurisdiction', 'currency', 'timezone', 'status',
  'period', 'ggr', 'settled_stakes', 'player_winnings', 'settled_bets_today',
  'generated_at', 'evidence_ref',
] as const;

// A certified numeric value: raw number (sign preserved), empty when null.
// Numbers cannot contain CSV delimiters and a genuine leading "-" is a sign,
// not a spreadsheet formula, so csvCell (which would quote it) is intentionally
// NOT applied here.
function numCell(v: number | null): string {
  return v == null ? '' : String(v);
}

export function regulatorFinancialCsv(
  financial: FinancialPostureView | null,
  meta: RegulatorExportMeta,
): string {
  const status = financialStatusLabel(financial);
  const header = REGULATOR_FINANCIAL_EXPORT_COLUMNS.map(csvCell).join(',');
  const rows = FINANCIAL_PERIODS.map((p) => [
    csvCell(meta.operatorName),
    csvCell(meta.jurisdiction),
    csvCell(meta.currency),
    csvCell(meta.timezone),
    csvCell(status),
    csvCell(p.label),
    numCell(ggrForPeriod(financial, p.key)),
    numCell(stakesForPeriod(financial, p.key)),
    numCell(winningsForPeriod(financial, p.key)),
    // settled_bets_today is a TODAY metric — the same across period rows (context).
    numCell(financial ? financial.settledBetsToday : null),
    csvCell(meta.generatedAt),
    csvCell(meta.evidenceRef),
  ].join(','));
  return [header, ...rows].join('\n');
}
