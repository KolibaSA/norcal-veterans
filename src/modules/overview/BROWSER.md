# overview: browser contract

HQ summary counts and the Open Requests navigation action.

`browser.mjs` exports `createFeature(sources)`. Sources are the Requests, Project Work and Organizations supported list interfaces, injected by app composition. `browser.css` owns summary cards.

Computes only counts from feature lists. Completed/closed/cancelled requests and completed/closed project work do not count as open. Does not display private request instructions.

Dependencies: Supported list interfaces passed by the shell, shared API adapter and injected navigation; no cross-feature implementation imports.

Focused checks: `node scripts/run-tests.mjs --module overview`. Browser coverage: summary status counts, private body exclusion and stale section response. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
