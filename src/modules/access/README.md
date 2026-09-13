# Access administration

Owns creating/listing/revoking administrator/editor assignments in `grants` and corresponding grant/revoke audit entries. `server.mjs` exports `handleAccessRoute(req, env, user, path)` for `/api/hq/access` and `/api/hq/access/:id`. The platform owner and current Super Admins may manage access; writes also require matching Origin. `super_admin` is global and requires both scope columns to be null; other roles require exactly one scope and organization grants require an existing organization. Super Admin includes publishing, Requests/agent approval, history, exports and management of other administrators. Cloudflare Access admission remains a separate prerequisite; assigning a role does not change its sign-in allowlist. The configured owner is not stored as a revocable grant.

`resolvePrivileges(identity, grants)` derives `superAdmin` from fresh server-loaded grants on every HQ request. `owner` remains the actual configured-owner flag. `isPlatformAdmin(user)` is the shared server/browser privilege predicate; browser flags are never accepted as server authority. Revocation takes effect at the next request; existing scoped grants remain intact. Migration `0005_super_admin.sql` expands the grant CHECK constraints with a transactional copy/rebuild, preserving IDs and audits. It creates no assignments.

Identity verification and permission enforcement used by all other modules live in `src/shared/server-auth.mjs`; using those functions does not require reviewing Access administration. Run `npm run test:module -- access`. `scripts/legacy-security.test.mjs` covers assignment isolation, revocation and publishing permissions.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
