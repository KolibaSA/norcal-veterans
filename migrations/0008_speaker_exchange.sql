CREATE TABLE IF NOT EXISTS speaker_submissions (
 id TEXT PRIMARY KEY,
 presenter_name TEXT NOT NULL CHECK(length(trim(presenter_name)) BETWEEN 1 AND 120),
 phone TEXT NOT NULL CHECK(length(trim(phone)) BETWEEN 7 AND 40),
 email TEXT NOT NULL CHECK(length(trim(email)) BETWEEN 3 AND 254),
 organization_name TEXT NOT NULL CHECK(length(trim(organization_name)) BETWEEN 1 AND 180),
 organization_description TEXT NOT NULL CHECK(length(trim(organization_description)) BETWEEN 1 AND 1800),
 topic TEXT NOT NULL CHECK(length(trim(topic)) BETWEEN 1 AND 1000),
 request_text TEXT NOT NULL DEFAULT '' CHECK(length(request_text)<=1200),
 website TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS speaker_submission_recipients (
 id TEXT PRIMARY KEY,
 submission_id TEXT NOT NULL REFERENCES speaker_submissions(id) ON DELETE CASCADE,
 org_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 scheduled_event_id TEXT,
 decision_by TEXT,
 decision_at TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 UNIQUE(submission_id,org_id)
);

CREATE INDEX IF NOT EXISTS speaker_recipient_org_status ON speaker_submission_recipients(org_id,status);

