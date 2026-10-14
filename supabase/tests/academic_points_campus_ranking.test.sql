-- Database-level regression tests for the academic points ledger.
-- Run against a disposable local Supabase database after applying all migrations:
--   supabase start
--   supabase test db
begin;

select plan(12);

create temporary table _academic_points_test_ids (
  identity_id uuid not null,
  lesson_attempt_id uuid not null,
  subject_attempt_id uuid not null,
  grade_attempt_id uuid not null
) on commit drop;

do $$
declare
  v_identity uuid;
  v_lesson_attempt uuid;
  v_subject_attempt uuid;
  v_grade_attempt uuid;
  v_key text;
begin
  insert into public.community_identities (nickname, academy, token_hash, matricola)
  values (
    'test-acad-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    'arancia',
    md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    'PS-2099-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  )
  returning id into v_identity;

  v_key := gen_random_uuid()::text;
  insert into public.academy_attempts (
    identity_id, lesson_code, subject_code, grade_number, attempt_kind,
    client_attempt_key, question_snapshot, question_count
  ) values (
    v_identity, 'psd1-identita-specie', 'pokemon-sciences', 1, 'lesson',
    v_key, '[]'::jsonb, 1
  ) returning id into v_lesson_attempt;

  v_key := gen_random_uuid()::text;
  insert into public.academy_attempts (
    identity_id, lesson_code, subject_code, grade_number, attempt_kind,
    client_attempt_key, question_snapshot, question_count
  ) values (
    v_identity, null, 'pokemon-sciences', 1, 'subject_exam',
    v_key, '[]'::jsonb, 1
  ) returning id into v_subject_attempt;

  v_key := gen_random_uuid()::text;
  insert into public.academy_attempts (
    identity_id, lesson_code, subject_code, grade_number, attempt_kind,
    client_attempt_key, question_snapshot, question_count
  ) values (
    v_identity, null, null, 1, 'grade_exam',
    v_key, '[]'::jsonb, 1
  ) returning id into v_grade_attempt;

  -- All three are intentionally insufficient: submission, not passing, earns points.
  update public.academy_attempts
  set status = 'submitted', score = 1, correct_count = 0, passed = false, submitted_at = now()
  where id in (v_lesson_attempt, v_subject_attempt, v_grade_attempt);

  insert into _academic_points_test_ids
    (identity_id, lesson_attempt_id, subject_attempt_id, grade_attempt_id)
  values (v_identity, v_lesson_attempt, v_subject_attempt, v_grade_attempt);
end;
$$;

select is(
  (select points::integer from public.academy_points_awards where attempt_id = (select lesson_attempt_id from _academic_points_test_ids)),
  1,
  'lesson submission awards exactly 1 academic point'
);
select is(
  (select points::integer from public.academy_points_awards where attempt_id = (select subject_attempt_id from _academic_points_test_ids)),
  3,
  'subject exam submission awards exactly 3 academic points'
);
select is(
  (select points::integer from public.academy_points_awards where attempt_id = (select grade_attempt_id from _academic_points_test_ids)),
  5,
  'grade exam submission awards exactly 5 academic points'
);
select is(
  (select count(*)::integer from public.academy_points_awards where identity_id = (select identity_id from _academic_points_test_ids)),
  3,
  'each submitted attempt creates one ledger row'
);
select ok(
  (select bool_and(a.score < a.pass_threshold and not a.passed)
   from public.academy_attempts a
   where a.id in (
     (select lesson_attempt_id from _academic_points_test_ids),
     (select subject_attempt_id from _academic_points_test_ids),
     (select grade_attempt_id from _academic_points_test_ids)
   )),
  'insufficient attempts are still eligible for their configured award'
);
select is(
  ((public.get_academy_points_summary((select identity_id from _academic_points_test_ids))->>'studentPoints')::integer),
  9,
  'individual academic balance sums the three awards'
);
select is(
  public.get_academy_points_summary((select identity_id from _academic_points_test_ids))->>'studentAcademy',
  'arancia',
  'individual summary reports the current academy'
);
select is(
  public.get_academy_points_summary((select identity_id from _academic_points_test_ids))->'campusRanking'->0->>'academy',
  'arancia',
  'campus ranking orders the campus with the highest total first'
);
select is(
  jsonb_array_length(public.get_academy_points_summary((select identity_id from _academic_points_test_ids))->'campusRanking'),
  3,
  'campus ranking includes all three campuses'
);
select throws_ok(
  $sql$insert into public.academy_points_awards (attempt_id, identity_id, academy, attempt_kind, points)
       select lesson_attempt_id, identity_id, 'arancia', 'lesson', 1 from _academic_points_test_ids$sql$,
  '23505',
  'a second ledger row for the same attempt is rejected'
);
select throws_ok(
  $sql$update public.academy_points_awards set points = 2
       where attempt_id = (select lesson_attempt_id from _academic_points_test_ids)$sql$,
  'P0001',
  'award history cannot be updated'
);
select throws_ok(
  $sql$delete from public.academy_points_awards
       where attempt_id = (select lesson_attempt_id from _academic_points_test_ids)$sql$,
  'P0001',
  'award history cannot be deleted'
);

select * from finish();
rollback;
