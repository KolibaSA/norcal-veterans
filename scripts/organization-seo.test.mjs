import test from 'node:test';
import assert from 'node:assert/strict';
import { records } from '../src/data.mjs';
import { render } from '../src/site.mjs';
import { brandLogos } from '../src/logos.mjs';

const schemaFrom = html => {
  const match = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(match, 'one JSON-LD block in the page head');
  return JSON.parse(match[1]);
};

test('every published organization profile has distinct local metadata and factual Organization markup', () => {
  const descriptions = new Set();
  for (const record of records) {
    const canonical = `https://www.norcalveterans.org/organizations/${record.id}`;
    const html = render(new URL(canonical)).html;
    const meta = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(meta?.includes(record.city || record.location_county), record.id);
    assert.ok(!descriptions.has(meta), `duplicate description: ${record.id}`);
    descriptions.add(meta);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
    const data = schemaFrom(html);
    assert.equal(data['@context'], 'https://schema.org');
    const [page, organization] = data['@graph'];
    assert.equal(page['@type'], 'WebPage');
    assert.equal(page['@id'], canonical);
    assert.equal(organization['@type'], 'Organization');
    assert.equal(organization.name, record.verified_name);
    assert.equal(organization.mainEntityOfPage, canonical);
    assert.equal(organization.logo, brandLogos[record.id]?.src ? `https://www.norcalveterans.org${brandLogos[record.id].src}` : undefined);
    assert.ok(!('address' in organization) && !('telephone' in organization), record.id);
  }
  assert.equal(descriptions.size, records.length);
});

test('organization JSON-LD cannot close its script element with stored text', () => {
  const record = { ...records[0], id: 'seo-safety', verified_name: 'Example </script><script>alert(1)</script>', member_information: 'Public profile.' };
  const html = render(new URL('https://www.norcalveterans.org/organizations/seo-safety'), [record]).html;
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  const data = schemaFrom(html);
  assert.equal(data['@graph'][1].name, record.verified_name);
});
