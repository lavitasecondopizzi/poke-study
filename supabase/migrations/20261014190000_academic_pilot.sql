-- Academic pilot: Scienze Pokémon e Pokédex, Grado I.
-- Browser access is restricted to the academy Edge Function. Do not expose answer keys to clients.
create table if not exists public.academy_grades (
  grade_number smallint primary key check (grade_number between 1 and 4),
  title text not null
);

create table if not exists public.academy_subjects (
  subject_code text primary key,
  title text not null,
  description text not null
);

create table if not exists public.academy_grade_subjects (
  grade_number smallint not null references public.academy_grades(grade_number),
  subject_code text not null references public.academy_subjects(subject_code),
  weight smallint not null check (weight between 1 and 3),
  primary key (grade_number, subject_code)
);

create table if not exists public.academy_lessons (
  lesson_code text primary key,
  grade_number smallint not null,
  subject_code text not null,
  order_index smallint not null check (order_index > 0),
  title text not null,
  summary text not null,
  objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array'),
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  version integer not null default 1 check (version > 0),
  is_published boolean not null default false,
  unique (grade_number, subject_code, order_index),
  foreign key (grade_number, subject_code)
    references public.academy_grade_subjects(grade_number, subject_code)
);

create table if not exists public.academy_questions (
  question_id text primary key,
  lesson_code text not null references public.academy_lessons(lesson_code) on delete restrict,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'matching', 'ordering', 'visual_identification', 'scenario')),
  prompt text not null,
  media_url text check (media_url is null or media_url ~ '^https?://'),
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_answer jsonb not null,
  explanation text not null,
  source_title text not null,
  source_url text not null check (source_url ~ '^https?://'),
  source_checked_at date not null,
  difficulty text not null check (difficulty in ('facile', 'media', 'difficile')),
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true
);

create index if not exists academy_questions_lesson_active_idx
  on public.academy_questions (lesson_code, difficulty) where is_active;

create table if not exists public.academy_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Provisional technical default only; the final question count remains an open decision
-- and must be confirmed before acceptance testing.
insert into public.academy_settings (setting_key, setting_value)
values ('questions_per_attempt', '5'::jsonb)
on conflict (setting_key) do nothing;

insert into public.academy_settings (setting_key, setting_value)
values ('questions_per_grade_exam', '20'::jsonb)
on conflict (setting_key) do nothing;

create table if not exists public.academy_attempts (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.community_identities(id) on delete restrict,
  lesson_code text references public.academy_lessons(lesson_code) on delete restrict,
  grade_number smallint not null default 1 references public.academy_grades(grade_number),
  attempt_kind text not null default 'lesson' check (attempt_kind in ('lesson', 'grade_exam')),
  grading_rule_version text not null default 'thirtieths-v1',
  grade_max smallint not null default 30 check (grade_max between 1 and 30),
  pass_threshold smallint not null default 18 check (pass_threshold between 1 and 30),
  client_attempt_key text not null,
  status text not null default 'started' check (status in ('started', 'submitted')),
  question_snapshot jsonb not null check (jsonb_typeof(question_snapshot) = 'array'),
  question_count smallint not null check (question_count > 0),
  correct_count smallint,
  score smallint check (score between 1 and 30),
  passed boolean,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (identity_id, client_attempt_key),
  check ((attempt_kind = 'lesson' and lesson_code is not null) or (attempt_kind = 'grade_exam' and lesson_code is null)),
  check (
    (status = 'started' and submitted_at is null and score is null and passed is null)
    or
    (status = 'submitted' and submitted_at is not null and score is not null and passed is not null and correct_count is not null)
  )
);

create index if not exists academy_attempts_identity_lesson_created_idx
  on public.academy_attempts (identity_id, lesson_code, created_at desc);

create table if not exists public.academy_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.academy_attempts(id) on delete restrict,
  question_id text not null,
  question_version integer not null check (question_version > 0),
  answer jsonb,
  is_correct boolean not null,
  explanation_snapshot text not null,
  source_title_snapshot text not null,
  source_url_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);


