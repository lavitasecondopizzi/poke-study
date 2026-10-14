import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, BookOpen, CheckCircle2, Clock3, Eye, FileText, GraduationCap, Medal, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { loadAcademyAttemptReview, loadAcademyCurriculum } from './academy';
import type { AcademyAttemptResult, AcademyAttemptSummary, AcademyLesson } from './academy';
import type { ApiNamedResource, PokemonSpecies, SavedProgress } from './types';
import { displayName, itemCard, MACRO_CATEGORIES, pokemonCard } from './catalog';

const DEX_SIZE = 1025;
const REGIONS = [
  { name: 'Kanto', start: 1, end: 151 }, { name: 'Johto', start: 152, end: 251 },
  { name: 'Hoenn', start: 252, end: 386 }, { name: 'Sinnoh', start: 387, end: 493 },
  { name: 'Unima', start: 494, end: 649 }, { name: 'Kalos', start: 650, end: 721 },
  { name: 'Alola', start: 722, end: 809 }, { name: 'Galar', start: 810, end: 905 },
  { name: 'Paldea', start: 906, end: 1025 },
];
type Props = { progress: SavedProgress; species: PokemonSpecies[]; items: ApiNamedResource[]; loading: boolean; configured: boolean; identityReady: boolean; onReset: () => void };
type AcademyRecord = { lessons: AcademyLesson[]; attempts: AcademyAttemptSummary[] };
type RegisterView = 'summary' | 'detail';

function average(values: Array<number | null | undefined>): number | null {
  const scores = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
}

