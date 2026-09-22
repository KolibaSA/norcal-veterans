# Events

Owns event editing, publication, Pacific date/time rules, public rendering/calendar output and typed event privacy. Owned rows: `records(kind=event)`, retaining existing organization links and provenance.

`domain.mjs` exports `validateEvent`, `timeZone` and the record contract; `public.mjs` owns public rendering/calendar/serialization. Date-only entries start at Pacific midnight; spring gaps and new ambiguous autumn times are rejected, while an existing explicit instant can disambiguate unchanged content. Shared time and provenance utilities contain no event editor state.

Run `npm run test:module -- events`. Wider compatibility is covered by `scripts/norcal-content.test.mjs`, `scripts/public-calendar.test.mjs` and privacy regression tests.

Public entry points in `public.mjs`:

- `sanitizePublicEvent(payload)` returns a whitelisted event or null for invalid stored dates/required fields. `publicEventRecord(row, payload)` maps the existing records envelope, retaining explicit organization assignment precedence.
- Organization meetings may expose up to three ordered `meeting_times` entries with a wall time and public label. The shared event card renders every entry while retaining the first time as the event/calendar start.
- Editors can add up to 30 additional dates to one event. The first date/time remains the canonical `start_at`; validated `additional_occurrences` inherit its Pacific time, duration, location and event details. Public cards, detail pages and ICS downloads treat them as one event with multiple occurrences, prune past dates independently, and return to the single-date presentation when one occurrence remains.
- `organizationUpcomingEvents(events, organizationId, now?, organizations?)` renders every organization's published events through the same core card used by the main Events page. It supplies the host organization's established theme family, name and identifying number. VFW Post 8151 community occurrences are grouped by normalized title, organization and location after past occurrences are removed; multiple future dates reuse one extended shared card and a lone remaining date returns to the standard single-date card. The shared Events page omits regular `Organization meeting` entries.
- All organizations use the standard single-page public profile. American Legion profiles retain their Legion palette and background treatment within that layout; Detachment 627 retains its logo and colors. New organization types default to the same single-page profile.
- `upcomingEvents(events, now?)` filters/sorts published events by their earliest remaining occurrence; `eventCalendar(events)` emits one calendar occurrence per date, including date-only entries.
- `eventsPagePublic(url, events, organizations = [])` and `eventDetail(event, organizations = [])` return page HTML. The public index and organization profiles share one compact event-card component. It uses an organization-provided HTTPS image or a simple event-specific fallback graphic and applies the host organization's established VFW, Legion, Marine Corps League, Toys for Tots, beer-club, DAV, county-service, equine, remembrance, nonprofit or community visual language. Accepted invited organizations can be supplied through `accepted_organization_ids` and are the only partners listed on the card.
- Optional Volunteer, Donate and Buy Tickets actions use an enable flag plus an HTTPS-only URL. All three actions render only on VFW Post 8151 Upcoming Events cards when their matching URL is present, and their compact one-row treatment does not change the card height.
- `publicMonthCalendar(url, events, options)` renders the month view; `calendarMilestones(year)` supplies its existing milestones. Calendar implementation stays private in `calendar.mjs`, and page implementation in `presentation.mjs`.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Events are the only generic HQ record type that opts into hard deletion. DELETE requires a same-origin request, current version, and current write permission (publishing permission for a published event). The final event snapshot and delete audit entry remain in immutable history; events with attachments must have those attachments removed first.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
