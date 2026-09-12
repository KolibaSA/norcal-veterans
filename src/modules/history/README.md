# History

Owns read-only audit and immutable record revisions. `server.mjs` exports `handleHistoryRoute(req, env, user, grants, path)`, returning a Response or null for `/api/hq/audit` and `/api/hq/records/:id/history`. Audit is owner-only; revision history uses the same scope checks as record reads.

Owned reads: `audit`, `record_revisions`. History calls Requests' supported `redactPayload` interface because snapshots can contain request execution credentials. Execution comments/runs/results remain owned by Requests. Run `npm run test:module -- history` and `scripts/norcal-api.test.mjs` for revision preservation, authorization and atomic audit rollback.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
