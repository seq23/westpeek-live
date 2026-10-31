# Placeholder Ledger — Agency Event OS

Status: ACTIVE  
Date: 2026-06-11

| Placeholder surface | Allowed? | Reason | Replacement location |
|---|---:|---|---|
| `.env.example` / `.env.local.example` placeholders | YES | Safe setup scaffolding | Cloudflare secrets, GitHub secrets, encrypted local vault |
| Demo access codes in example files | YES for local/demo only | Existing repo has demo fixtures for E2E. They are not production-secret proof. | Production Cloudflare/GitHub secrets |
| External private env vault/backup | YES | Required for Tier 3 real-provider proof but must live outside the repository | `ENV_RESTORE_POLICY.md`; local-only owner password manager path |
| `.env.local` | NO | Plaintext secret file | Local only; ignored; removed by `npm run env:remove` |
| Fake video provider success in production | NO | Would falsely prove live media | Mock lanes only; real provider lane must be separate |
| StreamYard/LiveKit real media proof from static tests | NO | Static tests do not prove provider media | `npm run smoke:streamyard-livekit:real` with deployed URL and real provider confirmation |
