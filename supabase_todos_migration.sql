-- Run this in your Supabase SQL editor

-- 1. Add summary column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS meeting_mode text DEFAULT 'blank';

-- 2. Create todos table (if not already created)
CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  text text NOT NULL,
  starred boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  assigned_to text,
  month text,
  priority text DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add columns if table already exists
ALTER TABLE todos ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES notes(id) ON DELETE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS todos_note_id_idx ON todos (note_id);
CREATE INDEX IF NOT EXISTS todos_month_idx ON todos (month);

-- 5. Enable real-time for todos table
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
