# MIDAS Champion Migration Finder

A Next.js App Router sales-intelligence app for finding engineers who recently joined target companies from known MIDAS-related accounts. The app uses Lusha job-change signals, then compares each previous employer against a Supabase MIDAS Account Database.

## Main Workflow

1. Enter a target company domain, such as `wsp.com`, `arcadis.com`, or `mottmac.com`.
2. The app searches Lusha for people who recently joined that company.
3. Each `companyChange` signal is checked for the person's previous company.
4. The previous company is matched against `midas_accounts` in Supabase.
5. Matching people are scored as possible MIDAS-aware champions and shown with the reason, action, and message.

## Tabs

- `Job Changes`: primary workflow for finding recent job changes and highlighting possible MIDAS champions.
- `Decision Makers`: finds senior engineering contacts at the target company who could influence or champion engineering software decisions.
- `Admin: MIDAS Account Database`: passcode-protected internal database management.

## Decision Makers

This workflow is different from Job Changes and does not use MIDAS keywords:

- Job Changes infers likely MIDAS exposure from a person's previous company.
- Decision Makers finds current target-company contacts with senior engineering or technical leadership titles.

The ranking favours titles such as:

- Principal Engineer
- Associate / Associate Director
- Technical Director
- Director / Head of Department
- Managing Director / Partner / Owner
- Senior bridge, structural, civil, geotechnical, rail, highways, or infrastructure engineers

The app:

1. Searches relevant contacts by target company, discipline/title, location, and optional seniority.
2. Checks only up to the selected max contact limit.
3. Scores contacts by seniority and engineering role fit.
4. Sorts likely decision makers first.
5. Provides a suggested warm, non-salesy outreach message.

This can consume Lusha prospecting credits. Keep `Max contacts to check` low while testing, then increase only when the search is useful.

## MIDAS Account Database

The admin tab lets non-technical team members:

- View known MIDAS-related companies.
- Add, edit, and delete companies.
- Filter by company, country, and relationship status.
- Import CSV, XLS, or XLSX files.
- Preview imports, detect duplicates, then skip/update duplicates.
- Export the account database as CSV.

Required fields:

- `company_name`
- `country`
- `relationship_status`

Optional fields:

- `company_domain`
- `notes`

Allowed relationship statuses:

- `Client`
- `Former Client`
- `Prospect`
- `Partner`
- `Unknown`

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run [supabase/schema.sql](./supabase/schema.sql) for saved search history.
4. Run [supabase/migrations/create_midas_accounts.sql](./supabase/migrations/create_midas_accounts.sql) for the MIDAS Account Database.
5. Add environment variables locally and in Vercel.

Seed records in the migration:

- WSP | wsp.com | UK | Client
- Arcadis | arcadis.com | UK | Client
- Mott MacDonald | mottmac.com | UK | Client
- AtkinsRéalis | atkinsrealis.com | UK | Client
- Egis | egis-group.com | Hungary | Client
- Ramboll | ramboll.com | Ireland | Client
- COWI | cowi.com | Denmark | Prospect

## Environment Variables

Create `.env.local`:

```bash
LUSHA_API_KEY=
LUSHA_WEBHOOK_SECRET=
DATABASE_URL=
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSCODE=choose_an_internal_passcode
APP_BASE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is used only inside server-side API routes. Never expose it to the browser.

`ADMIN_PASSCODE` is an MVP gate for the database tab. Replace it with real authentication before wider production rollout.

The manual Lusha key field is intentionally still available for production: it stores the key only in browser `sessionStorage` and sends it only with the current server request. For shared team deployments, setting `LUSHA_API_KEY` in Vercel is cleaner.

## Matching Logic

The Job Changes workflow compares previous companies to the MIDAS database in this order:

1. Exact previous company domain match.
2. Exact normalized company name match.
3. Fuzzy normalized company name match.

Company-name normalization ignores legal suffixes and generic words such as `Ltd`, `Limited`, `GmbH`, `ZT GmbH`, `LLC`, `Inc`, `Plc`, `Group`, `Consulting Engineers`, `Consulting`, `Engineers`, `Engineering`, `The`, punctuation, case, and extra spaces.

Examples:

- `WSP UK Ltd` matches `WSP`
- `Egis Hungary Kft` matches `Egis`
- `Mott MacDonald Limited` matches `Mott MacDonald`
- `IGT Geotechnik und Tunnelbau ZT GmbH` matches `IGT Geotechnik und Tunnelbau`

Adding company domains improves matching accuracy.

## Champion Scoring

- Previous company exact domain match: +20
- Previous company exact name match: +15
- Previous company fuzzy name match: +10
- Relationship status `Client`: +10
- Relationship status `Former Client`: +7
- Relationship status `Partner`: +6
- Relationship status `Prospect`: +3
- Relevant technical title: +5
- Senior title: +5
- Job change within 90 days: +4
- Job change within 180 days: +2

Classification:

- `High`: 35+
- `Medium`: 22-34
- `Low`: 10-21
- `Unknown`: below 10

## Import Format

CSV/Excel import supports:

- `company_name`
- `company_domain`
- `country`
- `relationship_status`
- `notes`

Flexible column names are also accepted:

- Company, Company Name, Name
- Domain, Website
- Country, Location, Region
- Status, Relationship
- Notes

## Lusha Notes

The Lusha client is isolated in [lib/lusha.ts](./lib/lusha.ts). It uses server-side API routes only, keeps the API key off the browser bundle, and falls back to mock data if no key is available.

Lusha endpoint payloads are intentionally isolated because account-specific filter availability can vary. If Lusha changes prospecting or signal payloads, update `buildProspectingPayload()` in `lib/lusha.ts`.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy To Vercel

1. Push this folder to GitHub.
2. Create or update the Vercel project.
3. If the repository contains this folder inside a parent workspace, set Root Directory to `engineer-job-change-tracker`.
4. Add the environment variables above in Vercel Project Settings.
5. Redeploy.

Do not upload `node_modules`, `.next`, `.env.local`, or local logs. They are ignored by `.gitignore`.

## Compliance Notes

- Use this for B2B professional context only.
- Store the minimum data needed for account-management workflows.
- Do not log raw Lusha payloads or API keys.
- Add authenticated user management, deletion, and export workflows before broad rollout.
- Respect regional privacy restrictions and Lusha terms.

## Useful Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
```
