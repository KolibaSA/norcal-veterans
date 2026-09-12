# project-work: browser contract

Project work records, open/in-progress/completed/closed lifecycle and feature-local list/filter state.

`browser.mjs` exports `createFeature()`; the descriptor owns task behavior and delegates common record fields/list/editor mechanics to shared controls.

Owns kind=task title/body/scope/status and its filter/loaded-record state. Preserves unknown payload fields when saving existing items.

Dependencies: Shared record controls and injected API only. Requests execution code and public content editors are not required for ordinary project work changes.

Focused checks: `node scripts/run-tests.mjs --module project-work`. Browser coverage: independent state, draft lifecycle, payload preservation and kind-scoped list reads. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