create or replace function public.get_academy_progress(p_identity_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lesson_averages as (
    select
      l.lesson_code,
      avg(a.score)::numeric as average_score,
      count(a.id)::integer as attempt_count
    from public.academy_lessons l
    left join public.academy_attempts a
      on a.lesson_code = l.lesson_code
      and a.identity_id = p_identity_id
      and a.attempt_kind = 'lesson'
      and a.status = 'submitted'
    where l.grade_number = 1
      and l.subject_code = 'pokemon-sciences'
      and l.is_published = true
    group by l.lesson_code
  ),
  grade_metrics as (
    select
      avg(average_score)::numeric as grade_average,
      bool_and(coalesce(average_score >= 18, false)) as lessons_passed
    from lesson_averages
  ),
  exam_metrics as (
    select
      avg(score)::numeric as exam_average,
      count(*)::integer as exam_attempt_count
    from public.academy_attempts
    where identity_id = p_identity_id
      and attempt_kind = 'grade_exam'
      and status = 'submitted'
  )
  select jsonb_build_object(
    'lessonAverages',
    coalesce((
      select jsonb_object_agg(
        lesson_code,
        jsonb_build_object('average', average_score, 'attemptCount', attempt_count)
      )
      from lesson_averages
      where attempt_count > 0
    ), '{}'::jsonb),
    'gradeAverage', grade_metrics.grade_average,
    'gradeLessonsPassed', coalesce(grade_metrics.lessons_passed, false),
    'gradeExamAverage', exam_metrics.exam_average,
    'gradeExamAttemptCount', coalesce(exam_metrics.exam_attempt_count, 0),
    'gradeExamPassed', coalesce(exam_metrics.exam_average >= 26, false),
    'gradePassed',
      coalesce(grade_metrics.lessons_passed, false)
      and coalesce(grade_metrics.grade_average >= 26, false)
      and coalesce(exam_metrics.exam_average >= 26, false)
  )
  from grade_metrics cross join exam_metrics;
$$;

revoke all on function public.get_academy_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_academy_progress(uuid) to service_role;

create or replace function public.submit_academy_attempt(
  p_identity_id uuid,
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.academy_attempts%rowtype;
  v_question jsonb;
  v_answer jsonb;
  v_question_id text;
  v_is_correct boolean;
  v_correct_count integer := 0;
  v_total integer;
  v_score integer;
  v_passed boolean;
begin
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Le risposte devono essere un array JSON.';
  end if;

  select * into v_attempt
  from public.academy_attempts
  where id = p_attempt_id and identity_id = p_identity_id
  for update;

  if not found then
    raise exception 'Tentativo non trovato per questa identità.';
  end if;
  if v_attempt.status <> 'started' then
    raise exception 'Questo tentativo è già stato consegnato.';
  end if;

  v_total := jsonb_array_length(v_attempt.question_snapshot);
  if v_total = 0 or jsonb_array_length(p_answers) <> v_total then
    raise exception 'Il numero di risposte non corrisponde alle domande del tentativo.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) a
    group by a->>'questionId'
    having count(*) > 1
  ) then
    raise exception 'Una domanda compare più volte nelle risposte.';
  end if;

  for v_question in
    select value from jsonb_array_elements(v_attempt.question_snapshot)
  loop
    v_question_id := v_question->>'questionId';
    select value into v_answer
    from jsonb_array_elements(p_answers)
    where value->>'questionId' = v_question_id;

    if not found then
      raise exception 'Manca una risposta per una domanda del tentativo.';
    end if;

    v_is_correct := (v_answer->'answer') = (v_question->'correctAnswer');
    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    insert into public.academy_attempt_answers (
      attempt_id, question_id, question_version, answer, is_correct,
      explanation_snapshot, source_title_snapshot, source_url_snapshot
    ) values (
      v_attempt.id,
      v_question_id,
      (v_question->>'version')::integer,
      v_answer->'answer',
      v_is_correct,
      v_question->>'explanation',
      v_question->>'sourceTitle',
      v_question->>'sourceUrl'
    );
  end loop;

  -- The application uses integer grades from 1 to 30; averages may be decimal.
  v_score := greatest(1, least(v_attempt.grade_max, round(v_attempt.grade_max::numeric * v_correct_count / v_total)::integer));
  v_passed := v_score >= v_attempt.pass_threshold;

  update public.academy_attempts
  set status = 'submitted',
      correct_count = v_correct_count,
      score = v_score,
      passed = v_passed,
      submitted_at = now()
  where id = v_attempt.id and status = 'started';

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'score', v_score,
    'gradingRuleVersion', v_attempt.grading_rule_version,
    'gradeMax', v_attempt.grade_max,
    'passThreshold', v_attempt.pass_threshold,
    'correctCount', v_correct_count,
    'questionCount', v_total,
    'passed', v_passed,
    'submittedAt', now()
  );
