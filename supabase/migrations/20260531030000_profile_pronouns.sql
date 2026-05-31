-- plus1 optional profile pronouns

alter table profiles
  add column if not exists pronouns text;
