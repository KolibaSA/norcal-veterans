// Dates and both table locations were supplied in an authenticated HQ request
// by Sterling on September 2, 2026. Public web sources do not establish hours.
const poppyLocations=[
 {slug:'dixon-safeway',city:'Dixon',county:'Solano',venue:'Safeway, 1235 Stratford Avenue, Dixon, CA 95620',venue_source:'https://local.safeway.com/safeway/ca/dixon/1235-stratford-ave.html'},
 {slug:'davis-grocery-outlet',city:'Davis',county:'Yolo',venue:'Grocery Outlet, 1800 East 8th Street, Suite B, Davis, CA 95616',venue_source:'https://web.davischamber.com/Retail-Shops/Grocery-Outlet-Davis-12381'}
];
export const buddyPoppyEvents=['07','08','11'].flatMap(day=>poppyLocations.map(place=>({
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
