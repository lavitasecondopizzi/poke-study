-- Poké Study community foundation.
-- Browser clients must access these tables only through the community Edge Function.
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY from the Supabase runtime environment.
create table if not exists public.community_identities (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(btrim(nickname)) between 2 and 24),
  academy text not null check (academy in ('arancia', 'uva')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists community_identities_nickname_lower_uidx
  on public.community_identities (lower(nickname));

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.community_identities(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 5 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  category text not null check (category in ('generale', 'domande', 'strategie', 'annunci')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forum_threads_created_at_idx
  on public.forum_threads (created_at desc);
create index if not exists forum_threads_category_created_at_idx
  on public.forum_threads (category, created_at desc);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  identity_id uuid not null references public.community_identities(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists forum_posts_thread_created_at_idx
  on public.forum_posts (thread_id, created_at asc);

create or replace function public.touch_forum_thread_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forum_threads_touch_updated_at on public.forum_threads;
create trigger forum_threads_touch_updated_at
before update on public.forum_threads
for each row execute function public.touch_forum_thread_updated_at();

-- No direct table access from browser roles. The Edge Function is the API boundary.
alter table public.community_identities enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;

revoke all on table public.community_identities from anon, authenticated;
revoke all on table public.forum_threads from anon, authenticated;
revoke all on table public.forum_posts from anon, authenticated;

grant all on table public.community_identities to service_role;
grant all on table public.forum_threads to service_role;
grant all on table public.forum_posts to service_role;
