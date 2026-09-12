# Attachments

Owns private attachment listing/downloads and the explicitly unavailable upload endpoint. `server.mjs` exports `handleAttachments(req, env, user, grants, url)` for `/api/hq/attachments` and `/api/hq/attachments/:id`. Listing and download enforce the owning record's scope; downloads use private/no-store and attachment disposition. POST keeps the existing 503 response.

Owned data: `attachments` metadata and optional existing `FILES` objects. No upload binding or new upload feature is added. Run `npm run test:module -- attachments`; security regression includes unsigned private endpoint rejection in `scripts/norcal-api.test.mjs`.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
