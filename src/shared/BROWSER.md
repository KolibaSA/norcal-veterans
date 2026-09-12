# Shared HQ browser contract

The application composition in `src/app/hq-browser.mjs` passes a registry to `startBrowserRuntime` in `browser-runtime.mjs`. `src/app/hq-registry.mjs` is the feature map and preserves the legacy pure-helper interface; it contains no feature editor rules. The compatibility entry is `worker/legacy/hq-client.mjs`.

The runtime owns startup, identity, navigation/URL and load sequencing, generic record lists, the common editor frame, focus restoration, unsaved-change prompts, optimistic-conflict comparison, and common record persistence. Feature descriptors/controllers own their rules, custom fields, markup, actions, and state. The runtime has no feature-name switch.

`browser-records.mjs` supplies the common record descriptor factory. Its inputs are a kind, title, statuses and optional field/payload/editor/lifecycle hooks. It returns a new instance with independent `{ rows, filter }` state, common form mapping, a kind-scoped `list(api)` interface, publishing eligibility and descriptor overrides. Each feature declares its own lifecycle and overrides only behavior it owns. Every save is still authorized and validated by the server.

Supported descriptor members:

- Identity and presentation: `kind`, `title`, `editorLabel`, `heading`, `newLabel`, `statuses`, `editorSections`.
- Rules and values: `fields(record)`, `payload(fields, previous)`, `canCreate(me)`, `canEdit(me, record)`, `statusesFor(me, record)`, `saveLabel(record)`, `savedMessage(record)`, `notice(me, record, editable)`.
- Editor setup: `configureEditor({ $, record, values })` runs before canonical values are assigned, including before restoring a conflict draft. Input types must be set before assigning dates.
- Lifecycle: `connect(context)` returns a controller; `afterSave(context)` can refresh a supported shared lookup.

The injected controller context exposes `$`, `api`, `itemURL`, `message`, `permitLeave`, `openRecord`, `loadSection`, `navigate`, `openDraft(kind, draft, source)`, `markClean()` and `refreshScopeOptions()`. The current `editing`, `me`, and `tab` properties are read-only getters. Controllers own their private state and must not mutate another feature's editor or registry state.

Controller hooks are optional: `initialize(metadata)`, `initialized()`, `sectionChanged()`, `sectionLoaded()`, `resetEditor()`, `editorOpened(record, { source, editable })`, `editorClosed()`, and `dirty()`. A non-record screen supplies `render({ isCurrent })` and must check `isCurrent()` after asynchronous reads. Editor extensions check the current record ID before painting an asynchronous response. Dirty hooks preserve non-record drafts such as request comments.

`browser-http.mjs` only encodes transport, response errors and FormData headers. Feature API paths/payloads live in modules. `browser-ui.mjs` holds reusable escaping, labels, dates, list search and the common publishing eligibility interface; administration UI code is not required to use that interface.

The build expands owned HTML/CSS partials and bundles the browser entry into the existing inline module script. The CSP hash must use the final script bytes. The synthetic `/hq` fixture verifies actual browser startup, navigation, draft conflicts and native focus/date behavior; the focused module suites verify feature contracts without importing other feature implementations.
