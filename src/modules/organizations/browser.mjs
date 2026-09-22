import { esc, label, dateLabel } from '../../shared/browser-ui.mjs';
import { createRecordFeature } from '../../shared/browser-records.mjs';
import { joined, splitList } from '../../shared/browser-ui.mjs';
import { VFW_8151_ID, meetingPlanFields, meetingPlansFromFields } from './meeting-plans.mjs';

export function organizationFields(record = {}) {
  const p = record.payload ?? {};
  return {
    city: p.city ?? '', county: p.location_county ?? '', type: p.organization_type ?? '',
    relationshipType: p.relationship_type ?? 'independent', affiliatedWith: p.affiliated_with_id ?? '',
    website: p.public_contacts?.website ?? '', phone: p.public_contacts?.phone ?? '', publicEmail: p.public_contacts?.email ?? '',
    address: p.address?.text ?? '', addressType: p.address?.type ?? '', mapEligible: p.address?.map_eligible === true,
    serviceCounties: joined(p.service_area?.counties), serviceCities: joined(p.service_area?.cities),
    serviceCategories: joined(p.service_categories), serviceNotes: p.service_area?.notes ?? '', referralNotes: p.referral_notes ?? '',
    sourceIds: joined(p.source_ids), reviewSource: p.review_source_url ?? '', verifiedDate: p.last_verified_date?.slice(0, 10) ?? '',
    confirmationDate: p.organization_confirmed_at?.slice(0, 10) ?? '', confirmationSource: p.confirmation_source_url ?? ''
, reviewNotes: p.review_notes ?? '', ...meetingPlanFields(record)
  };
}
export function organizationPayload(fields, previous = {}) {
  const p = structuredClone(previous);

    Object.assign(p, {
      verified_name: fields.recordTitle, member_information: fields.recordBody,
      city: fields.city, location_county: fields.county, organization_type: fields.type,
      relationship_type: fields.relationshipType || 'independent',
      affiliated_with_id: fields.relationshipType && fields.relationshipType !== 'independent' ? fields.affiliatedWith || null : null,
      public_contacts: { ...p.public_contacts, website: fields.website, phone: fields.phone, email: fields.publicEmail },
      address: fields.address ? { ...p.address, text: fields.address, type: fields.addressType, map_eligible: fields.mapEligible && fields.addressType !== 'mailing' } : null,
      service_area: { ...p.service_area, counties: splitList(fields.serviceCounties), cities: splitList(fields.serviceCities), notes: fields.serviceNotes },
      service_categories: splitList(fields.serviceCategories), referral_notes: fields.referralNotes,
      source_ids: splitList(fields.sourceIds), review_source_url: fields.reviewSource,
      last_verified_date: fields.verifiedDate || null, confirmation_source_url: fields.confirmationSource,
      organization_confirmed_at: fields.confirmationDate
        ? (previous.organization_confirmed_at?.slice(0, 10) === fields.confirmationDate ? previous.organization_confirmed_at : fields.confirmationDate + 'T00:00:00.000Z') : null,
      review_notes: fields.reviewNotes
    });
  if (fields.meetingPlannerOrganization === VFW_8151_ID) {
    p.meeting_plans = meetingPlansFromFields(fields, previous);
    p.meeting_schedule = "See the annual meeting schedule below for each month's date and social and meeting times.";
  }
  return p;
}
export function createFeature() {
  return createRecordFeature({ kind: 'organization', title: 'Organization profiles', editorLabel: 'organization',
    statuses: ['draft', 'published', 'archived'], editorSections: ['organizationFields', 'vfwMeetingPlanner', 'reviewFields'],
    fields: organizationFields, payload: organizationPayload,
    saveLabel: record => record.id === VFW_8151_ID ? 'Save profile and meeting schedule' : 'Save item',
    savedMessage: value => value.organization_id === VFW_8151_ID ? 'VFW Post 8151 profile and meeting schedule published.' : 'Saved.',
    configureEditor({ $, record, values }) {
      const postPlanner = record.id === VFW_8151_ID;
      $('vfwMeetingPlanner').hidden = !postPlanner;
      $('meetingPlanYear').required = postPlanner;
      const organizations = JSON.parse($('org').dataset.organizationOptions || '[]').filter(option => option.id !== record.id);
      $('affiliatedOrganizationOptions').innerHTML = organizations.map(option => '<option value="' + esc(option.id) + '" label="' + esc(option.title) + '"></option>').join('');
      const independent = values.relationshipType === 'independent';
      $('affiliatedWithField').hidden = independent;
      $('affiliatedWith').required = !independent;
      const validParent = independent || organizations.some(option => option.id === values.affiliatedWith);
      $('affiliatedWith').setCustomValidity?.(validParent ? '' : 'Choose an existing organization.');
      const priorAddressType = record.payload?.address?.type;
      if (priorAddressType && !Array.from($('addressType').options).some(option => option.value === priorAddressType)) {
        $('addressType').add(new Option(label(priorAddressType) + ' (existing; not a verified public venue)', priorAddressType));
      }
      $('org').disabled = true;
    },
    connect(context) {
      const { $ } = context;
      const updateRelationship = () => {
        const independent = $('relationshipType').value === 'independent';
        $('affiliatedWithField').hidden = independent;
        $('affiliatedWith').required = !independent;
        if (independent) $('affiliatedWith').value = '';
        const options = JSON.parse($('org').dataset.organizationOptions || '[]');
        const valid = independent || options.some(option => option.id === $('affiliatedWith').value && option.id !== context.editing?.id);
        $('affiliatedWith').setCustomValidity?.(valid ? '' : 'Choose an existing organization.');
      };
      $('relationshipType').onchange = updateRelationship;
      $('affiliatedWith').oninput = updateRelationship;
      $('addressType').onchange = () => { if ($('addressType').value === 'mailing') $('mapEligible').checked = false; };
      $('meetingPlanYear').onchange = () => {
        const record = context.editing;
        if (record?.id !== VFW_8151_ID) return;
        const values = meetingPlanFields(record, Number($('meetingPlanYear').value));
        for (const [id, value] of Object.entries(values)) if ($(id) && id !== 'meetingPlanYear') $(id).value = value;
      };
      return { initialize(metadata) {
        $('countyOptions').innerHTML = metadata.counties.map(value => '<option value="' + esc(value) + '"></option>').join('');
        $('typeOptions').innerHTML = metadata.organizationTypes.map(value => '<option value="' + esc(value) + '"></option>').join('');
        $('addressType').innerHTML = '<option value="">Not recorded</option>' + metadata.addressTypes.map(value => '<option value="' + esc(value) + '">' + esc(label(value)) + '</option>').join('');
      } };
    },
    afterSave: context => context.refreshScopeOptions()
  });
}
export async function loadScopeOptions(api, select) {
  const organizations = await api('records?kind=organization');
  const options = organizations.map(org => ({ id: org.id, title: org.title }));
  const families = [...new Set(organizations.map(org => org.payload?.organization_type).filter(Boolean))].sort();
  select.dataset.organizationOptions = JSON.stringify(options);
  select.dataset.organizationFamilies = JSON.stringify(families);
  select.innerHTML = '<option value="">Region-wide</option>' + options.map(org => '<option value="' + esc(org.id) + '">' + esc(org.title) + '</option>').join('');
}
