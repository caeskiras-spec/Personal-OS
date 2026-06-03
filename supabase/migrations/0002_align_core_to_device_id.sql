-- user_profiles
drop policy if exists "Users can manage own profile" on user_profiles;
alter table user_profiles disable row level security;
alter table user_profiles drop constraint if exists user_profiles_user_id_fkey;
alter table user_profiles alter column user_id type text using user_id::text;
alter table user_profiles alter column user_id set not null;
alter table user_profiles add constraint user_profiles_user_unique unique (user_id);

-- user_modules
drop policy if exists "Users can manage own modules" on user_modules;
alter table user_modules disable row level security;
alter table user_modules drop constraint if exists user_modules_user_id_fkey;
alter table user_modules alter column user_id type text using user_id::text;
alter table user_modules alter column user_id set not null;
alter table user_modules add constraint user_modules_user_module_unique unique (user_id, module_id);

-- module_data
drop policy if exists "Users can manage own data" on module_data;
alter table module_data disable row level security;
alter table module_data drop constraint if exists module_data_user_id_fkey;
alter table module_data alter column user_id type text using user_id::text;
alter table module_data alter column user_id set not null;

-- авто-обновление updated_at для module_data
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists module_data_set_updated_at on module_data;
create trigger module_data_set_updated_at
before update on module_data
for each row execute function set_updated_at();
