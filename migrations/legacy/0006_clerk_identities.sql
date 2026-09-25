-- Additive Clerk bindings: existing grants, records and audit actors remain intact.
CREATE TABLE IF NOT EXISTS auth_identities (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issuer, subject)
);
