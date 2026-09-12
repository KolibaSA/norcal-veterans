# Submissions

Owns public contribution intake and private review: `records(kind=submission)` with pending, reviewed and rejected states, plus `submission_limits` for anonymous JSON intake. Review does not publish an organization/event or grant authority automatically.

- `server.mjs`: `handleSubmission(req, env, url)` preserves `POST /api/submissions`, its 15 KB byte cap, same-origin requirement, honeypot, hashed hourly rate bucket and pending private record.
- `public.mjs`: public contribution form and `organizationSubmission` parsing.
- `domain.mjs`: private review record validation/statuses.

Share a Program's program-specific form belongs to `share-program`. The application workflow `src/app/public-intake.mjs` connects both forms to the existing review API. `public.mjs: organizationSubmission(form, organizations)` accepts URLSearchParams and live `{id}` choices and returns `{title, body}` with the existing private review JSON. `submissionPage(url, {organizations, error, received})` returns escaped form HTML; choices include public organization names. Run `npm run test:module -- submissions`. `scripts/norcal-api.test.mjs` verifies streaming body cancellation and `scripts/legacy-security.test.mjs` covers review/rate-limit behavior.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
