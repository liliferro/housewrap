# Quality Housewrap Operations

Initial working foundation for the Quality Housewrap MVP. Next.js App Router, React, TypeScript, Supabase Auth/Postgres and Vercel.

## Available now

- Branded responsive operations workspace, in Spanish.
- Projects: create, browse, search, update status and assign a reusable builder/contact.
- Builders and contacts directory: multiple people and works per builder, editable contact details, independently optional email and phone. Contacts cannot be assigned to a different builder by mistake.
- Manual gross-area estimates: material allowance, decimal price, internal owner approval and text summary export. Database-generated totals cannot be overridden by the browser.
- Avances: text, up to five photos and one audio attachment, microphone recording, hours/material capture and local drafts including files.
- Isolated demonstration at `/demo`, using browser-only example data. Real data at `/app` requires authentication and database membership.

This is the first implementation, not the entire reviewed specification. AI takeoff, PDF quotes, automatic offline synchronization, time approval, message delivery, builder acceptance and QuickBooks are not yet implemented. Field report hours/material are unreviewed observations, not payroll or reconciled consumption. Roll calculations do not yet include product-specific overlap/flashing rules.

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

## Address suggestions

Work creation (including inside estimates) searches US numbered street addresses through Photon/OpenStreetMap after 900 ms of inactivity. Choosing a result stores its normalized address, OSM reference and coordinates; editing the text invalidates the selection. This is a map match, not postal/deliverability verification. New construction can be explicitly marked pending with a required review note; older works remain unverified. The dashboard links selected locations to OpenStreetMap.

The public Photon service permits moderate project use but has no availability SLA: https://github.com/komoot/photon#demo-server. Requests use bounded results, a five-minute upstream cache, timeout and best-effort per-instance burst limits (not a global serverless quota). For larger traffic, configure PHOTON_BASE_URL to a dedicated Photon instance. Do not replace it with the public Nominatim endpoint: that service does not permit autocomplete. Only the address query is sent to Photon; contact details are not sent. UI attribution links to Photon and OpenStreetMap copyright.

Checks: address parser tests, mocked desktop/mobile selection and outage flows, and a real-provider search for 225 Baker Street Atlanta. API errors do not mark an address as selected.

## Work details

The shared creation form and dashboard now support project type (single-family, multi-family, commercial, other), work type (new construction, remodel, repair, other), priority, lot/unit, planned start, general site notes and access instructions. Additional fields are optional; legacy classifications remain unknown. Notes are shared with the team members who can already access the project under RLS. Office/owner users can edit the details from the dashboard. Planned start must not be after the target date; actual start remains a separate field.

## Progress media

The UI calls field reports Avances; the existing field_reports table and identifiers remain compatible. Notes are optional when media is supplied. Up to five JPEG/PNG/WebP images and one audio file, 10 MB each and 30 MB combined. Browser microphone recording stops at two minutes, releases the microphone on stop/unmount, and provides file upload when recording is unavailable. Voice is stored as playable audio, not automatically transcribed. Uploaded audio files are subject to the size cap, not the recording duration cap.

Production media uses the private progress-media bucket, owner/project/report/random-file paths, MIME/size restrictions and RLS. Office/owner may read project media; workers retain the existing own-advance access restriction and must have project access. Uploading into an already submitted advance and overwriting objects are denied. The insert trigger checks metadata against actual uploaded objects. Failed sends retain the composer; ambiguous results are checked before retry and committed files are never removed. Orphaned uploads after network failures may require administrator cleanup; there is no background cleanup job yet.

Draft files and demonstration files are stored in IndexedDB on this device, with metadata in the existing local draft/demo state. Production media downloads use an authenticated request and temporary browser Blob URLs; no public or long-lived signed links are stored. Demo reset removes referenced demo media. Reopening a photo or audio rechecks access through Storage. No automatic external messaging is performed.

Validation includes desktop/mobile file-only sends, draft reload, microphone recording using Chromium synthetic audio, upload limits and a real Supabase test with an assigned worker (photo upload/download and anonymous denial), with fixture cleanup.
