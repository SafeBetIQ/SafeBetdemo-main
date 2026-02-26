export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers
        .map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function anonymizePlayerId(playerId: string): string {
  if (playerId.startsWith('P_')) {
    return playerId;
  }

  const hash = playerId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  const anonymized = Math.abs(hash).toString(36).toUpperCase().substring(0, 8);
  return `P_${anonymized}`;
}

export interface ExportableBRIData {
  player_id: string;
  risk_score: number;
  bri_score: number;
  impulse_level: number;
  cognitive_fatigue: number;
  personality_shift: string;
  predicted_escalation: string;
  intervention_recommended: boolean;
  timestamp: string;
}

export function exportBRIData(data: ExportableBRIData[], casinoName: string) {
  const anonymizedData = data.map(record => ({
    'Player ID (Anonymized)': anonymizePlayerId(record.player_id),
    'Risk Score': record.risk_score,
    'BRI Score': record.bri_score,
    'Impulse Level': record.impulse_level,
    'Cognitive Fatigue Index': record.cognitive_fatigue,
    'Personality Shift': record.personality_shift,
    'Predicted Escalation': record.predicted_escalation,
    'Intervention Required': record.intervention_recommended ? 'Yes' : 'No',
    'Analysis Timestamp': new Date(record.timestamp).toLocaleString(),
  }));

  exportToCSV(anonymizedData, `BRI_Report_${casinoName.replace(/\s+/g, '_')}`);
}

export interface ExportableESGData {
  casino_name: string;
  esg_score: number;
  esg_grade: string;
  wellbeing_index: number;
  humanity_score: number;
  recovery_rate: number;
  responsible_marketing: number;
  carbon_score: number;
  total_players: number;
  at_risk_players: number;
  period: string;
}

export function exportESGData(data: ExportableESGData[]) {
  const formattedData = data.map(record => ({
    'Casino': record.casino_name,
    'ESG Grade': record.esg_grade,
    'Total ESG Score': record.esg_score,
    'Player Wellbeing Index': record.wellbeing_index,
    'Casino Humanity Score': record.humanity_score,
    'Recovery Rate (%)': record.recovery_rate,
    'Responsible Marketing Score': record.responsible_marketing,
    'Carbon Server Impact Score': record.carbon_score,
    'Total Players': record.total_players,
    'At-Risk Players': record.at_risk_players,
    'At-Risk Percentage': ((record.at_risk_players / record.total_players) * 100).toFixed(2) + '%',
    'Reporting Period': record.period,
  }));

  exportToCSV(formattedData, 'ESG_Sustainability_Report');
}

export interface ExportableInterventionData {
  player_id: string;
  timestamp: string;
  type: string;
  risk_score: number;
  reason: string;
  status: string;
  staff_member: string;
  outcome: string;
}

export function exportInterventionHistory(data: ExportableInterventionData[], casinoName: string) {
  const anonymizedData = data.map(record => ({
    'Player ID (Anonymized)': anonymizePlayerId(record.player_id),
    'Date': new Date(record.timestamp).toLocaleDateString(),
    'Time': new Date(record.timestamp).toLocaleTimeString(),
    'Intervention Type': record.type,
    'Risk Score at Time': record.risk_score,
    'Reason': record.reason,
    'Status': record.status,
    'Staff Member': record.staff_member,
    'Outcome': record.outcome,
  }));

  exportToCSV(anonymizedData, `Intervention_Log_${casinoName.replace(/\s+/g, '_')}`);
}

export function exportComplianceAuditReport(
  casinoData: any,
  interventions: ExportableInterventionData[],
  briData: ExportableBRIData[],
  esgData: ExportableESGData
) {
  const summaryData = [{
    'Report Type': 'Compliance Audit Report',
    'Casino': casinoData.name,
    'License Number': casinoData.license_number,
    'Generated Date': new Date().toLocaleString(),
    'Reporting Period': esgData.period,
    '': '',
    'ESG Grade': esgData.esg_grade,
    'ESG Score': esgData.esg_score,
    'Wellbeing Index': esgData.wellbeing_index,
    'Humanity Score': esgData.humanity_score,
    'Recovery Rate': esgData.recovery_rate + '%',
    ' ': '',
    'Total Players': esgData.total_players,
    'At-Risk Players': esgData.at_risk_players,
    'High-Risk Players (BRI > 75)': briData.filter(p => p.bri_score > 75).length,
    'Interventions Completed': interventions.filter(i => i.status === 'completed').length,
    'Interventions Pending': interventions.filter(i => i.status === 'pending').length,
    '  ': '',
    'Compliance Status': esgData.esg_score >= 70 ? 'COMPLIANT' : 'REQUIRES IMPROVEMENT',
    'Recommendation': esgData.esg_score >= 70 ? 'Maintain current standards' : 'Implement improvement plan',
  }];

  exportToCSV(summaryData, `Compliance_Audit_${casinoData.name.replace(/\s+/g, '_')}`);
}

