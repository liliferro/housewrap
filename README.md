# Quality Housewrap Operations

Initial working foundation for the Quality Housewrap MVP. Next.js App Router, React, TypeScript, Supabase Auth/Postgres and Vercel.

## Available now

- Branded responsive operations workspace, in Spanish.
- Projects: create, browse, search, update status and assign a reusable builder/contact.
- Builders and contacts directory: multiple people and works per builder, editable contact details, independently optional email and phone. Contacts cannot be assigned to a different builder by mistake.
- Manual gross-area estimates: material allowance, decimal price, internal owner approval and text summary export. Database-generated totals cannot be overridden by the browser.
- Text field reports: explicit confirmation, hours/material capture and local draft recovery.
- Isolated demonstration at `/demo`, using browser-only example data. Real data at `/app` requires authentication and database membership.

This is the first implementation, not the entire reviewed specification. AI takeoff, PDF quotes, audio/photos, automatic offline synchronization, time approval, message delivery, builder acceptance and QuickBooks are not yet implemented. Field report hours/material are unreviewed observations, not payroll or reconciled consumption. Roll calculations do not yet include product-specific overlap/flashing rules.

## Development

Node 22 or newer. `npm ci`, copy `.env.example` to `.env.local`, then `npm run dev`.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the dedicated Housewrap project. Never use a service-role key in the browser. With no environment configured, `/app` redirects to login; `/demo` remains available.

Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`. Install Chromium for Playwright before the first E2E run.

## Database setup

Apply checked-in migrations in chronological order to the dedicated Supabase project. `supabase/schema.sql` contains the cumulative schema for a fresh database. All exposed tables enable RLS. Memberships are provisioned by an administrator; there is no public role assignment or self-enrollment. Authorizations never use editable user metadata.

Create an Auth user through Supabase's administrative interface, then insert its user ID into `public.memberships` with role `owner`. Provision office/worker/crew_lead similarly and assign workers using `public.assignments`. Account recovery is currently handled by the administrator. Do not make arbitrary signups owners.

Validate with `supabase/tests/access.sql` in a disposable project or within its rollback transaction. Check Supabase security advisors after applying the migration. No data is seeded into a production database. Demonstration data is local only.

## Branding

Based on the supplied Quality Housewrap brand book v1.0. Archivo headings, Inter body; Envelope Navy, Deep Sheathing, Wrap White, Seal Green and Seal Green Dark. The mark in `public/brand-mark.png` is extracted from the supplied PDF, not a newly invented logo. Replace it with the client's master SVG when available. Marketing certifications and turnaround guarantees are not published without verification.

## Deployment

Connect GitHub `liliferro/housewrap` to the Vercel project `housewrap`, framework Next.js. Set both Supabase public variables for the intended environments. Production data is only accessible with an authenticated, provisioned membership. No automated marketing sends or accounting writes exist.

## Next implementation work

1. PDF uploads in private storage, page-scale calibration, facade editor and product recipes.
2. Immutable estimate snapshots and approval audit, PDF generation and builder acceptance.
3. Reviewed field events, assignments UI, fichajes, offline queue, audio and reconciliation.
4. Outbox/jobs, messaging approval, dashboards based on reconciled data and simulated accounting.

The reviewed 0.3 specification remains the product plan; no automated measurement accuracy or delivery completion is claimed by this foundation.

Existing works retain their original builder text for backward compatibility; the UI reads the linked builder name. Existing works without a known contact show a pending assignment; new works require a named contact. Demo data is upgraded in place without deleting saved works.

## Per-project dashboard

Open any work to view its dashboard; its #obra= link can be reopened or shared with authorized teammates. Office/owner users select one approved estimate as the quoted reference (versions are never summed), record manual progress and actual start/end timestamps, and see all visible worker reports with roll/hour totals. Worker views retain existing RLS restrictions and do not expose estimate amounts. Calendar elapsed hours and reported labor hours are separate; reports remain pending review. New reports capture a declared worker name while auth.user remains the authoritative author identity. No historical start dates or progress are fabricated for existing works.

Validation: tests/project-dashboard.test.ts, the desktop/mobile workspace flow, and supabase/tests/project-dashboard.sql (transaction rolled back).
