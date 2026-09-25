# requests: browser contract

Request editing permissions, queue authorization labels and statuses; activity history, comments, interrupted-run reconciliation, and agent health.

The agent is retired. In the deployed configuration `processorConnected=false` suppresses agent-health UI and polling; Requests, activity and historical-run reconciliation remain. The editor explains manual tracking rather than promising automatic execution.

`browser.mjs` exports `createFeature()`, `connectRequests(context)` and the compatibility health/permission helpers. `activity.mjs` and `health.mjs` are private controllers; their markup is `activity.html`, `editor.html` and `health.html`.

The record form owns title/body/scope/status. Activity keeps its own last history response and unsaved comment/reconciliation inputs. It sends the refreshed exact version/status/run ID and never puts executable instructions in a comment or reconciliation body.

Dependencies: Shared record controls and the injected API/navigation/editor context. No imports from other feature implementations. Health polling cannot change editor fields.

The request editor opens automatically at the top of the Requests section. Its target selector is stored in the request payload, and organization-family choices are represented separately from a specific organization scope. Focused checks: `node scripts/run-tests.mjs --module requests`. Browser coverage: platform-admin/run locks, exact current revisions, reconciliation identity, stale-response isolation, escaped activity, platform-admin health. Wider release checks remain required before publication.

New requests start without a region or organization restriction. Selecting Headquarters clears previous scope selections and shows “Entire HQ”; “Limit to a region or organization” reveals optional scope controls. Public website always shows those controls. Let Chat decide makes scope optional. Clearing the optional limit resets region to `all`, organization to null, and removes any organization-family payload scope. Saved requests retain their fixed scope when reopened or retargeted; this change does not migrate existing records.

Requests owns the scope checkbox, target-change handlers, and visibility logic in `browser.mjs` / `editor.html`. The generic form supplies `regionField` and `organizationScopeField` wrappers; Requests restores their visibility on section changes so other editors are unaffected. Tests cover target transitions, optional limits, exact save bodies, saved scope preservation, and navigation cleanup. Browser acceptance must also create and reopen an Entire HQ request and a limited request through the actual form.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
