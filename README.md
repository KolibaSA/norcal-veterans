# NorCal Veterans

One project, one repository, and one Cloudflare Worker serve the public website and its private headquarters.

- Public website: https://www.norcalveterans.org/yolo-solano
- Private HQ: https://www.norcalveterans.org/hq
- Regions: https://www.norcalveterans.org/regions
- GitHub: https://github.com/KolibaSA/norcal-veterans

`wrangler.jsonc` deploys `src/norcal-worker.mjs` to the existing `norcal-veterans` Worker. Public pages and the embedded `worker/legacy` HQ share the dedicated NorCal D1 database. There is no dependency on the separate multi-project Headquarters service. The September 12 direction supersedes the proposed shared-HQ migration.

HQ manages requests, project work, public submissions, organization profiles, events, coordination, reusable copy, scoped assignments, audit history, and a private database export. Cloudflare Access protects the private routes; the Worker independently verifies signed identity and enforces record permissions on every request. The existing owner remains the only allowlisted account. Requests can be tracked manually; automatic processing and file storage are not configured for this release.

Public submissions enter a private review queue. Only published organizations and events appear publicly. Existing IDs, records, domains, and the Yolo-Solano launch redirect are preserved.

## Development and deployment

Requires Node 24 or newer. Install the locked dependencies with pnpm.

```sh
npm run build
npm test
npx wrangler dev
```

Cloudflare builds GitHub `main` with `npm run build`, then deploys with `npx wrangler deploy`. Both website and HQ publish together. See [deployment and recovery](docs/norcal-deployment.md) for preview verification, backups, and rollback.

The imported `src/hq.mjs`, `dist/hq-worker.mjs`, `wrangler.hq.jsonc`, and non-legacy migrations describe the original Yolo source application and a different database schema. They are retained for reference and regression coverage. Do not deploy that HQ configuration or apply those migrations to the NorCal database. The active HQ template is generated from `worker/legacy/hq.html` by the build.

Never commit credentials, private database exports, or veteran case information. Backups belong in ignored private storage, never in `public/` or Git.
