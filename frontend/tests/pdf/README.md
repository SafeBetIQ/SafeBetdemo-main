# PDF export regression (AUD-P1 — html2pdf.js@0.14.0)

Validates that `html2pdf.js@0.14.0` (bundled jsPDF 4.2.1, which fixes the XSS/LFI
criticals) still produces valid, non-empty, multi-page PDFs using the exact chained
API the app uses (`html2pdf().set(opt).from(el).save()` in `ReportViewer.tsx` and
`wellbeing-games/InteractiveCardGame.tsx`).

Self-contained (no app auth / no production data). Run with an isolated Playwright:

    npm i -D @playwright/test && npx playwright install chromium
    npx playwright test tests/pdf/pdf-export.spec.ts

Assertions: `%PDF` header, non-empty (>1 KB), >= 2 pages, for both the a4/mm and
letter/in option sets. Generated PDFs are written to `tests/pdf/artifacts/` (git-ignored).
