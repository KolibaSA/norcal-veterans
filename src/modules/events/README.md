# Events

Owns event editing, publication, Pacific date/time rules, public rendering/calendar output and typed event privacy. Owned rows: `records(kind=event)`, retaining existing organization links and provenance.

`domain.mjs` exports `validateEvent`, `timeZone` and the record contract; `public.mjs` owns public rendering/calendar/serialization. Date-only entries start at Pacific midnight; spring gaps and new ambiguous autumn times are rejected, while an existing explicit instant can disambiguate unchanged content. Shared time and provenance utilities contain no event editor state.

Run `npm run test:module -- events`. Wider compatibility is covered by `scripts/norcal-content.test.mjs`, `scripts/public-calendar.test.mjs` and privacy regression tests.

Public entry points in `public.mjs`:

- `sanitizePublicEvent(payload)` returns a whitelisted event or null for invalid stored dates/required fields. `publicEventRecord(row, payload)` maps the existing records envelope, retaining explicit organization assignment precedence.
- Organization meetings may expose up to three ordered `meeting_times` entries with a wall time and public label. Post 8151's upcoming-event cards render every entry while retaining the first time as the event/calendar start.
- `organizationUpcomingEvents(events, organizationId, now?)` renders published upcoming cards in date order with a prominent Pacific month/day header and a simple empty state. All current and future organization profiles use this view, including American Legion pages and both Detachment 627 URLs. The shared Events page keeps its calendar, and HQ editing is unchanged.
- All organizations use the standard single-page public profile. American Legion profiles retain their Legion palette and background treatment within that layout; Detachment 627 retains its logo and colors. New organization types default to the same single-page profile.
- `upcomingEvents(events, now?)` filters/sorts published events; `eventCalendar(events)` returns the existing ICS format, including date-only entries.
- `eventsPagePublic(url, events)` and `eventDetail(event, organizations = [])` return page HTML. Supply organization choices only when a related-host link is needed; no organization editor is imported.
- `publicMonthCalendar(url, events, options)` renders the month view; `calendarMilestones(year)` supplies its existing milestones. Calendar implementation stays private in `calendar.mjs`, and page implementation in `presentation.mjs`.

`domain.mjs` exports `recordDefinition` (record kind, allowed statuses and `validate(input, options)`). `src/app/record-definitions.mjs` registers it and supplies mandatory credential sanitization; `src/app/hq-records.mjs` preserves `/api/hq/records` and `/api/hq/records/:id`. There is no feature-specific query hidden in that dispatcher.

Private HTTP handlers receive the shell's verified identity and current grants. `worker/legacy/index.mjs` authenticates every HQ request and checks write origins before dispatch. Shared infrastructure supplies bounded JSON, authorization, D1 transactions, optimistic versions, immutable audit/history and generic record serialization.

See [BROWSER.md](./BROWSER.md) for browser entry points, editor state, markup, actions and focused UI checks.
