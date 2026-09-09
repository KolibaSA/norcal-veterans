# NorCal replacement — September 9, 2026

The user replaced GitHub main with source commit 6b69374. The public renderer now uses that design at www.norcalveterans.org, on the existing Sterling Cloudflare account and Worker. Existing 27 published organizations and 25 published events remain authoritative in D1. No schema migration or live record edits are required.

## Runtime and privacy

Entry: src/norcal-worker.mjs. Static files: public/ via ASSETS. The copied source's original account, D1 and R2 bindings are not used. Two full branding PNGs and the community image were recovered from the existing NorCal public assets because the imported build truncated image fallbacks to 128 bytes. Canonical links use the live NorCal domain.

/hq and /api/* retain the previous private application with signed Access JWT verification, scoped authorization, revision checks and audit history. Public forms save pending submissions through its rate-limited endpoint. Speaker introductions are reviewed by the site team; the imported source's separate organization dashboard workflow has not been migrated. No new access grants, emails or private exports are published.

## Validation

npm run build succeeds. All 100 tests pass using Node 24 (in this desktop sandbox: node --test --test-isolation=none scripts/*.test.mjs). This includes the retained authorization tests and new tests covering public/private separation, complete image bytes and pending form submissions. A source photo audit timestamp race was repaired with a unique per-mutation audit gate and a frozen-clock regression test; that source editor is not the active private NorCal editor.

The D1 SQL backup restores into isolated SQLite and renders all 27 published profiles plus regional, events and submission pages. Inactive preview 9409a74f-f646-4ca2-8497-b5643785caae served the new home page, events, forms, JSON and full 1,481,060-byte NorCal logo; unauthenticated private routes returned 401. Chrome confirmed the new regional directory and navigation.

## Backup and rollback

The private SQL export is stored locally in ignored .data/norcal-before-replacement.sql in the replacement worktree. Do not add it to Git or static assets. Cloudflare D1 database ID remains 3133f3c9-0e2b-4012-9069-024c00e31d00. The saved original checkout is retained until publication verification.

Previous production Worker version: 53c005a7-43e1-4886-94de-e9e47ab40146. To roll back application code without changing records, run:

    npx wrangler versions deploy 53c005a7-43e1-4886-94de-e9e47ab40146@100% --yes --config wrangler.jsonc

Then verify public routes and private authentication. Pause or revert a conflicting Git build before rollback so it does not redeploy the replacement. Restore D1 only if a separate, verified data failure requires it; this release does not mutate or migrate the database.

GitHub source: KolibaSA/norcal-veterans, production branch main. Cloudflare build command npm run build; deploy command npx wrangler deploy; root /. Configuration retains both existing domain routes. Future public changes can deploy through this connection.
