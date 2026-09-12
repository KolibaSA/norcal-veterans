# Library

Owns private library records: `records(kind=library)` with draft, ready and archived states. Existing links, categories, tags and arbitrary bounded metadata retain their behavior. Attachments use their own supported module interface and remain unavailable for new uploads.

Run `npm run test:module -- library`. Shared persistence, version and assignment checks are covered by `scripts/norcal-api.test.mjs` and `scripts/legacy-security.test.mjs`.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
