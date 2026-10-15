-- Poké Study role-based access control for community identities.
-- Every existing identity starts as a regular user. Privileged roles are granted only by an existing administrator
-- or through a deliberate, verified one-time bootstrap in Supabase.

alter table public.community_identities
  add column if not exists role text not null default 'utente';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_identities_role_check'
      and conrelid = 'public.community_identities'::regclass
  ) then
    alter table public.community_identities
      add constraint community_identities_role_check
      check (role in ('utente', 'collaboratore_autorizzato', 'moderatore', 'amministratore'));
  end if;
end
$$;

create table if not exists public.community_admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.community_identities(id) on delete restrict,
  target_id uuid not null references public.community_identities(id) on delete restrict,
  old_role text not null check (old_role in ('utente', 'collaboratore_autorizzato', 'moderatore', 'amministratore')),
  new_role text not null check (new_role in ('utente', 'collaboratore_autorizzato', 'moderatore', 'amministratore')),
  created_at timestamptz not null default now()
);

create index if not exists community_admin_audit_log_created_at_idx
  on public.community_admin_audit_log (created_at desc);

alter table public.community_admin_audit_log enable row level security;
revoke all on table public.community_admin_audit_log from anon, authenticated;
grant all on table public.community_admin_audit_log to service_role;

create or replace function public.admin_set_community_role(
  p_actor_id uuid,
  p_target_id uuid,
  p_new_role text
)
returns table(target_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_old_role text;
  v_admin_count bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('poke-study-community-role-admin', 0));

  select ci.role into v_actor_role
  from public.community_identities ci
  where ci.id = p_actor_id;

  if v_actor_role is distinct from 'amministratore' then
    raise exception 'Operazione riservata agli amministratori.';
  end if;

  if p_new_role not in ('utente', 'collaboratore_autorizzato', 'moderatore', 'amministratore') then
    raise exception 'Ruolo non valido.';
  end if;

  if p_actor_id = p_target_id then
    raise exception 'Non puoi modificare il tuo stesso ruolo.';
  end if;

  select ci.role into v_old_role
  from public.community_identities ci
  where ci.id = p_target_id
  for update;

  if not found then
    raise exception 'Identità di destinazione non trovata.';
  end if;

  if v_old_role = p_new_role then
    return query select p_target_id, p_new_role;
    return;
  end if;

  if v_old_role = 'amministratore' and p_new_role <> 'amministratore' then
    select count(*) into v_admin_count
    from public.community_identities ci
    where ci.role = 'amministratore';

    if v_admin_count <= 1 then
      raise exception 'Non è possibile rimuovere l’ultimo amministratore.';
    end if;
  end if;

  update public.community_identities
  set role = p_new_role
  where id = p_target_id;

  insert into public.community_admin_audit_log (actor_id, target_id, old_role, new_role)
  values (p_actor_id, p_target_id, v_old_role, p_new_role);

  return query select p_target_id, p_new_role;
end;
$$;

revoke all on function public.admin_set_community_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_community_role(uuid, uuid, text) to service_role;
