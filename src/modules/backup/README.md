# Backup export

Owns the existing platform-owner/Super-Admin private logical JSON snapshot endpoint. `server.mjs` exports `handleBackupRoute(req, env, user, path)` for `GET /api/hq/export`; returns Response or null. It batches the existing eight tables and preserves schema version 3, headers and snapshot note. This endpoint is private recovery output and intentionally differs from public/display serializers.

This refactor neither invokes the live endpoint nor creates private exports. Follow repository recovery instructions before operational exports/restores. Run `npm run test:module -- backup`; the synthetic export contract is also checked in `scripts/norcal-api.test.mjs`.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
