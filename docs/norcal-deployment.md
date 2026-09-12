# NorCal website and project HQ deployment

## Active architecture — September 12, 2026

The public website and private `/hq` deploy together from GitHub `KolibaSA/norcal-veterans`, branch `main`, to the existing `norcal-veterans` Cloudflare Worker. The entry point is `src/norcal-worker.mjs`; `worker/legacy` provides project administration. The dedicated NorCal D1 database remains authoritative. There is no HEADQUARTERS service binding or shared-HQ redirect.

The September 10 migration rehearsal is superseded by the owner's decision to manage each project independently. The separate Headquarters Worker, rehearsal Workers, and their databases are retained. This release neither imports their data nor deletes them.

Production addresses:

- https://www.norcalveterans.org/yolo-solano
- https://www.norcalveterans.org/hq
- https://www.norcalveterans.org/regions

Both apex and `www` root paths temporarily redirect to `/yolo-solano`. The HQ and private API paths are covered by the existing NorCal Veterans Headquarters Cloudflare Access application. Its exact owner allowlist and application-specific biometric/authenticator MFA configuration remain unchanged. The Worker independently verifies JWT issuer, audience, expiry and signature, then enforces record assignments. Alternate Worker and version URLs fail closed without a valid identity.

## Build and verification

Use Node 24 or newer:

```sh
npm run build
npm test
npx wrangler versions upload --message "NorCal website and private project HQ preview"
```

In a restricted Windows test environment, use `node --test --test-isolation=none scripts/*.test.mjs` when child-process isolation is unavailable. Build regenerates the active `worker/legacy/hq-template.mjs` from `hq.html`. The generated `dist/worker.mjs` and `dist/hq-worker.mjs` are source-application regression fixtures; Wrangler deploys the configured NorCal entry point directly.

Verify preview public pages, all published organization URLs, event calendars, full image bytes, form handling, and unauthorized private-route denial before production. Tests cover signed authentication, scope isolation and revocation, publication rules, stale updates, audit behavior, submission limits, and public/private separation. Organization creation must authorize the stored organization scope. Events must retain their organization assignment for profile calendars.

Cloudflare's GitHub connection builds `main` with `npm run build` and deploys with `npx wrangler deploy`. Changes to this repository publish the public website and embedded HQ together.

September 12 validation: all 106 tests pass. The fresh database backup restores with a clean integrity check; 36 public routes render and 18 missing/forged-identity checks deny private access. Homepage photos use the existing verified community asset. Submission selectors and event host links use the live NorCal organization list. Wrangler is pinned to 4.92.0 so the preview and connected production build use the same deployment tool.

## Database and recovery

No schema migration or live content change is required. Do not apply the imported root migrations or deploy `wrangler.hq.jsonc`: they describe a different Yolo database and account.

Before this release, D1 contained 27 published organizations, 25 published events, three requests and one task. A fresh private SQL backup is saved in ignored `.data/norcal-before-project-hq-20260912.sql` in the release worktree. Restore-check it in isolated SQLite; never place it in Git or static assets.

Production version recorded before the September 12 release: `1df569cf-3d5b-42c3-84e3-3e1db0361839`. To roll back code without changing records:

```sh
npx wrangler versions deploy 1df569cf-3d5b-42c3-84e3-3e1db0361839@100% --yes --config wrangler.jsonc
```

Reconcile or revert the corresponding GitHub change so the next build does not overwrite the rollback. Restore D1 only for a separately verified database failure. Code rollback does not require data restoration for this release.

## Current operating limits

The NorCal HQ request agent checks queued owner requests every five minutes through the existing authenticated Cloudflare connection. It runs locally with Codex, claims one request at a time, and records outcomes in HQ. See [request agent operations](hq-request-agent.md). File uploads remain disabled because the NorCal Worker has no private R2 file binding. Public forms remain under review and do not automatically publish or grant access.

This corporate workstation blocks the production custom domain through its newly-registered-domain filter. Record Cloudflare deployment and preview evidence separately from a real signed-in production browser check; do not claim that check passed from this machine.
