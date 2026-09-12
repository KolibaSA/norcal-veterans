# coordination: browser contract

Coordination records, draft/active/archived lifecycle and feature-local list/filter state.

`browser.mjs` exports `createFeature()`; the descriptor delegates common record fields/list/editor mechanics to shared controls.

Owns coordination title/body/scope/status and its filter/loaded-record state. Preserves existing payload fields.

Dependencies: Shared record controls and injected API only. Other feature implementations are not required for ordinary coordination changes.

Focused checks: `node scripts/run-tests.mjs --module coordination`. Browser coverage: independent state, lifecycle, payload preservation and kind-scoped reads. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
