CREATE TABLE IF NOT EXISTS organization_meeting_plans (
 org_id TEXT NOT NULL,
 year INTEGER NOT NULL CHECK(year BETWEEN 2026 AND 2100),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(org_id,year)
);

CREATE TABLE IF NOT EXISTS organization_meetings (
 id TEXT PRIMARY KEY,
 org_id TEXT NOT NULL,
 year INTEGER NOT NULL CHECK(year BETWEEN 2026 AND 2100),
 month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
 event_date TEXT NOT NULL CHECK(length(event_date)=10),
 start_time TEXT NOT NULL CHECK(length(start_time)=5),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=1800),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 UNIQUE(org_id,year,month),
 FOREIGN KEY(org_id,year) REFERENCES organization_meeting_plans(org_id,year) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS organization_meetings_org_date ON organization_meetings(org_id,event_date);


