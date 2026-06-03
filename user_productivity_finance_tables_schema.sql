[?25l[90m│[39m
[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[35m◓[39m  Downloading snippet[1G[J[35m◑[39m  Downloading snippet[1G[J[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[?25h-- Задачи
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text not null,
  status text default 'todo',
  priority text default 'medium',
  due_date date,
  created_at timestamptz default now()
);

-- Привычки
create table if not exists habits (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  name text not null,
  emoji text default '🔥',
  streak integer default 0,
  created_at timestamptz default now()
);

-- Выполнения привычек
create table if not exists habit_completions (
  id uuid default gen_random_uuid() primary key,
  habit_id uuid references habits(id) on delete cascade,
  user_id text not null,
  date date not null,
  created_at timestamptz default now(),
  unique(habit_id, date)
);

-- Тренировки
create table if not exists workouts (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  type text not null,
  duration integer,
  calories integer,
  notes text,
  date date default current_date,
  created_at timestamptz default now()
);

-- Финансы
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  type text not null,
  amount numeric not null,
  category text,
  description text,
  date date default current_date,
  created_at timestamptz default now()
);

-- Дневник
create table if not exists journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  content text not null,
  mood integer default 3,
  date date default current_date,
  created_at timestamptz default now()
);

-- RLS (отключаем для упрощённой работы без авторизации)
alter table tasks disable row level security;
alter table habits disable row level security;
alter table habit_completions disable row level security;
alter table workouts disable row level security;
alter table transactions disable row level security;
alter table journal_entries disable row level security;
