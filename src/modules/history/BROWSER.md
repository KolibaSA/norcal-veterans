# history: browser contract

HQ audit listing and the common editor saved-revision timeline.

`browser.mjs` exports `createFeature()` and `connectHistory(context)`. `revisions.html` owns the editor revision section; `browser.css` owns audit table styling.

Reads protected audit and records/:id/history responses. Displays revision title/body/status/payload without mutation. Late history responses only update the still-open record.

Dependencies: Injected API and read-only current-editor context, plus common date/escape utilities. Does not inspect feature payload internals.

Focused checks: `node scripts/run-tests.mjs --module history`. Browser coverage: escaped audit data and revision response isolation. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
