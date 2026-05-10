alter table users
  add column user_language text;

update users
set user_language = case interface_language
  when 'pt-BR' then 'pt-PT'
  when 'pt' then 'pt-PT'
  when 'pt-PT' then 'pt-PT'
  when 'es' then 'es'
  else 'en'
end;

alter table users
  alter column user_language set not null,
  alter column user_language set default 'en';

alter table users
  drop column interface_language,
  drop column study_language;
