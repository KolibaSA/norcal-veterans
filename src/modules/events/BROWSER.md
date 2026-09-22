# events: browser contract

HQ event field mapping, Pacific wall-time display, date-only controls, source evidence, required inputs and event lifecycle.

`browser.mjs` exports `createFeature()`, `eventFields(record)`, `eventPayload(fields, previous)`, `pacificInput(value, dateOnly)` and `updateDateFields($)`. `editor.html` owns event markup.

Owns event payload fields and preserves unknown imported fields. Pacific time uses America/Los_Angeles. Date-only events deliberately clear timed endings. The Additional event dates control adds or removes calendar dates on the same record; every extra date inherits the first occurrence's time, duration, location and event details. Optional Volunteer Now and Donate Now controls preserve an enable flag plus an HTTPS destination. Review dates remain blank unless supplied; public filtering and authoritative validation remain server responsibilities.

Dependencies: Shared record controls. The app initializes county choices through the Organizations supported lookup interface; routine event changes do not require opening organization editor code.

Focused checks: `node scripts/run-tests.mjs --module events`. Browser coverage: winter/summer wall time, UTC day boundaries, payload preservation, additional-date sorting, date-only conversion and required-control cleanup. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
