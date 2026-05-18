import { CasinoComplianceReport, RegulatorAuditReport } from './reportGenerator';

export interface AuditChainStatus {
  verified: boolean;
  totalRecords: number;
  tamperedCount: number;
  lastVerifiedAt: string;
  integrityNote?: string;
}

export function generateHTMLReport(
  report: CasinoComplianceReport | RegulatorAuditReport,
  type: 'casino' | 'regulator',
  auditChain?: AuditChainStatus
): string {
  if (type === 'casino') {
    return generateCasinoHTML(report as CasinoComplianceReport, auditChain);
  } else {
    return generateRegulatorHTML(report as RegulatorAuditReport, auditChain);
  }
}

// ---------------------------------------------------------------------------
// Shared styles — Big 4 auditor visual language
// Navy + white + green accent; formal serif-adjacent typography
// ---------------------------------------------------------------------------
const BASE_STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    @page {
      margin: 0;
      size: A4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      line-height: 1.55;
      color: #1a1a2e;
      background: #ffffff;
    }

    /* ── Cover page ─────────────────────────────────────────── */
    .cover-page {
      background: #0a0a14;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 60px 70px;
      page-break-after: always;
    }

    .cover-logo {
      max-width: 220px;
    }

    .cover-logo img {
      width: 100%;
      height: auto;
    }

    .cover-tagline {
      font-size: 11px;
      color: #89d848;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-top: 8px;
    }

    .cover-title-block {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px 0;
    }

    .cover-rule {
      width: 60px;
      height: 3px;
      background: #89d848;
      margin-bottom: 28px;
    }

    .cover-report-type {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #89d848;
      margin-bottom: 18px;
    }

    .cover-title {
      font-size: 34px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
      margin-bottom: 10px;
    }

    .cover-subtitle {
      font-size: 16px;
      font-weight: 300;
      color: #9ca3af;
      margin-bottom: 40px;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-top: 1px solid #2d2d3a;
      padding-top: 28px;
      max-width: 480px;
    }

    .cover-meta-item {
      padding: 10px 0;
    }

    .cover-meta-label {
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .cover-meta-value {
      font-size: 12px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .cover-footer {
      border-top: 1px solid #2d2d3a;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .cover-footer-left p {
      font-size: 9px;
      color: #6b7280;
      line-height: 1.6;
    }

    .cover-confidential {
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #dc2626;
      font-weight: 600;
      background: rgba(220,38,38,0.08);
      padding: 5px 12px;
      border: 1px solid rgba(220,38,38,0.3);
      border-radius: 2px;
    }

    /* ── Document body ───────────────────────────────────────── */
    .doc-header {
      background: #0a0a14;
      padding: 18px 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #89d848;
    }

    .doc-header-logo img {
      height: 28px;
      width: auto;
    }

    .doc-header-meta {
      text-align: right;
    }

    .doc-header-meta p {
      font-size: 9px;
      color: #9ca3af;
      margin: 1px 0;
    }

    .doc-header-meta .report-id {
      font-size: 10px;
      font-weight: 600;
      color: #89d848;
      letter-spacing: 1px;
    }

    .content {
      padding: 36px 50px;
    }

    /* ── Section layout ──────────────────────────────────────── */
    .section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1a1a2e;
      page-break-after: avoid;
    }

    .section-number {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #89d848;
      text-transform: uppercase;
      min-width: 28px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: -0.2px;
    }

    .section-rule {
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    /* ── Narrative text ──────────────────────────────────────── */
    .narrative {
      background: #f8fafc;
      border-left: 3px solid #89d848;
      padding: 16px 20px;
      margin-bottom: 20px;
      font-size: 11px;
      line-height: 1.7;
      color: #374151;
    }

    .narrative p + p {
      margin-top: 10px;
    }

    .narrative strong {
      color: #1a1a2e;
    }

    /* ── KPI cards ───────────────────────────────────────────── */
    .kpi-grid {
      display: grid;
      gap: 12px;
      margin-bottom: 20px;
    }

    .kpi-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .kpi-grid-4 { grid-template-columns: repeat(4, 1fr); }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-top: 3px solid #89d848;
      border-radius: 4px;
      padding: 16px;
      text-align: center;
    }

    .kpi-card.alert {
      border-top-color: #dc2626;
    }

    .kpi-card.warning {
      border-top-color: #f59e0b;
    }

    .kpi-card.info {
      border-top-color: #3b82f6;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1;
      margin-bottom: 6px;
    }

    .kpi-card.alert .kpi-value { color: #dc2626; }
    .kpi-card.warning .kpi-value { color: #d97706; }
    .kpi-card.info .kpi-value { color: #2563eb; }

    .kpi-label {
      font-size: 10px;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-note {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* ── Data table ──────────────────────────────────────────── */
    .data-table-wrap {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .data-table thead {
      background: #1a1a2e;
    }

    .data-table th {
      padding: 9px 12px;
      text-align: left;
      font-weight: 600;
      color: #ffffff;
      font-size: 9px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .data-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .data-table tbody tr:hover {
      background: #f0fdf4;
    }

    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #374151;
    }

    .data-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* ── Info pairs ──────────────────────────────────────────── */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .info-pair {
      padding: 10px 16px;
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-pair:nth-child(even) {
      border-right: none;
    }

    .info-pair:nth-last-child(-n+2) {
      border-bottom: none;
    }

    .info-key {
      font-size: 9px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-val {
      font-size: 11px;
      font-weight: 500;
      color: #1a1a2e;
    }

    /* ── Status badges ───────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .badge-pass    { background: #d1fae5; color: #065f46; }
    .badge-fail    { background: #fee2e2; color: #991b1b; }
    .badge-review  { background: #fef3c7; color: #92400e; }
    .badge-info    { background: #dbeafe; color: #1e40af; }
    .badge-high    { background: #fee2e2; color: #991b1b; }
    .badge-medium  { background: #fef3c7; color: #92400e; }
    .badge-low     { background: #dbeafe; color: #1e40af; }

    /* ── Compliance checklist ────────────────────────────────── */
    .compliance-table {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .compliance-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
    }

    .compliance-row:last-child {
      border-bottom: none;
    }

    .compliance-row:nth-child(even) {
      background: #f8fafc;
    }

    /* ── Audit chain section ─────────────────────────────────── */
    .audit-chain-box {
      border: 2px solid #89d848;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .audit-chain-box.compromised {
      border-color: #dc2626;
    }

    .audit-chain-header {
      background: #89d848;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .audit-chain-box.compromised .audit-chain-header {
      background: #dc2626;
    }

    .audit-chain-header-title {
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .audit-chain-body {
      background: #ffffff;
      padding: 16px;
    }

    .chain-stat-row {
      display: flex;
      gap: 24px;
      margin-bottom: 14px;
    }

    .chain-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .chain-stat-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
      font-weight: 600;
    }

    .chain-stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .chain-integrity-note {
      font-size: 10px;
      color: #4b5563;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 3px;
      border-left: 3px solid #89d848;
      line-height: 1.6;
    }

    .audit-chain-box.compromised .chain-integrity-note {
      border-left-color: #dc2626;
    }

    /* ── Issues list ─────────────────────────────────────────── */
    .issue-card {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 14px 18px;
      margin-bottom: 10px;
      border-left: 4px solid #e5e7eb;
    }

    .issue-card.high   { border-left-color: #dc2626; }
    .issue-card.medium { border-left-color: #f59e0b; }
    .issue-card.low    { border-left-color: #3b82f6; }

    .issue-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .issue-card-title {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .issue-card-desc {
      font-size: 10px;
      color: #4b5563;
      line-height: 1.6;
      margin-bottom: 6px;
    }

    .issue-card-meta {
      font-size: 9px;
      color: #9ca3af;
    }

    /* ── Recommendations ─────────────────────────────────────── */
    .rec-list {
      counter-reset: rec-counter;
      list-style: none;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .rec-item {
      counter-increment: rec-counter;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 10px;
      color: #374151;
      line-height: 1.6;
    }

    .rec-item:last-child { border-bottom: none; }
    .rec-item:nth-child(even) { background: #f8fafc; }

    .rec-item::before {
      content: counter(rec-counter, decimal-leading-zero);
      font-size: 9px;
      font-weight: 700;
      color: #89d848;
      min-width: 22px;
      margin-top: 1px;
    }

    /* ── Progress bar ────────────────────────────────────────── */
    .progress-wrap {
      background: #e5e7eb;
      border-radius: 2px;
      height: 6px;
      overflow: hidden;
      margin-top: 4px;
    }

    .progress-fill {
      height: 100%;
      background: #89d848;
      border-radius: 2px;
    }

    .progress-fill.warn  { background: #f59e0b; }
    .progress-fill.alert { background: #dc2626; }

    /* ── Legal disclaimer ────────────────────────────────────── */
    .disclaimer-box {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 18px 20px;
      margin-bottom: 16px;
    }

    .disclaimer-box h4 {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a1a2e;
      margin-bottom: 10px;
    }

    .disclaimer-box p {
      font-size: 9.5px;
      color: #4b5563;
      line-height: 1.7;
      margin-bottom: 8px;
    }

    .disclaimer-box p:last-child { margin-bottom: 0; }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 20px;
    }

    .sig-block {
      border-top: 1px solid #1a1a2e;
      padding-top: 8px;
    }

    .sig-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .sig-name {
      font-size: 10px;
      font-weight: 600;
      color: #1a1a2e;
      margin-top: 2px;
    }

    .sig-title {
      font-size: 9px;
      color: #9ca3af;
    }

    /* ── Document footer ─────────────────────────────────────── */
    .doc-footer {
      background: #0a0a14;
      border-top: 2px solid #89d848;
      padding: 20px 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .doc-footer-left p {
      font-size: 9px;
      color: #6b7280;
      line-height: 1.6;
    }

    .doc-footer-right {
      text-align: right;
    }

    .doc-footer-right p {
      font-size: 9px;
      color: #6b7280;
    }

    .doc-footer-right .footer-brand {
      font-size: 11px;
      font-weight: 700;
      color: #89d848;
      letter-spacing: 1px;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .cover-page { min-height: 297mm; }
      .section { page-break-inside: avoid; }
      .data-table { page-break-inside: auto; }
      .data-table thead { display: table-header-group; }
      .data-table tr { page-break-inside: avoid; }
      .kpi-grid { page-break-inside: avoid; }
    }
  </style>
`;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function escapeHTML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function progressColor(rate: number): string {
  if (rate >= 80) return '';
  if (rate >= 50) return 'warn';
  return 'alert';
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    'Compliant':    'badge-pass',
    'Non-Compliant':'badge-fail',
    'Under Review': 'badge-review',
  };
  return map[status] ?? 'badge-info';
}

function severityBadge(s: string): string {
  return s === 'High' ? 'badge-high' : s === 'Medium' ? 'badge-medium' : 'badge-low';
}

function issueClass(s: string): string {
  return s === 'High' ? 'high' : s === 'Medium' ? 'medium' : 'low';
}

function auditChainSection(chain: AuditChainStatus | undefined, sectionNum: string): string {
  if (!chain) {
    return `
      <div class="section">
        <div class="section-header">
          <span class="section-number">${escapeHTML(sectionNum)}</span>
          <span class="section-title">Audit Trail Verification</span>
          <div class="section-rule"></div>
        </div>
        <div class="audit-chain-box">
          <div class="audit-chain-header">
            <span class="audit-chain-header-title">Immutable Hash-Chain Audit Log</span>
          </div>
          <div class="audit-chain-body">
            <p style="font-size:10px;color:#6b7280;">
              Audit chain verification data is not available for this report period.
              Chain verification can be performed on-demand via the SafeBet IQ compliance API
              (<code>GET /compliance/audit-chain/verify</code>).
            </p>
          </div>
        </div>
      </div>`;
  }

  const intact = chain.tamperedCount === 0;
  return `
    <div class="section">
      <div class="section-header">
        <span class="section-number">${escapeHTML(sectionNum)}</span>
        <span class="section-title">Audit Trail Verification</span>
        <div class="section-rule"></div>
      </div>
      <div class="narrative">
        <p>
          SafeBet IQ maintains an append-only, cryptographically hash-chained audit log for every
          privileged action performed within the platform. Each record is bound to its predecessor
          using SHA-256 (pgcrypto), making retrospective modification mathematically detectable.
          The following results reflect the most recent full-chain verification run for this tenant.
        </p>
      </div>
      <div class="audit-chain-box${intact ? '' : ' compromised'}">
        <div class="audit-chain-header">
          <span class="audit-chain-header-title">
            ${intact ? 'Chain Integrity: VERIFIED' : 'ALERT — Chain Integrity: COMPROMISED'}
          </span>
        </div>
        <div class="audit-chain-body">
          <div class="chain-stat-row">
            <div class="chain-stat">
              <span class="chain-stat-label">Total Records</span>
              <span class="chain-stat-value">${chain.totalRecords.toLocaleString()}</span>
            </div>
            <div class="chain-stat">
              <span class="chain-stat-label">Tampered Records</span>
              <span class="chain-stat-value" style="color:${intact ? '#065f46' : '#dc2626'};">
                ${chain.tamperedCount}
              </span>
            </div>
            <div class="chain-stat">
              <span class="chain-stat-label">Integrity Status</span>
              <span class="chain-stat-value" style="font-size:13px;margin-top:3px;">
                <span class="badge ${intact ? 'badge-pass' : 'badge-fail'}">
                  ${intact ? 'INTACT' : 'COMPROMISED'}
                </span>
              </span>
            </div>
            <div class="chain-stat">
              <span class="chain-stat-label">Last Verified</span>
              <span class="chain-stat-value" style="font-size:12px;">
                ${fmtDateTime(chain.lastVerifiedAt)}
              </span>
            </div>
          </div>
          <div class="chain-integrity-note">
            ${intact
              ? `<strong>Assessment:</strong> ${escapeHTML(chain.integrityNote ?? 'All audit records are cryptographically intact. No evidence of tampering or unauthorised data modification was detected. This log is suitable for submission to regulatory authorities as an independent record of platform activity.')}`
              : `<strong>CRITICAL:</strong> ${escapeHTML(chain.integrityNote ?? `${chain.tamperedCount} audit record(s) failed hash-chain verification. This indicates potential unauthorised modification of historical audit data. Immediate investigation is required. This report must not be submitted to regulators until chain integrity is restored and the incident formally documented.`)}`
            }
          </div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Casino compliance report
// ---------------------------------------------------------------------------
function generateCasinoHTML(
  report: CasinoComplianceReport,
  chain?: AuditChainStatus
): string {
  const generatedDate = fmtDateTime(report.generatedDate);
  const periodStart   = fmtDate(report.reportingPeriod.startDate);
  const periodEnd     = fmtDate(report.reportingPeriod.endDate);
  const year          = new Date().getFullYear();
  const tc            = report.trainingCompliance;
  const rm            = report.riskManagement;
  const rc            = report.regulatoryCompliance;
  const e             = escapeHTML;

  const overallCompliant = rc.ngaCompliant && rc.ficaCompliant && rc.auditCommittee && rc.surveillanceSystem;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Casino Compliance Report — ${e(report.reportId)}</title>
  ${BASE_STYLES}
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════ COVER -->
<div class="cover-page">
  <div>
    <div class="cover-logo">
      <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
    </div>
    <div class="cover-tagline">Independent Compliance Assurance</div>
  </div>

  <div class="cover-title-block">
    <div class="cover-rule"></div>
    <div class="cover-report-type">Casino Operator Report</div>
    <div class="cover-title">Compliance &amp;<br>Responsible Gaming<br>Audit Report</div>
    <div class="cover-subtitle">Prepared in accordance with the National Gambling Act 7 of 2004</div>

    <div class="cover-meta-grid">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Report Reference</div>
        <div class="cover-meta-value">${e(report.reportId)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Reporting Period</div>
        <div class="cover-meta-value">${periodStart} — ${periodEnd}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Subject Entity</div>
        <div class="cover-meta-value">${e(report.casinoDetails.name)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">License Number</div>
        <div class="cover-meta-value">${e(report.casinoDetails.licenseNumber)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Date of Issue</div>
        <div class="cover-meta-value">${generatedDate}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Overall Status</div>
        <div class="cover-meta-value">
          <span class="badge ${overallCompliant ? 'badge-pass' : 'badge-fail'}" style="font-size:10px;padding:3px 10px;">
            ${overallCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-footer-left">
      <p>SafeBet IQ (Pty) Ltd &nbsp;|&nbsp; AI-Powered Responsible Gaming Technology</p>
      <p>Registered in South Africa &nbsp;|&nbsp; compliance@safebetiq.com</p>
    </div>
    <div class="cover-confidential">Confidential</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ DOC HEADER -->
<div class="doc-header">
  <div class="doc-header-logo">
    <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
  </div>
  <div class="doc-header-meta">
    <p class="report-id">${e(report.reportId)}</p>
    <p>${e(report.casinoDetails.name)} &nbsp;·&nbsp; ${periodStart} – ${periodEnd}</p>
    <p>Generated: ${generatedDate}</p>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════ CONTENT -->
<div class="content">

  <!-- 1. Executive Summary -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">1.0</span>
      <span class="section-title">Executive Summary</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        SafeBet IQ has conducted an independent compliance assessment of
        <strong>${e(report.casinoDetails.name)}</strong> (License No. ${e(report.casinoDetails.licenseNumber)})
        for the period <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>.
        This report presents our findings with respect to staff training compliance, risk management
        performance, and adherence to the legislative framework governing licensed casino operations
        in South Africa.
      </p>
      <p>
        <strong>Overall Compliance Determination:</strong> Based on our assessment,
        ${e(report.casinoDetails.name)} is <strong>${overallCompliant ? 'IN COMPLIANCE' : 'NOT IN COMPLIANCE'}</strong>
        with its primary regulatory obligations under the National Gambling Act 7 of 2004 and ancillary
        legislation. The operator has achieved a staff training compliance rate of
        <strong>${tc.complianceRate}%</strong> against a minimum threshold of 80%, and recorded
        <strong>${rm.interventions}</strong> responsible gaming interventions at an effectiveness rate of
        <strong>${rm.successRate}%</strong>.
      </p>
      <p>
        ${tc.complianceRate >= 80
          ? 'No material training compliance deficiencies were identified during this review period.'
          : `Training compliance is below the 80% minimum threshold and requires remediation. Management attention is directed to Section 3.0 of this report.`
        }
        This report is prepared for submission to the National Gambling Board and provincial licensing
        authorities as required under the Act.
      </p>
    </div>
  </div>

  <!-- 2. Entity Profile -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">2.0</span>
      <span class="section-title">Entity Profile &amp; Regulatory Standing</span>
      <div class="section-rule"></div>
    </div>
    <div class="info-grid">
      <div class="info-pair">
        <span class="info-key">Casino Name</span>
        <span class="info-val">${e(report.casinoDetails.name)}</span>
      </div>
      <div class="info-pair">
        <span class="info-key">License Number</span>
        <span class="info-val">${e(report.casinoDetails.licenseNumber)}</span>
      </div>
      <div class="info-pair">
        <span class="info-key">Registered Address</span>
        <span class="info-val">${e(report.casinoDetails.address)}</span>
      </div>
      <div class="info-pair">
        <span class="info-key">Compliance Contact</span>
        <span class="info-val">${e(report.casinoDetails.contactEmail)}</span>
      </div>
      <div class="info-pair">
        <span class="info-key">Assessment Period</span>
        <span class="info-val">${periodStart} — ${periodEnd}</span>
      </div>
      <div class="info-pair">
        <span class="info-key">Date of Report</span>
        <span class="info-val">${generatedDate}</span>
      </div>
    </div>
  </div>

  <!-- 3. Training Compliance Analysis -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">3.0</span>
      <span class="section-title">Training Compliance Analysis</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        All licensed casino operators are required to ensure that staff engaged in gaming operations
        complete mandated responsible gambling training in accordance with the National Gambling Act.
        The minimum required training credits per staff member per annum is
        <strong>${Math.round(tc.requiredCredits / (tc.totalStaff || 1))}</strong>.
        The following metrics reflect the operator's performance against this obligation.
      </p>
    </div>

    <div class="kpi-grid kpi-grid-4" style="margin-bottom:20px;">
      <div class="kpi-card ${tc.complianceRate >= 80 ? '' : tc.complianceRate >= 50 ? 'warning' : 'alert'}">
        <div class="kpi-value">${tc.complianceRate}%</div>
        <div class="kpi-label">Overall Compliance Rate</div>
        <div class="kpi-note">Threshold: 80%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${tc.trainedStaff}</div>
        <div class="kpi-label">Staff Trained</div>
        <div class="kpi-note">of ${tc.totalStaff} total</div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-value">${tc.totalCredits.toLocaleString()}</div>
        <div class="kpi-label">Credits Earned</div>
        <div class="kpi-note">Required: ${tc.requiredCredits.toLocaleString()}</div>
      </div>
      <div class="kpi-card ${tc.totalCredits >= tc.requiredCredits ? '' : 'warning'}">
        <div class="kpi-value">${tc.totalCredits >= tc.requiredCredits ? '100%' : Math.round((tc.totalCredits / tc.requiredCredits) * 100) + '%'}</div>
        <div class="kpi-label">Credit Attainment</div>
        <div class="kpi-note">vs. annual target</div>
      </div>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Staff Role</th>
            <th>Total Headcount</th>
            <th>Trained</th>
            <th>Compliance Rate</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tc.staffBreakdown.map(role => `
            <tr>
              <td><strong>${e(role.role)}</strong></td>
              <td>${role.count}</td>
              <td>${role.trained}</td>
              <td><strong>${role.rate}%</strong></td>
              <td style="min-width:80px;">
                <div class="progress-wrap">
                  <div class="progress-fill ${progressColor(role.rate)}" style="width:${Math.min(role.rate,100)}%;"></div>
                </div>
              </td>
              <td>
                <span class="badge ${role.rate >= 80 ? 'badge-pass' : role.rate >= 50 ? 'badge-review' : 'badge-fail'}">
                  ${role.rate >= 80 ? 'Compliant' : role.rate >= 50 ? 'At Risk' : 'Non-Compliant'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 4. Risk Management & Intervention Effectiveness -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">4.0</span>
      <span class="section-title">Risk Management &amp; Intervention Effectiveness</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        The responsible gambling framework requires operators to maintain active behavioural risk
        monitoring and to act upon identified at-risk patron patterns through documented interventions.
        SafeBet IQ's AI engine continuously evaluates player behaviour and escalates cases meeting
        defined risk thresholds. The metrics below reflect intervention activity for the assessment period.
      </p>
    </div>

    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card">
        <div class="kpi-value">${rm.interventions}</div>
        <div class="kpi-label">Total Interventions</div>
        <div class="kpi-note">Assessment period</div>
      </div>
      <div class="kpi-card ${rm.successRate >= 80 ? '' : 'warning'}">
        <div class="kpi-value">${rm.successRate}%</div>
        <div class="kpi-label">Effectiveness Rate</div>
        <div class="kpi-note">Resolved without escalation</div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-value">${rm.avgResponseTime}</div>
        <div class="kpi-label">Mean Response Time</div>
        <div class="kpi-note">Alert to intervention</div>
      </div>
    </div>
  </div>

  <!-- 5. Regulatory Compliance Review -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">5.0</span>
      <span class="section-title">Regulatory Compliance Review</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        The following obligations are assessed against the requirements of the National Gambling Act 7
        of 2004, the Financial Intelligence Centre Act (FICA), and applicable provincial gambling
        legislation. A finding of non-compliance in any category represents a material regulatory risk
        requiring immediate remediation.
      </p>
    </div>

    <div class="compliance-table">
      <div class="compliance-row">
        <span>National Gambling Act (NGA) — Primary Compliance</span>
        <span class="badge ${rc.ngaCompliant ? 'badge-pass' : 'badge-fail'}">
          ${rc.ngaCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
        </span>
      </div>
      <div class="compliance-row">
        <span>Financial Intelligence Centre Act (FICA) — KYC &amp; AML</span>
        <span class="badge ${rc.ficaCompliant ? 'badge-pass' : 'badge-fail'}">
          ${rc.ficaCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
        </span>
      </div>
      <div class="compliance-row">
        <span>Audit Committee — Constituted and Operational</span>
        <span class="badge ${rc.auditCommittee ? 'badge-pass' : 'badge-fail'}">
          ${rc.auditCommittee ? 'ESTABLISHED' : 'NOT ESTABLISHED'}
        </span>
      </div>
      <div class="compliance-row">
        <span>Surveillance &amp; Monitoring System — Operational</span>
        <span class="badge ${rc.surveillanceSystem ? 'badge-pass' : 'badge-fail'}">
          ${rc.surveillanceSystem ? 'OPERATIONAL' : 'NON-OPERATIONAL'}
        </span>
      </div>
    </div>
  </div>

  <!-- 6. Staff Certifications -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">6.0</span>
      <span class="section-title">Staff Certification Register (Top 10)</span>
      <div class="section-rule"></div>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Staff Member</th>
            <th>Role</th>
            <th>Courses Completed</th>
            <th>Credits Earned</th>
            <th>Certification Date</th>
          </tr>
        </thead>
        <tbody>
          ${report.certifications.map(cert => `
            <tr>
              <td><strong>${e(cert.staffName)}</strong></td>
              <td>${e(cert.role)}</td>
              <td>${cert.coursesCompleted}</td>
              <td><span class="badge badge-pass">${cert.creditsEarned} credits</span></td>
              <td>${e(cert.certificationDate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 7. Audit Trail Verification -->
  ${auditChainSection(chain, '7.0')}

  <!-- 8. Findings, Recommendations & Legal Disclaimer -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">8.0</span>
      <span class="section-title">Findings, Recommendations &amp; Legal Disclaimer</span>
      <div class="section-rule"></div>
    </div>

    <div class="disclaimer-box">
      <h4>Basis of Report</h4>
      <p>
        This report has been prepared by SafeBet IQ (Pty) Ltd based on data sourced exclusively from
        its AI-powered compliance monitoring platform. The information reflects operational data for the
        period <strong>${periodStart}</strong> to <strong>${periodEnd}</strong> and is presented to assist
        ${report.casinoDetails.name} and the relevant regulatory authority in assessing the operator's
        compliance posture.
      </p>
      <p>
        This report has been compiled in accordance with the following legislative framework:
        National Gambling Act 7 of 2004; National Gambling Regulations; Financial Intelligence Centre
        Act (FICA); and applicable Provincial Gambling Acts and Regulations.
      </p>
    </div>

    <div class="disclaimer-box">
      <h4>Limitations</h4>
      <p>
        SafeBet IQ's assessment is limited to data made available through its platform integrations.
        This report does not constitute a legal opinion, an external audit opinion, or a guarantee of
        regulatory compliance. Operators are advised to engage independent legal counsel for definitive
        compliance determinations. SafeBet IQ accepts no liability for regulatory findings arising from
        information not captured within the platform.
      </p>
    </div>

    <div class="disclaimer-box">
      <h4>Confidentiality</h4>
      <p>
        This document is confidential and is intended solely for the use of ${e(report.casinoDetails.name)},
        its board, and the designated regulatory authority. Unauthorised disclosure, reproduction, or
        distribution is prohibited. This report is classified as a compliance document and must be
        retained for a minimum of five (5) years in accordance with record-keeping requirements under
        the National Gambling Act.
      </p>
    </div>

    <div class="signature-grid">
      <div class="sig-block">
        <div class="sig-label">Prepared By</div>
        <div class="sig-name">SafeBet IQ Compliance Engine</div>
        <div class="sig-title">AI-Powered Assurance Platform</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Report Reference</div>
        <div class="sig-name">${e(report.reportId)}</div>
        <div class="sig-title">Issue Date: ${generatedDate}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Regulatory Framework</div>
        <div class="sig-name">National Gambling Act 7/2004</div>
        <div class="sig-title">FICA &amp; Provincial Gambling Acts</div>
      </div>
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════ FOOTER -->
<div class="doc-footer">
  <div class="doc-footer-left">
    <p>&copy; ${year} SafeBet IQ (Pty) Ltd. All rights reserved.</p>
    <p>Confidential — for regulatory and compliance purposes only &nbsp;|&nbsp; compliance@safebetiq.com</p>
  </div>
  <div class="doc-footer-right">
    <div class="footer-brand">SafeBet IQ</div>
    <p>Independent Compliance Assurance</p>
    <p>${e(report.reportId)}</p>
  </div>
</div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Regulator / NGB audit report
// ---------------------------------------------------------------------------
function generateRegulatorHTML(
  report: RegulatorAuditReport,
  chain?: AuditChainStatus
): string {
  const generatedDate = fmtDateTime(report.generatedDate);
  const periodStart   = fmtDate(report.reportingPeriod.startDate);
  const periodEnd     = fmtDate(report.reportingPeriod.endDate);
  const year          = new Date().getFullYear();
  const is            = report.industrySummary;
  const tm            = report.trainingMetrics;
  const rm            = report.riskMetrics;
  const e             = escapeHTML;

  const compliantCount = report.casinoPerformance.filter(c => c.status === 'Compliant').length;
  const reviewCount    = report.casinoPerformance.filter(c => c.status === 'Under Review').length;
  const nonCompliantCount = report.casinoPerformance.filter(c => c.status === 'Non-Compliant').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NGB Industry Audit Report — ${e(report.reportId)}</title>
  ${BASE_STYLES}
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════ COVER -->
<div class="cover-page">
  <div>
    <div class="cover-logo">
      <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
    </div>
    <div class="cover-tagline">National Gambling Board — Independent Industry Audit</div>
  </div>

  <div class="cover-title-block">
    <div class="cover-rule"></div>
    <div class="cover-report-type">Regulator Report — Industry-Wide</div>
    <div class="cover-title">South African Casino<br>Industry Compliance<br>Audit Report</div>
    <div class="cover-subtitle">Prepared for the National Gambling Board under National Gambling Act 7 of 2004</div>

    <div class="cover-meta-grid">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Report Reference</div>
        <div class="cover-meta-value">${report.reportId}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Assessment Period</div>
        <div class="cover-meta-value">${periodStart} — ${periodEnd}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Operators Assessed</div>
        <div class="cover-meta-value">${is.totalCasinos} Licensed Casinos</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Industry Compliance</div>
        <div class="cover-meta-value">${is.industryComplianceRate}%</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Date of Issue</div>
        <div class="cover-meta-value">${generatedDate}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Classification</div>
        <div class="cover-meta-value">
          <span class="badge badge-fail" style="font-size:10px;padding:3px 10px;">RESTRICTED</span>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-footer-left">
      <p>SafeBet IQ (Pty) Ltd &nbsp;|&nbsp; AI-Powered Regulatory Intelligence Platform</p>
      <p>Prepared for: National Gambling Board, Republic of South Africa</p>
    </div>
    <div class="cover-confidential">Restricted — Regulatory Use Only</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ DOC HEADER -->
<div class="doc-header">
  <div class="doc-header-logo">
    <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
  </div>
  <div class="doc-header-meta">
    <p class="report-id">${e(report.reportId)}</p>
    <p>National Gambling Board Industry Audit &nbsp;·&nbsp; ${periodStart} – ${periodEnd}</p>
    <p>Generated: ${generatedDate}</p>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════ CONTENT -->
<div class="content">

  <!-- 1. Executive Summary -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">1.0</span>
      <span class="section-title">Executive Summary</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        SafeBet IQ has conducted an independent, AI-assisted industry-wide compliance audit of all
        <strong>${is.totalCasinos}</strong> licensed casino operators in South Africa for the period
        <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>.
        This report is submitted to the National Gambling Board (NGB) and presents our assessment of
        industry-wide training compliance, responsible gaming performance, and adherence to the
        legislative framework established under the National Gambling Act 7 of 2004.
      </p>
      <p>
        <strong>Industry Compliance Determination:</strong> The industry has achieved a weighted average
        compliance rate of <strong>${is.industryComplianceRate}%</strong>.
        Of the ${is.totalCasinos} operators assessed, <strong>${compliantCount}</strong>
        ${compliantCount === 1 ? 'is' : 'are'} fully compliant,
        <strong>${reviewCount}</strong> ${reviewCount === 1 ? 'is' : 'are'} under review, and
        <strong>${nonCompliantCount}</strong> ${nonCompliantCount === 1 ? 'has' : 'have'} been
        classified as non-compliant. Immediate regulatory attention is directed to the operators
        identified in Section 5.0 of this report.
      </p>
      ${is.totalPlayers !== undefined ? `<p>
        The platform monitored <strong>${is.totalPlayers.toLocaleString()}</strong> active players
        across all licensed premises during the assessment period, generating
        <strong>${is.totalInterventions?.toLocaleString()}</strong> responsible gaming interventions
        at a mean behavioural risk score of <strong>${is.avgRiskScore}</strong>. These metrics confirm
        the continued effectiveness of AI-powered responsible gambling oversight across the industry.
      </p>` : ''}
    </div>
  </div>

  <!-- 2. Industry Key Metrics -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">2.0</span>
      <span class="section-title">Industry Overview — Key Performance Indicators</span>
      <div class="section-rule"></div>
    </div>

    <div class="kpi-grid kpi-grid-4" style="margin-bottom:16px;">
      <div class="kpi-card">
        <div class="kpi-value">${is.totalCasinos}</div>
        <div class="kpi-label">Licensed Operators</div>
        <div class="kpi-note">Assessed this period</div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-value">${is.totalStaff.toLocaleString()}</div>
        <div class="kpi-label">Total Industry Staff</div>
        <div class="kpi-note">Active headcount</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${is.totalCredits.toLocaleString()}</div>
        <div class="kpi-label">CPD Credits Awarded</div>
        <div class="kpi-note">Assessment period</div>
      </div>
      <div class="kpi-card ${is.industryComplianceRate >= 80 ? '' : is.industryComplianceRate >= 50 ? 'warning' : 'alert'}">
        <div class="kpi-value">${is.industryComplianceRate}%</div>
        <div class="kpi-label">Industry Compliance Rate</div>
        <div class="kpi-note">Weighted average</div>
      </div>
    </div>

    ${is.totalPlayers !== undefined ? `
    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card info">
        <div class="kpi-value">${is.totalPlayers.toLocaleString()}</div>
        <div class="kpi-label">Players Monitored</div>
        <div class="kpi-note">All licensed premises</div>
      </div>
      <div class="kpi-card ${(is.totalInterventions ?? 0) > 0 ? 'warning' : ''}">
        <div class="kpi-value">${is.totalInterventions?.toLocaleString() ?? '—'}</div>
        <div class="kpi-label">AI Interventions Triggered</div>
        <div class="kpi-note">Assessment period</div>
      </div>
      <div class="kpi-card ${(is.avgRiskScore ?? 0) > 6 ? 'alert' : (is.avgRiskScore ?? 0) > 4 ? 'warning' : ''}">
        <div class="kpi-value">${is.avgRiskScore ?? '—'}</div>
        <div class="kpi-label">Mean Behavioural Risk Score</div>
        <div class="kpi-note">Scale 0–10</div>
      </div>
    </div>
    ` : ''}

    <div class="kpi-grid kpi-grid-3" style="margin-top:16px;">
      <div class="kpi-card">
        <div class="kpi-value" style="color:#065f46;">${compliantCount}</div>
        <div class="kpi-label">Compliant Operators</div>
        <div class="kpi-note">${Math.round((compliantCount / is.totalCasinos) * 100)}% of industry</div>
      </div>
      <div class="kpi-card warning">
        <div class="kpi-value">${reviewCount}</div>
        <div class="kpi-label">Under Review</div>
        <div class="kpi-note">${Math.round((reviewCount / is.totalCasinos) * 100)}% of industry</div>
      </div>
      <div class="kpi-card alert">
        <div class="kpi-value">${nonCompliantCount}</div>
        <div class="kpi-label">Non-Compliant</div>
        <div class="kpi-note">Require immediate action</div>
      </div>
    </div>
  </div>

  ${tm ? `
  <!-- 3. Training & Development Metrics -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">3.0</span>
      <span class="section-title">Training &amp; Professional Development Metrics</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        Staff training compliance underpins the responsible gambling framework. The following metrics
        reflect the industry's performance against the SafeBet IQ Academy curriculum and mandatory
        NGA training requirements for the assessment period.
      </p>
    </div>

    <div class="kpi-grid kpi-grid-4">
      <div class="kpi-card info">
        <div class="kpi-value">${tm.totalCourses}</div>
        <div class="kpi-label">Accredited Courses</div>
        <div class="kpi-note">Available curriculum</div>
      </div>
      <div class="kpi-card info">
        <div class="kpi-value">${tm.totalEnrollments.toLocaleString()}</div>
        <div class="kpi-label">Total Enrolments</div>
        <div class="kpi-note">Assessment period</div>
      </div>
      <div class="kpi-card ${tm.completionRate >= 75 ? '' : 'warning'}">
        <div class="kpi-value">${tm.completionRate}%</div>
        <div class="kpi-label">Course Completion Rate</div>
        <div class="kpi-note">Threshold: 75%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${tm.avgCreditsPerStaff}</div>
        <div class="kpi-label">Avg Credits per Staff</div>
        <div class="kpi-note">Industry mean</div>
      </div>
    </div>
  </div>
  ` : `
  <!-- 3. Training placeholder -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">3.0</span>
      <span class="section-title">Training &amp; Professional Development Metrics</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>Training metrics data was not available for inclusion in this report period.</p>
    </div>
  </div>
  `}

  ${rm ? `
  <!-- 4. Behavioural Risk & AI Monitoring -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">4.0</span>
      <span class="section-title">Behavioural Risk &amp; AI Monitoring Assessment</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        SafeBet IQ's behavioural risk engine continuously analyses patron activity across all licensed
        premises, assigning real-time risk scores and escalating cases meeting defined thresholds to
        trained compliance staff. The following metrics reflect the system's operational performance
        during the assessment period and demonstrate the efficacy of AI-assisted responsible gambling
        oversight at an industry level.
      </p>
    </div>

    <div class="kpi-grid kpi-grid-3" style="margin-bottom:16px;">
      <div class="kpi-card info">
        <div class="kpi-value">${rm.totalRiskAssessments.toLocaleString()}</div>
        <div class="kpi-label">Risk Assessments Performed</div>
        <div class="kpi-note">Assessment period</div>
      </div>
      <div class="kpi-card ${rm.highRiskCasinos > 0 ? 'alert' : ''}">
        <div class="kpi-value">${rm.highRiskCasinos}</div>
        <div class="kpi-label">High-Risk Operators</div>
        <div class="kpi-note">Compliance rate below 70%</div>
      </div>
      <div class="kpi-card ${rm.interventionSuccessRate >= 80 ? '' : 'warning'}">
        <div class="kpi-value">${rm.interventionSuccessRate}%</div>
        <div class="kpi-label">Intervention Success Rate</div>
        <div class="kpi-note">Industry-wide</div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- 5. Casino Performance Analysis -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">5.0</span>
      <span class="section-title">Casino Operator Performance Analysis</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        The table below presents the compliance assessment results for each licensed operator.
        Operators classified as <strong>Non-Compliant</strong> are required to submit a remediation plan
        to the NGB within 30 days of receipt of this report. Operators classified as
        <strong>Under Review</strong> are subject to enhanced monitoring for the subsequent quarter.
      </p>
    </div>

    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Operator Name</th>
            <th>License No.</th>
            <th>Headcount</th>
            <th>Trained</th>
            <th>Compliance Rate</th>
            <th>CPD Credits</th>
            <th>Determination</th>
          </tr>
        </thead>
        <tbody>
          ${report.casinoPerformance.map(casino => `
            <tr>
              <td><strong>${e(casino.casinoName)}</strong></td>
              <td>${e(casino.licenseNumber)}</td>
              <td>${casino.staffCount}</td>
              <td>${casino.trainedStaff}</td>
              <td>
                <strong>${casino.complianceRate}%</strong>
                <div class="progress-wrap" style="margin-top:4px;">
                  <div class="progress-fill ${progressColor(casino.complianceRate)}"
                    style="width:${Math.min(casino.complianceRate, 100)}%;"></div>
                </div>
              </td>
              <td>${casino.totalCredits.toLocaleString()}</td>
              <td>
                <span class="badge ${statusBadge(casino.status)}">${e(casino.status).toUpperCase()}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- 6. Compliance Issues Identified -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">6.0</span>
      <span class="section-title">Compliance Issues Identified</span>
      <div class="section-rule"></div>
    </div>
    <div class="narrative">
      <p>
        The following material compliance issues have been identified during the assessment period.
        Issues are categorised by severity and require attention commensurate with the risk they
        represent to the integrity of the regulated gambling environment.
      </p>
    </div>

    ${report.complianceIssues.length === 0
      ? `<div class="narrative"><p>No material compliance issues were identified during the assessment period.</p></div>`
      : report.complianceIssues.map(issue => `
        <div class="issue-card ${issueClass(issue.severity)}">
          <div class="issue-card-header">
            <span class="badge ${severityBadge(issue.severity)}">${e(issue.severity).toUpperCase()}</span>
            <span class="issue-card-title">${e(issue.category)}</span>
          </div>
          <p class="issue-card-desc">${e(issue.description)}</p>
          <p class="issue-card-meta">Affected Operators: <strong>${e(String(issue.affectedCasinos))}</strong> &nbsp;·&nbsp;
            ${issue.severity === 'High'
              ? 'Immediate remediation required — NGB notification triggered'
              : issue.severity === 'Medium'
              ? 'Remediation plan required within 30 days'
              : 'Monitor and report at next quarterly review'}
          </p>
        </div>
      `).join('')}
  </div>

  <!-- 7. Audit Trail Verification -->
  ${auditChainSection(chain, '7.0')}

  <!-- 8. Findings, Recommendations & Legal Disclaimer -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">8.0</span>
      <span class="section-title">Regulatory Recommendations &amp; Legal Disclaimer</span>
      <div class="section-rule"></div>
    </div>

    <ol class="rec-list">
      ${report.recommendations.map(rec => `
        <li class="rec-item">${e(rec)}</li>
      `).join('')}
    </ol>

    <div style="margin-top:24px;">
      <div class="disclaimer-box">
        <h4>Basis of Report &amp; Independence</h4>
        <p>
          This report has been prepared by SafeBet IQ (Pty) Ltd on behalf of the National Gambling Board.
          SafeBet IQ operates as an independent technology assurance provider and does not hold a financial
          interest in any of the licensed casino operators assessed herein. The findings are based solely
          on data ingested into the SafeBet IQ compliance platform for the assessment period
          <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>.
        </p>
        <p>
          This report is compiled in accordance with: National Gambling Act 7 of 2004; National Gambling
          Regulations; Financial Intelligence Centre Act (FICA); National Gambling Board Standards and
          Norms; and applicable Provincial Gambling Acts.
        </p>
      </div>

      <div class="disclaimer-box">
        <h4>Limitations of Scope</h4>
        <p>
          The assessment reflects data available within the SafeBet IQ platform integrations.
          On-premises physical compliance, infrastructure audits, and legal opinions fall outside
          the scope of this report. The NGB is advised to supplement this report with physical
          inspections where warranted. SafeBet IQ accepts no liability for enforcement decisions
          made in reliance on this document without independent verification.
        </p>
      </div>

      <div class="disclaimer-box">
        <h4>Restricted Distribution</h4>
        <p>
          This document is classified as Restricted and is intended solely for the National Gambling
          Board and authorised provincial regulators. Unauthorised disclosure constitutes a breach of
          the confidentiality obligations applicable to regulatory data under the Act. This report must
          be retained for a minimum of seven (7) years in accordance with NGB record-keeping requirements.
        </p>
      </div>
    </div>

    <div class="signature-grid">
      <div class="sig-block">
        <div class="sig-label">Prepared By</div>
        <div class="sig-name">SafeBet IQ Compliance Engine</div>
        <div class="sig-title">AI-Powered Regulatory Intelligence</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Report Reference</div>
        <div class="sig-name">${e(report.reportId)}</div>
        <div class="sig-title">Issued: ${generatedDate}</div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Submitted To</div>
        <div class="sig-name">National Gambling Board</div>
        <div class="sig-title">Republic of South Africa</div>
      </div>
    </div>
  </div>

</div>

<!-- ════════════════════════════════════════════════════════════ FOOTER -->
<div class="doc-footer">
  <div class="doc-footer-left">
    <p>&copy; ${year} SafeBet IQ (Pty) Ltd. All rights reserved.</p>
    <p>Restricted — for National Gambling Board regulatory use only &nbsp;|&nbsp; compliance@safebetiq.com</p>
  </div>
  <div class="doc-footer-right">
    <div class="footer-brand">SafeBet IQ</div>
    <p>National Gambling Board — Industry Audit</p>
    <p>${e(report.reportId)}</p>
  </div>
</div>

</body>
</html>`;
}
