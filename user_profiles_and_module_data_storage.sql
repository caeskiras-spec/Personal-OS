[?25l[90m│[39m
[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[35m◓[39m  Downloading snippet[1G[J[35m◑[39m  Downloading snippet[1G[J[35m◒[39m  Downloading snippet[1G[J[35m◐[39m  Downloading snippet[1G[J[?25h-- Users OS config
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  os_name text default 'PERSONAL OS',
  theme text default 'dark',
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

-- Installed modules per user
create table if not exists user_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id text not null,
  is_active boolean default true,
  position integer default 0,
  settings jsonb default '{}',
  installed_at timestamptz default now()
);

-- Generic module data store
create table if not exists module_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id text not null,
  data_type text not null,
  content jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table user_profiles enable row level security;
alter table user_modules enable row level security;
alter table module_data enable row level security;

-- RLS Policies
create policy "Users can manage own profile" on user_profiles for all using (auth.uid() = user_id);
create policy "Users can manage own modules" on user_modules for all using (auth.uid() = user_id);
create policy "Users can manage own data" on module_data for all using (auth.uid() = user_id);
