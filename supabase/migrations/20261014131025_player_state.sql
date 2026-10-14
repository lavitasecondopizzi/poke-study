-- Store the authoritative player profile and progress alongside the verified identity.
-- Browser roles still have no direct table access; reads/writes go through the Edge Function.
alter table public.community_identities
  add column if not exists player_profile jsonb,
  add column if not exists player_progress jsonb,
  add column if not exists player_state_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_identities_player_profile_object_check'
  ) then
    alter table public.community_identities
      add constraint community_identities_player_profile_object_check
      check (player_profile is null or jsonb_typeof(player_profile) = 'object');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_identities_player_progress_object_check'
  ) then
    alter table public.community_identities
      add constraint community_identities_player_progress_object_check
      check (player_progress is null or jsonb_typeof(player_progress) = 'object');
  end if;
end $$;

revoke all on table public.community_identities from anon, authenticated;
grant all on table public.community_identities to service_role;
