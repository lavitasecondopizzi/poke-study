import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type QuestionSnapshot = {
  questionId: string;
  lessonCode?: string;
  version: number;
  type: "multiple_choice" | "true_false";
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctAnswer: unknown;
  explanation: string;
  sourceTitle: string;
  sourceUrl: string;
  difficulty: "facile" | "media" | "difficile";
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function cleanAnswer(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "boolean" || value === null) return value;
  return null;
}

function publicQuestion(question: QuestionSnapshot) {
  return {
    questionId: question.questionId,
    version: question.version,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    difficulty: question.difficulty,
  };
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const bytes = crypto.getRandomValues(new Uint32Array(1));
    const j = bytes[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Metodo non consentito." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response(503, { error: "Il servizio accademico non è configurato." });
  }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return response(400, { error: "Richiesta JSON non valida." });
    input = parsed;
  } catch {
    return response(400, { error: "Richiesta JSON non valida." });
  }

  const token = typeof input.token === "string" ? input.token : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return response(401, { error: "Token account mancante o non valido." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const tokenHash = await hashToken(token);
    const { data: identity, error: identityError } = await supabase
      .from("community_identities")
      .select("id,nickname,matricola")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (identityError || !identity) return response(401, { error: "Identità account non riconosciuta." });

    const action = input.action;

    if (action === "get_curriculum") {
      const [{ data: lessons, error: lessonsError }, { data: subjects, error: subjectsError }, { data: attempts, error: attemptsError }, { data: progress, error: progressError }] = await Promise.all([
        supabase.from("academy_lessons")
          .select("lesson_code,grade_number,subject_code,order_index,title,summary,objectives,version")
          .eq("is_published", true)
          .eq("grade_number", 1)
          .eq("subject_code", "pokemon-sciences")
          .order("order_index", { ascending: true }),
        supabase.from("academy_subjects").select("subject_code,title,description"),
        supabase.from("academy_attempts")
          .select("id,lesson_code,grade_number,attempt_kind,status,score,passed,correct_count,question_count,created_at,submitted_at")
          .eq("identity_id", identity.id)
          .eq("status", "submitted")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.rpc("get_academy_progress", { p_identity_id: identity.id }),
      ]);

      if (lessonsError || subjectsError || attemptsError || progressError) {
        return response(500, { error: "Impossibile caricare il programma o lo storico accademico." });
      }
      const subjectMap = new Map((subjects ?? []).map(subject => [subject.subject_code, subject]));
      const enrichedLessons = (lessons ?? []).map(lesson => ({
        ...lesson,
        subject: subjectMap.get(lesson.subject_code) ?? null,
      }));
      return response(200, { lessons: enrichedLessons, attempts: attempts ?? [], progress: progress ?? null });
    }

    if (action === "get_lesson") {
      const lessonCode = typeof input.lessonCode === "string" ? input.lessonCode : "";
      const { data: lesson, error: lessonError } = await supabase.from("academy_lessons")
        .select("lesson_code,grade_number,subject_code,order_index,title,summary,objectives,content,version")
        .eq("lesson_code", lessonCode)
        .eq("is_published", true)
        .maybeSingle();
      if (lessonError || !lesson) return response(404, { error: "Lezione non trovata o non pubblicata." });

      const [{ data: attempts, error: attemptsError }, { data: progress, error: progressError }] = await Promise.all([
        supabase.from("academy_attempts")
          .select("id,lesson_code,attempt_kind,status,score,passed,correct_count,question_count,created_at,submitted_at")
          .eq("identity_id", identity.id)
          .eq("attempt_kind", "lesson")
          .eq("lesson_code", lessonCode)
          .eq("status", "submitted")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.rpc("get_academy_progress", { p_identity_id: identity.id }),
      ]);
      if (attemptsError || progressError) return response(500, { error: "Impossibile caricare lo storico della lezione." });
      const progressRecord = isRecord(progress) ? progress : {};
      const averages = isRecord(progressRecord.lessonAverages) ? progressRecord.lessonAverages : {};
      const lessonSummary = isRecord(averages[lessonCode]) ? averages[lessonCode] : {};
      return response(200, {
        lesson,
        attempts: attempts ?? [],
        lessonAverage: typeof lessonSummary.average === "number" ? lessonSummary.average : null,
        attemptCount: typeof lessonSummary.attemptCount === "number" ? lessonSummary.attemptCount : 0,
      });
    }

    if (action === "start_attempt") {
      const lessonCode = typeof input.lessonCode === "string" ? input.lessonCode : "";
      const clientAttemptKey = typeof input.clientAttemptKey === "string" ? input.clientAttemptKey : "";
      if (!/^[0-9a-f-]{36}$/i.test(clientAttemptKey)) {
        return response(400, { error: "Chiave del tentativo non valida." });
      }

      const { data: existing } = await supabase.from("academy_attempts")
        .select("id,status,question_snapshot,score,passed,correct_count,question_count,submitted_at")
        .eq("identity_id", identity.id)
        .eq("client_attempt_key", clientAttemptKey)
        .maybeSingle();
      if (existing) {
        if (existing.status !== "started") return response(409, { error: "Questo tentativo è già stato consegnato." });
        const snapshot = existing.question_snapshot as QuestionSnapshot[];
        return response(200, {
          attemptId: existing.id,
          questions: snapshot.map(publicQuestion),
          questionCount: snapshot.length,
        });
      }

      const { data: lesson, error: lessonError } = await supabase.from("academy_lessons")
        .select("lesson_code,grade_number,subject_code,order_index")
        .eq("lesson_code", lessonCode)
        .eq("is_published", true)
        .maybeSingle();
      if (lessonError || !lesson) return response(404, { error: "Lezione non trovata o non pubblicata." });

      const { data: previousLessons, error: previousError } = await supabase.from("academy_lessons")
        .select("lesson_code,order_index")
        .eq("grade_number", lesson.grade_number)
        .eq("subject_code", lesson.subject_code)
        .eq("is_published", true)
        .lt("order_index", lesson.order_index)
        .order("order_index", { ascending: true });
      if (previousError) return response(500, { error: "Impossibile verificare i prerequisiti della lezione." });

      for (const previous of previousLessons ?? []) {
        const { data: history, error: historyError } = await supabase.from("academy_attempts")
          .select("score")
          .eq("identity_id", identity.id)
          .eq("lesson_code", previous.lesson_code)
          .eq("status", "submitted");
        if (historyError) return response(500, { error: "Impossibile verificare i prerequisiti della lezione." });
        if (!history?.length || history.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / history.length < 18) {
          return response(403, { error: "Supera la lezione precedente con una media di almeno 18/30 per continuare." });
        }
      }

      const { data: questionRows, error: questionsError } = await supabase.from("academy_questions")
        .select("question_id,question_type,prompt,options,correct_answer,explanation,source_title,source_url,difficulty,version")
        .eq("lesson_code", lessonCode)
        .eq("is_active", true);
      if (questionsError) return response(500, { error: "Impossibile caricare le domande." });
      if (!questionRows?.length) return response(409, { error: "Questa lezione non ha ancora domande pubblicate." });

      const { data: setting } = await supabase.from("academy_settings")
        .select("setting_value")
        .eq("setting_key", "questions_per_attempt")
        .maybeSingle();
      const configuredCount = Number(setting?.setting_value ?? 5);
      const questionCount = Number.isSafeInteger(configuredCount) && configuredCount > 0 ? configuredCount : 5;
      const targetCount = Math.min(questionCount, questionRows.length);
      const difficultyPools = ["facile", "media", "difficile"].map(difficulty =>
        shuffle(questionRows.filter(question => question.difficulty === difficulty))
      );
      const selected: typeof questionRows = [];
      while (selected.length < targetCount) {
        let added = false;
        for (const pool of difficultyPools) {
          if (pool.length && selected.length < targetCount) {
            selected.push(pool.shift()!);
            added = true;
          }
        }
        if (!added) break;
      }
      const snapshot: QuestionSnapshot[] = selected.map(question => ({
        questionId: question.question_id,
        version: question.version,
        type: question.question_type,
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        sourceTitle: question.source_title,
        sourceUrl: question.source_url,
        difficulty: question.difficulty,
      }));

      const { data: created, error: createError } = await supabase.from("academy_attempts")
        .insert({
          identity_id: identity.id,
          lesson_code: lessonCode,
          grade_number: lesson.grade_number,
          attempt_kind: "lesson",
          client_attempt_key: clientAttemptKey,
          question_snapshot: snapshot,
          question_count: snapshot.length,
        })
        .select("id")
        .single();

      if (createError || !created) {
        const { data: raced } = await supabase.from("academy_attempts")
          .select("id,status,question_snapshot")
          .eq("identity_id", identity.id)
          .eq("client_attempt_key", clientAttemptKey)
          .maybeSingle();
        if (raced?.status === "started") {
          const racedSnapshot = raced.question_snapshot as QuestionSnapshot[];
          return response(200, { attemptId: raced.id, questions: racedSnapshot.map(publicQuestion), questionCount: racedSnapshot.length });
        }
        return response(500, { error: "Non è stato possibile creare il tentativo." });
      }

      return response(201, {
        attemptId: created.id,
        questions: snapshot.map(publicQuestion),
        questionCount: snapshot.length,
      });
    }


    if (action === "start_grade_exam") {
      const clientAttemptKey = typeof input.clientAttemptKey === "string" ? input.clientAttemptKey : "";
      if (!/^[0-9a-f-]{36}$/i.test(clientAttemptKey)) {
        return response(400, { error: "Chiave del tentativo non valida." });
      }

      const { data: existing } = await supabase.from("academy_attempts")
        .select("id,status,question_snapshot")
        .eq("identity_id", identity.id)
        .eq("client_attempt_key", clientAttemptKey)
        .maybeSingle();
      if (existing) {
        if (existing.status !== "started") return response(409, { error: "Questo tentativo è già stato consegnato." });
        const snapshot = existing.question_snapshot as QuestionSnapshot[];
        return response(200, { attemptId: existing.id, questions: snapshot.map(publicQuestion), questionCount: snapshot.length });
      }

      const { data: lessons, error: lessonsError } = await supabase.from("academy_lessons")
        .select("lesson_code,order_index")
        .eq("grade_number", 1)
        .eq("subject_code", "pokemon-sciences")
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (lessonsError || !lessons?.length) return response(409, { error: "Il programma del grado non è disponibile." });

      for (const lesson of lessons) {
        const { data: history, error: historyError } = await supabase.from("academy_attempts")
          .select("score")
          .eq("identity_id", identity.id)
          .eq("attempt_kind", "lesson")
          .eq("lesson_code", lesson.lesson_code)
          .eq("status", "submitted");
        if (historyError) return response(500, { error: "Impossibile verificare i prerequisiti dell'esame." });
        if (!history?.length || history.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / history.length < 18) {
          return response(403, { error: "Per accedere all'esame finale devi superare tutte le lezioni del grado con una media di almeno 18/30." });
        }
      }

      const lessonCodes = lessons.map(lesson => lesson.lesson_code);
      const { data: questionRows, error: questionsError } = await supabase.from("academy_questions")
        .select("question_id,lesson_code,question_type,prompt,options,correct_answer,explanation,source_title,source_url,difficulty,version")
        .in("lesson_code", lessonCodes)
        .eq("is_active", true);
      if (questionsError) return response(500, { error: "Impossibile caricare le domande dell'esame." });

      const { data: setting } = await supabase.from("academy_settings")
        .select("setting_value")
        .eq("setting_key", "questions_per_grade_exam")
        .maybeSingle();
      const configuredCount = Number(setting?.setting_value ?? 20);
      const questionCount = Number.isSafeInteger(configuredCount) && configuredCount >= 20 && configuredCount <= 30
        ? configuredCount
        : 20;
      if (!questionRows || questionRows.length < questionCount) {
        return response(409, { error: "L'archivio non contiene ancora abbastanza domande uniche per l'esame finale." });
      }

      const targetCount = questionCount;
      const difficultyPools = ["facile", "media", "difficile"].map(difficulty =>
        shuffle(questionRows.filter(question => question.difficulty === difficulty))
      );
      const selected: typeof questionRows = [];
      while (selected.length < targetCount) {
        let added = false;
        for (const pool of difficultyPools) {
          if (pool.length && selected.length < targetCount) {
            selected.push(pool.shift()!);
            added = true;
          }
        }
        if (!added) break;
      }

      const snapshot: QuestionSnapshot[] = selected.map(question => ({
        questionId: question.question_id,
        lessonCode: question.lesson_code,
        version: question.version,
        type: question.question_type,
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        sourceTitle: question.source_title,
        sourceUrl: question.source_url,
        difficulty: question.difficulty,
      }));

      const { data: created, error: createError } = await supabase.from("academy_attempts")
        .insert({
          identity_id: identity.id,
          lesson_code: null,
          grade_number: 1,
          attempt_kind: "grade_exam",
          client_attempt_key: clientAttemptKey,
          question_snapshot: snapshot,
          question_count: snapshot.length,
        })
        .select("id")
        .single();

      if (createError || !created) {
        const { data: raced } = await supabase.from("academy_attempts")
          .select("id,status,question_snapshot")
          .eq("identity_id", identity.id)
          .eq("client_attempt_key", clientAttemptKey)
          .maybeSingle();
        if (raced?.status === "started") {
          const racedSnapshot = raced.question_snapshot as QuestionSnapshot[];
          return response(200, { attemptId: raced.id, questions: racedSnapshot.map(publicQuestion), questionCount: racedSnapshot.length });
        }
        return response(500, { error: "Non è stato possibile creare l'esame finale." });
      }

      return response(201, {
        attemptId: created.id,
        questions: snapshot.map(publicQuestion),
        questionCount: snapshot.length,
      });
    }

    if (action === "submit_attempt") {
      const attemptId = typeof input.attemptId === "string" ? input.attemptId : "";
      if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return response(400, { error: "Identificativo del tentativo non valido." });
      if (!Array.isArray(input.answers) || input.answers.length > 100) return response(400, { error: "Risposte non valide." });

      const answers = input.answers.map(value => {
        if (!isRecord(value) || typeof value.questionId !== "string") return null;
        return { questionId: value.questionId.slice(0, 120), answer: cleanAnswer(value.answer) };
      });
      if (answers.some(value => value === null)) return response(400, { error: "Formato delle risposte non valido." });

      const { data: attempt, error: attemptError } = await supabase.from("academy_attempts")
        .select("id,identity_id,status,question_snapshot")
        .eq("id", attemptId)
        .eq("identity_id", identity.id)
        .maybeSingle();
      if (attemptError || !attempt) return response(404, { error: "Tentativo non trovato per questa identità." });
      if (attempt.status !== "started") return response(409, { error: "Questo tentativo è già stato consegnato." });

      const snapshot = attempt.question_snapshot as QuestionSnapshot[];
      const snapshotIds = new Set(snapshot.map(question => question.questionId));
      if (answers.length !== snapshot.length || new Set(answers.map(answer => answer!.questionId)).size !== answers.length
        || answers.some(answer => !snapshotIds.has(answer!.questionId))) {
        return response(400, { error: "Le risposte non corrispondono alle domande del tentativo." });
      }

      const { data: result, error: submitError } = await supabase.rpc("submit_academy_attempt", {
        p_identity_id: identity.id,
        p_attempt_id: attemptId,
        p_answers: answers,
      });
      if (submitError || !result) {
        const message = submitError?.message ?? "";
        if (/già stato consegnato|immuta|non trovato/i.test(message)) return response(409, { error: "Il tentativo è già stato consegnato o non è più disponibile." });
        return response(400, { error: "Non è stato possibile correggere il tentativo. Ricarica lo storico prima di riprovare." });
      }

      const answerMap = new Map(answers.map(answer => [answer!.questionId, answer!.answer]));
      const review = snapshot.map(question => ({
        questionId: question.questionId,
        lessonCode: question.lessonCode,
        version: question.version,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        difficulty: question.difficulty,
        selectedAnswer: answerMap.get(question.questionId) ?? null,
        correctAnswer: question.correctAnswer,
        isCorrect: answerMap.get(question.questionId) === question.correctAnswer,
        explanation: question.explanation,
        sourceTitle: question.sourceTitle,
        sourceUrl: question.sourceUrl,
      }));
      return response(200, { ...result, review });
    }

    return response(400, { error: "Azione accademica non riconosciuta." });
  } catch {
    return response(500, { error: "Errore interno del servizio accademico." });
  }
});