end;
$$;

create or replace function public.prevent_academy_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Lo storico accademico non può essere eliminato.';
  end if;
  if TG_TABLE_NAME = 'academy_attempts' and OLD.status = 'submitted' then
    raise exception 'Un tentativo consegnato è immutabile.';
  end if;
  if TG_TABLE_NAME = 'academy_attempt_answers' then
    raise exception 'Le risposte storiche sono immutabili.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists academy_attempts_immutable on public.academy_attempts;
create trigger academy_attempts_immutable
before update or delete on public.academy_attempts
for each row execute function public.prevent_academy_history_mutation();

drop trigger if exists academy_attempt_answers_immutable on public.academy_attempt_answers;
create trigger academy_attempt_answers_immutable
before update or delete on public.academy_attempt_answers
for each row execute function public.prevent_academy_history_mutation();

-- Browser roles cannot read lesson answer keys or mutate academic history directly.
alter table public.academy_grades enable row level security;
alter table public.academy_subjects enable row level security;
alter table public.academy_grade_subjects enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_questions enable row level security;
alter table public.academy_settings enable row level security;
alter table public.academy_attempts enable row level security;
alter table public.academy_attempt_answers enable row level security;

revoke all on public.academy_grades, public.academy_subjects, public.academy_grade_subjects,
  public.academy_lessons, public.academy_questions, public.academy_settings,
  public.academy_attempts, public.academy_attempt_answers from anon, authenticated;

grant all on public.academy_grades, public.academy_subjects, public.academy_grade_subjects,
  public.academy_lessons, public.academy_questions, public.academy_settings,
  public.academy_attempts, public.academy_attempt_answers to service_role;

