# NorCal website and project HQ deployment

## Active architecture
GitHub `KolibaSA/norcal-veterans`, branch `main`, deploys `wrangler.jsonc` and `src/norcal-worker.mjs` to the existing `norcal-veterans` Cloudflare Worker. The embedded HQ uses feature modules under `src/modules`, composed through `src/app` and the compatible `worker/legacy` entry points, with the dedicated NorCal D1 database. Start feature work with [the module map](../MODULES.md). Website and HQ remain one project; there is no shared Headquarters service binding.

Public site: https://www.norcalveterans.org/yolo-solano
Private HQ: https://www.norcalveterans.org/hq
Region selector: https://www.norcalveterans.org/regions

Both root domains temporarily redirect to Yolo-Solano. The Clerk release uses invitation-only email-code login without MFA by explicit owner choice. The Worker independently validates signed identity and assignments; alternate URLs fail closed without identity. Keep the old Access gate until the Clerk Worker is deployed; see the migration runbook for release state.

The canonical public host is `www.norcalveterans.org`. Public bare-domain paths redirect to it; the root redirect to `/yolo-solano` remains temporary. `/robots.txt` and `/sitemap.xml` are served by the Worker. The sitemap contains only public canonical routes and published organization/event detail pages; it excludes private HQ, drafts and event types without a public detail page. Check both endpoints, redirect targets and a sample of sitemap URLs in staging before the connected GitHub release.

