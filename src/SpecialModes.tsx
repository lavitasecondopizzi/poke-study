import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Flag, Play, RotateCcw, Target } from 'lucide-react';
import type { CatalogCard, MacroId } from './catalog';
import { MACRO_CATEGORIES, displayName } from './catalog';

type SpecialMode = 'timed-training' | 'custom-challenges';

type Props = {
  mode: SpecialMode;
  cards: CatalogCard[];
  showNames: boolean;
  onCatalogCard: (card: CatalogCard) => void;
  onWrongAnswer: (card: CatalogCard) => void;
  onExit: () => void;
};

const CUSTOM_COUNTS = [10, 20, 30, 50];
const TIME_LIMITS = [1, 3, 5, 10];

function shuffled<T,>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function clockLabel(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

export default function SpecialModes({ mode, cards, showNames, onCatalogCard, onWrongAnswer, onExit }: Props) {
  const [selectedMacros, setSelectedMacros] = useState<MacroId[]>(MACRO_CATEGORIES.map(category => category.id));
  const [questionCount, setQuestionCount] = useState(20);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [sessionCards, setSessionCards] = useState<CatalogCard[] | null>(null);
  const [remainingCards, setRemainingCards] = useState<CatalogCard[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState('');
  const [finished, setFinished] = useState(false);

  const isTimed = mode === 'timed-training';
  const title = isTimed ? 'Allenamento a tempo' : 'Sfide personalizzate';
  const eligibleCards = useMemo(() => cards.filter(card => isTimed || selectedMacros.includes(card.macroId)), [cards, isTimed, selectedMacros]);
  const destinations = useMemo(() => {
    const source = sessionCards ?? eligibleCards;
    const unique = new Map<string, { id: string; name: string; macroName: string }>();
    source.forEach(card => unique.set(card.subcategoryId, { id: card.subcategoryId, name: card.subcategoryName, macroName: card.macroName }));
    return [...unique.values()].sort((a, b) => a.macroName.localeCompare(b.macroName, 'it') || a.name.localeCompare(b.name, 'it'));
  }, [sessionCards, eligibleCards]);
  const activeCard = remainingCards[0] ?? null;
  const timeLeft = deadline === null ? durationMinutes * 60 : Math.max(0, Math.ceil((deadline - now) / 1000));
  const sessionEnded = finished || (isTimed && deadline !== null && timeLeft <= 0) || (sessionCards !== null && remainingCards.length === 0);

  useEffect(() => {
    if (!isTimed || deadline === null || finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isTimed, deadline, finished]);

  useEffect(() => {
    if (isTimed && deadline !== null && now >= deadline && !finished) setFinished(true);
  }, [isTimed, deadline, now, finished]);

  function startSession() {
    const source = isTimed ? cards : cards.filter(card => selectedMacros.includes(card.macroId));
    const shuffledCards = shuffled(source).slice(0, isTimed ? source.length : questionCount);
    setSessionCards(shuffledCards);
    setRemainingCards(shuffledCards);
    setScore(0);
    setAttempts(0);
    setErrors(0);
    setSelectedCardId(shuffledCards[0]?.id ?? null);
    setFeedback('');
    setFinished(shuffledCards.length === 0);
    const startedAt = Date.now();
    setNow(startedAt);
    setDeadline(isTimed ? startedAt + durationMinutes * 60_000 : null);
  }

  function chooseDestination(destinationId: string) {
    if (!activeCard || sessionEnded) return;
    setAttempts(value => value + 1);
    if (activeCard.subcategoryId !== destinationId) {
      setErrors(value => value + 1);
      setFeedback('Tentativo non corretto. Riprova senza suggerimenti.');
      onWrongAnswer(activeCard);
      return;
    }
    setScore(value => value + 1);
    setFeedback('Classificazione corretta.');
    onCatalogCard(activeCard);
    const next = remainingCards.filter(card => card.id !== activeCard.id);
    setRemainingCards(next);
    setSelectedCardId(next[0]?.id ?? null);
    if (next.length === 0) setFinished(true);
  }

  function restartSetup() {
    setSessionCards(null);
    setRemainingCards([]);
    setSelectedCardId(null);
    setDeadline(null);
    setFinished(false);
    setFeedback('');
  }

  return (
    <div className="special-mode-page">
      <div className="breadcrumb">Home / Gioco / <b>{title}</b></div>
      <header className="special-mode-hero">
        <div>
          <span className="eyebrow">POKÉ STUDY · MODALITÀ SPECIALE</span>
          <h1>{title}</h1>
          <p>{isTimed
            ? 'Classifica più entità possibili prima che il tempo scada. Ogni risposta corretta contribuisce alla catalogazione normale.'
            : 'Crea una sessione scegliendo le aree del catalogo e il numero di entità da classificare.'}</p>
        </div>
        <div className="special-mode-emblem" aria-hidden="true">{isTimed ? <Clock3 size={30}/> : <Target size={30}/>}</div>
      </header>

      {sessionCards === null ? (
        <section className="special-mode-setup">
          <div className="special-mode-section-heading"><span>CONFIGURAZIONE</span><h2>{isTimed ? 'Imposta il tempo a disposizione' : 'Definisci la tua sfida'}</h2></div>
          {!isTimed && <>
            <div className="special-mode-field">
              <strong>Macrocategorie incluse</strong>
              <p>Seleziona una o più aree. La sfida userà soltanto entità non ancora catalogate.</p>
              <div className="special-mode-category-grid">
                {MACRO_CATEGORIES.map(category => {
                  const count = cards.filter(card => card.macroId === category.id).length;
                  const checked = selectedMacros.includes(category.id);
                  return <button type="button" key={category.id} className={checked ? 'is-selected' : ''} aria-pressed={checked} disabled={count === 0} onClick={() => setSelectedMacros(current => checked ? current.filter(id => id !== category.id) : [...current, category.id])}>
                    <span className="special-mode-check">{checked ? '✓' : '+'}</span><strong>{category.name}</strong><small>{count.toLocaleString('it-IT')} entità disponibili</small>
                  </button>;
                })}
              </div>
            </div>
            <div className="special-mode-field">
              <strong>Dimensione della sfida</strong>
              <div className="special-mode-choice-row">
                {CUSTOM_COUNTS.map(count => <button type="button" key={count} className={questionCount === count ? 'is-selected' : ''} aria-pressed={questionCount === count} onClick={() => setQuestionCount(count)}>{count} entità</button>)}
              </div>
              <small>La sessione userà tutte le entità disponibili se il numero selezionato è superiore al catalogo filtrato.</small>
            </div>
          </>}
          {isTimed && <div className="special-mode-field">
            <strong>Durata</strong>
            <div className="special-mode-choice-row">
              {TIME_LIMITS.map(minutes => <button type="button" key={minutes} className={durationMinutes === minutes ? 'is-selected' : ''} aria-pressed={durationMinutes === minutes} onClick={() => setDurationMinutes(minutes)}>{minutes} {minutes === 1 ? 'minuto' : 'minuti'}</button>)}
            </div>
            <p>Le entità vengono estratte casualmente dal catalogo ancora da completare. La sessione termina allo scadere del tempo o quando non restano entità disponibili.</p>
          </div>}
          <div className="special-mode-setup-footer">
            <span>{(isTimed ? cards.length : eligibleCards.length).toLocaleString('it-IT')} entità disponibili · Nessun PP extra per la modalità</span>
            <button type="button" className="primary-button" disabled={cards.length === 0 || (!isTimed && (selectedMacros.length === 0 || eligibleCards.length === 0))} onClick={startSession}><Play size={16}/> Inizia {isTimed ? 'allenamento' : 'sfida'}</button>
          </div>
          <button type="button" className="special-mode-back" onClick={onExit}><ArrowLeft size={15}/> Torna a Gioca</button>
        </section>
      ) : (
        <section className="special-mode-session">
          <div className="special-mode-stats">
            <div><span>CLASSIFICATE</span><strong>{score} <small>/ {sessionCards.length}</small></strong></div>
            <div><span>TENTATIVI</span><strong>{attempts}</strong></div>
            <div><span>ERRORI</span><strong>{errors}</strong></div>
            {isTimed && <div className={timeLeft <= 15 ? 'is-urgent' : ''}><span>TEMPO</span><strong><Clock3 size={17}/>{clockLabel(timeLeft)}</strong></div>}
          </div>
          {sessionEnded ? (
            <div className="special-mode-results">
              <span className="special-mode-results-icon"><CheckCircle2 size={28}/></span>
              <span className="eyebrow">SESSIONE CONCLUSA</span>
              <h2>{isTimed && timeLeft <= 0 ? 'Tempo scaduto' : 'Sfida completata'}</h2>
              <p>Hai classificato correttamente {score} entità su {sessionCards.length}. Errori: {errors}. Le entità corrette sono state aggiunte alla catalogazione normale e valgono soltanto i PP previsti dal gioco.</p>
              {isTimed && <strong className="special-mode-final-time">Tempo finale: {clockLabel(timeLeft)}</strong>}
              <div className="special-mode-result-actions"><button type="button" className="primary-button" onClick={restartSetup}><RotateCcw size={16}/> Nuova sessione</button><button type="button" className="secondary-button" onClick={onExit}><ArrowLeft size={16}/> Torna a Gioca</button></div>
            </div>
          ) : activeCard ? (
            <>
              <div className="special-mode-progress"><span style={{ width: (score / Math.max(1, sessionCards.length) * 100) + '%' }}/></div>
              <div className="special-mode-question">
                <span className="eyebrow">ENTITÀ {score + 1} DI {sessionCards.length}</span>
                <div className="special-mode-card-art"><img src={activeCard.imageUrl} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/></div>
                {showNames && <strong className="special-mode-card-name">{displayName(activeCard.name)}</strong>}
                <p>Seleziona la sottocategoria corretta per questa entità.</p>
              </div>
              <div className="special-mode-destinations">
                {destinations.map(destination => <button type="button" key={destination.id} onClick={() => chooseDestination(destination.id)} disabled={sessionEnded}>
                  <small>{destination.macroName}</small><strong>{destination.name}</strong>
                </button>)}
              </div>
              <div className="special-mode-feedback" role="status">{feedback || 'Scegli una destinazione. Le risposte errate non mostrano la soluzione.'}</div>
              <div className="special-mode-session-footer"><span>{remainingCards.length} entità da completare in questa sessione</span><button type="button" className="secondary-button" onClick={() => setFinished(true)}><Flag size={15}/> Termina sessione</button></div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
