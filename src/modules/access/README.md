# Access administration

Owns creating/listing/revoking administrator/editor assignments in `grants` and corresponding grant/revoke audit entries. `server.mjs` exports `handleAccessRoute(req, env, user, path)` for `/api/hq/access` and `/api/hq/access/:id`. Only the platform owner may manage access; writes also require matching Origin. Region and organization assignments are mutually exclusive and organization grants require an existing organization.

Identity verification and permission enforcement used by all other modules live in `src/shared/server-auth.mjs`; using those functions does not require reviewing Access administration. Run `npm run test:module -- access`. `scripts/legacy-security.test.mjs` covers assignment isolation, revocation and publishing permissions.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
