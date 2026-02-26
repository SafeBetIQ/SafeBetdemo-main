'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileText, CheckCircle, AlertCircle, Shield, Printer } from 'lucide-react';
import { CasinoComplianceReport, RegulatorAuditReport, generatePDFContent } from '@/lib/reportGenerator';
import { generateHTMLReport } from '@/lib/htmlReportGenerator';
import Image from 'next/image';
import { useState } from 'react';

interface ReportViewerProps {
  open: boolean;
  onClose: () => void;
  report: CasinoComplianceReport | RegulatorAuditReport | null;
  type: 'casino' | 'regulator';
}

export function ReportViewer({ open, onClose, report, type }: ReportViewerProps) {
  const [exportingPDF, setExportingPDF] = useState(false);

  if (!report) {
    console.log('ReportViewer: No report provided');
    return null;
  }

  console.log('ReportViewer: Rendering report', { type, reportId: report.reportId });

  const handleDownload = () => {
    const content = generatePDFContent(report, type);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = () => {
    const htmlContent = generateHTMLReport(report, type);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const htmlContent = generateHTMLReport(report, type);

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${report.reportId}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.width = '210mm';

      await html2pdf().set(opt).from(container).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try downloading HTML instead.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLReport(report, type);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (type === 'casino') {
    const r = report as CasinoComplianceReport;
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="bg-black px-6 py-4 -mx-6 -mt-6 mb-4 border-b-4 border-brand-400">
              <div className="flex items-center justify-between mb-3">
                <Image
                  src="/safebet-logo-transparent.png"
                  alt="SafeBet IQ"
                  width={354}
                  height={95}
                  className="h-10 w-auto"
                />
                <div className="flex items-center space-x-2">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={handleExportPDF}
                    disabled={exportingPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {exportingPDF ? 'Generating...' : 'Export PDF'}
                  </Button>
                  <Button onClick={handleDownloadHTML} className="bg-brand-400 hover:bg-brand-500 text-black" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download HTML
                  </Button>
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl text-brand-400">Casino Compliance Report</DialogTitle>
                <DialogDescription className="text-gray-400">
                  National Gambling Act 7 of 2004 • Report ID: {r.reportId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Casino Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Casino Name:</span>
                    <div className="font-semibold text-gray-900">{r.casinoDetails.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">License Number:</span>
                    <div className="font-semibold text-gray-900">{r.casinoDetails.licenseNumber}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Address:</span>
                    <div className="font-semibold text-gray-900">{r.casinoDetails.address}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Contact Email:</span>
                    <div className="font-semibold text-gray-900">{r.casinoDetails.contactEmail}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-brand-200 bg-brand-50">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-brand-500" />
                  <h3 className="font-semibold text-gray-900">Training Compliance</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-brand-500">{r.trainingCompliance.complianceRate}%</div>
                    <div className="text-sm text-gray-600 mt-1">Compliance Rate</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{r.trainingCompliance.trainedStaff}/{r.trainingCompliance.totalStaff}</div>
                    <div className="text-sm text-gray-600 mt-1">Trained Staff</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">{r.trainingCompliance.totalCredits}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Credits</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Staff Breakdown by Role:</div>
                  {r.trainingCompliance.staffBreakdown.map((role, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <span className="font-medium text-gray-900">{role.role}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">{role.trained}/{role.count}</span>
                        <Badge className={role.rate >= 80 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                          {role.rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-2 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Regulatory Compliance Status</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">National Gambling Act (NGA)</span>
                    {r.regulatoryCompliance.ngaCompliant ? (
                      <Badge className="bg-green-100 text-green-700 border-0">✓ Compliant</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">✗ Non-Compliant</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">FICA Compliance</span>
                    {r.regulatoryCompliance.ficaCompliant ? (
                      <Badge className="bg-green-100 text-green-700 border-0">✓ Compliant</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">✗ Non-Compliant</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Audit Committee</span>
                    {r.regulatoryCompliance.auditCommittee ? (
                      <Badge className="bg-green-100 text-green-700 border-0">✓ Established</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">✗ Not Established</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Surveillance System</span>
                    {r.regulatoryCompliance.surveillanceSystem ? (
                      <Badge className="bg-green-100 text-green-700 border-0">✓ Operational</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">✗ Not Operational</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Risk Management & Interventions</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{r.riskManagement.interventions}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Interventions</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg text-center">
                    <div className="text-2xl font-bold text-brand-500">{r.riskManagement.successRate}%</div>
                    <div className="text-sm text-gray-600 mt-1">Success Rate</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{r.riskManagement.avgResponseTime}</div>
                    <div className="text-sm text-gray-600 mt-1">Avg Response Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-2 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Staff Certifications (Top 10)</h3>
                </div>
                <div className="space-y-2">
                  {r.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900">{cert.staffName}</div>
                        <div className="text-sm text-gray-600">{cert.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-purple-600">{cert.creditsEarned} credits</div>
                        <div className="text-xs text-gray-500">{cert.coursesCompleted} courses • {cert.certificationDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-100 border-2 border-gray-300">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Compliance Declaration</h3>
                <p className="text-sm text-gray-700 mb-4">
                  This report has been generated in accordance with:
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-4">
                  <li>National Gambling Act 7 of 2004</li>
                  <li>National Gambling Regulations</li>
                  <li>Financial Intelligence Centre Act (FICA)</li>
                  <li>Provincial Gambling Acts and Regulations</li>
                </ul>
                <p className="text-xs text-gray-600">
                  The information contained herein is accurate as of {new Date(r.generatedDate).toLocaleString('en-ZA')}.
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  } else {
    const r = report as RegulatorAuditReport;
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="bg-black px-6 py-4 -mx-6 -mt-6 mb-4 border-b-4 border-brand-400">
              <div className="flex items-center justify-between mb-3">
                <Image
                  src="/safebet-logo-transparent.png"
                  alt="SafeBet IQ"
                  width={354}
                  height={95}
                  className="h-10 w-auto"
                />
                <div className="flex items-center space-x-2">
                  <Button onClick={handlePrint} variant="outline" size="sm" className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={handleExportPDF}
                    disabled={exportingPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {exportingPDF ? 'Generating...' : 'Export PDF'}
                  </Button>
                  <Button onClick={handleDownloadHTML} className="bg-brand-400 hover:bg-brand-500 text-black" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download HTML
                  </Button>
                </div>
              </div>
              <div>
                <DialogTitle className="text-xl text-brand-400">National Gambling Board Audit Report</DialogTitle>
                <DialogDescription className="text-gray-400">
                  National Gambling Act 7 of 2004 • Report ID: {r.reportId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Industry Summary</h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{r.industrySummary.totalCasinos}</div>
                    <div className="text-sm text-gray-600 mt-1">Licensed Casinos</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">{r.industrySummary.totalStaff.toLocaleString()}</div>
                    <div className="text-sm text-gray-600 mt-1">Industry Staff</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-brand-500">{r.industrySummary.totalCredits.toLocaleString()}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Credits</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-3xl font-bold text-orange-600">{r.industrySummary.industryComplianceRate}%</div>
                    <div className="text-sm text-gray-600 mt-1">Compliance Rate</div>
                  </div>
                </div>
                {r.industrySummary.totalPlayers !== undefined && (
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-cyan-600">{r.industrySummary.totalPlayers.toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">Total Players Monitored</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{r.industrySummary.totalInterventions?.toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">AI Interventions</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{r.industrySummary.avgRiskScore}</div>
                      <div className="text-xs text-gray-600 mt-1">Avg Risk Score</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {r.trainingMetrics && (
              <Card className="bg-purple-50 border-2 border-purple-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Training & Development Metrics</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">{r.trainingMetrics.totalCourses}</div>
                      <div className="text-sm text-gray-600 mt-1">Available Courses</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{r.trainingMetrics.totalEnrollments.toLocaleString()}</div>
                      <div className="text-sm text-gray-600 mt-1">Total Enrollments</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-brand-500">{r.trainingMetrics.completionRate}%</div>
                      <div className="text-sm text-gray-600 mt-1">Completion Rate</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">{r.trainingMetrics.avgCreditsPerStaff}</div>
                      <div className="text-sm text-gray-600 mt-1">Avg Credits/Staff</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {r.riskMetrics && (
              <Card className="bg-red-50 border-2 border-red-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Behavioral Risk & AI Monitoring</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{r.riskMetrics.totalRiskAssessments.toLocaleString()}</div>
                      <div className="text-sm text-gray-600 mt-1">Risk Assessments</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-red-600">{r.riskMetrics.highRiskCasinos}</div>
                      <div className="text-sm text-gray-600 mt-1">High-Risk Casinos</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg">
                      <div className="text-3xl font-bold text-brand-500">{r.riskMetrics.interventionSuccessRate}%</div>
                      <div className="text-sm text-gray-600 mt-1">Intervention Success</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Casino Performance Analysis</h3>
                <div className="space-y-3">
                  {r.casinoPerformance.map((casino, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <div className="font-semibold text-gray-900">{casino.casinoName}</div>
                          <Badge variant="outline" className="text-xs">{casino.licenseNumber}</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {casino.staffCount} staff • {casino.trainedStaff} trained • {casino.totalCredits} credits
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{casino.complianceRate}%</div>
                          <div className="text-xs text-gray-500">Rate</div>
                        </div>
                        <Badge className={
                          casino.status === 'Compliant' ? 'bg-green-100 text-green-700 border-0' :
                          casino.status === 'Under Review' ? 'bg-orange-100 text-orange-700 border-0' :
                          'bg-red-100 text-red-700 border-0'
                        }>
                          {casino.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-2 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Compliance Issues Identified</h3>
                </div>
                <div className="space-y-3">
                  {r.complianceIssues.map((issue, i) => (
                    <div key={i} className="p-4 bg-white rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={
                          issue.severity === 'High' ? 'bg-red-100 text-red-700 border-0' :
                          issue.severity === 'Medium' ? 'bg-orange-100 text-orange-700 border-0' :
                          'bg-yellow-100 text-yellow-700 border-0'
                        }>
                          {issue.severity}
                        </Badge>
                        <span className="font-semibold text-gray-900">{issue.category}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                      <p className="text-xs text-gray-600">Affected Casinos: {issue.affectedCasinos}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-brand-50 border-2 border-brand-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Regulatory Recommendations</h3>
                <ul className="space-y-2">
                  {r.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-3 p-3 bg-white rounded-lg">
                      <CheckCircle className="h-5 w-5 text-brand-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gray-100 border-2 border-gray-300">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Compliance Framework</h3>
                <p className="text-sm text-gray-700 mb-4">
                  This audit report is compiled in accordance with:
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside mb-4">
                  <li>National Gambling Act 7 of 2004</li>
                  <li>National Gambling Regulations</li>
                  <li>Provincial Gambling Acts</li>
                  <li>Financial Intelligence Centre Act (FICA)</li>
                  <li>National Gambling Board Standards and Norms</li>
                </ul>
                <p className="text-xs text-gray-600 mt-4">
                  Report compiled by National Gambling Board • {new Date(r.generatedDate).toLocaleString('en-ZA')}
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}
