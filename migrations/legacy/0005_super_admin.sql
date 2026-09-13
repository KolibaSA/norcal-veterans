-- Expand the existing grant constraint without changing any assignment or audit ID.
-- SQLite requires a table rebuild to change CHECK constraints. Copy before drop;
-- D1 applies this migration transactionally. No records reference grants by FK.
CREATE TABLE grants_expanded(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','region_admin','organization_admin','editor')),
  region_id TEXT,
  organization_id TEXT,
  CHECK((role='super_admin' AND region_id IS NULL AND organization_id IS NULL)
    OR (role<>'super_admin' AND ((region_id IS NULL)!=(organization_id IS NULL)))),
  CHECK(role!='region_admin' OR region_id IS NOT NULL),
  CHECK(role!='organization_admin' OR organization_id IS NOT NULL)
);
INSERT INTO grants_expanded(id,email,role,region_id,organization_id)
  SELECT id,email,role,region_id,organization_id FROM grants;
DROP TABLE grants;
ALTER TABLE grants_expanded RENAME TO grants;
CREATE INDEX idx_grants_email ON grants(email);