## Build and test gate
Use Node 24 and the existing locked dependencies. `.node-version` pins the build to that major version using [Cloudflare's supported version override](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#overriding-default-versions):

```sh
npm run build
npm run test:active
```

The connected Cloudflare production build runs `npm run build`, then `npx wrangler deploy`. Build generates artifacts, enforces feature dependency boundaries, and executes the entire test suite; a failure stops publication. Module-owned HTML/CSS partials and the bundled browser entry generate `hq-template.mjs`; the CSP hash uses the exact embedded script bytes. Do not edit generated files. `npm run test:module -- MODULE_NAME` runs focused tests; the full gate discovers tests in modules, shared code and application composition as well as scripts.

`test:active` runs the NorCal Worker, embedded HQ, queue, content and recovery tests. The full suite additionally preserves imported application regressions. Imported deployment configuration is archived as `fixtures/imported/wrangler.hq.jsonc.txt`; its source modules and flat `dist` outputs are regression fixtures, not production entry points.

## Isolated staging

September 24 Clerk migration: staging uses a dedicated Clerk development instance and synthetic account. Follow [the Clerk runbook](clerk-migration.md) for current verification, the owner's no-MFA decision, additive migration and coordinated rollback. Do not deploy staging keys or its synthetic data to production.
Use `wrangler.staging.jsonc`, Worker `norcal-veterans-staging`, and its separate D1 database. It has no production domain routes. Its public responses carry noindex/noarchive and the staging header. Use synthetic records, not private production copies.

```sh
npx wrangler d1 migrations apply norcal-veterans-staging --remote --config wrangler.staging.jsonc
npx wrangler deploy --config wrangler.staging.jsonc
```

Ordinary `wrangler versions upload` previews retain the configured production database. Do not use them for disposable write testing.

For authenticated browser acceptance with synthetic records, run `node scripts/norcal-browser-fixture.mjs` and open `http://127.0.0.1:8790/hq`. This loopback-only fixture uses generated test JWTs, all active migrations and in-memory data; outbound calls are blocked. It is never deployed. The real production domain remains filtered on this corporate workstation, so distinguish local signed-in browser checks and remote staging verification from a signed-in production browser test.

## Additive database upgrade
Only use `migrations/legacy`. The September 12 hardening adds:

- `0002_request_runs.sql`: immutable execution snapshots, append-only results/comments and observed agent health.
- `0003_record_revisions.sql`: a baseline of existing records and immutable revision history captured by transactional audits.

Event invitations require additive `0007_event_invitations.sql` before publishing code that serves the invitation endpoint. It copies any existing accepted event partner IDs into the new authoritative table and leaves records/history intact. Apply and check it in isolated staging first. A code rollback can leave this table in place; its accepted rows retain the earlier card behavior. Verify invitation count, `PRAGMA foreign_key_check`, and public pending-versus-Going behavior after release.

Pause the request agent for schema/code maintenance. Verify recovery and staging, apply the reviewed migrations, publish the tested code, confirm exact deployment and live integrity, then reenable the agent. Do not claim or replay real requests to test a release.

Existing queued work may receive an approval stamp only after checking exact owner authorship, latest audit actor and version. The stamp must use a guarded update with an audit in the same transaction. Any mismatch leaves the request for its owner's review. Never infer approval from an arbitrary original author.

## Super Admin release

`0005_super_admin.sql` extends the existing grants table's CHECK constraints using a transactional copy/rebuild. It preserves every scoped assignment, grant ID, audit and record, and creates no Super Admin grants. Rehearse migration with existing grants before applying to staging/production. Pause the agent until both schema and code are updated. The configured owner remains permanently authorized. Cloudflare Access admission/MFA are unchanged.

Code rollback is compatible with the expanded table: previous code ignores global grants and continues recognizing the owner and scoped assignments. Keep the role feature and runner paused during rollback; do not restore production data merely to roll back code.

## Recovery
Cloudflare's production Time Travel UI was verified to provide a seven-day recovery window on September 12. Its current recovery bookmark and exact release versions are recorded privately in ignored `.data`, not Git. See [Cloudflare Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

A previously authorized private SQL export was restored in memory with clean integrity and foreign-key checks. Both new migrations were applied to that restored copy without changing its original record counts. All 52 published records remained compatible with the new content rules.

A fresh local production export was rejected by automatic approval review because it would copy private records to a newly proposed local destination. No alternate export or scheduled workaround was performed. The verification command reads an existing authorized backup; it does not create a new private export:

```sh
node scripts/norcal-backup.mjs --verify-file EXISTING_PRIVATE_BACKUP.sql --check-upgrade --remote-check
```

This restores the existing file in memory, checks integrity and migrations, optionally inspects live integrity metadata, and writes only a compact verification report under ignored `.data/recovery-checks`. It does not prove an old export contains newer records; use the current Cloudflare recovery window for recent state. New local exports require specific authorization.

Code rollback does not require restoring data: the migrations are additive. Before this hardening release, production version was `65828571-6e05-4e44-8552-e53f766834dd` and GitHub commit `d61e90c`. If rolling back code, pause the new agent and reconcile GitHub so its next build does not undo the rollback. Never restore production data merely to roll back code.

## Operations
The public cache follow-up uses additive migration `0008_public_cache.sql` and a 30-second maximum lifetime with transactional revision invalidation. See [cache policy, validation and rollback](public-cache.md). Staging acceptance passed on version `b74dd0ec-c0e5-47cc-8746-f93663605239`: real MISS/HIT, city/year separation, cookie bypass, unsigned HQ/API isolation, immediate synthetic content invalidation and automatic expiry. The build passed 312 tests and the active suite passed 202. The owner authorized production publication after acceptance. Pre-release production version is `769087b8-2e42-4bcd-99d1-b78d0ca89933`; the Time Travel bookmark and pre/post-migration integrity reports are in ignored `.data/recovery-checks/cache-*.json`, without a private export. Verify the connected GitHub build and live cache headers after pushing; use the same release path for code rollback.

October 26, 2026 public-loading stage one: isolated staging version `7ccf8820-cc95-4457-bbb3-b7f433185ae9` uses the existing staging database without a schema migration. The build passed 302 tests, the active suite passed 192, and synthetic local browser checks covered deferred archive loading and year selection. Read-only staging checks covered health, events, archive, event/organization details, resources/privacy, calendar, sitemap and unsigned HQ. Production published October 26 through commit `d2425a8`, connected build `bcddf769-b28e-4122-a8f9-863f02bad80b`, Worker version `769087b8-2e42-4bcd-99d1-b78d0ca89933`. The live browser verified collapsed archive expansion and its 2026 event. Previous Worker version: `fe52e4ea-4cc5-489b-a572-692429d8ab3e`. Roll back by reverting the code change through the same release path; no database restore is needed. Existing cache lifetimes are unchanged.

The request agent was retired at the owner's request on September 24. Its schedule is deleted and the CLI no longer executes; Requests and past activity/history remain. Do not reenable it during release or rollback. See [historical request agent operations](hq-request-agent.md). File uploads remain disabled.

October 27 scalability work: migration `0009_public_occurrences.sql` was first applied to the separate staging D1 database. Staging Worker version `bf6aa28e-3dc5-4518-a792-b22c7701e9db` passed the initial synthetic indexed-query and cleanup checks recorded in [the performance baseline](public-performance-baseline-2026-10-27.md). The later scale-limit follow-up added migrations `0010` and `0011`, then passed hosted 1,000/6,000-event comparisons on staging Worker `366d5046-9707-42b4-b280-1822fb28e950`. See the next entry for production release and checks.

October 27 scale-limit follow-up was published through GitHub commit `297287b64d1b01d6d7388b2b544bed901df1f9d4` to production Worker version `5f8d1458-d897-4785-bf46-759867763ea1`. Production migrations `0009` through `0011` were applied first. A Time Travel bookmark and read-only pre-migration integrity metadata are in ignored `.data/recovery-checks/scale-release-pre.json`; no private export was created. Post-backfill production D1 had 39 occurrence rows, 267 visibility windows, zero dirty sources, `quick_check` OK and an empty `foreign_key_check`. Uncached live checks returned 200 for `/health`, `/yolo-solano?org_page=2`, `/events`, `/events?past_year=2026`, `/organizations/vfw-ca-8151`, `/events.ics`, `/resources` and `/privacy`; the unsigned organization-choice API returned 401. The production build passed 332 tests and the active suite passed 222. Staging comparison, synthetic fixture removal and measurement limits are recorded in [the performance baseline](public-performance-baseline-2026-10-27.md). The previous Worker version was `38fb3287-a5ae-45cc-8f42-6ed60c194e20`. For a code rollback, use the connected GitHub release path and leave these additive derived tables and triggers in place; do not restore database data solely to roll back code.

October 27 review fixes passed build (336 tests), active checks (225) and hosted acceptance on staging Worker `c2711add-6497-49cc-858e-9fb6e4c1755d`. Long directory searches returned 200 at 49 and 200 ASCII characters and with multibyte text, percent signs, underscores and backslashes; a full long query excluded a matching-prefix distractor. The fictional recurring event's homepage card displayed its next date on both fallback and indexed paths. Three fixture records, two occurrences and all fixture visibility windows were removed, with zero dirty sources, `quick_check` OK and no foreign-key errors. No schema migration was required. On October 28, commit `955a941` deployed through connected build `ba92a8f2-e8e7-42bd-936e-b9b6c1029e72` to production Worker version `ef3a9566-b0c1-4c14-bf09-f9181476c1e2`. Live 49- and 200-character searches and health, homepage, events, archive, resources, privacy and calendar routes returned 200. Roll back code through the connected GitHub path to the preceding commit `96e36de`; no database restore is needed.

During initial acceptance the account exhausted its free D1 daily write allowance, which blocked the automatic projection retry. The same derived statements succeeded through the staging fixture-import workflow, allowing indexed rendering and cleanup verification. On October 28, ordinary staging D1 writes succeeded after the allowance reset, and the temporary fictional records and derived rows were removed. A temporary diagnostic preview and log tail were stopped. The allowance is account-wide and may affect HQ saves if exhausted again. Do not use fixture-import operations as a workaround for normal production writes or change the plan without owner authorization.

Worker logs are enabled. Application diagnostics include an operation, status and correlation ID, never request bodies, identities, credentials or raw SQL errors. Public health verifies database availability. Public content uses typed validation and a shared serializer; unverified content is labeled accurately.

October 28 Post 77 update: commit `b2e031c` deployed to production Worker `a1473a1d-fb18-41b0-bb34-fe6512d1cb19`, following staging `8d0dc1e4-b5a5-42f4-a812-9f1dfb6d55fd`, 337 passing build tests, 226 active checks and a synthetic browser save. The organization editor now supports published meeting schedules and remaining verification notes. The existing `legion-ca-77` record was updated through authenticated HQ to version 2, preserving its stable profile URL, photo and event links. The live page and directory search were checked for its official website, phone, source date and fourth-Wednesday schedule. No migration was required; code rollback uses `f4f0bcc` through the connected GitHub path. Content rollback can use HQ revision history independently of a code rollback.

During that live save, HQ returned a conflict message after the update had committed. Loading the latest item showed the intended fields, and a read-only D1 check confirmed published version 2 with its immutable revision. The public page also displayed the update. This misleading save response remains a separate issue to investigate; do not blindly retry a save after this message without comparing the latest record.
