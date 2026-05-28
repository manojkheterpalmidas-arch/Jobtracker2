# Engineer Job Change Tracker

A production-ready Next.js App Router app for sales and account managers who want to detect when structural, bridge, and civil structures engineers move from existing client companies into new organizations.

The app is domain-first: `wsp.com`, `arcadis.com`, `mottmac.com`, `ramboll.com`, and `cowi.com` are accepted without `https://` or `www.`. Company name is optional and used only as fallback or display context.

## What It Does

- Searches for relevant engineering contacts using Lusha server-side API calls.
- Prioritizes company domain matching over company name matching.
- Defaults to people who joined the company, with an optional either-direction mode for cautious exploration.
- Checks `companyChange` signals inside a selected past duration.
- Excludes irrelevant titles such as recruiter, HR, finance, marketing, MEP, QS, and architect.
- Scores and classifies job changes by engineering relevance, seniority, and signal recency.
- Generates a short, non-pushy reconnect message.
- Exports results to CSV.
- Includes `/api/lusha-webhook` for future Lusha `companyChange` webhook events.
- Falls back to realistic mock data when `LUSHA_API_KEY` is missing.

## Lusha API Notes

The Lusha client is isolated in `lib/lusha.ts`.

Current official V3 docs identify:

- Base URL: `https://api.lusha.com`
- Prospecting contacts: `POST /v3/contacts/prospecting`
- Contact signals: `POST /v3/contacts/signals`
- Contact signal type: `companyChange`
- API authentication header: `api_key`
- Webhook signature headers: `X-Lusha-Signature` and `X-Lusha-Timestamp`
- Webhook acknowledgement body: `{ "received": true, "timestamp": "...", "webhookId": "..." }`

Lusha filter fields can vary by plan and rollout. If your account expects slightly different prospecting filter names, update `buildProspectingPayload()` in `lib/lusha.ts`; the rest of the app should not need to change.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env.local`:

```bash
LUSHA_API_KEY=your_lusha_api_key
LUSHA_WEBHOOK_SECRET=optional_webhook_secret
DATABASE_URL=
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
APP_BASE_URL=http://localhost:3000
```

`LUSHA_API_KEY` must only be used server-side if configured as an environment variable. The manual API key field sends the key only with the current request. Do not log request bodies in production.

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Never expose it through `NEXT_PUBLIC_*`.

## Supabase Storage

The app can save every completed search run to Supabase, including:

- sanitized search request, excluding the manual Lusha API key
- search summary
- warnings
- normalized job-change results

Setup:

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [supabase/schema.sql](./supabase/schema.sql).
4. In Vercel Project Settings, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Redeploy.

If Supabase is not configured, local/dev searches are kept only in ephemeral server memory. That memory is not persistent on Vercel.

## Mock Mode

If `LUSHA_API_KEY` is missing, `/api/search-job-changes` returns mock data and the UI displays `Mock data`.

The search form includes a manual `Lusha API key` field. It is stored only in the user's browser `sessionStorage` for convenience and sent to the server for the current search request. The app does not write the key to disk or return it in responses. For shared/team production use, prefer setting `LUSHA_API_KEY` in Vercel Environment Variables instead.

The `Movement` dropdown defaults to `People who joined this company`. This is the safer live-search path because Lusha can directly match the selected domain against the contact's current company before signal checks. The UI intentionally does not expose a left-company-only mode because that workflow can consume credits before post-filtering removes non-matching rows.

Use the `Credit guard` dropdown before live testing. Lusha may charge for signal checks even when no final rows match the app's post-filter, especially in `People who left this company` mode. Start with `Check max 10` or `Check max 25`, then increase only after you confirm the search direction and filters are returning useful signals.

The custom title box is optional. By default, the app uses the selected discipline's built-in title list plus anything typed into the custom box. Structural/bridge defaults include engineer, principal, associate, director, head, technical manager, design manager, engineering manager, lead, rail and civils, major bridges, and team leader variants. Leave the custom box blank for the normal broad discipline search. To search only a very specific title such as `Technical Manager`, switch title mode to `Use only custom keywords`. If Lusha misses someone whose title should match, use `No title filter` with a low credit guard so the company/signal search can find contacts whose title is stored differently.

Suggested mock request:

- Company domain: `wsp.com`
- Company name: `WSP`
- Location: `United Kingdom`
- Past duration: `90 days`
- Discipline: `Structural / Bridge / Civil Structures`

Mock results include:

- Senior Bridge Engineer moved from WSP to a smaller consultancy.
- Principal Structural Engineer moved from Arcadis.
- Technical Director Bridges moved from Mott MacDonald.
- One irrelevant HR/recruitment-style result that is filtered out.

## Deploy To Vercel

1. Push this app to a Git repository.
2. Create a new Vercel project.
3. Set the root directory to `engineer-job-change-tracker` if deploying from this workspace.
4. Add environment variables in Vercel Project Settings:
   - `LUSHA_API_KEY`, optional if using manual input only
   - `LUSHA_WEBHOOK_SECRET`, if using webhooks
   - `SUPABASE_URL`, if saving searches
   - `SUPABASE_SERVICE_ROLE_KEY`, if saving searches
   - `APP_BASE_URL`
   - `DATABASE_URL`, later if adding persistence
5. Deploy.

## Webhook Endpoint

Webhook URL:

```text
https://your-app.vercel.app/api/lusha-webhook
```

The route supports:

- `GET ?challenge=...` verification.
- `POST` event delivery.
- HMAC-SHA256 verification when `LUSHA_WEBHOOK_SECRET` is set.
- Fast `201` acknowledgement with `received`, `timestamp`, and `webhookId`.

Webhook storage is currently in-memory and intentionally minimal. For production history, replace `lib/storage.ts` with Supabase or PostgreSQL and store only the fields needed for B2B professional follow-up, audit, deletion, and export workflows.

## Why Domain Is Preferred

Company names can be ambiguous: abbreviations, legal suffixes, merged entities, and regional subsidiaries often produce noisy matches. Domains are more stable identifiers for B2B company matching and reduce false positives when tracking client-company alumni.

## Compliance Notes

- Use this for B2B professional context only.
- Store the minimum data needed for account management workflows.
- Do not log raw Lusha payloads in production.
- Add deletion/export flows before long-term persistence.
- Respect regional privacy restrictions and Lusha terms.

## Useful Scripts

```bash
npm run dev
npm run build
npm run typecheck
```
