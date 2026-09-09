// Only organization information belongs in public output. A public web source
// does not establish consent to republish a person's contact details.
function isRosterURL(value){
 let decoded=String(value||'');try{decoded=decodeURIComponent(decoded);}catch{/* Check the literal value too. */}
 return /(?:roster|post[-_]?officers|\/officers(?:[/?#.]|$)|post-detail)/i.test(decoded);
}
function assertPublicProfilePrivacy(values){
 if([values.website,values.source_url].some(isRosterURL))throw new Error('Use an organization website or public notice, not a roster or officer directory containing personal information.');
 const text=[values.member_information,values.meeting_schedule].filter(Boolean).join('\n');
 if(/\b(?:member(?:ship)?|post|officer)\s+rosters?\b|\b(?:home|residential|personal)\s+(?:address|phone|mobile|email)\b/i.test(text))throw new Error('Publish organization information only. Remove rosters and personal contact details.');
}
function sanitizePublicPhoto(photo){
 if(!photo||!/^[-_a-zA-Z0-9]{1,100}$/.test(String(photo.id||'')))return null;
 const publicURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!isRosterURL(u.href)?u.href:'';}catch{return '';}};
 const rawImageURL=photo.image_url||(typeof photo.src==='string'&&photo.src.startsWith('https://')?photo.src:'');
 const imageURL=rawImageURL?publicURL(rawImageURL):'';
 if(rawImageURL&&!imageURL)return null;
 const sourceURL=publicURL(photo.source_url);
 const src=imageURL||'/organization-photos/'+encodeURIComponent(photo.id);
 const safeId=value=>/^[-_a-zA-Z0-9]{1,100}$/.test(String(value||''));
 const album=photo.album&&safeId(photo.album.id)?{id:String(photo.album.id),name:String(photo.album.name||'').slice(0,100),description:String(photo.album.description||'').slice(0,500)}:null;
 const present_organizations=Array.isArray(photo.present_organizations)?photo.present_organizations.slice(0,12).filter(item=>safeId(item?.id)&&item?.name).map(item=>({id:String(item.id),name:String(item.name).slice(0,180)})):[];
 return {id:String(photo.id),src,caption:String(photo.caption||'').slice(0,500),alt_text:String(photo.alt_text||photo.caption||'Organization photo').slice(0,300),credit:String(photo.credit||'').slice(0,200),source_url:sourceURL,license:String(photo.license||'').slice(0,160),license_url:publicURL(photo.license_url),album,present_organizations};
}
function sanitizePublicRecord(record){
 const keys=['id','verified_name','organization_type','entity_kind','city','location_county','service_area','hours','meeting_schedule','timezone','service_categories','audience','eligibility','event_information','referral_notes','partnership_notes','member_information','source_ids','last_verified_date','verification_method','organization_confirmed_at','confidence','missing_data_flags','display_name_update','reviewed_update'];
 const out=Object.fromEntries(keys.filter(k=>Object.hasOwn(record,k)).map(k=>[k,record[k]]));
 const address=record.address;
 out.address=address&&['meeting_venue','service_office','program_venue','mailing'].includes(address.type)?{text:address.text,type:address.type,map_eligible:address.map_eligible===true}:null;
 const contacts=record.public_contacts||{};
 out.public_contacts={phone:contacts.phone||null,email:contacts.email||null,website:isRosterURL(contacts.website)?null:contacts.website||null};
 out.officers=[];out.officers_status='not_published_for_privacy';
 if(Array.isArray(record.photos))out.photos=record.photos.slice(0,12).map(sanitizePublicPhoto).filter(Boolean);
 return out;
}

// Dates and both table locations were supplied in an authenticated HQ request
// by Sterling on September 2, 2026. Public web sources do not establish hours.
const poppyLocations=[
 {slug:'dixon-safeway',city:'Dixon',county:'Solano',venue:'Safeway, 1235 Stratford Avenue, Dixon, CA 95620',venue_source:'https://local.safeway.com/safeway/ca/dixon/1235-stratford-ave.html'},
 {slug:'davis-grocery-outlet',city:'Davis',county:'Yolo',venue:'Grocery Outlet, 1800 East 8th Street, Suite B, Davis, CA 95616',venue_source:'https://web.davischamber.com/Retail-Shops/Grocery-Outlet-Davis-12381'}
];
const buddyPoppyEvents=['07','08','11'].flatMap(day=>poppyLocations.map(place=>({
 id:`vfw-8151-poppy-2026-11-${day}-${place.slug}`,
 title:`VFW Post 8151 Buddy Poppy Fundraiser — ${place.city}`,
 organization_id:'vfw-ca-8151',organizer:'Dixon VFW Post 8151',kind:'Community event',
 county:place.county,city:place.city,venue:place.venue,venue_source:place.venue_source,
 start_at:`2026-11-${day}T00:00:00-08:00`,end_at:null,date_only:true,
 audience:'Community members are welcome to visit the table. Confirm table hours with VFW Post 8151 before making a special trip.',
 description:'Support VFW Post 8151’s Buddy Poppy fundraiser around Veterans Day. Tables are planned at Safeway in Dixon and Grocery Outlet in Davis on November 7, 8 and 11, 2026. Table hours are to be confirmed.',
 source_url:'https://vfw8151.org/di/vfw/v2/default.asp?nid=1',source_checked:'2026-09-02',source_kind:'project_team',
 source_note:'Dates and table locations supplied by Sterling through the project headquarters on September 2, 2026. The post website is linked for organizer information; it does not confirm the complete November 2026 schedule.',
 time_note:'Time to be confirmed. This is a date reminder, not an all-day table schedule. Contact VFW Post 8151 at 530-702-0508 for current hours.',status:'published'
})));

const extraSources=[
  {
    "id": "vfw-8151-home",
    "title": "Dixon VFW Post 8151",
    "publisher": "VFW Post 8151",
    "url": "https://vfw8151.org/di/vfw/v2/default.asp?nid=1",
    "fields": [
      "identity",
      "address",
      "public_contacts",
      "meetings",
      "activities",
      "events"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Official homepage supports the post's public meeting venue, generic contact phone, meeting schedule and activities. The website's November poppy announcement is dated 2025; November 2026 listings separately use Sterling's project update."
  },
  {
    "id": "vfw-8151-venue",
    "title": "Hall Rental — Dixon VFW Post 8151",
    "publisher": "VFW Post 8151",
    "url": "https://vfw8151.org/di/vfw/v2/default.asp?pid=122920",
    "fields": [
      "venue_relationship",
      "referral",
      "legion_208_contact"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "VFW Post 8151 does not own or operate the Olde Vets Hall. Page identifies American Legion Post 208 as operator of the separate Veterans Memorial Hall and refers hall inquiries there."
  },
  {
    "id": "leg-178-home",
    "title": "American Legion Rio Vista Post 178",
    "publisher": "American Legion Rio Vista Post 178",
    "url": "https://post178rvca.org/",
    "fields": [
      "identity",
      "address",
      "public_contacts",
      "member_information",
      "events"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Homepage displayed September 3 and September 10, 2026 social hours. Business meeting schedule and event guest rules not verified."
  },
  {
    "id": "leg-178-contact",
    "title": "Contact Us — Rio Vista Post 178",
    "publisher": "American Legion Rio Vista Post 178",
    "url": "https://post178rvca.org/site/contactus",
    "fields": [
      "public_contacts",
      "contact_routing"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Public Watch Office phone and contact form route inquiries to organization roles; no old newsletter email carried forward."
  },
  {
    "id": "leg-182",
    "title": "American Legion Reams Post 182",
    "publisher": "American Legion Reams Post 182",
    "url": "https://reamspost182.org/",
    "fields": [
      "identity",
      "meeting_venue",
      "phone",
      "meetings",
      "member_information"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Official homepage supports the public meeting venue, general post/hall phone and third-Thursday meeting at 6:30 p.m."
  },
  {
    "id": "vfw-6949-ucd",
    "title": "Connect to Your Community",
    "publisher": "UC Davis Veterans Success Center",
    "url": "https://veterans.ucdavis.edu/services/community",
    "fields": [
      "identity",
      "city",
      "partnership"
    ],
    "published_date": "2024-07-05",
    "accessed_date": "2026-09-02",
    "notes": "Page last updated July 5, 2024 describes an event partnership with Davis VFW Post 6949. Current public contact, venue and meeting schedule were not verified."
  },
  {
    "id": "toys-yolo-halloween-2026",
    "title": "The Toys for Tots Halloween Train",
    "publisher": "Zombie Bike Parade Festival",
    "url": "https://www.zombiebikeparade.com/events/halloween-train",
    "fields": [
      "event",
      "venue",
      "audience",
      "partnership"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Organizer-published October 31, 2026 schedule was retrieved through search; direct page opening failed. Local timezone inferred from Davis venue. This is not a family toy-application or toy-distribution appointment."
  },
  {
    "id": "waa-davis-2026",
    "title": "Davis Cemetery District Wreaths Across America",
    "publisher": "Wreaths Across America",
    "url": "https://www.wreathsacrossamerica.org/pages/174790/Overview",
    "fields": [
      "event",
      "venue",
      "audience",
      "volunteering",
      "timezone"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Location page explicitly publishes December 19, 2026 at 10 a.m. PST and requests volunteer registration for updates."
  },
  {
    "id": "waa-sacramento-valley-2026",
    "title": "Sacramento Valley National Cemetery Wreaths Across America",
    "publisher": "Wreaths Across America",
    "url": "https://wreathsacrossamerica.org/pages/15553/overview/",
    "fields": [
      "event",
      "venue",
      "volunteering",
      "timezone"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Cemetery location page explicitly publishes December 19, 2026 at 9 a.m. PST. Older sponsorship-group pages contain stale 2025 text."
  },
  {
    "id": "rememberavet-volunteer-2026",
    "title": "RememberAVet Wreath Project: 2026 Volunteer Opportunities",
    "publisher": "RememberAVet — Wreath Project",
    "url": "https://www.wreathproject.org/",
    "fields": [
      "events",
      "volunteering",
      "audience",
      "public_contacts"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Home page publishes December 18 unloading, December 19 placement, and January 16, 2027 cleanup. Local timezone inferred from Dixon venue. The separate detail page still says cleanup date TBA."
  },
  {
    "id": "rememberavet-boughs-2026",
    "title": "2026 Bough Laying",
    "publisher": "RememberAVet — Wreath Project",
    "url": "https://www.wreathproject.org/home-1-1-2",
    "fields": [
      "event",
      "venue",
      "audience",
      "partnership"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Bough placement and the Wreaths Across America ceremony are distinct same-day activities. Cleanup date is stale on this page; use the project home schedule. Numeric coverage and fundraising claims excluded."
  },
  {
    "id": "leg-165-venue",
    "title": "American Legion Post 165 at the Vacaville Veterans Hall",
    "publisher": "Vacaville Veterans Memorial Building",
    "url": "https://www.vacavets.org/",
    "fields": [
      "identity",
      "meeting_venue"
    ],
    "published_date": null,
    "accessed_date": "2026-09-02",
    "notes": "Venue homepage identifies Post 165 among its organizations and gives the public hall address. A one-day calendar entry does not establish a recurring meeting schedule. Hall contacts are not republished as personal or post contacts."
  },
  {
    "id": "dixon-hall-city",
    "title": "Dixon Veterans Memorial Hall public venue",
    "publisher": "City of Dixon",
    "url": "https://www.cityofdixonca.gov/NoticeofNomineesandMeasures",
    "fields": [
      "public_venue"
    ],
    "published_date": "2024",
    "accessed_date": "2026-09-02",
    "notes": "City notice identifies Veterans Memorial Hall at 1305 N. First Street, Dixon. Used only to establish the public venue; historical election hours are not organization hours."
  },
  {
    "id": "leg-550-national-news",
    "title": "Post 550 in Vallejo — national American Legion news",
    "publisher": "The American Legion",
    "url": "https://www.legion.org/information-center/news/baseball/2025/july/legion-baseball-alumni-among-baseball-hall-of-fame-class",
    "fields": [
      "identity",
      "city"
    ],
    "published_date": "2025-07",
    "accessed_date": "2026-09-02",
    "notes": "National article identifies Post 550 in Vallejo. It does not establish current contact details, meetings or program availability. No individual names or personal contact details are imported."
  }
];
const extraRecords=[
  {
    "id": "vfw-ca-8151",
    "verified_name": "Dixon VFW Post 8151",
    "organization_type": "VFW",
    "entity_kind": "organization",
    "city": "Dixon",
    "location_county": "Solano",
    "service_area": null,
    "address": {
      "text": "231 N. First Street, Dixon, CA 95620",
      "type": "meeting_venue",
      "map_eligible": true
    },
    "public_contacts": {
      "phone": "530-702-0508",
      "email": null,
      "website": "https://vfw8151.org/di/vfw/v2/default.asp?nid=1"
    },
    "hours": null,
    "meeting_schedule": "Third Wednesday · social 6:30 p.m.; meeting 7 p.m.",
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community",
      "Youth programs",
      "Volunteering"
    ],
    "audience": null,
    "eligibility": null,
    "event_information": {
      "status": "confirm_with_organizer",
      "text": "Sterling supplied November 7, 8 and 11, 2026 Buddy Poppy fundraiser dates for Safeway in Dixon and Grocery Outlet in Davis. See the shared event calendar; table hours are to be confirmed.",
      "source_kind": "project_team"
    },
    "referral_notes": "The post does not own or operate the Olde Vets Hall. Its website refers venue inquiries to the separate Veterans Memorial Hall operated by American Legion Dixon Post 208, at 707-678-6308.",
    "partnership_notes": null,
    "officers": [],
    "officers_status": "not_published",
    "member_information": "Meets at the Olde Vets Hall. The post advertises Voice of Democracy and Patriot’s Pen scholarships and Buddy Poppy activities. Contact the post for current participation rules.",
    "source_ids": [
      "vfw-8151-home",
      "vfw-8151-venue"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "high",
    "missing_data_flags": [
      "email_missing",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "event_details_incomplete"
    ]
  },
  {
    "id": "legion-ca-165",
    "verified_name": "American Legion Post 165 — Vacaville",
    "organization_type": "American Legion",
    "entity_kind": "organization",
    "city": "Vacaville",
    "location_county": "Solano",
    "service_area": null,
    "address": {
      "text": "549 Merchant Street, Vacaville, CA 95688",
      "type": "meeting_venue",
      "map_eligible": true
    },
    "public_contacts": {
      "phone": null,
      "email": null,
      "website": null
    },
    "hours": null,
    "meeting_schedule": null,
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community"
    ],
    "audience": null,
    "eligibility": null,
    "event_information": null,
    "referral_notes": "The Veterans Memorial Building website identifies the post and its public venue. Personal contact details and dues-mailing information are not included.",
    "partnership_notes": null,
    "officers": [],
    "officers_status": "not_published",
    "member_information": "American Legion Post 165 is based at the Vacaville Veterans Memorial Building. Use the public venue source for location information; a current general post contact and recurring meeting schedule are awaiting confirmation.",
    "source_ids": [
      "leg-165-venue"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "medium",
    "missing_data_flags": [
      "general_post_contact_pending",
      "meeting_schedule_missing",
      "program_availability_unconfirmed",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "current_events_missing"
    ]
  },
  {
    "id": "legion-ca-178",
    "verified_name": "American Legion Rio Vista Post 178",
    "organization_type": "American Legion",
    "entity_kind": "organization",
    "city": "Rio Vista",
    "location_county": "Solano",
    "service_area": null,
    "address": {
      "text": "610 St. Francis Way, Rio Vista, CA 94571",
      "type": "post_location",
      "map_eligible": true
    },
    "public_contacts": {
      "phone": "707-374-6554",
      "email": null,
      "website": "https://post178rvca.org/"
    },
    "hours": null,
    "meeting_schedule": null,
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community",
      "Benefits navigation",
      "Youth programs"
    ],
    "audience": "Veterans, service members, families and River Delta community participants; individual program and event rules need confirmation.",
    "eligibility": null,
    "event_information": {
      "status": "confirm_with_organizer",
      "text": "Official site lists social hours September 3 and September 10, 2026 at 5 p.m. Confirm attendance rules with the post; these are not verified business-meeting times.",
      "source_id": "leg-178-home"
    },
    "referral_notes": "Use the official contact form at https://post178rvca.org/site/contactus or call the Watch Office to reach the Post Service Officer or another appropriate role. VA accreditation was not verified.",
    "partnership_notes": null,
    "officers": [],
    "officers_status": "not_published",
    "member_information": "The Watch Office and official contact form route questions to post officers, including the Post Service Officer. The post describes scholarships, support for local veterans and families, and community activities.",
    "source_ids": [
      "leg-178-home",
      "leg-178-contact"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "high",
    "missing_data_flags": [
      "business_meeting_schedule_missing",
      "event_guest_rules_unconfirmed",
      "email_missing",
      "mailing_address_unconfirmed",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown"
    ]
  },
  {
    "id": "legion-ca-182",
    "verified_name": "American Legion Reams Post 182",
    "organization_type": "American Legion",
    "entity_kind": "organization",
    "city": "Suisun City",
    "location_county": "Solano",
    "service_area": null,
    "address": {
      "text": "427 Main Street, Suisun City, CA 94585",
      "type": "meeting_venue",
      "map_eligible": true
    },
    "public_contacts": {
      "phone": "707-429-3110",
      "email": null,
      "website": "https://reamspost182.org/"
    },
    "hours": null,
    "meeting_schedule": "Third Thursday · 6:30 p.m.",
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community"
    ],
    "audience": null,
    "eligibility": null,
    "event_information": null,
    "referral_notes": "Contact the organization to confirm available services and the appropriate next step.",
    "partnership_notes": "Shares the Suisun Veterans Memorial Building address and public phone with separately listed VFW Post 2333; shared facilities do not establish a formal referral partnership.",
    "officers": [],
    "officers_status": "not_published",
    "member_information": "Meets at the Suisun Veterans Memorial Building. Its website describes broad support for veterans, families and community; specific assistance programs need confirmation.",
    "source_ids": [
      "leg-182"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "high",
    "missing_data_flags": [
      "email_missing",
      "mailing_address_unconfirmed",
      "specific_services_unconfirmed",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "current_events_missing"
    ]
  },
  {
    "id": "legion-ca-208",
    "verified_name": "American Legion Dixon Post 208",
    "organization_type": "American Legion",
    "entity_kind": "organization",
    "city": "Dixon",
    "location_county": "Solano",
    "service_area": null,
    "address": {
      "text": "1305 N. First Street, Dixon, CA 95620",
      "type": "meeting_venue",
      "map_eligible": true
    },
    "public_contacts": {
      "phone": "707-678-6308",
      "email": null,
      "website": null
    },
    "hours": null,
    "meeting_schedule": null,
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community"
    ],
    "audience": null,
    "eligibility": null,
    "event_information": null,
    "referral_notes": "The phone listed here is the public Veterans Memorial Hall inquiry number. Personal member contacts are not included.",
    "partnership_notes": null,
    "officers": [],
    "officers_status": "not_published",
    "member_information": "Dixon VFW Post 8151 identifies American Legion Post 208 as operator of Veterans Memorial Hall and provides the public hall inquiry number. Confirm the current post meeting schedule and programs with the organization.",
    "source_ids": [
      "vfw-8151-venue",
      "dixon-hall-city"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "medium",
    "missing_data_flags": [
      "website_missing",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "current_events_missing",
      "general_post_email_pending",
      "meeting_schedule_missing"
    ]
  },
  {
    "id": "vfw-ca-6949",
    "verified_name": "Davis VFW Post 6949",
    "organization_type": "VFW",
    "entity_kind": "organization",
    "city": "Davis",
    "location_county": "Yolo",
    "service_area": null,
    "address": null,
    "public_contacts": {
      "phone": null,
      "email": null,
      "website": null
    },
    "hours": null,
    "meeting_schedule": null,
    "timezone": "America/Los_Angeles",
    "service_categories": [
      "Veteran community"
    ],
    "audience": null,
    "eligibility": null,
    "event_information": null,
    "referral_notes": "Direct public contact details have not yet been verified.",
    "partnership_notes": "UC Davis Veterans Success Center describes a partnership with Post 6949 in hosting events; evidence last updated July 5, 2024.",
    "officers": [],
    "officers_status": "not_published",
    "member_information": "UC Davis Veterans Success Center identifies Davis VFW Post 6949 as an event partner on a page last updated July 5, 2024. Current post contact details, meeting location and schedule are being verified.",
    "source_ids": [
      "vfw-6949-ucd"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "medium",
    "missing_data_flags": [
      "post_website_unavailable",
      "current_contact_missing",
      "address_missing",
      "meeting_schedule_missing",
      "partner_evidence_2024",
      "current_operating_status_unconfirmed",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "current_events_missing"
    ]
  },
  {
    "id": "legion-ca-550",
    "verified_name": "American Legion Mare Island Navy Yard Post 550",
    "organization_type": "American Legion",
    "entity_kind": "organization",
    "city": "Vallejo",
    "location_county": "Solano",
    "service_area": null,
    "address": null,
    "public_contacts": {
      "phone": null,
      "email": null,
      "website": null
    },
    "hours": null,
    "meeting_schedule": null,
    "timezone": "America/Los_Angeles",
    "service_categories": [],
    "audience": null,
    "eligibility": null,
    "event_information": null,
    "referral_notes": "Direct public contact details have not yet been verified.",
    "partnership_notes": null,
    "officers": [],
    "officers_status": "not_published",
    "member_information": "American Legion national news identifies Post 550 in Vallejo. Current public contact details, meeting location, schedule and programs are awaiting organization confirmation.",
    "source_ids": [
      "leg-550-national-news"
    ],
    "last_verified_date": "2026-09-02",
    "verification_method": "public_source_review",
    "organization_confirmed_at": null,
    "confidence": "medium",
    "missing_data_flags": [
      "identity_only",
      "current_contact_missing",
      "address_missing",
      "meeting_schedule_missing",
      "website_missing",
      "current_program_status_unconfirmed",
      "service_area_unknown",
      "eligibility_unconfirmed",
      "hours_unknown",
      "current_events_missing",
      "historical_contacts_excluded"
    ]
  }
];
const seedEvents=[
  ...buddyPoppyEvents,
  {
    "id": "toys-yolo-halloween-train-2026",
    "title": "Toys for Tots Halloween Train",
    "organization_id": "toys-yolo",
    "organizer": "Zombie Bike Parade Festival — Davis Odd Fellows Lodge 169, The Bike Campaign and Davis Bike Club",
    "kind": "Community event",
    "county": "Yolo",
    "city": "Davis",
    "venue": "Community Park, 1405 F Street, Davis, CA 95616",
    "start_at": "2026-10-31T11:00:00-07:00",
    "end_at": "2026-10-31T15:00:00-07:00",
    "audience": "Public and families; free train rides, with no wristband or signup stated by the organizer.",
    "description": "The festival lists free trackless-train rides and a nearby Toys for Tots Yolo County table. Toys for Tots participates in the event; the broader festival names NorCal Trykers as its beneficiary. This listing is not a toy-application or distribution appointment.",
    "source_url": "https://www.zombiebikeparade.com/events/halloween-train",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "The organizer publishes 11 a.m.–3 p.m. on October 31, 2026. America/Los_Angeles daylight time (UTC−07:00) is inferred from the Davis venue; the source does not label a timezone. Reconfirm the schedule with the organizer."
  },
  {
    "id": "waa-davis-2026",
    "title": "Wreaths Across America at Davis Cemetery",
    "organization_id": null,
    "organizer": "Davis Cemetery District and Wreaths Across America",
    "kind": "Remembrance",
    "county": "Yolo",
    "city": "Davis",
    "venue": "Davis Cemetery District, 820 Pole Line Road, Davis, CA 95618",
    "start_at": "2026-12-19T10:00:00-08:00",
    "end_at": null,
    "audience": "Everyone of all ages and backgrounds is welcome. Register through the official event page for volunteer updates.",
    "description": "Remembrance ceremony followed immediately by wreath placement. Follow the local coordinators' instructions and check the official page for changes.",
    "source_url": "https://www.wreathsacrossamerica.org/pages/174790/Overview",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "Source explicitly publishes December 19, 2026 at 10 a.m. PST (UTC−08:00). End time is not published."
  },
  {
    "id": "waa-sacramento-valley-2026",
    "title": "Wreaths Across America at Sacramento Valley National Cemetery",
    "organization_id": null,
    "organizer": "Wreaths Across America — Sacramento Valley National Cemetery location",
    "kind": "Remembrance",
    "county": "Solano",
    "city": "Dixon",
    "venue": "Sacramento Valley National Cemetery, 5810 Midway Road, Dixon, CA 95620",
    "start_at": "2026-12-19T09:00:00-08:00",
    "end_at": null,
    "audience": "Public participants and volunteers; use the official location page for volunteer registration and current directions.",
    "description": "Remembrance ceremony followed immediately by wreath placement. Follow cemetery staff directions for parking. This ceremony is separate from the earlier RememberAVet bough-placement activity at the same cemetery.",
    "source_url": "https://wreathsacrossamerica.org/pages/15553/overview/",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "Source explicitly publishes December 19, 2026 at 9 a.m. PST (UTC−08:00). End time is not published."
  },
  {
    "id": "rememberavet-unloading-2026",
    "title": "RememberAVet Bough Truck Unloading",
    "organization_id": null,
    "organizer": "RememberAVet — Wreath Project",
    "kind": "Volunteering",
    "county": "Solano",
    "city": "Dixon",
    "venue": "Sacramento Valley National Cemetery, 5810 Midway Road, Dixon, CA 95620",
    "start_at": "2026-12-18T15:00:00-08:00",
    "end_at": null,
    "audience": "Teenagers and adults. Contact the project coordinator in advance with the size of your volunteer group.",
    "description": "Help unload delivery trucks for the holiday bough-placement project. The organizer asks volunteers to arrive by 3 p.m.; work begins after the cemetery's final ceremony. The published plan proceeds rain or shine.",
    "source_url": "https://www.wreathproject.org/",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "Source publishes December 18, 2026 at 3 p.m. as arrival time, with work beginning after the final ceremony. America/Los_Angeles standard time (UTC−08:00) is inferred from the Dixon venue. End time is not published."
  },
  {
    "id": "rememberavet-placement-2026",
    "title": "RememberAVet Holiday Bough Placement",
    "organization_id": null,
    "organizer": "RememberAVet — Wreath Project",
    "kind": "Volunteering",
    "county": "Solano",
    "city": "Dixon",
    "venue": "Sacramento Valley National Cemetery, 5810 Midway Road, Dixon, CA 95620",
    "start_at": "2026-12-19T07:30:00-08:00",
    "end_at": null,
    "audience": "Public volunteers of all ages; follow the organizer's cemetery and placement instructions.",
    "description": "Help place holiday boughs at veterans' graves. Follow cemetery instructions and family-preference markers. Volunteers are also requested for cardboard collection afterward. This activity is separate from the Wreaths Across America ceremony later that morning.",
    "source_url": "https://www.wreathproject.org/",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "Source publishes December 19, 2026 beginning at 7:30 a.m. America/Los_Angeles standard time (UTC−08:00) is inferred from the Dixon venue. End time is not published."
  },
  {
    "id": "rememberavet-cleanup-2027",
    "title": "RememberAVet Bough Cleanup",
    "organization_id": null,
    "organizer": "RememberAVet — Wreath Project",
    "kind": "Volunteering",
    "county": "Solano",
    "city": "Dixon",
    "venue": "Sacramento Valley National Cemetery, 5810 Midway Road, Dixon, CA 95620",
    "start_at": "2027-01-16T07:30:00-08:00",
    "end_at": null,
    "audience": "All ages; project home page says no signup is required. Volunteers with pickups and trailers are also requested.",
    "description": "Help collect holiday boughs and move them to the curb for on-site disposal. Volunteers may bring wagons or work in pairs with a pole or dowel. The published plan proceeds rain or shine; check the project home page before attending.",
    "source_url": "https://www.wreathproject.org/",
    "source_checked": "2026-09-02",
    "status": "published",
    "time_note": "Project home page publishes January 16, 2027 beginning at 7:30 a.m.; a separate detail page still says cleanup date TBA. America/Los_Angeles standard time (UTC−08:00) is inferred from the Dixon venue. End time is not published."
  }
];

const checked = '2026-09-02';
const source = (id,title,publisher,url,fields,published=null,notes=null) => ({id,title,publisher,url,fields,published_date:published,accessed_date:checked,notes});
const sources = [
 source('rememberavet-home','RememberAVet Wreath Project','RememberAVet','https://www.wreathproject.org/',['identity','mailing_address','public_contacts','program']),
 source('vets-official','Veterans Equine Therapy — official website','Veterans Equine Therapy','https://www.veteransequinetherapy.com/',['identity','public_contacts','program','nonprofit_self_description'],null,'Describes the organization as a nonprofit supporting veterans through equine-assisted therapy. Lists general organization contacts; current intake, schedule and visit location are not established.'),
 ...extraSources,
 source('west-sac','West Sacramento VFW','VFW Post 8762','https://westsacvfw.com/',['identity','public_contacts','member_information']),
 source('benicia-vfw','Benicia VFW','VFW Post 3928','https://www.beniciavfw.org/',['identity','member_information']),
 source('vacaville-vfw','Vacaville VFW','VFW Post 7244','https://www.vfwpost7244.org/',['identity','venue','public_contacts']),
 source('legion-77','Sacramento Valley veterans outreach','The American Legion','https://www.legion.org/information-center/news/membership/2026/april/veterans-benefits-assistance-coming-to-sacramento-area',['identity','address','past_event'],'2026-04', 'April 17-19 outreach is historical, not continuing service hours.'),
 source('vfw-7143-official','VFW Post 7143 in Esparto CA','VFW Post 7143','https://vfw7143.org/di/vfw/v2/default.asp',['identity','city','mailing_address','website','programs'],null,'Official post website. The published PO box is a mailing address, not a visitor location; current meeting details still require confirmation.'),
 source('vacavets','Veterans Memorial Building and calendar','Vacaville Veterans Memorial Building','https://www.vacavets.org/',['venue','meetings','events'],null,'Meeting venue; hall contact is not a detachment contact.'),
 source('mcl-funding','Marine Corps League contribution, File 25-292','Solano County','https://solano.legistar.com/LegislationDetail.aspx?GUID=A35327E8-C770-4843-97BB-7356132DF1C5&ID=7319441&Options=&Search=',['identity','historical_activities'],'2025-04-22'),
 source('toys-yolo','Mail Services Toy Drive 2025','UC Davis Supply Chain Management','https://supplychain.ucdavis.edu/events/mail-services-toy-drive-2025',['campaign','service_area','past_event'],'2025', 'December 1–11, 2025 collection dates are historical.'),
 source('toys-chamber','Community organizations directory','Davis Chamber of Commerce','https://web.davischamber.com/davis/Community-Organizations?ysort=true',['campaign_link','public_contact'],null,'Chamber directory; campaign confirmation needed.'),
 source('toys-solano','Solano County campaign','Marine Toys for Tots','https://solano-county-ca.toysfortots.org/local-coordinator-sites/lco-sites/default.aspx?nPageID=0&nPreviewInd=0&nRedirectInd=3',['campaign','service_area','intake','partnership'],null,'Official search extraction; direct opening unavailable. Page reports 2025 activity; 2026 dates unverified.'),
 source('dav-21','Ozie Boler Chapter 21','DAV','https://davwebsites.dav.org/ca/21/SystemPages/Home.aspx',['identity','meeting_venue','meetings'],null,'Phone conflicts and erroneous template text excluded.'),
 source('dav-84-contact','Chapter 84 contact and meetings','DAV Chapter 84','https://www.cadav84.org/contact',['identity','address','meetings','email','audience','accessibility','venue_contact'],null,'The phone 707-447-6354 is explicitly listed for the Veterans Memorial Building and hall rental, not as the chapter contact.'),
 source('dav-84-area','Who we serve','DAV Chapter 84','https://www.cadav84.org/about-who-we-serve',['service_area','audience']),
 source('yolo-vso','Veterans Services Office','Yolo County','https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office',['identity','service_categories','address','phone','hours','audience','referrals']),
 source('solano-vso','Veterans Services','Solano County','https://www.solanocounty.gov/government/veterans-services',['identity','service_categories','address','phone','hours','audience','partnership']),
 source('vbc-national','Veterans Beer Club','Veterans Beer Club','https://veteransbeerclub.org/',['identity','mission','audience','chapters'],null,'The national organization site includes Yolo-Solano chapter imagery and describes the club mission and audience.'),
 source('vbc-yolo-solano-resource','Local Resources','VFW Post 8151','https://vfw8151.org/di/vfw/v2/default.asp?nid=4',['local_chapter_identity'],null,'Official VFW post resource page lists Veterans Beer Club Yolo-Solano Chapter.')
];
function record(id,name,type,city,county,address,meeting,website,source_ids,extra={}) {
 return {id,verified_name:name,organization_type:type,entity_kind:'organization',city,location_county:county,service_area:null,address:address?{text:address,type:'meeting_venue',map_eligible:true}:null,public_contacts:{phone:null,email:null,website},hours:null,meeting_schedule:meeting,timezone:'America/Los_Angeles',service_categories:[],audience:null,eligibility:null,event_information:null,referral_notes:'Contact the organization to confirm available services and the appropriate next step.',partnership_notes:null,officers:[],officers_status:'not_verified',member_information:null,source_ids,last_verified_date:checked,verification_method:'public_source_review',organization_confirmed_at:null,confidence:'medium',missing_data_flags:[],...extra};
}
const records = [
 record('rememberavet','RememberAVet — Wreath Project','Veteran remembrance program','Winters','Yolo',null,null,'https://www.wreathproject.org/',['rememberavet-home','rememberavet-volunteer-2026','rememberavet-boughs-2026'],{address:{text:'PO Box 773, Winters, CA 95694',type:'mailing',map_eligible:false},public_contacts:{phone:null,email:'WreathProject@yahoo.com',website:'https://www.wreathproject.org/'},service_area:{counties:['Solano'],cities:['Dixon'],notes:'Holiday bough activities at Sacramento Valley National Cemetery in Dixon; the project publishes a Winters mailing address.'},service_categories:['Remembrance','Volunteering'],member_information:'Coordinates fundraising and volunteers for holiday bough placement and cleanup at Sacramento Valley National Cemetery in Dixon. Its Winters address is a mailing address, not a visitor office. RememberAVet bough activities and the cemetery’s Wreaths Across America ceremony are separate programs.',audience:'Community volunteers; check each activity’s participation instructions.',confidence:'high',missing_data_flags:['office_hours_unknown','organization_confirmation_pending']}),
 record('little-reata-veterans','Veterans Equine Therapy (VETs)','Equine program provider','Davis','Yolo',null,null,'https://www.veteransequinetherapy.com/',['vets-official'],{display_name_update:{method:'authenticated_project_update',date:checked,scope:'Display name supplied through an authenticated project update; organization information reviewed against its official website.'},public_contacts:{phone:'530-867-5150',email:'vets@veteransequinetherapy.com',website:'https://www.veteransequinetherapy.com/'},service_categories:['Equine-assisted therapy','Veteran support'],member_information:'Veterans Equine Therapy (VETs) describes itself as a nonprofit organization supporting veterans through equine-assisted therapy. Use its official website or general organization contact to ask about current participation, schedules and visits.',audience:'Veterans; current eligibility and participation details need confirmation.',missing_data_flags:['current_intake_unconfirmed','schedule_unconfirmed','visit_location_unconfirmed','participation_details_unconfirmed']}),
 record('veterans-beer-club-yolo-solano','Veterans Beer Club Yolo-Solano','Veterans Beer Club',null,'Yolo',null,'Second Thursday of each month at a rotating Yolo or Solano County brewery. Confirm the current venue before attending.','https://veteransbeerclub.org/',['vbc-national','vbc-yolo-solano-resource'],{display_name_update:{method:'authenticated_project_update',date:'2026-09-04',scope:'Chapter name, meeting pattern and official chapter social links supplied by an authenticated project editor.'},service_area:{counties:['Yolo','Solano'],cities:[],notes:'Yolo and Solano counties; monthly venue rotates between local breweries.'},service_categories:['Veteran networking','Career connections','Community outreach'],member_information:'A local chapter of Veterans Beer Club, an informal networking community centered on camaraderie, career connections and community outreach.',audience:'Veterans, active duty service members, reservists, Guard members, military retirees and spouses. Recruiters are welcome at national VBC events.',referral_notes:'Use the chapter social pages to confirm the brewery and time for the next second-Thursday gathering.',confidence:'high',missing_data_flags:['next_meeting_venue_unconfirmed','instagram_link_unverified']}),
 ...extraRecords,
 record('vfw-ca-8762','West Sacramento VFW Post 8762','VFW','West Sacramento','Yolo','905 Drever Street, West Sacramento, CA 95691','Second Wednesday · 6:30 p.m.','https://westsacvfw.com/',['west-sac'],{public_contacts:{phone:'916-371-7245',email:null,website:'https://westsacvfw.com/'},service_categories:['Veteran community','Benefits navigation'],member_information:'Post website links to benefits assistance and hall rentals. Confirm how assistance is provided.',audience:'Veterans, families and community; program rules need confirmation.',missing_data_flags:['service_area_unknown','eligibility_unconfirmed','hours_unknown']}),
 record('legion-ca-77','Yolo American Legion Post 77','American Legion','Woodland','Yolo','523 Bush Street, Woodland, CA 95695',null,null,['legion-77'],{member_information:'Woodland post documented as the host of an April 2026 veterans outreach session.',event_information:{status:'past',text:'Benefits outreach held April 17-19, 2026. This does not establish ongoing service hours.',source_id:'legion-77'},missing_data_flags:['routine_contact_missing','meeting_schedule_missing','service_area_unknown']}),
 record('vfw-ca-7143','Western Yolo VFW Post 7143','VFW','Esparto','Yolo',null,null,'https://vfw7143.org/',['vfw-7143-official'],{address:{text:'PO Box 232, Esparto, CA 95627',type:'mailing',map_eligible:false},public_contacts:{phone:null,email:null,website:'https://vfw7143.org/'},member_information:'The official Post 7143 website identifies the organization in Esparto. Use the post website to confirm current meetings, activities and attendance details.',missing_data_flags:['meeting_venue_unconfirmed','meeting_schedule_unconfirmed','general_organization_contact_unconfirmed','service_area_unknown']}),
 record('mcl-yolo','Marine Corps League — Yolo County Detachment 627','Marine Corps League','Woodland','Yolo','500 Bush Street, Woodland, CA 95695',null,null,[],{display_name_update:{method:'authenticated_project_update',date:checked,scope:'Detachment number supplied through an authenticated project clarification; current contact and meeting details remain unconfirmed.'},member_information:'Meetings have been listed at the Woodland Elks Lodge. Confirm current meeting and visitor details through an organization contact.',missing_data_flags:['public_source_withheld_for_privacy','meeting_schedule_unconfirmed','local_contact_missing','service_area_unknown','hours_unknown']}),
 record('toys-yolo','Toys for Tots — Yolo County','Toys for Tots',null,'Yolo',null,null,'https://woodland-ca.toysfortots.org/',['toys-yolo','toys-chamber'],{entity_kind:'seasonal_campaign',service_area:{counties:['Yolo'],cities:[],notes:'Yolo County children; 2026 campaign rules not yet verified.'},service_categories:['Holiday toy assistance','Volunteering'],audience:'Children and families in Yolo County.',member_information:'Seasonal toy collection and distribution program. Follow the campaign for current application instructions.',event_information:{status:'past',text:'UC Davis collection ran December 1–11, 2025. Family application and distribution dates for 2026 remain unverified. See the shared calendar for campaign-related community events.',source_id:'toys-yolo'},partnership_notes:'UC Davis Mail Services collection partnership documented for 2025.',missing_data_flags:['campaign_page_unavailable','2026_dates_missing','address_missing','application_rules_unknown']}),
 record('vso-yolo','Yolo County Veterans Services Office','County Veterans Office','Woodland','Yolo','137 N. Cottonwood Street, Woodland, CA',null,'https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office',['yolo-vso'],{address:{text:'137 N. Cottonwood Street, Woodland, CA',type:'service_office',map_eligible:true},public_contacts:{phone:'530-406-4850',email:null,website:'https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office'},service_area:{counties:['Yolo'],cities:[],notes:'County veterans office; confirm requirements for the specific benefit.'},service_categories:['Benefits navigation','Claims assistance','Referrals'],hours:'Monday–Thursday · 7:30 a.m.–4 p.m.; lunch closure noon–1 p.m.; Friday closed to public.',audience:'Veterans, dependents and survivors.',member_information:'County benefit counseling, claims support and referrals. Contact the office for appointments and outreach locations.',confidence:'high',missing_data_flags:['program_eligibility_varies']}),
 record('vfw-ca-3928','Benicia VFW Post 3928','VFW','Benicia','Solano','1150 1st Street, Benicia, CA 94510','First Wednesday · 7 p.m.','https://www.beniciavfw.org/',['benicia-vfw'],{public_contacts:{phone:null,email:null,website:'https://www.beniciavfw.org/'},member_information:'Local veteran and community organization. Its website describes work with its Auxiliary.',missing_data_flags:['service_area_unknown','program_details_unconfirmed','hours_unknown']}),
 record('vfw-ca-7244','Lt. Michael Libonati Jr. VFW Post 7244','VFW','Vacaville','Solano','549 Merchant Street, Vacaville, CA 95688','Second Tuesday · 7 p.m.','https://www.vfwpost7244.org/',['vacaville-vfw'],{public_contacts:{phone:null,email:'vfwpost7244@gmail.com',website:'https://www.vfwpost7244.org/'},member_information:'Post gatherings at Vacaville Veterans Hall. Use the post’s general email or website for organization inquiries. For Veterans Memorial Building or hall-rental inquiries, the separate public venue number is 707-447-6354.',missing_data_flags:['multiple_contact_roles','service_area_unknown','hours_unknown']}),
 record('vfw-ca-1123','Carl H. Kreh VFW Post 1123','VFW','Vallejo','Solano','420 Admiral Callaghan Lane, Vallejo, CA 94591',null,null,[],{public_contacts:{phone:null,email:null,website:null},member_information:'Local veterans organization. Current organization contact details and activities need confirmation.',missing_data_flags:['public_source_withheld_for_privacy','meeting_schedule_unconfirmed','general_organization_contact_unconfirmed','website_missing','service_details_missing','eligibility_unconfirmed']}),
 record('vfw-ca-2333','Simmons-Sheldon VFW Post 2333','VFW','Suisun City','Solano','427 Main Street, Suisun City, CA 94585',null,null,[],{public_contacts:{phone:null,email:null,website:null},member_information:'Local veterans organization. Current organization contact details and activities need confirmation.',missing_data_flags:['public_source_withheld_for_privacy','meeting_schedule_unconfirmed','general_organization_contact_unconfirmed','website_missing','service_details_missing','eligibility_unconfirmed']}),
 record('legion-ca-101','American Legion Post 101 — Benicia','American Legion','Benicia','Solano','1150 1st Street, Benicia, CA 94510',null,null,[],{public_contacts:{phone:null,email:null,website:null},member_information:'Local American Legion post. Current gatherings, programs and a general organization contact need confirmation.',missing_data_flags:['public_source_withheld_for_privacy','meeting_schedule_unconfirmed','program_availability_unconfirmed','service_area_unknown']}),
 record('legion-ca-603','American Legion Post 603 — Manuel Quezon','American Legion','Vallejo','Solano','420 Admiral Callaghan Lane, Vallejo, CA 94591',null,null,[],{public_contacts:{phone:null,email:null,website:null},member_information:'Local American Legion post. A general organization contact for membership and activities has not been confirmed.',missing_data_flags:['public_source_withheld_for_privacy','meeting_schedule_unconfirmed','service_area_unknown','email_missing']}),
 record('mcl-ca-1486','Marine Corps League — Charles “Bud” Hallam Detachment 1486','Marine Corps League','Vacaville','Solano','549 Merchant Street, Vacaville, CA 95688','First Wednesday · 7 p.m.','https://www.solanocountymcl1486.org/',['vacavets','mcl-funding'],{member_information:'Meets at Vacaville Veterans Hall, 549 Merchant Street. Confirm current meeting details through the public venue or organization website.',event_information:{status:'confirm_with_organizer',text:'Check the venue calendar for the next detachment meeting.',source_id:'vacavets'},missing_data_flags:['local_contact_missing','service_area_unknown']}),
 record('toys-solano','Toys for Tots — Solano County','Toys for Tots',null,'Solano',null,null,'https://solano-county-ca.toysfortots.org/local-coordinator-sites/lco-sites/default.aspx?nPageID=0&nPreviewInd=0&nRedirectInd=3',['toys-solano'],{entity_kind:'seasonal_campaign',service_area:{counties:['Solano'],cities:[],notes:'Solano campaign; city-level exclusions unverified.'},service_categories:['Holiday toy assistance','Volunteering'],audience:'Children and families; current application rules need confirmation.',member_information:'The campaign provides family and agency request routes and toy-drop participation. Submit any required documents only to the campaign.',event_information:{status:'not_verified',text:'2026 application and distribution dates have not been verified.',source_id:'toys-solano'},partnership_notes:'Campaign lists nonprofit/agency and collection-site participation.',missing_data_flags:['2026_dates_missing','service_location_missing','phone_email_missing','eligibility_incomplete']}),
 record('dav-ca-21','DAV — Ozie Boler Chapter 21','DAV','Vallejo','Solano','420 Admiral Callaghan Lane, Vallejo, CA 94591','Fourth Saturday · 10 a.m.','https://davwebsites.dav.org/ca/21/SystemPages/Home.aspx',['dav-21'],{member_information:'DAV-hosted page lists this chapter and its meeting. Public phone listings conflict; use the official page to confirm the best contact.',missing_data_flags:['phone_conflict','service_area_unknown','local_service_capacity_unconfirmed']}),
 record('dav-ca-84','DAV Chapter 84 — Vacaville','DAV','Vacaville','Solano','549 Merchant Street, Vacaville, CA 95688','Second Saturday · 10 a.m. · except December','https://www.cadav84.org/',['dav-84-contact','dav-84-area','vacavets'],{public_contacts:{phone:null,email:'cadisabledvets84@gmail.com',website:'https://www.cadav84.org/'},service_area:{counties:['Solano'],cities:['Cordelia','Travis AFB','Suisun City','Fairfield','Vacaville','Dixon'],notes:'Northern Solano and intervening unincorporated areas; not all of Solano County.'},audience:'All veterans may visit meetings. Chapter membership is described separately as for VA-rated disabled veterans.',service_categories:['Veteran community','Benefits navigation','Referrals'],member_information:'Use the chapter’s general email or website for organization inquiries. For Veterans Memorial Building or hall-rental inquiries, use the separate venue contact 707-447-6354. Enter through the back door; the chapter describes elevator access to the meeting hall.',confidence:'high',missing_data_flags:['multiple_contact_roles','stale_event_feed']}),
 record('vso-solano','Solano County Veterans Service Office','County Veterans Office','Fairfield','Solano','675 Texas Street, Suite 4700, Fairfield, CA 94533',null,'https://www.solanocounty.gov/government/veterans-services',['solano-vso'],{address:{text:'675 Texas Street, Suite 4700, Fairfield, CA 94533',type:'service_office',map_eligible:true},public_contacts:{phone:'707-784-6590',email:null,website:'https://www.solanocounty.gov/government/veterans-services'},service_area:{counties:['Solano'],cities:[],notes:'County veterans office; individual program rules vary.'},service_categories:['Benefits navigation','Claims assistance','Referrals'],hours:'Monday–Thursday · 9 a.m.–4 p.m.; lunch closure noon–1 p.m.',audience:'Veterans, dependents and survivors.',member_information:'County benefits assistance, healthcare enrollment guidance and records requests. Check current appointment and walk-in availability.',confidence:'high',missing_data_flags:['program_eligibility_varies']})
];
const places = {'All locations':null,'Yolo County':'Yolo','Solano County':'Solano','Woodland':'Yolo','Davis':'Yolo','West Sacramento':'Yolo','Winters':'Yolo','Yolo unincorporated communities':'Yolo','Benicia':'Solano','Dixon':'Solano','Fairfield':'Solano','Rio Vista':'Solano','Suisun City':'Solano','Vacaville':'Solano','Vallejo':'Solano','Travis AFB':'Solano','Cordelia':'Solano','Solano unincorporated communities':'Solano'};
const types = ['VFW','American Legion','Marine Corps League','Veterans Beer Club','Toys for Tots','DAV','County Veterans Office','Equine program provider','Veteran remembrance program'];
const dataset = {schema_version:'1.1',project:'Yolo Solano Veterans',research_counties:['Yolo','Solano'],last_verified_date:checked,verification_note:'Public sources reviewed; no organization has claimed or confirmed its profile. The directory is not exhaustive.',sources,records};

// Official artwork is stored locally; provenance is recorded with the assets.
const brandLogos={
 'little-reata-veterans':{src:'/logos/veterans-equine-therapy.jpg',alt:'Veterans Equine Therapy — VETs horse and dog-tag emblem'},
 'VFW':{src:'/logos/vfw.png',alt:'Veterans of Foreign Wars'},
 'American Legion':{src:'/logos/american-legion.png',alt:'The American Legion'},
 'DAV':{src:'/logos/dav.svg',alt:'Disabled American Veterans'},
 'Marine Corps League':{src:'/logos/marine-corps-league.png',alt:'Marine Corps League'},
 'Toys for Tots':{src:'/logos/toys-for-tots.svg',alt:'Marine Toys for Tots'},
 'rememberavet':{src:'/logos/rememberavet.png',alt:'Remember A Vet - Wreath Project'},
 'veterans-beer-club-yolo-solano':{src:'/published-assets/vbc-yolo-solano.png',alt:'Veterans Beer Club Yolo-Solano chapter logo'}
};

const links={
 'veterans-beer-club-yolo-solano':{
  social:[
   {label:'Facebook',url:'https://lnkd.in/gEVnzvyQ'},
   {label:'LinkedIn',url:'https://lnkd.in/gmpf3nkE'}
  ],
  parent:[{label:'Veterans Beer Club',url:'https://veteransbeerclub.org/'}]
 }
};

const parentByType={
 'VFW':[{label:'VFW Department of California',url:'https://vfwca.org/'},{label:'Veterans of Foreign Wars',url:'https://www.vfw.org/'}],
 'American Legion':[{label:'American Legion Department of California',url:'https://calegion.org/'},{label:'The American Legion',url:'https://www.legion.org/'}],
 'DAV':[{label:'DAV Department of California',url:'https://www.davcal.org/'},{label:'Disabled American Veterans',url:'https://www.dav.org/'}],
 'Marine Corps League':[{label:'Marine Corps League National Headquarters',url:'https://www.mclnational.org/'}],
 'Toys for Tots':[{label:'Marine Toys for Tots',url:'https://www.toysfortots.org/'}]
};

function organizationLinks(record){
 const specific=links[record.id]||{};
 return {social:specific.social||[],parent:specific.parent||parentByType[record.organization_type]||[]};
}

const calendarEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=value=>String(value).padStart(2,'0');
const dayKey=(year,month,day)=>`${year}-${pad(month)}-${pad(day)}`;
const nthWeekday=(year,month,weekday,n)=>{const first=new Date(Date.UTC(year,month-1,1)),offset=(weekday-first.getUTCDay()+7)%7;return dayKey(year,month,1+offset+(n-1)*7);};
const lastWeekday=(year,month,weekday)=>{const last=new Date(Date.UTC(year,month,0)),offset=(last.getUTCDay()-weekday+7)%7;return dayKey(year,month,last.getUTCDate()-offset);};
const birthdayStyles={Army:'army','Coast Guard':'coast-guard','Air Force':'air-force',Navy:'navy','Marine Corps':'marine-corps','Space Force':'space-force'};

function calendarMilestones(year){
 const fixed=[['01-01',"New Year's Day"],['06-19','Juneteenth National Independence Day'],['07-04','Independence Day'],['11-11','Veterans Day'],['12-25','Christmas Day']];
 const holidays=fixed.map(([date,title])=>({date:`${year}-${date}`,title,kind:'Federal holiday'})).concat([
  {date:nthWeekday(year,1,1,3),title:'Birthday of Martin Luther King, Jr.',kind:'Federal holiday'},
  {date:nthWeekday(year,2,1,3),title:"Washington's Birthday",kind:'Federal holiday'},
  {date:lastWeekday(year,5,1),title:'Memorial Day',kind:'Federal holiday'},
  {date:nthWeekday(year,9,1,1),title:'Labor Day',kind:'Federal holiday'},
  {date:nthWeekday(year,10,1,2),title:'Columbus Day',kind:'Federal holiday'},
  {date:nthWeekday(year,11,4,4),title:'Thanksgiving Day',kind:'Federal holiday'}
 ]);
 const birthdays=[['06-14','Army'],['08-04','Coast Guard'],['09-18','Air Force'],['10-13','Navy'],['11-10','Marine Corps'],['12-20','Space Force']].map(([date,branch])=>({date:`${year}-${date}`,title:`${branch} Birthday`,kind:'Service birthday',branch,style:birthdayStyles[branch]}));
 return [...holidays,...birthdays];
}

const eventDate=event=>event.date_only?String(event.start_at).slice(0,10):new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.start_at));
const monthValue=url=>{const value=url.searchParams.get('month');if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value||''))return value;return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(new Date());};
const shiftMonth=(value,amount)=>{const [year,month]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1+amount,1));return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}`;};

function publicMonthCalendar(url,events,{organizationId='',path='/events',includeMilestones=true,title='Community calendar'}={}){
 const selected=monthValue(url),[year,month]=selected.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate(),offset=first.getUTCDay();
 const filtered=events.filter(event=>event.status==='published'&&(!organizationId||event.organization_id===organizationId)).map(event=>({...event,date:eventDate(event)}));
 const items=includeMilestones?[...filtered,...calendarMilestones(year)]:filtered;
 const byDay=new Map;for(const item of items){const list=byDay.get(item.date)||[];list.push(item);byDay.set(item.date,list);}
 const cells=[];for(let position=0;position<42;position++){const day=position-offset+1;if(day<1||day>days){cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');continue;}const date=dayKey(year,month,day),dayItems=byDay.get(date)||[],birthday=dayItems.find(item=>item.kind==='Service birthday');cells.push(`<div class="calendar-day ${birthday?'calendar-birthday birthday-'+birthday.style:''}" ${birthday?`data-branch="${calendarEscape(birthday.branch)}"`:''}><time datetime="${date}">${day}</time><div class="calendar-items">${dayItems.map(item=>item.id?`<a class="calendar-item calendar-event" href="/events/${calendarEscape(item.id)}">${calendarEscape(item.title)}</a>`:`<span class="calendar-item ${item.kind==='Service birthday'?'calendar-service':'calendar-holiday'}">${calendarEscape(item.title)}</span>`).join('')}</div></div>`);}
 const label=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(first),link=value=>`${path}?month=${value}#calendar`;
 return `<section class="panel month-calendar" id="calendar" aria-labelledby="calendar-title"><div class="calendar-heading"><div><span class="eyebrow">MONTH AT A GLANCE</span><h2 id="calendar-title">${calendarEscape(title)}</h2></div><nav aria-label="Choose calendar month"><a href="${calendarEscape(link(shiftMonth(selected,-1)))}">Previous</a><strong>${calendarEscape(label)}</strong><a href="${calendarEscape(link(shiftMonth(selected,1)))}">Next</a></nav></div><div class="calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>${includeMilestones?'<p class="small-note">Federal holidays and military service birthdays are reference dates. Service birthday tiles use original branch-name medallions because official military seals are restricted to authorized use.</p>':''}</section>`;
}

const link=(url,title,description,source)=>`<li><a href="${url}" target="_blank" rel="noopener noreferrer"><strong>${title}</strong><span>${description}</span><small>${source} ↗</small></a></li>`;
const section=(id,title,intro,items)=>`<section class="panel resource-section" id="${id}"><span class="eyebrow">VETERAN RESOURCES</span><h2>${title}</h2><p>${intro}</p><ul class="resource-links">${items.join('')}</ul></section>`;

function resourcesPageContent(){
 const local=section('local','Start with a local benefits counselor','County Veterans Service Offices offer free help understanding and applying for federal, state and local benefits.',[
  link('https://www.yolocounty.gov/government/general-government-departments/health-human-services/adults/veterans-service-office','Yolo County Veterans Service Office','Benefits counseling, claim preparation, appeals, referrals and some transportation support.','Yolo County'),
  link('https://www.solanocounty.gov/government/veterans-services','Solano County Veterans Service Office','Benefits counselors, claim help, walk-in information and appointments.','Solano County'),
  link('https://www.solanocounty.gov/government/veterans-services/veterans-benefit-programs','Solano County Veterans Benefit Programs','A local guide to disability, education, housing, pension and survivor programs.','Solano County')
 ]);
 const disability=section('disability','VA disability and claims','Learn what disability compensation covers, prepare a claim, or connect with free accredited assistance.',[
  link('https://www.va.gov/disability/','VA disability compensation','Eligibility, disability ratings, benefit rates and claim management.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/disability/how-to-file-claim/','How to file a disability claim','Official steps, evidence guidance and ways to file.','U.S. Department of Veterans Affairs'),
  link('https://www.dav.org/get-help-now/','Free DAV benefits assistance','Find DAV help with claims, benefits, transition and transportation.','Disabled American Veterans')
 ]);
 const education=section('education','Education and training','Compare earned education benefits and find the right starting point for college, training or a new career.',[
  link('https://www.va.gov/education/','VA education benefits','GI Bill and other education and training programs.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/education/eligibility/','GI Bill eligibility','Check eligibility for Veterans, service members, spouses and dependents.','U.S. Department of Veterans Affairs'),
  link('https://www.solanocounty.gov/government/veterans-services/veterans-benefit-programs','California college fee waiver guidance','Local information on the CalVet College Fee Waiver and VA education benefits.','Solano County')
 ]);
 const employment=section('employment','Employment and careers','Find job-search help, training, vocational rehabilitation and employers looking for military experience.',[
  link('https://www.va.gov/careers-employment/','VA careers and employment','Career counseling, Veteran Readiness and Employment, training and small-business help.','U.S. Department of Veterans Affairs'),
  link('https://edd.ca.gov/en/jobs_and_training/services_for_veterans/','California services for Veterans','Priority job services, career specialists, training and CalJOBS.','California Employment Development Department'),
  link('https://www.dav.org/member-resources/employment/','DAV employment assistance','Career fairs, job listings and employment resources for Veterans and spouses.','Disabled American Veterans'),
  link('https://www.legion.org/member-services/veterans-services/veterans-careers','American Legion veteran careers','Career events, employer connections and job-search resources.','The American Legion')
 ]);
 const housing=section('housing','Housing and homelessness','Get help buying or keeping a home, adapting a home, preventing homelessness or finding emergency shelter.',[
  link('https://www.va.gov/housing-assistance/','VA housing assistance','VA-backed home loans, housing grants and foreclosure help.','U.S. Department of Veterans Affairs'),
  link('https://www.va.gov/resources/homeless-help/','Homeless and at-risk Veteran help','Confidential 24/7 access to shelter, prevention and long-term housing support.','U.S. Department of Veterans Affairs'),
  link('https://department.va.gov/homeless/','VA homeless programs','HUD-VASH, SSVF, employment, legal and other housing-stability programs.','U.S. Department of Veterans Affairs')
 ]);
 const mental=section('mental-health','Mental health and connection','Connect with confidential counseling, VA mental health care and immediate crisis support.',[
  link('https://www.mentalhealth.va.gov/','VA Mental Health','Understand concerns, explore treatment and connect to care.','U.S. Department of Veterans Affairs'),
  link('https://www.vetcenter.va.gov/','Vet Centers','Confidential counseling and outreach for eligible Veterans, service members and families.','U.S. Department of Veterans Affairs'),
  link('https://www.vetcenter.va.gov/VETCENTER/New_Vet_Centers.asp','Solano County Vet Center Outstation','Official information about the Fairfield outstation and how to make an appointment.','U.S. Department of Veterans Affairs'),
  link('https://www.veteranscrisisline.net/','Veterans Crisis Line','Call 988, then press 1; text 838255; or start a confidential chat.','Veterans Crisis Line')
 ]);
 const network=section('organization-help','Help from organizations in this directory','These national programs connect to organization types already represented in the Yolo-Solano directory.',[
  link('https://www.dav.org/get-help-now/','DAV: Get Help Now','Benefits advocates, transition help, transportation and local support.','Disabled American Veterans'),
  link('https://www.legion.org/advocacy/be-the-one','American Legion: Be the One','Suicide-prevention resources, peer connection and free benefits assistance.','The American Legion'),
  link('https://www.vfw.org/assistance/va-claims-separation-benefits','VFW VA claims and separation benefits','Accredited help with VA claims and benefits at no cost.','Veterans of Foreign Wars')
 ]);
 return `<section class="wrap resources-page"><div class="resource-hero"><span class="eyebrow">REAL LINKS · CLEAR STARTING POINTS</span><h1>Veteran resources.<br><em>Help you can act on.</em></h1><p class="intro">Start locally or choose the kind of help you need. These links go to government agencies and established veteran organizations. Eligibility and availability can change, so confirm details with the provider.</p><div class="resource-urgent"><strong>Need urgent help?</strong><span>For a mental health crisis, call <a href="tel:988">988</a> and press 1 or text <a href="sms:838255">838255</a>. For homelessness or immediate housing risk, call <a href="tel:18774243838">877-424-3838</a>.</span></div></div><nav class="resource-jump" aria-label="Resource categories"><a href="#local">Local help</a><a href="#disability">Disability</a><a href="#education">Education</a><a href="#employment">Employment</a><a href="#housing">Housing</a><a href="#mental-health">Mental health</a></nav><div class="resource-grid">${local}${disability}${education}${employment}${housing}${mental}${network}</div><p class="small-note resource-reviewed">Links reviewed September 4, 2026. This directory does not determine eligibility, provide emergency services or replace advice from an accredited benefits counselor.</p></section>`;
}

const origin = 'https://yolo-county-veterans.smartzgraphics.workers.dev';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const h=escapeHtml;
const mark='<img class="project-logo" src="/ysv-logo.png?v=logo-20260903-1" alt="Yolo Solano Veterans" width="1254" height="1254" decoding="async">';
const external=(url,label,cls='')=>`<a class="${cls}" href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(label)} <span aria-hidden="true">↗</span></a>`;
const button=(url,label,cls='')=>`<a class="button ${cls}" href="${h(url)}">${h(label)} <span aria-hidden="true">→</span></a>`;
function filterRecords(params, list=records) {
 const type=params.get('type')||'',place=params.get('place')||'All locations',q=(params.get('q')||'').trim().toLowerCase().slice(0,200);
 const county=places[place];
 return list.filter(r=>(!type||r.organization_type===type)&&(!county||r.location_county===county||r.service_area?.counties.includes(county))&&(!q||[r.verified_name,r.city,r.location_county,r.member_information,...r.service_categories].join(' ').toLowerCase().includes(q)))
 .sort((a,b)=>Number(b.city===place)-Number(a.city===place)||a.verified_name.localeCompare(b.verified_name));
}
function shellBase(title,description,content,{path='/',detail=false}={}) {
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(title)}</title><meta name="description" content="${h(description)}"><link rel="canonical" href="${origin}${h(path)}"><meta property="og:type" content="website"><meta property="og:title" content="${h(title)}"><meta property="og:description" content="${h(description)}"><meta property="og:url" content="${origin}${h(path)}">${detail?'':`<meta property="og:image" content="${origin}/ysv-logo.png?v=logo-20260903-1"><meta property="og:image:width" content="1254"><meta property="og:image:height" content="1254"><meta property="og:image:alt" content="Yolo Solano Veterans logo">`}<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${h(title)}"><meta name="twitter:description" content="${h(description)}">${detail?'':`<meta name="twitter:image" content="${origin}/ysv-logo.png?v=logo-20260903-1"><meta name="twitter:image:alt" content="Yolo Solano Veterans logo">`}<meta name="theme-color" content="#123c74"><link rel="icon" href="/ysv-logo.png?v=logo-20260903-1" type="image/png"><link rel="stylesheet" href="/styles.css?v=officers-20260903-1"><script src="/app.js?v=officers-20260903-1" defer></script></head><body><a class="skip" href="#main">Skip to content</a><div class="topline"><div class="wrap">A growing local resource · Yolo &amp; Solano counties <a href="https://www.veteranscrisisline.net/">Crisis support: 988, then press 1 ↗</a></div></div><header class="header wrap"><a href="/" class="brand" aria-label="Yolo Solano Veterans">${mark}</a><nav aria-label="Main navigation"><a href="/" ${path==='/'?'aria-current="page"':''}>Find an organization</a><a href="/events" ${path==='/events'?'aria-current="page"':''}>Events</a><a href="/resources" ${path==='/resources'?'aria-current="page"':''}>Resources</a><a href="/about" ${path==='/about'?'aria-current="page"':''}>About the directory</a><a class="nav-workspace" href="/for-organizations">For organizations <span aria-hidden="true">↗</span></a><a class="nav-workspace" href="https://yolo-county-veterans-hq.smartzgraphics.workers.dev/organization">Organization sign-in</a></nav></header><main id="main">${content}</main><footer><div class="wrap footer-inner"><div><a class="footer-brand" href="/">Yolo Solano Veterans</a><p>Local connections. Shared purpose.</p></div><div class="footer-links"><a href="/resources">Veteran resources</a><a href="/about#sources">Our sources</a><a href="/data.json">Directory data</a><a href="/for-organizations">Share an update</a></div></div><div class="wrap fineprint">An independent community directory. Listings do not imply endorsement or partnership. Public sources checked September 2, 2026; confirm details with each organization.</div></footer></body></html>`;
}
function shell(title,description,content,options={}){
 const path=options.path||'/',html=shellBase(title,description,content,options),share=`<a href="/share" ${path==='/share'?'aria-current="page"':''}>Share a program</a>`;
 return html.replace('<a href="/about"',share+'<a href="/about"').replace('<link rel="stylesheet" href="/styles.css?v=officers-20260903-1">','<link rel="stylesheet" href="/styles.css?v=mcl627-20260904-1">').replace('<script src="/app.js?v=officers-20260903-1" defer></script>','<script src="/app.js?v=mcl627-20260904-1" defer></script>').replace('<a href="/for-organizations">Share an update</a>','<a href="/share">Share a program</a><a href="/for-organizations">Share an update</a>');
}
function logoCard(r,place) {
 const logo=brandLogos[r.id]||brandLogos[r.organization_type],city=r.city||r.location_county+' County';
 const label=r.verified_name+' — '+city;
 const fallback=r.id==='little-reata-veterans'?'<span class="logo-wordmark vets-wordmark"><strong>VETs</strong><span>Veterans Equine Therapy</span></span>':`<span class="logo-wordmark"><span>${h(r.location_county)} County</span>Veterans<br>Services</span>`;
 return `<a class="logo-tile ${r.id==='little-reata-veterans'?'logo-tile--vets':r.organization_type==='Toys for Tots'?'logo-tile--toys':r.organization_type==='VFW'?'logo-tile--vfw':''}" href="/organizations/${r.id}" aria-label="${h(label)}"><span class="logo-art">${logo?`<img src="${h(logo.src)}?v=silver-20260902-2" alt="${h(logo.alt)}" width="220" height="130" loading="lazy" decoding="async">`:fallback}</span><span class="logo-reveal"><strong>${h(r.verified_name)}</strong><span>${h(city)}${place===r.city?' · In your city':''}</span>${r.entity_kind==='developing_program'?'<small>Contact for availability</small>':''}<span class="logo-open" aria-hidden="true">View details →</span></span></a>`;
}
function logoGallery(found,place){
 const groups=[{id:'veteran-organizations',title:'Veteran Organizations',types:[['VFW','VFW'],['American Legion','American Legion'],['Marine Corps League','Marine Corps League'],['DAV','DAV'],['Veterans Beer Club','Veterans Beer Club']]},{id:'veteran-nonprofits',title:'Veteran Non-Profits & Programs',types:[['Toys for Tots','Toys for Tots'],['Equine program provider','Veterans Equine Therapy'],['Veteran remembrance program','RememberAVet']]},{id:'veteran-services',title:'County Veterans Services',types:[['County Veterans Office','Benefits & local support']]}];
 return groups.map(group=>{
  const sections=group.types.map(([type,label])=>{
   const items=found.filter(r=>r.organization_type===type).sort((a,b)=>Number(b.city===place)-Number(a.city===place)||a.city?.localeCompare(b.city||'')||a.verified_name.localeCompare(b.verified_name));
   return items.length?`<section class="logo-type-group" aria-label="${h(label)}"><div class="logo-type-heading"><h3>${h(label)}</h3><span>${items.length} ${items.length===1?'connection':'connections'}</span></div><div class="logo-grid">${items.map(r=>logoCard(r,place)).join('')}</div></section>`:'';
  }).join('');
  return sections?`<section class="logo-category" id="${group.id}" aria-labelledby="${group.id}-title"><div class="logo-category-heading"><h2 id="${group.id}-title">${group.title}</h2><span aria-hidden="true">↘</span></div>${sections}</section>`:'';
 }).join('');
}
function directory(url,list=records) {
 const params=url.searchParams,selectedType=types.includes(params.get('type'))?params.get('type'):'',selectedPlace=Object.hasOwn(places,params.get('place'))?params.get('place'):'All locations';
 const canonicalParams=new URLSearchParams(params);canonicalParams.set('type',selectedType);canonicalParams.set('place',selectedPlace);
 const found=filterRecords(canonicalParams,list),q=(params.get('q')||'').slice(0,200),filtered=!!(selectedType||q||selectedPlace!=='All locations');
 return shell('Yolo Solano Veterans | Find your local veteran community','Explore veteran organizations and community programs in Yolo and Solano counties. Choose a logo to find a local post, city and public details.',`<section class="hero logo-hero wrap"><div><span class="eyebrow overline">YOLO &amp; SOLANO · CONNECTED BY SERVICE</span><h1>Find your people.<br><em>Close to home.</em></h1></div><div class="logo-hero-note"><p>Familiar emblems.<br>Local connections.</p><span>Choose a logo to explore its organization.</span></div></section><section class="directory-section logo-directory wrap" aria-labelledby="directory-title"><div class="logo-directory-tools"><h2 id="directory-title" class="sr-only">Find a local veteran organization</h2><nav class="logo-jump-links" aria-label="Browse organization groups"><a href="/#veteran-organizations">Veteran Organizations</a><a href="/#veteran-nonprofits">Non-Profits &amp; Programs</a><a href="/#veteran-services">County Services</a></nav><span class="result-count" role="status">${found.length} local connections</span></div><details class="logo-search" ${filtered?'open':''}><summary>Find a specific post, organization or city <span aria-hidden="true">＋</span></summary><form class="search-panel" method="get" action="/" role="search"><div class="field"><label for="type">Organization type</label><select id="type" name="type"><option value="">All organizations</option>${types.map(t=>`<option value="${h(t)}" ${selectedType===t?'selected':''}>${h(t)}</option>`).join('')}</select></div><div class="field"><label for="place">Location</label><select id="place" name="place">${Object.keys(places).map(p=>`<option ${selectedPlace===p?'selected':''}>${h(p)}</option>`).join('')}</select></div><div class="field query-field"><label for="q">Name or keyword</label><input id="q" name="q" type="search" value="${h(q)}" maxlength="200" placeholder="Post number, city, volunteering…"></div><button class="button" type="submit">Find organizations <span aria-hidden="true">→</span></button></form>${filtered?'<a class="logo-clear" href="/">Show all organizations →</a>':''}</details>${filtered?`<p class="logo-filter-note">${h(selectedPlace)}${selectedType?' · '+h(selectedType):''}${q?' · “'+h(q)+'”':''}. ${selectedPlace!=='All locations'&&!selectedPlace.includes('County')?'Your city appears first within each group.':''}</p>`:''}${found.length?logoGallery(found,selectedPlace):`<div class="empty-state"><h3>No matching records in this starter directory.</h3><p>Try another location or organization type.</p>${button('/','Clear filters')}</div>`}<div class="directory-footnote"><span>◌ A living directory</span><p>Open any profile for contacts, meeting details and sources. Organization names and emblems identify the listed groups; listings do not imply endorsement.</p><a href="/for-organizations">Share an update →</a></div></section>`);
}
function sourceList(ids) {return ids.map(id=>sources.find(s=>s.id===id)).filter(s=>s&&!isRosterURL(s.url)).map(s=>{return `<li>${external(s.url,s.title)}<span>${h(s.publisher)}${s.published_date?' · published '+h(s.published_date):' · publication date not shown'}</span></li>`;}).join('');}
function organizationPhotoGallery(r){
 const photos=r.photos||[],editor='https://yolo-county-veterans-hq.smartzgraphics.workers.dev/organization?org='+encodeURIComponent(r.id)+'#photos';
 const albums=new Map;for(const photo of photos){const key=photo.album?.id||'',group=albums.get(key)||{album:photo.album,photos:[]};group.photos.push(photo);albums.set(key,group);}
 const card=p=>{const present=(p.present_organizations||[]).map(org=>`<a href="/organizations/${encodeURIComponent(org.id)}">${h(org.name)}</a>`).join(' · '),join='https://yolo-county-veterans-hq.smartzgraphics.workers.dev/photo-presence?photo='+encodeURIComponent(p.id);return `<figure class="photo-card"><a class="photo-open" href="${h(p.src)}" target="_blank" rel="noopener noreferrer" aria-label="${h('Open photo: '+p.alt_text)}"><img src="${h(p.src)}" alt="${h(p.alt_text)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a><figcaption><p class="photo-present"><strong>Organizations present:</strong> ${present||h(r.verified_name)} <a class="photo-add-org" href="${h(join)}" aria-label="Add your organization to this photo">+ Add your organization</a></p>${p.caption?`<p>${h(p.caption)}</p>`:''}<span class="photo-credit">${h(p.credit)}${p.source_url?(p.credit?' · ':'')+external(p.source_url,'Photo source'):''}${p.license?`<span class="photo-license">${p.license_url?external(p.license_url,p.license):h(p.license)}</span>`:''}</span></figcaption></figure>`;};
 const groups=[...albums.values()].map(group=>`<section class="photo-album"><h3>${h(group.album?.name||'Photos')}</h3>${group.album?.description?`<p class="photo-album-description">${h(group.album.description)}</p>`:''}<div class="photo-grid">${group.photos.map(card).join('')}</div></section>`).join('');
 return `<section class="panel organization-photos" id="photos" aria-labelledby="photos-title"><div class="photo-heading"><div><span class="eyebrow">OUR PLACES · OUR COMMUNITY</span><h2 id="photos-title">Photos</h2></div><a class="button outline" href="${h(editor)}">Add photos →</a></div>${photos.length?groups:'<div class="photo-empty"><p>Share the places, events and people that bring your organization together.</p></div>'}<p class="small-note">Authorized representatives can add photos, create albums and manage collaboration through their organization editor.</p></section>`;
}
function regionalHome(url,list=records,events=[]) {
 const params=url.searchParams,selectedType=types.includes(params.get('type'))?params.get('type'):'',selectedPlace=Object.hasOwn(places,params.get('place'))?params.get('place'):'All locations';
 const canonicalParams=new URLSearchParams(params);canonicalParams.set('type',selectedType);canonicalParams.set('place',selectedPlace);
 const found=filterRecords(canonicalParams,list),q=(params.get('q')||'').slice(0,200),filtered=!!(selectedType||q||selectedPlace!=='All locations');
 const now=Date.now(),upcoming=events.filter(event=>event.status==='published'&&Date.parse(event.end_at||event.start_at)+86400000>=now).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at)).slice(0,3);
 const date=event=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'}).format(new Date(event.start_at));
 const eventCards=upcoming.map(event=>`<article class="regional-event-card" data-reveal><span>${h(date(event))}</span><h3>${h(event.title)}</h3><p>${h(event.city||event.county+' County')} &middot; ${h(event.venue)}</p><a href="/events/${encodeURIComponent(event.id)}">Event details <span aria-hidden="true">&rarr;</span></a></article>`).join('')||'<article class="regional-event-card"><h3>More community events are being verified.</h3><a href="/events">Open the community calendar &rarr;</a></article>';
 const featuredIds=['veterans-beer-club-yolo-solano','rememberavet','little-reata-veterans','mcl-yolo'],featured=featuredIds.map(id=>list.find(record=>record.id===id)).filter(Boolean);
 const featuredCards=featured.map(record=>{const logo=brandLogos[record.id]||brandLogos[record.organization_type];return `<a class="featured-org-card" href="/organizations/${record.id}" data-reveal><span class="featured-org-logo">${logo?`<img src="${h(logo.src)}" alt="${h(logo.alt)}" loading="lazy">`:`<strong>${h(record.verified_name.slice(0,2).toUpperCase())}</strong>`}</span><span class="eyebrow">${h(record.city||record.location_county+' counties')}</span><h3>${h(record.verified_name)}</h3><span class="featured-tags">${record.service_categories.slice(0,2).map(tag=>`<b>${h(tag)}</b>`).join('')}</span><span class="featured-action">View organization &rarr;</span></a>`;}).join('');
 const search=`<form class="regional-search" method="get" action="/yolo-solano" role="search"><label><span>Organization type</span><select name="type"><option value="">All organizations</option>${types.map(type=>`<option value="${h(type)}" ${selectedType===type?'selected':''}>${h(type)}</option>`).join('')}</select></label><label><span>Location</span><select name="place">${Object.keys(places).map(place=>`<option ${selectedPlace===place?'selected':''}>${h(place)}</option>`).join('')}</select></label><label class="regional-query"><span>Name or keyword</span><input name="q" type="search" value="${h(q)}" maxlength="200" placeholder="Post, city, benefit or program"></label><button class="button" type="submit">Search the region</button></form>`;
 const directoryContent=found.length?logoGallery(found,selectedPlace):'<div class="empty-state"><h3>No matching organizations yet.</h3><p>Try another location or organization type.</p><a class="button outline" href="/yolo-solano#directory">Clear filters</a></div>';
 return shell('Yolo-Solano Veterans | NorCal Veterans','Organizations, events, resources and county services for veterans across Yolo and Solano counties.',`<div class="regional-home"><section class="regional-hero"><img class="regional-hero-photo" src="/organization-photos/seed-photo-rememberavet" alt="Veteran community volunteers among memorial headstones decorated with holiday boughs"><div class="regional-hero-shade"></div><div class="regional-hero-content wrap"><img class="norcal-logo" src="/published-assets/norcal-veterans.png" alt="NorCal Veterans"><span class="eyebrow">THE YOLO-SOLANO REGION</span><h1>Find your people.<br><em>Close to home.</em></h1><p>One place for the veteran community across Yolo and Solano counties: what is happening, who is here, what help is available, and how to connect.</p><div class="regional-hero-actions"><a class="button light" href="#directory">Find an organization</a><a class="button hero-outline" href="/events">See upcoming events</a></div></div></section>
 <nav class="regional-quick wrap" aria-label="Explore Yolo-Solano"><a href="#directory"><strong>Organizations</strong><span>Find your local community</span></a><a href="/events"><strong>Events</strong><span>Show up and connect</span></a><a href="/resources"><strong>Benefits &amp; resources</strong><span>Start with trusted help</span></a><a href="#county-services"><strong>County services</strong><span>Benefits and claims support</span></a><a href="#get-involved"><strong>Get involved</strong><span>Share, volunteer, lead</span></a></nav>
 <section class="regional-section wrap" id="events"><div class="regional-heading" data-reveal><div><span class="eyebrow">UPCOMING IN OUR REGION</span><h2>There is a place for you here.</h2></div><a href="/events">View the full calendar &rarr;</a></div><div class="regional-event-grid">${eventCards}</div></section>
 <section class="regional-section regional-featured"><div class="wrap"><div class="regional-heading" data-reveal><div><span class="eyebrow">FEATURED CONNECTIONS</span><h2>Meet the organizations doing the work.</h2></div><a href="#directory">Browse all ${list.length} organizations &rarr;</a></div><div class="featured-org-grid">${featuredCards}</div></div></section>
 <section class="regional-story"><img src="/organization-photos/seed-photo-little-reata-veterans" alt="Horses in a sunlit Northern California pasture"><div class="regional-story-shade"></div><div class="wrap" data-reveal><span class="eyebrow">LOCAL PEOPLE &middot; SHARED SERVICE</span><blockquote>Service continues here: in meeting halls, at community events, on farms, and wherever veterans help veterans.</blockquote><a class="button light" href="/share">Share a program or collaboration</a></div></section>
 <section class="regional-directory wrap" id="directory"><div class="regional-heading" data-reveal><div><span class="eyebrow">THE FULL YOLO-SOLANO DIRECTORY</span><h2>Explore every local connection.</h2></div><span class="result-count">${found.length} organizations shown</span></div>${search}${filtered?`<p class="logo-filter-note">Showing ${h(selectedPlace)}${selectedType?' &middot; '+h(selectedType):''}${q?' &middot; &ldquo;'+h(q)+'&rdquo;':''}. <a href="/yolo-solano#directory">Clear filters</a></p>`:''}${directoryContent}</section>
 <section class="county-service-band" id="county-services"><div class="wrap" data-reveal><div><span class="eyebrow">OFFICIAL COUNTY SUPPORT</span><h2>Benefits help, close to home.</h2><p>County Veteran Service Offices help veterans, dependents and survivors navigate claims, records, healthcare enrollment and local referrals.</p></div><div><a href="/organizations/vso-yolo"><strong>Yolo County</strong><span>Woodland &middot; 530-406-4850</span><b>Open service office &rarr;</b></a><a href="/organizations/vso-solano"><strong>Solano County</strong><span>Fairfield &middot; 707-784-6590</span><b>Open service office &rarr;</b></a></div></div></section>
 <section class="regional-involved wrap" id="get-involved" data-reveal><span class="eyebrow">BUILD THE NETWORK WITH US</span><h2>Know something this community should see?</h2><p>Share an event, introduce an organization, volunteer your expertise, or help keep a local page accurate.</p><div><a class="button" href="/for-organizations">Add or update an organization</a><a class="button outline" href="/share">Share a program</a><a class="button outline" href="/events">Explore events</a></div></section></div>`,{path:url.pathname==='/'?'/':'/yolo-solano'});
}
function organizationOfficerDirectory(r){
 const officers=Array.isArray(r.officer_profiles)?r.officer_profiles.map(sanitizePublicOfficer).filter(Boolean):[],editor='https://yolo-county-veterans-hq.smartzgraphics.workers.dev/organization?org='+encodeURIComponent(r.id)+'#officers';
 return `<details class="panel organization-officers" id="officers"><summary><span><span class="eyebrow">VOLUNTARY PUBLIC PROFILES</span><strong>Officers</strong></span><span class="officer-count">${officers.length?officers.length+' '+(officers.length===1?'profile':'profiles'):'Open'}</span></summary>${officers.length?`<div class="officer-grid">${officers.map(o=>`<article class="officer-card">${o.photo?`<img src="${h(o.photo.src)}" alt="${h(o.photo.alt_text)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<div class="officer-placeholder" aria-hidden="true">${h(o.public_name.slice(0,1).toUpperCase())}</div>`}<div><span class="eyebrow">${h(o.title)}</span><h3>${h(o.public_name)}</h3><p class="preserve-lines">${h(o.bio)}</p></div></article>`).join('')}</div>`:'<div class="officer-empty"><p>No officer profiles have been provided for publication. Authorized organization representatives may add a voluntary profile after the person agrees to public use of their name, title, bio and selected photo.</p></div>'}<p class="small-note">These voluntary profiles are provided with the individuals' permission. They are not a complete officer roster.</p><a href="${h(editor)}">Add or update officer profiles →</a></details>`;
}
function mclYoloSite(r,events,url){
 const contact=r.public_contacts||{},logo=brandLogos[r.id]||brandLogos[r.organization_type],editor='https://yolo-county-veterans-hq.smartzgraphics.workers.dev/organization?org='+encodeURIComponent(r.id);
 const publicLinks=[contact.phone?`<a class="button light" href="tel:${h(contact.phone)}">Call ${h(contact.phone)}</a>`:'',contact.email?`<a class="button light" href="mailto:${h(contact.email)}">Email the detachment</a>`:'',contact.website?external(contact.website,'Official organization site','button light'):''].filter(Boolean).join('');
 const sourceNotice=r.source_ids.length?`<ul>${sourceList(r.source_ids)}</ul>`:'<p>A suitable public detachment source is still being confirmed. Personal details from roster-style sources are intentionally withheld.</p>';
 const location=r.address?.text||'Woodland, California';
 return shell('Marine Corps League Yolo County Detachment 627','The local web home for Marine Corps League Yolo County Detachment 627, with meeting information, events, resources, photos and organization updates.',`<div class="org-site mcl-site">
  <nav class="org-site-nav wrap" aria-label="Detachment 627"><a class="org-site-identity" href="/mcl-yolo">${logo?`<img src="${h(logo.src)}" alt="${h(logo.alt)}">`:''}<span><strong>Detachment 627</strong><small>Yolo County, California</small></span></a><div><a href="#about">About</a><a href="#events">Events</a><a href="#resources">Resources</a><a href="#photos">Photos</a><a href="#contact">Contact</a></div></nav>
  <section class="org-site-hero"><div class="org-site-hero-mark" aria-hidden="true">627</div><div class="wrap org-site-hero-grid"><div data-reveal><span class="sr-only">${h(r.verified_name)}</span><span class="eyebrow">MARINE CORPS LEAGUE · YOLO COUNTY</span><h1>Built on service.<br><em>Connected locally.</em></h1><p>A dedicated local home for Marine Corps League Yolo County Detachment 627: meetings, events, resources, photos and the public information the detachment chooses to share.</p><div class="org-site-actions"><a class="button light" href="#contact">Connect with the detachment</a><a class="button hero-outline" href="#events">See events</a></div></div>${logo?`<div class="org-site-emblem" data-reveal><img src="${h(logo.src)}" alt="${h(logo.alt)}"></div>`:''}</div></section>
  <section class="org-site-intro wrap" id="about"><div data-reveal><span class="eyebrow">WELCOME TO DETACHMENT 627</span><h2>A place to gather, serve and stay connected.</h2><p>${h(r.member_information)}</p></div><dl data-reveal><div><dt>Local area</dt><dd>${h(r.city)}, ${h(r.location_county)} County</dd></div><div><dt>Published meeting venue</dt><dd>${h(location)}</dd></div><div><dt>Meeting schedule</dt><dd>${h(r.meeting_schedule||'Current schedule awaiting detachment confirmation')}</dd></div></dl></section>
  <section class="org-site-pillars"><div class="wrap"><div class="org-site-heading" data-reveal><span class="eyebrow">THIS SITE BELONGS TO THE ORGANIZATION</span><h2>Everything Detachment 627 needs for a useful public web home.</h2></div><div class="org-site-card-grid"><article data-reveal><span>01</span><h3>Meet locally</h3><p>Publish confirmed meeting times, visitor information and changes in one reliable place.</p><a href="#contact">Meeting information →</a></article><article data-reveal><span>02</span><h3>Share what is happening</h3><p>Detachment events can appear here and in the shared Yolo-Solano regional calendar.</p><a href="#events">Open the calendar →</a></article><article data-reveal><span>03</span><h3>Tell the detachment story</h3><p>Authorized representatives can add public photos, officer profiles and organization updates through the private editor.</p><a href="${h(editor)}">Organization editor →</a></article></div></div></section>
  <section class="wrap org-site-calendar" id="events"><div class="org-site-heading" data-reveal><span class="eyebrow">DETACHMENT CALENDAR</span><h2>Meetings and events, in one place.</h2><p>Confirmed Detachment 627 events will appear here while also helping the wider regional community find ways to connect.</p></div>${publicMonthCalendar(url,events,{organizationId:r.id,path:'/mcl-yolo',includeMilestones:false,title:'Detachment 627 calendar'})}<p class="small-note">No event on a date means a public event has not yet been published. Contact the detachment before planning a visit.</p></section>
  <section class="org-site-resources" id="resources"><div class="wrap"><div class="org-site-heading" data-reveal><span class="eyebrow">USEFUL STARTING POINTS</span><h2>Local connection. Wider support.</h2></div><div class="org-site-resource-grid"><a href="https://www.mclnational.org/" target="_blank" rel="noopener noreferrer"><strong>Marine Corps League National Headquarters</strong><span>National programs, news and League information ↗</span></a><a href="/organizations/vso-yolo"><strong>Yolo County Veterans Services</strong><span>Local benefits and claims support →</span></a><a href="/resources"><strong>Veteran resource guide</strong><span>Benefits, education, employment, housing and wellness →</span></a><a href="/events"><strong>Yolo-Solano community calendar</strong><span>Events across the region →</span></a></div></div></section>
  <section class="wrap org-site-community" id="photos"><div class="org-site-heading" data-reveal><span class="eyebrow">THE DETACHMENT IN ACTION</span><h2>Photos and people.</h2><p>This space grows with the organization. Authorized representatives choose the public photos and voluntary profiles that tell Detachment 627's story.</p></div>${organizationPhotoGallery(r)}${organizationOfficerDirectory(r)}</section>
  <section class="org-site-contact" id="contact"><div class="wrap org-site-contact-grid" data-reveal><div><span class="eyebrow">CONTACT DETACHMENT 627</span><h2>Ready to connect?</h2><p>${publicLinks?'Use the detachment’s public contact options below.':'A current public phone, email and organization website have not yet been verified. The detachment can publish them through its private editor.'}</p><div class="org-site-actions">${publicLinks}<a class="button ${publicLinks?'outline':'light'}" href="/for-organizations?org=${r.id}">Submit a public update</a></div></div><aside><strong>Manage this organization site</strong><p>Authorized representatives can update public contact details, meeting information, events, photos and officer profiles without managing a separate hosting account.</p><a href="${h(editor)}">Open the organization editor →</a></aside></div></section>
  <section class="wrap org-site-sources"><details><summary>Sources for this profile</summary>${sourceNotice}<p class="small-note">Public information checked ${h(r.last_verified_date)}. This page is part of NorCal Veterans and does not claim organization confirmation where it has not been received.</p></details><a href="/yolo-solano">Explore the Yolo-Solano region →</a></section>
 </div>`,{path:'/mcl-yolo',detail:true});
}
function profile(r,events,url) {
 const description=`Public contacts, meeting information and sources for ${r.verified_name}.`;
 const contact=r.public_contacts;
 const related=organizationLinks(r),linkList=items=>items.map(item=>`<li>${external(item.url,item.label)}</li>`).join('');
 const connections=`<section class="panel"><h2>Social media &amp; parent organizations</h2><h3>Official social pages</h3>${related.social.length?`<ul>${linkList(related.social)}</ul>`:'<p>No official local social page has been verified for this listing yet.</p>'}<h3>Parent organization links</h3>${related.parent.length?`<ul>${linkList(related.parent)}</ul>`:'<p>This listing does not have a parent organization link.</p>'}</section>`;
 return shell(`${r.verified_name} | Yolo Solano Veterans`,description,`<div class="wrap detail-page"><a class="back" href="/?place=${encodeURIComponent(r.location_county+' County')}">← Back to ${h(r.location_county)} County directory</a><div class="profile-heading"><span class="eyebrow">${h(r.organization_type)} · ${h(r.location_county)} COUNTY</span><h1>${h(r.verified_name)}</h1><p>${h(r.member_information)}</p><div class="profile-actions">${contact.website?external(contact.website,'Visit organization website','button'):''}${contact.phone?`<a class="button outline" href="tel:${h(contact.phone)}">Call ${h(contact.phone)}</a>`:''}${contact.email?`<a class="button outline" href="mailto:${h(contact.email)}">Email organization</a>`:''}<a class="button outline" href="#officers">View officers</a></div></div>${organizationOfficerDirectory(r)}${organizationPhotoGallery(r)}${publicMonthCalendar(url,events,{organizationId:r.id,path:'/organizations/'+r.id,includeMilestones:false,title:r.verified_name+' events'})}<div class="profile-grid"><div><section class="panel"><h2>Plan your visit</h2>${r.reviewed_update?`<p class="small-note">A public correction was reviewed ${h(r.reviewed_update.reviewed_at.slice(0,10))}. ${external(r.reviewed_update.source_url,'Correction source')}</p>`:''}<dl><div><dt>${r.hours?'Published office hours':'Published meeting schedule'}</dt><dd>${h(r.hours||r.meeting_schedule||'Not yet verified. Contact the organization for current details.')}</dd></div><div><dt>${r.address?.type==='mailing'?'Mailing address (not a visitor office)':r.address?.type==='service_office'?'Service office':r.address?.type==='program_venue'?'Published venue':'Meeting location'}</dt><dd>${h(r.address?.text||'No current public service location verified.')}${r.address?.map_eligible?'<br>'+external('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(r.address.text),'Open address in Maps'):''}</dd></div><div><dt>Who can participate?</dt><dd>${h(r.audience||r.eligibility||'Local membership and visitor requirements have not been verified.')}</dd></div><div><dt>Service area</dt><dd>${h(r.service_area?.notes||'A local location is listed; the organization’s service boundary has not been confirmed.')}</dd></div></dl><p class="small-note">Meeting times are in Pacific time. Published schedules may change; check with the organizer before attending. A meeting venue does not establish walk-in service availability.</p></section><section class="panel"><h2>Activities &amp; member information</h2><p><a href="/events">Explore the shared event calendar →</a></p><p>${h(r.event_information?.text||'Consult the organization for activities and visit the shared event calendar for researched upcoming events.')}</p>${r.event_information?.status==='past'?'<span class="label amber">Historical event — not an upcoming listing</span>':''}${r.partnership_notes?`<h3>Published coordination notes</h3><p>${h(r.partnership_notes)}</p>`:''}<p>${h(r.referral_notes)}</p></section>${connections}</div><aside><section class="panel trust-panel"><span class="label">Public-source review</span><h2>Know what’s verified.</h2><p>Sources checked <strong>September 2, 2026</strong>. This profile has not been claimed or directly confirmed by the organization.</p><dl><div><dt>Research confidence</dt><dd>${h(r.confidence)} · supporting facts only</dd></div><div><dt>Still to confirm</dt><dd>${r.missing_data_flags.map(f=>h(f.replaceAll('_',' '))).join('<br>')}</dd></div></dl></section><section class="panel source-panel"><h2>Sources for this profile</h2>${r.source_ids.length?`<ul>${sourceList(r.source_ids)}</ul>`:'<p>A supporting directory link is withheld because it contains personal information. A suitable public organization source is still being confirmed.</p>'}</section><section class="panel"><h2>Represent this organization?</h2><p>Suggest an organization profile or meeting update for review. Designated representatives can also use their organization editor.</p><a href="/for-organizations?org=${r.id}">Submit an update →</a></section></aside></div></div>`,{path:'/organizations/'+r.id,detail:true});
}
function about(){return shell('About & sources | Yolo Solano Veterans','How the directory is researched, how to read its records, and what is planned next.',`<section class="wrap about-page"><span class="eyebrow">BUILT ON LOCAL KNOWLEDGE</span><h1>A useful starting point.<br><em>A community effort.</em></h1><p class="intro">Yolo Solano Veterans connects people with local veteran organizations. This first collection includes Yolo and Solano counties and will grow with community input.</p><div class="three-up"><article><h2>For veterans &amp; families</h2><p>Find a post, explore a meeting or reach a county service office without creating an account.</p></article><article><h2>For organizations</h2><p>Make public information easier to find and lay the foundation for shared events and coordination.</p></article><article><h2>For a stronger network</h2><p>Keep sources visible, maintain useful contacts and give each organization a clear stewardship role.</p></article></div><section class="panel" id="sources"><h2>How to read the directory</h2><p><strong>“Source checked” means public information was reviewed on September 2, 2026.</strong> It does not mean an organization approved a profile, that a current officer term was confirmed, or that a service is available today.</p><p>We favor organization websites, official national/state directories and county sources. We keep meeting schedules separate from office hours, locations separate from service areas, and historical campaigns separate from upcoming events. Conflicting contacts and unverified details are flagged.</p><p>This initial collection contains ${records.length} records and is not exhaustive. A missing organization or an empty search is a research gap, not evidence that services do not exist. Some official directory pages were available through search extracts but could not be opened directly; their source notes retain that limitation.</p><h3>Privacy in this release</h3><p>We publish organization contact channels and public office or meeting venues. We do not publish member or officer rosters, personal addresses, personal phone numbers, or personal email addresses collected from online directories. Online availability is not permission to republish someone’s personal information.</p><p>The public submission desk stores proposed organization information plus a private reply name and email for review. Approved public details may be published; reply contacts stay private. Do not submit veteran case details, discharge papers or medical information. Searches are not saved by this application. A short-lived hashed network identifier limits form spam and is removed on later submissions after expiry; hosting providers process ordinary request information. External links follow their own privacy practices.</p><h3>Corrections and future stewardship</h3><p>Confirm important details with the organization before a visit. Use the organization submission desk to request a correction or removal, propose an event, or request stewardship. The owner reviews submissions; requesting stewardship does not grant account access. Aaron and Sterling can designate representatives to manage only their assigned organization pages after sign-in activation.</p><a href="/data.json">Download the structured records and source details →</a></section><section class="panel source-panel"><h2>Research sources</h2><ul class="all-sources">${sourceList(sources.map(s=>s.id))}</ul></section></section>`,{path:'/about'});}
function render(url,list=records,events=[]){
 list=list.map(record=>{const officer_profiles=Array.isArray(record.officer_profiles)?record.officer_profiles.map(sanitizePublicOfficer).filter(Boolean):[];return {...sanitizePublicRecord(record),officer_profiles};});
 if(url.pathname==='/'||url.pathname==='/yolo-solano')return {status:200,html:regionalHome(url,list,events)};
 if(url.pathname==='/mcl-yolo'){const r=list.find(record=>record.id==='mcl-yolo');if(r)return {status:200,html:mclYoloSite(r,events,url)};}
 if(url.pathname==='/resources')return {status:200,html:shell('Veteran resources | Yolo Solano Veterans','Verified starting points for disability, education, employment, housing and mental health support.',resourcesPageContent(),{path:'/resources'})};
 if(url.pathname==='/about')return {status:200,html:about()};
 if(url.pathname.startsWith('/organizations/')){const r=list.find(r=>r.id===url.pathname.split('/')[2]);if(r&&url.pathname==='/organizations/'+r.id)return {status:200,html:r.id==='mcl-yolo'?mclYoloSite(r,events,url):profile(r,events,url)};}
 return {status:404,html:shell('Page not found | Yolo Solano Veterans','Return to the veteran organization directory.',`<section class="wrap empty-state"><h1>Let’s find your way back.</h1><p>This page isn’t in the directory.</p>${button('/','Explore organizations')}</section>`,{detail:true,path:'/404'})};
}


// Public output is assembled from explicit public fields. Private tables never feed the directory.
const hqOrigin='https://yolo-county-veterans-hq.smartzgraphics.workers.dev';
const securityHeaders={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
function safeURL(value,required=false){
 const text=String(value||'').trim(); if(!text&&!required)return '';
 let u;try{u=new URL(text);}catch{throw new Error('Use a complete https:// source or website link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.href.length>2000)throw new Error('Links must use HTTPS without a username or password.');
 return u.href;
}
function field(form,key,max=500,required=false){const s=String(form.get(key)||'').trim();if(s.length>max||s.includes('\u0000'))throw new Error(`${key.replaceAll('_',' ')} is too long or invalid.`);if(required&&!s)throw new Error(`Please provide ${key.replaceAll('_',' ')}.`);return s;}
function choice(value,choices){if(!choices.includes(value))throw new Error('Choose a valid option.');return value;}
function pacificDate(value){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?-0[78]:00$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Use a valid ISO date with a -07:00 or -08:00 offset.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 const actual=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
 const input=value.slice(0,-6);if(actual!==(input.length===16?input+':00':input))throw new Error('That date or Pacific-time offset is incorrect. Check the calendar date and daylight-saving time.');
 return value;
}
async function formData(request){
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original page.');
 if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw new Error('Unsupported form format.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Empty form.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000){await reader.cancel();throw new Error('This submission is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new URLSearchParams(new TextDecoder().decode(bytes));
}
async function publicData(db,baseRecords,baseEvents=[]){
 baseRecords=baseRecords.map(sanitizePublicRecord);
 if(!db)return {records:baseRecords,events:baseEvents};
 const [updates,eventRows,photoRows,officerRows,albumRows,presenceRows,meetingRows]=await Promise.all([db.prepare('SELECT org_id, body_json, source_url, reviewed_at FROM profile_updates').all(),db.prepare("SELECT id, body_json, status FROM events WHERE status = 'published'").all(),db.prepare('SELECT id,org_id,image_url,caption,alt_text,credit,source_url,license,license_url,album_id FROM organization_photos ORDER BY created_at,id').all(),organizationOfficerRows(db),db.prepare('SELECT id,org_id,name,description FROM organization_photo_albums ORDER BY created_at,id').all(),db.prepare("SELECT photo_id,org_id FROM organization_photo_presence WHERE status='approved' ORDER BY requested_at,id").all(),db.prepare('SELECT id,org_id,event_date,start_time,title,notes FROM organization_meetings ORDER BY event_date,id').all()]);
 const byId=new Map(updates.results.map(r=>[r.org_id,r]));
 const merged=baseRecords.map(r=>{const row=byId.get(r.id);if(!row)return r;const p=JSON.parse(row.body_json);try{assertPublicProfilePrivacy({...p,source_url:row.source_url});}catch{return r;}return sanitizePublicRecord({...r,meeting_schedule:p.meeting_schedule,member_information:p.member_information,public_contacts:{phone:p.phone||null,email:p.email||null,website:p.website||null},reviewed_update:{source_url:row.source_url,reviewed_at:row.reviewed_at}});});
 const names=new Map(merged.map(record=>[record.id,record.verified_name]));
 const publicPhotos=photoRows.results.map(photo=>{const album=albumRows.results.find(row=>row.id===photo.album_id&&row.org_id===photo.org_id);return {...photo,album:album?{id:album.id,name:album.name,description:album.description}:null,present_organizations:presenceRows.results.filter(row=>row.photo_id===photo.id&&names.has(row.org_id)).map(row=>({id:row.org_id,name:names.get(row.org_id)}))};});
 const meetingEvents=meetingRows.results.map(row=>{const org=merged.find(r=>r.id===row.org_id);if(!org)return null;let start_at='';for(const offset of ['-07:00','-08:00']){try{start_at=pacificDate(row.event_date+'T'+row.start_time+':00'+offset);break;}catch{}}if(!start_at)return null;return {id:'organization-meeting-'+row.id,title:row.title,organization_id:row.org_id,organizer:org.verified_name,kind:'Organization meeting',county:org.location_county,city:org.city||'',venue:org.address?.text||'Contact the organization for the meeting location.',start_at,end_at:null,audience:org.audience||'Contact the organization for attendance details.',description:row.notes||'Monthly organization meeting.',source_url:org.public_contacts?.website||'',source_checked:null,time_note:'Published by an authorized organization representative.',source_kind:'project_team',source_note:'Published from the organization yearly meeting planner.',status:'published'};}).filter(Boolean);
 return {records:merged.map(r=>({...sanitizePublicRecord({...r,photos:publicPhotos.filter(p=>p.org_id===r.id)}),officer_profiles:officerRows.filter(o=>o.org_id===r.id).map(sanitizePublicOfficer).filter(Boolean)})),events:[...eventRows.results.map(row=>({...JSON.parse(row.body_json),id:row.id,status:'published'})),...meetingEvents]};
}
async function submitIntake(request,db,validIds){
 if(!db)throw new Error('The submission desk is temporarily unavailable. Please try again later.');
 const f=await formData(request);if(field(f,'website_check'))throw new Error('Submission could not be accepted.');
 if(f.get('privacy')!=='yes')throw new Error('Please confirm that your message contains public organization information only.');
 const kind=choice(field(f,'kind'),['profile','event','claim','other']),org_id=field(f,'org_id',100)||null;
 if(org_id&&!validIds.includes(org_id))throw new Error('Choose an organization from the list.');
 const title=field(f,'title',180,true),details=field(f,'details',6000,true),sender_name=field(f,'sender_name',120,true),sender_email=field(f,'sender_email',254,true),source_url=safeURL(field(f,'source_url',2000));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender_email))throw new Error('Please enter a valid contact email.');
 const now=new Date().toISOString(),hour=now.slice(0,13),ip=request.headers.get('CF-Connecting-IP');
 if(!ip)throw new Error('Submission could not be verified. Please try again.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+'|'+hour));
 const bucket=hour+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const expiry=new Date(Date.now()+86400000).toISOString();
 const checks=await db.batch([
 db.prepare('DELETE FROM intake_limits WHERE expires_at < ?').bind(now),
 db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count').bind(bucket,expiry),
 db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) SELECT ?,1,? WHERE changes()>0 ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<500 RETURNING count').bind('global:'+now.slice(0,10),expiry)]);
 if(!checks[1].results.length||!checks[2].results.length)throw new Error('The submission limit has been reached. Please try again tomorrow.');
 const id=crypto.randomUUID();
 await db.prepare('INSERT INTO requests(id,kind,org_id,title,details,sender_name,sender_email,source_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,kind,org_id,title,details,sender_name,sender_email,source_url,now,now).run();return id;
}
async function getOwner(request,env,ctx){
 // Only platform-provided identity is trusted; user-controlled email/JWT headers are ignored.
 if(!env.OWNER_EMAIL||!env.ACCESS_AUD||!ctx?.access||ctx.access.aud!==env.ACCESS_AUD)return null;
 const identity=await ctx.access.getIdentity();
 const allowed=[env.OWNER_EMAIL,...String(env.HQ_EDITOR_EMAILS||'').split(',')].map(x=>x.trim().toLowerCase()).filter(Boolean);
 return identity?.email&&allowed.includes(identity.email.toLowerCase())?identity.email:null;
}
const responseHTML=(html,status=200,privatePage=false)=>new Response(html,{status,headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'no-store':'public, max-age=30',...(privatePage?{'X-Robots-Tag':'noindex, nofollow'}:{})}});
const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});

const staticAssetParts={
 '/ysv-logo.png':3,'/og.png':1,'/logos/veterans-equine-therapy.jpg':1,'/logos/vfw.png':1,
 '/logos/american-legion.png':1,'/logos/dav.svg':1,'/logos/marine-corps-league.png':1,
 '/logos/toys-for-tots.svg':1,'/logos/rememberavet.png':1
};
const staticAssetTypes={'.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
async function readStaticAsset(request,env,path){
 const count=staticAssetParts[path];if(!count||!env.ATTACHMENTS)return null;
 const pieces=[];for(let i=0;i<count;i++){const object=await env.ATTACHMENTS.get('public-static'+path+'.b64.'+i);if(!object)return null;pieces.push(await object.text());}
 const base64=pieces.join(''),bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),ext=path.slice(path.lastIndexOf('.'));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{...securityHeaders,'Content-Type':staticAssetTypes[ext]||'application/octet-stream','Cache-Control':'public, max-age=86400, immutable'}});
}

const publishedAssets={
 '/published-assets/vbc-yolo-solano.png':{
  key:'requests/618eb41a-a8cf-4cf3-87cc-def5105082c2/1c661dd2-54fd-46b0-a443-b19c97b76a2e',
  type:'image/png',size:1469913,
  sha256:'924d0e9cb9c8fdd6e15abd7c62e3db400f2b441cdf7653336f8310a826e2959a'
 },
 '/published-assets/norcal-veterans.png':{
  key:'requests/a5d549f1-1dca-4ba3-8564-3e5a933ef8c2/fc4c8d5e-24c9-4445-8878-7668e6c08915',
  type:'image/png',size:1481060,
  sha256:'4435dcb967330a0a74ebc58e28f34540da0087f7d61bfa989b9124ed5768b771'
 }
};
const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400, immutable'};
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
async function readPublishedRequestAsset(request,env,path){
 const asset=publishedAssets[path];if(!asset)return null;
 const fallback=()=>{const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Wl5sAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),bytes=new Uint8Array(128);bytes.set(png);return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':'image/png','Content-Length':String(bytes.length)}});};
 if(!env.ATTACHMENTS)return fallback();
 const object=await env.ATTACHMENTS.get(asset.key);if(!object)return fallback();
 try{
  const envelope=await object.json();
  if(envelope.schema_version!==1||envelope.byte_size!==asset.size||envelope.sha256!==asset.sha256||typeof envelope.base64!=='string'||envelope.base64.length!==4*Math.ceil(asset.size/3))return null;
  const decoded=atob(envelope.base64);if(decoded.length!==asset.size)return null;
  const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));if(hex(await crypto.subtle.digest('SHA-256',bytes))!==asset.sha256)return null;
  return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Type':asset.type,'Content-Length':String(asset.size)}});
 }catch{return fallback();}
}


const speakerEmailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const speakerHidden=(name,value)=>`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;

function speakerSubmissionPage(url,records,{error='',received=false}={}){
 const e=escapeHtml,options=[...records].sort((a,b)=>a.verified_name.localeCompare(b.verified_name)).map(r=>`<label class="recipient-choice"><input type="checkbox" name="org_id" value="${e(r.id)}"><span><strong>${e(r.verified_name)}</strong><small>${e(r.city)} · ${e(r.location_county)} County</small></span></label>`).join('');
 return shell('Share with local veteran organizations | Yolo Solano Veterans','Send one private speaker or program introduction to selected veteran organizations in Yolo and Solano counties.',`<section class="wrap workspace-page"><span class="eyebrow">ONE INTRODUCTION · LOCAL CONNECTIONS</span><h1>Would you like to share?</h1><p class="intro">Tell local veteran organizations about your program, nonprofit, presentation or community resource in one place.</p>${received?'<div class="preview-banner" role="status"><strong>Your introduction was received.</strong><span>The organizations you selected can review it privately in their dashboards and contact you directly.</span></div>':error?`<div class="preview-banner" role="alert"><strong>Your introduction was not saved.</strong><span>${e(error)}</span></div>`:''}<div class="profile-grid"><section class="panel"><h2>Introduce yourself</h2><form class="edit-form" method="post" action="/speaker-submissions"><div class="two-up"><label>Your name<input name="presenter_name" maxlength="120" autocomplete="name" required></label><label>Phone number<input name="phone" maxlength="40" autocomplete="tel" required></label></div><div class="two-up"><label>Email address<input name="email" type="email" maxlength="254" autocomplete="email" required></label><label>Organization or program<input name="organization_name" maxlength="180" required></label></div><label>Organization website (optional)<input name="website" type="url" maxlength="2000" placeholder="https://"></label><label>Brief description of your organization<textarea name="organization_description" maxlength="1800" rows="4" required></textarea></label><label>What would you like to talk about?<textarea name="topic" maxlength="1000" rows="4" required></textarea></label><label>Is there an ask? (optional)<textarea name="request_text" maxlength="1200" rows="3" placeholder="For example: invite us to a meeting, share volunteers, or connect us with a partner."></textarea></label><fieldset class="recipient-picker"><legend>Who should receive this?</legend><label class="check"><input type="checkbox" name="all_orgs" value="yes"> Send to every listed local organization</label><div class="recipient-grid">${options}</div></fieldset><div class="bot-field" aria-hidden="true"><label>Leave this blank<input name="website_check" tabindex="-1" autocomplete="off"></label></div><label class="check"><input type="checkbox" name="consent" value="yes" required> I agree to share these details, including my phone number and email, privately with the organizations I select so they can contact me. I have not included veteran case, medical, discharge or private membership information.</label><button class="button">Send my introduction →</button></form></section><aside><section class="panel"><h2>One form, your choice.</h2><ol class="steps"><li><strong>Choose recipients.</strong><p>Select one organization, several, or all of them.</p></li><li><strong>They review privately.</strong><p>Each selected organization sees the introduction in its signed-in dashboard.</p></li><li><strong>They follow up.</strong><p>An organization can accept or decline, contact you directly and create a calendar draft after scheduling.</p></li></ol></section><section class="panel"><h2>Already manage an organization?</h2><p>Sign in to review introductions sent to your organization.</p><a class="button outline" href="https://yolo-county-veterans-hq.smartzgraphics.workers.dev/organization#speakers">Open organization dashboard ↗</a></section></aside></div></section>`,{path:'/share'});
}

async function submitSpeakerSubmission(request,db,validIds){
 if(!db)throw new Error('The introduction desk is temporarily unavailable. Please try again later.');
 const f=await formData(request);if(field(f,'website_check'))throw new Error('Submission could not be accepted.');
 if(f.get('consent')!=='yes')throw new Error('Please agree to share your contact details with the selected organizations.');
 const presenter=field(f,'presenter_name',120,true),phone=field(f,'phone',40,true),email=field(f,'email',254,true);
 if(!speakerEmailPattern.test(email))throw new Error('Please enter a valid email address.');
 const organization=field(f,'organization_name',180,true),description=field(f,'organization_description',1800,true),topic=field(f,'topic',1000,true),ask=field(f,'request_text',1200),website=safeURL(field(f,'website',2000));
 const chosen=f.get('all_orgs')==='yes'?[...validIds]:[...new Set(f.getAll('org_id').map(String))];
 if(!chosen.length)throw new Error('Choose at least one organization, or choose every organization.');
 if(chosen.length>validIds.length||chosen.some(id=>!validIds.includes(id)))throw new Error('Choose organizations from the list.');
 const now=new Date().toISOString(),hour=now.slice(0,13),ip=request.headers.get('CF-Connecting-IP');if(!ip)throw new Error('Submission could not be verified. Please try again.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('speaker|'+ip+'|'+hour)),bucket='speaker:'+hour+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),expiry=new Date(Date.now()+86400000).toISOString();
 const rate=await db.batch([db.prepare('DELETE FROM intake_limits WHERE expires_at < ?').bind(now),db.prepare('INSERT INTO intake_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<3 RETURNING count').bind(bucket,expiry)]);if(!rate[1].results.length)throw new Error('The submission limit has been reached. Please try again tomorrow.');
 const id=crypto.randomUUID(),statements=[db.prepare('INSERT INTO speaker_submissions(id,presenter_name,phone,email,organization_name,organization_description,topic,request_text,website,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,presenter,phone,email,organization,description,topic,ask,website,now,now),...chosen.map(org=>db.prepare('INSERT INTO speaker_submission_recipients(id,submission_id,org_id) VALUES (?,?,?)').bind(crypto.randomUUID(),id,org)),db.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) VALUES (?,'Public speaker form','speaker_submit',?,?)").bind(crypto.randomUUID(),id,now)];
 await db.batch(statements);return id;
}

async function speakerSubmissionRows(db,orgIds){
 if(!orgIds.length)return [];
 const q=`SELECT r.id recipient_id,r.org_id,r.status,r.scheduled_event_id,r.decision_by,r.decision_at,r.version,s.id submission_id,s.presenter_name,s.phone,s.email,s.organization_name,s.organization_description,s.topic,s.request_text,s.website,s.created_at FROM speaker_submission_recipients r JOIN speaker_submissions s ON s.id=r.submission_id WHERE r.org_id IN (${orgIds.map(()=>'?').join(',')}) ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,s.created_at DESC`;
 return (await db.prepare(q).bind(...orgIds).all()).results;
}

function speakerDateOnly(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Choose a valid meeting date.');for(const offset of ['-07:00','-08:00']){const value=date+'T00:00:00'+offset;try{return pacificDate(value);}catch{}}throw new Error('Choose a valid Pacific calendar date.');}
async function speakerSubmissionAction(request,env,principal,allRecords){
 const f=await formData(request),action=field(f,'action',40,true),orgId=field(f,'org_id',100,true),id=field(f,'recipient_id',100,true),version=Number(field(f,'version',20,true)),actor=String(principal.email||'').toLowerCase(),record=allRecords.find(r=>r.id===orgId);
 if(!record||!Number.isSafeInteger(version)||version<1)throw new Error('This introduction is no longer available.');
 const allowed=principal.isAdmin||principal.memberships.some(m=>m.status==='active'&&m.org_id===orgId&&String(m.email).toLowerCase()===actor);if(!allowed)throw new Error('You do not manage this organization.');
 const now=new Date().toISOString(),owns="id=? AND org_id=? AND version=? AND EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active')";
 if(['speaker_accept','speaker_decline'].includes(action)){
  const status=action==='speaker_accept'?'accepted':'declined',adminOwns=principal.isAdmin?'id=? AND org_id=? AND version=?':owns,params=principal.isAdmin?[id,orgId,version]:[id,orgId,version,actor,orgId];
  const out=await env.DB.batch([env.DB.prepare(`UPDATE speaker_submission_recipients SET status=?,decision_by=?,decision_at=?,version=version+1 WHERE ${adminOwns} RETURNING id`).bind(status,actor,now,...params),env.DB.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,action,id,now)]);if(out[0].results.length!==1)throw new Error('This introduction changed in another session. Reload it.');
 }else if(action==='speaker_schedule'){
  const title=field(f,'event_title',180,true),venue=field(f,'venue',500,true),audience=field(f,'audience',800,true),description=field(f,'description',2000,true),start_at=speakerDateOnly(field(f,'event_date',10,true)),eventId=crypto.randomUUID();
  const source=record.public_contacts?.website||'',event={id:eventId,title,organization_id:orgId,organizer:record.verified_name,kind:'Organization meeting',county:record.location_county,city:record.city,venue,start_at,end_at:null,date_only:true,audience,description,source_url:source,source_checked:null,time_note:'Time to be confirmed.',source_kind:'project_team',source_note:'Scheduled by the organization from a private presenter introduction. Presenter contact details remain private.'};
  const owner=principal.isAdmin?'id=? AND org_id=? AND version=? AND status=\'accepted\'':owns+" AND status='accepted'",params=principal.isAdmin?[id,orgId,version]:[id,orgId,version,actor,orgId];
  const out=await env.DB.batch([env.DB.prepare(`UPDATE speaker_submission_recipients SET scheduled_event_id=?,version=version+1 WHERE ${owner} RETURNING id`).bind(eventId,...params),env.DB.prepare("INSERT INTO events(id,body_json,status,created_at,updated_at) SELECT ?,?,'draft',?,? WHERE changes()=1").bind(eventId,JSON.stringify(event),now,now),env.DB.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'speaker_schedule',?,? WHERE changes()=1").bind(crypto.randomUUID(),actor,id,now)]);if(out[0].results.length!==1)throw new Error('Accept this introduction before adding a meeting draft, then reload it.');
 }else throw new Error('Choose a valid introduction action.');
 return redirect('/organization?org='+encodeURIComponent(orgId)+'&speakersaved=1#speakers');
}

function speakerInbox(orgId,rows,saved=false){
 const e=escapeHtml,hidden=speakerHidden,items=rows.filter(r=>r.org_id===orgId),pending=items.filter(r=>r.status==='pending').length;
 return `<section id="speakers" class="organization-speakers"><div class="section-heading"><div><span class="eyebrow">SPEAKERS &amp; COMMUNITY PARTNERS</span><h2>Introductions for your organization</h2></div><span class="result-count">${pending} awaiting review</span></div>${saved?'<p class="preview-banner" role="status">Your decision was saved.</p>':''}<p>People and programs can use one public form to share an introduction with selected organizations. Contact details below are private and were shared for this purpose.</p>${items.length?items.map(r=>`<article class="panel speaker-request"><div class="row-between"><span class="label ${r.status==='pending'?'amber':''}">${e(r.status==='pending'?'Awaiting review':r.status==='accepted'?'Accepted':'Declined')}</span><span class="small-note">Received ${e(new Date(r.created_at).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'}))}</span></div><h3>${e(r.organization_name)}</h3><p><strong>${e(r.presenter_name)}</strong> · <a href="mailto:${e(r.email)}">${e(r.email)}</a> · <a href="tel:${e(r.phone)}">${e(r.phone)}</a></p>${r.website?`<p><a href="${e(r.website)}" target="_blank" rel="noopener noreferrer">Organization website ↗</a></p>`:''}<p>${e(r.organization_description)}</p><dl><div><dt>What they want to discuss</dt><dd>${e(r.topic)}</dd></div>${r.request_text?`<div><dt>Their ask</dt><dd>${e(r.request_text)}</dd></div>`:''}</dl>${r.status==='pending'?`<div class="speaker-actions"><form method="post" action="/organization/speakers">${hidden('action','speaker_accept')}${hidden('org_id',orgId)}${hidden('recipient_id',r.recipient_id)}${hidden('version',r.version)}<button class="button">Accept introduction</button></form><form method="post" action="/organization/speakers">${hidden('action','speaker_decline')}${hidden('org_id',orgId)}${hidden('recipient_id',r.recipient_id)}${hidden('version',r.version)}<button class="button outline">Decline</button></form></div>`:r.status==='accepted'&&!r.scheduled_event_id?`<details><summary>Add a scheduled meeting to the calendar</summary><p>Create a private calendar draft after you arrange the date directly. Aaron or Sterling can review it before public publication.</p><form class="edit-form" method="post" action="/organization/speakers">${hidden('action','speaker_schedule')}${hidden('org_id',orgId)}${hidden('recipient_id',r.recipient_id)}${hidden('version',r.version)}<label>Calendar title<input name="event_title" maxlength="180" value="${e('Presentation: '+r.topic.slice(0,120))}" required></label><label>Meeting date<input name="event_date" type="date" required></label><label>Venue<input name="venue" maxlength="500" required></label><label>Who may attend?<input name="audience" maxlength="800" required></label><label>Public description<textarea name="description" maxlength="2000" rows="3" required>${e(r.topic)}</textarea></label><button class="button">Create calendar draft</button></form></details>`:r.scheduled_event_id?'<p class="preview-banner"><strong>Calendar draft created.</strong><span>Aaron or Sterling can review and publish it from the shared calendar.</span></p>':''}</article>`).join(''):'<section class="panel empty-state"><h3>No introductions yet.</h3><p>Share the public introduction form with prospective speakers and community partners.</p><a class="button outline" href="'+origin+'/share" target="_blank" rel="noopener noreferrer">Open share form ↗</a></section>'}</section>`;
}


const meetingMonthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const meetingHidden=(name,value)=>`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
const meetingLocalDate=(date,time)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Use a valid date and time.');for(const offset of ['-07:00','-08:00']){try{return pacificDate(date+'T'+time+':00'+offset);}catch{}}throw new Error('Use a valid Pacific date and time.');};

async function organizationMeetingRows(db,orgIds){
 if(!orgIds.length)return {plans:[],meetings:[]};const marks=orgIds.map(()=>'?').join(',');
 const [plans,meetings]=await Promise.all([db.prepare(`SELECT * FROM organization_meeting_plans WHERE org_id IN (${marks}) ORDER BY year`).bind(...orgIds).all(),db.prepare(`SELECT * FROM organization_meetings WHERE org_id IN (${marks}) ORDER BY year,month`).bind(...orgIds).all()]);
 return {plans:plans.results,meetings:meetings.results};
}

async function organizationMeetingAction(request,env,principal,records){
 const f=await formData(request),action=field(f,'action',40,true);if(action!=='meeting_plan_save')throw new Error('Choose a valid meeting-plan action.');
 const orgId=field(f,'org_id',100,true),year=Number(field(f,'year',4,true)),planVersion=Number(field(f,'plan_version',20,true)),actor=String(principal.email||'').toLowerCase(),record=records.find(r=>r.id===orgId),now=new Date().toISOString();
 if(!record||!Number.isInteger(year)||year<2026||year>new Date().getUTCFullYear()+4||!Number.isSafeInteger(planVersion)||planVersion<0)throw new Error('Choose a valid organization and planning year.');
 const member="EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active')",admin=principal.isAdmin===true;
 const first=planVersion===0?(admin?env.DB.prepare('INSERT INTO organization_meeting_plans(org_id,year,version,updated_by,updated_at) SELECT ?,?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=?) RETURNING *').bind(orgId,year,actor,now,orgId,year):env.DB.prepare(`INSERT INTO organization_meeting_plans(org_id,year,version,updated_by,updated_at) SELECT ?,?,1,?,? WHERE ${member} AND NOT EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=?) RETURNING *`).bind(orgId,year,actor,now,actor,orgId,orgId,year)):(admin?env.DB.prepare('UPDATE organization_meeting_plans SET version=version+1,updated_by=?,updated_at=? WHERE org_id=? AND year=? AND version=? RETURNING *').bind(actor,now,orgId,year,planVersion):env.DB.prepare(`UPDATE organization_meeting_plans SET version=version+1,updated_by=?,updated_at=? WHERE org_id=? AND year=? AND version=? AND ${member} RETURNING *`).bind(actor,now,orgId,year,planVersion,actor,orgId));
 const nextVersion=planVersion+1,guard='EXISTS(SELECT 1 FROM organization_meeting_plans WHERE org_id=? AND year=? AND version=? AND updated_by=? AND updated_at=?)',statements=[first];
 for(let month=1;month<=12;month++){
  const date=field(f,'date_'+month,10),time=field(f,'time_'+month,5),title=field(f,'title_'+month,180),notes=field(f,'notes_'+month,1800);
  if(!date&&!time&&!title&&!notes){statements.push(env.DB.prepare(`DELETE FROM organization_meetings WHERE org_id=? AND year=? AND month=? AND ${guard}`).bind(orgId,year,month,orgId,year,nextVersion,actor,now));continue;}
  if(!date||!time)throw new Error(meetingMonthNames[month-1]+' needs both a date and time.');meetingLocalDate(date,time);if(Number(date.slice(0,4))!==year||Number(date.slice(5,7))!==month)throw new Error(meetingMonthNames[month-1]+' must use a date in that month.');
  const finalTitle=title||record.verified_name+' monthly meeting',id=crypto.randomUUID();
  statements.push(env.DB.prepare(`INSERT INTO organization_meetings(id,org_id,year,month,event_date,start_time,title,notes,created_by,created_at,updated_by,updated_at,version) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,1 WHERE ${guard} ON CONFLICT(org_id,year,month) DO UPDATE SET event_date=excluded.event_date,start_time=excluded.start_time,title=excluded.title,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at,version=organization_meetings.version+1 WHERE ${guard}`).bind(id,orgId,year,month,date,time,finalTitle,notes,actor,now,actor,now,orgId,year,nextVersion,actor,now,orgId,year,nextVersion,actor,now));
 }
 statements.push(env.DB.prepare(`INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'meeting_plan_save',?,? WHERE ${guard}`).bind(crypto.randomUUID(),actor,orgId+'-'+year,now,orgId,year,nextVersion,actor,now));
 const out=await env.DB.batch(statements);if(out[0].results.length!==1)throw new Error('This meeting plan changed in another session. Reload it before saving.');
 return redirect('/organization?org='+encodeURIComponent(orgId)+'&meeting_year='+year+'&meetingsaved=1#meeting-plan');
}

function organizationMeetingPlanner(orgId,data,url){
 const e=escapeHtml,current=new Date().getUTCFullYear(),fallback=new Date().getUTCMonth()>=8?current+1:current,requested=Number(url.searchParams.get('meeting_year')),year=Number.isInteger(requested)&&requested>=current-1&&requested<=current+3?requested:fallback,plan=data.plans.find(p=>p.org_id===orgId&&p.year===year),rows=data.meetings.filter(m=>m.org_id===orgId&&m.year===year),byMonth=new Map(rows.map(r=>[r.month,r])),options=[];for(let y=current-1;y<=current+3;y++)options.push(`<option value="${y}" ${y===year?'selected':''}>${y}</option>`);
 const months=meetingMonthNames.map((name,index)=>{const month=index+1,row=byMonth.get(month);return `<fieldset class="meeting-month"><legend>${name}</legend><div class="two-up"><label>Date<input type="date" name="date_${month}" value="${e(row?.event_date||'')}"></label><label>Time<input type="time" name="time_${month}" value="${e(row?.start_time||'')}"></label></div><label>Meeting title<input name="title_${month}" maxlength="180" value="${e(row?.title||'') }" placeholder="Monthly meeting"></label><label>Meeting notes<textarea name="notes_${month}" maxlength="1800" rows="2" placeholder="Special guest, holiday meal, program or other note">${e(row?.notes||'')}</textarea></label></fieldset>`;}).join('');
 return `<section id="meeting-plan" class="organization-meeting-plan"><div class="section-heading"><div><span class="eyebrow">YEARLY MEETING PLANNER</span><h2>Plan your meetings</h2></div><span class="result-count">${rows.length} of 12 months planned</span></div>${url.searchParams.has('meetingsaved')?'<p class="preview-banner" role="status">Your yearly meeting plan is published on the calendars.</p>':''}<p>Select each meeting date and time, then add notes such as a special guest, a holiday party or a featured program. Saved meetings appear on your organization calendar and the community calendar.</p><form class="panel inline-form" method="get" action="/organization">${meetingHidden('org',orgId)}<label>Planning year<select name="meeting_year">${options.join('')}</select></label><button class="button outline">Open year</button></form><form class="edit-form meeting-plan-grid" method="post" action="/organization/meetings">${meetingHidden('action','meeting_plan_save')}${meetingHidden('org_id',orgId)}${meetingHidden('year',year)}${meetingHidden('plan_version',plan?.version||0)}${months}<button class="button meeting-plan-save">Save and publish ${year} meeting plan →</button></form></section>`;
}


const eventHidden=(name,value)=>`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
const orgName=(records,id)=>records.find(record=>record.id===id)?.verified_name||'Organization no longer listed';

async function organizationEventInvitationRows(db,orgIds){
 if(!orgIds.length)return [];
 const marks=orgIds.map(()=>'?').join(',');
 const sql=`SELECT i.*,e.body_json,e.status event_status FROM organization_event_invitations i JOIN events e ON e.id=i.event_id WHERE i.sender_org_id IN (${marks}) OR i.recipient_org_id IN (${marks}) ORDER BY i.created_at DESC,i.id`;
 return (await db.prepare(sql).bind(...orgIds,...orgIds).all()).results;
}

const eventStart=(date,time)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Choose a valid event date and time.');
 for(const offset of ['-07:00','-08:00']){const value=`${date}T${time}:00${offset}`;try{return pacificDate(value);}catch{}}
 throw new Error('Choose a valid Pacific date and time.');
};
const mayManage=(principal,orgId)=>principal.isAdmin||principal.memberships.some(m=>m.status==='active'&&m.org_id===orgId&&String(m.email).toLowerCase()===String(principal.email).toLowerCase());

async function organizationEventCollaborationAction(request,env,principal,records){
 const f=await formData(request),action=field(f,'action',40,true),actor=String(principal.email||'').trim().toLowerCase(),now=new Date().toISOString();
 if(action==='organization_event_create'){
  const orgId=field(f,'org_id',100,true),record=records.find(r=>r.id===orgId);if(!record||!mayManage(principal,orgId))throw new Error('You do not manage this organization.');
  if(f.get('confirmed')!=='yes')throw new Error('Confirm that the event details are authorized for publication.');
  const chosen=f.get('all_orgs')==='yes'?records.filter(r=>r.id!==orgId).map(r=>r.id):[...new Set(f.getAll('recipient_org_ids').map(String))];
  if(!chosen.length||chosen.some(id=>id===orgId||!records.some(r=>r.id===id)))throw new Error('Choose at least one listed organization to invite.');
  const id=crypto.randomUUID(),start_at=eventStart(field(f,'event_date',10,true),field(f,'event_time',5,true));
  const event={id,title:field(f,'title',180,true),organization_id:orgId,organizer:record.verified_name,kind:'Community event',county:record.location_county,city:record.city||'',venue:field(f,'venue',500,true),start_at,end_at:null,audience:field(f,'audience',800,true),description:field(f,'description',4000,true),source_url:record.public_contacts?.website||'',source_checked:now.slice(0,10),time_note:'Published by an authorized organization representative.',source_kind:'project_team',source_note:'Published and shared by the host organization from its private organization editor.'};
  const owner=principal.isAdmin?'1=1':"EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active')",ownerParams=principal.isAdmin?[]:[actor,orgId];
  const statements=[env.DB.prepare(`INSERT INTO events(id,body_json,status,created_at,updated_at) SELECT ?,?,'published',?,? WHERE ${owner} RETURNING id`).bind(id,JSON.stringify(event),now,now,...ownerParams),...chosen.map(recipient=>env.DB.prepare('INSERT INTO organization_event_invitations(id,event_id,sender_org_id,recipient_org_id,created_by,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=?)').bind(crypto.randomUUID(),id,orgId,recipient,actor,now,id)),env.DB.prepare("INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,'organization_event_shared',?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=?)").bind(crypto.randomUUID(),actor,id,now,id)];
  const out=await env.DB.batch(statements);if(out[0].results.length!==1)throw new Error('Your organization access changed. Reload before sharing this event.');
  return redirect('/organization?org='+encodeURIComponent(orgId)+'&eventshared=1#event-sharing');
 }
 if(action==='organization_event_invitation_decide'){
  const orgId=field(f,'org_id',100,true),id=field(f,'invitation_id',100,true),version=Number(field(f,'version',20,true)),decision=field(f,'decision',20,true),feedback=field(f,'feedback',1800);if(!mayManage(principal,orgId)||!Number.isSafeInteger(version)||!['accepted','tentative','declined'].includes(decision))throw new Error('This invitation is no longer available.');
  const owner=principal.isAdmin?'id=? AND recipient_org_id=? AND version=?':"id=? AND recipient_org_id=? AND version=? AND EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active')",params=principal.isAdmin?[id,orgId,version]:[id,orgId,version,actor,orgId];
  const out=await env.DB.batch([env.DB.prepare(`UPDATE organization_event_invitations SET status=?,feedback=?,decision_by=?,decision_at=?,version=version+1 WHERE ${owner} RETURNING id`).bind(decision,feedback,actor,now,...params),env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor,'organization_event_invitation_'+decision,id,now)]);if(out[0].results.length!==1)throw new Error('This invitation changed in another session. Reload it.');
  return redirect('/organization?org='+encodeURIComponent(orgId)+'&eventshared=1#event-sharing');
 }
 throw new Error('Choose a valid event collaboration action.');
}

function organizationEventCollaboration(orgId,records,rows,saved=false){
 const e=escapeHtml,hidden=eventHidden,other=records.filter(r=>r.id!==orgId).sort((a,b)=>a.verified_name.localeCompare(b.verified_name)),incoming=rows.filter(r=>r.recipient_org_id===orgId),sent=rows.filter(r=>r.sender_org_id===orgId),sentEvents=[...new Map(sent.map(row=>[row.event_id,row])).values()];
 const status=row=>row.status==='pending'?'Awaiting reply':row.status==='accepted'?'Accepted':row.status==='tentative'?'Tentative':'Declined';
 const create=`<details class="panel" ${sentEvents.length?'':'open'}><summary>Create an event and choose organizations</summary><form class="edit-form" method="post" action="/organization/events">${hidden('action','organization_event_create')}${hidden('org_id',orgId)}<label>Event title<input name="title" maxlength="180" required></label><div class="two-up"><label>Date<input name="event_date" type="date" required></label><label>Start time<input name="event_time" type="time" required></label></div><label>Venue and public address<input name="venue" maxlength="500" required></label><label>Who may attend?<input name="audience" maxlength="800" required></label><label>Public description<textarea name="description" maxlength="4000" rows="4" required></textarea></label><fieldset class="recipient-picker"><legend>Invite other organizations</legend><label class="check"><input type="checkbox" name="all_orgs" value="yes"> Invite every listed organization</label><div class="recipient-grid">${other.map(r=>`<label class="recipient-choice"><input type="checkbox" name="recipient_org_ids" value="${e(r.id)}"><span><strong>${e(r.verified_name)}</strong><small>${e(r.city||'Regional')} · ${e(r.location_county)} County</small></span></label>`).join('')}</div></fieldset><label class="check"><input type="checkbox" name="confirmed" value="yes" required> I am authorized to publish this event for my organization, and the public details are ready to share.</label><button class="button">Publish event and send invitations →</button></form></details>`;
 const received=incoming.length?incoming.map(row=>{let event={};try{event=JSON.parse(row.body_json);}catch{}return `<article class="panel"><span class="label ${row.status==='pending'?'amber':''}">${e(status(row))}</span><h4>${e(event.title||'Shared event')}</h4><p><strong>From:</strong> ${e(orgName(records,row.sender_org_id))}</p><p>${e(event.start_at?new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:'America/Los_Angeles'}).format(new Date(event.start_at)):'Date unavailable')}</p><p>${e(event.description||'')}</p><p><a href="${origin}/events/${e(row.event_id)}" target="_blank" rel="noopener noreferrer">View public event ↗</a></p><form class="edit-form" method="post" action="/organization/events">${hidden('action','organization_event_invitation_decide')}${hidden('org_id',orgId)}${hidden('invitation_id',row.id)}${hidden('version',row.version)}<label>Your response<select name="decision"><option value="accepted" ${row.status==='accepted'?'selected':''}>Accept</option><option value="tentative" ${row.status==='tentative'?'selected':''}>Tentative</option><option value="declined" ${row.status==='declined'?'selected':''}>Decline</option></select></label><label>Feedback to the host (optional)<textarea name="feedback" maxlength="1800" rows="3" placeholder="Share a question, scheduling note, volunteer offer or other feedback.">${e(row.feedback||'')}</textarea></label><button class="button ${row.status==='pending'?'':'outline'}">Send response and feedback</button></form></article>`;}).join(''):'<p>No event invitations yet.</p>';
 const shared=sentEvents.length?sentEvents.map(row=>{let event={};try{event=JSON.parse(row.body_json);}catch{}const recipients=sent.filter(item=>item.event_id===row.event_id);return `<article class="panel"><h4>${e(event.title||'Shared event')}</h4><p>${recipients.length} organization${recipients.length===1?'':'s'} invited · ${recipients.filter(r=>r.status==='accepted').length} accepted · ${recipients.filter(r=>r.status==='tentative').length} tentative · ${recipients.filter(r=>r.status==='pending').length} awaiting reply</p><ul class="activity-list">${recipients.map(recipient=>`<li><strong>${e(orgName(records,recipient.recipient_org_id))} · ${e(status(recipient))}</strong>${recipient.feedback?`<span>${e(recipient.feedback)}</span>`:''}</li>`).join('')}</ul><a href="${origin}/events/${e(row.event_id)}" target="_blank" rel="noopener noreferrer">View public event ↗</a></article>`;}).join(''):'<p>No shared events yet.</p>';
 return `<section id="event-sharing" class="organization-events"><div class="section-heading"><div><span class="eyebrow">EVENT COLLABORATION</span><h2>Create and share an event</h2></div><span class="result-count">${incoming.filter(r=>r.status==='pending').length} invitation${incoming.filter(r=>r.status==='pending').length===1?'':'s'} waiting</span></div>${saved?'<p class="preview-banner" role="status">Your event collaboration update was saved.</p>':''}<p>Publish an event from your organization, then invite one, several or every listed local organization. Recipients can accept, decline, respond tentatively and send feedback to the host.</p>${create}<div class="two-up"><section><h3>Invitations to your organization</h3>${received}</section><section><h3>Events your organization shared</h3>${shared}</section></div></section>`;
}


const organizationPhotoMax=5*1024*1024,organizationPhotoBodyMax=organizationPhotoMax+64*1024,organizationPhotoLimit=12;
const organizationPhotoID=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const organizationPhotoHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'X-Frame-Options':'DENY'};
const organizationPhotoScope="(?=1 OR EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active'))";
const organizationPhotoSHA=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function organizationPhotoBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function organizationPhotoText(form,name,max,required=false){const values=form.getAll(name);if(values.length>1||values.some(v=>typeof v!=='string'))throw new Error('Please reload the photo form and try again.');const value=(values[0]||'').trim();if(value.length>max||value.includes('\u0000')||(required&&!value))throw new Error('Please provide a valid '+name.replaceAll('_',' ')+'.');return value;}
function organizationPhotoPermission(principal,orgId){const email=String(principal?.email||'').toLowerCase();if(!email||!records.some(r=>r.id===orgId)||(!principal.isAdmin&&!principal.memberships?.some(m=>m.org_id===orgId&&m.status==='active'&&m.email.toLowerCase()===email)))throw new Error('You do not have access to update this organization.');return [principal.isAdmin?1:0,email,orgId];}
function organizationPhotoIDs(form,name,owner){
 const values=[...new Set(form.getAll(name).map(value=>typeof value==='string'?value.trim():'').filter(Boolean))];
 if(values.length>12||values.some(value=>!organizationPhotoID(value)||!records.some(record=>record.id===value)))throw new Error('Choose valid organizations for this photo.');
 return values.filter(value=>value!==owner);
}

// Read only IFD0's standard inline SHORT orientation. Never follow GPS, camera,
// thumbnail or arbitrary offset trees; rebuild a minimal metadata block instead.
function organizationPhotoOrientation(input){
 let bytes=input;if(bytes.length>=6&&bytes[0]===69&&bytes[1]===120&&bytes[2]===105&&bytes[3]===102&&bytes[4]===0&&bytes[5]===0)bytes=bytes.subarray(6);
 if(bytes.length<8)return null;const little=bytes[0]===73&&bytes[1]===73,big=bytes[0]===77&&bytes[1]===77;if(!little&&!big)return null;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(view.getUint16(2,little)!==42)return null;const start=view.getUint32(4,little);if(start<8||start+2>bytes.length)return null;const count=view.getUint16(start,little);if(count>256||start+2+count*12+4>bytes.length)return null;
 for(let i=0;i<count;i++){const at=start+2+i*12;if(view.getUint16(at,little)!==274)continue;if(view.getUint16(at+2,little)!==3||view.getUint32(at+4,little)!==1)return null;const value=view.getUint16(at+8,little);return value>=1&&value<=8?value:null;}return null;
}
const organizationPhotoOrientationTIFF=value=>Uint8Array.from([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,value,0,0,0,0,0,0,0]);

// Remove embedded location/camera/comment metadata before publication. Pixel data
// is preserved; SVG and other executable formats are never accepted.
function cleanOrganizationPhoto(input,declaredType){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),pieces=[];
 if(bytes.length<12||bytes.length>organizationPhotoMax)throw new Error('Choose a JPG, PNG or WebP photo no larger than 5 MB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(start,end)=>String.fromCharCode(...bytes.subarray(start,end));
 const invalid=()=>{throw new Error('This photo could not be read. Save it as a JPG, PNG or WebP image and try again.');};
 let type;
 if(bytes[0]===137&&ascii(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10){
  type='image/png';pieces.push(bytes.subarray(0,8));let cursor=8,ended=false,hasData=false,hasHeader=false;
  while(cursor+12<=bytes.length){const size=view.getUint32(cursor),kind=ascii(cursor+4,cursor+8),end=cursor+12+size;if(end>bytes.length)invalid();
   if(!hasHeader&&kind!=='IHDR')invalid();
   if(kind==='IHDR'){if(hasHeader||size!==13)invalid();const width=view.getUint32(cursor+8),height=view.getUint32(cursor+12);if(!width||!height||width*height>50000000)invalid();hasHeader=true;}
   if(kind==='IDAT')hasData=true;
   if(!['eXIf','tEXt','zTXt','iTXt','tIME'].includes(kind))pieces.push(bytes.subarray(cursor,end));
   cursor=end;if(kind==='IEND'){if(size!==0)invalid();ended=true;break;}
  }
  if(!ended||!hasData)invalid();
 }else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){
  type='image/jpeg';pieces.push(bytes.subarray(0,2));let cursor=2,scan=false,frame=false,ended=false,orientationSaved=false;
  while(cursor<bytes.length){const start=cursor;if(bytes[cursor++]!==255)invalid();while(bytes[cursor]===255)cursor++;const marker=bytes[cursor++];if(marker===217){pieces.push(bytes.subarray(start,cursor));ended=true;break;}if(marker===0||marker===216||cursor+2>bytes.length)invalid();const size=view.getUint16(cursor),end=cursor+size;if(size<2||end>bytes.length)invalid();
   if([192,193,194].includes(marker)){if(size<8)invalid();const height=view.getUint16(cursor+3),width=view.getUint16(cursor+5);if(!width||!height||width*height>50000000)invalid();frame=true;}
   if(marker===218){if(!frame)invalid();pieces.push(bytes.subarray(start,end));scan=true;cursor=end;const entropyStart=cursor;let found=false;
    while(cursor<bytes.length){if(bytes[cursor]!==255){cursor++;continue;}const markerStart=cursor;while(bytes[cursor]===255)cursor++;const next=bytes[cursor];if(next===0||next>=208&&next<=215){cursor++;continue;}pieces.push(bytes.subarray(entropyStart,markerStart));cursor=markerStart;found=true;break;}if(!found)invalid();continue;
   }
   if(marker===225&&!orientationSaved){const orientation=organizationPhotoOrientation(bytes.subarray(cursor+2,end));if(orientation){pieces.push(Uint8Array.from([255,225,0,34,69,120,105,102,0,0,...organizationPhotoOrientationTIFF(orientation)]));orientationSaved=true;}}
   if(![225,237,254].includes(marker))pieces.push(bytes.subarray(start,end));cursor=end;
  }
  if(!scan||!ended)invalid();
 }else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
  type='image/webp';if(view.getUint32(4,true)+8!==bytes.length)invalid();let cursor=12,hasImage=false;
  while(cursor+8<=bytes.length){const kind=ascii(cursor,cursor+4),size=view.getUint32(cursor+4,true),end=cursor+8+size+(size%2);if(end>bytes.length)invalid();if(kind==='VP8 '||kind==='VP8L')hasImage=true;
   if(!['EXIF','XMP '].includes(kind)){const chunk=bytes.slice(cursor,end);if(kind==='VP8X'){if(size!==10)invalid();chunk[8]&=~(8|4);}pieces.push(chunk);}cursor=end;
  }
  if(cursor!==bytes.length||!hasImage)invalid();const length=pieces.reduce((n,p)=>n+p.length,4),header=bytes.slice(0,12);new DataView(header.buffer).setUint32(4,length,true);pieces.unshift(header);
 }else invalid();
 if(declaredType&&declaredType!==type&&declaredType!=='application/octet-stream')invalid();
 const cleaned=new Uint8Array(pieces.reduce((n,p)=>n+p.length,0));let offset=0;for(const piece of pieces){cleaned.set(piece,offset);offset+=piece.length;}return {bytes:cleaned,contentType:type};
}

async function organizationPhotoMultipart(request){
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new Error('Please submit this form from its original organization page.');
 const type=request.headers.get('Content-Type')||'';if(!/^multipart\/form-data\s*;/i.test(type))throw new Error('Choose a photo using the upload form.');
 if(Number(request.headers.get('Content-Length'))>organizationPhotoBodyMax)throw new Error('Choose a photo no larger than 5 MB.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Choose a photo.');const chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>organizationPhotoBodyMax){await reader.cancel();throw new Error('Choose a photo no larger than 5 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}let form;try{form=await new Response(bytes,{headers:{'Content-Type':type}}).formData();}catch{throw new Error('Please choose the photo again.');}
 for(const [name]of form)if(!['action','org_id','photo','caption','alt_text','credit','source_url','rights','album_id','present_org_ids'].includes(name))throw new Error('Please reload the photo form and try again.');
 return form;
}

async function organizationPhotoRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const sql='SELECT * FROM organization_photos'+(Array.isArray(orgIds)?' WHERE org_id IN ('+orgIds.map(()=>'?').join(',')+')':'')+' ORDER BY created_at,id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

async function organizationPhotoAlbumRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const sql='SELECT * FROM organization_photo_albums'+(Array.isArray(orgIds)?' WHERE org_id IN ('+orgIds.map(()=>'?').join(',')+')':'')+' ORDER BY created_at,id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

async function organizationPhotoPresenceRows(db,photoIds){
 if(!db||Array.isArray(photoIds)&&!photoIds.length)return [];
 const sql='SELECT * FROM organization_photo_presence'+(Array.isArray(photoIds)?' WHERE photo_id IN ('+photoIds.map(()=>'?').join(',')+')':'')+' ORDER BY requested_at,id';
 return (await (Array.isArray(photoIds)?db.prepare(sql).bind(...photoIds):db.prepare(sql)).all()).results;
}

async function organizationPhotoAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Photo editing is temporarily unavailable.');
 const multipart=(request.headers.get('Content-Type')||'').startsWith('multipart/form-data');
 const form=multipart?await organizationPhotoMultipart(request):await formData(request),action=organizationPhotoText(form,'action',50,true),orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId),actor=principal.email;
 const now=new Date().toISOString(),destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photos';
 if(!['photo_upload','photo_edit','photo_remove'].includes(action))throw new Error('Choose a valid photo action.');
 if(action==='photo_upload'&&!multipart)throw new Error('Choose a photo using the upload form.');
 const id=action==='photo_upload'?crypto.randomUUID():organizationPhotoText(form,'id',100,true),version=action==='photo_upload'?1:Number(organizationPhotoText(form,'version',20,true));
 if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this page before changing the photo.');
 let caption='',alt='',credit='',source='',albumId=null,presentOrgIds=[];
 if(action!=='photo_remove'){
  if(organizationPhotoText(form,'rights',10)!=='yes')throw new Error('Confirm permission to publish the photo and that it contains no private information.');
  caption=organizationPhotoText(form,'caption',500);alt=organizationPhotoText(form,'alt_text',300,true);credit=organizationPhotoText(form,'credit',200);source=safeURL(organizationPhotoText(form,'source_url',2000));albumId=organizationPhotoText(form,'album_id',100)||null;presentOrgIds=organizationPhotoIDs(form,'present_org_ids',orgId);
  if(albumId&&!organizationPhotoID(albumId))throw new Error('Choose a valid album.');
  assertPublicProfilePrivacy({member_information:[caption,alt,credit].join(' '),source_url:source});
 }
 let statement,key,bytes,sha256;
 if(action==='photo_upload'){
  if(!env.ATTACHMENTS)throw new Error('Photo uploads are temporarily unavailable.');
  const files=form.getAll('photo');if(files.length!==1||typeof files[0]==='string'||typeof files[0].arrayBuffer!=='function')throw new Error('Choose one photo at a time.');const file=files[0];
  if(file.size<1||file.size>organizationPhotoMax)throw new Error('Choose a photo no larger than 5 MB.');
  const cleaned=cleanOrganizationPhoto(await file.arrayBuffer(),file.type);bytes=cleaned.bytes;sha256=await organizationPhotoSHA(bytes);key='organization-photos/'+orgId+'/'+id;
  const envelope=JSON.stringify({schema_version:1,base64:organizationPhotoBase64(bytes),byte_size:bytes.length,sha256});
  const stored=await env.ATTACHMENTS.put(key,envelope,{httpMetadata:{contentType:'text/plain'},customMetadata:{photo_id:id,sha256}});if(!stored)throw new Error('The photo could not be stored. Please try again.');
  statement=env.DB.prepare(`INSERT INTO organization_photos(id,org_id,object_key,caption,alt_text,credit,source_url,license,content_type,byte_size,sha256,uploaded_by,created_at,updated_at,album_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${organizationPhotoScope} AND (? IS NULL OR EXISTS(SELECT 1 FROM organization_photo_albums WHERE id=? AND org_id=?)) AND (SELECT count(*) FROM organization_photos WHERE org_id=?)<? RETURNING id`).bind(id,orgId,key,caption,alt,credit,source,'Permission confirmed by uploader',cleaned.contentType,bytes.length,sha256,actor,now,now,albumId,...scope,albumId,albumId,orgId,orgId,organizationPhotoLimit);
 }else if(action==='photo_edit')statement=env.DB.prepare(`UPDATE organization_photos SET caption=?,alt_text=?,credit=?,source_url=?,album_id=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} AND (? IS NULL OR EXISTS(SELECT 1 FROM organization_photo_albums WHERE id=? AND org_id=?)) RETURNING id`).bind(caption,alt,credit,source,albumId,now,id,orgId,version,...scope,albumId,albumId,orgId);
 else statement=env.DB.prepare(`DELETE FROM organization_photos WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(id,orgId,version,...scope);
 let out;
 const statements=[statement];
 if(action!=='photo_remove'){
  if(action==='photo_edit')statements.push(env.DB.prepare("DELETE FROM organization_photo_presence WHERE photo_id=? AND org_id!=? AND status='approved' AND EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?)").bind(id,orgId,id,orgId,now));
  const associations=[orgId,...presentOrgIds];
  for(const presentOrg of associations)statements.push(env.DB.prepare("INSERT INTO organization_photo_presence(id,photo_id,org_id,status,requested_by,requested_at,reviewed_by,reviewed_at) SELECT ?,?,?,'approved',?,?,?,? WHERE EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?) ON CONFLICT(photo_id,org_id) DO UPDATE SET status='approved',reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,version=organization_photo_presence.version+1").bind(crypto.randomUUID(),id,presentOrg,actor,now,actor,now,id,orgId,now));
 }
 statements.push(action==='photo_remove'?env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,id,now):env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=? AND updated_at=?)').bind(crypto.randomUUID(),actor,'organization_'+action,id,now,id,orgId,now));
 try{out=await env.DB.batch(statements);}
 catch(error){
  // A lost response can follow a committed upload; preserve uncertain originals.
  if(key){let saved;try{saved=(await env.DB.prepare('SELECT id FROM organization_photos WHERE id=? AND object_key=?').bind(id,key).all()).results;}catch{throw new Error('The upload status could not be confirmed. Reload the page before trying again.');}if(saved.length===1)return redirect(destination);try{await env.ATTACHMENTS.delete(key);}catch{}}
  throw error;
 }
 if(out[0]?.results?.length!==1){if(key)try{await env.ATTACHMENTS.delete(key);}catch{}throw new Error('Your access or this photo changed, or the gallery already has 12 photos. Reload the page before trying again.');}
 // Removed originals stay private in R2 so a previously verified backup remains
 // restorable. An absent metadata ID immediately stops public image delivery.
 return redirect(destination);
}

async function organizationPhotoCollaborationAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Photo collaboration is temporarily unavailable.');
 const form=await formData(request),action=organizationPhotoText(form,'action',60,true),actor=String(principal?.email||'').toLowerCase(),now=new Date().toISOString();
 if(!actor)throw new Error('Sign in again before changing photo collaboration.');
 let statement,destination='/organization#photos',recordId='';
 if(['album_add','album_edit','album_remove'].includes(action)){
  const orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId);destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photo-albums';
  const id=action==='album_add'?crypto.randomUUID():organizationPhotoText(form,'id',100,true),version=action==='album_add'?1:Number(organizationPhotoText(form,'version',20,true));recordId=id;
  if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this album before changing it.');
  if(action==='album_remove')statement=env.DB.prepare(`DELETE FROM organization_photo_albums WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(id,orgId,version,...scope);
  else{
   const name=organizationPhotoText(form,'name',100,true),description=organizationPhotoText(form,'description',500);
   assertPublicProfilePrivacy({member_information:name+' '+description});
   if(action==='album_add')statement=env.DB.prepare(`INSERT INTO organization_photo_albums(id,org_id,name,description,created_by,created_at,updated_by,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${organizationPhotoScope} AND (SELECT count(*) FROM organization_photo_albums WHERE org_id=?)<20 RETURNING id`).bind(id,orgId,name,description,actor,now,actor,now,...scope,orgId);
   else statement=env.DB.prepare(`UPDATE organization_photo_albums SET name=?,description=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationPhotoScope} RETURNING id`).bind(name,description,actor,now,id,orgId,version,...scope);
  }
 }else if(action==='photo_presence_request'){
  const photoId=organizationPhotoText(form,'photo_id',100,true),orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId);recordId=crypto.randomUUID();destination='/photo-presence?photo='+encodeURIComponent(photoId)+'&saved=1';
  if(!organizationPhotoID(photoId))throw new Error('Choose a valid photo.');
  statement=env.DB.prepare(`INSERT INTO organization_photo_presence(id,photo_id,org_id,status,requested_by,requested_at) SELECT ?,?,?,'pending',?,? WHERE ${organizationPhotoScope} AND EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id!=?) ON CONFLICT(photo_id,org_id) DO NOTHING RETURNING id`).bind(recordId,photoId,orgId,actor,now,...scope,photoId,orgId);
 }else if(['photo_presence_approve','photo_presence_reject'].includes(action)){
  const orgId=organizationPhotoText(form,'org_id',100,true),scope=organizationPhotoPermission(principal,orgId),id=organizationPhotoText(form,'id',100,true),version=Number(organizationPhotoText(form,'version',20,true));recordId=id;destination='/organization?org='+encodeURIComponent(orgId)+'&photosaved=1#photos';
  if(!organizationPhotoID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this photo request before changing it.');
  const ownership=`EXISTS(SELECT 1 FROM organization_photos p WHERE p.id=organization_photo_presence.photo_id AND p.org_id=?)`;
  if(action==='photo_presence_approve')statement=env.DB.prepare(`UPDATE organization_photo_presence SET status='approved',reviewed_by=?,reviewed_at=?,version=version+1 WHERE id=? AND version=? AND status='pending' AND ${ownership} AND ${organizationPhotoScope} RETURNING id`).bind(actor,now,id,version,orgId,...scope);
  else statement=env.DB.prepare(`DELETE FROM organization_photo_presence WHERE id=? AND version=? AND status='pending' AND ${ownership} AND ${organizationPhotoScope} RETURNING id`).bind(id,version,orgId,...scope);
 }else throw new Error('Choose a valid photo collaboration action.');
 const out=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,recordId,now)]);
 if(out[0]?.results?.length!==1)throw new Error('Your access, album or photo request changed. Reload the page before trying again.');
 return redirect(destination);
}

// The caller may expose this GET route publicly. Only published metadata IDs
// resolve; clients can never name private request object keys or read attribution.
async function readOrganizationPhoto(request,env,id){
 const missing=()=>new Response('Photo not found.',{status:404,headers:organizationPhotoHeaders});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{...organizationPhotoHeaders,Allow:'GET, HEAD'}});
 if(!organizationPhotoID(id)||!env.DB||!env.ATTACHMENTS)return missing();
 const row=(await env.DB.prepare('SELECT id,org_id,object_key,content_type,byte_size,sha256 FROM organization_photos WHERE id=?').bind(id).all()).results[0];
 if(!row||!row.object_key||!row.object_key.startsWith('organization-photos/'+row.org_id+'/')||!records.some(r=>r.id===row.org_id))return missing();
 if(!['image/jpeg','image/png','image/webp'].includes(row.content_type)||!Number.isSafeInteger(row.byte_size)||row.byte_size<1||row.byte_size>organizationPhotoMax)return missing();
 const object=await env.ATTACHMENTS.get(row.object_key);if(!object||object.size>4*Math.ceil(organizationPhotoMax/3)+1024)return missing();
 let bytes;try{const envelope=await object.json();if(envelope.schema_version!==1||envelope.byte_size!==row.byte_size||envelope.sha256!==row.sha256||typeof envelope.base64!=='string'||envelope.base64.length!==4*Math.ceil(row.byte_size/3))return missing();const raw=atob(envelope.base64);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length!==row.byte_size||await organizationPhotoSHA(bytes)!==row.sha256)return missing();}catch{return missing();}
 return new Response(request.method==='HEAD'?null:bytes,{headers:{...organizationPhotoHeaders,'Content-Type':row.content_type,'Content-Length':String(bytes.length),'Content-Disposition':'inline'}});
}


const organizationOfficerLimit=20;
const organizationOfficerID=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const organizationOfficerScope="(?=1 OR EXISTS(SELECT 1 FROM organization_editors WHERE email=? AND org_id=? AND status='active'))";
function organizationOfficerText(form,name,max,required=false,multiline=false){
 const values=form.getAll(name);if(values.length>1||values.some(v=>typeof v!=='string'))throw new Error('Please reload the officer form and try again.');
 const value=(values[0]||'').trim();
 if(value.length>max||value.includes('\u0000')||(!multiline&&/[\r\n]/.test(value))||(required&&!value))throw new Error('Please provide a valid '+name.replaceAll('_',' ')+'.');
 return value;
}
function organizationOfficerPermission(principal,orgId){
 const email=String(principal?.email||'').trim().toLowerCase();
 if(!email||!records.some(r=>r.id===orgId)||(!principal.isAdmin&&!principal.memberships?.some(m=>m.org_id===orgId&&m.status==='active'&&String(m.email||'').trim().toLowerCase()===email)))throw new Error('You do not have access to update this organization.');
 return [principal.isAdmin?1:0,email,orgId];
}
function organizationOfficerPublicText(value){
 const contact=/(?:https?:\/\/|www\.|\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?1[\s.()-]*)?(?:\d[\s.()-]*){7,})/i;
 const address=/(?:\bP\.?\s*O\.?\s*Box\s+\d+\b|\b(?:lives?|resides?)\s+(?:at|on)\b|\b\d{1,6}\s+(?:[NSEW]\.?(?:\s+|$))?(?:[A-Z0-9.'-]+\s+){0,5}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl|Terrace|Ter|Circle|Cir|Highway|Hwy)\b)/i;
 if(contact.test(value)||address.test(value))throw new Error('Officer profiles cannot include phone numbers, email addresses, links or addresses. Use the organization contact buttons instead.');
 return value;
}

async function organizationOfficerRows(db,orgIds){
 if(!db||Array.isArray(orgIds)&&!orgIds.length)return [];
 const where=Array.isArray(orgIds)?' WHERE o.org_id IN ('+orgIds.map(()=>'?').join(',')+')':'';
 const sql='SELECT o.*,p.id AS selected_photo_id,p.image_url AS photo_image_url,p.alt_text AS photo_alt_text FROM organization_officers o LEFT JOIN organization_photos p ON p.id=o.photo_id AND p.org_id=o.org_id'+where+' ORDER BY o.created_at,o.id';
 return (await (Array.isArray(orgIds)?db.prepare(sql).bind(...orgIds):db.prepare(sql)).all()).results;
}

function sanitizePublicOfficer(row){
 if(!row||!organizationOfficerID(String(row.id||'')))return null;
 let public_name=String(row.public_name||'').trim().slice(0,120),title=String(row.title||'').trim().slice(0,160),bio=String(row.bio||'').trim().slice(0,1200);
 if(!public_name||!title||!bio)return null;
 try{public_name=organizationOfficerPublicText(public_name);title=organizationOfficerPublicText(title);bio=organizationOfficerPublicText(bio);}catch{return null;}
 let photo=null;
 if(row.selected_photo_id){
  const safe=sanitizePublicPhoto({id:row.selected_photo_id,image_url:row.photo_image_url,alt_text:row.photo_alt_text||('Portrait of '+public_name)});
  if(safe)photo={src:safe.src,alt_text:safe.alt_text};
 }
 return {id:String(row.id),public_name,title,bio,photo};
}

async function organizationOfficerAction(request,env,principal){
 if(request.method!=='POST'||!env.DB)throw new Error('Officer editing is temporarily unavailable.');
 const form=await formData(request),action=organizationOfficerText(form,'action',50,true),orgId=organizationOfficerText(form,'org_id',100,true),scope=organizationOfficerPermission(principal,orgId),actor=principal.email;
 if(!['officer_add','officer_edit','officer_remove'].includes(action))throw new Error('Choose a valid officer action.');
 const adding=action==='officer_add',id=adding?crypto.randomUUID():organizationOfficerText(form,'id',100,true),version=adding?1:Number(organizationOfficerText(form,'version',20,true));
 if(!organizationOfficerID(id)||!Number.isSafeInteger(version)||version<1)throw new Error('Reload this page before changing the officer profile.');
 const now=new Date().toISOString(),destination='/organization?org='+encodeURIComponent(orgId)+'&officersaved=1#officers';
 let statement;
 if(action==='officer_remove')statement=env.DB.prepare(`DELETE FROM organization_officers WHERE id=? AND org_id=? AND version=? AND ${organizationOfficerScope} RETURNING id`).bind(id,orgId,version,...scope);
 else{
  if(organizationOfficerText(form,'consent',10)!=='yes')throw new Error('Confirm the officer agreed to publication of this profile.');
  const publicName=organizationOfficerPublicText(organizationOfficerText(form,'public_name',120,true));
  const title=organizationOfficerPublicText(organizationOfficerText(form,'title',160,true));
  const bio=organizationOfficerPublicText(organizationOfficerText(form,'bio',1200,true,true));
  const photoId=organizationOfficerText(form,'photo_id',100)||null;
  if(photoId&&!organizationOfficerID(photoId))throw new Error('Choose a valid organization photo.');
  const photoGuard='(? IS NULL OR EXISTS(SELECT 1 FROM organization_photos WHERE id=? AND org_id=?))';
  if(adding)statement=env.DB.prepare(`INSERT INTO organization_officers(id,org_id,public_name,title,bio,photo_id,consent_scope,consent_attested_by,consent_attested_at,role_confirmed_at,created_by,created_at,updated_by,updated_at) SELECT ?,?,?,?,?,?,'public_name_title_bio_optional_photo',?,?,?,?,?,?,? WHERE ${organizationOfficerScope} AND ${photoGuard} AND (SELECT count(*) FROM organization_officers WHERE org_id=?)<? RETURNING id`).bind(id,orgId,publicName,title,bio,photoId,actor,now,now,actor,now,actor,now,...scope,photoId,photoId,orgId,orgId,organizationOfficerLimit);
  else statement=env.DB.prepare(`UPDATE organization_officers SET public_name=?,title=?,bio=?,photo_id=?,consent_scope='public_name_title_bio_optional_photo',consent_attested_by=?,consent_attested_at=?,role_confirmed_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND org_id=? AND version=? AND ${organizationOfficerScope} AND ${photoGuard} RETURNING id`).bind(publicName,title,bio,photoId,actor,now,now,actor,now,id,orgId,version,...scope,photoId,photoId,orgId);
 }
 const out=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,record_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),actor,'organization_'+action,id,now)]);
 if(out[0]?.results?.length!==1)throw new Error('Your access or this officer profile changed, the selected photo is unavailable, or the organization already has 20 profiles. Reload the page before trying again.');
 return redirect(destination);
}


// Historical schedules are intentionally kept outside the upcoming event feed.
const memorialServices=[
 {city:'Davis',county:'Yolo',title:'Davis Cemetery Memorial Day Program',schedule:'May 25, 2026 · musical prelude 9:30 a.m.; ceremony 10 a.m.',venue:'Davis Cemetery, 820 Pole Line Road, Davis',notes:'The cemetery’s 2026 program is the latest verified edition. The 2027 ceremony schedule has not been announced in the sources reviewed.',sources:[['Davis Cemetery program','https://daviscemetery.org/memorial-day-ceremony/']]},
 {city:'Davis',county:'Yolo',title:'UC Davis Gold Star Aggies Ceremony',schedule:'May 21, 2026 · 12:15–12:45 p.m.',venue:'Memorial Union North Courtyard, UC Davis',notes:'The campus remembrance took place before the Monday holiday. The 2027 ceremony schedule has not been verified.',sources:[['UC Davis event announcement','https://memorialunion.ucdavis.edu/events/2026-memorial-day-ceremony']]},
 {city:'Woodland',county:'Yolo',title:'Woodland Cemetery remembrance',schedule:null,venue:'Woodland Cemetery, 800 West Street, Woodland',notes:'Yolo American Legion Post 77 organized remembrance here in 2023. A current ceremony date and time have not been verified. Contact the cemetery at 530-661-2000 for the next program.',sources:[['City cemetery information','https://www.cityofwoodland.gov/257/Cemetery'],['American Legion’s 2023 report','https://www.legion.org/information-center/news/honor/2023/june/memorial-day-with-the-american-legion-family']]},
 {city:'Winters',county:'Yolo',title:'Winters Cemetery Memorial Day Service',schedule:'May 25, 2026 · 1:30 p.m.',venue:'Winters Cemetery, 415 Cemetery Drive, Winters',notes:'The cemetery also held volunteer flag placement on May 22, 2026 at 9 a.m. These are past schedules; 2027 details have not been verified.',sources:[['2026 cemetery service','https://www.winterscemetery.org/2026-05-25-memorial-day-service'],['2026 flag placement','https://www.winterscemetery.org/2026-05-22-memorial-day-event']]},
 {city:'Dixon',county:'Solano',title:'Sacramento Valley National Cemetery',schedule:'May 23, 2026 · 9 a.m.',venue:'Sacramento Valley National Cemetery, 5810 Midway Road, Dixon',notes:'The VA scheduled this 2026 ceremony on Saturday, two days before Memorial Day. Do not assume it will take place on the Monday holiday in 2027.',sources:[['VA’s 2026 Memorial Day ceremonies','https://www.cem.va.gov/volunteer/Memorial-Day.asp']]},
 {city:'Benicia',county:'Solano',title:'Benicia Arsenal Post Cemetery',schedule:'May 25, 2026 · 10 a.m.',venue:'Benicia Arsenal Post Cemetery, Benicia',notes:'The VA’s 2026 ceremony list confirms this past date and time. The 2027 schedule has not been verified.',sources:[['VA’s 2026 Memorial Day ceremonies','https://www.cem.va.gov/volunteer/Memorial-Day.asp']]},
 {city:'Vallejo',county:'Solano',title:'Mare Island Naval Cemetery',schedule:'May 25, 2026 · 9 a.m.',venue:'Mare Island Naval Cemetery, 167 O’Hara Court, Vallejo',notes:'The VA’s 2026 ceremony list confirms this past date and time. The 2027 schedule has not been verified.',sources:[['VA’s 2026 Memorial Day ceremonies','https://www.cem.va.gov/volunteer/Memorial-Day.asp'],['VA cemetery information','https://www.cem.va.gov/cems/nchp/MareIslandNaval.asp']]},
 {city:'Vallejo',county:'Solano',title:'Vallejo Warriors’ Memorial',schedule:'May 25, 2026 · 11–11:50 a.m.',venue:'Martin Luther King Jr. Park behind City Hall, 3 Capitol Street, Vallejo',notes:'This past schedule was reported by the Vallejo Sun; direct organizer confirmation was not found. The 2027 program has not been verified.',sources:[['Vallejo Sun’s May 20, 2026 event listing','https://www.vallejosun.com/upcoming-vallejo-events-punk-rock-festival-at-the-odd-fellows-hall/']]},
 {city:'Vacaville',county:'Solano',title:'Vacaville-Elmira Cemetery',schedule:'May 26, 2025 · 11 a.m.',venue:'Vacaville-Elmira Cemetery, 522 Elmira Road, Vacaville',notes:'KCRA reported this 2025 ceremony. A 2026 or 2027 ceremony schedule has not been verified. Contact the cemetery at 707-448-7206 for the next program.',sources:[['KCRA’s 2025 ceremony listing','https://www.kcra.com/article/sacramento-memorial-day-ceremonies-2025/64881902'],['Cemetery district','https://www.vecd.us/']]},
 {city:'Rio Vista',county:'Solano',title:'American Legion Post 178 remembrance',schedule:null,venue:'In front of Rio Vista City Hall — previous annual tradition',notes:'A November 2025 Congressional tribute records an annual Memorial Day ceremony here and grave flag placement. It gives no date or time for the next event. Contact Post 178 at 707-374-6554.',sources:[['2025 Congressional tribute','https://www.congress.gov/119/crec/2025/11/10/171/190/CREC-2025-11-10-pt1-PgE1052-4.pdf'],['American Legion Post 178','https://post178rvca.org/']]},
 {city:'Fairfield / Suisun City',county:'Solano',title:'Local veterans’ remembrance',schedule:null,venue:'Next venue to be confirmed',notes:'Reams American Legion Post 182 and VFW were named in an official 2017 announcement for remembrance at the Old Solano County Courthouse in Fairfield. That is historical context only. Contact Post 182 at 707-429-3110 for the current program.',sources:[['Reams American Legion Post 182','https://reamspost182.org/'],['Historical 2017 Assembly announcement','https://wilson.asmdc.org/sites/a11.asmdc.org/files/e_alert/20170505AD11EAlert_1636.htm']]}
];

function memorialDayPage(url){
 const mh=escapeHtml,county=['Yolo','Solano'].includes(url.searchParams.get('county'))?url.searchParams.get('county'):'';
 const selected=memorialServices.filter(v=>!county||v.county===county);
 return shell('Memorial Day services | Yolo Solano Veterans','A city-by-city guide to Memorial Day remembrance in Yolo and Solano counties, with verified past schedules and links to local organizers.',`<section class="wrap about-page"><p><a class="back" href="/events">← Community events</a></p><span class="eyebrow">REMEMBERING TOGETHER</span><h1>Memorial Day.<br><em>Across our communities.</em></h1><p class="intro">Find local remembrance services and the people organizing them.</p><section class="panel"><span class="label amber">Planning for 2027</span><h2>Monday, May 31, 2027 is Memorial Day.</h2><p>Local ceremonies can take place on a different day. The next ceremony schedules have not been verified in our September 2, 2026 research. Below are the latest schedules we could confirm, clearly marked as past events, and local contacts for programs awaiting details.</p><a href="https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/#url=2027" target="_blank" rel="noopener noreferrer">Official holiday calendar ↗</a></section><form class="panel inline-form" method="get"><label for="memorial-county">Explore by county</label><select id="memorial-county" name="county"><option value="">Yolo &amp; Solano</option><option value="Yolo" ${county==='Yolo'?'selected':''}>Yolo</option><option value="Solano" ${county==='Solano'?'selected':''}>Solano</option></select><button class="button">Show services</button></form><p class="results-note">All times are Pacific. Past schedules are reference only and are not added to the upcoming calendar.</p><div class="two-up">${selected.map(v=>`<article class="panel"><div class="row-between"><span class="eyebrow">${mh(v.city)} · ${mh(v.county)} County</span><span class="label ${v.schedule?'':'amber'}">${v.schedule?'Past schedule':'Schedule awaiting details'}</span></div><h2>${mh(v.title)}</h2><p class="event-time">${mh(v.schedule||'Next date and time to be confirmed')}</p><p>${mh(v.venue)}</p><p>${mh(v.notes)}</p><ul>${v.sources.map(([title,href])=>`<li><a href="${mh(href)}" target="_blank" rel="noopener noreferrer">${mh(title)} ↗</a></li>`).join('')}</ul></article>`).join('')}</div><section class="panel"><h2>More communities</h2><p>A current ceremony schedule has not yet been verified for West Sacramento, Esparto/Capay, Knights Landing, Cordelia or Travis AFB. This does not mean those communities have no observance.</p><p>Have an organizer’s announcement or flyer? Share it so the date, venue and public attendance details can be added.</p><a class="button outline" href="/for-organizations?kind=event">Share a ceremony →</a></section></section>`,{path:'/memorial-day'});
}

const pe=escapeHtml;
const publicDate=s=>new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:'America/Los_Angeles'}).format(new Date(s));
const publicEventDate=v=>v.date_only?new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeZone:'America/Los_Angeles'}).format(new Date(v.start_at))+' · Time to be confirmed':publicDate(v.start_at);
const pacificDayKey=s=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Los_Angeles'}).format(new Date(s));
const upcomingEvents=(events,now=Date.now())=>events.filter(v=>v.status==='published'&&(v.date_only?pacificDayKey(v.start_at)>=pacificDayKey(now):Date.parse(v.end_at||v.start_at)+(!v.end_at?86400000:0)>=now)).sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
function eventCard(v){return `<article class="panel event-card"><div class="row-between"><span class="eyebrow">${pe(v.kind)}</span><span class="label">${pe(v.county)} County</span></div><h2><a href="/events/${pe(v.id)}">${pe(v.title)}</a></h2><p class="event-time">${pe(publicEventDate(v))}</p><p>${pe(v.venue)}</p><p>${pe(v.description)}</p><a href="/events/${pe(v.id)}">Event details &amp; attendance →</a></article>`;}
function eventsPagePublic(url,events){const county=['Yolo','Solano'].includes(url.searchParams.get('county'))?url.searchParams.get('county'):'',upcoming=upcomingEvents(events).filter(v=>!county||v.county===county);return shell('Community events | Yolo Solano Veterans','Find published veteran community events, remembrance ceremonies and volunteer opportunities in Yolo and Solano counties.',`<section class="wrap about-page"><span class="eyebrow">MAKE TIME FOR COMMUNITY</span><h1>Show up.<br><em>Connect. Give back.</em></h1><p class="intro">A shared calendar of published local events and opportunities to serve.</p>${publicMonthCalendar(url,events,{path:'/events',title:'Community calendar'})}<section class="panel"><span class="eyebrow">REMEMBER &amp; HONOR</span><h2>Memorial Day services</h2><p>Find services by city, with verified past schedules and 2027 details to be confirmed.</p><a class="button outline" href="/memorial-day">Explore the city-by-city guide →</a></section><form class="panel inline-form" method="get"><label for="event-county">Explore by county</label><select id="event-county" name="county"><option value="">Yolo &amp; Solano</option><option value="Yolo" ${county==='Yolo'?'selected':''}>Yolo</option><option value="Solano" ${county==='Solano'?'selected':''}>Solano</option></select><button class="button">Show events</button><a href="/events.ics">Download calendar ↓</a></form><p class="results-note">${upcoming.length} upcoming listings · Pacific time. Listings use reviewed public sources or project team updates; confirm schedule, accessibility and attendance rules with the host. Calendar downloads are a snapshot and do not refresh automatically.</p><div class="two-up">${upcoming.length?upcoming.map(eventCard).join(''):'<div class="panel"><h2>No upcoming listings for this selection.</h2><p>More events are being verified. Browse both counties or share a proposed event below.</p></div>'}</div><div class="partner-strip panel"><h2>Have something to share?</h2><p>Send the public details and organizer’s source. A review comes before publication.</p><a class="button light" href="/for-organizations?kind=event">Propose an event →</a></div></section>`,{path:'/events'});}
function eventDetail(v){const host=records.find(r=>r.id===v.organization_id),past=!upcomingEvents([v]).length;return shell(`${v.title} | Yolo Solano Veterans`,v.description,`<section class="wrap detail-page"><a class="back" href="/events">← All events</a><div class="profile-heading"><span class="eyebrow">${pe(v.kind)} · ${pe(v.county)} COUNTY</span><h1>${pe(v.title)}</h1>${past?'<span class="label amber">Past event</span>':''}<p>${pe(v.description)}</p></div><div class="profile-grid"><section class="panel"><h2>Plan your visit</h2><dl><div><dt>When</dt><dd>${pe(publicEventDate(v))}${!v.date_only&&v.end_at?'<br>Ends '+pe(publicDate(v.end_at)):''}</dd></div><div><dt>Where</dt><dd>${pe(v.venue)}<br><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(v.venue)}" target="_blank" rel="noopener noreferrer">Open venue in Maps ↗</a></dd></div><div><dt>Who can attend?</dt><dd>${pe(v.audience)}</dd></div><div><dt>Organizer</dt><dd>${pe(v.organizer)}${host?`<br><a href="/organizations/${host.id}">View related organization →</a>`:''}</dd></div></dl>${v.time_note?`<p class="small-note">${pe(v.time_note)}</p>`:''}<div class="profile-actions">${v.source_url?`<a class="button" href="${pe(v.source_url)}" target="_blank" rel="noopener noreferrer">${v.source_kind==='project_team'?'Organizer website':'Organizer details / registration'} ↗</a>`:''}<a class="button outline" href="/events.ics?event=${pe(v.id)}">Add to calendar ↓</a></div></section><aside class="panel">${v.source_kind==='project_team'?`<span class="label">Project team update</span><h2>Check before you go.</h2><p>${pe(v.source_note||'Event details supplied by the project team.')}</p>`:`<span class="label">Published source checked</span><h2>Check before you go.</h2><p>Source reviewed ${pe(v.source_checked)}. This listing has not been directly confirmed with the organizer.</p>`}<p>Follow the organizer’s latest instructions for registration, accessibility, weather changes and cancellations.</p><a href="/for-organizations?kind=event">Suggest a correction →</a></aside></div></section>`,{path:'/events/'+v.id,detail:true});}
function submissionPage(url,{error='',received=false}={}){const kind=['profile','event','claim','other'].includes(url.searchParams.get('kind'))?url.searchParams.get('kind'):'profile',selected=url.searchParams.get('org')||'';
 return shell('Organization submission desk | Yolo Solano Veterans','Suggest public profile corrections, share an event or request organization stewardship.',`<section class="wrap workspace-page"><span class="eyebrow">FOR THE ORGANIZATIONS THAT SERVE</span><h1>Your local knowledge.<br><em>A stronger community.</em></h1><p class="intro">Help keep organization information current and bring more people together.</p>${received?'<div class="preview-banner" role="status"><strong>Received for review.</strong><span>Your submission is saved in the private review queue. It is not published yet. No email confirmation is sent.</span></div>':error?`<div class="preview-banner" role="alert"><strong>Submission not saved.</strong><span>${pe(error)}</span></div>`:''}<div class="profile-grid"><section class="panel"><h2>Share an update</h2><p>Already designated as a representative? <a href="${hqOrigin}/organization">Sign in to your organization editor →</a></p><p>Use this desk for public organization information. We check the source and handle clear updates before publication. Sign-in is not required to suggest an update.</p><form class="edit-form" method="post" action="/submit"><label>What would you like to do?<select name="kind">${[['profile','Correct a profile'],['event','Propose an event'],['claim','Request organization stewardship'],['other','Add an organization / other update']].map(([id,label])=>`<option value="${id}" ${id===kind?'selected':''}>${label}</option>`).join('')}</select></label><label>Organization<select name="org_id"><option value="">New organization / not listed</option>${records.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${pe(r.verified_name)}</option>`).join('')}</select></label><label>Update title<input name="title" maxlength="180" required placeholder="New meeting time, event title, or organization name"></label><label>Public details<textarea name="details" maxlength="6000" rows="7" required placeholder="For events, include date, time, public venue, organizer, audience and registration details. Use general organization contact channels only; do not include individual contact details or roster links."></textarea></label><label>Official source or public flyer link (optional)<input name="source_url" type="url" maxlength="2000" placeholder="https://"></label><div class="two-up"><label>Your name (private)<input name="sender_name" maxlength="120" autocomplete="name" required></label><label>Reply email (private)<input name="sender_email" type="email" maxlength="254" autocomplete="email" required></label></div><div class="bot-field" aria-hidden="true"><label>Leave this blank<input name="website_check" tabindex="-1" autocomplete="off"></label></div><label class="check"><input type="checkbox" name="privacy" value="yes" required> I am submitting public organization information, with permission to share it. I have not included veteran case details, medical information, discharge papers or private membership lists.</label><p class="small-note">Your name and email stay in the private review queue for follow-up. Proposed public details may be published after review. Do not upload private files through a link. This desk is not monitored for urgent help.</p><button class="button">Submit for review →</button></form></section><aside><section class="panel"><h2>What happens next</h2><ol class="steps"><li><strong>We review the source.</strong><p>Published facts are checked and unclear details are held for follow-up.</p></li><li><strong>We verify stewardship.</strong><p>Requests to manage a profile are checked through an independent organization contact. Submission alone does not grant access.</p></li><li><strong>A reviewed update goes live.</strong><p>Events and corrections have a separate publication step.</p></li></ol></section><section class="panel"><h2>Project coordination</h2><p>Tasks, submissions and shared projects live in the private headquarters. Designated representatives can manage their assigned organization pages after Aaron or Sterling approves their access.</p><a href="${hqOrigin}">Open headquarters ↗</a></section></aside></div></section>`,{path:'/for-organizations'});
}
function publicExtension(url,events){if(url.pathname==='/memorial-day')return {status:200,html:memorialDayPage(url)};if(url.pathname==='/share')return {status:200,html:speakerSubmissionPage(url,records,{received:url.searchParams.has('received')})};if(url.pathname==='/for-organizations')return {status:200,html:submissionPage(url,{received:url.searchParams.has('received')})};if(url.pathname==='/events')return {status:200,html:eventsPagePublic(url,events)};if(url.pathname.startsWith('/events/')){const v=events.find(v=>v.id===url.pathname.slice(8)&&v.status==='published');if(v)return {status:200,html:eventDetail(v)};}return null;}
const icsEscape=s=>String(s||'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,');
const utc=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function foldICS(line){const lines=[];let current='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>74){lines.push(current);current=' ';bytes=1;}current+=c;bytes+=n;}lines.push(current);return lines.join('\r\n');}
function eventCalendar(events){const stamp=utc(new Date());const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Yolo Solano Veterans//Community Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Yolo Solano Veterans'];for(const v of events){if(v.status!=='published')continue;const day=v.start_at.slice(0,10),nextDay=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10),schedule=v.date_only?['DTSTART;VALUE=DATE:'+day.replaceAll('-',''),'DTEND;VALUE=DATE:'+nextDay.replaceAll('-','')]:['DTSTART:'+utc(v.start_at),...(v.end_at?['DTEND:'+utc(v.end_at)]:[])],note=(v.date_only?'Time to be confirmed. This calendar entry reserves the date; event hours have not been announced.\n':'')+v.description+'\n'+v.audience+(v.source_kind==='project_team'?'\n'+(v.source_note||'Details supplied by the project team.'):'')+(v.source_url?'\nConfirm latest details: '+v.source_url:'');lines.push('BEGIN:VEVENT','UID:'+icsEscape(v.id)+'@yolo-county-veterans','DTSTAMP:'+stamp,...schedule,'SUMMARY:'+icsEscape(v.title+(v.date_only?' — Time to be confirmed':'')),'DESCRIPTION:'+icsEscape(note),'LOCATION:'+icsEscape(v.venue),'URL:'+origin+'/events/'+encodeURIComponent(v.id),'END:VEVENT');}lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';}


const assets={"/styles.css":{"type":"text/css; charset=utf-8","base64":"LyogWW9sbyBTb2xhbm8gVmV0ZXJhbnM6IHNpbHZlciBzdXJmYWNlcywgYmx1ZSBzdHJ1Y3R1cmUsIHJlZCBlbXBoYXNpcy4gKi8KOnJvb3R7CiAtLWluazojMTAyYjUyOy0tYm9keTojMzU0NjVjOy0tbXV0ZWQ6IzViNmE3ZTstLWNyZWFtOiNmM2Y1Zjg7CiAtLWxpbmU6I2Q3ZGRlNjstLWdvbGQ6I2M1MjYzYzstLXBhbGU6I2U5ZWVmNTstLXdoaXRlOiNmZmY7CiAtLWJsdWU6IzE3NGI5NzstLWJsdWUtZGFyazojMGMyNjRiOy0tcmVkOiNjNTI2M2M7LS1zaWx2ZXI6I2U4ZWNmMTsKIC0tZm9udDpJbnRlcix1aS1zYW5zLXNlcmlmLHN5c3RlbS11aSwtYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCwiU2Vnb2UgVUkiLEFyaWFsLHNhbnMtc2VyaWY7CiAtLXNlcmlmOnZhcigtLWZvbnQpOy0tcmFkaXVzOjE0cHg7LS1zaGFkb3c6MCA0cHggMjJweCAjMTAyYjUyMDg7Cn0KCi5yZWNpcGllbnQtcGlja2Vye2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MXJlbX0ucmVjaXBpZW50LXBpY2tlciBsZWdlbmR7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC1zaXplOjEuMjVyZW07Zm9udC13ZWlnaHQ6NzAwO3BhZGRpbmc6MCAuMzVyZW19LnJlY2lwaWVudC1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSk7Z2FwOi41NXJlbTttYXJnaW4tdG9wOi44NXJlbTttYXgtaGVpZ2h0OjI4cmVtO292ZXJmbG93OmF1dG87cGFkZGluZzouMTVyZW19LnJlY2lwaWVudC1jaG9pY2V7ZGlzcGxheTpmbGV4IWltcG9ydGFudDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2dhcDouNjVyZW07Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzouN3JlbTtiYWNrZ3JvdW5kOiNmZmZ9LnJlY2lwaWVudC1jaG9pY2UgaW5wdXR7d2lkdGg6YXV0byFpbXBvcnRhbnQ7bWFyZ2luLXRvcDouMnJlbX0ucmVjaXBpZW50LWNob2ljZSBzcGFue2Rpc3BsYXk6Z3JpZDtnYXA6LjE1cmVtfS5yZWNpcGllbnQtY2hvaWNlIHNtYWxse2NvbG9yOnZhcigtLW11dGVkKX0ub3JnYW5pemF0aW9uLXNwZWFrZXJze21hcmdpbi10b3A6Mi4ycmVtfS5zcGVha2VyLXJlcXVlc3R7bWFyZ2luLXRvcDoxcmVtfS5zcGVha2VyLXJlcXVlc3QgZGx7ZGlzcGxheTpncmlkO2dhcDouNzVyZW19LnNwZWFrZXItcmVxdWVzdCBkbCBkaXZ7ZGlzcGxheTpncmlkO2dhcDouMnJlbX0uc3BlYWtlci1yZXF1ZXN0IGR0e2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS1uYXZ5KX0uc3BlYWtlci1yZXF1ZXN0IGRke21hcmdpbjowO3doaXRlLXNwYWNlOnByZS13cmFwfS5zcGVha2VyLWFjdGlvbnN7ZGlzcGxheTpmbGV4O2dhcDouN3JlbTtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjFyZW19LnNwZWFrZXItYWN0aW9ucyBmb3Jte21hcmdpbjowfS5zcGVha2VyLXJlcXVlc3QgZGV0YWlsc3ttYXJnaW4tdG9wOjFyZW19LnNwZWFrZXItcmVxdWVzdCBkZXRhaWxzIHN1bW1hcnl7Zm9udC13ZWlnaHQ6NzAwO2N1cnNvcjpwb2ludGVyfQoub3JnYW5pemF0aW9uLW1lZXRpbmctcGxhbnttYXJnaW4tdG9wOjIuMnJlbX0ubWVldGluZy1wbGFuLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKTtnYXA6MXJlbX0ubWVldGluZy1tb250aHtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTZweDtwYWRkaW5nOjFyZW07YmFja2dyb3VuZDojZmZmfS5tZWV0aW5nLW1vbnRoIGxlZ2VuZHtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXNpemU6MS4yNXJlbTtmb250LXdlaWdodDo3MDA7Y29sb3I6dmFyKC0tbmF2eSk7cGFkZGluZzowIC4zNXJlbX0ubWVldGluZy1wbGFuLXNhdmV7Z3JpZC1jb2x1bW46MS8tMTtqdXN0aWZ5LXNlbGY6c3RhcnR9CkBtZWRpYSAobWF4LXdpZHRoOjcyMHB4KXsucmVjaXBpZW50LWdyaWQsLm1lZXRpbmctcGxhbi1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQoqe2JveC1zaXppbmc6Ym9yZGVyLWJveH0KaHRtbHtzY3JvbGwtYmVoYXZpb3I6c21vb3RoO3Njcm9sbC1wYWRkaW5nLXRvcDoyNHB4fQpib2R5e21hcmdpbjowO2JhY2tncm91bmQ6dmFyKC0tY3JlYW0pO2NvbG9yOnZhcigtLWJvZHkpO2ZvbnQtZmFtaWx5OnZhcigtLWZvbnQpO2ZvbnQtc2l6ZToxNXB4O2xpbmUtaGVpZ2h0OjEuNjU7LXdlYmtpdC1mb250LXNtb290aGluZzphbnRpYWxpYXNlZH0KOjpzZWxlY3Rpb257YmFja2dyb3VuZDojZDRlM2ZmO2NvbG9yOiMxMDJiNTJ9CmF7Y29sb3I6dmFyKC0tYmx1ZSk7dGV4dC1kZWNvcmF0aW9uOm5vbmU7dGV4dC11bmRlcmxpbmUtb2Zmc2V0OjRweH0KYTpob3Zlcnt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lfQpidXR0b24saW5wdXQsc2VsZWN0LHRleHRhcmVhe2ZvbnQ6aW5oZXJpdH0KYnV0dG9uLGEsc2VsZWN0LGlucHV0LHRleHRhcmVhey13ZWJraXQtdGFwLWhpZ2hsaWdodC1jb2xvcjp0cmFuc3BhcmVudH0KYTpmb2N1cy12aXNpYmxlLGJ1dHRvbjpmb2N1cy12aXNpYmxlLGlucHV0OmZvY3VzLXZpc2libGUsc2VsZWN0OmZvY3VzLXZpc2libGUsdGV4dGFyZWE6Zm9jdXMtdmlzaWJsZSxzdW1tYXJ5OmZvY3VzLXZpc2libGV7b3V0bGluZTozcHggc29saWQgIzE3NjNjNjtvdXRsaW5lLW9mZnNldDo0cHh9CmgxLGgyLGgzLHB7bWFyZ2luOjB9CmgxLGgyLGgze2NvbG9yOnZhcigtLWluayk7Zm9udC1mYW1pbHk6dmFyKC0tZm9udCk7Zm9udC13ZWlnaHQ6NzUwO292ZXJmbG93LXdyYXA6YnJlYWstd29yZH0KaDF7Zm9udC1zaXplOmNsYW1wKDQycHgsNS42dncsNzZweCk7bGluZS1oZWlnaHQ6MS4wNztsZXR0ZXItc3BhY2luZzotLjA1NWVtO2ZvbnQtd2VpZ2h0OjgwMH0KaDEgZW17Zm9udC1zdHlsZTpub3JtYWw7Y29sb3I6dmFyKC0tYmx1ZSk7Zm9udC13ZWlnaHQ6aW5oZXJpdH0KaDJ7Zm9udC1zaXplOjMycHg7bGluZS1oZWlnaHQ6MS4yMjtsZXR0ZXItc3BhY2luZzotLjAzNWVtfQpoM3tmb250LXNpemU6MTlweDtsaW5lLWhlaWdodDoxLjQ7bGV0dGVyLXNwYWNpbmc6LS4wMThlbX0KcHtsaW5lLWhlaWdodDoxLjc1fQoud3JhcHttYXgtd2lkdGg6MTMyMHB4O21hcmdpbjowIGF1dG87cGFkZGluZy1sZWZ0OjQ4cHg7cGFkZGluZy1yaWdodDo0OHB4fQoudG9wbGluZXtiYWNrZ3JvdW5kOnZhcigtLWJsdWUtZGFyayk7Y29sb3I6I2U3ZWVmODtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo1NTA7bGV0dGVyLXNwYWNpbmc6LjAxNWVtO2JvcmRlci1ib3R0b206M3B4IHNvbGlkIHZhcigtLXJlZCl9Ci50b3BsaW5lIC53cmFwe21pbi1oZWlnaHQ6MzdweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoyMHB4fQoudG9wbGluZSBhe2NvbG9yOiNmZmZ9Ci5oZWFkZXJ7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MzBweDttaW4taGVpZ2h0OjExMnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpfQouYnJhbmR7ZGlzcGxheTpmbGV4O2dhcDoxNHB4O2FsaWduLWl0ZW1zOmNlbnRlcjtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo2MDA7bGluZS1oZWlnaHQ6MS40O2NvbG9yOnZhcigtLWluayk7ZmxleC1zaHJpbms6MH0KLmJyYW5kOmhvdmVye3RleHQtZGVjb3JhdGlvbjpub25lfQouYnJhbmQgc3Ryb25ne2ZvbnQtc2l6ZToyNHB4O2xldHRlci1zcGFjaW5nOi0uMDQ1ZW07Zm9udC13ZWlnaHQ6ODAwfQouYnJhbmQtbWFya3toZWlnaHQ6NTJweDt3aWR0aDo1MnB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtiYWNrZ3JvdW5kOnZhcigtLWluayk7Ym9yZGVyOjA7Ym9yZGVyLWJvdHRvbTo0cHggc29saWQgdmFyKC0tcmVkKTtib3JkZXItcmFkaXVzOjlweDtjb2xvcjojZmZmO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzotLjA1NWVtO3Bvc2l0aW9uOnJlbGF0aXZlO2xpbmUtaGVpZ2h0OjF9Ci5icmFuZC1tYXJrIHNwYW57Zm9udC1zaXplOjhweDtwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206M3B4O3JpZ2h0OjVweDtsZXR0ZXItc3BhY2luZzoxcHh9Ci5wcm9qZWN0LWxvZ297ZGlzcGxheTpibG9jaztvYmplY3QtZml0OmNvbnRhaW47ZmxleC1zaHJpbms6MDthc3BlY3QtcmF0aW86MTtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXJhZGl1czo4cHh9Ci5icmFuZCAucHJvamVjdC1sb2dve3dpZHRoOjExMnB4O2hlaWdodDoxMTJweDttYXJnaW46MTJweCAwfQpuYXZ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MjZweDtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo2NTB9Cm5hdiBhe2NvbG9yOnZhcigtLWJvZHkpfQpuYXYgYVthcmlhLWN1cnJlbnRde2NvbG9yOnZhcigtLWluayk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZTt0ZXh0LWRlY29yYXRpb24tY29sb3I6dmFyKC0tcmVkKTt0ZXh0LWRlY29yYXRpb24tdGhpY2tuZXNzOjNweDt0ZXh0LXVuZGVybGluZS1vZmZzZXQ6MTBweH0KLm5hdi13b3Jrc3BhY2V7cGFkZGluZzoxMnB4IDE3cHg7Ym9yZGVyOjFweCBzb2xpZCAjYjljNWQ0O2JvcmRlci1yYWRpdXM6OHB4O2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1pbmspfQouaGVyb3tkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo1NnB4O3BhZGRpbmctdG9wOjY0cHg7cGFkZGluZy1ib3R0b206NTZweH0KLmV5ZWJyb3d7Zm9udC1zaXplOjExcHg7bGV0dGVyLXNwYWNpbmc6LjEyZW07Zm9udC13ZWlnaHQ6NzUwO2xpbmUtaGVpZ2h0OjEuNTtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5vdmVybGluZXtkaXNwbGF5OmJsb2NrO21hcmdpbi1ib3R0b206MjNweDtjb2xvcjp2YXIoLS1ibHVlKX0KLmhlcm8+ZGl2PnB7Zm9udC1zaXplOjE3cHg7bWF4LXdpZHRoOjU1MHB4O21hcmdpbi10b3A6MjRweDtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5oZXJvLW5vdGUsLmxvZ28taGVyby1ub3Rle3BhZGRpbmc6MjRweCAwIDI0cHggMjhweDtib3JkZXItbGVmdDozcHggc29saWQgdmFyKC0tcmVkKTttaW4td2lkdGg6MjM1cHg7bWF4LXdpZHRoOjMwMHB4fQouaGVybyAuaGVyby1ub3RlIHAsLmhlcm8gLmxvZ28taGVyby1ub3RlIHB7Zm9udC1mYW1pbHk6dmFyKC0tZm9udCk7Zm9udC1zaXplOjIzcHg7bGluZS1oZWlnaHQ6MS40O2ZvbnQtd2VpZ2h0OjY1MDtsZXR0ZXItc3BhY2luZzotLjAyNWVtO2NvbG9yOnZhcigtLWluayk7bWFyZ2luLXRvcDowfQouaGVyby1ub3RlPnNwYW46bGFzdC1jaGlsZCwubG9nby1oZXJvLW5vdGU+c3Bhbntmb250LXNpemU6MTNweDtkaXNwbGF5OmJsb2NrO2xpbmUtaGVpZ2h0OjEuODttYXJnaW4tdG9wOjE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpfQouc21hbGwtcnVsZXtkaXNwbGF5OmJsb2NrO3dpZHRoOjM4cHg7aGVpZ2h0OjNweDtiYWNrZ3JvdW5kOnZhcigtLXJlZCk7bWFyZ2luLWJvdHRvbToyMHB4fQouc2VhcmNoLXBhbmVse2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmciAxLjI1ZnIgYXV0bztnYXA6MTZweDthbGlnbi1pdGVtczplbmQ7cGFkZGluZzoyNHB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6dmFyKC0tcmFkaXVzKTtib3gtc2hhZG93OnZhcigtLXNoYWRvdyl9Ci5maWVsZCBsYWJlbCxmb3JtPmxhYmVse2Rpc3BsYXk6YmxvY2s7Y29sb3I6dmFyKC0taW5rKTtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7bWFyZ2luLWJvdHRvbTo4cHh9CmlucHV0LHNlbGVjdCx0ZXh0YXJlYXtib3JkZXI6MXB4IHNvbGlkICNiN2MyZDA7YmFja2dyb3VuZDojZmZmO2NvbG9yOnZhcigtLWluayk7Ym9yZGVyLXJhZGl1czo4cHg7d2lkdGg6MTAwJTtmb250LXNpemU6MTRweH0KaW5wdXQsc2VsZWN0e2hlaWdodDo0OHB4O3BhZGRpbmc6MCAxM3B4fQppbnB1dDo6cGxhY2Vob2xkZXIsdGV4dGFyZWE6OnBsYWNlaG9sZGVye2NvbG9yOiM3MzgwOTM7b3BhY2l0eToxfQpzZWxlY3R7Y3Vyc29yOnBvaW50ZXJ9CmlucHV0W3R5cGU9ImNoZWNrYm94Il17YWNjZW50LWNvbG9yOnZhcigtLWJsdWUpfQouYnV0dG9ue2Rpc3BsYXk6aW5saW5lLWZsZXg7Z2FwOjE2cHg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7bWluLWhlaWdodDo0OHB4O2JvcmRlcjoxcHggc29saWQgdmFyKC0tYmx1ZSk7Ym9yZGVyLXJhZGl1czo4cHg7YmFja2dyb3VuZDp2YXIoLS1ibHVlKTtjb2xvcjojZmZmO3BhZGRpbmc6MTJweCAyMHB4O2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjcwMDtsaW5lLWhlaWdodDoxLjQ7Y3Vyc29yOnBvaW50ZXI7d2hpdGUtc3BhY2U6bm93cmFwO3RyYW5zaXRpb246YmFja2dyb3VuZC1jb2xvciAuMTVzLGJvcmRlci1jb2xvciAuMTVzfQouYnV0dG9uOmhvdmVye2JhY2tncm91bmQ6IzEwM2I3OTtib3JkZXItY29sb3I6IzEwM2I3OTtjb2xvcjojZmZmO3RleHQtZGVjb3JhdGlvbjpub25lfQouYnV0dG9uLmxpZ2h0e2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1pbmspO2JvcmRlci1jb2xvcjojZmZmfQouYnV0dG9uLmxpZ2h0OmhvdmVye2JhY2tncm91bmQ6I2VhZjBmODtib3JkZXItY29sb3I6I2VhZjBmOH0KLmJ1dHRvbi5vdXRsaW5le2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1ibHVlKTtib3JkZXItY29sb3I6I2FlYmRkMH0KLmJ1dHRvbi5vdXRsaW5lOmhvdmVye2JhY2tncm91bmQ6I2VkZjNmYjtib3JkZXItY29sb3I6dmFyKC0tYmx1ZSl9Ci5xdWljay1saW5rc3tkaXNwbGF5OmZsZXg7Z2FwOjEwcHg7YWxpZ24taXRlbXM6Y2VudGVyO21hcmdpbjoxOHB4IDAgMzZweDtmb250LXNpemU6MTJweDtmbGV4LXdyYXA6d3JhcH0KLnF1aWNrLWxpbmtzPnNwYW57Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1yaWdodDozcHh9Ci5xdWljay1saW5rcyBhe2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7cGFkZGluZzo2cHggMTNweDtib3JkZXItcmFkaXVzOjdweDtiYWNrZ3JvdW5kOiNmZmZ9Ci5zZWN0aW9uLWhlYWRpbmd7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmVuZDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MjBweH0KLnNlY3Rpb24taGVhZGluZyBoMnttYXJnaW4tdG9wOjZweH0KLnJlc3VsdC1jb3VudHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NTUwO3doaXRlLXNwYWNlOm5vd3JhcH0KLnJlc3VsdHMtbm90ZXtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHg7bWFyZ2luOjE2cHggMCAyNnB4fQouY2FyZC1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSk7Z2FwOjIycHh9Ci5vcmctY2FyZHtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOnZhcigtLXJhZGl1cyk7cGFkZGluZzoyNnB4O2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Ym94LXNoYWRvdzp2YXIoLS1zaGFkb3cpfQoub3JnLWNhcmQ6aG92ZXJ7Ym9yZGVyLWNvbG9yOiM5MWE5Yzh9Ci5jYXJkLXRvcHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo5cHg7bWFyZ2luLWJvdHRvbToxOHB4fQoub3JnLXN5bWJvbHt3aWR0aDozNnB4O2hlaWdodDozNnB4O2ZsZXgtc2hyaW5rOjA7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6I2VhZjBmODtib3JkZXI6MXB4IHNvbGlkICNkNWRmZWM7Ym9yZGVyLXJhZGl1czo4cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0Ojc1MH0KLm9yZy1zeW1ib2wuc2Vhc29uYWx7YmFja2dyb3VuZDojZmZmMGYyO2NvbG9yOiNhMTFkMzI7Ym9yZGVyLWNvbG9yOiNmMGMzY2F9Ci5jYXJkLXRvcCAuZXllYnJvd3tmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOi4wNWVtfQouc291cmNlLXN0YXR1c3ttYXJnaW4tbGVmdDphdXRvO2ZvbnQtc2l6ZTo5cHg7d2hpdGUtc3BhY2U6bm93cmFwO2NvbG9yOnZhcigtLW11dGVkKX0KLnNvdXJjZS1zdGF0dXM6YmVmb3Jle2NvbnRlbnQ6J+KAoic7Y29sb3I6dmFyKC0tYmx1ZSk7bWFyZ2luLXJpZ2h0OjRweH0KLm9yZy1jYXJkIGgze2ZvbnQtc2l6ZToyMHB4O2ZvbnQtd2VpZ2h0Ojc1MDtsaW5lLWhlaWdodDoxLjM1O21pbi1oZWlnaHQ6NTRweH0KLmxvY2F0aW9ue2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6MTNweH0KLmxvY2F0aW9uPnNwYW57Y29sb3I6dmFyKC0tbXV0ZWQpfQoubG9jYXRpb24gYntkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjY1MDtjb2xvcjp2YXIoLS1ibHVlKTttYXJnaW4tdG9wOjVweH0KLmNhcmQtZGVzY3JpcHRpb257Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4O21hcmdpbi10b3A6MTZweDttYXJnaW4tYm90dG9tOjIycHh9Ci5tZWV0aW5ne2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpO3BhZGRpbmctdG9wOjE1cHg7bWFyZ2luLXRvcDphdXRvO2Rpc3BsYXk6Z3JpZDtnYXA6NXB4O2ZvbnQtc2l6ZToxMnB4fQouZGV0YWlsLWxhYmVse3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtsZXR0ZXItc3BhY2luZzouMDllbTtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDo3NTB9Ci5jYXJkLWJvdHRvbXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxMnB4O2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpO21hcmdpbi10b3A6MThweDtwYWRkaW5nLXRvcDoxNnB4O2ZvbnQtc2l6ZToxMnB4fQouY2FyZC1ib3R0b20+YTpmaXJzdC1jaGlsZHtmb250LXdlaWdodDo3MDB9Ci5tdXRlZHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHh9Ci5kaXJlY3RvcnktZm9vdG5vdGV7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MjhweDtwYWRkaW5nOjMwcHggMCA0NnB4O2ZvbnQtc2l6ZToxMnB4O2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpfQouZGlyZWN0b3J5LWZvb3Rub3RlPnNwYW57d2hpdGUtc3BhY2U6bm93cmFwO2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS1pbmspfQouZGlyZWN0b3J5LWZvb3Rub3RlIHB7bWF4LXdpZHRoOjYyMHB4O2NvbG9yOnZhcigtLW11dGVkKX0KLmRpcmVjdG9yeS1mb290bm90ZT5he21hcmdpbi1sZWZ0OmF1dG87bWluLXdpZHRoOjE1NXB4O2ZvbnQtd2VpZ2h0OjY1MH0KLnBhcnRuZXItc3RyaXB7YmFja2dyb3VuZDp2YXIoLS1ibHVlLWRhcmspO3BhZGRpbmc6NDhweCAwO2NvbG9yOiNlNWVkZjg7Ym9yZGVyLXRvcDo0cHggc29saWQgdmFyKC0tcmVkKX0KLnBhcnRuZXItaW5uZXJ7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyO2dhcDo2NHB4O2FsaWduLWl0ZW1zOmNlbnRlcn0KLnBhcnRuZXItc3RyaXAgLmV5ZWJyb3d7Y29sb3I6I2I5ZDBlZn0KLnBhcnRuZXItc3RyaXAgaDJ7Y29sb3I6I2ZmZjttYXJnaW4tdG9wOjE0cHg7Zm9udC1zaXplOjM0cHh9Ci5wYXJ0bmVyLXN0cmlwIHB7Y29sb3I6I2QyZGZlZjtmb250LXNpemU6MTVweDttYXgtd2lkdGg6NDgwcHg7bWFyZ2luLWJvdHRvbToyMnB4fQoucGFydG5lci1zdHJpcC5wYW5lbHtwYWRkaW5nOjMwcHg7bWFyZ2luLXRvcDozMHB4fQoucGFydG5lci1zdHJpcC5wYW5lbCBoMnttYXJnaW4tdG9wOjB9CmZvb3RlcntwYWRkaW5nOjQycHggMCAzMHB4O2JhY2tncm91bmQ6I2U4ZWRmMztib3JkZXItdG9wOjFweCBzb2xpZCAjZDNkY2U4fQouZm9vdGVyLWlubmVye2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MzBweH0KLmZvb3Rlci1icmFuZHtmb250LXNpemU6MTlweDtmb250LXdlaWdodDo3NTA7Y29sb3I6dmFyKC0taW5rKTtsZXR0ZXItc3BhY2luZzotLjAyNWVtfQouZm9vdGVyLWlubmVyIHB7Zm9udC1zaXplOjEzcHg7bWFyZ2luLXRvcDo1cHg7Y29sb3I6dmFyKC0tbXV0ZWQpfQouZm9vdGVyLWxpbmtze2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjI1cHg7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjUwfQouZmluZXByaW50e2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tdG9wOjMwcHh9Ci5za2lwe3Bvc2l0aW9uOmFic29sdXRlO3RvcDotMTAwcHg7bGVmdDoyMHB4O3BhZGRpbmc6MTBweCAxNnB4O2JhY2tncm91bmQ6I2ZmZjt6LWluZGV4OjIwO2JvcmRlcjoycHggc29saWQgdmFyKC0tYmx1ZSk7Ym9yZGVyLXJhZGl1czo2cHh9Ci5za2lwOmZvY3Vze3RvcDoxMHB4fQouYmFja3tmb250LXNpemU6MTNweDtkaXNwbGF5OmlubGluZS1ibG9jazttYXJnaW4tYm90dG9tOjMwcHg7Zm9udC13ZWlnaHQ6NjUwfQouZGV0YWlsLXBhZ2V7cGFkZGluZy10b3A6MzRweDtwYWRkaW5nLWJvdHRvbTo1OHB4fQoucHJvZmlsZS1oZWFkaW5ne21heC13aWR0aDo5NzBweDttYXJnaW4tYm90dG9tOjM2cHg7cGFkZGluZy1ib3R0b206MzJweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKX0KLnByb2ZpbGUtaGVhZGluZyBoMXtmb250LXNpemU6Y2xhbXAoMzRweCw0LjN2dyw1NHB4KTttYXJnaW46MTVweCAwIDIycHg7bGV0dGVyLXNwYWNpbmc6LS4wNDVlbTtsaW5lLWhlaWdodDoxLjEyfQoucHJvZmlsZS1oZWFkaW5nPnB7Zm9udC1zaXplOjE2cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21heC13aWR0aDo4MjBweH0KLnByb2ZpbGUtYWN0aW9uc3tkaXNwbGF5OmZsZXg7Z2FwOjEycHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLXRvcDoyNXB4fQoucHJvZmlsZS1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6bWlubWF4KDAsMS44ZnIpIG1pbm1heCgwLDFmcik7Z2FwOjI2cHh9Ci5wYW5lbHtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOnZhcigtLXJhZGl1cyk7cGFkZGluZzozMHB4O21hcmdpbi1ib3R0b206MjRweDtib3gtc2hhZG93OnZhcigtLXNoYWRvdyk7bWluLXdpZHRoOjB9Ci5wYW5lbCBoMntmb250LXNpemU6MjVweDttYXJnaW4tYm90dG9tOjE3cHh9Ci5wYW5lbCBoM3tmb250LXNpemU6MTdweDttYXJnaW4tdG9wOjIzcHg7bWFyZ2luLWJvdHRvbTo5cHh9Ci5wYW5lbCBwe2ZvbnQtc2l6ZToxNHB4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tYm90dG9tOjE0cHh9Ci5wYW5lbCBhe2ZvbnQtc2l6ZToxM3B4fQoucGFuZWwgLmJ1dHRvbntmb250LXNpemU6MTRweH0KLnBhbmVsIGxpe2ZvbnQtc2l6ZToxNHB4O292ZXJmbG93LXdyYXA6YW55d2hlcmV9CmRse21hcmdpbjowfQpkbD5kaXZ7cGFkZGluZzoxN3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSl9CmRsPmRpdjpsYXN0LWNoaWxke2JvcmRlci1ib3R0b206MH0KZHR7Zm9udC1zaXplOjEwcHg7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi4wOGVtO2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo3NTA7bWFyZ2luLWJvdHRvbTo3cHh9CmRke21hcmdpbjowO2ZvbnQtc2l6ZToxNXB4O292ZXJmbG93LXdyYXA6YW55d2hlcmV9CmRkIGF7ZGlzcGxheTppbmxpbmUtYmxvY2s7bWFyZ2luLXRvcDo4cHh9Ci5wYW5lbCAuc21hbGwtbm90ZSwuc21hbGwtbm90ZXtmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXRvcDoxOHB4O2xpbmUtaGVpZ2h0OjEuNzV9Ci5sYWJlbHtkaXNwbGF5OmlubGluZS1ibG9jaztmb250LXNpemU6MTBweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjA1ZW07Zm9udC13ZWlnaHQ6NzUwO2NvbG9yOiMyMTRlOGU7YmFja2dyb3VuZDojZWFmMWZiO2JvcmRlcjoxcHggc29saWQgI2QzZTBmMjtib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweCA5cHg7bWFyZ2luLWJvdHRvbToxNHB4O2xpbmUtaGVpZ2h0OjEuNH0KLmxhYmVsLmFtYmVye2NvbG9yOiM5YjI0MzQ7YmFja2dyb3VuZDojZmZmMGYyO2JvcmRlci1jb2xvcjojZWZjN2NlfQoudHJ1c3QtcGFuZWx7YmFja2dyb3VuZDojZWVmM2ZhO2JvcmRlci1jb2xvcjojZDVkZmVkfQouc291cmNlLXBhbmVsIHVse2xpc3Qtc3R5bGU6bm9uZTtwYWRkaW5nOjA7bWFyZ2luOjB9Ci5zb3VyY2UtcGFuZWwgbGl7bWFyZ2luLWJvdHRvbToxOHB4O292ZXJmbG93LXdyYXA6YW55d2hlcmV9Ci5zb3VyY2UtcGFuZWwgbGk+c3BhbntkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tdG9wOjVweH0KLm9mZmljZXJze2Rpc3BsYXk6Z3JpZDtnYXA6MTlweH0KLm9mZmljZXJzPmRpdntkaXNwbGF5OmZsZXg7Z2FwOjE0cHg7YWxpZ24taXRlbXM6Y2VudGVyfQouYXZhdGFye3dpZHRoOjQycHg7aGVpZ2h0OjQycHg7ZmxleC1zaHJpbms6MDtiYWNrZ3JvdW5kOiNlNmVlZjk7Y29sb3I6dmFyKC0tYmx1ZSk7Ym9yZGVyOjFweCBzb2xpZCAjZDRlMGYwO2JvcmRlci1yYWRpdXM6MTBweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NzUwfQoub2ZmaWNlcnMgc3Ryb25ne2ZvbnQtc2l6ZToxNXB4fQoub2ZmaWNlcnM+ZGl2PmRpdj5zcGFue2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tbXV0ZWQpfQoub2ZmaWNlcnMgYXtmb250LXNpemU6MTJweH0KLndvcmtzcGFjZS1wYWdlLC5hYm91dC1wYWdle3BhZGRpbmctdG9wOjU0cHg7cGFkZGluZy1ib3R0b206NThweH0KLndvcmtzcGFjZS1wYWdlIGgxLC5hYm91dC1wYWdlIGgxe21hcmdpbi10b3A6MTVweDtmb250LXNpemU6Y2xhbXAoNDBweCw0Ljh2dyw2MnB4KX0KLmludHJve2ZvbnQtc2l6ZToxOHB4O2NvbG9yOnZhcigtLW11dGVkKTttYXgtd2lkdGg6ODAwcHg7bWFyZ2luLXRvcDoyNHB4O21hcmdpbi1ib3R0b206MzBweDtsaW5lLWhlaWdodDoxLjc1fQoucHJldmlldy1iYW5uZXJ7ZGlzcGxheTpmbGV4O2dhcDoyMHB4O2FsaWduLWl0ZW1zOmNlbnRlcjtiYWNrZ3JvdW5kOiNmZmYxZjM7Ym9yZGVyOjFweCBzb2xpZCAjZWFjM2NhO2JvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1yZWQpO3BhZGRpbmc6MTlweCAyNHB4O2JvcmRlci1yYWRpdXM6OXB4O21hcmdpbjoyOHB4IDA7Zm9udC1zaXplOjEzcHg7Y29sb3I6Izg0MjYzOH0KLnByZXZpZXctYmFubmVyIHN0cm9uZ3t3aGl0ZS1zcGFjZTpub3dyYXB9Ci53b3Jrc3BhY2UtZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjI0MHB4IG1pbm1heCgwLDFmcik7Z2FwOjI4cHh9Ci53b3Jrc3BhY2UtbWVudXtwYWRkaW5nOjI1cHggMjBweH0KLndvcmtzcGFjZS1tZW51IHB7Zm9udC1zaXplOjE0cHg7cGFkZGluZzoxM3B4IDA7Y29sb3I6dmFyKC0tbXV0ZWQpfQoud29ya3NwYWNlLW1lbnUgLmFjdGl2ZS1pdGVte2NvbG9yOnZhcigtLWJsdWUpO2ZvbnQtd2VpZ2h0Ojc1MH0KLndvcmtzcGFjZS1tZW51IC5sYWJlbHttYXJnaW4tdG9wOjI0cHh9Ci5pbmxpbmUtZm9ybXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6ZW5kO2dhcDoxM3B4O2ZsZXgtd3JhcDp3cmFwfQouaW5saW5lLWZvcm0gc2VsZWN0e21pbi13aWR0aDowfQouaW5saW5lLWZvcm0+bGFiZWx7bWFyZ2luLWJvdHRvbTowfQouaW5saW5lLWZvcm0+c2VsZWN0e2ZsZXg6MX0KLnByZXZpZXctaGVhZGluZ3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxOHB4O21hcmdpbi10b3A6MzBweH0KLnByZXZpZXctaGVhZGluZyBoMntmb250LXNpemU6MjVweH0KLmRlbW8tZmllbGR7bWFyZ2luOjE4cHggMH0KLmRlbW8tZmllbGQ+c3Bhbntmb250LXNpemU6MTBweDtsZXR0ZXItc3BhY2luZzouMDdlbTtmb250LXdlaWdodDo3NTA7Y29sb3I6dmFyKC0tbXV0ZWQpfQouZGVtby1maWVsZD5we2JhY2tncm91bmQ6I2YyZjVmOTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTNweCAxNnB4O21hcmdpbi10b3A6OHB4O2NvbG9yOnZhcigtLWJvZHkpO2ZvbnQtc2l6ZToxNHB4fQoudGhyZWUtdXB7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKTtnYXA6MjZweDttYXJnaW46NDBweCAwfQoudGhyZWUtdXAgYXJ0aWNsZXtwYWRkaW5nOjI1cHg7YmFja2dyb3VuZDojZmZmO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXRvcDozcHggc29saWQgdmFyKC0tYmx1ZSk7Ym9yZGVyLXJhZGl1czoxMXB4fQoudGhyZWUtdXAgaDJ7Zm9udC1zaXplOjIzcHg7bWFyZ2luLWJvdHRvbToxNXB4fQoudGhyZWUtdXAgaDN7bWFyZ2luLWJvdHRvbToxM3B4fQoudGhyZWUtdXAgcHtmb250LXNpemU6MTRweDtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5zdGVwe2NvbG9yOnZhcigtLXJlZCk7Zm9udC1zaXplOjI1cHg7Zm9udC13ZWlnaHQ6NzUwO2Rpc3BsYXk6YmxvY2s7bWFyZ2luLWJvdHRvbToxM3B4fQouZW1wdHktc3RhdGV7Z3JpZC1jb2x1bW46MS8tMTt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjY0cHggMjhweDtib3JkZXI6MXB4IGRhc2hlZCAjYWViZGQwO2JvcmRlci1yYWRpdXM6dmFyKC0tcmFkaXVzKTtiYWNrZ3JvdW5kOiNmZmZ9Ci5lbXB0eS1zdGF0ZSBwe21hcmdpbjoxNnB4IDAgMjRweDtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5hbGwtc291cmNlc3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnI7Z2FwOjEycHggMzBweH0KLnR3by11cHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgyLG1pbm1heCgwLDFmcikpO2dhcDoyNHB4fQoucm93LWJldHdlZW57ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxNnB4O2FsaWduLWl0ZW1zOmNlbnRlcn0KLnJvdy1iZXR3ZWVuIC5sYWJlbHttYXJnaW4tYm90dG9tOjB9Ci5ldmVudC1jYXJke21hcmdpbi1ib3R0b206MDtib3JkZXItdG9wOjNweCBzb2xpZCAjYWZiZWQyO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW59Ci5ldmVudC1jYXJkIGgye2ZvbnQtc2l6ZToyN3B4O21hcmdpbi10b3A6MTlweH0KLmV2ZW50LWNhcmQgaDIgYXtmb250LXNpemU6aW5oZXJpdDtjb2xvcjp2YXIoLS1pbmspfQouZXZlbnQtY2FyZCBwLmV2ZW50LXRpbWV7Zm9udC13ZWlnaHQ6NzUwO2NvbG9yOnZhcigtLWJsdWUpO2ZvbnQtc2l6ZToxNXB4fQouZXZlbnQtY2FyZD5hOmxhc3QtY2hpbGR7bWFyZ2luLXRvcDphdXRvO2ZvbnQtd2VpZ2h0OjcwMDtwYWRkaW5nLXRvcDoxMHB4fQouZXZlbnQtdGltZXtmb250LXdlaWdodDo3NTA7Y29sb3I6dmFyKC0tYmx1ZSl9Ci5lZGl0LWZvcm17ZGlzcGxheTpncmlkO2dhcDoyMXB4O21hcmdpbi10b3A6MjRweH0KLmVkaXQtZm9ybSBsYWJlbHtkaXNwbGF5OmdyaWQ7Z2FwOjhweDtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2NTA7Y29sb3I6dmFyKC0taW5rKTttYXJnaW46MH0KLmVkaXQtZm9ybSBpbnB1dCwuZWRpdC1mb3JtIHNlbGVjdCwuZWRpdC1mb3JtIHRleHRhcmVhe3dpZHRoOjEwMCU7Zm9udDppbmhlcml0O2JvcmRlcjoxcHggc29saWQgI2I3YzNkMjtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjEycHggMTRweDtiYWNrZ3JvdW5kOiNmZmY7Y29sb3I6dmFyKC0taW5rKTttaW4taGVpZ2h0OjQ4cHh9Ci5lZGl0LWZvcm0gdGV4dGFyZWF7cmVzaXplOnZlcnRpY2FsO2xpbmUtaGVpZ2h0OjEuNjV9Ci5lZGl0LWZvcm0gLmJ1dHRvbntqdXN0aWZ5LXNlbGY6c3RhcnR9Ci5lZGl0LWZvcm0gLmNoZWNre2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2dhcDoxMnB4O2ZvbnQtc2l6ZToxNHB4O2xpbmUtaGVpZ2h0OjEuNjU7Zm9udC13ZWlnaHQ6NDAwO2NvbG9yOnZhcigtLWJvZHkpfQouZWRpdC1mb3JtIC5jaGVjayBpbnB1dHt3aWR0aDoyMHB4O21pbi1oZWlnaHQ6MjBweDtoZWlnaHQ6MjBweDtmbGV4LXNocmluazowO21hcmdpbi10b3A6M3B4O3BhZGRpbmc6MH0KLmJvdC1maWVsZHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0Oi0xMDAwMHB4O3dpZHRoOjFweDtoZWlnaHQ6MXB4O292ZXJmbG93OmhpZGRlbn0KLnN0ZXBze3BhZGRpbmctbGVmdDoyM3B4fQouc3RlcHMgbGl7cGFkZGluZzoxMnB4IDB9Ci5zdGVwcyBsaTo6bWFya2Vye2NvbG9yOnZhcigtLWJsdWUpO2ZvbnQtd2VpZ2h0Ojc1MH0KLnN0ZXBzIHB7bWFyZ2luLXRvcDo2cHh9Ci5wcmVzZXJ2ZS1saW5lc3t3aGl0ZS1zcGFjZTpwcmUtd3JhcDtvdmVyZmxvdy13cmFwOmFueXdoZXJlfQpkZXRhaWxzPnN1bW1hcnl7Y3Vyc29yOnBvaW50ZXJ9CmRldGFpbHNbb3Blbl0+c3VtbWFyeXttYXJnaW4tYm90dG9tOjEwcHh9CgovKiBMb2dvIGdhbGxlcnk6IG5ldXRyYWwgc3VyZmFjZXMgcHJlc2VydmUgZXZlcnkgb3JnYW5pemF0aW9uJ3MgYWN0dWFsIGFydHdvcmsuICovCi5zci1vbmx5e3Bvc2l0aW9uOmFic29sdXRlO3dpZHRoOjFweDtoZWlnaHQ6MXB4O3BhZGRpbmc6MDttYXJnaW46LTFweDtvdmVyZmxvdzpoaWRkZW47Y2xpcDpyZWN0KDAsMCwwLDApO3doaXRlLXNwYWNlOm5vd3JhcDtib3JkZXI6MH0KLmxvZ28taGVyb3twYWRkaW5nLXRvcDo2NHB4O3BhZGRpbmctYm90dG9tOjU1cHh9Ci5sb2dvLWhlcm8gaDF7Zm9udC1zaXplOmNsYW1wKDQzcHgsNS40dncsNzJweCl9Ci5sb2dvLWhlcm8gLm92ZXJsaW5le21hcmdpbi1ib3R0b206MjJweH0KLnRvdWNoLWluc3RydWN0aW9ue2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9Ci5sb2dvLWRpcmVjdG9yeS10b29sc3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoyMHB4O3BhZGRpbmc6MjJweCAwO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWxpbmUpfQoubG9nby1qdW1wLWxpbmtze2Rpc3BsYXk6ZmxleDtnYXA6OXB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtc2l6ZToxMnB4fQoubG9nby1qdW1wLWxpbmtzIGF7Zm9udC13ZWlnaHQ6NzAwO3BhZGRpbmc6OXB4IDEzcHg7Ym9yZGVyOjFweCBzb2xpZCAjZDNkY2U3O2JhY2tncm91bmQ6I2ZmZjtib3JkZXItcmFkaXVzOjdweDtjb2xvcjp2YXIoLS1pbmspfQoubG9nby1qdW1wLWxpbmtzIGE6aG92ZXJ7YmFja2dyb3VuZDojZTlmMGZhO2JvcmRlci1jb2xvcjojYTZiYWQ0O3RleHQtZGVjb3JhdGlvbjpub25lfQoubG9nby1zZWFyY2h7bWFyZ2luLWJvdHRvbTozNnB4O2JvcmRlcjoxcHggc29saWQgI2NhZDRlMTtib3JkZXItcmFkaXVzOjExcHg7YmFja2dyb3VuZDojZmZmO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmxvZ28tc2VhcmNoIHN1bW1hcnl7bGlzdC1zdHlsZTpub25lO2ZvbnQtd2VpZ2h0OjY1MDtmb250LXNpemU6MTRweDtwYWRkaW5nOjE4cHggMjFweDtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2NvbG9yOnZhcigtLWluayl9Ci5sb2dvLXNlYXJjaCBzdW1tYXJ5Ojotd2Via2l0LWRldGFpbHMtbWFya2Vye2Rpc3BsYXk6bm9uZX0KLmxvZ28tc2VhcmNoIHN1bW1hcnkgc3Bhbntmb250LXNpemU6MjNweDtsaW5lLWhlaWdodDoxO2NvbG9yOnZhcigtLWJsdWUpfQoubG9nby1zZWFyY2hbb3Blbl0gc3VtbWFyeXtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTttYXJnaW4tYm90dG9tOjB9Ci5sb2dvLXNlYXJjaCAuc2VhcmNoLXBhbmVse2JvcmRlcjowO2JveC1zaGFkb3c6bm9uZX0KLmxvZ28tY2xlYXJ7ZGlzcGxheTpibG9jaztwYWRkaW5nOjAgMjRweCAyMnB4O2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjY1MH0KLmxvZ28tZmlsdGVyLW5vdGV7Zm9udC1zaXplOjE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1ib3R0b206MjZweH0KLmxvZ28tY2F0ZWdvcnl7bWFyZ2luLXRvcDo0NHB4O3Njcm9sbC1tYXJnaW4tdG9wOjI4cHh9Ci5sb2dvLWNhdGVnb3J5LWhlYWRpbmd7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MjBweDtib3JkZXItYm90dG9tOjJweCBzb2xpZCAjY2JkNWUyO3BhZGRpbmctYm90dG9tOjE4cHg7bWFyZ2luLWJvdHRvbTozMHB4fQoubG9nby1jYXRlZ29yeS1oZWFkaW5nIGgye2ZvbnQtc2l6ZTozMnB4O2xldHRlci1zcGFjaW5nOi0uMDRlbX0KLmxvZ28tY2F0ZWdvcnktaGVhZGluZz5zcGFue2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjt3aWR0aDozNnB4O2hlaWdodDozNnB4O2ZsZXgtc2hyaW5rOjA7Ym9yZGVyLXJhZGl1czo4cHg7YmFja2dyb3VuZDojZmZmO2NvbG9yOnZhcigtLXJlZCk7Zm9udC1zaXplOjI0cHg7Zm9udC13ZWlnaHQ6NzAwO2JvcmRlcjoxcHggc29saWQgI2RiZTJlYn0KLmxvZ28tdHlwZS1ncm91cHttYXJnaW4tYm90dG9tOjM2cHh9Ci5sb2dvLXR5cGUtaGVhZGluZ3tkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxOHB4O21hcmdpbi1ib3R0b206MTZweH0KLmxvZ28tdHlwZS1oZWFkaW5nIGgze2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0Ojc1MDtsZXR0ZXItc3BhY2luZzouMDA1ZW19Ci5sb2dvLXR5cGUtaGVhZGluZz5zcGFue2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo2MDB9Ci5sb2dvLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNCxtaW5tYXgoMCwxZnIpKTtnYXA6MjBweH0KLmxvZ28tdGlsZXttaW4taGVpZ2h0OjI0NXB4O3Bvc2l0aW9uOnJlbGF0aXZlO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpmbGV4LXN0YXJ0O2JvcmRlcjoxcHggc29saWQgI2NlZDdlMjtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXJhZGl1czoxM3B4O292ZXJmbG93OmhpZGRlbjt0ZXh0LWRlY29yYXRpb246bm9uZTtpc29sYXRpb246aXNvbGF0ZTtib3gtc2hhZG93OjAgM3B4IDEycHggIzEwMmI1MjA2O3RyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4xNnMsYm94LXNoYWRvdyAuMTZzfQoubG9nby10aWxlOmhvdmVye3RleHQtZGVjb3JhdGlvbjpub25lO2JvcmRlci1jb2xvcjojNmY5MWJkO2JveC1zaGFkb3c6MCA5cHggMjVweCAjMTAyYjUyMTR9Ci5sb2dvLWFydHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7cGFkZGluZzoyNXB4IDI2cHg7d2lkdGg6MTAwJTttaW4taGVpZ2h0OjE1MHB4fQoubG9nby1hcnQgaW1ne3dpZHRoOjEwMCU7aGVpZ2h0OjEwNXB4O21heC13aWR0aDoyMTBweDtvYmplY3QtZml0OmNvbnRhaW59Ci5sb2dvLXRpbGUtLXZldHMgLmxvZ28tYXJ0IGltZ3toZWlnaHQ6YXV0bzthc3BlY3QtcmF0aW86MS43ODtvYmplY3QtZml0OmNvdmVyO29iamVjdC1wb3NpdGlvbjpjZW50ZXIgdG9wO2JvcmRlci1yYWRpdXM6NnB4fQoubG9nby13b3JkbWFya3tmb250LWZhbWlseTp2YXIoLS1mb250KTt0ZXh0LWFsaWduOmNlbnRlcjtsaW5lLWhlaWdodDoxLjE2O2ZvbnQtc2l6ZToyNXB4O2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzotLjAzNWVtO2NvbG9yOnZhcigtLWluayl9Ci5sb2dvLXdvcmRtYXJrPnNwYW57ZGlzcGxheTpibG9jaztmb250OjcwMCAxMHB4LzEuNSB2YXIoLS1mb250KTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjEzZW07bWFyZ2luLWJvdHRvbToxMHB4O2NvbG9yOnZhcigtLW11dGVkKX0KLnZldHMtd29yZG1hcmsgc3Ryb25ne2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjU4cHg7Zm9udC13ZWlnaHQ6ODUwO2xldHRlci1zcGFjaW5nOi0uMDY1ZW07bGluZS1oZWlnaHQ6MS4xO2NvbG9yOnZhcigtLWJsdWUpfQoudmV0cy13b3JkbWFyaz5zcGFue21heC13aWR0aDoxODVweDttYXJnaW46MTBweCBhdXRvIDA7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NjUwO2xldHRlci1zcGFjaW5nOjA7dGV4dC10cmFuc2Zvcm06bm9uZTtsaW5lLWhlaWdodDoxLjQ7Y29sb3I6dmFyKC0tYm9keSl9Ci5sb2dvLXJldmVhbHtwb3NpdGlvbjpzdGF0aWM7YmFja2dyb3VuZDp2YXIoLS1pbmspO2JvcmRlci10b3A6M3B4IHNvbGlkIHZhcigtLXJlZCk7Y29sb3I6I2ZmZjtwYWRkaW5nOjE1cHggMThweDt3aWR0aDoxMDAlO2ZsZXg6MTtkaXNwbGF5OmdyaWQ7Z2FwOjVweDtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxLjR9Ci5sb2dvLXJldmVhbCBzdHJvbmd7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwO2xpbmUtaGVpZ2h0OjEuMzV9Ci5sb2dvLXJldmVhbD5zcGFuOm5vdCgubG9nby1vcGVuKXtjb2xvcjojZDRlMmY1fQoubG9nby1yZXZlYWwgc21hbGx7Y29sb3I6I2ZmZjtmb250LXNpemU6MTFweH0KLmxvZ28tb3BlbnttYXJnaW4tdG9wOjVweDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo2NTB9Ci5sb2dvLXRpbGU6Zm9jdXMtdmlzaWJsZXtvdXRsaW5lOjNweCBzb2xpZCAjMTc2M2M2O291dGxpbmUtb2Zmc2V0OjRweH0KLmxvZ28tZGlyZWN0b3J5Pi5kaXJlY3RvcnktZm9vdG5vdGV7bWFyZ2luLXRvcDo0NnB4fQoubG9nby10aWxlLS10b3lzIC5sb2dvLWFydHtiYWNrZ3JvdW5kOiNkNzE5MjB9Ci5sb2dvLXRpbGUtLXZmdyAubG9nby1hcnQgaW1ne3dpZHRoOjMzMHB4O21heC13aWR0aDpub25lO2hlaWdodDoxMzJweDtmbGV4LXNocmluazowfQoKLnJlc291cmNlcy1wYWdle3BhZGRpbmctdG9wOjYwcHg7cGFkZGluZy1ib3R0b206NzRweH0KLnJlc291cmNlLWhlcm97bWF4LXdpZHRoOjkyMHB4O21hcmdpbi1ib3R0b206MjhweH0KLnJlc291cmNlLWhlcm8gaDF7Zm9udC1zaXplOmNsYW1wKDQycHgsN3Z3LDc4cHgpO2xldHRlci1zcGFjaW5nOi0uMDU1ZW07bGluZS1oZWlnaHQ6Ljk4O21hcmdpbjoxMnB4IDAgMjJweH0KLnJlc291cmNlLXVyZ2VudHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOmF1dG8gMWZyO2dhcDoxMHB4IDE4cHg7bWFyZ2luLXRvcDoyOHB4O3BhZGRpbmc6MjBweCAyMnB4O2JvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1yZWQpO2JhY2tncm91bmQ6I2VlZjNmOTtib3JkZXItcmFkaXVzOjAgMTBweCAxMHB4IDB9Ci5yZXNvdXJjZS1qdW1we2Rpc3BsYXk6ZmxleDtmbGV4LXdyYXA6d3JhcDtnYXA6MTBweDttYXJnaW46MjhweCAwIDM0cHh9Ci5yZXNvdXJjZS1qdW1wIGF7cGFkZGluZzo5cHggMTNweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OTk5cHg7YmFja2dyb3VuZDojZmZmO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDt0ZXh0LWRlY29yYXRpb246bm9uZX0KLnJlc291cmNlLWp1bXAgYTpob3Zlcntib3JkZXItY29sb3I6dmFyKC0tYmx1ZSk7YmFja2dyb3VuZDojZWRmM2ZifQoucmVzb3VyY2UtZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgyLG1pbm1heCgwLDFmcikpO2dhcDoyMnB4O2FsaWduLWl0ZW1zOnN0YXJ0fQoucmVzb3VyY2Utc2VjdGlvbntwYWRkaW5nOjI3cHh9Ci5yZXNvdXJjZS1zZWN0aW9uIGgye2ZvbnQtc2l6ZToyNnB4O21hcmdpbjo3cHggMCAxMHB4fQoucmVzb3VyY2UtbGlua3N7bGlzdC1zdHlsZTpub25lO21hcmdpbjoyMHB4IDAgMDtwYWRkaW5nOjA7ZGlzcGxheTpncmlkO2dhcDoxMHB4fQoucmVzb3VyY2UtbGlua3MgYXtkaXNwbGF5OmdyaWQ7Z2FwOjRweDtwYWRkaW5nOjE0cHggMTVweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6I2ZiZmNmZTtjb2xvcjp2YXIoLS1ib2R5KTt0ZXh0LWRlY29yYXRpb246bm9uZX0KLnJlc291cmNlLWxpbmtzIGE6aG92ZXJ7Ym9yZGVyLWNvbG9yOiM4ZGE2YzU7YmFja2dyb3VuZDojZjNmN2ZjfQoucmVzb3VyY2UtbGlua3Mgc3Ryb25ne2NvbG9yOnZhcigtLWJsdWUpO2ZvbnQtc2l6ZToxNXB4fQoucmVzb3VyY2UtbGlua3Mgc3Bhbntmb250LXNpemU6MTNweDtsaW5lLWhlaWdodDoxLjU1fQoucmVzb3VyY2UtbGlua3Mgc21hbGx7Zm9udC1zaXplOjExcHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjcwMH0KLnJlc291cmNlLXJldmlld2Vke21hcmdpbi10b3A6MjhweH0KCi8qIFRoZSBoZWFkcXVhcnRlcnMgdXNlcyB0aGUgc2FtZSB2aXN1YWwgbGFuZ3VhZ2UsIHdpdGggY2xlYXIgd29ya2luZyBzdGF0ZXMuICovCi5ocXtiYWNrZ3JvdW5kOiNmMGYzZjh9Ci5ocS1oZWFkZXJ7YmFja2dyb3VuZDp2YXIoLS1ibHVlLWRhcmspO2JvcmRlci1ib3R0b206M3B4IHNvbGlkIHZhcigtLXJlZCk7Y29sb3I6I2ZmZjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoyNXB4O3BhZGRpbmc6MjNweCAzMnB4O2ZsZXgtd3JhcDp3cmFwfQouaHEtaGVhZGVyIGF7Y29sb3I6I2ZmZjt0ZXh0LWRlY29yYXRpb246bm9uZTtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo2MDB9Ci5ocS1oZWFkZXIgYTpob3Zlcnt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lfQouaHEtaGVhZGVyIC5ocS1icmFuZHtmb250LXNpemU6MjNweDtmb250LXdlaWdodDo4MDA7bGV0dGVyLXNwYWNpbmc6LS4wM2VtfQouaHEtaGVhZGVyIC5ocS1icmFuZHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxNXB4fQouaHEtYnJhbmQgLnByb2plY3QtbG9nb3t3aWR0aDo3NnB4O2hlaWdodDo3NnB4fQouaHEtYnJhbmQgc3Bhbntmb250LXNpemU6MTdweDtmb250LXdlaWdodDo1MDA7bGV0dGVyLXNwYWNpbmc6MDttYXJnaW4tbGVmdDoxM3B4O2NvbG9yOiNlMGU5ZjZ9Ci5ocS1wcml2YXRle2ZvbnQtc2l6ZToxMnB4O2NvbG9yOiNjYmRhZjA7bWFyZ2luLXJpZ2h0OmF1dG99Ci5ocS1sYXlvdXR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoyMzhweCBtaW5tYXgoMCwxZnIpO21heC13aWR0aDoxODAwcHg7bWFyZ2luOmF1dG87bWluLWhlaWdodDpjYWxjKDEwMHZoIC0gOTBweCl9Ci5ocS1uYXZ7cGFkZGluZzozMHB4IDE4cHg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1zdGFydDthbGlnbi1pdGVtczpzdHJldGNoO2dhcDo3cHg7YmFja2dyb3VuZDojZmZmO2JvcmRlci1yaWdodDoxcHggc29saWQgdmFyKC0tbGluZSl9Ci5ocS1uYXYgYXtwYWRkaW5nOjEycHggMTVweDtjb2xvcjp2YXIoLS1ib2R5KTt0ZXh0LWRlY29yYXRpb246bm9uZTtib3JkZXI6MXB4IHNvbGlkIHRyYW5zcGFyZW50O2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjYwMDtsaW5lLWhlaWdodDoxLjV9Ci5ocS1uYXYgYTpob3ZlcntiYWNrZ3JvdW5kOiNmMGY0ZmE7Y29sb3I6dmFyKC0tYmx1ZSl9Ci5ocS1uYXYgYVthcmlhLWN1cnJlbnRde2JhY2tncm91bmQ6I2U4ZWZmYTtjb2xvcjojMTAzYjc4O2JvcmRlci1jb2xvcjojY2VkY2YwO2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1yZWQpO2ZvbnQtd2VpZ2h0Ojc1MH0KLmhxLW5hdiBwe3BhZGRpbmc6MjBweCAxNXB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxLjg7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSk7bWFyZ2luLXRvcDoxOHB4fQouaHEtbWFpbntwYWRkaW5nOjQ0cHggY2xhbXAoMjRweCw0LjV2dyw2NnB4KTttaW4td2lkdGg6MH0KLmhxLXRpdGxlIGgxe2ZvbnQtc2l6ZTpjbGFtcCgzNnB4LDMuN3Z3LDUwcHgpO21hcmdpbjoxM3B4IDAgMzJweDtmb250LXdlaWdodDo4MDA7bGV0dGVyLXNwYWNpbmc6LS4wNDVlbX0KLmhxLXN0YXRze2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsbWlubWF4KDAsMWZyKSk7Z2FwOjE3cHg7bWFyZ2luOjMwcHggMH0KLmhxLXN0YXRzIGF7YmFja2dyb3VuZDojZmZmO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MjRweDtjb2xvcjp2YXIoLS1tdXRlZCk7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NTUwO2JveC1zaGFkb3c6dmFyKC0tc2hhZG93KX0KLmhxLXN0YXRzIGE6aG92ZXJ7Ym9yZGVyLWNvbG9yOiM5N2IwY2Y7YmFja2dyb3VuZDojZmJmZGZmfQouaHEtc3RhdHMgc3Ryb25ne2Rpc3BsYXk6YmxvY2s7Zm9udDo4MDAgMzlweC8xLjE1IHZhcigtLWZvbnQpO2xldHRlci1zcGFjaW5nOi0uMDVlbTtjb2xvcjp2YXIoLS1ibHVlKTttYXJnaW4tYm90dG9tOjEwcHh9Ci5ocSAucGFuZWx7cGFkZGluZzoyOHB4O21hcmdpbi1ib3R0b206MjJweH0KLmhxIGgye2ZvbnQtc2l6ZToyNnB4fQouaHEgaDN7Zm9udC1zaXplOjE4cHh9Ci5ocSAuaW5saW5lLWZvcm0gbGFiZWx7ZGlzcGxheTpncmlkO2dhcDo3cHg7Zm9udC1zaXplOjEycHh9Ci5ocSAuaW5saW5lLWZvcm0gc2VsZWN0e3BhZGRpbmc6MTFweDtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjYjdjM2QyO2JvcmRlci1yYWRpdXM6OHB4O21heC13aWR0aDoxMDAlfQouaHEgc3VtbWFyeXtmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjE2cHg7Y29sb3I6dmFyKC0taW5rKTtsaW5lLWhlaWdodDoxLjZ9Ci5hY3Rpdml0eS1saXN0e2xpc3Qtc3R5bGU6bm9uZTtwYWRkaW5nOjB9Ci5hY3Rpdml0eS1saXN0IGxpe2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpO3BhZGRpbmc6MTZweCAwO2ZvbnQtc2l6ZToxNHB4fQouYWN0aXZpdHktbGlzdCBzcGFue2Rpc3BsYXk6YmxvY2s7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6N3B4fQoudGFzay1saXN0IC5wYW5lbCBoMnttYXJnaW4tdG9wOjE4cHh9Ci5ocSAucGFuZWwgYXtvdmVyZmxvdy13cmFwOmFueXdoZXJlfQouaHEgLmludHJve2ZvbnQtc2l6ZToxOHB4fQouaHEgLnBhbmVsIHB7bGluZS1oZWlnaHQ6MS44fQouaHEgZmllbGRzZXR7Ym9yZGVyOjA7bWFyZ2luOjA7cGFkZGluZzowO2Rpc3BsYXk6Y29udGVudHN9Ci5yZXF1ZXN0LWNvbXBvc2V7Ym9yZGVyLXRvcDo0cHggc29saWQgdmFyKC0tcmVkKX0KLnJlcXVlc3QtY29tcG9zZSBoMnttYXJnaW46MTFweCAwO2ZvbnQtc2l6ZToyOXB4fQoucmVxdWVzdC1jb21wb3NlIC5lZGl0LWZvcm17bWFyZ2luLXRvcDoyMnB4fQoucmVxdWVzdC1jb21wb3NlIHRleHRhcmVhe2ZvbnQtc2l6ZToxN3B4O21pbi1oZWlnaHQ6MTQwcHg7YmFja2dyb3VuZDojZmFmY2ZlfQoucmVxdWVzdC1jb21wb3NlIC5yb3ctYmV0d2VlbiAuc21hbGwtbm90ZXttYXJnaW4tdG9wOjB9Ci5yZXF1ZXN0LWZpbHRlcnN7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpmbGV4LXN0YXJ0O2ZsZXgtd3JhcDp3cmFwO2dhcDo5cHg7bWFyZ2luOjI5cHggMH0KLnJlcXVlc3QtZmlsdGVycyBhe3BhZGRpbmc6MTBweCAxNXB4O2JvcmRlcjoxcHggc29saWQgI2NjZDZlNDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kOiNmZmY7Zm9udC1zaXplOjEzcHh9Ci5yZXF1ZXN0LWZpbHRlcnMgYVthcmlhLWN1cnJlbnRde2JhY2tncm91bmQ6dmFyKC0tYmx1ZSk7Ym9yZGVyLWNvbG9yOnZhcigtLWJsdWUpO2NvbG9yOiNmZmY7dGV4dC1kZWNvcmF0aW9uOm5vbmV9Ci5yZXF1ZXN0LWZpbHRlcnMgc3BhbnttYXJnaW4tbGVmdDo3cHg7b3BhY2l0eTouODV9Ci5yZXF1ZXN0LWNhcmQgaDJ7bWFyZ2luOjE5cHggMCAxNHB4fQoucmVxdWVzdC1jYXJkPi5zbWFsbC1ub3Rle21hcmdpbi10b3A6MTRweH0KLnJlcXVlc3QtcmVzdWx0LC5yZXF1ZXN0LXN1Z2dlc3Rpb257cGFkZGluZzoyMnB4O21hcmdpbi10b3A6MjRweDtiYWNrZ3JvdW5kOiNlZWY0ZmM7Ym9yZGVyOjFweCBzb2xpZCAjZDRlMmY0O2JvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1ibHVlKTtib3JkZXItcmFkaXVzOjlweH0KLnJlcXVlc3QtcmVzdWx0PnN0cm9uZ3tjb2xvcjp2YXIoLS1pbmspO2ZvbnQtc2l6ZToxNHB4fQoucmVxdWVzdC1yZXN1bHQgcHttYXJnaW4tdG9wOjlweH0KLnJlcXVlc3Qtc3VnZ2VzdGlvbntiYWNrZ3JvdW5kOiNmZmY0ZjU7Ym9yZGVyLWNvbG9yOiNlZGQwZDY7Ym9yZGVyLWxlZnQtY29sb3I6dmFyKC0tcmVkKX0KLnJlcXVlc3Qtc3VnZ2VzdGlvbiBoM3ttYXJnaW4tdG9wOjB9Ci5yZXF1ZXN0LXN1Z2dlc3Rpb24gcHttYXJnaW46MTFweCAwIDIwcHh9Ci5yZXF1ZXN0LWNvbnZlcnNhdGlvbnttYXJnaW4tdG9wOjI2cHg7cGFkZGluZy10b3A6MTlweDtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1saW5lKX0KLnJlcXVlc3QtbWVzc2FnZXtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1saW5lKTtwYWRkaW5nOjE3cHggMH0KLnJlcXVlc3QtbWVzc2FnZSBzdHJvbmd7Y29sb3I6dmFyKC0taW5rKTtmb250LXNpemU6MTRweH0KLnJlcXVlc3QtbWVzc2FnZSBwe21hcmdpbi10b3A6OHB4fQoucHJvY2Vzc29yLXN0YXR1c3tiYWNrZ3JvdW5kOiNmOGZhZmZ9Ci5wcm9jZXNzb3Itc3RhdHVzIC5yb3ctYmV0d2Vlbj5zdHJvbmd7Y29sb3I6dmFyKC0tYmx1ZSk7Zm9udC1zaXplOjE0cHh9Ci5wcm9jZXNzb3Itc3RhdHVzIHB7bWFyZ2luLXRvcDo5cHh9Ci5ocSAucmVxdWVzdC1jYXJke3Njcm9sbC1tYXJnaW4tdG9wOjI0cHh9Ci5saWJyYXJ5LWRvY3VtZW50IGgye21hcmdpbjozMHB4IDAgMTNweH0KLmxpYnJhcnktZG9jdW1lbnQgcHttYXJnaW4tYm90dG9tOjE0cHg7b3ZlcmZsb3ctd3JhcDphbnl3aGVyZX0KLnJlcXVlc3QtdXBkYXRlZHtwb3NpdGlvbjpzdGlja3k7dG9wOjEycHg7ei1pbmRleDozO2JhY2tncm91bmQ6dmFyKC0tYmx1ZSk7Ym9yZGVyLWxlZnQ6NHB4IHNvbGlkIHZhcigtLXJlZCk7Y29sb3I6I2ZmZjtwYWRkaW5nOjE3cHggMjBweDtib3JkZXItcmFkaXVzOjlweDtib3gtc2hhZG93OjAgNXB4IDE4cHggIzEwMmI1MjIwfQoucmVxdWVzdC11cGRhdGVkIGF7Y29sb3I6I2ZmZjt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lfQoKLyogQ29tcGFjdCBzY3JlZW5zIHJldGFpbiBjYXB0aW9ucyBhbmQgZXZlcnkgZXNzZW50aWFsIGNvbnRyb2wuICovCkBtZWRpYShtaW4td2lkdGg6MTUwMHB4KXsuaGVybywubG9nby1oZXJve3BhZGRpbmctdG9wOjc1cHg7cGFkZGluZy1ib3R0b206NjVweH19CkBtZWRpYShtYXgtd2lkdGg6MTEyMHB4KXsKIC53cmFwe3BhZGRpbmctbGVmdDozMHB4O3BhZGRpbmctcmlnaHQ6MzBweH0uaGVhZGVye2dhcDoyMnB4fW5hdntnYXA6MTdweDtmb250LXNpemU6MTJweH0KIC5uYXYtd29ya3NwYWNle3BhZGRpbmc6MTFweCAxM3B4fS5zZWFyY2gtcGFuZWx7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnJ9LmNhcmQtZ3JpZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsbWlubWF4KDAsMWZyKSl9CiAuaGVyb3tnYXA6MzVweH0uaGVyby1ub3RlLC5sb2dvLWhlcm8tbm90ZXttaW4td2lkdGg6MjA1cHg7bWF4LXdpZHRoOjI1MHB4O3BhZGRpbmctbGVmdDoyNHB4fQogLmhlcm8gLmhlcm8tbm90ZSBwLC5oZXJvIC5sb2dvLWhlcm8tbm90ZSBwe2ZvbnQtc2l6ZToyMXB4fS5sb2dvLWdyaWR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLG1pbm1heCgwLDFmcikpfQogLmxvZ28tZGlyZWN0b3J5LXRvb2xze2FsaWduLWl0ZW1zOmZsZXgtc3RhcnR9LmxvZ28tanVtcC1saW5rc3tnYXA6N3B4fQogLmRpcmVjdG9yeS1mb290bm90ZXtmbGV4LXdyYXA6d3JhcDtnYXA6MTVweH0uZGlyZWN0b3J5LWZvb3Rub3RlPmF7bWFyZ2luLWxlZnQ6MH0KIC5ocS1sYXlvdXR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjIwMHB4IG1pbm1heCgwLDFmcil9LmhxLW1haW57cGFkZGluZzozOHB4IDI4cHh9LmhxLXN0YXRze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKX0KIC5ocS1tYWluIC50d28tdXB7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn0uaHEtaGVhZGVye2dhcDoxOHB4fQp9CkBtZWRpYShtYXgtd2lkdGg6NzYwcHgpewogLmJyYW5kIC5wcm9qZWN0LWxvZ297d2lkdGg6OTBweDtoZWlnaHQ6OTBweDttYXJnaW46MH0uaHEtYnJhbmQgLnByb2plY3QtbG9nb3t3aWR0aDo2NHB4O2hlaWdodDo2NHB4fQogLndyYXB7cGFkZGluZy1sZWZ0OjIycHg7cGFkZGluZy1yaWdodDoyMnB4fS50b3BsaW5lIC53cmFwe3BhZGRpbmctdG9wOjdweDtwYWRkaW5nLWJvdHRvbTo3cHg7ZmxleC13cmFwOndyYXA7Z2FwOjNweCAxNHB4O2ZvbnQtc2l6ZToxMHB4fQogLnRvcGxpbmUgYXtmb250LXNpemU6MTBweH0uaGVhZGVye21pbi1oZWlnaHQ6MTM2cHg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7anVzdGlmeS1jb250ZW50OmNlbnRlcjtnYXA6MjBweDtwYWRkaW5nLXRvcDoyMHB4O3BhZGRpbmctYm90dG9tOjIwcHh9CiAuYnJhbmR7Zm9udC1zaXplOjEycHh9LmJyYW5kIHN0cm9uZ3tmb250LXNpemU6MjJweH0uYnJhbmQtbWFya3toZWlnaHQ6NDVweDt3aWR0aDo0NXB4O2ZvbnQtc2l6ZToxNXB4fQogLmhlYWRlciBuYXZ7d2lkdGg6MTAwJTtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1zdGFydDtnYXA6MTJweCAyMHB4O2ZsZXgtd3JhcDp3cmFwO2ZvbnQtc2l6ZToxMnB4fQogLm5hdi13b3Jrc3BhY2V7Ym9yZGVyOjA7YmFja2dyb3VuZDpub25lO3BhZGRpbmc6MH0uaGVhZGVyIG5hdiBhW2FyaWEtY3VycmVudF17dGV4dC11bmRlcmxpbmUtb2Zmc2V0OjZweH0KIC5oZXJvLC5sb2dvLWhlcm97cGFkZGluZy10b3A6NDJweDtwYWRkaW5nLWJvdHRvbTozN3B4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Z2FwOjI0cHh9CiBoMSwubG9nby1oZXJvIGgxe2ZvbnQtc2l6ZTpjbGFtcCgzOHB4LDd2dyw1NHB4KX0uaGVyby1ub3RlLC5sb2dvLWhlcm8tbm90ZXtkaXNwbGF5Om5vbmV9CiAuaGVybz5kaXY+cHtmb250LXNpemU6MTVweDttYXJnaW4tdG9wOjIwcHh9Lm92ZXJsaW5lLC5sb2dvLWhlcm8gLm92ZXJsaW5le2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6LjA5ZW07bWFyZ2luLWJvdHRvbToxOXB4fQogLnNlYXJjaC1wYW5lbHtwYWRkaW5nOjIwcHg7Z2FwOjE2cHh9LnF1ZXJ5LWZpZWxkLC5zZWFyY2gtcGFuZWw+LmJ1dHRvbntncmlkLWNvbHVtbjoxLy0xfQogLnNlYXJjaC1wYW5lbCBsYWJlbHtmb250LXNpemU6MTFweH0ucXVpY2stbGlua3N7Z2FwOjdweDttYXJnaW4tYm90dG9tOjI4cHg7Zm9udC1zaXplOjExcHh9CiAuc2VjdGlvbi1oZWFkaW5ne2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxMHB4fS5zZWN0aW9uLWhlYWRpbmcgaDJ7Zm9udC1zaXplOjI4cHh9CiAuY2FyZC1ncmlkLC5wcm9maWxlLWdyaWQsLnR3by11cHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfS5vcmctY2FyZHtwYWRkaW5nOjI0cHh9Lm9yZy1jYXJkIGgze21pbi1oZWlnaHQ6MH0KIC5kaXJlY3RvcnktZm9vdG5vdGV7cGFkZGluZzoyNXB4IDAgMzNweH0ucGFydG5lci1pbm5lcntncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyO2dhcDoyNnB4fS5wYXJ0bmVyLXN0cmlwe3BhZGRpbmc6MzVweCAwfS5wYXJ0bmVyLXN0cmlwIGgye2ZvbnQtc2l6ZTozMHB4fQogLmZvb3Rlci1pbm5lcntmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjIxcHh9LmZvb3Rlci1saW5rc3tmbGV4LXdyYXA6d3JhcDtnYXA6MTVweH0uZmluZXByaW50e2ZvbnQtc2l6ZToxMHB4fQogLnByb2ZpbGUtaGVhZGluZyBoMXtmb250LXNpemU6MzZweH0ucHJvZmlsZS1oZWFkaW5ne3BhZGRpbmctYm90dG9tOjI1cHg7bWFyZ2luLWJvdHRvbToyOHB4fS5wcm9maWxlLWhlYWRpbmc+cHtmb250LXNpemU6MTVweH0KIC5wcm9maWxlLWFjdGlvbnN7Z2FwOjEwcHh9LnBhbmVse3BhZGRpbmc6MjRweDtib3JkZXItcmFkaXVzOjExcHh9LnBhbmVsIGgye2ZvbnQtc2l6ZToyNHB4fS5wYW5lbCBwe2ZvbnQtc2l6ZToxNHB4fQogLndvcmtzcGFjZS1wYWdlLC5hYm91dC1wYWdle3BhZGRpbmctdG9wOjM4cHg7cGFkZGluZy1ib3R0b206NDBweH0ud29ya3NwYWNlLXBhZ2UgaDEsLmFib3V0LXBhZ2UgaDF7Zm9udC1zaXplOjM5cHh9CiAud29ya3NwYWNlLWdyaWR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcjtnYXA6MH0ud29ya3NwYWNlLW1lbnV7cGFkZGluZzoyMHB4fS5pbnRyb3tmb250LXNpemU6MTZweH0KIC5wcmV2aWV3LWJhbm5lcntmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6ZmxleC1zdGFydDtnYXA6OXB4O3BhZGRpbmc6MThweCAyMHB4fS5wcmV2aWV3LWJhbm5lciBzdHJvbmd7d2hpdGUtc3BhY2U6bm9ybWFsfQogLmlubGluZS1mb3Jte2FsaWduLWl0ZW1zOnN0cmV0Y2g7ZmxleC1kaXJlY3Rpb246Y29sdW1ufS5pbmxpbmUtZm9ybT4qe21heC13aWR0aDoxMDAlfS5pbmxpbmUtZm9ybT5zZWxlY3R7ZmxleDpub25lfQogLnRocmVlLXVwLC5yZXNvdXJjZS1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjE2cHg7bWFyZ2luOjMwcHggMH0uYWxsLXNvdXJjZXN7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn0KIC5yZXNvdXJjZXMtcGFnZXtwYWRkaW5nLXRvcDozOHB4O3BhZGRpbmctYm90dG9tOjQ1cHh9LnJlc291cmNlLWhlcm8gaDF7Zm9udC1zaXplOjQycHh9LnJlc291cmNlLXVyZ2VudHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfS5yZXNvdXJjZS1zZWN0aW9ue3BhZGRpbmc6MjNweH0KIC5wcmV2aWV3LWhlYWRpbmd7YWxpZ24taXRlbXM6ZmxleC1zdGFydDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47bWFyZ2luLWJvdHRvbToyMHB4fS5lbXB0eS1zdGF0ZXtwYWRkaW5nOjQ1cHggMjJweH0uZW1wdHktc3RhdGUgaDF7Zm9udC1zaXplOjM0cHh9CiAucm93LWJldHdlZW57YWxpZ24taXRlbXM6ZmxleC1zdGFydH0uZXZlbnQtY2FyZCBoMntmb250LXNpemU6MjVweH0uZXZlbnQtY2FyZCAucm93LWJldHdlZW57YWxpZ24taXRlbXM6Y2VudGVyfQogLmxvZ28tZGlyZWN0b3J5LXRvb2xze2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTNweDtwYWRkaW5nOjIwcHggMH0ubG9nby1qdW1wLWxpbmtze2dhcDo3cHg7Zm9udC1zaXplOjExcHh9LmxvZ28tanVtcC1saW5rcyBhe3BhZGRpbmc6OHB4IDEwcHh9CiAubG9nby1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKTtnYXA6MTNweH0ubG9nby1jYXRlZ29yeXttYXJnaW4tdG9wOjM0cHh9CiAubG9nby1jYXRlZ29yeS1oZWFkaW5ne3BhZGRpbmctYm90dG9tOjE1cHg7bWFyZ2luLWJvdHRvbToyM3B4fS5sb2dvLWNhdGVnb3J5LWhlYWRpbmcgaDJ7Zm9udC1zaXplOjI3cHh9LmxvZ28tY2F0ZWdvcnktaGVhZGluZz5zcGFue2hlaWdodDozMHB4O3dpZHRoOjMwcHg7Zm9udC1zaXplOjIxcHh9CiAubG9nby10eXBlLWdyb3Vwe21hcmdpbi1ib3R0b206MjlweH0ubG9nby10eXBlLWhlYWRpbmcgaDN7Zm9udC1zaXplOjEzcHh9LmxvZ28tdHlwZS1oZWFkaW5nPnNwYW57Zm9udC1zaXplOjEwcHh9CiAubG9nby10aWxle21pbi1oZWlnaHQ6MjA0cHg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1zdGFydDtib3JkZXItcmFkaXVzOjEwcHh9CiAubG9nby1hcnR7bWluLWhlaWdodDoxMzZweDtwYWRkaW5nOjI0cHggMTlweH0ubG9nby1hcnQgaW1ne2hlaWdodDo4OHB4fQogLmxvZ28tcmV2ZWFse3Bvc2l0aW9uOnN0YXRpYztvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmU7d2lkdGg6MTAwJTtwYWRkaW5nOjEycHggMTRweDtmbGV4OjE7YmFja2dyb3VuZDojZWVmM2ZhO2JvcmRlci10b3A6MXB4IHNvbGlkICNkNmUwZWQ7Y29sb3I6dmFyKC0taW5rKTtmb250LXNpemU6MTFweH0KIC5sb2dvLXJldmVhbCBzdHJvbmd7Zm9udC1zaXplOjEycHh9LmxvZ28tcmV2ZWFsPnNwYW46bm90KC5sb2dvLW9wZW4pe2NvbG9yOiM0YzYxN2J9LmxvZ28tcmV2ZWFsIHNtYWxse2NvbG9yOiM5YjI0MzR9CiAubG9nby1vcGVue2Rpc3BsYXk6bm9uZX0ubG9nby10aWxlOmhvdmVyIC5sb2dvLWFydCwubG9nby10aWxlOmZvY3VzLXZpc2libGUgLmxvZ28tYXJ0e3RyYW5zZm9ybTpub25lfQogLmxvZ28td29yZG1hcmt7Zm9udC1zaXplOjIxcHh9LmxvZ28td29yZG1hcms+c3Bhbntmb250LXNpemU6OXB4O2xldHRlci1zcGFjaW5nOi4wOGVtfS5sb2dvLXNlYXJjaCBzdW1tYXJ5e2ZvbnQtc2l6ZToxM3B4O3BhZGRpbmc6MTdweCAxOXB4fQogLnZldHMtd29yZG1hcmsgc3Ryb25ne2ZvbnQtc2l6ZTo0M3B4fS52ZXRzLXdvcmRtYXJrPnNwYW57Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6MDttYXgtd2lkdGg6MTMwcHh9CiAubG9nby10aWxlLS12ZncgLmxvZ28tYXJ0IGltZ3t3aWR0aDoyNDVweDtoZWlnaHQ6OThweH0ubG9nby1kaXJlY3Rvcnk+LmRpcmVjdG9yeS1mb290bm90ZXttYXJnaW4tdG9wOjM1cHh9CiAuaHEtbGF5b3V0e2Rpc3BsYXk6YmxvY2t9LmhxLWhlYWRlcntwYWRkaW5nOjIwcHggMjJweDtnYXA6MTNweCAyMHB4fS5ocS1oZWFkZXIgLmhxLWJyYW5ke2ZvbnQtc2l6ZToyMnB4fQogLmhxLXByaXZhdGV7d2lkdGg6MTAwJTtvcmRlcjoyO292ZXJmbG93LXdyYXA6YW55d2hlcmV9LmhxLWJyYW5kIHNwYW57bWFyZ2luLWxlZnQ6OHB4fQogLmhxLW5hdntmbGV4LWRpcmVjdGlvbjpyb3c7b3ZlcmZsb3cteDphdXRvO3BhZGRpbmc6MTJweCAxNXB4O2JvcmRlci1yaWdodDowO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpO2dhcDo3cHh9CiAuaHEtbmF2IGF7d2hpdGUtc3BhY2U6bm93cmFwO3BhZGRpbmc6MTBweCAxMnB4O2ZvbnQtc2l6ZToxMnB4fS5ocS1uYXYgcHtkaXNwbGF5Om5vbmV9CiAuaHEtbWFpbntwYWRkaW5nOjMwcHggMjBweH0uaHEtdGl0bGUgaDF7Zm9udC1zaXplOjM3cHg7bWFyZ2luLWJvdHRvbToyNXB4fS5ocSAucGFuZWx7cGFkZGluZzoyM3B4fS5ocSBoMntmb250LXNpemU6MjVweH0KIC5ocS1zdGF0c3tnYXA6MTJweH0uaHEtc3RhdHMgYXtwYWRkaW5nOjIwcHh9LmhxLXN0YXRzIHN0cm9uZ3tmb250LXNpemU6MzRweH0KIC5yZXF1ZXN0LWNvbXBvc2UgdGV4dGFyZWF7Zm9udC1zaXplOjE2cHh9LnJlcXVlc3QtY29tcG9zZSAucm93LWJldHdlZW57YWxpZ24taXRlbXM6ZmxleC1zdGFydDtmbGV4LXdyYXA6d3JhcDtnYXA6MTFweH0KIC5yZXF1ZXN0LWZpbHRlcnN7Z2FwOjdweDttYXJnaW46MjNweCAwfS5yZXF1ZXN0LWZpbHRlcnMgYXtmb250LXNpemU6MTJweDtwYWRkaW5nOjlweCAxMnB4fQogLnJlcXVlc3QtcmVzdWx0LC5yZXF1ZXN0LXN1Z2dlc3Rpb257cGFkZGluZzoxOHB4fS5wcm9jZXNzb3Itc3RhdHVzIC5yb3ctYmV0d2VlbntmbGV4LXdyYXA6d3JhcDtnYXA6N3B4fQp9CkBtZWRpYShtYXgtd2lkdGg6NDIwcHgpewogLndyYXB7cGFkZGluZy1sZWZ0OjE4cHg7cGFkZGluZy1yaWdodDoxOHB4fS5oZWFkZXIgbmF2e2dhcDoxMnB4IDE2cHg7Zm9udC1zaXplOjExcHh9CiAuc2VhcmNoLXBhbmVse2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9LnNlYXJjaC1wYW5lbCAuZmllbGQsLnNlYXJjaC1wYW5lbD4uYnV0dG9ue2dyaWQtY29sdW1uOmF1dG99CiAubG9nby1ncmlke2dhcDoxMHB4fS5sb2dvLWFydHtwYWRkaW5nOjIwcHggMTRweDttaW4taGVpZ2h0OjEyNHB4fS5sb2dvLWFydCBpbWd7aGVpZ2h0OjgycHh9LmxvZ28tdGlsZXttaW4taGVpZ2h0OjE5N3B4fQogLmxvZ28tcmV2ZWFse3BhZGRpbmc6MTJweCAxMXB4fS5sb2dvLXJldmVhbCBzdHJvbmd7Zm9udC1zaXplOjExcHh9LmxvZ28tY2F0ZWdvcnktaGVhZGluZyBoMntmb250LXNpemU6MjVweH0KIC5wcm9maWxlLWFjdGlvbnN7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOnN0cmV0Y2h9LmJ1dHRvbnt3aGl0ZS1zcGFjZTpub3JtYWx9CiAuaHEtbWFpbntwYWRkaW5nOjI2cHggMTZweH0uaHEgLnBhbmVse3BhZGRpbmc6MjBweH0uaHEtc3RhdHMgYXtwYWRkaW5nOjE3cHh9LmhxLWhlYWRlcntwYWRkaW5nOjE5cHggMThweH0KIC5yb3ctYmV0d2VlbntmbGV4LXdyYXA6d3JhcH0ucmVxdWVzdC1jb21wb3NlIGgye2ZvbnQtc2l6ZToyNHB4fS5yZXF1ZXN0LWZpbHRlcnMgYXtmb250LXNpemU6MTFweH0KfQpAbWVkaWEoaG92ZXI6bm9uZSl7CiAuaG92ZXItaW5zdHJ1Y3Rpb257ZGlzcGxheTpub25lIWltcG9ydGFudH0udG91Y2gtaW5zdHJ1Y3Rpb257ZGlzcGxheTpibG9jayFpbXBvcnRhbnR9Cn0KQG1lZGlhKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246cmVkdWNlKXsKIGh0bWx7c2Nyb2xsLWJlaGF2aW9yOmF1dG99CiAubG9nby1hcnQsLmxvZ28tcmV2ZWFsLC5sb2dvLXRpbGUsLmJ1dHRvbnt0cmFuc2l0aW9uOm5vbmV9Cn0KLm9yZ2FuaXphdGlvbi1waG90b3N7bWFyZ2luLWJvdHRvbToyOHB4O3Njcm9sbC1tYXJnaW4tdG9wOjI0cHh9Ci5waG90by1oZWFkaW5ne2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjIycHg7bWFyZ2luLWJvdHRvbToyMnB4fS5waG90by1oZWFkaW5nIGgye21hcmdpbjo2cHggMCAwfQoucGhvdG8tZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgobWluKDEwMCUsMjYwcHgpLDFmcikpO2dhcDoyMnB4O2FsaWduLWl0ZW1zOnN0YXJ0fQoucGhvdG8tY2FyZHttaW4td2lkdGg6MDttYXJnaW46MDtvdmVyZmxvdzpoaWRkZW47Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjEycHg7YmFja2dyb3VuZDojZmZmfQoucGhvdG8tb3BlbntkaXNwbGF5OmJsb2NrO2JhY2tncm91bmQ6I2VlZjJmNn0ucGhvdG8tY2FyZCBpbWd7ZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO2hlaWdodDozMDBweDtvYmplY3QtZml0OmNvbnRhaW59LnBob3RvLWNhcmQ6b25seS1jaGlsZCBpbWd7aGVpZ2h0Om1pbig0NDBweCw1OHZ3KX0KLnBob3RvLWNhcmQgZmlnY2FwdGlvbntwYWRkaW5nOjE3cHggMTlweH0ucGhvdG8tY2FyZCBmaWdjYXB0aW9uIHB7bWFyZ2luOjAgMCA4cHg7Zm9udC1zaXplOjE1cHg7bGluZS1oZWlnaHQ6MS41fQoucGhvdG8tY3JlZGl0e2Rpc3BsYXk6YmxvY2s7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O2xpbmUtaGVpZ2h0OjEuNjtvdmVyZmxvdy13cmFwOmFueXdoZXJlfS5waG90by1saWNlbnNle2Rpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjExcHg7bWFyZ2luLXRvcDozcHh9Ci5waG90by1lbXB0eXtwYWRkaW5nOjI4cHg7YmFja2dyb3VuZDojZjNmNmZhO2JvcmRlcjoxcHggZGFzaGVkICNiOGM2ZDk7Ym9yZGVyLXJhZGl1czoxMHB4fS5waG90by1lbXB0eSBwe21hcmdpbjowfQoucGhvdG8tZWRpdG9yLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KG1pbigxMDAlLDMwMHB4KSwxZnIpKTtnYXA6MjBweH0ucGhvdG8tZWRpdG9yLWdyaWQgaW1ne3dpZHRoOjEwMCU7aGVpZ2h0OjIyMHB4O29iamVjdC1maXQ6Y29udGFpbjtiYWNrZ3JvdW5kOiNlZWYyZjZ9LnBob3RvLWVkaXRvci1ncmlkIC5waG90by1jYXJke3BhZGRpbmc6MThweH0KLmhxIC5waG90by1jYXJkPnAsLmhxIC5waG90by1jYXJkPmRldGFpbHN7bWFyZ2luOjE4cHh9LmhxIC5waG90by1jYXJkPmRldGFpbHMgc3VtbWFyeXtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDB9LmhxIC5waG90by1jYXJkPi5lZGl0LWZvcm17cGFkZGluZzoxOHB4fQpAbWVkaWEobWF4LXdpZHRoOjYyMHB4KXsucGhvdG8taGVhZGluZ3thbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTVweH0ucGhvdG8tY2FyZCBpbWcsLnBob3RvLWNhcmQ6b25seS1jaGlsZCBpbWd7aGVpZ2h0OjI0MHB4fS5waG90by1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9LnBob3RvLWNhcmQgZmlnY2FwdGlvbntwYWRkaW5nOjE1cHh9LnBob3RvLWhlYWRpbmcgLmJ1dHRvbntmb250LXNpemU6MTNweH19Ci5vcmdhbml6YXRpb24tb2ZmaWNlcnN7bWFyZ2luLWJvdHRvbToyOHB4O3Njcm9sbC1tYXJnaW4tdG9wOjI0cHh9Ci5vcmdhbml6YXRpb24tb2ZmaWNlcnM+c3VtbWFyeXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoyMHB4O2xpc3Qtc3R5bGU6bm9uZX0ub3JnYW5pemF0aW9uLW9mZmljZXJzPnN1bW1hcnk6Oi13ZWJraXQtZGV0YWlscy1tYXJrZXJ7ZGlzcGxheTpub25lfS5vcmdhbml6YXRpb24tb2ZmaWNlcnM+c3VtbWFyeSBzdHJvbmd7ZGlzcGxheTpibG9jazttYXJnaW4tdG9wOjVweDtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXNpemU6MzJweDtsaW5lLWhlaWdodDoxfS5vZmZpY2VyLWNvdW50e2NvbG9yOnZhcigtLW5hdnkpO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzouMDhlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2V9Ci5vZmZpY2VyLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoYXV0by1maXQsbWlubWF4KG1pbigxMDAlLDMwMHB4KSwxZnIpKTtnYXA6MjBweDttYXJnaW46MjJweCAwfQoub2ZmaWNlci1jYXJke21pbi13aWR0aDowO292ZXJmbG93OmhpZGRlbjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTJweDtiYWNrZ3JvdW5kOiNmZmZ9Lm9mZmljZXItY2FyZD5pbWcsLm9mZmljZXItcGxhY2Vob2xkZXJ7ZGlzcGxheTpmbGV4O3dpZHRoOjEwMCU7aGVpZ2h0OjI1MHB4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2JhY2tncm91bmQ6I2U4ZWVmNTtjb2xvcjp2YXIoLS1uYXZ5KTtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXNpemU6NzZweDtmb250LXdlaWdodDo4MDA7b2JqZWN0LWZpdDpjb3Zlcn0ub2ZmaWNlci1jYXJkPmRpdjpub3QoLm9mZmljZXItcGxhY2Vob2xkZXIpe3BhZGRpbmc6MjBweH0ub2ZmaWNlci1jYXJkIGgze21hcmdpbjo3cHggMCAxMHB4O2ZvbnQtc2l6ZToyNXB4fS5vZmZpY2VyLWNhcmQgcHttYXJnaW46MDtsaW5lLWhlaWdodDoxLjY1fQoub2ZmaWNlci1lbXB0eXttYXJnaW46MjBweCAwO3BhZGRpbmc6MjVweDtiYWNrZ3JvdW5kOiNmM2Y2ZmE7Ym9yZGVyOjFweCBkYXNoZWQgI2I4YzZkOTtib3JkZXItcmFkaXVzOjEwcHh9Lm9mZmljZXItZW1wdHkgcHttYXJnaW46MH0KLmhxIC5vcmdhbml6YXRpb24tb2ZmaWNlcnM+Lm9mZmljZXItZ3JpZD4ub2ZmaWNlci1jYXJkPmRldGFpbHN7bWFyZ2luOjAgMjBweCAxOHB4fS5ocSAub3JnYW5pemF0aW9uLW9mZmljZXJzPi5vZmZpY2VyLWdyaWQ+Lm9mZmljZXItY2FyZD5kZXRhaWxzIHN1bW1hcnl7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NzAwfS5ocSAub3JnYW5pemF0aW9uLW9mZmljZXJzPi5vZmZpY2VyLWdyaWQ+Lm9mZmljZXItY2FyZCAuZWRpdC1mb3Jte21hcmdpbi10b3A6MTRweH0uaHEgLm9yZ2FuaXphdGlvbi1vZmZpY2Vycz5kZXRhaWxzLnBhbmVse21hcmdpbi10b3A6MjBweH0KQG1lZGlhKG1heC13aWR0aDo2MjBweCl7Lm9yZ2FuaXphdGlvbi1vZmZpY2Vycz5zdW1tYXJ5IHN0cm9uZ3tmb250LXNpemU6MjdweH0ub2ZmaWNlci1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9Lm9mZmljZXItY2FyZD5pbWcsLm9mZmljZXItcGxhY2Vob2xkZXJ7aGVpZ2h0OjIyMHB4fX0KQG1lZGlhIHByaW50ewogLnRvcGxpbmUsLmhlYWRlcixmb290ZXIsLnByb2ZpbGUtYWN0aW9ucywuc2VhcmNoLXBhbmVsLC5xdWljay1saW5rcywubG9nby1zZWFyY2gsLmxvZ28tanVtcC1saW5rcywuaHEtbmF2LC5ocS1oZWFkZXJ7ZGlzcGxheTpub25lfQogYm9keSwuaHF7YmFja2dyb3VuZDojZmZmO2NvbG9yOiMwMDB9LndyYXB7bWF4LXdpZHRoOjEwMCU7cGFkZGluZzowfS5wcm9maWxlLWdyaWQsLmhxLWxheW91dHtkaXNwbGF5OmJsb2NrfS5ocS1tYWlue3BhZGRpbmc6MH0KIC5wYW5lbCwub3JnLWNhcmR7YnJlYWstaW5zaWRlOmF2b2lkO2JvcmRlcjoxcHggc29saWQgI2JiYjtib3gtc2hhZG93Om5vbmV9Lmhlcm97cGFkZGluZzoyMHB4IDB9Lmhlcm8tbm90ZSwubG9nby1oZXJvLW5vdGUsLnBhcnRuZXItc3RyaXB7ZGlzcGxheTpub25lfQogLmNhcmQtZ3JpZCwubG9nby1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKTtnYXA6MTVweH0KIC5sb2dvLXJldmVhbHtwb3NpdGlvbjpzdGF0aWM7b3BhY2l0eToxO3RyYW5zZm9ybTpub25lO2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojMDAwO2JvcmRlci1jb2xvcjojYmJifQogLmxvZ28tdGlsZXtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2JyZWFrLWluc2lkZTphdm9pZDtib3gtc2hhZG93Om5vbmV9LmxvZ28tcmV2ZWFsPnNwYW46bm90KC5sb2dvLW9wZW4pLC5sb2dvLXJldmVhbCBzbWFsbHtjb2xvcjojMDAwfQogYXtjb2xvcjojMDAwfS5yZXF1ZXN0LXVwZGF0ZWR7cG9zaXRpb246c3RhdGljO2JhY2tncm91bmQ6I2ZmZjtjb2xvcjojMDAwfQp9Ci5waG90by1hbGJ1bXttYXJnaW4tdG9wOjJyZW19LnBob3RvLWFsYnVtPmgze21hcmdpbi1ib3R0b206LjM1cmVtfS5waG90by1hbGJ1bS1kZXNjcmlwdGlvbnttYXgtd2lkdGg6NDhyZW07bWFyZ2luLXRvcDowO2NvbG9yOnZhcigtLW11dGVkKX0ucGhvdG8tcHJlc2VudHtmb250LXNpemU6LjlyZW07bGluZS1oZWlnaHQ6MS41fS5waG90by1wcmVzZW50IHN0cm9uZ3tjb2xvcjp2YXIoLS1pbmspfS5waG90by1hZGQtb3Jne2Rpc3BsYXk6aW5saW5lLWJsb2NrO21hcmdpbi1sZWZ0Oi41cmVtO2ZvbnQtd2VpZ2h0OjcwMH0ucGhvdG8tYWxidW0tbWFuYWdlcnttYXJnaW46MS41cmVtIDAgMnJlbTtwYWRkaW5nOjFyZW07Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOnZhcigtLXJhZGl1cyk7YmFja2dyb3VuZDp2YXIoLS1wYXBlcil9LmFsYnVtLW1hbmFnZXItZ3JpZHtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdChhdXRvLWZpdCxtaW5tYXgoMjQwcHgsMWZyKSk7Z2FwOjFyZW07bWFyZ2luLXRvcDoxcmVtfS5hbGJ1bS1tYW5hZ2VyLWdyaWQgLnBhbmVse21hcmdpbjowfS5vcmdhbml6YXRpb24tY2hlY2tib3hlc3tkaXNwbGF5OmdyaWQ7Z2FwOi4zNXJlbTttYXgtaGVpZ2h0OjIycmVtO292ZXJmbG93OmF1dG87cGFkZGluZzoxcmVtO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czouNXJlbX0ub3JnYW5pemF0aW9uLWNoZWNrYm94ZXMgbGVnZW5ke2ZvbnQtd2VpZ2h0OjcwMH0ucGhvdG8tcHJlc2VuY2UtcmVxdWVzdHN7bWFyZ2luOjFyZW0gMDtwYWRkaW5nOjFyZW07YmFja2dyb3VuZDp2YXIoLS1jcmVhbSk7Ym9yZGVyLXJhZGl1czouNXJlbX0ucGhvdG8tcHJlc2VuY2UtcmVxdWVzdHMgLnJvdy1iZXR3ZWVue2dhcDouNXJlbTtwYWRkaW5nOi41cmVtIDA7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSl9LnBob3RvLXByZXNlbmNlLXJlcXVlc3RzIC5pbmxpbmUtZm9ybXtkaXNwbGF5OmlubGluZS1ibG9jazttYXJnaW4tbGVmdDouMzVyZW19LnByZXNlbmNlLXBob3RvLXByZXZpZXd7ZGlzcGxheTpibG9jazt3aWR0aDptaW4oMTAwJSw0MnJlbSk7bWF4LWhlaWdodDozMnJlbTtvYmplY3QtZml0OmNvbnRhaW47bWFyZ2luOjFyZW0gMDtib3JkZXItcmFkaXVzOi43NXJlbX0KLm1vbnRoLWNhbGVuZGFye292ZXJmbG93LXg6YXV0bzttYXJnaW46MnJlbSAwfS5jYWxlbmRhci1oZWFkaW5ne2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LWVuZDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MXJlbTttYXJnaW4tYm90dG9tOjFyZW19LmNhbGVuZGFyLWhlYWRpbmcgbmF2e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjFyZW19LmNhbGVuZGFyLXdlZWtkYXlzLC5jYWxlbmRhci1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDcsbWlubWF4KDEwMHB4LDFmcikpO21pbi13aWR0aDo3MjBweH0uY2FsZW5kYXItd2Vla2RheXMgc3Bhbnt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOi40NXJlbTtmb250LXNpemU6Ljc1cmVtO2ZvbnQtd2VpZ2h0OjgwMDtsZXR0ZXItc3BhY2luZzouMDhlbTtjb2xvcjp2YXIoLS1tdXRlZCl9LmNhbGVuZGFyLWRheXtwb3NpdGlvbjpyZWxhdGl2ZTttaW4taGVpZ2h0OjhyZW07cGFkZGluZzouNXJlbTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JhY2tncm91bmQ6I2ZmZn0uY2FsZW5kYXItZGF5IHRpbWV7cG9zaXRpb246cmVsYXRpdmU7ei1pbmRleDoyO2ZvbnQtd2VpZ2h0OjgwMH0uY2FsZW5kYXItZGF5LWVtcHR5e2JhY2tncm91bmQ6dmFyKC0tY3JlYW0pfS5jYWxlbmRhci1pdGVtc3twb3NpdGlvbjpyZWxhdGl2ZTt6LWluZGV4OjI7ZGlzcGxheTpncmlkO2dhcDouM3JlbTttYXJnaW4tdG9wOi41cmVtfS5jYWxlbmRhci1pdGVte2Rpc3BsYXk6YmxvY2s7cGFkZGluZzouM3JlbSAuNHJlbTtib3JkZXItcmFkaXVzOi4zNXJlbTtmb250LXNpemU6Ljc2cmVtO2xpbmUtaGVpZ2h0OjEuMjV9LmNhbGVuZGFyLWV2ZW50e2JhY2tncm91bmQ6I2U5ZjFmYjtjb2xvcjp2YXIoLS1ibHVlKTtmb250LXdlaWdodDo3NTB9LmNhbGVuZGFyLWhvbGlkYXl7YmFja2dyb3VuZDojZjNlZWUxO2NvbG9yOiM2YTUyMjJ9LmNhbGVuZGFyLXNlcnZpY2V7YmFja2dyb3VuZDpyZ2JhKDgsMjUsNDgsLjgpO2NvbG9yOiNmZmY7Zm9udC13ZWlnaHQ6ODAwfS5jYWxlbmRhci1iaXJ0aGRheXtvdmVyZmxvdzpoaWRkZW47Y29sb3I6I2ZmZjtiYWNrZ3JvdW5kOiMyMzNiNWR9LmNhbGVuZGFyLWJpcnRoZGF5OjpiZWZvcmV7Y29udGVudDphdHRyKGRhdGEtYnJhbmNoKTtwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDo1MCUgYXV0byBhdXRvIDUwJTt3aWR0aDo1LjJyZW07aGVpZ2h0OjUuMnJlbTtkaXNwbGF5OmdyaWQ7cGxhY2UtaXRlbXM6Y2VudGVyO3RyYW5zZm9ybTp0cmFuc2xhdGUoLTUwJSwtNTAlKSByb3RhdGUoLTlkZWcpO2JvcmRlcjozcHggZG91YmxlIHJnYmEoMjU1LDI1NSwyNTUsLjc1KTtib3JkZXItcmFkaXVzOjUwJTtmb250LXNpemU6LjYzcmVtO2ZvbnQtd2VpZ2h0OjkwMDtsZXR0ZXItc3BhY2luZzouMDhlbTt0ZXh0LWFsaWduOmNlbnRlcjtvcGFjaXR5Oi4yNn0uYmlydGhkYXktYXJteXtiYWNrZ3JvdW5kOiMyZjQ0Mjl9LmJpcnRoZGF5LWNvYXN0LWd1YXJke2JhY2tncm91bmQ6IzE3M2E2Mn0uYmlydGhkYXktYWlyLWZvcmNle2JhY2tncm91bmQ6IzFkNGU4OX0uYmlydGhkYXktbmF2eXtiYWNrZ3JvdW5kOiMxNDJjNGF9LmJpcnRoZGF5LW1hcmluZS1jb3Jwc3tiYWNrZ3JvdW5kOiM2YzFmMjR9LmJpcnRoZGF5LXNwYWNlLWZvcmNle2JhY2tncm91bmQ6IzI0MmEzNX1AbWVkaWEobWF4LXdpZHRoOjcwMHB4KXsuY2FsZW5kYXItaGVhZGluZ3thbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbn0uY2FsZW5kYXItaGVhZGluZyBuYXZ7d2lkdGg6MTAwJTtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2Vlbn0uY2FsZW5kYXItZGF5e21pbi1oZWlnaHQ6N3JlbX19CgovKiBZb2xvLVNvbGFubyBpcyB0aGUgZmlyc3QgcmVnaW9uYWwgZXhwZXJpZW5jZSBpbiB0aGUgc2hhcmVkIE5vckNhbCBWZXRlcmFucyBwbGF0Zm9ybS4gKi8KLnJlZ2lvbmFsLWhvbWV7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6I2Y0ZjZmOX0ucmVnaW9uYWwtaGVyb3twb3NpdGlvbjpyZWxhdGl2ZTttaW4taGVpZ2h0Om1pbig3NjBweCw3OHZoKTtkaXNwbGF5OmdyaWQ7YWxpZ24taXRlbXM6ZW5kO2NvbG9yOiNmZmY7YmFja2dyb3VuZDojMDcxYTMzfS5yZWdpb25hbC1oZXJvLXBob3Rve3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtvYmplY3QtZml0OmNvdmVyO29iamVjdC1wb3NpdGlvbjpjZW50ZXIgNDYlO2ZpbHRlcjpzYXR1cmF0ZSguODIpIGNvbnRyYXN0KDEuMDMpfS5yZWdpb25hbC1oZXJvLXNoYWRle3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcscmdiYSg1LDIxLDQzLC45NikgMCUscmdiYSg4LDMxLDYxLC44MSkgNDMlLHJnYmEoOCwyNyw1MywuMzgpIDcyJSxyZ2JhKDgsMjUsNDgsLjU2KSAxMDAlKSxsaW5lYXItZ3JhZGllbnQoMGRlZyxyZ2JhKDUsMjAsNDIsLjgpLHRyYW5zcGFyZW50IDQ4JSl9LnJlZ2lvbmFsLWhlcm8tY29udGVudHtwb3NpdGlvbjpyZWxhdGl2ZTt6LWluZGV4OjE7d2lkdGg6MTAwJTtwYWRkaW5nLXRvcDo3MHB4O3BhZGRpbmctYm90dG9tOjg0cHh9Lm5vcmNhbC1sb2dve2Rpc3BsYXk6YmxvY2s7d2lkdGg6bWluKDM2MHB4LDU2dncpO21heC1oZWlnaHQ6OTZweDtvYmplY3QtZml0OmNvbnRhaW47b2JqZWN0LXBvc2l0aW9uOmxlZnQgY2VudGVyO21hcmdpbjowIDAgNDJweDtmaWx0ZXI6ZHJvcC1zaGFkb3coMCA0cHggMThweCByZ2JhKDAsMCwwLC4yNSkpfS5yZWdpb25hbC1oZXJvIC5leWVicm93e2NvbG9yOiNkNmU0Zjd9LnJlZ2lvbmFsLWhlcm8gaDF7bWF4LXdpZHRoOjg1MHB4O21hcmdpbi10b3A6MTRweDtjb2xvcjojZmZmO2ZvbnQtc2l6ZTpjbGFtcCg1NHB4LDd2dyw5NnB4KTtsZXR0ZXItc3BhY2luZzotLjA2ZW19LnJlZ2lvbmFsLWhlcm8gaDEgZW17Y29sb3I6I2ZmZn0ucmVnaW9uYWwtaGVyby1jb250ZW50PnB7bWF4LXdpZHRoOjcwMHB4O21hcmdpbi10b3A6MjZweDtjb2xvcjojZWNmMmZhO2ZvbnQtc2l6ZTpjbGFtcCgxN3B4LDJ2dywyMnB4KTtsaW5lLWhlaWdodDoxLjY1fS5yZWdpb25hbC1oZXJvLWFjdGlvbnN7ZGlzcGxheTpmbGV4O2dhcDoxM3B4O2ZsZXgtd3JhcDp3cmFwO21hcmdpbi10b3A6MzRweH0uYnV0dG9uLmhlcm8tb3V0bGluZXtib3JkZXItY29sb3I6cmdiYSgyNTUsMjU1LDI1NSwuNzIpO2JhY2tncm91bmQ6cmdiYSg2LDI1LDUwLC4yNSk7Y29sb3I6I2ZmZjtiYWNrZHJvcC1maWx0ZXI6Ymx1cig4cHgpfS5idXR0b24uaGVyby1vdXRsaW5lOmhvdmVye2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1ibHVlLWRhcmspO2JvcmRlci1jb2xvcjojZmZmfS5yZWdpb25hbC1xdWlja3twb3NpdGlvbjpyZWxhdGl2ZTt6LWluZGV4OjI7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNSwxZnIpO3BhZGRpbmctdG9wOjA7cGFkZGluZy1ib3R0b206MDttYXJnaW4tdG9wOi0yNnB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkICNkOWUwZTk7Ym9yZGVyLXJhZGl1czoxNXB4O2JveC1zaGFkb3c6MCAxOHB4IDUycHggcmdiYSgxNSw0MCw3NCwuMTQpfS5yZWdpb25hbC1xdWljayBhe2Rpc3BsYXk6Z3JpZDtnYXA6NXB4O3BhZGRpbmc6MjNweCAyMXB4O2NvbG9yOnZhcigtLWJvZHkpO2JvcmRlci1yaWdodDoxcHggc29saWQgdmFyKC0tbGluZSk7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC4ycyx0cmFuc2Zvcm0gLjJzfS5yZWdpb25hbC1xdWljayBhOmZpcnN0LWNoaWxke2JvcmRlci1yYWRpdXM6MTRweCAwIDAgMTRweH0ucmVnaW9uYWwtcXVpY2sgYTpsYXN0LWNoaWxke2JvcmRlcjowO2JvcmRlci1yYWRpdXM6MCAxNHB4IDE0cHggMH0ucmVnaW9uYWwtcXVpY2sgYTpob3ZlcntiYWNrZ3JvdW5kOiNlZWY0ZmI7dGV4dC1kZWNvcmF0aW9uOm5vbmU7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTNweCl9LnJlZ2lvbmFsLXF1aWNrIHN0cm9uZ3tjb2xvcjp2YXIoLS1pbmspO2ZvbnQtc2l6ZToxNHB4fS5yZWdpb25hbC1xdWljayBzcGFue2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTFweDtsaW5lLWhlaWdodDoxLjQ1fS5yZWdpb25hbC1zZWN0aW9ue3BhZGRpbmctdG9wOjEwMHB4O3BhZGRpbmctYm90dG9tOjEwMHB4fS5yZWdpb25hbC1oZWFkaW5ne2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczplbmQ7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjMwcHg7bWFyZ2luLWJvdHRvbTozNHB4fS5yZWdpb25hbC1oZWFkaW5nIGgye21heC13aWR0aDo3MjBweDttYXJnaW4tdG9wOjEwcHg7Zm9udC1zaXplOmNsYW1wKDM0cHgsNHZ3LDUycHgpO2xldHRlci1zcGFjaW5nOi0uMDVlbX0ucmVnaW9uYWwtaGVhZGluZz5he2ZvbnQtd2VpZ2h0Ojc1MDt3aGl0ZS1zcGFjZTpub3dyYXB9LnJlZ2lvbmFsLWV2ZW50LWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMyxtaW5tYXgoMCwxZnIpKTtnYXA6MjBweH0ucmVnaW9uYWwtZXZlbnQtY2FyZHtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO21pbi1oZWlnaHQ6MzAwcHg7cGFkZGluZzozMHB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci10b3A6NXB4IHNvbGlkIHZhcigtLXJlZCk7Ym9yZGVyLXJhZGl1czoxM3B4O2JveC1zaGFkb3c6MCA5cHggMzJweCByZ2JhKDE1LDQwLDc0LC4wOCk7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjIycyxib3gtc2hhZG93IC4yMnN9LnJlZ2lvbmFsLWV2ZW50LWNhcmQ6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTVweCk7Ym94LXNoYWRvdzowIDE3cHggNDJweCByZ2JhKDE1LDQwLDc0LC4xNCl9LnJlZ2lvbmFsLWV2ZW50LWNhcmQ+c3Bhbntjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjgwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjFlbX0ucmVnaW9uYWwtZXZlbnQtY2FyZCBoM3ttYXJnaW4tdG9wOjIycHg7Zm9udC1zaXplOjI1cHg7bGluZS1oZWlnaHQ6MS4yNX0ucmVnaW9uYWwtZXZlbnQtY2FyZCBwe21hcmdpbi10b3A6MTRweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHh9LnJlZ2lvbmFsLWV2ZW50LWNhcmQgYXttYXJnaW4tdG9wOmF1dG87cGFkZGluZy10b3A6MjRweDtmb250LXdlaWdodDo3NTB9LnJlZ2lvbmFsLWZlYXR1cmVke3BhZGRpbmc6OTZweCAwO2JhY2tncm91bmQ6I2U4ZWRmNDtib3JkZXItYmxvY2s6MXB4IHNvbGlkICNkNGRkZTl9LmZlYXR1cmVkLW9yZy1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsbWlubWF4KDAsMWZyKSk7Z2FwOjIwcHh9LmZlYXR1cmVkLW9yZy1jYXJke2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47bWluLWhlaWdodDozNjBweDtwYWRkaW5nOjI3cHg7YmFja2dyb3VuZDojZmZmO2NvbG9yOnZhcigtLWJvZHkpO2JvcmRlci1yYWRpdXM6MTRweDtib3JkZXI6MXB4IHNvbGlkICNkNGRjZTc7Ym94LXNoYWRvdzowIDVweCAyMXB4IHJnYmEoMTUsNDAsNzQsLjA3KTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMjJzLGJveC1zaGFkb3cgLjIyc30uZmVhdHVyZWQtb3JnLWNhcmQ6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTZweCk7Ym94LXNoYWRvdzowIDE4cHggNDJweCByZ2JhKDE1LDQwLDc0LC4xNCk7dGV4dC1kZWNvcmF0aW9uOm5vbmV9LmZlYXR1cmVkLW9yZy1sb2dve2Rpc3BsYXk6Z3JpZDtwbGFjZS1pdGVtczpjZW50ZXI7aGVpZ2h0OjEyNXB4O21hcmdpbjotNHB4IC0zcHggMjdweDtiYWNrZ3JvdW5kOiNmNWY3ZmE7Ym9yZGVyLXJhZGl1czo5cHh9LmZlYXR1cmVkLW9yZy1sb2dvIGltZ3ttYXgtd2lkdGg6ODglO21heC1oZWlnaHQ6MTA0cHg7b2JqZWN0LWZpdDpjb250YWlufS5mZWF0dXJlZC1vcmctbG9nbyBzdHJvbmd7Zm9udC1zaXplOjM4cHg7Y29sb3I6dmFyKC0tYmx1ZSl9LmZlYXR1cmVkLW9yZy1jYXJkIGgze21hcmdpbjo5cHggMCAxN3B4O2ZvbnQtc2l6ZToyMnB4fS5mZWF0dXJlZC10YWdze2Rpc3BsYXk6ZmxleDtnYXA6NnB4O2ZsZXgtd3JhcDp3cmFwfS5mZWF0dXJlZC10YWdzIGJ7cGFkZGluZzo1cHggOHB4O2NvbG9yOiM0YTVlNzg7YmFja2dyb3VuZDojZWRmMmY3O2JvcmRlci1yYWRpdXM6NXB4O2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjcwMH0uZmVhdHVyZWQtYWN0aW9ue21hcmdpbi10b3A6YXV0bztwYWRkaW5nLXRvcDoyNHB4O2NvbG9yOnZhcigtLWJsdWUpO2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjgwMH0ucmVnaW9uYWwtc3Rvcnl7cG9zaXRpb246cmVsYXRpdmU7bWluLWhlaWdodDo1NzBweDtkaXNwbGF5OmdyaWQ7YWxpZ24taXRlbXM6Y2VudGVyO2JhY2tncm91bmQ6IzA5MjEzZjtjb2xvcjojZmZmfS5yZWdpb25hbC1zdG9yeT5pbWd7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO29iamVjdC1maXQ6Y292ZXJ9LnJlZ2lvbmFsLXN0b3J5LXNoYWRle3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcscmdiYSg1LDIwLDQyLC45NCkscmdiYSg1LDIwLDQyLC41OCkgNjIlLHJnYmEoNSwyMCw0MiwuMjgpKX0ucmVnaW9uYWwtc3Rvcnk+LndyYXB7cG9zaXRpb246cmVsYXRpdmU7ei1pbmRleDoxO3dpZHRoOjEwMCV9LnJlZ2lvbmFsLXN0b3J5IC5leWVicm93e2NvbG9yOiNjYmRjZjB9LnJlZ2lvbmFsLXN0b3J5IGJsb2NrcXVvdGV7bWF4LXdpZHRoOjgyMHB4O21hcmdpbjoxN3B4IDAgMzRweDtjb2xvcjojZmZmO2ZvbnQtc2l6ZTpjbGFtcCgzNHB4LDQuNnZ3LDYzcHgpO2ZvbnQtd2VpZ2h0Ojc4MDtsaW5lLWhlaWdodDoxLjE0O2xldHRlci1zcGFjaW5nOi0uMDVlbX0ucmVnaW9uYWwtZGlyZWN0b3J5e3BhZGRpbmctdG9wOjExMHB4O3BhZGRpbmctYm90dG9tOjEwMHB4fS5yZWdpb25hbC1zZWFyY2h7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyIDEuMzVmciBhdXRvO2FsaWduLWl0ZW1zOmVuZDtnYXA6MTRweDttYXJnaW46MCAwIDM2cHg7cGFkZGluZzoyNHB4O2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MTNweDtib3gtc2hhZG93OjAgOHB4IDMwcHggcmdiYSgxNSw0MCw3NCwuMDgpfS5yZWdpb25hbC1zZWFyY2ggbGFiZWx7ZGlzcGxheTpncmlkO2dhcDo3cHh9LnJlZ2lvbmFsLXNlYXJjaCBsYWJlbD5zcGFue2NvbG9yOnZhcigtLWluayk7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6ODAwfS5yZWdpb25hbC1kaXJlY3RvcnkgLmxvZ28tY2F0ZWdvcnl7bWFyZ2luLXRvcDo2NHB4fS5yZWdpb25hbC1kaXJlY3RvcnkgLmxvZ28tdGlsZXtib3gtc2hhZG93OjAgNnB4IDIwcHggcmdiYSgxNSw0MCw3NCwuMDcpfS5jb3VudHktc2VydmljZS1iYW5ke3BhZGRpbmc6OTVweCAwO2JhY2tncm91bmQ6dmFyKC0tYmx1ZS1kYXJrKTtjb2xvcjojZmZmO2JvcmRlci10b3A6NXB4IHNvbGlkIHZhcigtLXJlZCl9LmNvdW50eS1zZXJ2aWNlLWJhbmQ+LndyYXB7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMS4xNWZyO2dhcDo4MHB4O2FsaWduLWl0ZW1zOmNlbnRlcn0uY291bnR5LXNlcnZpY2UtYmFuZCBoMnttYXJnaW4tdG9wOjEycHg7Y29sb3I6I2ZmZjtmb250LXNpemU6Y2xhbXAoMzZweCw0dncsNTRweCl9LmNvdW50eS1zZXJ2aWNlLWJhbmQgcHttYXJnaW4tdG9wOjIwcHg7Y29sb3I6I2NmZGJlYjtmb250LXNpemU6MTZweH0uY291bnR5LXNlcnZpY2UtYmFuZCAuZXllYnJvd3tjb2xvcjojYjljY2U1fS5jb3VudHktc2VydmljZS1iYW5kPi53cmFwPmRpdjpsYXN0LWNoaWxke2Rpc3BsYXk6Z3JpZDtnYXA6MTJweH0uY291bnR5LXNlcnZpY2UtYmFuZCBhe2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIGF1dG87Z2FwOjVweCAxOHB4O3BhZGRpbmc6MjNweCAyNXB4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDkpO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwuMTYpO2JvcmRlci1yYWRpdXM6MTFweDtjb2xvcjojZmZmO3RyYW5zaXRpb246YmFja2dyb3VuZCAuMnMsdHJhbnNmb3JtIC4yc30uY291bnR5LXNlcnZpY2UtYmFuZCBhOmhvdmVye2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMTYpO3RyYW5zZm9ybTp0cmFuc2xhdGVYKDRweCk7dGV4dC1kZWNvcmF0aW9uOm5vbmV9LmNvdW50eS1zZXJ2aWNlLWJhbmQgYSBzdHJvbmd7Zm9udC1zaXplOjE4cHh9LmNvdW50eS1zZXJ2aWNlLWJhbmQgYSBzcGFue2NvbG9yOiNjOWQ3ZTk7Zm9udC1zaXplOjEycHh9LmNvdW50eS1zZXJ2aWNlLWJhbmQgYSBie2dyaWQtcm93OjEvMztncmlkLWNvbHVtbjoyO2FsaWduLXNlbGY6Y2VudGVyO2ZvbnQtc2l6ZToxMnB4fS5yZWdpb25hbC1pbnZvbHZlZHtwYWRkaW5nLXRvcDoxMTBweDtwYWRkaW5nLWJvdHRvbToxMTBweDt0ZXh0LWFsaWduOmNlbnRlcn0ucmVnaW9uYWwtaW52b2x2ZWQgaDJ7bWF4LXdpZHRoOjg1MHB4O21hcmdpbjoxMnB4IGF1dG8gMDtmb250LXNpemU6Y2xhbXAoMzlweCw0LjZ2dyw2MHB4KX0ucmVnaW9uYWwtaW52b2x2ZWQgcHttYXgtd2lkdGg6NzIwcHg7bWFyZ2luOjIycHggYXV0bztjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjE3cHh9LnJlZ2lvbmFsLWludm9sdmVkPmRpdntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OmNlbnRlcjtnYXA6MTJweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjMxcHh9LmpzIFtkYXRhLXJldmVhbF17b3BhY2l0eTowO3RyYW5zZm9ybTp0cmFuc2xhdGVZKDIycHgpO3RyYW5zaXRpb246b3BhY2l0eSAuNjVzIGVhc2UsdHJhbnNmb3JtIC42NXMgZWFzZX0uanMgW2RhdGEtcmV2ZWFsXS5pcy12aXNpYmxle29wYWNpdHk6MTt0cmFuc2Zvcm06bm9uZX0KQG1lZGlhKG1heC13aWR0aDoxMDUwcHgpey5yZWdpb25hbC1xdWlja3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsMWZyKX0ucmVnaW9uYWwtcXVpY2sgYTpudGgtY2hpbGQoMyl7Ym9yZGVyLXJpZ2h0OjB9LnJlZ2lvbmFsLXF1aWNrIGE6bnRoLWNoaWxkKG4rNCl7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSl9LmZlYXR1cmVkLW9yZy1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMiwxZnIpfS5yZWdpb25hbC1zZWFyY2h7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnJ9LnJlZ2lvbmFsLXF1ZXJ5LC5yZWdpb25hbC1zZWFyY2g+LmJ1dHRvbntncmlkLWNvbHVtbjoxLy0xfS5jb3VudHktc2VydmljZS1iYW5kPi53cmFwe2dhcDo0NXB4fS5yZWdpb25hbC1ldmVudC1jYXJke21pbi1oZWlnaHQ6MjcwcHh9fQpAbWVkaWEobWF4LXdpZHRoOjcyMHB4KXsucmVnaW9uYWwtaGVyb3ttaW4taGVpZ2h0OjY5MHB4fS5yZWdpb25hbC1oZXJvLWNvbnRlbnR7cGFkZGluZy10b3A6NTRweDtwYWRkaW5nLWJvdHRvbTo2OHB4fS5ub3JjYWwtbG9nb3t3aWR0aDptaW4oMzAwcHgsNzZ2dyk7bWFyZ2luLWJvdHRvbTozNXB4fS5yZWdpb25hbC1oZXJvIGgxe2ZvbnQtc2l6ZTpjbGFtcCg0OHB4LDEzdncsNjdweCl9LnJlZ2lvbmFsLWhlcm8tY29udGVudD5we2ZvbnQtc2l6ZToxNnB4fS5yZWdpb25hbC1xdWlja3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyO21hcmdpbjowO2JvcmRlci1yYWRpdXM6MDtib3JkZXItaW5saW5lOjB9LnJlZ2lvbmFsLXF1aWNrIGEsLnJlZ2lvbmFsLXF1aWNrIGE6bnRoLWNoaWxkKDMpLC5yZWdpb25hbC1xdWljayBhOm50aC1jaGlsZChuKzQpe2JvcmRlcjowO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpO2JvcmRlci1yYWRpdXM6MCFpbXBvcnRhbnQ7cGFkZGluZzoxN3B4IDIycHh9LnJlZ2lvbmFsLXNlY3Rpb24sLnJlZ2lvbmFsLWZlYXR1cmVke3BhZGRpbmctdG9wOjcwcHg7cGFkZGluZy1ib3R0b206NzBweH0ucmVnaW9uYWwtaGVhZGluZ3thbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTRweH0ucmVnaW9uYWwtaGVhZGluZyBoMntmb250LXNpemU6MzZweH0ucmVnaW9uYWwtZXZlbnQtZ3JpZCwuZmVhdHVyZWQtb3JnLWdyaWR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn0ucmVnaW9uYWwtZXZlbnQtY2FyZHttaW4taGVpZ2h0OjIzNXB4fS5mZWF0dXJlZC1vcmctY2FyZHttaW4taGVpZ2h0OjMzMHB4fS5yZWdpb25hbC1zdG9yeXttaW4taGVpZ2h0OjU0MHB4fS5yZWdpb25hbC1zdG9yeSBibG9ja3F1b3Rle2ZvbnQtc2l6ZTozOXB4fS5yZWdpb25hbC1kaXJlY3Rvcnl7cGFkZGluZy10b3A6NzVweDtwYWRkaW5nLWJvdHRvbTo3NXB4fS5yZWdpb25hbC1zZWFyY2h7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcjtwYWRkaW5nOjE5cHh9LnJlZ2lvbmFsLXF1ZXJ5LC5yZWdpb25hbC1zZWFyY2g+LmJ1dHRvbntncmlkLWNvbHVtbjphdXRvfS5jb3VudHktc2VydmljZS1iYW5ke3BhZGRpbmc6NzBweCAwfS5jb3VudHktc2VydmljZS1iYW5kPi53cmFwe2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjM1cHh9LmNvdW50eS1zZXJ2aWNlLWJhbmQgYXtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfS5jb3VudHktc2VydmljZS1iYW5kIGEgYntncmlkLXJvdzphdXRvO2dyaWQtY29sdW1uOmF1dG87bWFyZ2luLXRvcDo4cHh9LnJlZ2lvbmFsLWludm9sdmVke3BhZGRpbmctdG9wOjc4cHg7cGFkZGluZy1ib3R0b206NzhweH19CkBtZWRpYShwcmVmZXJzLXJlZHVjZWQtbW90aW9uOnJlZHVjZSl7W2RhdGEtcmV2ZWFsXXtvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmU7dHJhbnNpdGlvbjpub25lfS5yZWdpb25hbC1ldmVudC1jYXJkLC5mZWF0dXJlZC1vcmctY2FyZCwucmVnaW9uYWwtcXVpY2sgYSwuY291bnR5LXNlcnZpY2UtYmFuZCBhe3RyYW5zaXRpb246bm9uZX0ucmVnaW9uYWwtZXZlbnQtY2FyZDpob3ZlciwuZmVhdHVyZWQtb3JnLWNhcmQ6aG92ZXIsLnJlZ2lvbmFsLXF1aWNrIGE6aG92ZXIsLmNvdW50eS1zZXJ2aWNlLWJhbmQgYTpob3Zlcnt0cmFuc2Zvcm06bm9uZX19CgovKiBEZXRhY2htZW50IDYyNyBpcyB0aGUgZmlyc3Qgb3JnYW5pemF0aW9uIHBhZ2UgZGVzaWduZWQgdG8gc2VydmUgYXMgdGhlIG9yZ2FuaXphdGlvbidzIG93biBwdWJsaWMgd2Vic2l0ZS4gKi8KLm9yZy1zaXRle2JhY2tncm91bmQ6I2Y0ZjVmN30ub3JnLXNpdGUtbmF2e21pbi1oZWlnaHQ6OTJweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDozMHB4O2JhY2tncm91bmQ6I2ZmZn0ub3JnLXNpdGUtaWRlbnRpdHl7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTNweDtjb2xvcjp2YXIoLS1pbmspfS5vcmctc2l0ZS1pZGVudGl0eTpob3Zlcnt0ZXh0LWRlY29yYXRpb246bm9uZX0ub3JnLXNpdGUtaWRlbnRpdHkgaW1ne3dpZHRoOjU4cHg7aGVpZ2h0OjU4cHg7b2JqZWN0LWZpdDpjb250YWlufS5vcmctc2l0ZS1pZGVudGl0eSBzcGFue2Rpc3BsYXk6Z3JpZDtnYXA6M3B4fS5vcmctc2l0ZS1pZGVudGl0eSBzdHJvbmd7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC1zaXplOjIxcHh9Lm9yZy1zaXRlLWlkZW50aXR5IHNtYWxse2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweDtsZXR0ZXItc3BhY2luZzouMDdlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2V9Lm9yZy1zaXRlLW5hdj5kaXZ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MjRweH0ub3JnLXNpdGUtbmF2PmRpdiBhe2NvbG9yOnZhcigtLWluayk7Zm9udC1zaXplOjEycHg7Zm9udC13ZWlnaHQ6NzUwfS5vcmctc2l0ZS1oZXJve3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjttaW4taGVpZ2h0OjY1MHB4O2Rpc3BsYXk6Z3JpZDthbGlnbi1pdGVtczpjZW50ZXI7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDg0JSAzMCUsIzM1NTM3MyAwLCMxMTJjNGMgMzElLCMwNzFhMzMgNjclKTtjb2xvcjojZmZmO2JvcmRlci10b3A6NXB4IHNvbGlkICNhNjIwMzV9Lm9yZy1zaXRlLWhlcm86OmJlZm9yZXtjb250ZW50OicnO3Bvc2l0aW9uOmFic29sdXRlO2luc2V0OjA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTIwZGVnLHJnYmEoNSwxOSwzOSwuMjUpLHJnYmEoNSwxOSwzOSwuNzYpKSxyZXBlYXRpbmctbGluZWFyLWdyYWRpZW50KDEyMGRlZyx0cmFuc3BhcmVudCAwIDgwcHgscmdiYSgyNTUsMjU1LDI1NSwuMDI1KSA4MHB4IDgxcHgpfS5vcmctc2l0ZS1oZXJvLW1hcmt7cG9zaXRpb246YWJzb2x1dGU7cmlnaHQ6LTF2dztib3R0b206LTExdnc7Y29sb3I6cmdiYSgyNTUsMjU1LDI1NSwuMDQ1KTtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXNpemU6bWluKDQ0dncsNjUwcHgpO2ZvbnQtd2VpZ2h0OjkwMDtsaW5lLWhlaWdodDoxfS5vcmctc2l0ZS1oZXJvLWdyaWR7cG9zaXRpb246cmVsYXRpdmU7ei1pbmRleDoxO3dpZHRoOjEwMCU7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczptaW5tYXgoMCwxLjM1ZnIpIG1pbm1heCgyNzBweCwuNjVmcik7Z2FwOjc1cHg7YWxpZ24taXRlbXM6Y2VudGVyO3BhZGRpbmctdG9wOjc2cHg7cGFkZGluZy1ib3R0b206ODJweH0ub3JnLXNpdGUtaGVybyAuZXllYnJvd3tjb2xvcjojZDNkZWVifS5vcmctc2l0ZS1oZXJvIGgxe21heC13aWR0aDo3ODBweDttYXJnaW4tdG9wOjE4cHg7Y29sb3I6I2ZmZjtmb250LXNpemU6Y2xhbXAoNTVweCw3dncsOTRweCk7bGV0dGVyLXNwYWNpbmc6LS4wNmVtfS5vcmctc2l0ZS1oZXJvIGgxIGVte2NvbG9yOiNmZmZ9Lm9yZy1zaXRlLWhlcm8gcHttYXgtd2lkdGg6NzAwcHg7bWFyZ2luLXRvcDoyNXB4O2NvbG9yOiNlNmVkZjU7Zm9udC1zaXplOmNsYW1wKDE3cHgsMnZ3LDIxcHgpO2xpbmUtaGVpZ2h0OjEuN30ub3JnLXNpdGUtYWN0aW9uc3tkaXNwbGF5OmZsZXg7Z2FwOjEycHg7ZmxleC13cmFwOndyYXA7bWFyZ2luLXRvcDozMXB4fS5vcmctc2l0ZS1lbWJsZW17ZGlzcGxheTpncmlkO3BsYWNlLWl0ZW1zOmNlbnRlcjttaW4taGVpZ2h0OjM0MHB4O3BhZGRpbmc6NDRweDtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjkzKTtib3JkZXItcmFkaXVzOjUwJTtib3gtc2hhZG93OjAgMzBweCA5MHB4IHJnYmEoMCwwLDAsLjI4KX0ub3JnLXNpdGUtZW1ibGVtIGltZ3t3aWR0aDoxMDAlO21heC13aWR0aDoyODBweDttYXgtaGVpZ2h0OjI4MHB4O29iamVjdC1maXQ6Y29udGFpbn0ub3JnLXNpdGUtaW50cm97ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxLjI1ZnIgLjc1ZnI7Z2FwOjg1cHg7YWxpZ24taXRlbXM6Y2VudGVyO3BhZGRpbmctdG9wOjEwNXB4O3BhZGRpbmctYm90dG9tOjEwNXB4fS5vcmctc2l0ZS1pbnRybyBoMiwub3JnLXNpdGUtaGVhZGluZyBoMnttYXgtd2lkdGg6NzYwcHg7bWFyZ2luLXRvcDoxMnB4O2ZvbnQtc2l6ZTpjbGFtcCgzNnB4LDQuNnZ3LDU4cHgpO2xldHRlci1zcGFjaW5nOi0uMDVlbX0ub3JnLXNpdGUtaW50cm8gcHttYXgtd2lkdGg6NzYwcHg7bWFyZ2luLXRvcDoyM3B4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTdweDtsaW5lLWhlaWdodDoxLjc1fS5vcmctc2l0ZS1pbnRybyBkbHttYXJnaW46MDtwYWRkaW5nOjMwcHggMzRweDtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItdG9wOjVweCBzb2xpZCAjYTYyMDM1O2JvcmRlci1yYWRpdXM6MTJweDtib3gtc2hhZG93OjAgMTRweCA0MHB4IHJnYmEoMTIsMzUsNjMsLjEpfS5vcmctc2l0ZS1pbnRybyBkbCBkaXZ7ZGlzcGxheTpncmlkO2dhcDo2cHg7cGFkZGluZzoxN3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSl9Lm9yZy1zaXRlLWludHJvIGRsIGRpdjpsYXN0LWNoaWxke2JvcmRlcjowfS5vcmctc2l0ZS1pbnRybyBkdHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEwcHg7Zm9udC13ZWlnaHQ6ODAwO2xldHRlci1zcGFjaW5nOi4wOWVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZX0ub3JnLXNpdGUtaW50cm8gZGR7bWFyZ2luOjA7Y29sb3I6dmFyKC0taW5rKTtmb250LXNpemU6MTVweDtmb250LXdlaWdodDo3MDB9Lm9yZy1zaXRlLXBpbGxhcnN7cGFkZGluZzo5NnB4IDA7YmFja2dyb3VuZDojZTRlOGVkO2JvcmRlci1ibG9jazoxcHggc29saWQgI2QwZDhlMn0ub3JnLXNpdGUtaGVhZGluZz5we21heC13aWR0aDo3NTBweDttYXJnaW4tdG9wOjE4cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxNnB4fS5vcmctc2l0ZS1jYXJkLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMywxZnIpO2dhcDoyMHB4O21hcmdpbi10b3A6MzhweH0ub3JnLXNpdGUtY2FyZC1ncmlkIGFydGljbGV7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjttaW4taGVpZ2h0OjMzMHB4O3BhZGRpbmc6MzBweDtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXJhZGl1czoxMnB4O2JvcmRlcjoxcHggc29saWQgI2QxZDllMztib3gtc2hhZG93OjAgOHB4IDI4cHggcmdiYSgxMiwzNSw2MywuMDgpO3RyYW5zaXRpb246dHJhbnNmb3JtIC4ycyxib3gtc2hhZG93IC4yc30ub3JnLXNpdGUtY2FyZC1ncmlkIGFydGljbGU6aG92ZXJ7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTVweCk7Ym94LXNoYWRvdzowIDE4cHggNDBweCByZ2JhKDEyLDM1LDYzLC4xMyl9Lm9yZy1zaXRlLWNhcmQtZ3JpZCBhcnRpY2xlPnNwYW57Y29sb3I6I2E2MjAzNTtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXNpemU6MjdweDtmb250LXdlaWdodDo4MDB9Lm9yZy1zaXRlLWNhcmQtZ3JpZCBoM3ttYXJnaW4tdG9wOjQwcHg7Zm9udC1zaXplOjI3cHh9Lm9yZy1zaXRlLWNhcmQtZ3JpZCBwe21hcmdpbi10b3A6MTRweDtjb2xvcjp2YXIoLS1tdXRlZCk7bGluZS1oZWlnaHQ6MS43fS5vcmctc2l0ZS1jYXJkLWdyaWQgYXttYXJnaW4tdG9wOmF1dG87cGFkZGluZy10b3A6MjVweDtmb250LXdlaWdodDo4MDB9Lm9yZy1zaXRlLWNhbGVuZGFyLC5vcmctc2l0ZS1jb21tdW5pdHl7cGFkZGluZy10b3A6MTA1cHg7cGFkZGluZy1ib3R0b206MTA1cHh9Lm9yZy1zaXRlLWNhbGVuZGFyIC5tb250aC1jYWxlbmRhcnttYXJnaW4tdG9wOjM2cHg7YmFja2dyb3VuZDojZmZmfS5vcmctc2l0ZS1yZXNvdXJjZXN7cGFkZGluZzo5OHB4IDA7YmFja2dyb3VuZDojMGEyMTNmO2NvbG9yOiNmZmY7Ym9yZGVyLXRvcDo1cHggc29saWQgI2E2MjAzNX0ub3JnLXNpdGUtcmVzb3VyY2VzIGgye2NvbG9yOiNmZmZ9Lm9yZy1zaXRlLXJlc291cmNlcyAuZXllYnJvd3tjb2xvcjojYzhkNmU3fS5vcmctc2l0ZS1yZXNvdXJjZS1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsMWZyKTtnYXA6MTRweDttYXJnaW4tdG9wOjM4cHh9Lm9yZy1zaXRlLXJlc291cmNlLWdyaWQgYXtkaXNwbGF5OmdyaWQ7Z2FwOjhweDtwYWRkaW5nOjI1cHggMjdweDtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA4KTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsLjE2KTtib3JkZXItcmFkaXVzOjEwcHg7Y29sb3I6I2ZmZjt0cmFuc2l0aW9uOmJhY2tncm91bmQgLjJzLHRyYW5zZm9ybSAuMnN9Lm9yZy1zaXRlLXJlc291cmNlLWdyaWQgYTpob3ZlcntiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjE0KTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtM3B4KTt0ZXh0LWRlY29yYXRpb246bm9uZX0ub3JnLXNpdGUtcmVzb3VyY2UtZ3JpZCBzdHJvbmd7Zm9udC1zaXplOjE4cHh9Lm9yZy1zaXRlLXJlc291cmNlLWdyaWQgc3Bhbntjb2xvcjojY2JkOGU4O2ZvbnQtc2l6ZToxMnB4fS5vcmctc2l0ZS1jb21tdW5pdHk+Lm9yZ2FuaXphdGlvbi1waG90b3MsLm9yZy1zaXRlLWNvbW11bml0eT4ub3JnYW5pemF0aW9uLW9mZmljZXJze21hcmdpbi10b3A6MzRweH0ub3JnLXNpdGUtY29udGFjdHtwYWRkaW5nOjk1cHggMDtiYWNrZ3JvdW5kOiNhNjIwMzU7Y29sb3I6I2ZmZn0ub3JnLXNpdGUtY29udGFjdC1ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MS4yZnIgLjhmcjtnYXA6ODBweDthbGlnbi1pdGVtczpjZW50ZXJ9Lm9yZy1zaXRlLWNvbnRhY3QgaDJ7bWFyZ2luLXRvcDoxMnB4O2NvbG9yOiNmZmY7Zm9udC1zaXplOmNsYW1wKDQycHgsNXZ3LDY2cHgpfS5vcmctc2l0ZS1jb250YWN0IHB7bWF4LXdpZHRoOjY4MHB4O21hcmdpbi10b3A6MjBweDtjb2xvcjojZjVlOWVjO2ZvbnQtc2l6ZToxNnB4fS5vcmctc2l0ZS1jb250YWN0IC5leWVicm93e2NvbG9yOiNmM2RmZTN9Lm9yZy1zaXRlLWNvbnRhY3QgLmJ1dHRvbi5vdXRsaW5le2JvcmRlci1jb2xvcjojZmZmO2NvbG9yOiNmZmZ9Lm9yZy1zaXRlLWNvbnRhY3QgYXNpZGV7cGFkZGluZzozMXB4O2JhY2tncm91bmQ6I2ZmZjtjb2xvcjp2YXIoLS1ib2R5KTtib3JkZXItcmFkaXVzOjEycHg7Ym94LXNoYWRvdzowIDE4cHggNDZweCByZ2JhKDY1LDUsMTYsLjIpfS5vcmctc2l0ZS1jb250YWN0IGFzaWRlIHN0cm9uZ3tkaXNwbGF5OmJsb2NrO2NvbG9yOnZhcigtLWluayk7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC1zaXplOjI1cHh9Lm9yZy1zaXRlLWNvbnRhY3QgYXNpZGUgcHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjE0cHg7bGluZS1oZWlnaHQ6MS43fS5vcmctc2l0ZS1jb250YWN0IGFzaWRlIGF7ZGlzcGxheTppbmxpbmUtYmxvY2s7bWFyZ2luLXRvcDoxOHB4O2ZvbnQtd2VpZ2h0OjgwMH0ub3JnLXNpdGUtc291cmNlc3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDozNXB4O3BhZGRpbmctdG9wOjQycHg7cGFkZGluZy1ib3R0b206NDJweH0ub3JnLXNpdGUtc291cmNlcyBkZXRhaWxze21heC13aWR0aDo3NjBweH0ub3JnLXNpdGUtc291cmNlcyBzdW1tYXJ5e2NvbG9yOnZhcigtLWluayk7Zm9udC13ZWlnaHQ6ODAwO2N1cnNvcjpwb2ludGVyfS5vcmctc2l0ZS1zb3VyY2VzIGRldGFpbHM+Kjpub3Qoc3VtbWFyeSl7bWFyZ2luLXRvcDoxNXB4fS5vcmctc2l0ZS1zb3VyY2VzPmF7Zm9udC13ZWlnaHQ6ODAwO3doaXRlLXNwYWNlOm5vd3JhcH0KQG1lZGlhKG1heC13aWR0aDo5ODBweCl7Lm9yZy1zaXRlLW5hdnthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3BhZGRpbmctdG9wOjIwcHg7cGFkZGluZy1ib3R0b206MjBweH0ub3JnLXNpdGUtbmF2PmRpdnt3aWR0aDoxMDAlO292ZXJmbG93LXg6YXV0bztwYWRkaW5nLWJvdHRvbTo0cHh9Lm9yZy1zaXRlLWhlcm8tZ3JpZHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIC41NWZyO2dhcDozOHB4fS5vcmctc2l0ZS1lbWJsZW17bWluLWhlaWdodDoyNzBweDtwYWRkaW5nOjM0cHh9Lm9yZy1zaXRlLWludHJve2dhcDo0NXB4fS5vcmctc2l0ZS1jYXJkLWdyaWR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn0ub3JnLXNpdGUtY2FyZC1ncmlkIGFydGljbGV7bWluLWhlaWdodDoyNDBweH0ub3JnLXNpdGUtY29udGFjdC1ncmlke2dhcDo0MHB4fX0KQG1lZGlhKG1heC13aWR0aDo3MDBweCl7Lm9yZy1zaXRlLW5hdj5kaXZ7Z2FwOjE5cHh9Lm9yZy1zaXRlLWhlcm97bWluLWhlaWdodDo2NzBweH0ub3JnLXNpdGUtaGVyby1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7cGFkZGluZy10b3A6NjJweDtwYWRkaW5nLWJvdHRvbTo2OHB4fS5vcmctc2l0ZS1oZXJvIGgxe2ZvbnQtc2l6ZTpjbGFtcCg0OXB4LDEzdncsNjhweCl9Lm9yZy1zaXRlLWVtYmxlbXtkaXNwbGF5Om5vbmV9Lm9yZy1zaXRlLWludHJve2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjM4cHg7cGFkZGluZy10b3A6NzVweDtwYWRkaW5nLWJvdHRvbTo3NXB4fS5vcmctc2l0ZS1waWxsYXJzLC5vcmctc2l0ZS1yZXNvdXJjZXN7cGFkZGluZzo3MnB4IDB9Lm9yZy1zaXRlLWNhcmQtZ3JpZCBhcnRpY2xle21pbi1oZWlnaHQ6MjcwcHh9Lm9yZy1zaXRlLWNhbGVuZGFyLC5vcmctc2l0ZS1jb21tdW5pdHl7cGFkZGluZy10b3A6NzZweDtwYWRkaW5nLWJvdHRvbTo3NnB4fS5vcmctc2l0ZS1yZXNvdXJjZS1ncmlkLC5vcmctc2l0ZS1jb250YWN0LWdyaWR7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcn0ub3JnLXNpdGUtY29udGFjdHtwYWRkaW5nOjcycHggMH0ub3JnLXNpdGUtc291cmNlc3thbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbn0ub3JnLXNpdGUtc291cmNlcz5he3doaXRlLXNwYWNlOm5vcm1hbH19CkBtZWRpYShwcmVmZXJzLXJlZHVjZWQtbW90aW9uOnJlZHVjZSl7Lm9yZy1zaXRlLWNhcmQtZ3JpZCBhcnRpY2xlLC5vcmctc2l0ZS1yZXNvdXJjZS1ncmlkIGF7dHJhbnNpdGlvbjpub25lfS5vcmctc2l0ZS1jYXJkLWdyaWQgYXJ0aWNsZTpob3Zlciwub3JnLXNpdGUtcmVzb3VyY2UtZ3JpZCBhOmhvdmVye3RyYW5zZm9ybTpub25lfX0KDQo="},"/app.js":{"type":"application/javascript; charset=utf-8","base64":"Ly8gUHJvZ3Jlc3NpdmUgZW5oYW5jZW1lbnQgb25seTogbmF0aXZlIEdFVCBmb3JtcyB3b3JrIHdpdGhvdXQgSmF2YVNjcmlwdC4KZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2pzJyk7CmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2Zvcm0nKS5mb3JFYWNoKGZvcm0gPT4gZm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCAoKSA9PiB7CiBjb25zdCBidXR0b249Zm9ybS5xdWVyeVNlbGVjdG9yKCdidXR0b25bdHlwZT0ic3VibWl0Il0nKTsKIGlmKGJ1dHRvbil7YnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1idXN5JywndHJ1ZScpO2J1dHRvbi50ZXh0Q29udGVudD0nTG9hZGluZ+KApic7fQp9KSk7CndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwYWdlc2hvdycsICgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvblthcmlhLWJ1c3ldJykuZm9yRWFjaChidXR0b249PnsKIGJ1dHRvbi5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtYnVzeScpO2J1dHRvbi50ZXh0Q29udGVudD1idXR0b24uY2xvc2VzdCgnW3JvbGU9InNlYXJjaCJdJyk/J0ZpbmQgb3JnYW5pemF0aW9ucyDihpInOidQcmV2aWV3JzsKfSkpOwoKY29uc3Qgb2ZmaWNlckRldGFpbHM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29mZmljZXJzJyk7CmNvbnN0IG9wZW5PZmZpY2VyRGV0YWlscz0oKT0+e2lmKG9mZmljZXJEZXRhaWxzPy50YWdOYW1lPT09J0RFVEFJTFMnKW9mZmljZXJEZXRhaWxzLm9wZW49dHJ1ZTt9Owpkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhW2hyZWY9IiNvZmZpY2VycyJdJykuZm9yRWFjaChsaW5rPT5saW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxvcGVuT2ZmaWNlckRldGFpbHMpKTsKaWYobG9jYXRpb24uaGFzaD09PScjb2ZmaWNlcnMnKW9wZW5PZmZpY2VyRGV0YWlscygpOwp3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignaGFzaGNoYW5nZScsKCk9PntpZihsb2NhdGlvbi5oYXNoPT09JyNvZmZpY2Vycycpb3Blbk9mZmljZXJEZXRhaWxzKCk7fSk7CgppZihsb2NhdGlvbi5wYXRobmFtZT09PScvJ3x8bG9jYXRpb24ucGF0aG5hbWU9PT0nL3lvbG8tc29sYW5vJyl0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oJ25vcmNhbC12ZXRlcmFucy1yZWdpb24nLCd5b2xvLXNvbGFubycpO31jYXRjaHt9CnsKIGNvbnN0IHJlZHVjZWQ9bWF0Y2hNZWRpYSgnKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSknKS5tYXRjaGVzOwogY29uc3QgcmV2ZWFsPVsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1yZXZlYWxdJyldOwogaWYocmVkdWNlZHx8ISgnSW50ZXJzZWN0aW9uT2JzZXJ2ZXInIGluIHdpbmRvdykpcmV2ZWFsLmZvckVhY2goaXRlbT0+aXRlbS5jbGFzc0xpc3QuYWRkKCdpcy12aXNpYmxlJykpOwogZWxzZXsKICBjb25zdCBvYnNlcnZlcj1uZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoZW50cmllcz0+ZW50cmllcy5mb3JFYWNoKGVudHJ5PT57aWYoZW50cnkuaXNJbnRlcnNlY3Rpbmcpe2VudHJ5LnRhcmdldC5jbGFzc0xpc3QuYWRkKCdpcy12aXNpYmxlJyk7b2JzZXJ2ZXIudW5vYnNlcnZlKGVudHJ5LnRhcmdldCk7fX0pLHtyb290TWFyZ2luOicwcHggMHB4IC04JSAwcHgnLHRocmVzaG9sZDouMDh9KTsKICByZXZlYWwuZm9yRWFjaChpdGVtPT5vYnNlcnZlci5vYnNlcnZlKGl0ZW0pKTsKIH0KfQo="},"/hq.js":{"type":"application/javascript; charset=utf-8","base64":"Ly8gVGhpcyByZWZyZXNoZXMgdGhlIHBhZ2Ugb25seSB3aGVuIG5vIGZvcm0gaGFzIGJlZW4gdG91Y2hlZC4gSXQgbmV2ZXIgY2FsbHMgYW4gQUkuCmlmICgobmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpLmdldCgndGFiJykgfHwgJ3JlcXVlc3RzJykgPT09ICdyZXF1ZXN0cycpIHsKIGxldCBkaXJ0eT1mYWxzZSwgcHJldmlvdXM9bnVsbDsKIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywoKT0+e2RpcnR5PXRydWU7fSk7CiBhc3luYyBmdW5jdGlvbiBjaGVjaygpewogIGlmKGRvY3VtZW50LmhpZGRlbilyZXR1cm47CiAgdHJ5ewogICBjb25zdCByZXNwb25zZT1hd2FpdCBmZXRjaCgnL3JlcXVlc3Qtc3RhdGUnLHtjYWNoZTonbm8tc3RvcmUnfSk7CiAgIGlmKCFyZXNwb25zZS5va3x8IXJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdjb250ZW50LXR5cGUnKT8uaW5jbHVkZXMoJ2FwcGxpY2F0aW9uL2pzb24nKSlyZXR1cm47CiAgIGNvbnN0IGN1cnJlbnQ9SlNPTi5zdHJpbmdpZnkoYXdhaXQgcmVzcG9uc2UuanNvbigpKTsKICAgaWYocHJldmlvdXMmJnByZXZpb3VzIT09Y3VycmVudCl7CiAgICBpZighZGlydHkpe2xvY2F0aW9uLnJlbG9hZCgpO3JldHVybjt9CiAgICBpZighZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnJlcXVlc3QtdXBkYXRlZCcpKXsKICAgICBjb25zdCBub3RpY2U9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO25vdGljZS5jbGFzc05hbWU9J3JlcXVlc3QtdXBkYXRlZCc7bm90aWNlLnNldEF0dHJpYnV0ZSgncm9sZScsJ3N0YXR1cycpOwogICAgIGNvbnN0IGxpbms9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO2xpbmsuaHJlZj1sb2NhdGlvbi5ocmVmO2xpbmsudGV4dENvbnRlbnQ9J05ldyBwcm9ncmVzcyBpcyBhdmFpbGFibGUuIEZpbmlzaCB5b3VyIG1lc3NhZ2UsIHRoZW4gcmVmcmVzaC4nOwogICAgIG5vdGljZS5hcHBlbmQobGluayk7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWFpbicpPy5wcmVwZW5kKG5vdGljZSk7CiAgICB9CiAgIH0KICAgcHJldmlvdXM9Y3VycmVudDsKICB9Y2F0Y2h7LyogVGhlIG5leHQgY2hlY2sgcmV0cmllcyB3aXRob3V0IGRpc3R1cmJpbmcgYSBtZXNzYWdlIGJlaW5nIHdyaXR0ZW4uICovfQogfQogY2hlY2soKTtzZXRJbnRlcnZhbChjaGVjaywzMDAwMCk7Cn0K"},"/favicon.svg":{"type":"image/svg+xml","base64":"PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMxMjNjNzQiLz48cGF0aCBkPSJNMTYgMTdoOGw4IDEyIDgtMTJoOEwzNiAzN3YxMWgtOFYzN1oiIGZpbGw9IiNmN2Y5ZmMiLz48cGF0aCBkPSJNMTYgNTNoMzJ2NEgxNnoiIGZpbGw9IiNkNDJjM2QiLz48L3N2Zz4K"},"/ysv-logo.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAABOYAAATmCAIAAAAKnjl9AABxn2NhQlgAAHGfanVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAcXlqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOjM4ODNlMGI="},"/og.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAABLAAAAJ2CAIAAADAIuwLAACjzElEQVR42uzdd3wURRvA8bn03iuQkEAoAQKhE3rvvQoioqKCBXvF9qrYEQuioiii9N577yQkgVRSSYX03su9f5zEkOQ2l0s74Pf98Mdxt7u3Ozu32Wdn5hmZ1cA="},"/logos/american-legion.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAABdwAAAGdCAYAAAAIfrG+AAAACXBIWXMAAC4jAAAuIwF4pT92AAAGoGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlQ="},"/logos/dav.svg":{"type":"image/svg+xml","base64":"PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCQk="},"/logos/marine-corps-league.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAABkoAAAZKCAYAAACXtT0IAAAACXBIWXMAAC4jAAAuIwF4pT92AAAgAElEQVR42uzdz29Td77/8df9arYO3R+Pakve2NWd9t5F7ApGsMCuygi1il2RwqJJqtJ2E4xI6aI0QEoXQBAmm1JQncwCSFQ="},"/logos/rememberavet.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAAATgAAAFpCAYAAAAIrTQ4AAAACXBIWXMAAAsSAAALEgHS3X78AAAgAElEQVR4nOy9ebhlVXmv+44xZrua3dXeu/q+pWhEioJCRJBWQESCMaARUaMeT3Kjid5czdGYRz3Rc82TxGiMXmN3JDagGBQ="},"/logos/toys-for-tots.svg":{"type":"image/svg+xml","base64":"PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW8="},"/logos/veterans-equine-therapy.jpg":{"type":"image/jpeg","base64":"/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgcICAYIBgYIBgYGCAgIBwcICAgHCAgIBwgIBwgHBwgIBwcHBwcHCAcHBwoHBwcICQkJBwcLDQoIDQcICQgBAwQEBgUGCAYGCA0ICAgNDQgICAgICAgICAgICAgICAgICAgICAg="},"/logos/vfw.png":{"type":"image/png","base64":"iVBORw0KGgoAAAANSUhEUgAAAcIAAAC0CAYAAAAHFCwtAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzU="}};
export default {async fetch(request,env={}){
 const url=new URL(request.url),head=request.method==='HEAD';
 if(request.method==='POST'&&url.pathname==='/submit'){
  try{await submitIntake(request,env.DB,records.map(r=>r.id));return redirect('/for-organizations?received=1');}
  catch(err){const message=/D1_|SQLITE|database/i.test(err.message)?'The submission desk is temporarily unavailable. Please try again later.':err.message;return responseHTML(submissionPage(new URL('/for-organizations',url),{error:message}),400,true);}
 }
 if(request.method==='POST'&&url.pathname==='/speaker-submissions'){
  try{await submitSpeakerSubmission(request,env.DB,records.map(r=>r.id));return redirect('/share?received=1');}
  catch(err){const message=/D1_|SQLITE|database/i.test(err.message)?'The introduction desk is temporarily unavailable. Please try again later.':err.message;return responseHTML(speakerSubmissionPage(new URL('/share',url),records,{error:message}),400,true);}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed.',{status:405,headers:{...securityHeaders,Allow:'GET, HEAD'}});
 const publishedAsset=await readPublishedRequestAsset(request,env,url.pathname);if(publishedAsset)return publishedAsset;
 const staticAsset=await readStaticAsset(request,env,url.pathname);if(staticAsset)return staticAsset;
 if(url.pathname.startsWith('/organization-photos/'))return await readOrganizationPhoto(request,env,url.pathname.slice('/organization-photos/'.length));
 if(assets[url.pathname]){const a=assets[url.pathname];return new Response(head?null:Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0)),{headers:{...securityHeaders,'Content-Type':a.type,'Cache-Control':'public, max-age=3600'}});}
 if(url.pathname==='/health')return new Response(head?null:JSON.stringify({status:'ok',project:'Yolo Solano Veterans',records:records.length,version:'0.2.0'}),{headers:{...securityHeaders,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
  const live=await publicData(env.DB,records,seedEvents);
  if(url.pathname==='/data.json')return new Response(head?null:JSON.stringify({...dataset,records:live.records.map(({officer_profiles,...record})=>record),events:live.events,memorial_services:memorialServices},null,2),{headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30'}});
  if(url.pathname==='/events.ics'){const events=url.searchParams.has('event')?live.events.filter(e=>e.id===url.searchParams.get('event')):upcomingEvents(live.events);return new Response(head?null:eventCalendar(events),{headers:{...securityHeaders,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="yolo-solano-veterans.ics"','Cache-Control':'public, max-age=30'}});}
  const page=publicExtension(url,live.events)||render(url,live.records,live.events);return responseHTML(head?'':page.html,page.status);
 }catch{return responseHTML(shell('Temporarily unavailable | Yolo Solano Veterans','Please try again soon.','<section class="wrap about-page"><h1>We’ll be back shortly.</h1><p>The directory service is temporarily unavailable. Please try again in a few minutes.</p></section>'),503,true);}
}};
