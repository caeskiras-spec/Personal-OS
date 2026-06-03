alter table habits add column if not exists color         text;
alter table habits add column if not exists schedule      text    default 'daily';
alter table habits add column if not exists schedule_days int[]   default '{}';
alter table habits add column if not exists best_streak   int     default 0;
alter table habits add column if not exists position      int     default 0;
