-- ============================================================
--  ExamSystem — Supabase SQL Setup
--  Run this entire file in: Supabase Dashboard → SQL Editor → New query
--  Then follow the steps at the bottom to create the Camillus admin account.
-- ============================================================

-- ── 1. Tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'teacher'
              CHECK(role IN ('admin','teacher')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students_grades (
  id            BIGSERIAL   PRIMARY KEY,
  student_name  TEXT        NOT NULL,
  subject       TEXT        NOT NULL,
  grade         NUMERIC     NOT NULL CHECK(grade >= 0 AND grade <= 100),
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_name, subject)
);

CREATE TABLE IF NOT EXISTS forensic_audit_log (
  log_id            BIGSERIAL   PRIMARY KEY,
  user_id           UUID        DEFAULT auth.uid() REFERENCES auth.users(id),
  action_taken      TEXT        NOT NULL,
  target_student_id BIGINT,
  old_grade         NUMERIC,
  new_grade         NUMERIC,
  ip_address        TEXT,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Trigger: auto-update last_updated on grade change ──────

CREATE OR REPLACE FUNCTION update_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grades_last_updated ON students_grades;
CREATE TRIGGER trg_grades_last_updated
  BEFORE UPDATE ON students_grades
  FOR EACH ROW EXECUTE FUNCTION update_last_updated();

-- ── 3. Helper: get current user's role ───────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ── 4. Row Level Security ────────────────────────────────────

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_grades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_audit_log ENABLE ROW LEVEL SECURITY;

-- profiles: each user can see their own row; admins can see all
DROP POLICY IF EXISTS "own profile" ON profiles;
CREATE POLICY "own profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "admins see all profiles" ON profiles;
CREATE POLICY "admins see all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- students_grades: any authenticated user can read/write
DROP POLICY IF EXISTS "auth read grades" ON students_grades;
CREATE POLICY "auth read grades" ON students_grades
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth insert grades" ON students_grades;
CREATE POLICY "auth insert grades" ON students_grades
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth update grades" ON students_grades;
CREATE POLICY "auth update grades" ON students_grades
  FOR UPDATE TO authenticated USING (true);

-- forensic_audit_log: admins can read; authenticated users can insert
DROP POLICY IF EXISTS "admins read audit log" ON forensic_audit_log;
CREATE POLICY "admins read audit log" ON forensic_audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "auth insert audit log" ON forensic_audit_log;
CREATE POLICY "auth insert audit log" ON forensic_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 5. Sample student data ───────────────────────────────────

INSERT INTO students_grades (student_name, subject, grade) VALUES
  ('Amara Osei',    'Mathematics', 87.50),
  ('Amara Osei',    'English',     74.00),
  ('Amara Osei',    'Kiswahili',   80.00),
  ('Amara Osei',    'Biology',     91.25),
  ('Amara Osei',    'Chemistry',   68.00),
  ('Amara Osei',    'Physics',     77.50),
  ('Brian Kariuki', 'Mathematics', 65.00),
  ('Brian Kariuki', 'English',     73.00),
  ('Brian Kariuki', 'Kiswahili',   58.50),
  ('Brian Kariuki', 'Biology',     70.00),
  ('Brian Kariuki', 'Chemistry',   62.00),
  ('Brian Kariuki', 'Physics',     55.75)
ON CONFLICT (student_name, subject) DO NOTHING;

-- ── 6. Create the default admin account ──────────────────────
--
--  STEP A: Go to Supabase Dashboard → Authentication → Users
--          → "Add user" → "Create new user":
--              Email:    camillus@examsystem.local
--              Password: Camillus@Kosgei
--          Tick "Auto Confirm User". Click "Create User".
--
--  STEP B: Come back to this SQL editor and run ONLY this block:
--
--  INSERT INTO profiles (id, username, role)
--  SELECT id, 'Camillus', 'admin'
--  FROM auth.users
--  WHERE email = 'camillus@examsystem.local'
--  ON CONFLICT (id) DO NOTHING;
--
-- ─────────────────────────────────────────────────────────────
