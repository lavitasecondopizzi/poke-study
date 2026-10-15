-- Keep the database academy constraint aligned with the supported enrollment options.
alter table public.community_identities
  drop constraint if exists community_identities_academy_check;

alter table public.community_identities
  add constraint community_identities_academy_check
  check (academy = any (array['arancia'::text, 'uva'::text, 'mirtillo'::text]));
