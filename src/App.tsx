import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen, ChevronRight, CircleHelp, FlaskConical, GraduationCap, Menu, ShoppingBag, Trophy, X } from 'lucide-react';
import type { PokemonSpecies, SavedProgress } from './types';

const NATIONAL_DEX_SIZE = 1025;
const SAVE_KEY = 'poke-study-progress-v1';
const ACADEMY_KEY = 'poke-study-academy-v1';
const STUDENT_KEY = 'poke-study-student-v1';

type StudentProfile = { nickname: string; matricola: string };

function loadStudent(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as StudentProfile;
    return profile.nickname && profile.matricola ? profile : null;
  } catch { return null; }
}

function createMatricola() {
  return `PS-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const regions = [
  { name: 'Kanto', start: 1, end: 151 },
  { name: 'Johto', start: 152, end: 251 },
  { name: 'Hoenn', start: 252, end: 386 },
  { name: 'Sinnoh', start: 387, end: 493 },
  { name: 'Unima', start: 494, end: 649 },
  { name: 'Kalos', start: 650, end: 721 },
  { name: 'Alola', start: 722, end: 809 },
  { name: 'Galar', start: 810, end: 905 },
  { name: 'Paldea', start: 906, end: 1025 },
];

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw) as SavedProgress;
  } catch { /* storage may be unavailable */ }
  return { points: 0, completedIds: [], examPoints: 0 };
}

function titleCase(name: string) {
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function spriteUrl(id: number) {
  return `${import.meta.env.BASE_URL}pokemon/${id}.png`;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function App() {
  const [species, setSpecies] = useState<PokemonSpecies[]>([]);
  const [order, setOrder] = useState<PokemonSpecies[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [selected, setSelected] = useState<number | null>(null);
  const [slotPage, setSlotPage] = useState(0);
  const [pokemonPage, setPokemonPage] = useState(0);
  const [message, setMessage] = useState('Trascina ogni Pokémon sul suo numero Nazionale. Tutte le specie sono disponibili fin da subito.');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [academy, setAcademy] = useState<string>(() => {
    try { return localStorage.getItem(ACADEMY_KEY) ?? ''; } catch { return ''; }
  });
  const [student, setStudent] = useState<StudentProfile | null>(loadStudent);
  const [showEnrollmentCard, setShowEnrollmentCard] = useState(false);
  const [nickname, setNickname] = useState('');
  const [view, setView] = useState('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [wrongId, setWrongId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}data/pokemon.json`)
      .then(response => {
        if (!response.ok) throw new Error('Il servizio dati non risponde.');
        return response.json();
      })
      .then(data => {
        if (!active) return;
        const list = (data as PokemonSpecies[])
          .filter(item => item.id > 0 && item.id <= NATIONAL_DEX_SIZE)
          .sort((a, b) => a.id - b.id);
        const mixed = shuffled(list);
        setSpecies(list);
        setOrder(mixed);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('Non è stato possibile caricare il Pokédex. Controlla la connessione e riprova.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage may be unavailable */ }
  }, [progress]);

  const completedSet = useMemo(() => new Set(progress.completedIds), [progress.completedIds]);
  const speciesById = useMemo(() => new Map(species.map(pokemon => [pokemon.id, pokemon])), [species]);
  const slots = useMemo(() => Array.from({ length: NATIONAL_DEX_SIZE }, (_, index) => index + 1), []);
  const remaining = useMemo(() => order.filter(pokemon => !completedSet.has(pokemon.id)), [order, completedSet]);
  const slotsPerPage = 15;
  const pokemonPerPage = 15;
  const slotPageCount = Math.max(1, Math.ceil(slots.length / slotsPerPage));
  const pokemonPageCount = Math.max(1, Math.ceil(remaining.length / pokemonPerPage));
  const safeSlotPage = Math.min(slotPage, slotPageCount - 1);
  const safePokemonPage = Math.min(pokemonPage, pokemonPageCount - 1);
  const visibleSlots = slots.slice(safeSlotPage * slotsPerPage, (safeSlotPage + 1) * slotsPerPage);
  const visiblePokemon = remaining.slice(safePokemonPage * pokemonPerPage, (safePokemonPage + 1) * pokemonPerPage);

  const placePokemon = useCallback((pokemon: PokemonSpecies, slotId: number) => {
    if (completedSet.has(pokemon.id)) return;
    if (pokemon.id !== slotId) {
      setWrongId(slotId);
      setMessage(`Non è lo slot corretto per ${titleCase(pokemon.name)}. Riprova: i tentativi sono illimitati e non ci sono penalità.`);
      window.setTimeout(() => setWrongId(current => current === slotId ? null : current), 650);
      return;
    }
    setProgress(old => {
      if (old.completedIds.includes(pokemon.id)) return old;
      const completedIds = [...old.completedIds, pokemon.id];
      const examsBefore = regions.filter(region =>
        Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
          .every(id => old.completedIds.includes(id)),
      ).length;
      const examsAfter = regions.filter(region =>
        Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
          .every(id => completedIds.includes(id)),
      ).length;
      return {
        points: old.points + 1,
        completedIds,
        examPoints: old.examPoints + Math.max(0, examsAfter - examsBefore),
      };
    });
    setSelected(null);
    setWrongId(null);
    setMessage(`Corretto! ${titleCase(pokemon.name)} è il Pokémon n. ${pokemon.id}. +1 Punto Poké.`);
  }, [completedSet]);

  function chooseAcademy(next: string) {
    setAcademy(next);
  }

  function completeEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    if (!academy || !cleanNickname) return;
    const profile = { nickname: cleanNickname, matricola: createMatricola() };
    try {
      localStorage.setItem(ACADEMY_KEY, academy);
      localStorage.setItem(STUDENT_KEY, JSON.stringify(profile));
    } catch { /* storage may be unavailable */ }
    setStudent(profile);
    setShowEnrollmentCard(true);
  }

  function navTo(next: string) {
    setView(next);
    setMobileMenu(false);
  }

  if (!academy || !student) {
    if (academy && !student) {
      return (
        <main className="academy-choice-shell enrollment-shell">
          <div className="academy-choice-topline">POKÉ STUDY · PROCEDURA DI IMMATRICOLAZIONE</div>
          <header className="academy-choice-brand">
            <div className="pokeball-mark" aria-hidden="true"><span /></div>
            <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Completa l'iscrizione</h1><p>Portale dello studente · Nuovo allievo</p></div>
          </header>
          <section className="academy-choice-intro">
            <span className="academy-choice-label">ACCADEMIA SELEZIONATA</span>
            <h2>{academy === 'arancia' ? 'Accademia Arancia' : 'Accademia Uva'}</h2>
            <p>Inserisci il nickname che userai nel portale. Ti verrà assegnato un codice matricola personale, salvato su questo dispositivo.</p>
          </section>
          <form className="enrollment-form" onSubmit={completeEnrollment}>
            <label htmlFor="student-nickname">Nickname allievo</label>
            <input id="student-nickname" name="nickname" type="text" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Es. AllenatorePikachu" maxLength={24} autoComplete="nickname" required />
            <p className="enrollment-note">Da 1 a 24 caratteri. Potrai usare il nickname per riconoscere il tuo profilo.</p>
            <button className="enrollment-submit" type="submit">Completa l'iscrizione <ChevronRight size={18} /></button>
            <button className="enrollment-back" type="button" onClick={() => setAcademy('')}>← Cambia accademia</button>
          </form>
          <p className="academy-choice-footnote">Il codice matricola viene generato al completamento dell'iscrizione. Il profilo e i progressi restano salvati nel browser.</p>
        </main>
      );
    }
    return (
      <main className="academy-choice-shell">
        <div className="academy-choice-topline">POKÉ STUDY · PORTALE DI AMMISSIONE</div>
        <header className="academy-choice-brand">
          <div className="pokeball-mark" aria-hidden="true"><span /></div>
          <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Accademia Pokémon</h1><p>Portale dello studente · Iscrizione</p></div>
        </header>
        <section className="academy-choice-intro">
          <span className="academy-choice-label">NUOVO ALLIEVO · ANNO ACCADEMICO 2026</span>
          <h2>In quale accademia vuoi studiare?</h2>
          <p>Scegli la tua accademia di Paldea. La scelta verrà salvata sul dispositivo insieme al tuo profilo di gioco.</p>
        </section>
        <div className="academy-choice-grid">
          <button className="academy-choice-card academy-orange" onClick={() => chooseAcademy('arancia')}>
            <div className="academy-crest crest-orange"><span>A</span></div>
            <span className="academy-game-tag">POKÉMON SCARLATTO</span>
            <h3>Accademia Arancia</h3>
            <p>La scuola di Scarlatto, con i colori e il simbolo dell'arancia.</p>
            <span className="academy-enroll">ISCRIVITI ALL'ACCADEMIA <ChevronRight size={17}/></span>
          </button>
          <button className="academy-choice-card academy-purple" onClick={() => chooseAcademy('uva')}>
            <div className="academy-crest crest-purple"><span>U</span></div>
            <span className="academy-game-tag">POKÉMON VIOLETTO</span>
            <h3>Accademia Uva</h3>
            <p>La scuola di Violetto, con i colori e il simbolo dell'uva.</p>
            <span className="academy-enroll">ISCRIVITI ALL'ACCADEMIA <ChevronRight size={17}/></span>
          </button>
        </div>
        <p className="academy-choice-footnote">La scelta dell'accademia non modifica il Pokédex: tutte le 1.025 specie restano disponibili fin dall'inizio.</p>
      </main>
    );
  }

  if (showEnrollmentCard && student) {
    return (
      <main className="academy-choice-shell enrollment-shell enrollment-success">
        <div className="academy-choice-topline">POKÉ STUDY · IMMATRICOLAZIONE COMPLETATA</div>
        <header className="academy-choice-brand">
          <div className="pokeball-mark" aria-hidden="true"><span /></div>
          <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Benvenuto, {student.nickname}!</h1><p>La tua iscrizione è stata registrata.</p></div>
        </header>
        <section className="academy-choice-intro">
          <span className="academy-choice-label">PROFILO ALLIEVO CREATO</span>
          <h2>{academy === 'arancia' ? 'Accademia Arancia' : 'Accademia Uva'}</h2>
          <p>Conserva il tuo codice matricola: identifica il tuo profilo su questo dispositivo.</p>
        </section>
        <section className="matricola-card" aria-label="Codice matricola assegnato">
          <span>CODICE MATRICOLA</span>
          <strong>{student.matricola}</strong>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(student.matricola); }}>Copia codice</button>
        </section>
        <button className="enrollment-submit enrollment-enter" type="button" onClick={() => { setShowEnrollmentCard(false); setView('home'); }}>Entra nel portale <ChevronRight size={18} /></button>
        <p className="academy-choice-footnote">Nickname e matricola sono salvati nel browser insieme ai tuoi progressi.</p>
      </main>
    );
  }

  return (
    <div className={"site-shell academy-theme-" + academy}>
      <div className="utility-bar">
        <span>PORTALE ALLIEVI · DIPARTIMENTO DI RICERCA POKÉMON</span>
        <span className="utility-right">AREA DIDATTICA <b>● ONLINE</b></span>
      </div>
      <header className="masthead">
        <button className="mobile-toggle" aria-label="Apri menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="pokeball-mark" aria-label="Poké Ball"><span /></div>
        <div className="brand">
          <div className="brand-kicker">ACCADEMIA POKÉMON</div>
          <div className="brand-name">Accademia Pokémon <span>✦</span></div>
          <div className="brand-subtitle">Portale dello studente</div>
        </div>
        <div className="student-card"><div className="student-avatar">★</div><div><small>PROFILO ALLIEVO</small><strong>{student?.nickname ?? 'Allenatore in formazione'}</strong><span>{student?.matricola ?? ''}</span><span>{academy === 'arancia' ? 'Accademia Arancia' : 'Accademia Uva'}</span></div></div>
      </header>
      <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={16} /> Portale</button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Pokédex Nazionale</button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria</button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca studenti</button>
        <div className="nav-status">ARCHIVIO NAZIONALE · 1–1025</div>
      </nav>

      <main className={view === 'pokedex' ? "page-layout game-layout" : "page-layout"}>
        <aside className="sidebar">
          <section className="side-box">
            <h2>AREA ALLIEVO</h2>
            <button className={view === 'pokedex' ? 'side-active' : ''} onClick={() => navTo('pokedex')}>▸ Pokédex Nazionale</button>
            <button className={view === 'registro' ? 'side-active' : ''} onClick={() => navTo('registro')}>▸ Registro personale</button>
            <button className={view === 'shop' ? 'side-active' : ''} onClick={() => navTo('shop')}>▸ Cartoleria punti</button>
          </section>
          <section className="side-box">
            <h2>LIBRETTO PERSONALE</h2>
            <div className="stat-row"><span>Punti Poké</span><strong>{progress.points}</strong></div>
            <div className="stat-row"><span>Punti esame</span><strong>{progress.examPoints}</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%` }} /></div>
            <small className="muted">{progress.completedIds.length} / {NATIONAL_DEX_SIZE} specie catalogate</small>
          </section>
          <section className="notice-box"><strong>AVVISO DEL PRESIDE</strong><p>Tutti i Pokémon e tutti i numeri Nazionali sono disponibili fin dall'inizio. Ogni collocazione corretta vale un Punto Poké; gli errori non comportano penalità.</p></section>
          <div className="side-footer">POKÉ STUDY v0.2<br />Un progetto fan-made.</div>
        </aside>

        <section className="content">
          {view === 'home' && <>
            <div className="breadcrumb">Portale dello studente / <b>Pagina iniziale</b></div>
            <section className="welcome-panel">
              <div className="welcome-copy">
                <div className="welcome-ribbon"><span>✦</span> BENVENUTO IN ACCADEMIA</div>
                <h1>Il tuo viaggio nel mondo Pokémon comincia qui!</h1>
                <p>Cataloga le specie del Pokédex Nazionale, tieni traccia dei tuoi progressi e scopri nuove curiosità dal nostro archivio scientifico.</p>
                <button className="enter-pokedex" onClick={() => navTo('pokedex')}><BookOpen size={18} /> ENTRA NEL POKÉDEX <ChevronRight size={19} /></button>
              </div>
              <div className="welcome-art"><div className="art-sun" /><div className="art-book"><BookOpen size={68} strokeWidth={1.3}/></div><div className="art-caption">IL SAPERE È LA TUA<br/>PRIMA POKÉ BALL!</div></div>
            </section>
            <div className="currency-row">
              <div className="currency-card poke-currency"><div className="currency-icon">₱</div><div><small>PORTAFOGLIO ALLIEVO</small><strong>{progress.points.toLocaleString('it-IT')} <span>Punti Poké</span></strong><p>Per strumenti e oggetti utili</p></div><div className="currency-gloss" /></div>
              <div className="currency-card exam-currency"><div className="currency-icon">★</div><div><small>RISULTATI ACCADEMICI</small><strong>{progress.examPoints.toLocaleString('it-IT')} <span>Punti esame</span></strong><p>Per sbloccare e potenziare super-aiuti</p></div><div className="currency-gloss" /></div>
            </div>
            <section className="portal-menu-panel">
              <div className="portal-panel-heading"><div><span>AREA PERSONALE</span><h2>Che cosa vuoi fare oggi?</h2></div><span className="panel-badge">MENU ALLIEVO</span></div>
              <button className="portal-menu-item" onClick={() => navTo('pokedex')}><span className="menu-item-icon blue-icon"><BookOpen size={22}/></span><span className="menu-item-copy"><strong>Pokédex Nazionale</strong><small>Cataloga tutte le 1.025 specie disponibili</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('pokedex')}><span className="menu-item-icon green-icon"><FlaskConical size={22}/></span><span className="menu-item-copy"><strong>Archivio scientifico</strong><small>Cerca una specie per nome o numero</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('forum')}><span className="menu-item-icon orange-icon"><CircleHelp size={22}/></span><span className="menu-item-copy"><strong>Forum studenti</strong><small>Avvisi, guide e comunicazioni dell'Accademia</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('shop')}><span className="menu-item-icon purple-icon"><ShoppingBag size={22}/></span><span className="menu-item-copy"><strong>Negozio strumenti</strong><small>Usa i tuoi punti per prepararti alle ricerche</small></span><ChevronRight className="menu-chevron"/></button>
            </section>
            <section className="home-progress-panel"><div><div className="progress-medal">★</div><div><span className="section-label">IL TUO PERCORSO</span><h2>Registro personale</h2><p>Hai catalogato {progress.completedIds.length} specie su {NATIONAL_DEX_SIZE}.</p></div></div><button className="secondary-button" onClick={() => navTo('registro')}>Apri registro <ChevronRight size={15}/></button><div className="home-progress-track"><span style={{width: `${Math.min(100,progress.completedIds.length/NATIONAL_DEX_SIZE*100)}%`}}/></div></section>
          </>}
          {view === 'pokedex' && <>
            {loadError && <div className="error-panel"><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Riprova</button></div>}
            <section className="challenge-board game-board">
              <section className="game-zone game-slots-zone" aria-label="Numeri del Pokédex">
                <div className="game-zone-heading"><strong>NUMERI</strong><span>{progress.completedIds.length} catalogati</span></div>
                <div className="slots-grid">
                  {visibleSlots.map(slotId => {
                    const isFilled = completedSet.has(slotId);
                    const pokemon = speciesById.get(slotId);
                    return <div key={slotId} role="button" tabIndex={0} aria-label={`Slot numero ${slotId}${isFilled ? ', catalogato' : ', vuoto'}`} className={`dex-slot ${isFilled ? 'slot-filled' : ''} ${wrongId === slotId ? 'slot-wrong' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = Number(event.dataTransfer.getData('text/plain')); const dragged = speciesById.get(id); if (dragged) placePokemon(dragged, slotId); }} onClick={() => { if (selected !== null) { const chosen = speciesById.get(selected); if (chosen) placePokemon(chosen, slotId); } }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && selected !== null) { const chosen = speciesById.get(selected); if (chosen) placePokemon(chosen, slotId); } }}>
                      <span className="slot-number">{String(slotId).padStart(4, '0')}</span>
                      {isFilled && pokemon ? <img src={spriteUrl(pokemon.id)} alt="" loading="lazy" /> : <span className="slot-empty">?</span>}
                      {isFilled && pokemon && <strong>{titleCase(pokemon.name)}</strong>}
                      {isFilled && <span className="slot-check">✓</span>}
                    </div>;
                  })}
                </div>
                <div className="game-pagination" aria-label="Paginazione numeri">
                  <button type="button" disabled={safeSlotPage <= 0} onClick={() => setSlotPage(Math.max(0, safeSlotPage - 1))}>‹ Indietro</button>
                  <span>Pagina {safeSlotPage + 1} / {slotPageCount}</span>
                  <button type="button" disabled={safeSlotPage >= slotPageCount - 1} onClick={() => setSlotPage(Math.min(slotPageCount - 1, safeSlotPage + 1))}>Avanti ›</button>
                </div>
              </section>
              <div className={`feedback-bar game-feedback ${message.startsWith('Corretto') ? 'feedback-success' : wrongId !== null ? 'feedback-error' : ''}`} role="status">{message}</div>
              <section className="game-zone game-pokemon-zone" aria-label="Pokémon selezionabili">
                <div className="game-zone-heading"><strong>POKÉMON</strong><span>{remaining.length} disponibili</span></div>
                {loading ? <div className="loading-panel"><div className="pokeball-loader" /><h3>Caricamento…</h3></div> : remaining.length > 0 ? <div className="pokemon-cards">
                  {visiblePokemon.map(pokemon => <button key={pokemon.id} aria-label="Seleziona Pokémon" title="Seleziona Pokémon" className={`pokemon-card ${selected === pokemon.id ? 'chosen' : ''}`} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(pokemon.id))} onClick={() => { setSelected(pokemon.id); setMessage('Pokémon selezionato. Tocca il numero corretto.'); }}>
                    <img src={spriteUrl(pokemon.id)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                  </button>)}
                </div> : <div className="round-complete"><h3>Pokédex completato!</h3></div>}
                {!loading && remaining.length > 0 && <div className="game-pagination" aria-label="Paginazione Pokémon">
                  <button type="button" disabled={safePokemonPage <= 0} onClick={() => setPokemonPage(Math.max(0, safePokemonPage - 1))}>‹ Indietro</button>
                  <span>Pagina {safePokemonPage + 1} / {pokemonPageCount}</span>
                  <button type="button" disabled={safePokemonPage >= pokemonPageCount - 1} onClick={() => setPokemonPage(Math.min(pokemonPageCount - 1, safePokemonPage + 1))}>Avanti ›</button>
                </div>}
              </section>
            </section>
          </>}
          {view === 'registro' && <><div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div><div className="page-heading"><div><div className="eyebrow">SEGRETERIA DIDATTICA</div><h1>Registro personale</h1><p>Il riepilogo dei progressi nel catalogo Nazionale completo.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length} <small>/ 1025</small></strong></div></div><section className="archive-search"><h2>Avanzamento per regione</h2>{regions.map(region => { const count = progress.completedIds.filter(id => id >= region.start && id <= region.end).length; const total = region.end - region.start + 1; return <div className="region-progress" key={region.name}><div><b>{region.name}</b><span>{count} / {total}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div>{count === total && <small className="exam-earned">Regione completata · Punto esame ottenuto</small>}</div>})}<button className="secondary-button reset-button" onClick={() => { if (window.confirm('Vuoi azzerare punteggio e progressi salvati su questo dispositivo?')) { setProgress({ points: 0, completedIds: [], examPoints: 0 }); setSelected(null); setMessage('Progressi azzerati. Tutti i Pokémon sono nuovamente disponibili.'); } }}>Azzera progressi</button></section></>}
          {view === 'shop' && <><div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div><div className="page-heading"><div><div className="eyebrow">SERVIZI STUDENTI</div><h1>Cartoleria punti</h1><p>I Punti Poké serviranno per gli strumenti; i Punti esame per acquistare e potenziare i super-aiuti.</p></div></div><div className="empty-service"><ShoppingBag size={34} /><h2>Catalogo in allestimento</h2><p>La cartoleria verrà attivata con un prossimo aggiornamento. I tuoi punti sono già registrati.</p><div className="currency-pills"><span>{progress.points} Punti Poké</span><span>{progress.examPoints} Punti esame</span></div></div></>}
          {view === 'forum' && <><div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div><div className="page-heading"><div><div className="eyebrow">COMUNITÀ SCOLASTICA</div><h1>Bacheca studenti</h1><p>Avvisi e appunti dell'archivio Pokémon.</p></div></div><section className="forum-post"><div className="post-icon">📌</div><div><span className="section-label">AVVISO DEL PRESIDE</span><h2>Benvenuto nel Pokédex Nazionale</h2><p>Tutte le specie e tutti i numeri sono disponibili fin dall'inizio. Catalogare è un'attività continua: ogni collocazione corretta aggiunge un Punto Poké e gli errori non sottraggono punti. Completando una regione ottieni un Punto esame.</p><small>SEGRETERIA DIDATTICA</small></div></section><section className="forum-post"><div className="post-icon">📚</div><div><span className="section-label">GUIDA RAPIDA</span><h2>Come funziona la catalogazione</h2><p>Le schede Pokémon sono mescolate e possono essere trascinate sul numero Nazionale corrispondente. Su mobile, seleziona la scheda e poi tocca lo slot. Non ci sono lezioni, turni o sblocchi progressivi.</p><small>MANUALE DELLO STUDENTE</small></div></section></>}
          <footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
      <nav className="mobile-app-nav" aria-label="Navigazione principale">
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={20}/><span>Portale</span></button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={20}/><span>Pokédex</span></button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={20}/><span>Registro</span></button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={20}/><span>Negozio</span></button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={20}/><span>Bacheca</span></button>
      </nav>
    </div>
  );
}
