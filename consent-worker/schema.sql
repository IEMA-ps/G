-- سجل موافقة الشروط: إضافة فقط. التريجرات بتمنع أي تعديل أو مسح من أي مسار (Worker أو console).
CREATE TABLE IF NOT EXISTS terms_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  terms_sha256 TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'google')),
  accepted_at TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  UNIQUE (uid, terms_version)
);
CREATE TRIGGER IF NOT EXISTS terms_consents_no_update BEFORE UPDATE ON terms_consents
BEGIN SELECT RAISE(ABORT, 'terms_consents is append-only'); END;
CREATE TRIGGER IF NOT EXISTS terms_consents_no_delete BEFORE DELETE ON terms_consents
BEGIN SELECT RAISE(ABORT, 'terms_consents is append-only'); END;
