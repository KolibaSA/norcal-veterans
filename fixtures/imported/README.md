# Imported source application — reference only

The original separate Yolo HQ deployment configuration is retained as
`wrangler.hq.jsonc.txt`. Its text extension prevents selecting it accidentally
as a Wrangler deployment configuration. Its database and storage are not the
NorCal project and must not be deployed or migrated as part of NorCal work.

The source application's `src/hq.mjs`, `public/hq.js`, root migrations and
generated `dist/*` remain regression fixtures at their existing paths because
their tests and shared public modules reference them. They are not production
entry points. `npm run test:active` identifies tests for the deployed NorCal
Worker and embedded HQ; `npm test` also runs preserved imported regressions.

Production uses `wrangler.jsonc`; isolated write testing uses
`wrangler.staging.jsonc`. Both execute `src/norcal-worker.mjs` and only the
`migrations/legacy` schema. The HQ source is split into HTML, CSS and a client
module under `worker/legacy`, with the generated template built automatically.
