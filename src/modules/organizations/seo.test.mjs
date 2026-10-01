import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationSeo } from './public.mjs';

test('organization SEO uses listed place and visible summary without inventing contact or service claims', () => {
  const record = {
    id: 'example-post', verified_name: 'Example Veterans Post', city: 'Dixon', location_county: 'Solano',
    member_information: 'Local veterans gather monthly. Contact the post for current details.',
    address: { type: 'meeting_venue', text: 'A shared hall' },
    public_contacts: { phone: '555-0100', website: 'https://parent.example/' }
  };
  const { description, structuredData } = organizationSeo(record);
  assert.match(description, /Example Veterans Post in Dixon, CA/);
  assert.match(description, /Contact the post for current details/);
  const [page, organization] = structuredData['@graph'];
  assert.equal(page.mainEntity['@id'], organization['@id']);
  assert.equal(organization.mainEntityOfPage, 'https://www.norcalveterans.org/organizations/example-post');
  assert.equal(organization.description, record.member_information);
  for (const field of ['address', 'telephone', 'url', 'sameAs', 'email', 'logo']) assert.ok(!(field in organization), field);
});

test('only an organization-specific logo is identified as that local organization’s logo', () => {
  const record = { id: 'local-chapter', verified_name: 'Local Chapter', location_county: 'Yolo', member_information: 'Community gatherings.' };
  const data = organizationSeo(record, { src: '/logos/local-chapter.png' }).structuredData['@graph'][1];
  assert.equal(data.logo, 'https://www.norcalveterans.org/logos/local-chapter.png');
  assert.ok(!('logo' in organizationSeo(record, { src: 'data:image/svg+xml,placeholder' }).structuredData['@graph'][1]));
});

test('long published summaries do not duplicate an unbounded page body in JSON-LD', () => {
  const record = { id: 'long-profile', verified_name: 'Long Profile', city: 'Davis', location_county: 'Yolo', member_information: 'Veteran program details. '.repeat(900) };
  const seo = organizationSeo(record);
  assert.ok(seo.description.length <= 211);
  assert.ok(seo.structuredData['@graph'][1].description.length <= 501);
});
