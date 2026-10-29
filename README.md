# NorCal Veterans

One project, one repository, and one Cloudflare Worker serve the public website and its private headquarters.

- Public website: https://www.norcalveterans.org/yolo-solano
- Private HQ: https://www.norcalveterans.org/hq
- Regions: https://www.norcalveterans.org/regions
- GitHub: https://github.com/KolibaSA/norcal-veterans

`wrangler.jsonc` deploys `src/norcal-worker.mjs` to the existing `norcal-veterans` Worker. Public pages and the embedded `worker/legacy` HQ share the dedicated NorCal D1 database. There is no dependency on the separate multi-project Headquarters service. The September 12 direction supersedes the proposed shared-HQ migration.

HQ manages requests, project work, public submissions, organization profiles, events, coordination, reusable copy, global Super Admin and scoped assignments, audit history, and a private database export. The Clerk release uses invitation-only email-code sign-in without MFA, as explicitly selected by the owner; the Worker verifies identity and enforces record permissions on every request. HQ assignments remain separate from Clerk admission. The request agent was retired on September 24, 2026; Requests and history remain for manual tracking. See [Clerk release status](docs/clerk-migration.md) for verified deployment state. File storage remains unconfigured.

Public submissions enter a private review queue. Only published organizations and events appear publicly. Existing IDs, records, domains, and the Yolo-Solano launch redirect are preserved.

## Purpose and continuing work

The public website helps people find regional veterans organizations, events, resources, and ways to connect. HQ is the private workspace for maintaining that information, coordinating work, reviewing submissions, and requesting site/HQ changes. Yolo-Solano is the first region in a shared regional application.

These three repository documents provide the starting context for a new task; a separate handoff is not required:

- [AGENTS.md](AGENTS.md): permanent project rules, user intent, and operating constraints.
- This README: project background, recent milestones, and verification limits.
- [MODULES.md](MODULES.md): feature ownership, supported interfaces, and focused test commands.

Read these overview documents, then the requested module's README and BROWSER.md where present. Consult deployment/recovery or request-agent operations when the task involves those concerns. Reading every module or the entire application is not a prerequisite for changing one feature.

Chris's reason for modularity is to reduce the amount of source Codex must review and the chance of unintended changes elsewhere. Preserve existing website and HQ behavior unless the current request calls for a behavior change. Shared infrastructure and explicit dependencies support focused work; they do not make every feature completely independent.

The [AI Working Guide](docs/AI-WORKING-GUIDE.md) and [project lessons log](docs/AI-LESSONS.md) were adopted on September 13, 2026. Consult the log's short current reference before changes and add only reusable, evidence-backed lessons afterward. These are adaptable guidance, not replacements for project requirements. Keep them in repository documentation, outside the public website assets.

## Super Admin access

In HQ, open Organization & region access, enter an email, select **Super Admin**, and save. No region or organization is required. This grants full HQ access, including publishing, Requests, access management and exports. In Clerk mode, use Send invitation for a person who has not registered. Invitations do not grant permissions on their own. The configured owner keeps permanent access.

## Recent milestones and verification context

October 26, 2026 cache follow-up: public response caching has a 30-second maximum lifetime, complete URL/version separation, and transactional invalidation for published content and accepted participants. HQ and submission forms bypass it. The build passed 312 tests and the active suite passed 202. Isolated staging version `b74dd0ec-c0e5-47cc-8746-f93663605239` passed real cache hit/miss, filter/year separation, credential bypass, immediate create/edit/withdraw/republish/delete invalidation, and timed expiry checks. Synthetic test content was removed. See [cache policy and release procedure](docs/public-cache.md). Indexed dates, regional queries and pagination were delivered in the October 27 release below.

October 26, 2026: public-loading performance stage one was implemented and verified on the isolated staging Worker, version `7ccf8820-cc95-4457-bbb3-b7f433185ae9`. Static pages skip directory queries, forms load only organization choices, detail pages load their own records and accepted participants, and initial event lists prefilter older occurrences. Past-event cards and the year selector load when the archive is opened, with an ordinary link/form fallback. Existing detail URLs, calendar downloads, typed public serialization and full exports are retained. The build passed 302 tests; the active suite passed 192. Local synthetic browser checks covered archive expansion and 2026/2025 year selection, and staging covered the deployed read paths and archive expansion. Published through GitHub commit `d2425a8` to production Worker version `769087b8-2e42-4bcd-99d1-b78d0ca89933` on October 26. The connected build passed and the live browser verified the deferred archive with the October 8 VBC event. No database migration was required. The October 27 follow-up below added indexed occurrence lookups, regional pagination, and bounded HQ organization choices. These database and query checks are not a network capacity or load-test certification.

October 27, 2026: the scalability follow-up was published through GitHub commit `297287b` to production Worker version `5f8d1458-d897-4785-bf46-759867763ea1`. Additive D1 migrations `0009` through `0011` were applied after recording the existing Time Travel bookmark and integrity checks; the bookmark and compact recovery metadata are stored in ignored `.data/recovery-checks/scale-release-pre.json`. The 60 existing records were preserved. Four uncached Events requests completed the bounded backfill: 39 occurrence rows and 267 visibility-window rows, with no dirty sources remaining. Production smoke checks returned 200 for the regional directory, upcoming events, 2026 archive, Post 8151 profile, calendar, Resources, Privacy and health; the unsigned HQ organization-choice API returned 401. Post-migration `quick_check` was OK and `foreign_key_check` was empty. The build passed 332 tests and the active suite passed 222. The hosted synthetic comparison and its limits are recorded in [the performance baseline](docs/public-performance-baseline-2026-10-27.md). This improves bounded database reads but does not certify a maximum network size or visitor load.