revoke all on function public.submit_academy_attempt(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_academy_attempt(uuid, uuid, jsonb) to service_role;

insert into public.academy_grades (grade_number, title) values
  (1, 'Grado I — Fondamenti'),
  (2, 'Grado II — Conoscenza e relazioni'),
  (3, 'Grado III — Applicazione'),
  (4, 'Grado IV — Sintesi e approfondimento')
on conflict (grade_number) do nothing;

insert into public.academy_subjects (subject_code, title, description) values
  ('pokemon-sciences', 'Scienze Pokémon e Pokédex', 'Specie, forme, tipi, abilità, evoluzioni e classificazione.')
on conflict (subject_code) do nothing;

insert into public.academy_grade_subjects (grade_number, subject_code, weight) values
  (1, 'pokemon-sciences', 2)
on conflict (grade_number, subject_code) do nothing;

insert into public.academy_lessons (
  lesson_code, grade_number, subject_code, order_index, title, summary, objectives, content, version, is_published
) values
(
  'psd1-identita-specie', 1, 'pokemon-sciences', 1,
  'Specie, Pokédex e dati identificativi',
  'Impara a distinguere una specie Pokémon dai dati che la descrivono nel Pokédex.',
  '["Distinguere il nome di una specie dalla sua voce nel Pokédex","Interpretare numero nazionale, altezza, peso e categoria","Riconoscere che i dati possono variare tra giochi e fonti"]'::jsonb,
  '[{"title":"Specie e voce del Pokédex","body":"Una specie è un’entità del mondo Pokémon, mentre una voce del Pokédex è una registrazione che raccoglie informazioni su quella specie in uno specifico contesto di gioco o catalogo. Il numero del Pokédex Nazionale è un identificatore ordinato, non una misura di forza."},{"title":"Leggere i dati","body":"Nome, numero, categoria, altezza e peso descrivono aspetti diversi. Altezza e peso non indicano da soli quanto un Pokémon sia efficace in lotta. Per confrontare dati è necessario considerare gioco, forma e fonte."},{"title":"Fonti e contesto","body":"Le voci del Pokédex possono avere descrizioni differenti tra versioni. Quando una domanda riguarda un dato variabile, deve specificare il gioco o la fonte utilizzata."}]'::jsonb,
  1, true
),
(
  'psd1-tipi-classificazione', 1, 'pokemon-sciences', 2,
  'Tipi Pokémon e classificazione',
  'Comprendi cosa rappresentano i tipi e come leggere la classificazione di una specie.',
  '["Identificare i tipi di una specie","Distinguere il tipo dalla categoria del Pokédex","Capire che il tipo non coincide con il ruolo competitivo"]'::jsonb,
  '[{"title":"Tipi","body":"I tipi sono attributi di gioco che contribuiscono alle interazioni tra mosse e Pokémon. Una specie può avere un solo tipo o due tipi, a seconda della sua forma e delle regole del gioco."},{"title":"Tipo e categoria","body":"Il tipo, come Acqua o Fuoco, non è la stessa cosa della categoria descrittiva della voce Pokédex. Anche il ruolo in squadra o nel competitivo è un concetto distinto e dipende da statistiche, mosse, abilità, formato e strategia."},{"title":"Forme e giochi","body":"Alcuni Pokémon possono avere tipi differenti in forme o contesti diversi. Per questo una risposta accurata deve indicare la forma e, se necessario, il gioco di riferimento."}]'::jsonb,
  1, true
),
(
  'psd1-forme-evoluzioni', 1, 'pokemon-sciences', 3,
  'Forme, evoluzioni e identità',
  'Distingui una specie, una forma alternativa e una fase evolutiva.',
  '["Distinguere forme regionali e specie diverse","Descrivere una linea evolutiva","Riconoscere che non tutte le specie evolvono"]'::jsonb,
  '[{"title":"Evoluzione","body":"L’evoluzione è una trasformazione di gioco che porta un Pokémon a una fase successiva della propria linea evolutiva. Le condizioni possono includere livello, strumenti, amicizia, scambi, luoghi o altri requisiti specifici."},{"title":"Forme alternative","body":"Una forma alternativa può modificare aspetto e, in alcuni casi, tipi, statistiche o abilità senza essere necessariamente una specie distinta. Le forme regionali sono legate a specifiche regioni e possono avere caratteristiche diverse dalla forma originaria."},{"title":"Verificare il contesto","body":"Per classificare correttamente un Pokémon occorre distinguere specie, forma e fase evolutiva. Non tutte le specie hanno evoluzioni e non ogni cambiamento di forma è un’evoluzione."}]'::jsonb,
  1, true
)
on conflict (lesson_code) do nothing;

insert into public.academy_questions (
  question_id, lesson_code, question_type, prompt, options, correct_answer, explanation,
  source_title, source_url, source_checked_at, difficulty, version, is_active
) values
('psd1-q001','psd1-identita-specie','multiple_choice','Che cosa identifica principalmente il numero del Pokédex Nazionale?','[{"id":"a","label":"L’ordine identificativo della voce nel catalogo nazionale"},{"id":"b","label":"La forza in lotta"},{"id":"c","label":"Il livello del Pokémon"},{"id":"d","label":"La rarità di una carta TCG"}]'::jsonb,'"a"'::jsonb,'Il numero nazionale identifica la posizione della specie nel catalogo; non misura forza, livello o rarità di una carta.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q002','psd1-identita-specie','multiple_choice','Quale dato non è, da solo, una misura diretta della forza in lotta?','[{"id":"a","label":"Il peso"},{"id":"b","label":"La statistica Attacco"},{"id":"c","label":"La statistica Difesa"},{"id":"d","label":"La statistica Velocità"}]'::jsonb,'"a"'::jsonb,'Il peso è un dato descrittivo e può essere rilevante per alcune mosse, ma non determina da solo la forza complessiva.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q003','psd1-identita-specie','true_false','Una voce del Pokédex può avere descrizioni diverse tra giochi o versioni.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"true"'::jsonb,'Le descrizioni possono cambiare tra titoli e versioni; le domande sui dettagli variabili devono indicare il contesto.','Pokémon Database — Pokédex entries','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q004','psd1-identita-specie','multiple_choice','Per confrontare con precisione un dato Pokédex variabile, che cosa è più utile specificare?','[{"id":"a","label":"Il gioco o la fonte di riferimento"},{"id":"b","label":"Il colore preferito dello studente"},{"id":"c","label":"Il prezzo di una console"},{"id":"d","label":"Il numero di carte possedute"}]'::jsonb,'"a"'::jsonb,'Il contesto della fonte permette di interpretare correttamente differenze tra versioni.','Pokémon Database — Pokédex entries','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q005','psd1-identita-specie','multiple_choice','Quale affermazione distingue correttamente una specie dalla voce del Pokédex?','[{"id":"a","label":"La specie è l’entità; la voce è una registrazione informativa in un contesto"},{"id":"b","label":"Sono sempre due nomi per una carta"},{"id":"c","label":"La voce è il livello del Pokémon"},{"id":"d","label":"La specie è il numero nazionale"}]'::jsonb,'"a"'::jsonb,'La specie e la sua registrazione informativa sono concetti distinti.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q006','psd1-identita-specie','true_false','Il numero del Pokédex Nazionale è una classifica dal Pokémon più forte al più debole.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'La numerazione è identificativa e ordinata, non una graduatoria competitiva.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q007','psd1-identita-specie','multiple_choice','Altezza e peso vanno interpretati come:','[{"id":"a","label":"Dati descrittivi della specie o forma"},{"id":"b","label":"Un voto scolastico"},{"id":"c","label":"Il costo di evoluzione"},{"id":"d","label":"Il numero di mosse disponibili"}]'::jsonb,'"a"'::jsonb,'Altezza e peso sono dati descrittivi; il loro significato meccanico dipende dalle regole del gioco.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q008','psd1-identita-specie','multiple_choice','Una domanda su una descrizione Pokédex che cambia tra giochi dovrebbe:','[{"id":"a","label":"Indicare il gioco o la versione pertinente"},{"id":"b","label":"Ignorare tutte le fonti"},{"id":"c","label":"Usare sempre il gioco più recente senza dirlo"},{"id":"d","label":"Accettare risposte casuali"}]'::jsonb,'"a"'::jsonb,'Specificare il contesto evita ambiguità e rende verificabile la risposta.','Pokémon Database — Pokédex entries','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q009','psd1-identita-specie','true_false','Altezza e peso, da soli, permettono di determinare il valore competitivo complessivo di un Pokémon.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'Il rendimento dipende da molte variabili di gioco e dal formato, non da una singola misura fisica.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q010','psd1-identita-specie','multiple_choice','Quale informazione dovrebbe accompagnare una domanda con dati variabili?','[{"id":"a","label":"La fonte consultata e il relativo contesto"},{"id":"b","label":"Solo un’opinione personale"},{"id":"c","label":"Un premio casuale"},{"id":"d","label":"Nessun riferimento"}]'::jsonb,'"a"'::jsonb,'Le fonti e il contesto rendono il quesito controllabile e aggiornabile.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','difficile',1,true),

('psd1-q011','psd1-tipi-classificazione','multiple_choice','Che cosa descrive principalmente il tipo di un Pokémon?','[{"id":"a","label":"Un attributo di gioco che influenza le interazioni con le mosse"},{"id":"b","label":"Il prezzo di mercato"},{"id":"c","label":"Il numero nazionale"},{"id":"d","label":"La lingua della carta"}]'::jsonb,'"a"'::jsonb,'I tipi sono attributi di gioco che partecipano alle interazioni tra mosse e Pokémon.','Pokémon Database — Type chart','https://pokemondb.net/type',date '2026-10-14','facile',1,true),
('psd1-q012','psd1-tipi-classificazione','multiple_choice','Quale distinzione è corretta?','[{"id":"a","label":"Tipo e categoria Pokédex sono concetti differenti"},{"id":"b","label":"Tipo e categoria sono sempre sinonimi"},{"id":"c","label":"La categoria è il voto della materia"},{"id":"d","label":"Il tipo è il numero di carte nel set"}]'::jsonb,'"a"'::jsonb,'Il tipo è un attributo di gioco; la categoria Pokédex è un’etichetta descrittiva.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q013','psd1-tipi-classificazione','true_false','Un Pokémon può avere due tipi contemporaneamente.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"true"'::jsonb,'Molte specie o forme hanno due tipi; altre ne hanno uno solo.','Pokémon Database — Type chart','https://pokemondb.net/type',date '2026-10-14','facile',1,true),
('psd1-q014','psd1-tipi-classificazione','multiple_choice','Il ruolo competitivo di un Pokémon dipende:','[{"id":"a","label":"Da più fattori, tra cui statistiche, mosse, abilità, formato e strategia"},{"id":"b","label":"Soltanto dal suo tipo"},{"id":"c","label":"Soltanto dal numero nazionale"},{"id":"d","label":"Soltanto dal peso"}]'::jsonb,'"a"'::jsonb,'Il ruolo competitivo emerge dalla combinazione delle caratteristiche e dal formato considerato.','Smogon — Strategy Pokédex','https://www.smogon.com/dex/',date '2026-10-14','media',1,true),
('psd1-q015','psd1-tipi-classificazione','true_false','Tipo e ruolo competitivo sono la stessa cosa.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'Il tipo è una caratteristica; il ruolo competitivo è una valutazione contestuale di squadra e formato.','Smogon — Strategy Pokédex','https://www.smogon.com/dex/',date '2026-10-14','facile',1,true),
('psd1-q016','psd1-tipi-classificazione','multiple_choice','Quando una forma alternativa cambia tipo, la domanda dovrebbe specificare:','[{"id":"a","label":"La forma e il contesto di gioco"},{"id":"b","label":"Il nome del proprietario della console"},{"id":"c","label":"Il prezzo del gioco"},{"id":"d","label":"Il numero di pagine del manuale"}]'::jsonb,'"a"'::jsonb,'Le caratteristiche possono dipendere dalla forma e dal gioco di riferimento.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q017','psd1-tipi-classificazione','multiple_choice','Quale tra questi è un tipo Pokémon?','[{"id":"a","label":"Acqua"},{"id":"b","label":"Rarità"},{"id":"c","label":"Espansione"},{"id":"d","label":"Grading"}]'::jsonb,'"a"'::jsonb,'Acqua è uno dei tipi del sistema di gioco; rarità, espansione e grading sono concetti del TCG.','Pokémon Database — Type chart','https://pokemondb.net/type',date '2026-10-14','facile',1,true),
('psd1-q018','psd1-tipi-classificazione','true_false','Un Pokémon con due tipi ha sempre il doppio della potenza di un Pokémon con un solo tipo.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'Il numero di tipi non determina una moltiplicazione generale della potenza; le interazioni dipendono dalle regole delle mosse e dai tipi coinvolti.','Pokémon Database — Type chart','https://pokemondb.net/type',date '2026-10-14','difficile',1,true),
('psd1-q019','psd1-tipi-classificazione','multiple_choice','Quale fonte è utile per controllare le relazioni di efficacia tra tipi?','[{"id":"a","label":"Una tabella delle interazioni tra tipi riferita al gioco pertinente"},{"id":"b","label":"Un listino prezzi di carte"},{"id":"c","label":"Una classifica di vendite"},{"id":"d","label":"Un elenco di nickname"}]'::jsonb,'"a"'::jsonb,'Una tabella dei tipi documenta le interazioni; bisogna comunque considerare il gioco e le regole specifiche.','Pokémon Database — Type chart','https://pokemondb.net/type',date '2026-10-14','media',1,true),
('psd1-q020','psd1-tipi-classificazione','multiple_choice','La categoria Pokédex serve soprattutto a:','[{"id":"a","label":"Fornire un’etichetta descrittiva della specie"},{"id":"b","label":"Stabilire il prezzo di ogni carta"},{"id":"c","label":"Assegnare il voto finale"},{"id":"d","label":"Determinare la rarità del set"}]'::jsonb,'"a"'::jsonb,'La categoria è una descrizione testuale e non equivale al tipo, al voto o alla rarità.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),

('psd1-q021','psd1-forme-evoluzioni','multiple_choice','Che cosa descrive più correttamente un’evoluzione Pokémon?','[{"id":"a","label":"Una trasformazione verso una fase successiva della linea evolutiva"},{"id":"b","label":"Un cambio di lingua della carta"},{"id":"c","label":"Un aumento del numero nazionale"},{"id":"d","label":"Un cambio del prezzo di mercato"}]'::jsonb,'"a"'::jsonb,'L’evoluzione è una trasformazione di gioco che conduce a una fase successiva della linea evolutiva.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','facile',1,true),
('psd1-q022','psd1-forme-evoluzioni','true_false','Ogni specie Pokémon possiede necessariamente almeno un’evoluzione.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'Esistono specie senza evoluzioni e specie che rappresentano una fase finale.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','facile',1,true),
('psd1-q023','psd1-forme-evoluzioni','multiple_choice','Quale può essere una condizione di evoluzione, a seconda della specie e del gioco?','[{"id":"a","label":"Livello, strumento, scambio o requisito specifico"},{"id":"b","label":"Sempre e soltanto il peso"},{"id":"c","label":"Il numero di carte possedute"},{"id":"d","label":"Il voto scolastico"}]'::jsonb,'"a"'::jsonb,'Le condizioni evolutive variano e possono includere livello, strumenti, scambi e requisiti specifici.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','media',1,true),
('psd1-q024','psd1-forme-evoluzioni','multiple_choice','Una forma alternativa è:','[{"id":"a","label":"Una variante di una specie, non necessariamente una specie distinta"},{"id":"b","label":"Sempre una nuova specie numerata separatamente"},{"id":"c","label":"Una carta promozionale"},{"id":"d","label":"Un livello di difficoltà"}]'::jsonb,'"a"'::jsonb,'Le forme alternative possono cambiare aspetto e caratteristiche senza essere automaticamente specie diverse.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q025','psd1-forme-evoluzioni','true_false','Una forma regionale può avere caratteristiche differenti dalla forma originaria.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"true"'::jsonb,'Le forme regionali possono differire per aspetto, tipo e altre caratteristiche di gioco.','Pokémon Database — Regional forms','https://pokemondb.net/pokedex/national',date '2026-10-14','facile',1,true),
('psd1-q026','psd1-forme-evoluzioni','multiple_choice','Per classificare correttamente un Pokémon, quale distinzione è utile?','[{"id":"a","label":"Specie, forma e fase evolutiva"},{"id":"b","label":"Prezzo, lingua e rarità della carta"},{"id":"c","label":"Punti Poké, punti esame e saldo"},{"id":"d","label":"Solo il colore"}]'::jsonb,'"a"'::jsonb,'Specie, forma e posizione nella linea evolutiva sono concetti diversi e vanno distinti.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','media',1,true),
('psd1-q027','psd1-forme-evoluzioni','true_false','Ogni cambiamento di forma è automaticamente un’evoluzione.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"false"'::jsonb,'Forme alternative e evoluzioni sono meccanismi distinti, anche se alcune situazioni possono interagire con le regole del gioco.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','media',1,true),
('psd1-q028','psd1-forme-evoluzioni','multiple_choice','Quale dettaglio va verificato prima di affermare che una forma cambia tipo?','[{"id":"a","label":"La forma esatta e il gioco di riferimento"},{"id":"b","label":"Il prezzo della console"},{"id":"c","label":"Il numero di lezioni completate"},{"id":"d","label":"Il nickname dello studente"}]'::jsonb,'"a"'::jsonb,'I tipi possono dipendere dalla forma e dalle regole del titolo considerato.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','difficile',1,true),
('psd1-q029','psd1-forme-evoluzioni','multiple_choice','Qual è il modo più affidabile per descrivere una linea evolutiva?','[{"id":"a","label":"Indicare le specie coinvolte e le condizioni rilevanti"},{"id":"b","label":"Elencare soltanto i colori"},{"id":"c","label":"Usare il prezzo di una carta"},{"id":"d","label":"Supporre che tutte le linee siano uguali"}]'::jsonb,'"a"'::jsonb,'Le linee evolutive e le relative condizioni possono variare; è utile indicare i passaggi e il contesto.','Pokémon Database — Evolution','https://pokemondb.net/evolution',date '2026-10-14','difficile',1,true),
('psd1-q030','psd1-forme-evoluzioni','true_false','Una forma alternativa può mantenere la stessa specie ma differire in alcune caratteristiche.','[{"id":"true","label":"Vero"},{"id":"false","label":"Falso"}]'::jsonb,'"true"'::jsonb,'Le forme possono rappresentare varianti della stessa specie con caratteristiche diverse.','Pokémon Database — National Pokédex','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true)
on conflict (question_id) do nothing;


-- Additional formats used by the academic question engine.
update public.academy_questions
set question_type = 'visual_identification',
    prompt = 'Quale specie Pokémon è mostrata nell’immagine?',
    options = '[{"id":"bulbasaur","label":"Bulbasaur"},{"id":"ivysaur","label":"Ivysaur"},{"id":"venusaur","label":"Venusaur"},{"id":"charmander","label":"Charmander"}]'::jsonb,
    correct_answer = '"bulbasaur"'::jsonb,
    explanation = 'L’immagine mostra Bulbasaur, la specie numero 001 del Pokédex Nazionale. L’identificazione visiva va verificata insieme al numero e ai dati della specie.',
    source_title = 'PokéAPI Sprites',
    source_url = 'https://github.com/PokeAPI/sprites',
    media_url = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',
    difficulty = 'media'
where question_id = 'psd1-q007';

insert into public.academy_questions (
  question_id, lesson_code, question_type, prompt, options, correct_answer, explanation,
  source_title, source_url, source_checked_at, difficulty, version, is_active
) values
('psd1-q031','psd1-tipi-classificazione','matching','Abbina ogni concetto alla descrizione corretta.',
 '[{"id":"type","label":"Tipo","side":"left"},{"id":"category","label":"Categoria Pokédex","side":"left"},{"id":"evolution","label":"Evoluzione","side":"left"},{"id":"type-desc","label":"Attributo di gioco che influenza le interazioni con le mosse","side":"right"},{"id":"category-desc","label":"Etichetta descrittiva della specie","side":"right"},{"id":"evolution-desc","label":"Passaggio a una fase successiva della linea evolutiva","side":"right"}]'::jsonb,
 '{"type":"type-desc","category":"category-desc","evolution":"evolution-desc"}'::jsonb,
 'Il tipo è un attributo di gioco, la categoria Pokédex è una descrizione e l’evoluzione è un passaggio della linea evolutiva.',
 'Pokémon Database — National Pokédex and type chart','https://pokemondb.net/pokedex/national',date '2026-10-14','media',1,true),
('psd1-q032','psd1-forme-evoluzioni','ordering','Ordina le fasi della linea evolutiva dal primo stadio allo stadio finale.',
 '[{"id":"bulbasaur","label":"Bulbasaur"},{"id":"ivysaur","label":"Ivysaur"},{"id":"venusaur","label":"Venusaur"}]'::jsonb,
 '["bulbasaur","ivysaur","venusaur"]'::jsonb,
 'La linea evolutiva procede da Bulbasaur a Ivysaur e infine a Venusaur.',
 'Pokémon Database — Bulbasaur evolution chain','https://pokemondb.net/evolution',date '2026-10-14','facile',1,true),
('psd1-q033','psd1-identita-specie','scenario','Uno studente confronta due voci Pokédex con descrizioni diverse. Qual è il passo più corretto?',
 '[{"id":"a","label":"Verificare gioco, versione e fonte di ciascuna voce"},{"id":"b","label":"Considerare automaticamente una delle due falsa"},{"id":"c","label":"Scegliere la descrizione più lunga senza controlli"},{"id":"d","label":"Ignorare il contesto di gioco"}]'::jsonb,
 '"a"'::jsonb,
 'Le descrizioni possono variare tra titoli e versioni: il contesto della fonte è essenziale per un confronto corretto.',
 'Pokémon Database — Pokédex entries','https://pokemondb.net/pokedex/national',date '2026-10-14','difficile',1,true)
on conflict (question_id) do nothing;
