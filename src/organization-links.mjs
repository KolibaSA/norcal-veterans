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

export function organizationLinks(record){
 const specific=links[record.id]||{};
 return {social:specific.social||[],parent:specific.parent||parentByType[record.organization_type]||[]};
}

