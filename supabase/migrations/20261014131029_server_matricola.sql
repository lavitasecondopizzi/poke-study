-- The matricola is an immutable server-issued part of the player identity.
alter table public.community_identities
  add column if not exists matricola text;

update public.community_identities
set matricola = 'PS-' || extract(year from created_at)::integer::text || '-' ||
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where matricola is null;

alter table public.community_identities
  alter column matricola set not null;

create unique index if not exists community_identities_matricola_uidx
  on public.community_identities (matricola);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_identities_matricola_format_check'
  ) then
    alter table public.community_identities
      add constraint community_identities_matricola_format_check
      check (matricola ~ '^PS-[0-9]{4}-[A-Z0-9]{6}$');
  end if;
end $$;
