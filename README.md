# NorCal Veterans deployment

Production: https://www.norcalveterans.org/yolo-solano

The September 9 replacement uses the imported public design with the existing NorCal database and private `/hq` application. `wrangler.jsonc` is the production configuration; `src/norcal-worker.mjs` is the entry point. Do not deploy the imported `wrangler.hq.jsonc` or apply its migrations to NorCal. Those describe the separate source system. See [deployment and recovery](docs/norcal-deployment.md).

Build: `npm run build`. Tests: `npm test` with Node 24 or newer. Cloudflare builds `main` with `npm run build`, then `npx wrangler deploy`.

The following imported notes describe the source version and may refer to features or accounts that are not deployed in NorCal.

---

# Yolo Solano Veterans

The project now uses the supplied circular Yolo-Solano Veterans seal in the public website, headquarters and organization editor, as well as the favicon and homepage sharing image. The original PNG is unchanged, displayed at its square aspect ratio, and included in both Worker asset packages. Its public source note is in public/ysv-logo-source.json. The private uploaded original remains attached to the originating HQ request.

Sterling’s confirmed product name is now used across the website, headquarters, browser titles, public data, calendar name and social share artwork. Existing Workers addresses, sign-in links and organization IDs are preserved. Official organization names, including Yolo County Veterans Services Office, retain their proper names.

# Directory visibility correction

The Yolo County Marine Corps League listing retains its original ID and now includes Detachment 627, as supplied in Sterling’s authenticated request. Group navigation returns to the unfiltered directory before jumping to a category, so an earlier search or county filter does not leave the selected category hidden.

# Veterans Equine Therapy profile correction

VETs remains in the nonprofit/program group with its original stable record ID, preserving its representative assignment and existing links. Its official website now supplies the organization description, general contact information and identifying emblem. Current visit location, intake and schedules remain unconfirmed. The original website artwork is retained; the logo card frames only its emblem area. It does not turn the artwork’s undated promotional dates into upcoming events.

# Public privacy rule

Sterling's September 2 request prohibits republishing online member/officer rosters and personal contact details. Imported officer-name lists, roster/directory source links and individually attributed or ambiguous phone numbers have been removed from the public research records. Public pages retain general organization channels and clearly public offices or meeting venues. An authenticated administrator or active organization representative may separately publish one voluntary officer profile at a time after confirming the person's permission; those profiles contain only a public name, current title, short bio and optional approved organization photo, and are never seeded from online rosters. Profile publication rejects recognizable roster URLs and personal-contact labels; bulk public data continues to drop officer/member/private record fields. These checks complement source review and do not claim to detect every kind of personal information automatically.

# Organization representative access

Aaron and Sterling can designate a representative by email and organization in **HQ → Organization access**. Each designation creates a pending assignment and an authenticated request for Chat to activate that exact address in the existing narrow Cloudflare Access allowlist. No invitation email is sent automatically. No representative is activated until their designation and sign-in setup are verified.

Representatives sign in at `/organization`. Their private editor permits publishing only their assigned organizations' meeting schedule, public description and contact fields, with a supporting public source and confirmation. Requests, files, administration, private notes and backups remain available only to Aaron and Sterling. Each publication records the verified email; prior profile versions are retained. Revocation immediately blocks organization editing, including an already-open session or form.

Apply migrations 0001–0006 before the HQ release. Schema-6 backups include private representative assignments, organization-photo metadata and individually consented officer profiles; historical schema-2 through schema-5 snapshots remain supported. The current Access audience, exact-email allowlist and all Worker bindings are preserved. See `REQUEST_PROCESSOR.md` for the tracked activation procedure.

# Silver, blue and red design release

Implemented Sterling's requested modern silver, blue and red website theme. Wild Horse Farms is removed from active records, source exports, logo mappings and bundled public images. The remaining equine profile now displays Veterans Equine Therapy (VETs), with a plain text identifier in place of the stable's logo. Its existing profile URL is retained, and background/contact sources are distinguished from the confirmed display name.

The theme covers the public directory, events, profiles and shared headquarters styling. The favicon and social share card match the palette. Current directory: 25 records and 40 sources; the 12 dated event listings and 11-entry Memorial Day guide remain intact.

# Memorial Day guide and Buddy Poppy calendar release

Implemented Sterling's event request with a source-linked city-by-city Memorial Day guide at /memorial-day. Eleven entries distinguish dated 2026/2025 ceremonies from programs awaiting details. The 2027 holiday is May 31; no local 2027 schedule is inferred from historical times. The upcoming feed excludes historical guide entries.

