import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, CircleHelp, GraduationCap, LockKeyhole, RefreshCw } from "lucide-react";
import {
  loadAcademyCurriculum,
  loadAcademyLesson,
  loadAcademyAttemptReview,
  startAcademyAttempt,
  startAcademyGradeExam,
  startAcademySubjectExam,
  submitAcademyAttempt,
} from "./academy";
import type {
  AcademyAttemptResult,
  AcademyAttemptSummary,
  AcademyLesson,
  AcademyQuestion,
  AcademyProgressSummary,
  AcademyPointsSummary,
} from "./academy";
import "./academy.css";

type Props = {
  configured: boolean;
  identityReady: boolean;
  onOpenProfile: () => void;
};

function averageScore(attempts: AcademyAttemptSummary[]): number | null {
  const scores = attempts.filter(attempt => attempt.status === "submitted" && attempt.score !== null);
  if (!scores.length) return null;
  return scores.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / scores.length;
}

function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("it-IT", { maximumFractionDigits: 2 }) + "/30";
}

function makeAttemptKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    return (char === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

 
function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function isQuestionAnswered(question: AcademyQuestion, answer: unknown): boolean {
  if (question.type === "matching") {
    const mapping = asStringRecord(answer);
    const left = question.options.filter(option => option.side === "left");
    const rightIds = new Set(question.options.filter(option => option.side === "right").map(option => option.id));
    const selectedTargets = left.map(option => mapping[option.id]).filter(Boolean);
    return left.length > 0
      && left.every(option => Boolean(mapping[option.id]) && rightIds.has(mapping[option.id]))
      && new Set(selectedTargets).size === left.length;
  }
  if (question.type === "ordering") {
    return Array.isArray(answer)
      && answer.length === question.options.length
      && new Set(answer).size === question.options.length
      && answer.every(id => typeof id === "string" && question.options.some(option => option.id === id));
  }
  return typeof answer === "string" && question.options.some(option => option.id === answer);
}

function moveOption(items: string[], from: number, to: number): string[] {
  if (to < 0 || to >= items.length || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function formatAnswer(options: Array<{ id: string; label: string; side?: string }>, value: unknown): string {
  const label = (id: unknown) => options.find(option => option.id === String(id))?.label ?? String(id);
  if (Array.isArray(value)) return value.map(label).join(" → ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([left, right]) => label(left) + " → " + label(right)).join(" · ");
  }
  return label(value);
}

export default function Academy({ configured, identityReady, onOpenProfile }: Props) {
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [attempts, setAttempts] = useState<AcademyAttemptSummary[]>([]);
  const [progressSummary, setProgressSummary] = useState<AcademyProgressSummary | null>(null);
  const [pointsSummary, setPointsSummary] = useState<AcademyPointsSummary | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [lesson, setLesson] = useState<AcademyLesson | null>(null);
  const [lessonAttempts, setLessonAttempts] = useState<AcademyAttemptSummary[]>([]);
  const [lessonAverage, setLessonAverage] = useState<number | null>(null);
  const [lessonAttemptCount, setLessonAttemptCount] = useState(0);
  const [questions, setQuestions] = useState<AcademyQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptKind, setAttemptKind] = useState<"lesson" | "subject_exam" | "grade_exam" | null>(null);
  const [reviewingHistory, setReviewingHistory] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<AcademyAttemptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const averages = useMemo(() => {
    const resultMap = new Map<string, number | null>();
    for (const item of lessons) {
      resultMap.set(item.lesson_code, progressSummary?.lessonAverages[item.lesson_code]?.average ?? null);
    }
    return resultMap;
  }, [lessons, progressSummary]);

  const selectedIndex = lessons.findIndex(item => item.lesson_code === selectedCode);
  const selectedIsUnlocked = selectedIndex <= 0 || lessons
    .slice(0, selectedIndex)
    .every(item => (averages.get(item.lesson_code) ?? 0) >= 18);
  const answeredCount = questions.filter(question => isQuestionAnswered(question, answers[question.questionId])).length;
  const gradeExamAttempts = attempts.filter(attempt => attempt.attempt_kind === "grade_exam");
  const subjectExamAttempts = attempts.filter(attempt => attempt.attempt_kind === "subject_exam");
  const gradeExamAttemptCount = progressSummary?.gradeExamAttemptCount ?? gradeExamAttempts.length;
  const totalAttemptCount = Object.values(progressSummary?.lessonAverages ?? {}).reduce((sum, item) => sum + item.attemptCount, 0) + gradeExamAttemptCount + subjectExamAttempts.length;
  const gradeAverage = lessons.length > 0 && lessons.every(item => averages.get(item.lesson_code) !== null)
    ? lessons.reduce((sum, item) => sum + (averages.get(item.lesson_code) ?? 0), 0) / lessons.length
    : null;
  const allLessonsPassed = lessons.length > 0 && lessons.every(item => (averages.get(item.lesson_code) ?? 0) >= 18);
  const gradeExamAverage = progressSummary?.gradeExamAverage ?? averageScore(gradeExamAttempts);
  const gradePassed = progressSummary?.gradePassed ?? false;

  async function refreshCurriculum() {
    const data = await loadAcademyCurriculum();
    setLessons(data.lessons);
    setAttempts(data.attempts);
    setProgressSummary(data.progress);
    setPointsSummary(data.points);
  }

  useEffect(() => {
    if (!configured || !identityReady) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    loadAcademyCurriculum()
      .then(data => {
        if (cancelled) return;
        setLessons(data.lessons);
        setAttempts(data.attempts);
        setProgressSummary(data.progress);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Impossibile caricare il programma.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [configured, identityReady]);

  useEffect(() => {
    if (!selectedCode || selectedCode === "__grade_exam__" || selectedCode === "__subject_exam__" || !configured || !identityReady) {
      setLesson(null);
      setLessonAttempts([]);
      setLessonAverage(null);
      setLessonAttemptCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    loadAcademyLesson(selectedCode)
      .then(data => {
        if (cancelled) return;
        setLesson(data.lesson);
        setLessonAttempts(data.attempts);
        setLessonAverage(data.lessonAverage);
        setLessonAttemptCount(data.attemptCount);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Impossibile caricare la lezione.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCode, configured, identityReady]);

  async function beginAttempt() {
    if (!lesson) return;
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setReviewingHistory(false);
    setAnswers({});
    try {
      const data = await startAcademyAttempt(lesson.lesson_code, makeAttemptKey());
      setAttemptKind("lesson");
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile avviare il test.");
    } finally {
      setLoading(false);
    }
  }

  async function beginSubjectExam() {
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setReviewingHistory(false);
    setAnswers({});
    try {
      const data = await startAcademySubjectExam("pokemon-sciences", makeAttemptKey());
      setSelectedCode("__subject_exam__");
      setAttemptKind("subject_exam");
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile avviare l'esame finale di materia.");
    } finally {
      setLoading(false);
    }
  }

  async function beginGradeExam() {
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setReviewingHistory(false);
    setAnswers({});
    try {
      const data = await startAcademyGradeExam(makeAttemptKey());
      setSelectedCode("__grade_exam__");
      setAttemptKind("grade_exam");
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile avviare l'esame finale.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAttempt() {
    if (!attemptId || answeredCount !== questions.length) return;
    setLoading(true);
    setError("");
    try {
      const submitted = await submitAcademyAttempt(attemptId, questions.map(question => ({
        questionId: question.questionId,
        answer: answers[question.questionId],
      })));
      setResult(submitted);
      setAttemptId(null);
      setQuestions([]);
      setAnswers({});
      setNotice("Tentativo registrato nello storico accademico.");
      try {
        await refreshCurriculum();
        if (selectedCode && selectedCode !== "__grade_exam__" && selectedCode !== "__subject_exam__") {
          const detail = await loadAcademyLesson(selectedCode);
          setLesson(detail.lesson);
          setLessonAttempts(detail.attempts);
          setLessonAverage(detail.lessonAverage);
          setLessonAttemptCount(detail.attemptCount);
        }
      } catch {
        setError("Tentativo registrato, ma non è stato possibile aggiornare subito la pagella. Usa Aggiorna per ricaricare i dati.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile consegnare il test.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewAttempt(id: string, kind: "lesson" | "subject_exam" | "grade_exam", lessonCode?: string | null) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const historical = await loadAcademyAttemptReview(id);
      setSelectedCode(kind === "grade_exam" ? "__grade_exam__" : kind === "subject_exam" ? "__subject_exam__" : (lessonCode ?? selectedCode));
      setAttemptKind(kind);
      setAttemptId(null);
      setQuestions([]);
      setAnswers({});
      setResult(historical);
      setReviewingHistory(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile caricare il tentativo storico.");
    } finally {
      setLoading(false);
    }
  }

  function resetAttempt() {
    setAttemptId(null);
    setAttemptKind(null);
    setReviewingHistory(false);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError("");
    setNotice("");
  }

  if (!configured || !identityReady) {
    return (
      <section className="academy-page">
        <div className="academy-breadcrumb">Home / Area didattica / <strong>Accademia</strong></div>
        <header className="academy-hero">
          <div className="academy-hero-icon"><GraduationCap size={30} /></div>
          <div><span className="academy-eyebrow">DIPARTIMENTO DIDATTICO</span><h1>Accademia Pokémon</h1><p>Un percorso strutturato in lezioni, verifiche e gradi accademici.</p></div>
        </header>
        <section className="academy-state-card">
          <LockKeyhole size={28} />
          <h2>{!configured ? "Servizio online non configurato" : "Verifica la tua identità online"}</h2>
          <p>{!configured
            ? "La funzione accademica richiede la configurazione Supabase prevista dal progetto."
            : "Per salvare risultati verificabili e sincronizzati, importa i metadati dell’account dal Profilo."}</p>
          {configured && <button type="button" className="academy-primary-button" onClick={onOpenProfile}>Apri Profilo</button>}
        </section>
      </section>
    );
  }

  return (
    <section className="academy-page">
      <div className="academy-breadcrumb">Home / Area didattica / <strong>Accademia</strong></div>
      <header className="academy-hero">
        <div className="academy-hero-icon"><GraduationCap size={30} /></div>
        <div><span className="academy-eyebrow">DIPARTIMENTO DIDATTICO</span><h1>Accademia Pokémon</h1><p>Grado I — Fondamenti · Scienze Pokémon e Pokédex</p></div>
        <button type="button" className="academy-icon-button" aria-label="Aggiorna programma" disabled={loading} onClick={() => { setLoading(true); setError(""); refreshCurriculum().catch(reason => setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.")).finally(() => setLoading(false)); }}><RefreshCw size={17} /></button>
      </header>

      {error && <div className="academy-alert academy-alert-error" role="alert">{error}</div>}
      {notice && <div className="academy-alert academy-alert-success" role="status">{notice}</div>}
      {loading && <div className="academy-loading" role="status">Aggiornamento del programma…</div>}

      {!selectedCode ? (
        <>
          <section className="academy-content-card academy-campus-points">
            <div className="academy-campus-points-heading">
              <div><span className="academy-eyebrow">PUNTI ACCADEMICI</span><h2>Classifica delle accademie</h2></div>
              <div className="academy-student-points"><span>Il tuo saldo</span><strong>{pointsSummary?.studentPoints ?? 0}</strong></div>
            </div>
            <p>I punti di ogni prova consegnata si sommano al punteggio del campus dello studente.</p>
            <ol className="academy-campus-ranking">
              {(pointsSummary?.campusRanking ?? [
                { academy: "arancia" as const, title: "Accademia Arancia", points: 0 },
                { academy: "uva" as const, title: "Accademia Uva", points: 0 },
                { academy: "mirtillo" as const, title: "Istituto Mirtillo", points: 0 },
              ]).map((campus, index) => (
                <li key={campus.academy} className={pointsSummary?.studentAcademy === campus.academy ? "is-own-campus" : ""}>
                  <span className="academy-ranking-position">{index + 1}</span>
                  <span className="academy-ranking-name">{campus.title}{pointsSummary?.studentAcademy === campus.academy && <small>Il tuo campus</small>}</span>
                  <strong>{campus.points} pt</strong>
                </li>
              ))}
            </ol>
          </section>
          <div className="academy-summary-grid">
            <article><span>LEZIONI</span><strong>{lessons.length}</strong><small>Programma pubblicato</small></article>
            <article><span>SUPERATE</span><strong>{lessons.filter(item => (averages.get(item.lesson_code) ?? 0) >= 18).length}</strong><small>Media tentativi ≥ 18/30</small></article>
            <article><span>STORICO</span><strong>{totalAttemptCount}</strong><small>Tentativi consegnati</small></article>
          </div>
          <div className="academy-section-heading"><div><span className="academy-eyebrow">IL TUO PERCORSO</span><h2>Lezioni del Grado I</h2></div><span className="academy-grade-pill">Soglia: 18/30</span></div>
          <div className="academy-lesson-list">
            {lessons.map((item, index) => {
              const score = averages.get(item.lesson_code) ?? null;
              const unlocked = index === 0 || lessons.slice(0, index).every(previous => (averages.get(previous.lesson_code) ?? 0) >= 18);
              const passed = score !== null && score >= 18;
              return <article className={"academy-lesson-card " + (!unlocked ? "is-locked" : "")} key={item.lesson_code}>
                <div className={"academy-lesson-number " + (passed ? "is-passed" : "")}>{passed ? <CheckCircle2 size={20} /> : unlocked ? String(index + 1).padStart(2, "0") : <LockKeyhole size={17} />}</div>
                <div className="academy-lesson-copy"><span>LEZIONE {index + 1}</span><h3>{item.title}</h3><p>{item.summary}</p><small>{item.objectives.length} obiettivi formativi · {progressSummary?.lessonAverages[item.lesson_code]?.attemptCount ?? attempts.filter(attempt => attempt.lesson_code === item.lesson_code).length} tentativi</small></div>
                <div className="academy-lesson-result"><span>MEDIA</span><strong>{formatAverage(score)}</strong><button type="button" disabled={!unlocked} onClick={() => { setSelectedCode(item.lesson_code); setAttemptKind(null); setResult(null); setQuestions([]); setAttemptId(null); setError(""); setNotice(""); }}>Apri lezione</button></div>
              </article>;
            })}
          </div>
          <section className="academy-content-card academy-grade-exam-card">
            <div>
              <span className="academy-eyebrow">ESAME FINALE DI MATERIA</span>
              <h3>Scienze Pokémon e Pokédex</h3>
              <p>L'esame finale di materia contiene 15 domande estratte dalle lezioni della materia. Ogni tentativo consegnato assegna 3 punti accademici, anche se insufficiente.</p>
              <div className="academy-grade-exam-stats"><span>Tentativi <strong>{subjectExamAttempts.length}</strong></span><span>Punti per consegna <strong>3</strong></span></div>
              {subjectExamAttempts.length > 0 && <div className="academy-exam-history"><strong>Ultimi tentativi</strong>{subjectExamAttempts.slice(0, 5).map((attempt, index) => <div key={attempt.id}><span>Tentativo {subjectExamAttempts.length - index}</span><strong>{attempt.score}/30</strong><button type="button" className="academy-review-button" onClick={() => void reviewAttempt(attempt.id, "subject_exam")}>Rivedi</button><small>{new Date(attempt.created_at).toLocaleString("it-IT")}</small></div>)}</div>}
            </div>
            <button type="button" className="academy-primary-button" disabled={loading || !allLessonsPassed} onClick={() => void beginSubjectExam()}>{subjectExamAttempts.length ? "Ripeti l’esame di materia" : "Accedi all’esame di materia"}</button>
            {!allLessonsPassed && <small className="academy-grade-exam-lock">Completa tutte le lezioni della materia con una media di almeno 18/30 per sbloccare l’esame.</small>}
          </section>
          <section className="academy-content-card academy-grade-exam-card">
            <div>
              <span className="academy-eyebrow">ESAME FINALE DI GRADO</span>
              <h3>Esame di grado — Fondamenti</h3>
              <p>Per superare il Grado I servono tutte le lezioni completate, una media del grado di almeno 26/30 e una media di tutti i tentativi dell’esame finale di almeno 26/30. Ogni tentativo d’esame contiene 25 domande uniche.</p>
              <div className="academy-grade-exam-stats"><span>Media del grado <strong>{formatAverage(gradeAverage)}</strong></span><span>Media esame <strong>{formatAverage(gradeExamAverage)}</strong></span><span>Tentativi esame <strong>{gradeExamAttemptCount}</strong></span></div>
              {gradeExamAttempts.length > 0 && <div className="academy-exam-history"><strong>Ultimi tentativi d’esame</strong>{gradeExamAttempts.slice(0, 5).map((attempt, index) => <div key={attempt.id}><span>Tentativo {gradeExamAttemptCount - index}</span><strong>{attempt.score}/30</strong><button type="button" className="academy-review-button" onClick={() => void reviewAttempt(attempt.id, "grade_exam")}>Rivedi</button><small>{new Date(attempt.created_at).toLocaleString("it-IT")}</small></div>)}</div>}
              {gradePassed && <p className="academy-grade-complete"><CheckCircle2 size={16} /> Grado I superato.</p>}
            </div>
            <button type="button" className="academy-primary-button" disabled={loading || !allLessonsPassed} onClick={() => void beginGradeExam()}>{gradeExamAttemptCount ? "Ripeti l’esame" : "Accedi all’esame"}</button>
            {!allLessonsPassed && <small className="academy-grade-exam-lock">Completa e supera tutte le lezioni con una media di almeno 18/30 per sbloccare l’esame.</small>}
          </section>
        </>
      ) : (
        <div className="academy-detail">
          <button type="button" className="academy-back-button" onClick={() => { resetAttempt(); setSelectedCode(null); }}><ArrowLeft size={16} /> Tutte le lezioni</button>
          {(lesson || selectedCode === "__grade_exam__" || selectedCode === "__subject_exam__") && <>
            <header className="academy-detail-heading"><span className="academy-eyebrow">{selectedCode === "__grade_exam__" ? "ESAME FINALE DI GRADO" : selectedCode === "__subject_exam__" ? "ESAME FINALE DI MATERIA" : "LEZIONE " + (lesson?.order_index ?? "")}</span><h2>{selectedCode === "__grade_exam__" ? "Esame finale del Grado I" : selectedCode === "__subject_exam__" ? "Esame finale — Scienze Pokémon e Pokédex" : lesson?.title}</h2><p>{selectedCode === "__grade_exam__" ? "Rispondi alle domande estratte dal programma del Grado I. Il voto minimo per superare l’esame è 26/30." : selectedCode === "__subject_exam__" ? "Rispondi a 15 domande estratte dalle lezioni della materia. Il voto minimo è 18/30." : lesson?.summary}</p></header>
            {lesson && !selectedIsUnlocked && <div className="academy-alert academy-alert-error">Questa lezione è bloccata: completa la precedente con una media di almeno 18/30.</div>}
            {selectedCode === "__subject_exam__" && !attemptId && !result && <section className="academy-content-card academy-test-intro"><div><h3><BookOpen size={18} /> Esame finale di materia</h3><p>Il test contiene 15 domande. La consegna assegna 3 punti accademici, indipendentemente dal voto ottenuto.</p></div><button type="button" className="academy-primary-button" disabled={loading || !allLessonsPassed} onClick={() => void beginSubjectExam()}>Inizia l'esame</button></section>}
            {lesson && !attemptId && !result && <>
              <section className="academy-content-card">
                <h3><BookOpen size={18} /> Obiettivi formativi</h3>
                <ul>{lesson.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
              </section>
              {(lesson.content ?? []).map((section, index) => <section className="academy-content-card" key={lesson.lesson_code + "-" + index}><h3>{section.title}</h3><p>{section.body}</p></section>)}
              <section className="academy-content-card academy-test-intro"><div><h3><CircleHelp size={18} /> Verifica della lezione</h3><p>Il test seleziona domande dal repertorio della lezione. Ogni tentativo viene registrato e la media comprende tutti i tentativi, anche quelli insufficienti.</p></div><button type="button" className="academy-primary-button" disabled={loading || !selectedIsUnlocked} onClick={() => void beginAttempt()}>Inizia il test</button></section>
              {lessonAttemptCount > 0 && <section className="academy-content-card"><h3>Storico della lezione</h3><div className="academy-history-list">{lessonAttempts.map((attempt, index) => <div key={attempt.id}><span>Tentativo {lessonAttemptCount - index}</span><strong>{attempt.score}/30</strong><button type="button" className="academy-review-button" onClick={() => void reviewAttempt(attempt.id, "lesson", lesson?.lesson_code)}>Rivedi</button><small>{new Date(attempt.created_at).toLocaleString("it-IT")}</small></div>)}</div><p className="academy-average-note">Media di tutti i tentativi: <strong>{formatAverage(lessonAverage)}</strong></p></section>}
            </>}
            {attemptId && <section className="academy-test-panel">
              <div className="academy-test-progress"><span>{attemptKind === "grade_exam" ? "ESAME FINALE DEL GRADO" : attemptKind === "subject_exam" ? "ESAME FINALE DI MATERIA" : "TEST DELLA LEZIONE"}</span><strong>{answeredCount} / {questions.length} risposte</strong></div>
              {questions.map((question, index) => <fieldset className="academy-question" key={question.questionId}>
                <legend><span>DOMANDA {index + 1} · {question.difficulty.toLocaleUpperCase("it-IT")}</span>{question.prompt}</legend>
                {question.mediaUrl && <img className="academy-question-image" src={question.mediaUrl} alt="Immagine da identificare" loading="lazy" />}
                {question.type === "matching" ? <div className="academy-matching-list">{question.options.filter(option => option.side === "left").map(option => <label key={option.id}><span>{option.label}</span><select aria-label={"Abbinamento per " + option.label} value={asStringRecord(answers[question.questionId])[option.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.questionId]: { ...asStringRecord(current[question.questionId]), [option.id]: event.target.value } }))}><option value="">Scegli un abbinamento</option>{question.options.filter(target => target.side === "right").map(target => <option key={target.id} value={target.id} disabled={Object.entries(asStringRecord(answers[question.questionId])).some(([mappedId, mappedTarget]) => mappedId !== option.id && mappedTarget === target.id)}>{target.label}</option>)}</select></label>)}</div>
                  : question.type === "ordering" ? <div className="academy-ordering-list">
                    {(Array.isArray(answers[question.questionId]) ? answers[question.questionId] as string[] : question.options.map(option => option.id)).map((optionId, orderIndex, currentOrder) => {
                      const option = question.options.find(item => item.id === optionId);
                      return <div key={optionId}><span className="academy-order-index">{orderIndex + 1}</span><strong>{option?.label ?? optionId}</strong><div><button type="button" aria-label={"Sposta " + (option?.label ?? optionId) + " in alto"} disabled={orderIndex === 0} onClick={() => setAnswers(current => ({ ...current, [question.questionId]: moveOption(currentOrder, orderIndex, orderIndex - 1) }))}>↑</button><button type="button" aria-label={"Sposta " + (option?.label ?? optionId) + " in basso"} disabled={orderIndex === currentOrder.length - 1} onClick={() => setAnswers(current => ({ ...current, [question.questionId]: moveOption(currentOrder, orderIndex, orderIndex + 1) }))}>↓</button></div></div>;
                    })}
                    <button type="button" className="academy-secondary-button academy-confirm-order" onClick={() => setAnswers(current => ({ ...current, [question.questionId]: Array.isArray(current[question.questionId]) ? current[question.questionId] : question.options.map(option => option.id) }))}>Conferma ordine</button>
                  </div>
                  : <div className="academy-options">{question.options.map(option => <label key={option.id} className={answers[question.questionId] === option.id ? "selected" : ""}><input type="radio" name={question.questionId} value={option.id} checked={answers[question.questionId] === option.id} onChange={() => setAnswers(current => ({ ...current, [question.questionId]: option.id }))} /><span>{option.label}</span></label>)}</div>}
              </fieldset>)}
              <div className="academy-test-actions"><button type="button" className="academy-secondary-button" onClick={resetAttempt}>Annulla test</button><button type="button" className="academy-primary-button" disabled={loading || answeredCount !== questions.length} onClick={() => void submitAttempt()}>{loading ? "Correzione…" : "Consegna e registra"}</button></div>
            </section>}
            {result && <section className="academy-result-panel">
              <div className={"academy-result-mark " + (result.passed ? "passed" : "failed")}>{result.passed ? <CheckCircle2 size={28} /> : <CircleHelp size={28} />}</div>
              <span className="academy-eyebrow">RISULTATO DEL TENTATIVO</span><h3>{result.score}/{result.gradeMax ?? 30}</h3><small className="academy-rule-note">Regola {result.gradingRuleVersion ?? "thirtieths-v1"} · soglia di questo tentativo {result.passThreshold ?? (attemptKind === "grade_exam" ? 26 : 18)}/{result.gradeMax ?? 30}</small><p>{result.correctCount} risposte corrette su {result.questionCount}. {attemptKind === "grade_exam" ? (result.passed ? "Questo tentativo raggiunge almeno 26/30." : "Questo tentativo è inferiore a 26/30 e verrà conteggiato nella media.") : (result.passed ? "Il voto di questo tentativo raggiunge almeno 18/30; la media di tutti i tentativi determina il superamento." : "Tentativo insufficiente: verrà comunque conteggiato nella media.")}</p><p className="academy-points-awarded">Punti accademici assegnati per questa consegna: <strong>+{result.pointsAwarded ?? (attemptKind === "lesson" ? 1 : attemptKind === "subject_exam" ? 3 : 5)}</strong>. Saldo personale: <strong>{result.academicPoints ?? pointsSummary?.studentPoints ?? "—"}</strong>.</p>
              {attemptKind === "grade_exam" && <p>Media del grado: <strong>{formatAverage(gradeAverage)}</strong> · Media di tutti i tentativi d’esame: <strong>{formatAverage(gradeExamAverage)}</strong>. {gradePassed ? "Grado I superato." : "Il grado risulta superato solo quando entrambe le medie raggiungono 26/30."}</p>}
              <div className="academy-review-list">{result.review.map((item, index) => <article key={item.questionId} className={item.isCorrect ? "correct" : "incorrect"}><h4>{index + 1}. {item.prompt}</h4>{item.mediaUrl && <img className="academy-question-image academy-review-image" src={item.mediaUrl} alt="Immagine della domanda" loading="lazy" />}<p><strong>La tua risposta:</strong> {formatAnswer(item.options, item.selectedAnswer)}</p><p><strong>{item.isCorrect ? "Risposta corretta" : "Risposta corretta attesa"}:</strong> {formatAnswer(item.options, item.correctAnswer)}</p><p>{item.explanation}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte: {item.sourceTitle} · verificata il {item.sourceCheckedAt}</a></article>)}</div>
              <button type="button" className="academy-primary-button" onClick={() => { const returnToLesson = reviewingHistory && attemptKind === "lesson"; resetAttempt(); if (!returnToLesson) setSelectedCode(null); }}>{reviewingHistory ? (attemptKind === "lesson" ? "Torna alla lezione" : "Torna al programma") : "Torna al programma"}</button>
            </section>}
          </>}
        </div>
      )}
    </section>
  );
}