September 30, 2026: the public SEO foundation adds canonical-host and duplicate-profile redirects, a robots file, and a sitemap generated from published pages with public detail routes. The `norcalveterans.org` Search Console domain property was verified and its HTTPS sitemap processed with 45 discovered pages that day. Organization profiles then gained descriptions based on their published summaries and local `Organization` structured data. Current indexing and search performance must be checked in Search Console rather than inferred from sitemap submission or markup.

September 24, 2026: the Clerk migration is implemented and verified in isolated staging. The owner selected basic email-code authentication without MFA and requested retirement of the scheduled agent while preserving Requests/history. See [Clerk migration status and runbook](docs/clerk-migration.md) for exact publication and acceptance evidence; do not infer deployment from local code.

Recorded September 12, 2026; these are completed changes, not a new work queue. Use Git history and current checks when a task depends on present deployment or runtime state.

- The public website and dedicated private HQ were published together (`89be6b2`), followed by the local request processor (`d61e90c`) and request/content/recovery hardening (`144171c`). Exact-revision approval, immutable execution instructions, separate comments/results, and guarded recovery protect owner work from accidental replay.
- All 13 HQ feature modules were extracted in `b5f19cc`. The refactor is complete; earlier modularity handoffs describe completed work. Existing routes and data/schema were retained, with module documentation, dependency checks, and focused test discovery added. The save-body regression described below was found and fixed afterward.
- Follow-up work improved the automatically opened request composer and target/scope choices (`617bf05`), access administration (`70ab28c`), Marine Corps League page styling (`ad1e144`), and homepage imagery (`ac70d04`, `72c4d50`).
- VFW Post 8151 alone has a twelve-month meeting planner inside its HQ organization profile. Each month supports a date, title, notes, and up to three ordered time-and-label entries; saving the profile publishes the annual cards without creating separate meeting pages.
- The Requests error “Choose a valid section and status” was caused by the shared editor omitting the selected status from its save body. `c708f52` fixed that omission and added a regression test. Creating and editing requests then passed in Chrome with local synthetic data. An already-open HQ page keeps its old embedded script until reloaded; preserve unsaved text before refreshing. User confirmation after refreshing was not recorded in this task.

The modularity release passed its automated suite and isolated staging acceptance. Signed-in browser checks used the local synthetic fixture; production checks were read-only and included public output and unsigned HQ denial. These are different kinds of evidence. Historical passing checks do not establish current production authentication, agent health, or every possible UI interaction. Test the actual affected workflow when making further changes.

Public response caching is documented in [the cache policy and recovery guide](docs/public-cache.md). Its release status is tracked in [deployment operations](docs/norcal-deployment.md#operations).

October 27, 2026 scalability work adds regional directory and event pagination, derived occurrence/time indexes, paginated and searchable HQ organization choices, paginated HQ lists and scoped summary counts. It was published through `297287b`, as recorded in the milestone above. The hosted first-page comparison held at 308 event-retrieval rows read when the fictional fixture grew from 1,000 to 6,000 events. See [performance measurements](docs/public-performance-baseline-2026-10-27.md).

October 28 review fixes were published through GitHub commit `955a941` and production Worker version `ef3a9566-b0c1-4c14-bf09-f9181476c1e2`, after verification on staging Worker `c2711add-6497-49cc-858e-9fb6e4c1755d`. Directory and paginated HQ record searches retain literal queries up to 200 characters without D1's LIKE-pattern restriction. The regional homepage now uses the Events module's remaining-occurrence rules and shows a recurring event's next date after its original date passes. The build passed 336 tests and the active suite passed 225. Hosted checks covered long ASCII and multibyte searches, literal wildcard characters, complete-query matching, and recurring homepage dates with both fallback and indexed reads. Fictional staging records and their derived rows were removed; integrity checks passed. No migration was needed. The account's free D1 daily write allowance was exhausted during initial acceptance; ordinary staging writes succeeded after the allowance reset.

October 29 directory follow-up is verified on staging, pending publication. The public directory automatically loads every matching organization card into one continuous grouped list while retaining bounded database requests. Card text reserves space for unchanged logos, including a separate title area on narrow cards. The build passed 337 tests and active checks passed 226; browser acceptance covered complete loading, filtering, retry, and all 27 source-catalog cards at phone, tablet and desktop widths. See [release acceptance and rollback](docs/norcal-deployment.md).

## Development and deployment

Requires Node 24 or newer. Install the locked dependencies with pnpm.

```sh
npm run build
npm run test:active
npx wrangler dev --config wrangler.staging.jsonc
```

Cloudflare builds GitHub `main` with `npm run build`, which generates artifacts and must pass all tests, then deploys with `npx wrangler deploy`. Both website and HQ publish together. Use `wrangler.staging.jsonc` for isolated write testing. See [deployment and recovery](docs/norcal-deployment.md) for migrations, verification and rollback.

The imported `src/hq.mjs`, `dist/hq-worker.mjs`, `fixtures/imported/wrangler.hq.jsonc.txt`, and non-legacy migrations describe the original Yolo source application and a different database schema. They are retained for reference and regression coverage. Do not deploy that HQ configuration or apply those migrations to the NorCal database. The active HQ template is generated from readable HTML, CSS and a client module under `worker/legacy`.

Never commit credentials, private database exports, or veteran case information. Backups belong in ignored private storage, never in `public/` or Git.
