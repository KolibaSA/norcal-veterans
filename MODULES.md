# HQ feature map

Start here for a feature change. Open the target module's `README.md` and `BROWSER.md` when present, then its implementation and tests. Follow documented interfaces into dependencies only when the requested behavior or a failing check requires it. Running the full regression suite does not require reviewing every feature's source.

All paths below are relative to this repository. One website, Worker and D1 database serve these modules. The public site and HQ keep their existing behavior and routes.

The 13-feature extraction was completed in `b5f19cc` on September 12, 2026. This map describes the implemented structure. See [README.md](README.md) for project background and subsequent fixes, and [AGENTS.md](AGENTS.md) for permanent rules. Routine feature work should need this small map plus the relevant module, rather than a fresh whole-application review.

| Feature | Module under `src/modules/` | Owns |
| --- | --- | --- |
| Share a Program | [share-program](src/modules/share-program/README.md) | `/share` form, presenter/recipient validation, private program-introduction record contract |
| Requests and Agent Health | [requests](src/modules/requests/README.md) | Request editor, activity, health, approval, execution/recovery policy, HTTP adapter and local runner |
| Overview | [overview](src/modules/overview/README.md) | Summary screen and composition of feature summaries |
| Project Work | [project-work](src/modules/project-work/README.md) | Task statuses, editor and record contract |
| Public Submissions | [submissions](src/modules/submissions/README.md) | Review queue, readable submission details, draft preparation, public update form, protected intake storage |
| Events | [events](src/modules/events/README.md) | Event editor, validation, Pacific dates, public serialization, event pages and calendars |
| Organization Profiles | [organizations](src/modules/organizations/README.md) | Profile editor, taxonomy, locations/service areas, validation, typed public serialization and scope choices |
| Coordination | [coordination](src/modules/coordination/README.md) | Coordination editor, statuses and record contract |
| Ready-to-use Copy | [library](src/modules/library/README.md) | Copy-library editor, statuses and record contract |
| Organization & Region Access | [access](src/modules/access/README.md) | Assignment administration UI and owner-only grant/revoke endpoints |
| Change History and Revisions | [history](src/modules/history/README.md) | Change log, immutable revision display and scoped history endpoints |
| Owner Export | [backup](src/modules/backup/README.md) | Existing owner export navigation and protected export endpoint |
| Attachments | [attachments](src/modules/attachments/README.md) | Attachment interface and existing disabled-upload behavior |

Use `npm run test:module -- share-program` (replace the name with the module directory) for focused tests. `npm run test:active` covers the active application and modules. `npm run build` generates browser assets, enforces architecture, and runs the complete release suite, including imported regression fixtures. Use Node 24 and the existing lockfile.

**Interfaces and shared code**

- `browser.mjs` exposes a feature controller/descriptor to the shell. Its private helpers, fields, actions, styles and markup stay in that module. The generic record editor receives the selected descriptor; it does not switch between feature implementations.
- `domain.mjs` exposes record policy and validation. `server.mjs` exposes the feature HTTP adapter. `public.mjs` exposes anonymous form/rendering/serialization contracts. `requests/node.mjs` is the local runner adapter and must never enter the Worker or browser graph.
- Supported entry files are enforced by `scripts/check-architecture.mjs`. Import another feature through its supported entry, not an internal file. Modules do not import application composition; shared infrastructure does not import feature modules. Dependency cycles are rejected.
- `src/app/` composes features: `hq-browser.mjs` starts HQ, `hq-registry.mjs` lists browser features, `record-definitions.mjs` lists server record contracts, and `hq-records.mjs` dispatches the existing records API. `public-content.mjs` reads published content through feature serializers; `public-intake.mjs` connects public form contracts to private review intake.
- `src/shared/` contains generic browser lifecycle/editor controls, HTTP handling, signed identity and scope enforcement, transactions, validation, common public HTML and privacy primitives. Permission enforcement is separate from Access's grant-administration implementation.
- `worker/legacy/index.mjs` retains authentication and route composition. Other old HQ import paths and the existing runner command remain compatibility facades. Follow them to the module; do not add new feature logic to a facade.

**Example: change Share a Program**

Start with `src/modules/share-program/README.md`, then `public.mjs`, `domain.mjs`, and its focused tests. Organization choices arrive as plain records; no organization editor, Events controller, or access-administration code is needed to change the form. Read `src/app/public-intake.mjs` and the Submissions interface only if changing how a valid introduction enters review. Authentication, generic form handling and the public page shell are documented shared dependencies.

**Preserved boundaries**

The boundary is the feature's responsibility, not just its folder. Keep feature-specific fields, actions, validation and state with that feature. Use shared controls and documented interfaces where appropriate; changes to their contracts can require focused integration work across the affected callers.

The current public directory/profile renderer remains in `src/site.mjs`; it is not needed for a Share a Program edit. Its common page shell was extracted to `src/shared/public-shell.mjs`. Imported application source and root migrations remain regression/recovery references; follow `wrangler.jsonc` to the active Worker and `migrations/legacy` to its schema.

**Example: investigate a Requests save failure**

Start with [Requests](src/modules/requests/README.md) and its browser contract. The request target (`website`, `headquarters`, or `decide`) is stored in `payload.target`; the API record kind remains `request`. The record save body must also include the selected `status`. The September 12 omission of that status was fixed in `c708f52` in `src/shared/browser-runtime.mjs`, with coverage in `src/shared/browser-runtime.test.mjs`.

A save failure can justify following the shared editor into `src/app/hq-records.mjs` and `src/shared/server-records.mjs`. It does not require reading unrelated Organization, Event, or Access implementations. When changing form submission, verify the actual new-item and existing-item save flows, including the values sent to the server; a visible selected option alone does not prove the value was submitted.

Module tests and contract checks support focused work; browser/staging acceptance and the full release gate still apply before publication. Never treat a green test run as evidence that untested production authentication was exercised. See `docs/norcal-deployment.md` for release operations and `scripts/README.md` for build/discovery details.
