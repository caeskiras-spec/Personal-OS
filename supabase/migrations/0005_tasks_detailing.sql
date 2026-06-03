-- subtasks checklist
create table if not exists subtasks (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references tasks(id) on delete cascade,
  user_id     text        not null,
  title       text        not null,
  is_done     boolean     default false,
  position    integer     default 0,
  created_at  timestamptz default now()
);
alter table subtasks disable row level security;

-- tags on tasks
alter table tasks add column if not exists tags       text[]  default '{}';

-- projects
create table if not exists projects (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  name       text        not null,
  color      text,
  created_at timestamptz default now()
);
alter table projects disable row level security;

alter table tasks add column if not exists project_id  uuid    references projects(id) on delete set null;

-- recurrence
alter table tasks add column if not exists recurrence  text    default 'none';
