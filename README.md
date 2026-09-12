# NorCal Veterans

One project, one repository, and one Cloudflare Worker serve the public website and its private headquarters.

- Public website: https://www.norcalveterans.org/yolo-solano
- Private HQ: https://www.norcalveterans.org/hq
- Regions: https://www.norcalveterans.org/regions
- GitHub: https://github.com/KolibaSA/norcal-veterans

`wrangler.jsonc` deploys `src/norcal-worker.mjs` to the existing `norcal-veterans` Worker. Public pages and the embedded `worker/legacy` HQ share the dedicated NorCal D1 database. There is no dependency on the separate multi-project Headquarters service. The September 12 direction supersedes the proposed shared-HQ migration.

HQ manages requests, project work, public submissions, organization profiles, events, coordination, reusable copy, scoped assignments, audit history, and a private database export. Cloudflare Access protects the private routes; the Worker independently verifies signed identity and enforces record permissions on every request. The existing owner remains the only allowlisted account. The NorCal HQ request agent checks queued owner requests every five minutes while its computer is awake and Codex is running, then saves results back to HQ. See [request agent operations](docs/hq-request-agent.md). File storage remains unconfigured.

Public submissions enter a private review queue. Only published organizations and events appear publicly. Existing IDs, records, domains, and the Yolo-Solano launch redirect are preserved.

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
