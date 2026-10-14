-- Campus-scoped academic points, awarded once per submitted attempt.
alter table public.academy_attempts add column if not exists subject_code text references public.academy_subjects(subject_code);

update public.academy_attempts a
set subject_code = l.subject_code
from public.academy_lessons l
where a.lesson_code = l.lesson_code and a.subject_code is null;

alter table public.academy_lessons
  add constraint academy_lessons_lesson_subject_unique unique (lesson_code, subject_code);

alter table public.academy_attempts
  drop constraint if exists academy_attempts_attempt_kind_check,
  drop constraint if exists academy_attempts_check;

alter table public.academy_attempts
  add constraint academy_attempts_attempt_kind_check check (attempt_kind in ('lesson', 'subject_exam', 'grade_exam')),
  add constraint academy_attempts_kind_subject_check check (
    (attempt_kind = 'lesson' and lesson_code is not null and subject_code is not null)
    or (attempt_kind = 'subject_exam' and lesson_code is null and subject_code is not null)
    or (attempt_kind = 'grade_exam' and lesson_code is null and subject_code is null)
  ),
  add constraint academy_attempts_lesson_subject_fkey foreign key (lesson_code, subject_code)
    references public.academy_lessons (lesson_code, subject_code);

create table public.academy_points_awards (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.academy_attempts(id) on delete restrict,
  identity_id uuid not null references public.community_identities(id) on delete restrict,
  academy text not null check (academy in ('arancia', 'uva', 'mirtillo')),
  attempt_kind text not null check (attempt_kind in ('lesson', 'subject_exam', 'grade_exam')),
  points smallint not null check (
    (attempt_kind = 'lesson' and points = 1)
    or (attempt_kind = 'subject_exam' and points = 3)
    or (attempt_kind = 'grade_exam' and points = 5)
  ),
  created_at timestamptz not null default now()
);

create index academy_points_awards_identity_created_idx on public.academy_points_awards (identity_id, created_at desc);
create index academy_points_awards_academy_idx on public.academy_points_awards (academy);

create or replace function public.prevent_academic_points_award_mutation()
returns trigger language plpgsql set search_path = ''
as $
begin
  raise exception 'Lo storico dei punti accademici è immutabile.';
end;
$;

create trigger academy_points_awards_immutable
before update or delete on public.academy_points_awards
for each row execute function public.prevent_academic_points_award_mutation();

create or replace function public.award_academic_points_on_submission()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_academy text;
  v_points smallint;
begin
  if new.status <> 'submitted' or old.status = 'submitted' then return new; end if;
  v_points := case new.attempt_kind when 'lesson' then 1 when 'subject_exam' then 3 when 'grade_exam' then 5 end;
  select academy into v_academy from public.community_identities where id = new.identity_id;
  if v_academy is null then raise exception 'Missing valid academy for academic points award'; end if;
  insert into public.academy_points_awards (attempt_id, identity_id, academy, attempt_kind, points)
  values (new.id, new.identity_id, v_academy, new.attempt_kind, v_points)
  on conflict (attempt_id) do nothing;
  return new;
end;
$$;

create trigger academy_attempts_award_points
after update of status on public.academy_attempts
for each row when (old.status = 'started' and new.status = 'submitted')
execute function public.award_academic_points_on_submission();

alter table public.academy_points_awards enable row level security;
revoke all on public.academy_points_awards from anon, authenticated;
grant all on public.academy_points_awards to service_role;

create or replace function public.get_academy_points_summary(p_identity_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with campus_list(academy, title) as (
    values ('arancia'::text, 'Accademia Arancia'::text),
           ('uva'::text, 'Accademia Uva'::text),
           ('mirtillo'::text, 'Istituto Mirtillo'::text)
  ),
  campus_totals as (
    select c.academy, c.title, coalesce(sum(a.points), 0)::integer as points
    from campus_list c left join public.academy_points_awards a on a.academy = c.academy
    group by c.academy, c.title
  )
  select jsonb_build_object(
    'studentPoints', coalesce((select sum(points)::integer from public.academy_points_awards where identity_id = p_identity_id and academy = (select academy from public.community_identities where id = p_identity_id)), 0),
    'studentAcademy', (select academy from public.community_identities where id = p_identity_id),
    'campusRanking', coalesce((
      select jsonb_agg(jsonb_build_object('academy', academy, 'title', title, 'points', points)
        order by points desc, case academy when 'arancia' then 1 when 'uva' then 2 else 3 end)
      from campus_totals
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_academy_points_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_academy_points_summary(uuid) to service_role;


-- Configurable pilot defaults for the subject-final exam.
insert into public.academy_settings (setting_key, setting_value, updated_at)
values
  ('questions_per_subject_exam', '15'::jsonb, now())
on conflict (setting_key) do nothing;