export interface PlayerBehavioralRiskData {
  playerId: string;
  playerName: string;
  game: string;
  betAmount: number;
  totalWagered: number;
  sessionDuration: number;
  riskScore: number;
  riskLevel: string;
  impulseLevel: number;
  fatigueIndex: number;
  trend: string;
  isActive: boolean;
  lastBetTime: Date;
}

export function exportBehavioralRiskData(players: PlayerBehavioralRiskData[], casinoName: string) {
  const exportData = players.map(player => ({
    'Player ID (Anonymized)': anonymizePlayerId(player.playerId),
    'Player Name': player.playerName,
    'Current Game': player.game,
    'Current Bet': `R${player.betAmount.toFixed(2)}`,
    'Total Wagered': `R${player.totalWagered.toFixed(2)}`,
    'Session Duration (min)': player.sessionDuration,
    'Risk Score': player.riskScore,
    'Risk Level': player.riskLevel.toUpperCase(),
    'Impulse Level': player.impulseLevel.toFixed(1),
    'Cognitive Fatigue Index': player.fatigueIndex.toFixed(1),
    'Risk Trend': player.trend === 'up' ? 'Increasing' : player.trend === 'down' ? 'Decreasing' : 'Stable',
    'Active Status': player.isActive ? 'Active' : 'Inactive',
    'Last Activity': new Date(player.lastBetTime).toLocaleString(),
  }));

  exportToCSV(exportData, `Behavioral_Risk_Report_${casinoName.replace(/\s+/g, '_')}`);
}

