# organizations: browser contract

HQ organization field mapping, public contact/address/service-area editing, source/confirmation evidence, organization scope options and lifecycle.

Relationship editing uses `relationshipType` and the searchable `affiliatedWith` datalist. The saved parent value is an existing organization ID, not a display name; independent organizations clear that parent field.

When the opened record is exactly `vfw-ca-8151`, `editor.html` also reveals the twelve-card meeting planner. `meeting-plans.mjs` maps its fixed month/time controls into the organization payload; all other organization records receive blank hidden planner fields and preserve their existing payload unchanged.

`browser.mjs` exports `createFeature()`, `organizationFields(record)`, `organizationPayload(fields, previous)` and `loadScopeOptions(api, select, controls?)`. `editor.html` owns organization markup. The scope picker requests 25 names/IDs per page through the server-scoped `scope_options=1` records interface. Search and Previous/More controls can reach organizations beyond the old 500-record cutoff. Opening an editor separately retrieves its saved organization and parent IDs so a filtered page cannot clear a saved assignment. Affiliation suggestions use the same server search. The shared browser-records helper supplies the HTTP query contract to organization and access consumers.

Owns organization payload fields while preserving unknown provenance and private imported fields. Mailing addresses never become eligible for directions. Existing confirmation timestamps survive unchanged when the displayed date is unchanged.

Dependencies: Shared record controls and injected scope-refresh callback. Exposes escaped scope options for the shell and metadata controls for shared county choices. Uses the common publishing eligibility helper; permission administration internals are not needed.

Focused checks: `node scripts/run-tests.mjs --module organizations`. Browser coverage: source evidence preservation, mailing-address restrictions, confirmation timestamps, escaped scope IDs and labels. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