Six Buddy Poppy date reminders cover November 7, 8 and 11, 2026 at Safeway Dixon and Grocery Outlet Davis. Dates and locations use Sterling's authenticated project update; hours are explicitly to be confirmed. Date-only presentation, calendar export and HQ editing preserve this distinction and source attribution. Current data: 26 organizations, 12 upcoming listings and 11 guide entries.

Validation: 28 focused tests pass, including date-only calendar boundaries, source attribution, HQ editing, authenticated request handling and public/private separation.

# Logo gallery release

Implemented Sterling's HQ request for a homepage of organization logos. Post name and city appear on hover or keyboard focus; touch layouts show captions without hover. The search is available in a disclosure panel. Veteran organizations, nonprofit/community programs and county service offices are grouped separately. Eight unaltered official identifying images are bundled locally, with provenance in public/logos/SOURCES.json.

The directory now has 26 records and 42 sources. RememberAVet has a profile with its Winters mailing address and Dixon program activity. Little Reata's veteran equine program is explicitly described as in development in a 2025 source; current launch and intake are not asserted. Wild Horse Farms remains a separate provider. No external signup, mailing, payment or organization endorsement is implied.

Validation: all 26 profile links and logo endpoints checked, combined filters and private/public boundaries pass, and desktop logo/focus presentation inspected in Chrome. Touch captions use the no-hover and narrow-screen layouts. Styles and logo URLs have a release version to avoid stale browser images.

# Current release: Requests and smart processing

Requests is the default HQ page. Aaron and Sterling submit as their verified identity, choose website/HQ/let Chat decide, follow progress, approve a concrete suggestion with one click or send an alternate reply. All messages, outcomes and changes are retained. Public submissions remain separate. The page checks for progress without interrupting a message being written.

The heartbeat `yolo-hq-request-processor` starts at five-minute intervals and changes to thirty minutes after an hour without requester activity once runnable work is clear. A first quiet-mode request may wait thirty minutes. The computer must stay awake with Codex running. See REQUEST_PROCESSOR.md for the execution and ownership protocol. Scheduler execution and any future cost remain subject to the actual app/account state.

Setup tasks are reconciled into completed/closed history; only continuing factual research stays active and belongs to Chat. Ready-to-use community copy and working defaults are available in the private HQ library. Backup schema 2 includes requests, conversations and processor state; the restore checker uses an isolated database.

Validation: 30 focused tests cover both editor identities, private/public separation, suggestions/replies, duplicate submissions, stale edits, processor leases and recovery. Production verification used the real signed-in request form and the same claim/finish batches used by the heartbeat. The first future scheduled run has not been claimed as already tested.

Current public data: 24 organizations, 39 sources, six sourced dated events. DAV Chapter 84 commander contact and hall-rental contact are distinguished.

## Earlier release and access history

## Private request files

Each HQ request has an **Upload file to Chat** form for logos, images and documents, with an optional explanation. Send a new request first, then attach a file on its request card. Files are limited to 10 MB each and 250 MB in total. Uploads record the verified editor, stay attached to the request history, and requeue the request so Chat reads the new material.

Apply all three migrations before deploying. Only the HQ Worker binds `ATTACHMENTS` to the private `yolo-veterans-hq-attachments` R2 bucket. No public bucket domain is enabled. Download routes require the existing HQ sign-in. Schema-3 exports include file metadata; file objects need separate private backups, as described in `REQUEST_PROCESSOR.md`.

## Current shared access

Shared access activated September 2, 2026. Aaron signs in as smartzgraphics@yahoo.com; Sterling Koliba is allowlisted as sterling.koliba@gmail.com, the address used in today's veterans correspondence in Yahoo. Both may use email one-time codes; Aaron can also use the existing Cloudflare login. No shared password or Cloudflare account membership is needed for Sterling. His first email-code delivery/login has not been tested on his behalf. Sessions last 12 hours.

The HQ header displays the authenticated email. New private requests and all saved changes record that verified identity in the audit log. Public intake contact names/emails remain explicitly unverified. Both editors can maintain tasks, events, profiles, coordination and review requests, and access the shared workspace backup. Event drafts require a separate reviewed publication action. Public profile publication updates the connected website.

Verified: 19 tests pass; live owner dashboard displays the authenticated identity; unsigned/spoofed requests to HQ and backup redirect to sign-in; public health returns 200. Current HQ deployment: fdb0cfe48daa4d66ba0c7500e47b8ca4.

