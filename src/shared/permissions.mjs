// These flags come only from the verified identity and fresh database grants.
// The browser uses them for presentation; every server route enforces them again.
export const isPlatformAdmin = user => user?.owner === true || user?.superAdmin === true;
