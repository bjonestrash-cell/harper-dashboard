-- Audit log table for Harper admin
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  action text not null,            -- 'insert', 'update', 'delete'
  record_id text,                  -- id of the affected row (as text for flexibility)
  user_name text not null,         -- 'natalie' or 'grace'
  summary text not null,           -- human-readable description
  details jsonb,                   -- optional full payload / diff
  created_at timestamptz default now()
);

-- Index for fast queries by date and table
create index if not exists idx_audit_log_created on audit_log (created_at desc);
create index if not exists idx_audit_log_table on audit_log (table_name);

-- Enable realtime
alter publication supabase_realtime add table audit_log;

-- RLS: allow all operations for anon (matches the rest of this app)
alter table audit_log enable row level security;
create policy "Allow all for anon" on audit_log for all using (true) with check (true);
