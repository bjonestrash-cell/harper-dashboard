-- ONE-PASTE MIGRATION — run this whole file in the Supabase SQL editor.
-- It is safe to run more than once.
--
-- Part 1: feed_photo_vault — an insert-only copy of every photo ever added
-- to the Feed Planner. The app writes each photo here once, at upload time,
-- and NEVER modifies or removes vault rows — removing a photo from the feed
-- leaves its vault copy untouched, so any photo can always be recovered.
-- Until this table exists the app vaults photos into hidden rows of the
-- notes table instead (updated_by 'feed-vault'); once it exists, the app
-- re-backfills every current photo into it automatically.
--
-- Part 2: audit_log — this table was designed earlier (see
-- supabase_audit_migration.sql) but was never actually created, so the
-- app's audit logging has been silently failing. Included here so one
-- paste fixes both.

-- ───── Part 1: photo vault ─────

create table if not exists feed_photo_vault (
  id bigint generated always as identity primary key,
  photo_id text not null,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);

create index if not exists idx_feed_photo_vault_photo on feed_photo_vault (photo_id);

alter table feed_photo_vault enable row level security;

-- Deliberately insert + select ONLY. With no update/delete policies, the
-- app's anon key is physically incapable of altering or erasing vault rows.
do $$ begin
  create policy "Allow insert for anon" on feed_photo_vault for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Allow select for anon" on feed_photo_vault for select using (true);
exception when duplicate_object then null; end $$;

-- ───── Part 2: audit log (previously designed, never created) ─────

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  action text not null,            -- 'insert', 'update', 'delete'
  record_id text,
  user_name text not null,
  summary text not null,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_log_created on audit_log (created_at desc);
create index if not exists idx_audit_log_table on audit_log (table_name);

do $$ begin
  alter publication supabase_realtime add table audit_log;
exception when duplicate_object then null; end $$;

alter table audit_log enable row level security;

do $$ begin
  create policy "Allow all for anon" on audit_log for all using (true) with check (true);
exception when duplicate_object then null; end $$;
