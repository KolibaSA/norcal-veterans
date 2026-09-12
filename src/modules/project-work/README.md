# Project Work

Owns private tasks: `records(kind=task)` with open, in-progress, completed and closed states. Assignment, due time, tags and additional bounded metadata remain available. Scope permissions come from shared authorization; this feature does not administer grants.

Run `npm run test:module -- project-work`. `scripts/norcal-api.test.mjs` additionally verifies record conflicts, scoped reads and audit rollback using private tasks.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
