import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, CircleHelp, GraduationCap, LockKeyhole, RefreshCw } from "lucide-react";
import {
  loadAcademyCurriculum,
  loadAcademyLesson,
  startAcademyAttempt,
  submitAcademyAttempt,
} from "./academy";
import type {
  AcademyAttemptResult,
  AcademyAttemptSummary,
  AcademyLesson,
  AcademyQuestion,
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

export default function Academy({ configured, identityReady, onOpenProfile }: Props) {
  const [lessons, setLessons] = useState<AcademyLesson[]>([]);
  const [attempts, setAttempts] = useState<AcademyAttemptSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [lesson, setLesson] = useState<AcademyLesson | null>(null);
  const [lessonAttempts, setLessonAttempts] = useState<AcademyAttemptSummary[]>([]);
  const [questions, setQuestions] = useState<AcademyQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AcademyAttemptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const averages = useMemo(() => {
    const resultMap = new Map<string, number | null>();
    for (const item of lessons) {
      resultMap.set(item.lesson_code, averageScore(attempts.filter(attempt => attempt.lesson_code === item.lesson_code)));
    }
    return resultMap;
  }, [lessons, attempts]);

  const selectedIndex = lessons.findIndex(item => item.lesson_code === selectedCode);
  const selectedIsUnlocked = selectedIndex <= 0 || lessons
    .slice(0, selectedIndex)
    .every(item => (averages.get(item.lesson_code) ?? 0) >= 18);
  const answeredCount = questions.filter(question => answers[question.questionId] !== undefined).length;

  async function refreshCurriculum() {
    const data = await loadAcademyCurriculum();
    setLessons(data.lessons);
    setAttempts(data.attempts);
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
    if (!selectedCode || !configured || !identityReady) {
      setLesson(null);
      setLessonAttempts([]);
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
    setAnswers({});
    try {
      const data = await startAcademyAttempt(lesson.lesson_code, makeAttemptKey());
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile avviare il test.");
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
      await refreshCurriculum();
      if (selectedCode) {
        const detail = await loadAcademyLesson(selectedCode);
        setLesson(detail.lesson);
        setLessonAttempts(detail.attempts);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non è stato possibile consegnare il test.");
    } finally {
      setLoading(false);
    }
  }

  function resetAttempt() {
    setAttemptId(null);
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
          <div className="academy-summary-grid">
            <article><span>LEZIONI</span><strong>{lessons.length}</strong><small>Programma pubblicato</small></article>
            <article><span>SUPERATE</span><strong>{lessons.filter(item => (averages.get(item.lesson_code) ?? 0) >= 18).length}</strong><small>Media tentativi ≥ 18/30</small></article>
            <article><span>STORICO</span><strong>{attempts.length}</strong><small>Tentativi consegnati</small></article>
          </div>
          <div className="academy-section-heading"><div><span className="academy-eyebrow">IL TUO PERCORSO</span><h2>Lezioni del Grado I</h2></div><span className="academy-grade-pill">Soglia: 18/30</span></div>
          <div className="academy-lesson-list">
            {lessons.map((item, index) => {
              const score = averages.get(item.lesson_code) ?? null;
              const unlocked = index === 0 || lessons.slice(0, index).every(previous => (averages.get(previous.lesson_code) ?? 0) >= 18);
              const passed = score !== null && score >= 18;
              return <article className={"academy-lesson-card " + (!unlocked ? "is-locked" : "")} key={item.lesson_code}>
                <div className={"academy-lesson-number " + (passed ? "is-passed" : "")}>{passed ? <CheckCircle2 size={20} /> : unlocked ? String(index + 1).padStart(2, "0") : <LockKeyhole size={17} />}</div>
                <div className="academy-lesson-copy"><span>LEZIONE {index + 1}</span><h3>{item.title}</h3><p>{item.summary}</p><small>{item.objectives.length} obiettivi formativi · {attempts.filter(attempt => attempt.lesson_code === item.lesson_code).length} tentativi</small></div>
                <div className="academy-lesson-result"><span>MEDIA</span><strong>{formatAverage(score)}</strong><button type="button" disabled={!unlocked} onClick={() => { setSelectedCode(item.lesson_code); setResult(null); setQuestions([]); setAttemptId(null); setError(""); setNotice(""); }}>Apri lezione</button></div>
              </article>;
            })}
          </div>
        </>
      ) : (
        <div className="academy-detail">
          <button type="button" className="academy-back-button" onClick={() => { resetAttempt(); setSelectedCode(null); }}><ArrowLeft size={16} /> Tutte le lezioni</button>
          {lesson && <>
            <header className="academy-detail-heading"><span className="academy-eyebrow">LEZIONE {lesson.order_index}</span><h2>{lesson.title}</h2><p>{lesson.summary}</p></header>
            {!selectedIsUnlocked && <div className="academy-alert academy-alert-error">Questa lezione è bloccata: completa la precedente con una media di almeno 18/30.</div>}
            {!attemptId && !result && <>
              <section className="academy-content-card">
                <h3><BookOpen size={18} /> Obiettivi formativi</h3>
                <ul>{lesson.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
              </section>
              {(lesson.content ?? []).map((section, index) => <section className="academy-content-card" key={lesson.lesson_code + "-" + index}><h3>{section.title}</h3><p>{section.body}</p></section>)}
              <section className="academy-content-card academy-test-intro"><div><h3><CircleHelp size={18} /> Verifica della lezione</h3><p>Il test seleziona domande dal repertorio della lezione. Ogni tentativo viene registrato e la media comprende tutti i tentativi, anche quelli insufficienti.</p></div><button type="button" className="academy-primary-button" disabled={loading || !selectedIsUnlocked} onClick={() => void beginAttempt()}>Inizia il test</button></section>
              {lessonAttempts.length > 0 && <section className="academy-content-card"><h3>Storico della lezione</h3><div className="academy-history-list">{lessonAttempts.map((attempt, index) => <div key={attempt.id}><span>Tentativo {lessonAttempts.length - index}</span><strong>{attempt.score}/30</strong><small>{new Date(attempt.created_at).toLocaleString("it-IT")}</small></div>)}</div><p className="academy-average-note">Media di tutti i tentativi: <strong>{formatAverage(averageScore(lessonAttempts))}</strong></p></section>}
            </>}
            {attemptId && <section className="academy-test-panel">
              <div className="academy-test-progress"><span>TEST DELLA LEZIONE</span><strong>{answeredCount} / {questions.length} risposte</strong></div>
              {questions.map((question, index) => <fieldset className="academy-question" key={question.questionId}>
                <legend><span>DOMANDA {index + 1} · {question.difficulty.toLocaleUpperCase("it-IT")}</span>{question.prompt}</legend>
                <div className="academy-options">{question.options.map(option => <label key={option.id} className={answers[question.questionId] === option.id ? "selected" : ""}><input type="radio" name={question.questionId} value={option.id} checked={answers[question.questionId] === option.id} onChange={() => setAnswers(current => ({ ...current, [question.questionId]: option.id }))} /><span>{option.label}</span></label>)}</div>
              </fieldset>)}
              <div className="academy-test-actions"><button type="button" className="academy-secondary-button" onClick={resetAttempt}>Annulla test</button><button type="button" className="academy-primary-button" disabled={loading || answeredCount !== questions.length} onClick={() => void submitAttempt()}>{loading ? "Correzione…" : "Consegna e registra"}</button></div>
            </section>}
            {result && <section className="academy-result-panel">
              <div className={"academy-result-mark " + (result.passed ? "passed" : "failed")}>{result.passed ? <CheckCircle2 size={28} /> : <CircleHelp size={28} />}</div>
              <span className="academy-eyebrow">RISULTATO DEL TENTATIVO</span><h3>{result.score}/30</h3><p>{result.correctCount} risposte corrette su {result.questionCount}. {result.passed ? "Lezione superata secondo il voto del tentativo." : "Tentativo insufficiente: verrà comunque conteggiato nella media."}</p>
              <div className="academy-review-list">{result.review.map((item, index) => <article key={item.questionId} className={item.isCorrect ? "correct" : "incorrect"}><h4>{index + 1}. {item.prompt}</h4><p><strong>{item.isCorrect ? "Risposta corretta" : "Risposta corretta attesa"}:</strong> {item.options.find(option => option.id === String(item.correctAnswer))?.label ?? String(item.correctAnswer)}</p><p>{item.explanation}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte: {item.sourceTitle}</a></article>)}</div>
              <button type="button" className="academy-primary-button" onClick={() => { resetAttempt(); setSelectedCode(null); }}>Torna al programma</button>
            </section>}
          </>}
        </div>
      )}
    </section>
  );
}
