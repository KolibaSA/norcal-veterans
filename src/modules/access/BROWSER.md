# access: browser contract

Owner-only organization/region assignment administration and revocation.

`browser.mjs` exports `createFeature()` and `connectAccess(context)`; its controller owns access markup, form handling and scope payloads.

Owns administrator assignment form state. POST sends one selected region_id or organization_id. DELETE revocation requires the existing confirmation. Server authorization remains authoritative on every action.

Dependencies: Injected HTTP/message/section refresh interface and shared escaped labels. Other features use common authorization interfaces and need not inspect this administration screen.

Focused checks: `node scripts/run-tests.mjs --module access`. Browser coverage: non-owner denial before fetch, selected-scope payload, escaped assignment labels and stale section response. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
