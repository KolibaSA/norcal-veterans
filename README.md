# NorCal Veterans

One project, one repository, and one Cloudflare Worker serve the public website and its private headquarters.

- Public website: https://www.norcalveterans.org/yolo-solano
- Private HQ: https://www.norcalveterans.org/hq
- Regions: https://www.norcalveterans.org/regions
- GitHub: https://github.com/KolibaSA/norcal-veterans

`wrangler.jsonc` deploys `src/norcal-worker.mjs` to the existing `norcal-veterans` Worker. Public pages and the embedded `worker/legacy` HQ share the dedicated NorCal D1 database. There is no dependency on the separate multi-project Headquarters service. The September 12 direction supersedes the proposed shared-HQ migration.

HQ manages requests, project work, public submissions, organization profiles, events, coordination, reusable copy, global Super Admin and scoped assignments, audit history, and a private database export. Cloudflare Access protects the private routes; the Worker independently verifies signed identity and enforces record permissions on every request. Cloudflare Access admission remains separate from HQ role assignments. The NorCal HQ request agent checks queued owner and currently authorized Super Admin requests every five minutes while its computer is awake and Codex is running, then saves results back to HQ. See [request agent operations](docs/hq-request-agent.md). File storage remains unconfigured.

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

In HQ, open Organization & region access, enter an email, select **Super Admin**, and save. No region or organization is required. This grants full HQ access, including publishing, Requests, access management and exports; it does not change the Cloudflare Access sign-in policy. The configured owner keeps permanent access. No new person is granted access as part of this feature release.

## Recent milestones and verification context

Recorded September 12, 2026; these are completed changes, not a new work queue. Use Git history and current checks when a task depends on present deployment or runtime state.

- The public website and dedicated private HQ were published together (`89be6b2`), followed by the local request processor (`d61e90c`) and request/content/recovery hardening (`144171c`). Exact-revision approval, immutable execution instructions, separate comments/results, and guarded recovery protect owner work from accidental replay.
- All 13 HQ feature modules were extracted in `b5f19cc`. The refactor is complete; earlier modularity handoffs describe completed work. Existing routes and data/schema were retained, with module documentation, dependency checks, and focused test discovery added. The save-body regression described below was found and fixed afterward.
- Follow-up work improved the automatically opened request composer and target/scope choices (`617bf05`), access administration (`70ab28c`), Marine Corps League page styling (`ad1e144`), and homepage imagery (`ac70d04`, `72c4d50`).
- VFW Post 8151 alone has a twelve-month meeting planner inside its HQ organization profile. Each month supports a date, title, notes, and up to three ordered time-and-label entries; saving the profile publishes the annual cards without creating separate meeting pages.
- The Requests error “Choose a valid section and status” was caused by the shared editor omitting the selected status from its save body. `c708f52` fixed that omission and added a regression test. Creating and editing requests then passed in Chrome with local synthetic data. An already-open HQ page keeps its old embedded script until reloaded; preserve unsaved text before refreshing. User confirmation after refreshing was not recorded in this task.

The modularity release passed its automated suite and isolated staging acceptance. Signed-in browser checks used the local synthetic fixture; production checks were read-only and included public output and unsigned HQ denial. These are different kinds of evidence. Historical passing checks do not establish current production authentication, agent health, or every possible UI interaction. Test the actual affected workflow when making further changes.

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
