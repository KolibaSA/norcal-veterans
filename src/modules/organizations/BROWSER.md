# organizations: browser contract

HQ organization field mapping, public contact/address/service-area editing, source/confirmation evidence, organization scope options and lifecycle.

The public meeting schedule and the list of information still to confirm can be edited with the other source-reviewed profile fields. These do not create calendar events.

The public directory automatically fills all matching organization cards into one continuous listing. `public/app.js` follows bounded directory queries, merges their cards into the existing category/type groups and updates counts, without showing page controls. Each card has a stable organization ID for deduplication. Failed loads offer a retry; ordinary page links remain the fallback without JavaScript. `src/site.mjs` owns the markup and the existing group/city ordering.

Card text must clear the existing logo area. Branded-card headings reserve the logo's horizontal space; cards narrower than 300 pixels place their title below the emblem. Keep official artwork, logo sizing and logo positioning unchanged when adjusting text. Check long post/detachment names in both the directory and nearby cards at phone, tablet and desktop widths.

Detachment 627 (`mcl-yolo`) keeps its branded banner and displays the fixed `https://www.yolomarines.org/` website at full browser width beneath it instead of the standard profile panels. An accessible, sandboxed frame includes a full-website link and expands to the complete page height through an origin- and source-checked message exchange; the existing NorCal upcoming-event list and collapsed profile source evidence remain below. Other organizations retain their standard profiles. The Worker permits that frame origin only on a successful canonical MCL 627 page, preserving HQ and all other page policies. When testing, verify that the external site still permits framing, its mobile layout loads, outbound links open separately, the events shortcut works, and fallback website links remain usable. `public/assets/mcl-website.js` owns the parent handshake and height listener. See [the companion-site contract](../../../docs/mcl-website-integration.md) before releasing this integration.

Relationship editing uses `relationshipType` and the searchable `affiliatedWith` datalist. The saved parent value is an existing organization ID, not a display name; independent organizations clear that parent field.

When the opened record is exactly `vfw-ca-8151`, `editor.html` also reveals the twelve-card meeting planner. `meeting-plans.mjs` maps its fixed month/time controls into the organization payload; all other organization records receive blank hidden planner fields and preserve their existing payload unchanged.

`browser.mjs` exports `createFeature()`, `organizationFields(record)`, `organizationPayload(fields, previous)` and `loadScopeOptions(api, select, controls?)`. `editor.html` owns organization markup. The scope picker requests 25 names/IDs per page through the server-scoped `scope_options=1` records interface. Search and Previous/More controls can reach organizations beyond the old 500-record cutoff. Opening an editor separately retrieves its saved organization and parent IDs so a filtered page cannot clear a saved assignment. Affiliation suggestions use the same server search. The shared browser-records helper supplies the HTTP query contract to organization and access consumers.

Owns organization payload fields while preserving unknown provenance and private imported fields. Mailing addresses never become eligible for directions. Existing confirmation timestamps survive unchanged when the displayed date is unchanged.

Dependencies: Shared record controls and injected scope-refresh callback. Exposes escaped scope options for the shell and metadata controls for shared county choices. Uses the common publishing eligibility helper; permission administration internals are not needed.

Focused checks: `node scripts/run-tests.mjs --module organizations`. Browser coverage: source evidence preservation, mailing-address restrictions, confirmation timestamps, escaped scope IDs and labels. Wider release checks remain required before publication.

For routine changes, start here and in this module. Read the shared browser contract only when the change affects a shared editor/navigation behavior. Other modules are entered through their supported runtime entry point, never a private controller.
