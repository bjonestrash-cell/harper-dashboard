-- Run this in your Supabase SQL editor

-- 1. Add starred column to tasks table (for task card starring)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;

-- 2. Add columns to todos table if needed
ALTER TABLE todos ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 3. Enable real-time for todos table (if not already)
-- ALTER PUBLICATION supabase_realtime ADD TABLE todos;