export function generateBehavioralRiskPDF(
  players: PlayerBehavioralRiskData[],
  casinoName: string,
  stats: {
    totalPlayers: number;
    activePlayers: number;
    avgRiskScore: number;
    highRiskCount: number;
    criticalRiskCount: number;
    totalWagered: number;
  }
) {
  const sortedPlayers = [...players].sort((a, b) => b.riskScore - a.riskScore);

  const now = new Date().toLocaleString('en-ZA', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return '#991b1b';
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      case 'low': return '#89d848';
      default: return '#6b7280';
    }
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Behavioral Risk Intelligence Report - ${casinoName}</title>
  <style>
    @page {
      margin: 15mm;
      size: A4;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.4;
      color: #1f2937;
      background: white;
    }

    .header {
      background: #000000;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #89d848;
      page-break-after: avoid;
    }

    .logo-container {
      max-width: 250px;
    }

    .logo-container img {
      width: 100%;
      height: auto;
    }

    .report-info {
      text-align: right;
      color: white;
    }

    .report-info h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #89d848;
    }

    .report-info p {
      font-size: 12px;
      color: #9ca3af;
      margin: 2px 0;
    }

    .container {
      max-width: 100%;
      padding: 20px 30px;
    }

    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-header {
      background: linear-gradient(135deg, #89d848 0%, #3fa02b 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
      page-break-after: avoid;
    }

    .section-header h2 {
      font-size: 16px;
      font-weight: 700;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

    .stat-box {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #89d848;
      margin-bottom: 6px;
    }

    .stat-label {
      font-size: 12px;
      color: #6b7280;
    }

    .card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 18px;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      background: white;
      font-size: 10px;
    }

    .table th {
      background: #f3f4f6;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      font-size: 10px;
    }

    .table td {
      padding: 6px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 9px;
    }

    .table tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-critical {
      background: #fecaca;
      color: #991b1b;
    }

    .badge-high {
      background: #fecaca;
      color: #dc2626;
    }

    .badge-medium {
      background: #fed7aa;
      color: #92400e;
    }

    .badge-low {
      background: #d1fae5;
      color: #065f46;
    }

    .footer {
      background: #000000;
      color: #9ca3af;
      padding: 25px 30px;
      margin-top: 30px;
      text-align: center;
      border-top: 3px solid #89d848;
      page-break-inside: avoid;
    }

    .footer-content {
      max-width: 100%;
    }

    .footer h3 {
      color: #89d848;
      font-size: 16px;
      margin-bottom: 8px;
    }

    .footer p {
      font-size: 12px;
      margin: 6px 0;
    }

    .footer-legal {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #374151;
      font-size: 10px;
      color: #6b7280;
    }

    .alert-box {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 12px;
      margin-bottom: 15px;
      border-radius: 4px;
      page-break-inside: avoid;
    }

    .alert-box p {
      color: #92400e;
      font-size: 12px;
      margin: 2px 0;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .section {
        page-break-inside: avoid;
        margin-bottom: 20px;
      }

      .card {
        page-break-inside: auto;
      }

      .stats-grid {
        page-break-inside: avoid;
      }

      .section-header {
        page-break-after: avoid;
      }

      .table {
        page-break-inside: auto;
      }

      .table thead {
        display: table-header-group;
      }

      .table tr {
        page-break-inside: avoid;
      }

      .footer {
        page-break-before: auto;
      }

      .alert-box {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
    </div>
    <div class="report-info">
      <h1>Behavioral Risk Intelligence Report</h1>
      <p>${casinoName}</p>
      <p>Generated: ${now}</p>
    </div>
  </div>

  <div class="container">
    <div class="section">
      <div class="section-header">
        <span>📊</span>
        <h2>Executive Summary</h2>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.totalPlayers}</div>
          <div class="stat-label">Total Players</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${stats.activePlayers}</div>
          <div class="stat-label">Currently Active</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${stats.avgRiskScore.toFixed(1)}</div>
          <div class="stat-label">Average Risk Score</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value" style="color: #dc2626;">${stats.criticalRiskCount}</div>
          <div class="stat-label">Critical Risk Players</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #f59e0b;">${stats.highRiskCount}</div>
          <div class="stat-label">High Risk Players</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">R${stats.totalWagered.toLocaleString()}</div>
          <div class="stat-label">Total Wagered</div>
        </div>
      </div>

      ${stats.criticalRiskCount > 0 || stats.highRiskCount > 3 ? `
      <div class="alert-box">
        <p><strong>Alert:</strong> ${stats.criticalRiskCount} critical and ${stats.highRiskCount} high-risk players detected. Immediate intervention recommended.</p>
      </div>
      ` : ''}
    </div>

    <div class="section">
      <div class="section-header">
        <span>🎯</span>
        <h2>All Players - Comprehensive Risk Analysis</h2>
      </div>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Player ID</th>
              <th>Name</th>
              <th>Game</th>
              <th>Session (min)</th>
              <th>Wagered</th>
              <th>Risk Score</th>
              <th>Level</th>
              <th>Impulse</th>
              <th>Fatigue</th>
              <th>Trend</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sortedPlayers.map(player => `
            <tr>
              <td style="font-family: monospace; font-size: 11px;">${anonymizePlayerId(player.playerId)}</td>
              <td><strong>${player.playerName}</strong></td>
              <td>${player.game}</td>
              <td>${player.sessionDuration}</td>
              <td>R${player.totalWagered.toFixed(0)}</td>
              <td><strong style="color: ${getRiskColor(player.riskLevel)};">${player.riskScore}</strong></td>
              <td><span class="badge badge-${player.riskLevel.toLowerCase()}">${player.riskLevel}</span></td>
              <td>${player.impulseLevel.toFixed(0)}</td>
              <td>${player.fatigueIndex.toFixed(0)}</td>
              <td>${player.trend === 'up' ? '↑' : player.trend === 'down' ? '↓' : '→'}</td>
              <td>${player.isActive ? '🟢 Active' : '⚪ Idle'}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span>📋</span>
        <h2>Report Methodology</h2>
      </div>

      <div class="card">
        <p style="margin-bottom: 10px; font-size: 12px;">
          <strong>Behavioral Risk Intelligence™</strong> uses AI-powered real-time analytics to assess player behavior and identify at-risk patterns.
        </p>

        <p style="margin-bottom: 8px; font-size: 12px; font-weight: 600;">Key Metrics:</p>
        <ul style="list-style: disc; margin-left: 20px; margin-bottom: 10px; font-size: 11px;">
          <li><strong>Risk Score (0-100):</strong> Composite assessment based on betting patterns, session duration, and behavioral indicators</li>
          <li><strong>Impulse Level:</strong> Measures impulsive betting behavior and decision-making patterns</li>
          <li><strong>Cognitive Fatigue Index:</strong> Tracks mental exhaustion and decision quality degradation</li>
          <li><strong>Trend Analysis:</strong> Real-time monitoring of risk trajectory (increasing, decreasing, stable)</li>
        </ul>

        <p style="margin-bottom: 8px; font-size: 12px; font-weight: 600;">Risk Classification:</p>
        <ul style="list-style: disc; margin-left: 20px; font-size: 11px;">
          <li><strong>Critical (80-100):</strong> Immediate intervention required</li>
          <li><strong>High (60-79):</strong> Active monitoring recommended</li>
          <li><strong>Medium (40-59):</strong> Continued observation required</li>
          <li><strong>Low (0-39):</strong> Normal play patterns</li>
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span>⚖️</span>
        <h2>Compliance & Privacy</h2>
      </div>

      <div class="card">
        <p style="margin-bottom: 8px; font-size: 11px;">
          <strong>Compliance:</strong> National Gambling Act 7 of 2004, Protection of Personal Information Act (POPIA), Provincial Gambling Regulations, Responsible Gaming Best Practices.
        </p>
        <p style="color: #6b7280; font-size: 11px;">
          <strong>Privacy:</strong> All player identifiers anonymized. Confidential report for authorized personnel only.
        </p>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-content">
      <h3>SafeBet IQ - Behavioral Risk Intelligence™</h3>
      <p>AI-Powered Real-Time Player Protection</p>
      <p>World's First Behavioral Risk Intelligence Engine for Responsible Gaming</p>
      <div class="footer-legal">
        <p>© ${new Date().getFullYear()} SafeBet IQ (Pty) Ltd. All rights reserved.</p>
        <p>This report is confidential and intended for authorized casino personnel only.</p>
        <p>Report generated: ${now}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');

  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