function formatGrade(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('it-IT', { maximumFractionDigits: 2 })}/30`;
}

function answerLabel(attempt: AcademyAttemptResult['review'][number], answer: unknown): string {
  const label = (id: unknown) => attempt.options.find(option => option.id === String(id))?.label ?? String(id ?? 'Nessuna risposta');
  if (Array.isArray(answer)) return answer.map(label).join(' → ');
  if (answer && typeof answer === 'object') return Object.entries(answer as Record<string, unknown>).map(([left, right]) => `${label(left)} → ${label(right)}`).join(' · ');
  return label(answer);
}

function Bar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return <div className="pr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safe)}><span style={{ width: `${safe}%` }} /></div>;
}

export default function PersonalRegister({ progress, species, items, loading, configured, identityReady, onReset }: Props) {
  const [academyRecord, setAcademyRecord] = useState<AcademyRecord | null>(null);
  const [academyLoading, setAcademyLoading] = useState(false);
  const [academyError, setAcademyError] = useState('');
  const [registerView, setRegisterView] = useState<RegisterView>('summary');
  const [reviewAttempt, setReviewAttempt] = useState<AcademyAttemptResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    let active = true;
    if (!configured || !identityReady) {
      setAcademyRecord(null);
      setAcademyLoading(false);
      setAcademyError('');
      return () => { active = false; };
    }
    setAcademyLoading(true);
    setAcademyError('');
    loadAcademyCurriculum()
      .then(data => { if (active) setAcademyRecord({ lessons: data.lessons, attempts: data.attempts }); })
      .catch(error => {
        if (active) {
          setAcademyRecord(null);
          setAcademyError(error instanceof Error ? error.message : 'Impossibile caricare i risultati accademici.');
        }
      })
      .finally(() => { if (active) setAcademyLoading(false); });
    return () => { active = false; };
  }, [configured, identityReady]);

  const academicStats = useMemo(() => {
    if (!academyRecord) return null;
    const submitted = academyRecord.attempts.filter(attempt => attempt.status === 'submitted');
    const lessonScores = academyRecord.lessons.map(lesson => {
      const scores = submitted.filter(attempt => attempt.attempt_kind === 'lesson' && attempt.lesson_code === lesson.lesson_code && attempt.score !== null).map(attempt => attempt.score);
      const lessonAverage = average(scores);
      return { lesson, average: lessonAverage, attempts: scores.length, passed: lessonAverage !== null && lessonAverage >= 18 };
    });
    const overallAverage = average(lessonScores.map(item => item.average));
    const passedLessons = lessonScores.filter(item => item.passed).length;
    const subjectKeys = [...new Set(academyRecord.lessons.map(lesson => `${lesson.grade_number}:${lesson.subject_code}`))];
    const subjectExams = subjectKeys.map(key => {
      const [gradeText, code] = key.split(':');
      const gradeNumber = Number(gradeText);
      const lessons = academyRecord.lessons.filter(lesson => lesson.grade_number === gradeNumber && lesson.subject_code === code);
      const title = lessons[0]?.subject?.title ?? code;
      const scores = submitted.filter(attempt => attempt.attempt_kind === 'subject_exam' && attempt.grade_number === gradeNumber && attempt.subject_code === code && attempt.score !== null).map(attempt => attempt.score);
      const subjectAverage = average(scores);
      return { code, gradeNumber, title, average: subjectAverage, attempts: scores.length, passed: subjectAverage !== null && subjectAverage >= 18, lessons };
    });
    const gradeNumbers = [...new Set(academyRecord.lessons.map(lesson => lesson.grade_number))].sort((a,b) => a-b);
    const grades = gradeNumbers.map(grade => {
      const lessons = lessonScores.filter(item => item.lesson.grade_number === grade);
      const exams = subjectExams.filter(subject => subject.gradeNumber === grade);
      const gradeExams = submitted.filter(attempt => attempt.attempt_kind === 'grade_exam' && attempt.grade_number === grade && attempt.score !== null);
      return {
        grade,
        lessons,
        lessonAverage: average(lessons.map(item => item.average)),
        lessonsPassed: lessons.length > 0 && lessons.every(item => item.passed),
        subjectExams: exams,
        gradeExamAverage: average(gradeExams.map(attempt => attempt.score)),
        gradeExamAttempts: gradeExams.length,
        gradeExamPassed: average(gradeExams.map(attempt => attempt.score)) !== null && (average(gradeExams.map(attempt => attempt.score)) ?? 0) >= 26,
      };
    });
    return { submitted, lessonScores, overallAverage, passedLessons, subjectExams, grades, totalAttempts: academyRecord.attempts.length };
  }, [academyRecord]);

  async function openAttemptReview(attemptId: string) {
    setReviewLoading(true);
    setReviewError('');
    setReviewAttempt(null);
    try {
      setReviewAttempt(await loadAcademyAttemptReview(attemptId));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Impossibile caricare la revisione del tentativo.');
    } finally {
      setReviewLoading(false);
    }
  }
  const donePokemon = useMemo(() => new Set(progress.completedIds), [progress.completedIds]);
  const doneEntries = useMemo(() => new Set(progress.completedEntries ?? []), [progress.completedEntries]);
  const catalog = useMemo(() => [...species.map(pokemonCard), ...items.map(itemCard)], [species, items]);
  const stats = useMemo(() => {
    const regions = REGIONS.map(region => {
      const done = [...donePokemon].filter(id => id >= region.start && id <= region.end).length;
      const total = region.end - region.start + 1;
      return { ...region, done, total, percent: done / total * 100, complete: done === total };
    });
    const macros = MACRO_CATEGORIES.map(macro => {
      const cards = catalog.filter(card => card.macroId === macro.id);
      const completed = (card: typeof cards[number]) => card.kind === 'pokemon'
        ? Boolean(card.pokemonId && donePokemon.has(card.pokemonId)) : doneEntries.has(card.id);
      const subs = new Map<string, { name: string; total: number; done: number }>();
      cards.forEach(card => {
        const item = subs.get(card.subcategoryId) ?? { name: card.subcategoryName, total: 0, done: 0 };
        item.total += 1;
        if (completed(card)) item.done += 1;
        subs.set(card.subcategoryId, item);
      });
      const done = cards.filter(completed).length;
      return { ...macro, total: cards.length, done, percent: cards.length ? done / cards.length * 100 : 0, subs: [...subs.values()].sort((a,b) => a.name.localeCompare(b.name, 'it')) };
    });
    return { regions, macros, pokemon: donePokemon.size, percent: donePokemon.size / DEX_SIZE * 100 };
  }, [catalog, donePokemon, doneEntries]);
  const medals = useMemo(() => [
    ...[
      { id: 'first', title: 'Primo passo', desc: 'Cataloga il primo Pokémon.', target: 1 },
      { id: '50', title: 'Collezionista', desc: 'Cataloga 50 Pokémon.', target: 50 },
      { id: '150', title: 'Ricercatore', desc: 'Cataloga 150 Pokémon.', target: 150 },
      { id: '500', title: 'Esperto nazionale', desc: 'Cataloga 500 Pokémon.', target: 500 },
      { id: '1025', title: 'Maestro Pokédex', desc: 'Completa tutti i 1.025 Pokémon.', target: 1025 },
    ].map(m => ({ id: m.id, title: m.title, desc: m.desc, earned: stats.pokemon >= m.target })),
    ...stats.regions.map(r => ({ id: `region-${r.name}`, title: r.name, desc: `Completa il Pokédex di ${r.name}.`, earned: r.complete })),
    ...stats.macros.map(m => ({ id: `macro-${m.id}`, title: m.name, desc: 'Classifica tutte le entità della macrocategoria.', earned: m.total > 0 && m.done === m.total })),
  ], [stats]);
  const history = [...(progress.history ?? [])].map(event => event.kind !== 'exam' ? event : ({ ...event, title: event.title.replace('Esame regionale superato', 'Regione completata').replace('Ricompensa esame riscattata', 'Traguardo registrato'), detail: event.detail.replace(/\s*·\s*\+\d+\s+(?:Punto|Punti) esame/gi, '') })).sort((a,b) => b.timestamp - a.timestamp).slice(0,12);
  const earned = medals.filter(m => m.earned).length;

  return <>
    <div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div>
    <section className="pr-academic-record" aria-labelledby="pr-academic-title">
      <div className="pr-academic-heading">
        <div><span className="eyebrow">PERCORSO FORMATIVO</span><h2 id="pr-academic-title"><GraduationCap size={23}/> Pagella accademica</h2><p>Voti, medie ed esiti registrati nell’Accademia.</p></div>
        <div className="pr-view-switch" role="group" aria-label="Vista della pagella">
          <button type="button" className={registerView === 'summary' ? 'is-active' : ''} aria-pressed={registerView === 'summary'} onClick={() => setRegisterView('summary')}><FileText size={15}/> Sintesi</button>
          <button type="button" className={registerView === 'detail' ? 'is-active' : ''} aria-pressed={registerView === 'detail'} onClick={() => setRegisterView('detail')}><Eye size={15}/> Dettaglio</button>
        </div>
      </div>
      {!configured ? <div className="pr-academic-state"><GraduationCap size={22}/><div><strong>Registro accademico non configurato</strong><p>I risultati saranno disponibili quando il servizio dell’Accademia sarà configurato.</p></div></div>
      : !identityReady ? <div className="pr-academic-state"><GraduationCap size={22}/><div><strong>Collega l’identità online</strong><p>Per consultare voti e tentativi, verifica prima l’identità community dal Profilo allievo.</p></div></div>
      : academyLoading ? <div className="pr-academic-state"><span className="pokeball-loader"/><div><strong>Caricamento della pagella…</strong><p>Recupero dei risultati accademici.</p></div></div>
      : academyError ? <div className="pr-academic-state is-error" role="alert"><AlertTriangle size={22}/><div><strong>Risultati non disponibili</strong><p>{academyError}</p><button type="button" className="secondary-button" onClick={() => { setAcademyRecord(null); setAcademyError(''); setAcademyLoading(true); loadAcademyCurriculum().then(data => setAcademyRecord({lessons:data.lessons,attempts:data.attempts})).catch(error => setAcademyError(error instanceof Error ? error.message : 'Impossibile caricare i risultati accademici.')).finally(() => setAcademyLoading(false)); }}>Riprova</button></div></div>
      : !academyRecord || !academicStats ? <div className="pr-academic-state"><BookOpen size={22}/><div><strong>Nessun dato accademico</strong><p>Quando inizierai il percorso, voti e tentativi appariranno qui.</p></div></div>
      : <>
        <div className="pr-academic-metrics">
          <article><span>MEDIA DELLE LEZIONI</span><strong>{formatGrade(academicStats.overallAverage)}</strong><small>Media delle medie disponibili</small></article>
          <article><span>LEZIONI SUPERATE</span><strong>{academicStats.passedLessons}<small> / {academyRecord.lessons.length}</small></strong><small>Media dei tentativi almeno 18/30</small></article>
          <article><span>TENTATIVI INVIATI</span><strong>{academicStats.submitted.length}</strong><small>{academicStats.totalAttempts} registrati in totale</small></article>
        </div>
        {registerView === 'summary' ? <div className="pr-academic-summary">
          <div className="pr-academic-subheading"><div><strong>Quadro dei gradi</strong><p>Medie ed esiti, senza confondere la media con il superamento ufficiale.</p></div></div>
          {academicStats.grades.length ? academicStats.grades.map(grade => <article className="pr-grade-summary" key={grade.grade}>
            <div className="pr-grade-summary-title"><strong>Grado {grade.grade}</strong><span className={grade.lessonsPassed && grade.lessonAverage !== null && grade.lessonAverage >= 26 && grade.subjectExams.every(item => item.passed) && grade.gradeExamPassed ? 'is-passed' : 'is-pending'}>{grade.lessonsPassed && grade.lessonAverage !== null && grade.lessonAverage >= 26 && grade.subjectExams.length > 0 && grade.subjectExams.every(item => item.passed) && grade.gradeExamPassed ? 'Percorso completato' : 'In corso'}</span></div>
            <div className="pr-grade-summary-values"><div><small>Media lezioni</small><strong>{formatGrade(grade.lessonAverage)}</strong></div><div><small>Esami materia superati</small><strong>{grade.subjectExams.filter(item=>item.passed).length} / {grade.subjectExams.length}</strong></div><div><small>Media esame di grado</small><strong>{formatGrade(grade.gradeExamAverage)}</strong></div></div>
          </article>) : <p className="pr-academic-muted">Il curriculum non contiene ancora gradi pubblicati.</p>}
          <div className="pr-academic-subheading"><div><strong>Esami per materia</strong><p>La media usa solo i tentativi inviati e valutati.</p></div></div>
          <div className="pr-subject-results">{academicStats.subjectExams.map(subject => <article key={subject.code}><div><strong>{subject.title}</strong><span className={subject.passed?'is-passed':'is-pending'}>{subject.passed?'Superato':subject.average === null?'Da sostenere':'Da consolidare'}</span></div><strong className="pr-subject-average">{formatGrade(subject.average)}</strong><small>{subject.attempts} {subject.attempts===1?'tentativo':'tentativi'} valutati</small></article>)}</div>
        </div> : <div className="pr-academic-detail">
          {academicStats.grades.map(grade => <section className="pr-detail-grade" key={grade.grade}>
            <h3>Grado {grade.grade}</h3>
            {grade.subjectExams.map(subject => <div className="pr-detail-subject" key={subject.code}>
              <div className="pr-detail-subject-heading"><strong>{subject.title}</strong><span>Media esame: {formatGrade(subject.average)}</span></div>
              {subject.lessons.map(lesson => {
                const score = academicStats.lessonScores.find(item => item.lesson.lesson_code === lesson.lesson_code);
                const attempts = academyRecord.attempts.filter(item => item.attempt_kind === 'lesson' && item.lesson_code === lesson.lesson_code).sort((a,b) => new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime());
                return <div className="pr-detail-lesson" key={lesson.lesson_code}>
                  <div className="pr-detail-lesson-heading"><div><strong>{lesson.title}</strong><small>{attempts.length} {attempts.length===1?'tentativo':'tentativi'} · media {formatGrade(score?.average ?? null)}</small></div><span className={score?.passed?'is-passed':'is-pending'}>{score?.passed?'Superata':score?.average === null || score?.average === undefined?'Da sostenere':'Da consolidare'}</span></div>
                  {attempts.length ? <ol className="pr-attempt-list">{attempts.map(attempt => <li key={attempt.id}><div><strong>{formatGrade(attempt.score)}</strong><small>{new Date(attempt.submitted_at ?? attempt.created_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})} · {attempt.status==='submitted' ? attempt.passed===true?'Superato':attempt.passed===false?'Non superato':'Valutato' : 'In corso'}</small></div>{attempt.status==='submitted' && <button type="button" className="pr-review-button" onClick={() => void openAttemptReview(attempt.id)}>Rivedi <Eye size={13}/></button>}</li>)}</ol> : <p className="pr-academic-muted">Nessun tentativo registrato.</p>}
                </div>;
              })}
              <div className="pr-detail-exams"><strong>Esami di materia</strong>{academyRecord.attempts.filter(item=>item.attempt_kind==='subject_exam' && item.grade_number===grade.grade && item.subject_code===subject.code && item.status==='submitted').sort((a,b)=>new Date(b.submitted_at ?? b.created_at).getTime()-new Date(a.submitted_at ?? a.created_at).getTime()).map(attempt=><div key={attempt.id}><span>{formatGrade(attempt.score)} · {new Date(attempt.submitted_at ?? attempt.created_at).toLocaleDateString('it-IT')}</span><button type="button" className="pr-review-button" onClick={() => void openAttemptReview(attempt.id)}>Rivedi <Eye size={13}/></button></div>)}</div>
            </div>)}
            <div className="pr-detail-exams pr-grade-exam-history"><strong>Esami di grado</strong>{academyRecord.attempts.filter(item=>item.attempt_kind==='grade_exam' && item.grade_number===grade.grade).sort((a,b)=>new Date(b.submitted_at ?? b.created_at).getTime()-new Date(a.submitted_at ?? a.created_at).getTime()).map(attempt=><div key={attempt.id}><span>{formatGrade(attempt.score)} · {new Date(attempt.submitted_at ?? attempt.created_at).toLocaleDateString('it-IT')} · {attempt.status==='submitted' ? attempt.passed===true?'Superato':attempt.passed===false?'Non superato':'Valutato':'In corso'}</span>{attempt.status==='submitted' && <button type="button" className="pr-review-button" onClick={() => void openAttemptReview(attempt.id)}>Rivedi <Eye size={13}/></button>}</div>)}{!academyRecord.attempts.some(item=>item.attempt_kind==='grade_exam' && item.grade_number===grade.grade) && <p className="pr-academic-muted">Nessun tentativo registrato.</p>}</div>
          </section>)}
        </div>}
      </>}
    </section>
    {reviewLoading && <div className="pr-review-overlay" role="dialog" aria-modal="true" aria-label="Revisione del tentativo"><div className="pr-review-dialog"><div className="pr-review-dialog-heading"><h2>Revisione del tentativo</h2><button type="button" aria-label="Chiudi" onClick={() => setReviewLoading(false)}><X size={18}/></button></div><p>Caricamento delle risposte…</p></div></div>}
    {reviewError && !reviewAttempt && !reviewLoading && <div className="pr-review-overlay" role="dialog" aria-modal="true" aria-label="Revisione non disponibile"><div className="pr-review-dialog"><div className="pr-review-dialog-heading"><h2>Revisione non disponibile</h2><button type="button" aria-label="Chiudi" onClick={() => setReviewError('')}><X size={18}/></button></div><p role="alert">{reviewError}</p></div></div>}
    {reviewAttempt && <div className="pr-review-overlay" role="dialog" aria-modal="true" aria-label="Revisione del tentativo" onClick={() => setReviewAttempt(null)}><div className="pr-review-dialog" onClick={event => event.stopPropagation()}><div className="pr-review-dialog-heading"><div><span className="eyebrow">ESITO {reviewAttempt.passed?'POSITIVO':'DA RIVEDERE'}</span><h2>Revisione del tentativo</h2><p>{formatGrade(reviewAttempt.score)} · {reviewAttempt.correctCount}/{reviewAttempt.questionCount} risposte corrette</p></div><button type="button" aria-label="Chiudi" onClick={() => setReviewAttempt(null)}><X size={18}/></button></div><div className="pr-review-questions">{reviewAttempt.review.map((question,index)=><article key={question.questionId} className={question.isCorrect?'is-correct':'is-wrong'}><div className="pr-review-question-title"><span>{index+1}</span><strong>{question.prompt}</strong><b>{question.isCorrect?'Corretta':'Da rivedere'}</b></div><p><small>La tua risposta</small><strong>{answerLabel(question,question.selectedAnswer)}</strong></p><p><small>Risposta corretta</small><strong>{answerLabel(question,question.correctAnswer)}</strong></p>{question.explanation && <p className="pr-review-explanation">{question.explanation}</p>}{question.sourceTitle && <small className="pr-review-source">Fonte: {question.sourceTitle}{question.sourceUrl ? <> · <a href={question.sourceUrl} target="_blank" rel="noreferrer">Apri fonte</a></> : null}</small>}</article>)}</div></div></div>}
    <header className="pr-hero">
      <div><span className="eyebrow">CATALOGAZIONE · PROGRESSI PERSONALI</span><h1>Progressi di catalogazione</h1><p>Pokédex, collezioni e traguardi personali.</p>
        <div className="pr-total"><strong>{Math.round(stats.percent)}%</strong><span>Pokédex nazionale completato</span></div><Bar value={stats.percent}/><small>{stats.pokemon.toLocaleString('it-IT')} / {DEX_SIZE.toLocaleString('it-IT')} specie</small>
      </div><div className="pr-seal" aria-hidden="true"><Trophy size={32}/><span>REGISTRO</span><b>UFFICIALE</b></div>
    </header>
    <section className="pr-stats" aria-label="Riepilogo risultati">
      <article><i className="pr-icon">✦</i><div><small>PORTAFOGLIO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div></article>
      <article><i className="pr-icon">✦</i><div><small>AIUTI SBLOCCATI</small><strong>{(progress.inventory ?? []).length.toLocaleString('it-IT')}</strong><span>Strumenti e archivi</span></div></article>
      <article><i className="pr-icon"><Medal size={21}/></i><div><small>TRAGUARDI</small><strong>{earned}<em> / {medals.length}</em></strong><span>Medaglie ottenute</span></div></article>
      <article className="pr-errors"><i className="pr-icon"><AlertTriangle size={20}/></i><div><small>ALLENAMENTO</small><strong>{(progress.errors ?? 0).toLocaleString('it-IT')}</strong><span>Errori registrati</span></div></article>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">PANORAMICA</span><h2>Avanzamento per regione</h2></div><b>{stats.regions.filter(r=>r.complete).length} / {REGIONS.length} completate</b></div>
      <div className="pr-regions">{stats.regions.map(r=><article className={r.complete?'is-done':''} key={r.name}><div className="pr-region-head"><i>{r.complete?<CheckCircle2 size={17}/>:r.name.slice(0,2).toUpperCase()}</i><div><strong>{r.name}</strong><small>{r.done} / {r.total} specie</small></div><b>{Math.round(r.percent)}%</b></div><Bar value={r.percent}/><small className="pr-region-note">{r.complete?'Regione completata':`Ancora ${r.total-r.done} da catalogare`}</small></article>)}</div>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">CLASSIFICAZIONE</span><h2>Macrocategorie e sottocategorie</h2></div><b>{stats.macros.filter(m=>m.total>0&&m.done===m.total).length} / {stats.macros.length} complete</b></div>
      {loading?<div className="pr-empty"><span className="pokeball-loader"/><p>Caricamento dei dati del registro…</p></div>:stats.macros.map(m=><details className="pr-macro" key={m.id}>
        <summary><i>{m.id==='pokemon'?<Sparkles size={19}/>:m.id==='special'?<Award size={19}/>:<BookOpen size={19}/>}</i><div><strong>{m.name}</strong><small>{m.done.toLocaleString('it-IT')} / {m.total.toLocaleString('it-IT')} classificate</small><Bar value={m.percent}/></div><b>{Math.round(m.percent)}%</b><span className="pr-chevron">⌄</span></summary>
        <div className="pr-subs">{m.subs.map(s=><div key={s.name}><span>{s.name}</span><small>{s.done} / {s.total}</small><Bar value={s.total?s.done/s.total*100:0}/></div>)}{!m.total&&<p>Nessuna entità disponibile per questa categoria.</p>}</div>
      </details>)}
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">OBIETTIVI</span><h2>Medaglie e traguardi</h2></div><b>{earned} ottenute</b></div>
      <div className="pr-medals">{medals.map(m=><article className={m.earned?'is-earned':''} key={m.id}><i>{m.earned?<Medal size={22}/>:<Award size={22}/>}</i><strong>{m.title}</strong><p>{m.desc}</p><small>{m.earned?'TRAGUARDO RAGGIUNTO':'OBIETTIVO DA COMPLETARE'}</small></article>)}</div>
    </section>
    <section className="pr-section">
      <div className="pr-heading"><div><span className="eyebrow">ATTIVITÀ RECENTE</span><h2>Storico del registro</h2></div><b>{(progress.history??[]).length} eventi salvati</b></div>
      {history.length?<ol className="pr-history">{history.map(event=><li className={`is-${event.kind}`} key={event.id}><i>{event.kind==='error'?<AlertTriangle size={16}/>:event.kind==='exam'?<Trophy size={16}/>:<CheckCircle2 size={16}/>}</i><div><strong>{event.title}</strong><p>{displayName(event.detail)}</p><small><Clock3 size={12}/>{new Date(event.timestamp).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</small></div></li>)}</ol>:<div className="pr-empty"><Clock3 size={25}/><strong>Nessuna attività registrata</strong></div>}
    </section>
    <footer className="pr-footer"><div><strong><RotateCcw size={16}/> Gestione progressi</strong></div><button type="button" className="secondary-button" onClick={onReset}>Azzera progressi</button></footer>
  </>;
}
