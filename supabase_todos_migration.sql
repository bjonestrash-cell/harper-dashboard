-- Run this in your Supabase SQL editor

-- 1. Add title column to notes table (for meeting note names)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title text DEFAULT '';

-- 2. Add starred column to tasks table (for task card starring)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;

-- 2b. Add color column to tasks table (for task card color tag)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color text;

-- 2. Add columns to todos table if needed
ALTER TABLE todos ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 3. Enable real-time for todos table (if not already)
-- ALTER PUBLICATION supabase_realtime ADD TABLE todos;
