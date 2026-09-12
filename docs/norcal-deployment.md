# NorCal website and project HQ deployment

## Active architecture
GitHub `KolibaSA/norcal-veterans`, branch `main`, deploys `wrangler.jsonc` and `src/norcal-worker.mjs` to the existing `norcal-veterans` Cloudflare Worker. The embedded HQ uses `worker/legacy` and the dedicated NorCal D1 database. Website and HQ remain one project; there is no shared Headquarters service binding.

Public site: https://www.norcalveterans.org/yolo-solano
Private HQ: https://www.norcalveterans.org/hq
Region selector: https://www.norcalveterans.org/regions

Both root domains temporarily redirect to Yolo-Solano. Existing Cloudflare Access owner allowlist and MFA remain unchanged. The Worker independently validates signed identity and assignments; alternate URLs fail closed without identity.

## Build and test gate
Use Node 24 and the existing locked dependencies. `.node-version` pins the build to that major version using [Cloudflare's supported version override](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#overriding-default-versions):

```sh
npm run build
npm run test:active
```

The connected Cloudflare production build runs `npm run build`, then `npx wrangler deploy`. Build now generates artifacts and executes the entire test suite; a failure stops publication. The active HTML/CSS/client module generates `hq-template.mjs` plus a CSP script hash. Do not edit generated files.

`test:active` runs the NorCal Worker, embedded HQ, queue, content and recovery tests. The full suite additionally preserves imported application regressions. Imported deployment configuration is archived as `fixtures/imported/wrangler.hq.jsonc.txt`; its source modules and flat `dist` outputs are regression fixtures, not production entry points.

## Isolated staging
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

Pause the request agent for schema/code maintenance. Verify recovery and staging, apply the reviewed migrations, publish the tested code, confirm exact deployment and live integrity, then reenable the agent. Do not claim or replay real requests to test a release.

Existing queued work may receive an approval stamp only after checking exact owner authorship, latest audit actor and version. The stamp must use a guarded update with an audit in the same transaction. Any mismatch leaves the request for its owner's review. Never infer approval from an arbitrary original author.

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
The request agent remains local and checks every five minutes while this computer is awake and Codex is running. HQ shows the last observed poll, current request and errors, with results in separate activity history. See [request agent operations](hq-request-agent.md). File uploads remain disabled.

Worker logs are enabled. Application diagnostics include an operation, status and correlation ID, never request bodies, identities, credentials or raw SQL errors. Public health verifies database availability. Public content uses typed validation and a shared serializer; unverified content is labeled accurately.