## Previous deployment notes (historical)

Owner access activated September 2, 2026 after Aaron explicitly approved the displayed Terms of Service, Privacy Policy and overage-billing authorization. The headquarters alone is protected by Cloudflare Access, allowing smartzgraphics@yahoo.com via the existing Cloudflare account login. Production owner sign-in was verified in Chrome. The app audience and owner bindings are configured. Requests without a valid login, including spoofed email headers, are redirected to authentication; the public site remains open. The earlier activation-blocked descriptions below are historical.

# Yolo County Veterans

Public directory and event calendar for Yolo and Solano counties, with a separate private headquarters.

- Public: https://yolo-county-veterans.smartzgraphics.workers.dev
- HQ: https://yolo-county-veterans-hq.smartzgraphics.workers.dev

## Release 0.2

24 researched organizations, 38 source records, six dated event listings, location/type/keyword filters, public profiles, event details and calendar downloads. The submission desk accepts corrections, event proposals, additions and stewardship requests into a private review queue. Submission does not grant account access or publish content.

HQ provides 14 initial tasks from the September 2 meeting, review status, event drafts and explicit publication, public profile corrections, private coordination notes, audit entries, immutable event/profile revisions, and an authenticated JSON backup download. It is deployed locked: Cloudflare Zero Trust activation requires new terms and overage-billing authorization, which have not been accepted. OWNER_EMAIL and ACCESS_AUD are intentionally absent until setup is approved. Organization representative accounts, direct email ingestion, flyer uploads, automatic social posting, and payment collection are not implemented.

## Data and privacy

`src/data.mjs` and `src/research-additions.mjs` hold researched public records and source metadata. D1 stores public event publication state, reviewed profile overrides, and separate private request/task/coordination tables. `/data.json` selects only public records and published events. Unknown fields remain null with gaps visible; public-source review is not direct organization confirmation. Officer terms remain unconfirmed. Historical or in-development program leads are held outside active service listings.

Do not add veteran case details, discharge records, private membership rosters or medical information. Public intake requires consent, bounded inputs, HTTPS source URLs, a same-origin form request, honeypot and capped hourly/day submissions. Short-lived hashed network buckets expire after 24 hours and are removed on subsequent submissions. Review contacts are private. No email confirmations are sent.

## Build and test

Node 24+, no package dependencies:

```
node scripts/build.mjs
node --test scripts/*.test.mjs
node scripts/dev.mjs
```

The build outputs separate `dist/worker.mjs` and `dist/hq-worker.mjs`. Assets are embedded; these are direct module Workers, not Cloudflare Static Assets routed Workers. This distinction matters because the current Access API does not pass `ctx.access` through the Static Assets router. HQ requires platform identity, an exact Access audience and the exact configured owner email; it ignores client-supplied identity headers. Missing configuration fails closed. Public CSS/favicon may load while locked; private pages, exports and actions cannot.

Use `wrangler.jsonc` for public and `wrangler.hq.jsonc` for HQ. Both bind the dedicated `yolo-county-veterans-hq` D1 database. Apply `migrations/0001_hq.sql` before deployment. Cloudflare's connected API was used for deployment; GitHub automatic deployment is not configured. Never commit credentials. The original Sites starter failed on a Windows runtime dependency; the authorized GitHub/Cloudflare implementation continues the existing dependency-free Worker architecture.

## Activate owner access after approval

Complete Zero Trust activation only after the owner accepts its terms and billing authorization. Protect the HQ Worker alone (all its production and preview URLs) with a self-hosted Access app and an exact owner-email allow policy. Configure the application audience as `ACCESS_AUD` and verified owner address as `OWNER_EMAIL`. Use supported identity-provider sign-in, enable HttpOnly/binding cookies, and validate production owner sign-in and denial for everyone else. Do not apply account-wide protection to unrelated Workers. Keep organization self-service disabled until independent authority verification and record-level roles are implemented.

## Recovery and maintenance

Code is versioned in GitHub. D1 is separate from Git and requires its own recovery plan. HQ's authenticated JSON export includes private records, audit entries and preserved event/profile revisions; store downloaded copies securely. There is no scheduled independent backup and no automated restore UI. Cloudflare Time Travel retention depends on plan (currently 7 days Free / 30 days Paid); verify the account plan and practice a restore before relying on it. At Free-plan limits D1 queries can fail; do not promise unlimited capacity or guaranteed permanent free operation.

Current technical references: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/d1/platform/limits/
