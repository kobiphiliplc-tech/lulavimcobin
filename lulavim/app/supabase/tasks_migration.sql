-- ============================================================
-- Tasks Feature Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id          serial PRIMARY KEY,
  year        text NOT NULL UNIQUE,
  start_date  date,
  end_date    date,
  label       text,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO seasons (year) VALUES ('2025') ON CONFLICT (year) DO NOTHING;

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON seasons;
CREATE POLICY "auth_all" ON seasons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  supabase_user_id uuid,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON team_members;
CREATE POLICY "auth_all" ON team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                       text NOT NULL,
  description                 text,

  status                      text NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','in_progress','done')),
  priority                    text NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('normal','urgent')),
  task_type                   text NOT NULL DEFAULT 'task'
                                CHECK (task_type IN ('task','note')),

  due_date                    date,
  due_time                    text,
  reminder_days_before_season integer,

  season_context              text NOT NULL DEFAULT 'current'
                                CHECK (season_context IN ('current','next','timeless')),
  season_year                 text,

  is_recurring                boolean NOT NULL DEFAULT false,
  recurring_expires_year      integer,

  linked_entity_type          text,
  linked_entity_id            text,
  linked_entity_name          text,
  linked_module               text,
  linked_sub_module           text,
  linked_record_id            text,
  linked_record_label         text,
  linked_deep_link_path       text,

  assigned_to_member_id       integer REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_to_name            text,
  is_private                  boolean NOT NULL DEFAULT false,

  created_by_user_id          uuid,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON tasks;
CREATE POLICY "auth_all" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS tasks_season_idx  ON tasks(season_year, season_context);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx   ON tasks(status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON tasks;
CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();
