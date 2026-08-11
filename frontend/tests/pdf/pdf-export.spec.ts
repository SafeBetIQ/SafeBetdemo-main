import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// AUD-P1 PDF regression — validates html2pdf.js@0.14.0 (bundled jsPDF 4.2.1) still
// produces valid, non-empty, multi-page PDFs using the exact chained API the app uses:
//   html2pdf().set(opt).from(el).save()  (ReportViewer.tsx, InteractiveCardGame.tsx)
// Self-contained: renders representative NON-SENSITIVE report HTML in Chromium and
// exercises the real library from node_modules (no app auth / no production data).

const BUNDLE = path.resolve(__dirname, '../../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js');
const OUT = path.resolve(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const REPORT_HTML = `
  <div id="report" style="font-family: Arial, sans-serif; width: 800px; padding: 24px;">
    <h1>SafeBet IQ — Player Risk Report (TEST DATA)</h1>
    <h2>Executive Summary</h2>
    <p>Synthetic test content only. No production or player data.</p>
    <table border="1" cellpadding="6" style="border-collapse: collapse; width:100%">
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Operator</td><td>Test Casino</td></tr>
      <tr><td>Risk band</td><td>Elevated</td></tr>
      <tr><td>Interventions</td><td>3</td></tr>
    </table>
    ${Array.from({ length: 60 }, (_, i) => `<p>Pagination line ${i + 1} — long content to force multiple pages.</p>`).join('')}
    <h2>Audit Trail</h2>
    <p>Chain verified. End of report.</p>
  </div>`;

async function generate(page: any, opt: any): Promise<string> {
  await page.setContent(`<!doctype html><html><body>${REPORT_HTML}</body></html>`);
  await page.addScriptTag({ path: BUNDLE });
  return await page.evaluate(async (o: any) => {
    // @ts-ignore — html2pdf is attached to window by the bundle
    const html2pdf = (window as any).html2pdf;
    const el = document.getElementById('report');
    return await html2pdf().set(o).from(el).outputPdf('datauristring');
  }, opt);
}

function assertValidPdf(dataUri: string, label: string) {
  expect(dataUri.startsWith('data:application/pdf'), `${label}: expected a PDF data URI`).toBeTruthy();
  const b64 = dataUri.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  expect(buf.length, `${label}: PDF must be non-empty`).toBeGreaterThan(1000);
  expect(buf.subarray(0, 5).toString('latin1'), `${label}: PDF magic header`).toBe('%PDF-');
  const text = buf.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pages, `${label}: expected multiple pages from long content`).toBeGreaterThanOrEqual(2);
  fs.writeFileSync(path.join(OUT, `${label}.pdf`), buf);
}

test('ReportViewer export options (a4 / portrait / mm) produce a valid multi-page PDF', async ({ page }) => {
  const opt = { margin: 10, filename: 'report.pdf', image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  const uri = await generate(page, opt);
  assertValidPdf(uri, 'reportviewer-a4');
});

test('Wellbeing game export options (letter / portrait / in) produce a valid multi-page PDF', async ({ page }) => {
  const opt = { margin: 0.5, filename: 'wellbeing.pdf', image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
  const uri = await generate(page, opt);
  assertValidPdf(uri, 'wellbeing-letter');
});
