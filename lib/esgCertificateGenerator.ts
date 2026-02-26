import { supabase } from './supabase';

export interface ESGCertificateData {
  casinoName: string;
  licenseNumber: string;
  reportingPeriod: {
    start: string;
    end: string;
  };
  compositeScore: number;
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  kingIVOutcomes: {
    ethicalCulture: number;
    goodPerformance: number;
    effectiveControl: number;
    legitimacy: number;
  };
  metrics: {
    nrgpContribution: number;
    interventionsPerformed: number;
    successfulInterventions: number;
    employeesTrained: number;
    trainingCompletionRate: number;
    complianceAuditsPassed: number;
  };
  certificationDate: string;
  trend: 'improving' | 'stable' | 'declining' | 'new';
  scoreChange: number;
}

export async function fetchESGCertificateData(casinoId: string): Promise<ESGCertificateData> {
  const { data: casino } = await supabase
    .from('casinos')
    .select('name, license_number')
    .eq('id', casinoId)
    .single();

  if (!casino) throw new Error('Casino not found');

  const { data: latestScore } = await supabase
    .from('esg_scores')
    .select('*')
    .eq('casino_id', casinoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: latestMetrics } = await supabase
    .from('esg_metrics')
    .select('*')
    .eq('casino_id', casinoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const compositeScore = latestScore?.composite_score || 0;
  const environmentalScore = latestScore?.environmental_score || 0;
  const socialScore = latestScore?.social_score || 0;
  const governanceScore = latestScore?.governance_score || 0;

  return {
    casinoName: casino.name,
    licenseNumber: casino.license_number,
    reportingPeriod: {
      start: latestScore?.scoring_period_start || new Date().toISOString().split('T')[0],
      end: latestScore?.scoring_period_end || new Date().toISOString().split('T')[0],
    },
    compositeScore,
    environmentalScore,
    socialScore,
    governanceScore,
    kingIVOutcomes: {
      ethicalCulture: latestScore?.ethical_culture_score || 0,
      goodPerformance: latestScore?.good_performance_score || 0,
      effectiveControl: latestScore?.effective_control_score || 0,
      legitimacy: latestScore?.legitimacy_score || 0,
    },
    metrics: {
      nrgpContribution: latestMetrics?.nrgp_contribution_amount || 0,
      interventionsPerformed: latestMetrics?.interventions_performed || 0,
      successfulInterventions: latestMetrics?.successful_interventions || 0,
      employeesTrained: latestMetrics?.employees_trained || 0,
      trainingCompletionRate: latestMetrics?.training_completion_rate || 0,
      complianceAuditsPassed: latestMetrics?.compliance_audits_passed || 0,
    },
    certificationDate: new Date().toISOString(),
    trend: latestScore?.trend_direction || 'new',
    scoreChange: latestScore?.score_change || 0,
  };
}

function getScoreRating(score: number): { rating: string; color: string } {
  if (score >= 90) return { rating: 'Excellent', color: '#10b981' };
  if (score >= 80) return { rating: 'Very Good', color: '#3b82f6' };
  if (score >= 70) return { rating: 'Good', color: '#6366f1' };
  if (score >= 60) return { rating: 'Satisfactory', color: '#f59e0b' };
  if (score >= 50) return { rating: 'Needs Improvement', color: '#ef4444' };
  return { rating: 'Critical', color: '#dc2626' };
}

function generateESGCertificateHTML(data: ESGCertificateData): string {
  const compositeRating = getScoreRating(data.compositeScore);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatCurrency = (amount: number) => `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      width: 210mm;
      min-height: 297mm;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      color: #1a1a1a;
    }
    .certificate {
      background: white;
      padding: 50px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 8px;
      background: linear-gradient(90deg, #10b981, #3b82f6, #6366f1);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #f0f0f0;
      padding-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
      margin: 20px 0 10px;
      letter-spacing: 1px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
    .casino-info {
      text-align: center;
      margin: 30px 0;
      padding: 25px;
      background: linear-gradient(135deg, #f8f9ff, #f0f4ff);
      border-radius: 12px;
      border: 2px solid #e5e7eb;
    }
    .casino-name {
      font-size: 26px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .license {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
    .score-section {
      margin: 30px 0;
      text-align: center;
    }
    .composite-score {
      display: inline-block;
      padding: 30px 50px;
      background: linear-gradient(135deg, ${compositeRating.color}, ${compositeRating.color}dd);
      border-radius: 20px;
      color: white;
      margin: 20px 0;
      box-shadow: 0 10px 30px ${compositeRating.color}40;
    }
    .score-number {
      font-size: 64px;
      font-weight: bold;
      line-height: 1;
    }
    .score-label {
      font-size: 16px;
      margin-top: 10px;
      opacity: 0.95;
    }
    .score-rating {
      font-size: 20px;
      font-weight: bold;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 30px 0;
    }
    .score-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      border: 2px solid #e5e7eb;
    }
    .score-card-title {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 10px;
      letter-spacing: 1px;
    }
    .score-card-value {
      font-size: 36px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .outcomes-section {
      margin: 30px 0;
      padding: 25px;
      background: #fafafa;
      border-radius: 12px;
      border: 2px solid #e5e7eb;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 20px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .outcomes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .outcome-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      background: white;
      border-radius: 8px;
      font-size: 13px;
      border: 1px solid #e5e7eb;
    }
    .outcome-label {
      color: #666;
      font-weight: 500;
    }
    .outcome-value {
      font-weight: bold;
      color: #1a1a1a;
      font-size: 16px;
    }
    .metrics-section {
      margin: 30px 0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .metric-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #6366f1;
      border: 1px solid #e5e7eb;
      border-left-width: 4px;
    }
    .metric-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 5px;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    .footer-bold {
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .certification-seal {
      display: inline-block;
      margin: 20px 0;
      padding: 15px 30px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border-radius: 50px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    .period-info {
      text-align: center;
      margin: 20px 0;
      font-size: 13px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">SafeBet IQ</div>
      <div class="title">ESG Performance Certificate</div>
      <div class="subtitle">King IV Governance Framework Aligned</div>
      <div class="certification-seal">Certified ESG Compliant</div>
    </div>

    <div class="casino-info">
      <div class="casino-name">${data.casinoName}</div>
      <div class="license">License Number: ${data.licenseNumber}</div>
    </div>

    <div class="period-info">
      Reporting Period: ${formatDate(data.reportingPeriod.start)} - ${formatDate(data.reportingPeriod.end)}
    </div>

    <div class="score-section">
      <div class="section-title">Composite ESG Score</div>
      <div class="composite-score">
        <div class="score-number">${data.compositeScore.toFixed(1)}</div>
        <div class="score-label">out of 100</div>
        <div class="score-rating">${compositeRating.rating}</div>
      </div>
    </div>

    <div class="scores-grid">
      <div class="score-card">
        <div class="score-card-title">Environmental</div>
        <div class="score-card-value">${data.environmentalScore.toFixed(1)}</div>
      </div>
      <div class="score-card">
        <div class="score-card-title">Social</div>
        <div class="score-card-value">${data.socialScore.toFixed(1)}</div>
      </div>
      <div class="score-card">
        <div class="score-card-title">Governance</div>
        <div class="score-card-value">${data.governanceScore.toFixed(1)}</div>
      </div>
    </div>

    <div class="outcomes-section">
      <div class="section-title">King IV Outcomes</div>
      <div class="outcomes-grid">
        <div class="outcome-item">
          <span class="outcome-label">Ethical Culture</span>
          <span class="outcome-value">${data.kingIVOutcomes.ethicalCulture.toFixed(1)}</span>
        </div>
        <div class="outcome-item">
          <span class="outcome-label">Good Performance</span>
          <span class="outcome-value">${data.kingIVOutcomes.goodPerformance.toFixed(1)}</span>
        </div>
        <div class="outcome-item">
          <span class="outcome-label">Effective Control</span>
          <span class="outcome-value">${data.kingIVOutcomes.effectiveControl.toFixed(1)}</span>
        </div>
        <div class="outcome-item">
          <span class="outcome-label">Legitimacy</span>
          <span class="outcome-value">${data.kingIVOutcomes.legitimacy.toFixed(1)}</span>
        </div>
      </div>
    </div>

    <div class="metrics-section">
      <div class="section-title">Key Performance Metrics</div>
      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-label">NRGP Contribution</div>
          <div class="metric-value">${formatCurrency(data.metrics.nrgpContribution)}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Interventions Performed</div>
          <div class="metric-value">${data.metrics.interventionsPerformed.toLocaleString()}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Successful Interventions</div>
          <div class="metric-value">${data.metrics.successfulInterventions.toLocaleString()}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Employees Trained</div>
          <div class="metric-value">${data.metrics.employeesTrained.toLocaleString()}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Training Completion Rate</div>
          <div class="metric-value">${data.metrics.trainingCompletionRate.toFixed(1)}%</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Compliance Audits Passed</div>
          <div class="metric-value">${data.metrics.complianceAuditsPassed}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-bold">This certificate confirms compliance with King IV ESG governance principles</div>
      <div>Issued: ${formatDate(data.certificationDate)}</div>
      <div style="margin-top: 10px;">SafeBet IQ | Africa's Leading AI-Driven Responsible Gambling Platform</div>
      <div>National Gambling Act 7 of 2004 | King IV Corporate Governance Framework</div>
    </div>
  </div>
</body>
</html>
  `;
}

export async function generateESGCertificatePDF(casinoId: string): Promise<void> {
  try {
    const html2pdf = (await import('html2pdf.js')).default;

    const certificateData = await fetchESGCertificateData(casinoId);
    const htmlContent = generateESGCertificateHTML(certificateData);

    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);

    const opt = {
      margin: 0,
      filename: `${certificateData.casinoName.replace(/\s+/g, '_')}_ESG_Certificate_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    await html2pdf().set(opt).from(element).save();

    document.body.removeChild(element);
  } catch (error) {
    console.error('Error generating ESG certificate:', error);
    throw error;
  }
}
