# MIDAS Champion Migration Finder

A Next.js App Router sales-intelligence app for finding engineers who recently joined target companies from known MIDAS-related accounts. The app uses Lusha job-change signals, then compares each previous employer against a Supabase MIDAS Account Database.

## Main Workflow

1. Enter one or more target company domains, such as `wsp.com`, `arcadis.com`, or `mottmac.com`.
2. The app searches Lusha for people who recently joined any of those companies.
3. Each `companyChange` signal is checked for the person's previous company.
4. The previous company is matched against `midas_accounts` in Supabase.
5. Matching people are scored as possible MIDAS-aware champions and shown with the reason, action, and message.

## Tabs

- `Job Changes`: primary workflow for finding recent job changes and highlighting possible MIDAS champions.
- `Decision Makers`: searches up to 20 target company domains together and finds senior engineering contacts who could influence or champion engineering software decisions.
- `Admin: MIDAS Account Database`: passcode-protected internal database management.

## Bulk email and phone reveal

The `Decision Makers` results table has separate `Get emails` and `Get phones` buttons above the table. Tick the contacts you want, then click one button: emails and phone numbers are pulled independently, so asking for emails never spends credits on phone numbers.

- Both buttons post to `POST /api/reveal-contacts-bulk`, which accepts up to 100 contact IDs per request and enriches them with batched Lusha `contacts/enrich` calls. One API call covers 25 contacts, rather than one call per contact.
- Anything already stored in `revealed_contact_details` is reused and costs no credits. The status line reports how many were revealed, reused, empty, or failed.
- Failed contacts stay selected so a retry does not re-bill the ones that already succeeded. If Lusha itself is unavailable, contacts served from storage are still returned.
- The per-row `Email` and `Phone` buttons still reveal a single contact at a time.

## Decision Makers

This workflow is different from Job Changes and does not use MIDAS keywords:

- Job Changes infers likely MIDAS exposure from a person's previous company.
- Decision Makers finds current contacts across up to 20 target companies with senior engineering or technical leadership titles.

The ranking favours titles such as:

- Principal Engineer
- Associate / Associate Director
- Technical Director
- Director / Head of Department
- Managing Director / Partner / Owner
- Senior bridge, structural, civil, geotechnical, rail, highways, or infrastructure engineers

### Keyword search

When you enter anything in `Job title keywords`, the search becomes **keyword-first**: the keyword decides *who is returned*, and seniority only decides *how those matches are ranked*. This is the difference between asking for a Temporary Works Designer at a contractor and getting one, versus getting a random list of that company's directors.

The keyword list itself is always **OR**: a contact is kept if their title matches any one keyword. Up to 120 keywords can be entered, one per line or comma separated. What differs between modes is how loosely a single keyword is allowed to match.

Four matching modes:

| Mode | Sent to Lusha | Returned |
| --- | --- | --- |
| `Keyword + close variants` (default) | Your keyword plus title variants of the same role | Titles matching your keyword or its role stem |
| `Any keyword word` | The distinctive words of your list, as bare terms and as titles | Titles containing any distinctive word of any keyword |
| `Exact keyword only` | Your keyword only | Only titles containing the keyword verbatim |
| `Keyword + seniority titles` | Keyword merged into the generic senior-title list | Everything (old behaviour) |

In the default mode, a search for `Temporary Works Designer` also queries Temporary Works Engineer / Coordinator / Design Manager / Supervisor / Senior + Principal variants, then keeps any title containing the `temporary works` stem. `Technical Director` and `Design Manager` are not returned; `Permanent Works Designer` is not returned.

`Any keyword word` is for pasting a whole discipline's worth of titles. A 60-line geotechnical list collapses to the words that actually identify the role — geotechnical, ground, improvement, piling, foundation, earthworks, embankment, geomechanics — and any title containing one of them is kept, so `Principal Engineer (Geotechnics)` and `Numerical Modeller` survive where the default mode drops them. Generic words (engineer, manager, director, design, senior, head, technical) are stripped out first, so they cannot match the whole company; a keyword made only of generic words, such as `Technical Director`, still has to match as a phrase. This mode is deliberately the broadest — expect adjacent roles alongside the ones you wanted.

Only the first 80 keywords are sent to Lusha's title filter; anything beyond that is still matched locally against the company-wide recall scan, and the search warns when it happens. `Any keyword word` collapses the list before the cap, so it never truncates.

Keyword behaviour differs from the generic search in four ways that matter:

- The `Engineering & Technical` department filter is **not** applied, because at contractors these roles are often filed under Construction or Operations.
- The noisy "broad fallback" is **not** used. Instead, if Lusha's title index returns nothing, the app lists the company and matches your keyword against job titles locally.
- The contact limit caps how many contacts are **enriched**, not how many are considered — candidates are ranked before the limit is applied, so a match can't be truncated away.
- Keyword matches are never hidden by the results table's `Show only medium/high fit` filter, and are never removed by the irrelevant-title blocklist.

The app:

1. Searches relevant contacts by target company, keyword or discipline/title, location, and optional seniority.
2. Enriches only up to the selected max contact limit.
3. Scores contacts by keyword match first, then seniority and engineering role fit.
4. Sorts likely decision makers first.
5. Provides a suggested warm, non-salesy outreach message.
6. Lets users select multiple contacts and reveal email addresses and phone numbers in one confirmed batch.

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

For multi-company searches, enter up to 20 domains separated by commas or new lines. Domains are normalized, de-duplicated, and sent to Lusha in one company-domain filter.

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

## Decision Maker Scoring

Keyword relevance outweighs generic seniority, so the person you searched for outranks an unrelated director at the same company:

- Exact keyword match in job title: +60
- All keyword terms present: +40
- Role stem match, e.g. `Temporary Works Coordinator` for `Temporary Works Designer`: +30
- Single distinctive word match, `Any keyword word` mode only: +20
- Chief / founder / owner / partner / managing director: +28
- Technical director / director / head: +24
- Associate / associate director: +20
- Principal / lead / team leader / manager: +18
- Senior: +10
- Bridge / structural / geotechnical / rail / highways / infrastructure / civil: +10
- Engineer / engineering / technical: +6

Junior and non-technical titles are penalised by 20, **except** when they match your keyword — an `Assistant Temporary Works Coordinator` is a hit, not noise.

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
