# Public performance baseline

Recorded October 27, 2026 using `node scripts/norcal-performance-baseline.mjs`. The script builds an in-memory database with 450 fictional organizations, 2,400 fictional events across three regions, historical dates from 2020 through 2029, and some later recurring occurrences. It invokes the actual public Worker and uses an in-memory cache double. No production records or remote databases are used.

| Request | Rows returned to Worker, uncached | Response bytes | Local uncached time | Local cached time |
| --- | ---: | ---: | ---: | ---: |
| Regional homepage | 1,651 | 470,230 | 153 ms | 2 ms |
| Upcoming events | 1,426 | 1,480,616 | 276 ms | 4 ms |
| Past events, 2025 | 2,851 | 1,775,930 | 544 ms | 2 ms |
| Organization profile | 8 | 8,014 | 23 ms | 1 ms |
| Event detail | 3 | 4,410 | 3 ms | 2 ms |
| Privacy | 0 | 7,709 | 1 ms | 1 ms |

The uncached homepage and listing results include records from all three fictional regions. Cached dynamic requests performed one revision lookup and returned one metadata row; the static privacy page made no database query. The cache double is a local test tool, not a measurement of Cloudflare's edge latency.

These are single local runs, not statistical latency measurements or capacity limits. The row count records rows returned to the Worker; it does not measure rows scanned by SQLite or D1's billable rows-read metric. The script prints a query plan as a diagnostic, but hosted D1 query metrics are still needed to measure rows read. Re-run this identical fixture after query and pagination changes, and record both results and hosted staging evidence before release.

An intermediate local change that limited requests to one region returned 551 rows for the homepage, 476 for upcoming events, and 951 for the 2025 archive. Those figures precede the indexed implementation below.

## Initial indexed implementation, October 27

The same local fixture after the changes returned 34 rows for the regional homepage, 42 for upcoming events, and 89 for the 2025 archive. The corresponding responses were 45,383, 36,484, and 67,817 bytes. A single local run measured 35, 21, and 22 ms uncached and 5, 1, and 1 ms cached. The cache double performed one revision lookup per dynamic hit. These are local, single-run results, not a load test or D1 rows-read measurements. The earlier work-in-progress notes above are historical and do not describe the current implementation.

In hosted staging, 900 fictional events were added across three regions and indexed. D1 reported 902 rows read for a broad published-event query, 604 for the indexed upcoming first page, and 121 for the 2025 archive first page. These are separate SQL queries, not total request costs, and the upcoming query still processes matching occurrences within the selected region before grouping and limiting. The first and second upcoming pages had no shared events; another region had no overlap with the first region. The same URL produced cache MISS then HIT, and deletion invalidated the cached page. After testing, all 900 test records and their derived occurrences were removed; the dirty queue was empty, `quick_check` was OK, and `foreign_key_check` returned no rows. These synthetic measurements do not establish production capacity or replace load testing.

## Bounded upcoming lookup and HQ picker acceptance

The follow-up adds indexed future reads and a derived index for currently active occurrences, including long-running events. Each ordered stream has a limit before its IDs are combined; full payloads are retrieved for the selected page. Organization meetings are excluded by the `listable` index key. The active lookup uses a D1 batch because the attempted compound SELECT was accepted locally but rejected by hosted D1.

The staging fixture generator is `scripts/norcal-scale-fixture.mjs`. It produces only fictional SQL and does not connect to a database. The hosted comparison used 1,000 events, then another 5,000 events, split 80% Yolo-Solano and 20% a fictional other region. It includes historical, ongoing, future and recurring occurrences. Identical queries and the same reference instant were used at both sizes.

| Event retrieval | D1 rows read at 1,000 events | D1 rows read at 6,000 events |
| --- | ---: | ---: |
| Previous regional grouping query | 2,404 | 14,404 |
| Revised first page, including payload retrieval | 308 | 308 |
| Revised Davis first page, including payload retrieval | 230 | 230 |

These totals cover event retrieval, not other page queries such as cache revision and participant names. The revised lookup issues one batch for active IDs, one ordered future lookup and a payload lookup. The first 25 IDs matched the reference query at both dataset sizes. Deep numbered pages still traverse earlier results; this comparison establishes first-page behavior for this fixture, not a universal fixed cost or production capacity. Derived time windows trade storage and write work for bounded lookup streams.

The final local 450-organization/2,400-event fixture returned 41 rows for the homepage, 93 for Events and 140 for the archive, including the small ID streams. Full responses remained 45,383, 36,484 and 67,817 bytes. Single-run local uncached times were 37, 23 and 25 ms. Cache hits still used one revision row. These replace the initial indexed implementation's local figures above.

Local signed-in browser acceptance used 650 fictional organization profiles. Organization 649 was found through scope search, assigned to an event, and retained after saving/reopening. It was also found in access search and retained as an affiliation after saving/reopening. Scope page controls worked. Server tests separately verify cross-region denial and selected-ID lookup scope.

Hosted staging acceptance on Worker `366d5046-9707-42b4-b280-1822fb28e950` verified 25-card upcoming pages without overlap, regional separation, city filtering, archive retrieval, an individual calendar download and cache MISS/HIT. Cleanup and final integrity results are recorded in the deployment guide. Production is unchanged.
