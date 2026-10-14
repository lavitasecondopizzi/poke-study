-- Allow the official Blueberry Academy (Istituto Mirtillo) as a community identity.
alter table public.community_identities
  drop constraint if exists community_identities_academy_check;

alter table public.community_identities
  add constraint community_identities_academy_check
  check (academy in ('arancia', 'uva', 'mirtillo'));
