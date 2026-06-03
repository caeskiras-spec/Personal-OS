alter table tasks add column if not exists description text;
alter table tasks add column if not exists completed_at timestamptz;
