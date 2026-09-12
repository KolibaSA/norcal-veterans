import { present, text, shape, invalid, canonicalDate, canonicalInstant, publicURL } from './validation.mjs';

function reviewDate(value, name) { if (present(value)) { canonicalDate(value); if (value > new Date().toISOString().slice(0, 10)) invalid(`${name} cannot be in the future.`); } }
export function provenance(p, previous) {
  for (const name of ['source_checked', 'last_verified_date']) reviewDate(p[name], name);
  for (const name of ['source_url', 'review_source_url', 'confirmation_source_url']) publicURL(p[name], name);
  for (const name of ['reviewed_by', 'review_recorded_at']) {
    text(p[name], name, 254);
    if (present(p[name]) && p[name] !== previous?.[name]) invalid('The source reviewer is recorded by the server.');
  }
  if (present(p.source_kind) && !['public_source', 'project_team'].includes(p.source_kind)) invalid('Choose public source or project team provenance.');
  if (present(p.source_checked) && !p.source_url && !(p.source_checked === previous?.source_checked && !previous?.source_url)) invalid('A source review date requires the event source URL.');
  // Existing imported source dates are retained, including sources withheld for
  // privacy. A new or changed claim requires evidence; no global date is added.
  if (present(p.last_verified_date) && !(p.review_source_url || p.source_ids?.length) && p.last_verified_date !== previous?.last_verified_date) invalid('Add a review source URL or source references before recording an organization review date.');
  if (present(p.organization_confirmed_at)) {
    canonicalInstant(p.organization_confirmed_at);
    if (Date.parse(p.organization_confirmed_at) > Date.now()) invalid('Organization confirmation cannot be in the future.');
    if (!p.confirmation_source_url && p.organization_confirmed_at !== previous?.organization_confirmed_at) invalid('Organization confirmation requires a public confirmation source.');
  }
  if (present(p.reviewed_update)) {
    shape(p.reviewed_update, 'Reviewed update');
    canonicalInstant(p.reviewed_update.reviewed_at);
    publicURL(p.reviewed_update.source_url, 'Correction source');
    if (!p.reviewed_update.source_url) invalid('A reviewed correction requires its source.');
    if (Date.parse(p.reviewed_update.reviewed_at) > Date.now()) invalid('A correction review date cannot be in the future.');
    if (present(p.reviewed_update.reviewed_by) && p.reviewed_update.reviewed_by !== previous?.reviewed_update?.reviewed_by) invalid('The correction reviewer is recorded by the server.');
  }
  if (present(p.display_name_update)) {
    shape(p.display_name_update, 'Display name update');
    reviewDate(p.display_name_update.date, 'Display name review date');
    text(p.display_name_update.method, 'Display name update method', 100);
    text(p.display_name_update.scope, 'Display name review scope', 2000);
  }
}


export function validatePublicContent(p, previous) {
    for (const name of ['id', 'organization_id', 'region_id']) text(p[name], name, 120);
    for (const name of ['city', 'county', 'location_county', 'organization_type', 'kind', 'entity_kind']) text(p[name], name, 120);
    for (const name of ['title', 'verified_name', 'organizer']) text(p[name], name, 200);
    for (const name of ['description', 'member_information']) text(p[name], name, 20000);
    for (const name of ['audience', 'eligibility', 'hours', 'meeting_schedule', 'referral_notes', 'partnership_notes', 'time_note', 'source_note']) text(p[name], name, 4000);
    provenance(p, previous);
  }

export function recordReviewer(p, previous, actorEmail) {
  const reviewKeys = ['source_checked', 'last_verified_date', 'source_url', 'review_source_url', 'organization_confirmed_at', 'confirmation_source_url'];
  if (actorEmail && reviewKeys.some(key => p[key] !== previous?.[key]) && (p.source_checked || p.last_verified_date || p.organization_confirmed_at)) {
    p.reviewed_by = actorEmail; p.review_recorded_at = new Date().toISOString();
  }
  return p;
}
