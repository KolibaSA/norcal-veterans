import { origin } from '../../shared/public-shell.mjs';

const oneLine = value => String(value || '').replace(/\s+/g, ' ').trim();

function concise(text, limit = 210) {
  if (text.length <= limit) return text;
  const words = text.slice(0, limit).replace(/\s+\S*$/, '').trimEnd();
  return `${words || text.slice(0, limit).trimEnd()}…`;
}

export function organizationSeo(record, ownLogo) {
  const pageUrl = `${origin}/organizations/${record.id}`;
  const place = record.city ? `${record.city}, CA` : `${record.location_county} County, CA`;
  const summary = oneLine(record.member_information);
  const description = concise(`${record.verified_name} in ${place}. ${summary}`);
  const organization = {
    '@type': 'Organization',
    '@id': `${pageUrl}#organization`,
    name: record.verified_name,
    description: concise(summary, 500),
    mainEntityOfPage: pageUrl
  };
  // Generic national emblems are displayed as navigation artwork, not claimed as local logos.
  if (ownLogo?.src?.startsWith('/')) organization.logo = origin + ownLogo.src;
  return {
    description,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': pageUrl, name: record.verified_name, description, mainEntity: { '@id': organization['@id'] } },
        organization
      ]
    }
  };
}
