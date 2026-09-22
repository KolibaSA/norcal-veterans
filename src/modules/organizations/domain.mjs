import { sources } from '../../data.mjs';
import { text, strings, shape, publicURL, present, object, invalid } from '../../shared/validation.mjs';
import { validatePublicContent } from '../../shared/content-validation.mjs';
import { validatePayload } from '../../shared/record-validation.mjs';
import { validateMeetingPlans } from './meeting-plans.mjs';

export const organizationMetadata = Object.freeze({
  organizationTypes: ['VFW', 'American Legion', 'Marine Corps League', 'Veterans Beer Club', 'Toys for Tots', 'DAV', 'County Veterans Office', 'Equine program provider', 'Veteran remembrance program', 'Veterans nonprofit', 'Other veteran organization'],
  relationshipTypes: ['independent', 'auxiliary', 'sons'],
  counties: ['Yolo', 'Solano'],
  addressTypes: ['meeting_venue', 'service_office', 'program_venue', 'mailing']
});

export function validateOrganization(input, options = {}) {
  return validatePayload(input, options, (p, { previousPayload: previous = null, status = 'draft', isNew = false }) => {
    validatePublicContent(p, previous);
    const relationshipType = p.relationship_type ?? 'independent';
    if (!organizationMetadata.relationshipTypes.includes(relationshipType)) invalid('Choose Independent Organization, Auxiliary, or Sons.');
    text(p.affiliated_with_id, 'Affiliated organization ID', 120);
    if (relationshipType !== 'independent' && !/^[-_a-zA-Z0-9]{1,120}$/.test(p.affiliated_with_id || '')) invalid('Choose an existing organization to affiliate with.');
    if (relationshipType === 'independent' && present(p.affiliated_with_id)) invalid('Independent organizations cannot have an affiliated organization.');
    if (p.id && p.affiliated_with_id === p.id) invalid('An organization cannot be affiliated with itself.');
    for (const name of ['service_categories', 'source_ids', 'missing_data_flags']) strings(p[name], name);
    if (p.source_ids?.some(id => !sources.some(source => source.id === id)) && JSON.stringify(p.source_ids) !== JSON.stringify(previous?.source_ids)) invalid('Choose existing source references or add a public review source URL.');
    shape(p.service_area, 'Service area');
    if (p.service_area) { strings(p.service_area.counties, 'Service counties'); strings(p.service_area.cities, 'Service cities'); text(p.service_area.notes, 'Service area notes', 4000); }
    shape(p.address, 'Address');
    if (p.address) {
      text(p.address.text, 'Public address', 1000);
      if (!organizationMetadata.addressTypes.includes(p.address.type) && JSON.stringify(p.address) !== JSON.stringify(previous?.address)) invalid('Choose a public venue, service office or mailing address. Residential and personal addresses cannot be published.');
      if (p.address.map_eligible !== undefined && typeof p.address.map_eligible !== 'boolean') invalid('Address map eligibility must be true or false.');
    }
    shape(p.public_contacts, 'Public contacts');
    if (p.public_contacts) {
      publicURL(p.public_contacts.website, 'Organization website');
      text(p.public_contacts.phone, 'Organization phone', 80);
      text(p.public_contacts.email, 'Organization email', 254);
      if (present(p.public_contacts.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.public_contacts.email)) invalid('Enter a valid public organization email.');
    }
    shape(p.event_information, 'Event information');
    if (p.event_information) { text(p.event_information.text, 'Event information', 4000); text(p.event_information.status, 'Event information status', 80); text(p.event_information.source_id, 'Event information source', 200); }
    for (const name of ['timezone', 'confidence', 'verification_method', 'officers_status']) text(p[name], name, 120);
    for (const name of ['photos', 'officers', 'officer_profiles']) if (present(p[name])) {
      if (!Array.isArray(p[name]) || p[name].length > 50 || p[name].some(item => !object(item))) invalid(`${name} must be a list of at most 50 objects.`);
    }
    validateMeetingPlans(p.meeting_plans, p.id);
    for (const photo of p.photos || []) {
      for (const key of ['id', 'src', 'image_url', 'source_url', 'license_url', 'caption', 'alt_text', 'credit', 'license']) text(photo[key], 'Photo ' + key, 2000);
      shape(photo.album, 'Photo album');
      if (photo.album) for (const key of ['id', 'name', 'description']) text(photo.album[key], 'Photo album ' + key, 2000);
      if (present(photo.present_organizations) && (!Array.isArray(photo.present_organizations) || photo.present_organizations.length > 12 || photo.present_organizations.some(item => !object(item) || typeof item.id !== 'string' || typeof item.name !== 'string'))) invalid('Photo organizations must contain at most 12 organization IDs and names.');
    }
    if (status === 'published' && (isNew || previous?.organization_type || previous?.location_county)) {
      if (!p.organization_type?.trim() || !p.location_county?.trim()) invalid('Choose an organization type and county before publication.');
    }

  });
}

export const recordDefinition = Object.freeze({ kind: 'organization', statuses: ['draft', 'published', 'archived'], validate: validateOrganization, organizationId: id => id });
