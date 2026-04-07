-- Run this in your Supabase SQL editor to create the todos table

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade,  -- null = global todo
  text text not null,
  starred boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for fast per-note queries
create index if not exists todos_note_id_idx on todos (note_id);

-- Enable real-time for the todos table
alter publication supabase_realtime add table todos;

-- Optional: RLS (if your app uses row-level security)
-- alter table todos enable row level security;
-- create policy "allow all" on todos for all using (true);
