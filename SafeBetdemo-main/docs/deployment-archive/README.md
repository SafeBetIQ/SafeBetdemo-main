# Archived deployment artefacts

**ORR-1A / WS3 — Deployment Standardisation (2026-07-16)**

The **official deployment target for the SafeBet IQ Commercial Pilot is AWS Elastic Beanstalk.**

Evidence for EB as the canonical target: `Procfile` (`web: npm start`), `.ebextensions/*.config` (swap, CloudWatch), and `.platform/nginx/conf.d/security_headers.conf` are all EB-specific and in active use.

The following alternative deployment configs were **archived here** to remove ambiguity (a repo should declare exactly one deploy target so a platform does not auto-detect an unintended one):

- `amplify.yml` — AWS Amplify build config (not used for the pilot).
- `netlify.toml` — Netlify build config (not used for the pilot).

They are retained (not deleted) for reference only. To resurrect a target, move the file back to the repository root. The `@netlify/plugin-nextjs` dependency remains in `package.json` (harmless; can be pruned in a later cleanup).
