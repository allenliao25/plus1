-- plus1 profile handles
-- Move unique public identity from display names to Instagram-style handles.

alter table profiles
  add column if not exists handle text;

update profiles
set handle =
  left(
    coalesce(
      nullif(
        regexp_replace(
          trim(both '.' from regexp_replace(lower(coalesce(display_name, 'plus1')), '[^a-z0-9._]+', '.', 'g')),
          '[._]{2,}',
          '.',
          'g'
        ),
        ''
      ),
      'plus1'
    ),
    20
  ) || '.' || left(replace(id::text, '-', ''), 8)
where handle is null;

update profiles
set handle = 'plus1.' || left(replace(id::text, '-', ''), 8)
where handle is null or handle !~ '^[a-z0-9._]{3,30}$';

alter table profiles
  alter column handle set not null;

drop index if exists profiles_display_name_unique;
alter table profiles
  drop constraint if exists profiles_display_name_key;

create unique index if not exists profiles_handle_unique
  on profiles (handle);

alter table profiles
  drop constraint if exists profiles_handle_format_check;

alter table profiles
  add constraint profiles_handle_format_check
  check (handle ~ '^[a-z0-9._]{3,30}$');
