import { CasinoComplianceReport, RegulatorAuditReport } from './reportGenerator';

export function generateHTMLReport(
  report: CasinoComplianceReport | RegulatorAuditReport,
  type: 'casino' | 'regulator'
): string {
  const now = new Date().toLocaleString('en-ZA', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const baseStyles = `
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

      .card {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 18px;
        margin-bottom: 15px;
        page-break-inside: avoid;
      }

      .card-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #111827;
      }

      .grid {
        display: grid;
        gap: 15px;
        page-break-inside: avoid;
      }

      .grid-2 { grid-template-columns: repeat(2, 1fr); }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
      .grid-4 { grid-template-columns: repeat(4, 1fr); }

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

      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 12px;
      }

      .info-row:last-child {
        border-bottom: none;
      }

      .info-label {
        font-weight: 600;
        color: #374151;
      }

      .info-value {
        color: #6b7280;
      }

      .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 600;
      }

      .badge-success {
        background: #d1fae5;
        color: #065f46;
      }

      .badge-warning {
        background: #fed7aa;
        color: #92400e;
      }

      .badge-error {
        background: #fecaca;
        color: #991b1b;
      }

      .badge-info {
        background: #dbeafe;
        color: #1e40af;
      }

      .compliance-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        page-break-inside: avoid;
      }

      .compliance-item {
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
      }

      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 11px;
      }

      .table th {
        background: #f3f4f6;
        padding: 8px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
        font-size: 11px;
      }

      .table td {
        padding: 8px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 10px;
      }

      .table tr:last-child td {
        border-bottom: none;
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
        font-size: 11px;
        margin: 6px 0;
      }

      .footer-legal {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #374151;
        font-size: 10px;
        color: #6b7280;
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
          page-break-inside: avoid;
        }

        .grid {
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

        .compliance-grid {
          page-break-inside: avoid;
        }

        .footer {
          page-break-before: auto;
        }
      }
    </style>
  `;

  if (type === 'casino') {
    return generateCasinoHTML(report as CasinoComplianceReport, now, baseStyles);
  } else {
    return generateRegulatorHTML(report as RegulatorAuditReport, now, baseStyles);
  }
}

function generateCasinoHTML(
  report: CasinoComplianceReport,
  timestamp: string,
  styles: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Casino Compliance Report - ${report.reportId}</title>
  ${styles}
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
    </div>
    <div class="report-info">
      <h1>Casino Compliance Report</h1>
      <p>Report ID: ${report.reportId}</p>
      <p>Generated: ${timestamp}</p>
      <p>National Gambling Act 7 of 2004</p>
    </div>
  </div>

  <div class="container">
    <!-- Casino Details Section -->
    <div class="section">
      <div class="section-header">
        <span>🏢</span>
        <h2>Casino Details</h2>
      </div>
      <div class="card">
        <div class="grid grid-2">
          <div class="info-row">
            <span class="info-label">Casino Name:</span>
            <span class="info-value">${report.casinoDetails.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">License Number:</span>
            <span class="info-value">${report.casinoDetails.licenseNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Address:</span>
            <span class="info-value">${report.casinoDetails.address}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact Email:</span>
            <span class="info-value">${report.casinoDetails.contactEmail}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Reporting Period:</span>
            <span class="info-value">
              ${new Date(report.reportingPeriod.startDate).toLocaleDateString('en-ZA')} -
              ${new Date(report.reportingPeriod.endDate).toLocaleDateString('en-ZA')}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Training Compliance Section -->
    <div class="section">
      <div class="section-header">
        <span>🎓</span>
        <h2>Training Compliance (National Gambling Act Requirements)</h2>
      </div>

      <div class="grid grid-3" style="margin-bottom: 24px;">
        <div class="stat-box">
          <div class="stat-value">${report.trainingCompliance.complianceRate}%</div>
          <div class="stat-label">Compliance Rate</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.trainingCompliance.trainedStaff}/${report.trainingCompliance.totalStaff}</div>
          <div class="stat-label">Trained Staff</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.trainingCompliance.totalCredits}</div>
          <div class="stat-label">Total Credits Earned</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Staff Breakdown by Role</div>
        <table class="table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Total Staff</th>
              <th>Trained Staff</th>
              <th>Compliance Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.trainingCompliance.staffBreakdown
              .map(
                (role) => `
              <tr>
                <td><strong>${role.role}</strong></td>
                <td>${role.count}</td>
                <td>${role.trained}</td>
                <td>${role.rate}%</td>
                <td>
                  <span class="badge ${role.rate >= 80 ? 'badge-success' : 'badge-warning'}">
                    ${role.rate >= 80 ? 'Compliant' : 'Needs Improvement'}
                  </span>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Regulatory Compliance Section -->
    <div class="section">
      <div class="section-header">
        <span>⚖️</span>
        <h2>Regulatory Compliance Status</h2>
      </div>

      <div class="compliance-grid">
        <div class="compliance-item">
          <span class="info-label">National Gambling Act (NGA) Compliant</span>
          <span class="badge ${report.regulatoryCompliance.ngaCompliant ? 'badge-success' : 'badge-error'}">
            ${report.regulatoryCompliance.ngaCompliant ? '✓ Compliant' : '✗ Non-Compliant'}
          </span>
        </div>
        <div class="compliance-item">
          <span class="info-label">FICA Compliance</span>
          <span class="badge ${report.regulatoryCompliance.ficaCompliant ? 'badge-success' : 'badge-error'}">
            ${report.regulatoryCompliance.ficaCompliant ? '✓ Compliant' : '✗ Non-Compliant'}
          </span>
        </div>
        <div class="compliance-item">
          <span class="info-label">Audit Committee Established</span>
          <span class="badge ${report.regulatoryCompliance.auditCommittee ? 'badge-success' : 'badge-error'}">
            ${report.regulatoryCompliance.auditCommittee ? '✓ Established' : '✗ Not Established'}
          </span>
        </div>
        <div class="compliance-item">
          <span class="info-label">Surveillance System Operational</span>
          <span class="badge ${report.regulatoryCompliance.surveillanceSystem ? 'badge-success' : 'badge-error'}">
            ${report.regulatoryCompliance.surveillanceSystem ? '✓ Operational' : '✗ Not Operational'}
          </span>
        </div>
      </div>
    </div>

    <!-- Risk Management Section -->
    <div class="section">
      <div class="section-header">
        <span>🛡️</span>
        <h2>Risk Management & AI-Powered Interventions</h2>
      </div>

      <div class="grid grid-3">
        <div class="stat-box">
          <div class="stat-value">${report.riskManagement.interventions}</div>
          <div class="stat-label">Total Interventions</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.riskManagement.successRate}%</div>
          <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.riskManagement.avgResponseTime}</div>
          <div class="stat-label">Avg Response Time</div>
        </div>
      </div>
    </div>

    <!-- Staff Certifications Section -->
    <div class="section">
      <div class="section-header">
        <span>🏆</span>
        <h2>Staff Certifications (Top 10 Performers)</h2>
      </div>

      <div class="card">
        <table class="table">
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
            ${report.certifications
              .map(
                (cert) => `
              <tr>
                <td><strong>${cert.staffName}</strong></td>
                <td>${cert.role}</td>
                <td>${cert.coursesCompleted}</td>
                <td><span class="badge badge-success">${cert.creditsEarned} credits</span></td>
                <td>${cert.certificationDate}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Compliance Declaration Section -->
    <div class="section">
      <div class="section-header">
        <span>📋</span>
        <h2>Compliance Declaration</h2>
      </div>

      <div class="card">
        <p style="margin-bottom: 16px;"><strong>This report has been generated in accordance with:</strong></p>
        <ul style="list-style: disc; margin-left: 24px; margin-bottom: 20px;">
          <li>National Gambling Act 7 of 2004</li>
          <li>National Gambling Regulations</li>
          <li>Financial Intelligence Centre Act (FICA)</li>
          <li>Provincial Gambling Acts and Regulations</li>
          <li>SafeBet IQ Academy Training Standards</li>
        </ul>
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Certification:</strong> The information contained herein is accurate and complete as of
          ${new Date(report.generatedDate).toLocaleDateString('en-ZA')}. This report is generated by
          SafeBet IQ's AI-powered compliance monitoring system and reflects real-time data from our
          training academy and responsible gaming platform.
        </p>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-content">
      <h3>SafeBet IQ Compliance System</h3>
      <p>AI-Powered Responsible Gaming Technology</p>
      <p>Helping casinos exceed regulatory standards and protect players</p>
      <div class="footer-legal">
        <p>© ${new Date().getFullYear()} SafeBet IQ (Pty) Ltd. All rights reserved.</p>
        <p>This report is confidential and intended for regulatory and compliance purposes only.</p>
        <p>For questions or concerns, contact compliance@safeplayai.com</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateRegulatorHTML(
  report: RegulatorAuditReport,
  timestamp: string,
  styles: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>National Gambling Board Audit Report - ${report.reportId}</title>
  ${styles}
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <img src="/safebet-logo-transparent.png" alt="SafeBet IQ" />
    </div>
    <div class="report-info">
      <h1>National Gambling Board</h1>
      <h1>Industry Audit Report</h1>
      <p>Report ID: ${report.reportId}</p>
      <p>Generated: ${timestamp}</p>
      <p>National Gambling Act 7 of 2004</p>
    </div>
  </div>

  <div class="container">
    <!-- Industry Summary Section -->
    <div class="section">
      <div class="section-header">
        <span>📊</span>
        <h2>Industry Summary</h2>
      </div>

      <div class="card">
        <p style="margin-bottom: 20px; font-size: 14px; color: #6b7280;">
          <strong>Reporting Period:</strong>
          ${new Date(report.reportingPeriod.startDate).toLocaleDateString('en-ZA')} -
          ${new Date(report.reportingPeriod.endDate).toLocaleDateString('en-ZA')}
        </p>
      </div>

      <div class="grid grid-4">
        <div class="stat-box">
          <div class="stat-value">${report.industrySummary.totalCasinos}</div>
          <div class="stat-label">Licensed Casinos</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.industrySummary.totalStaff.toLocaleString()}</div>
          <div class="stat-label">Industry Staff</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.industrySummary.totalCredits.toLocaleString()}</div>
          <div class="stat-label">Total Credits Awarded</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${report.industrySummary.industryComplianceRate}%</div>
          <div class="stat-label">Industry Compliance</div>
        </div>
      </div>
      ${report.industrySummary.totalPlayers !== undefined ? `
        <div class="grid grid-3" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <div class="stat-box">
            <div class="stat-value" style="font-size: 24px;">${report.industrySummary.totalPlayers.toLocaleString()}</div>
            <div class="stat-label">Total Players Monitored</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="font-size: 24px; color: #dc2626;">${report.industrySummary.totalInterventions?.toLocaleString()}</div>
            <div class="stat-label">AI Interventions</div>
          </div>
          <div class="stat-box">
            <div class="stat-value" style="font-size: 24px; color: #ca8a04;">${report.industrySummary.avgRiskScore}</div>
            <div class="stat-label">Avg Risk Score</div>
          </div>
        </div>
      ` : ''}
    </div>

    ${report.trainingMetrics ? `
    <!-- Training & Development Metrics Section -->
    <div class="section">
      <div class="section-header" style="background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);">
        <span>🎓</span>
        <h2>Training & Development Metrics</h2>
      </div>

      <div class="grid grid-4">
        <div class="stat-box">
          <div class="stat-value" style="color: #9333ea;">${report.trainingMetrics.totalCourses}</div>
          <div class="stat-label">Available Courses</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #2563eb;">${report.trainingMetrics.totalEnrollments.toLocaleString()}</div>
          <div class="stat-label">Total Enrollments</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #89d848;">${report.trainingMetrics.completionRate}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #ea580c;">${report.trainingMetrics.avgCreditsPerStaff}</div>
          <div class="stat-label">Avg Credits per Staff</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${report.riskMetrics ? `
    <!-- Behavioral Risk & AI Monitoring Section -->
    <div class="section">
      <div class="section-header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
        <span>🛡️</span>
        <h2>Behavioral Risk & AI Monitoring</h2>
      </div>

      <div class="grid grid-3">
        <div class="stat-box">
          <div class="stat-value" style="color: #2563eb;">${report.riskMetrics.totalRiskAssessments.toLocaleString()}</div>
          <div class="stat-label">Risk Assessments Performed</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #dc2626;">${report.riskMetrics.highRiskCasinos}</div>
          <div class="stat-label">High-Risk Casinos</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" style="color: #89d848;">${report.riskMetrics.interventionSuccessRate}%</div>
          <div class="stat-label">Intervention Success Rate</div>
        </div>
      </div>

      <div class="card" style="margin-top: 20px;">
        <p style="font-size: 13px; color: #4b5563; line-height: 1.6;">
          SafeBet IQ's AI-powered behavioral risk intelligence system continuously monitors player behavior
          across all licensed casinos, identifying at-risk patterns and recommending timely interventions.
          This proactive approach has resulted in an industry-leading ${report.riskMetrics.interventionSuccessRate}%
          success rate in preventing problem gambling escalation.
        </p>
      </div>
    </div>
    ` : ''}

    <!-- Casino Performance Analysis Section -->
    <div class="section">
      <div class="section-header">
        <span>🏢</span>
        <h2>Casino Performance Analysis</h2>
      </div>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Casino Name</th>
              <th>License Number</th>
              <th>Total Staff</th>
              <th>Trained Staff</th>
              <th>Compliance Rate</th>
              <th>Total Credits</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.casinoPerformance
              .map(
                (casino) => `
              <tr>
                <td><strong>${casino.casinoName}</strong></td>
                <td>${casino.licenseNumber}</td>
                <td>${casino.staffCount}</td>
                <td>${casino.trainedStaff}</td>
                <td><strong>${casino.complianceRate}%</strong></td>
                <td>${casino.totalCredits}</td>
                <td>
                  <span class="badge ${
                    casino.status === 'Compliant'
                      ? 'badge-success'
                      : casino.status === 'Under Review'
                      ? 'badge-warning'
                      : 'badge-error'
                  }">
                    ${casino.status}
                  </span>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Compliance Issues Section -->
    <div class="section">
      <div class="section-header">
        <span>⚠️</span>
        <h2>Compliance Issues Identified</h2>
      </div>

      ${report.complianceIssues
        .map(
          (issue) => `
        <div class="card">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span class="badge ${
              issue.severity === 'High'
                ? 'badge-error'
                : issue.severity === 'Medium'
                ? 'badge-warning'
                : 'badge-info'
            }">
              ${issue.severity.toUpperCase()}
            </span>
            <h3 style="font-size: 16px; font-weight: 600;">${issue.category}</h3>
          </div>
          <p style="color: #4b5563; margin-bottom: 12px;">${issue.description}</p>
          <p style="font-size: 14px; color: #6b7280;">
            <strong>Affected Casinos:</strong> ${issue.affectedCasinos}
          </p>
        </div>
      `
        )
        .join('')}
    </div>

    <!-- Regulatory Recommendations Section -->
    <div class="section">
      <div class="section-header">
        <span>💡</span>
        <h2>Regulatory Recommendations</h2>
      </div>

      <div class="card">
        <ol style="list-style: decimal; margin-left: 24px;">
          ${report.recommendations
            .map(
              (rec) => `
            <li style="margin-bottom: 12px; color: #374151;">${rec}</li>
          `
            )
            .join('')}
        </ol>
      </div>
    </div>

    <!-- Compliance Framework Section -->
    <div class="section">
      <div class="section-header">
        <span>📋</span>
        <h2>Compliance Framework & Legal Requirements</h2>
      </div>

      <div class="card">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Legislative Framework</h3>
        <p style="margin-bottom: 16px;">This audit report is compiled in accordance with:</p>
        <ul style="list-style: disc; margin-left: 24px; margin-bottom: 24px;">
          <li>National Gambling Act 7 of 2004</li>
          <li>National Gambling Regulations</li>
          <li>Provincial Gambling Acts</li>
          <li>Financial Intelligence Centre Act (FICA)</li>
          <li>National Gambling Board Standards and Norms</li>
        </ul>

        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Minimum Requirements</h3>
        <p style="margin-bottom: 12px;">All licensed casinos are required to maintain:</p>
        <ul style="list-style: disc; margin-left: 24px;">
          <li>Annual license renewal compliance</li>
          <li>Quarterly compliance committee meetings</li>
          <li>Independent audit committee (minimum 3 members)</li>
          <li>Operational surveillance and monitoring systems</li>
          <li>Comprehensive staff training and certification programs</li>
          <li>FICA compliance and KYC procedures</li>
          <li>Responsible gambling intervention protocols</li>
          <li>Annual external compliance audits</li>
        </ul>
      </div>
    </div>

    <!-- Executive Summary Section -->
    <div class="section">
      <div class="section-header">
        <span>📝</span>
        <h2>Executive Summary</h2>
      </div>

      <div class="card">
        <p style="margin-bottom: 16px;">
          This comprehensive audit report provides an overview of the South African casino industry's
          compliance status for the reporting period. The data reflects real-time monitoring through
          SafeBet IQ's AI-powered compliance platform, which tracks staff training, certification
          completion, and responsible gaming interventions across all licensed operators.
        </p>
        <p style="margin-bottom: 16px;">
          <strong>Key Findings:</strong> The industry maintains an average compliance rate of
          ${report.industrySummary.industryComplianceRate}% with ${report.industrySummary.totalCasinos}
          licensed operators employing ${report.industrySummary.totalStaff.toLocaleString()} staff members.
          A total of ${report.industrySummary.totalCredits.toLocaleString()} professional development
          credits have been awarded through the SafeBet IQ Academy training platform.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Data Accuracy:</strong> All metrics in this report are derived from verified training
          records, certification completions, and compliance monitoring data as of
          ${new Date(report.generatedDate).toLocaleDateString('en-ZA')}.
        </p>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-content">
      <h3>SafeBet IQ Compliance System</h3>
      <p>AI-Powered Regulatory Oversight & Training Platform</p>
      <p>Supporting the National Gambling Board's mission to ensure responsible gaming standards</p>
      <div class="footer-legal">
        <p>© ${new Date().getFullYear()} SafeBet IQ (Pty) Ltd. All rights reserved.</p>
        <p>This report is confidential and intended for National Gambling Board regulatory purposes only.</p>
        <p>Report compiled under National Gambling Act 7 of 2004 • For inquiries: compliance@safeplayai.com</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
