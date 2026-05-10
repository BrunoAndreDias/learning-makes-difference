alter table users
  add column user_time_zone text not null default 'UTC';
