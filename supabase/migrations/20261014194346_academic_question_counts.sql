-- Finalize the approved question counts for the academic pilot.
-- Lesson attempts contain 5 questions; grade-final exams contain 25.
insert into public.academy_settings (setting_key, setting_value, updated_at)
values
  ('questions_per_attempt', '5'::jsonb, now()),
  ('questions_per_grade_exam', '25'::jsonb, now())
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = excluded.updated_at;
