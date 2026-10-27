# Public cache policy

Implemented October 26, 2026. `src/app/public-cache.mjs` owns the public response cache; `src/norcal-worker.mjs` applies it outside public rendering. HQ authentication and record handlers remain separate.

## Freshness and privacy

- Successful anonymous GET responses for the directory, organization/event details, Events, location pages, calendar download, public data and sitemap can be reused for at most 30 seconds from the start of rendering. Selected static information pages use the same lifetime without a database read.
- Every dynamic cache lookup reads the singleton revision from the primary D1 binding. Migration `0008_public_cache.sql` advances it in the same transaction as a published organization/event insert, edit, withdrawal or deletion. Accepted participant changes also advance it. All public variants then use a new key, across every Cloudflare location. Private draft-only changes do not invalidate the cache.
- Keys include the deployed Worker version, hostname, path, complete query string and content revision. Region, city/type/search filters, archive year and pagination parameters cannot share an entry. Sorting parameter names retains repeated-value order. Future regional paths must be added to the explicit route allowlist when implemented.
- Automatic expiry limits time-driven event transitions to at most 30 seconds of staleness without any content edit. Already-open pages and downloaded calendars do not update themselves.
- Client responses require revalidation (`no-cache, max-age=0, must-revalidate`). Only the stored Cloudflare copy has a positive lifetime. This prevents a browser cache from skipping the content-revision check.
- HQ, APIs, health, submission forms, POSTs, unknown routes and static assets are outside this cache. Requests carrying cookies, Authorization, an Access assertion or Range bypass it. Errors, redirects, private/no-store responses, responses setting cookies and varying output are never stored. HEAD can reuse a GET entry but cannot create an empty GET entry.
- If revision lookup or cache access fails, render fresh rather than serving an unchecked stale entry. Diagnostics contain operation names only. `X-NorCal-Cache` reports HIT, MISS or BYPASS on eligible public paths. Setting `PUBLIC_CACHE_DISABLED=true` disables reuse; use the reviewed deployment configuration to make that override durable.

The revision is global for this first cache release: changing one published record invalidates all dynamic public variants. This favors correctness while the network is small. It still performs one indexed metadata read per cache hit. It does not add regional query scoping, indexed event occurrences, pagination, tiered caching or a capacity guarantee.

## Release and recovery

1. Run the focused cache tests, full build and active tests. Rehearse the additive migration with existing synthetic records, invitations and immutable history.
2. Apply `0008_public_cache.sql` to the separate staging database and deploy `wrangler.staging.jsonc`. Verify MISS/HIT, different filters/year keys, expiry, credential bypass, and immediate invalidation using synthetic staging changes only.
3. Before the approved production release, inspect pending migrations and the current Time Travel bookmark. Apply only the reviewed additive migration. It creates one metadata row and six triggers; it does not rewrite records, invitations or history, and needs no private export.
4. Publish through connected GitHub main, then verify the active Worker version, public paths and cache headers. Both configurations bind `CF_VERSION_METADATA`, so every new Worker version starts a new cache namespace.
5. Roll back code through the connected release path if needed. The prior Worker ignores the new table/triggers. Keep them and all existing content; a data restore is not needed for a code rollback. Keep the retired request agent disabled.

Sources: [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) and [Worker version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/), checked October 26, 2026. Cache API entries are local to each Cloudflare data center; revision keys provide invalidation without relying on local `cache.delete` as a global purge.
