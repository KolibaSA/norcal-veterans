# Organizations

`public.mjs` exposes `sanitizePublicRecord(payload)` and `sanitizePublicPhoto(photo)` for typed public output, `assertPublicProfilePrivacy(values)` for public-profile privacy checks, and `publicOrganizationRecord(row, payload)` for the existing published-record envelope with imported-source fallback. Invalid/private nested fields are excluded. The directory/profile renderer remains a public-site adapter in `src/site.mjs`; HQ field changes start in this module's `browser.mjs` and `domain.mjs`.

Owns organization profiles and editing, categories/location, service area, public contacts, evidence and publication validation. Owned rows: `records(kind=organization)` with existing IDs and organization scope; this module also reads the static source catalog.

Organization payloads may identify an `independent`, `auxiliary`, or `sons` relationship. Non-independent records store their parent in `affiliated_with_id` using the parent's stable organization ID. They remain full organization records and public profiles; the public directory adapter hides them from its default card list and links them from the parent card.

The VFW Post 8151 profile additionally owns its scoped `meeting_plans` payload. Its HQ editor exposes twelve monthly cards with up to three labeled times. Public meeting events are derived from that plan with stable IDs, replacing matching legacy meeting-event rows while leaving every other organization unchanged.

`domain.mjs` exports `validateOrganization`, `organizationMetadata` and the record contract. `public.mjs` owns the typed public serializer. Shared validation supplies bounded values and provenance checks, not organization-specific business rules. Preserve historical evidence/address exceptions while requiring evidence for new claims; never treat stored private fields as public.

Run `npm run test:module -- organizations`. Wider API/privacy compatibility is covered by `scripts/norcal-content.test.mjs` and `scripts/public-privacy.test.mjs`.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
