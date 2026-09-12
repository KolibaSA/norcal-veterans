# requests: browser contract

Request editing permissions, queue authorization labels and statuses; activity history, comments, interrupted-run reconciliation, and agent health.

`browser.mjs` exports `createFeature()`, `connectRequests(context)` and the compatibility health/permission helpers. `activity.mjs` and `health.mjs` are private controllers; their markup is `activity.html` and `health.html`.

The record form owns title/body/scope/status. Activity keeps its own last history response and unsaved comment/reconciliation inputs. It sends the refreshed exact version/status/run ID and never puts executable instructions in a comment or reconciliation body.

Dependencies: Shared record controls and the injected API/navigation/editor context. No imports from other feature implementations. Health polling cannot change editor fields.

Focused checks: `node scripts/run-tests.mjs --module requests`. Browser coverage: owner/run locks, exact current revisions, reconciliation identity, stale-response isolation, escaped activity, owner-scoped health. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
