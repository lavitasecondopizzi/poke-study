import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { BookOpen, ChevronRight, CircleHelp, FlaskConical, GraduationCap, Menu, ShoppingBag, Trophy, X } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies, PokemonTypeIndex, SavedProgress, StudentProfile } from './types';

const NATIONAL_DEX_SIZE = 1025;
const SAVE_KEY = 'poke-study-progress-v1';
const ACADEMY_KEY = 'poke-study-academy-v1';
const STUDENT_KEY = 'poke-study-student-v1';



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
    if (raw) { const saved = JSON.parse(raw) as Partial<SavedProgress>; return { points: Number(saved.points) || 0, completedIds: Array.isArray(saved.completedIds) ? saved.completedIds : [], examPoints: Number(saved.examPoints) || 0, completedExams: Array.isArray(saved.completedExams) ? saved.completedExams : [], inventory: Array.isArray(saved.inventory) ? saved.inventory : [] }; }
  } catch { /* storage may be unavailable */ }
  return { points: 0, completedIds: [], examPoints: 0, completedExams: [], inventory: [] };
}

function titleCase(name: string) {
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function itemSpriteUrl(name: string) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
}

function resourceId(url: string) {
  return Number(url.match(/\\/(\\d+)\\/?$/)?.[1] ?? 0);
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
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [itemCatalog, setItemCatalog] = useState<ApiNamedResource[]>([]);
  const [itemPage, setItemPage] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const [shopTab, setShopTab] = useState<'oggetti' | 'super-aiuti'>('oggetti');
  const [typeCatalog, setTypeCatalog] = useState<PokemonTypeIndex[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const [avatarPage, setAvatarPage] = useState(0);
  const [avatarSearch, setAvatarSearch] = useState('');
  const [notice, setNotice] = useState('');

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

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (view !== 'shop' || itemCatalog.length) return;
    let active = true;
    const cacheKey = 'poke-study-api-items-v1';
    try { const cached = localStorage.getItem(cacheKey); if (cached) setItemCatalog(JSON.parse(cached) as ApiNamedResource[]); } catch { /* ignore broken cache */ }
    if (!navigator.onLine) return;
    fetch('https://pokeapi.co/api/v2/item?limit=2000')
      .then(response => { if (!response.ok) throw new Error('API oggetti non disponibile'); return response.json(); })
      .then(payload => {
        if (!active) return;
        const items = (payload.results as ApiNamedResource[]).sort((a, b) => a.name.localeCompare(b.name));
        setItemCatalog(items);
        try { localStorage.setItem(cacheKey, JSON.stringify(items)); } catch { /* quota storage */ }
      })
      .catch(() => { if (active && !itemCatalog.length) setNotice('Catalogo API non raggiungibile: riprova quando torni online.'); });
    return () => { active = false; };
  }, [view, itemCatalog.length, online]);

  useEffect(() => {
    if (view !== 'esami' || typeCatalog.length || typeLoading) return;
    let active = true;
    const cacheKey = 'poke-study-api-types-v1';
    try { const cached = localStorage.getItem(cacheKey); if (cached) { setTypeCatalog(JSON.parse(cached) as PokemonTypeIndex[]); return; } } catch { /* ignore broken cache */ }
    if (!navigator.onLine) { setNotice('Gli esami per tipo richiedono il primo caricamento online.'); return; }
    setTypeLoading(true);
    fetch('https://pokeapi.co/api/v2/type?limit=30')
      .then(response => { if (!response.ok) throw new Error('API tipi non disponibile'); return response.json(); })
      .then(payload => (payload.results as ApiNamedResource[]).filter(type => { const id = resourceId(type.url); return id >= 1 && id <= 18; }))
      .then(async types => Promise.all(types.map(async type => {
        const response = await fetch(type.url);
        if (!response.ok) throw new Error('Dettaglio tipo non disponibile');
        const detail = await response.json();
        return { name: detail.name as string, ids: (detail.pokemon as { pokemon: ApiNamedResource }[]).map(entry => resourceId(entry.pokemon.url)).filter((id: number) => id >= 1 && id <= NATIONAL_DEX_SIZE) };
      })))
      .then(types => { if (!active) return; const sorted = types.sort((a, b) => a.name.localeCompare(b.name)); setTypeCatalog(sorted); try { localStorage.setItem(cacheKey, JSON.stringify(sorted)); } catch { /* quota storage */ } })
      .catch(() => { if (active) setNotice('Non è stato possibile caricare i tipi dalla PokéAPI.'); })
      .finally(() => { if (active) setTypeLoading(false); });
    return () => { active = false; };
  }, [view, typeCatalog.length, online]);

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
  const filteredItems = itemCatalog.filter(item => item.name.toLowerCase().includes(itemSearch.trim().toLowerCase()));
  const itemPageCount = Math.max(1, Math.ceil(filteredItems.length / 15));
  const visibleItems = filteredItems.slice(itemPage * 15, itemPage * 15 + 15);
  const filteredAvatars = species.filter(pokemon => pokemon.name.toLowerCase().includes(avatarSearch.trim().toLowerCase()) || String(pokemon.id).includes(avatarSearch.trim()));
  const avatarPageCount = Math.max(1, Math.ceil(filteredAvatars.length / 15));
  const visibleAvatars = filteredAvatars.slice(avatarPage * 15, avatarPage * 15 + 15);
  const inventory = progress.inventory ?? [];
  const completedExams = progress.completedExams ?? [];

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
    setNotice('');
  }

  function claimExam(id: string, reward = 1) {
    setProgress(old => {
      const completed = old.completedExams ?? [];
      if (completed.includes(id)) return old;
      return { ...old, examPoints: old.examPoints + reward, completedExams: [...completed, id] };
    });
    setNotice('Prova completata: ricompensa aggiunta al Registro personale.');
  }

  function buyItem(id: string, name: string, cost: number, currency: 'poke' | 'exam') {
    const balance = currency === 'poke' ? progress.points : progress.examPoints;
    if (balance < cost) { setNotice('Punti insufficienti per questo acquisto.'); return; }
    setProgress(old => ({
      ...old,
      points: currency === 'poke' ? old.points - cost : old.points,
      examPoints: currency === 'exam' ? old.examPoints - cost : old.examPoints,
      inventory: [...(old.inventory ?? []), id],
    }));
    setNotice(`Acquisto registrato: ${name}.`);
  }

  function saveAvatar(id: number) {
    if (!student) return;
    const updated = { ...student, avatarId: id };
    try { localStorage.setItem(STUDENT_KEY, JSON.stringify(updated)); } catch { /* storage unavailable */ }
    setStudent(updated);
    setNotice('Immagine profilo aggiornata.');
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
        <span className="utility-right">AREA DIDATTICA <b className={online ? 'connection-online' : 'connection-offline'}>● {online ? 'ONLINE' : 'OFFLINE'}</b></span>
      </div>
      <header className="masthead">
        <button className="mobile-toggle" aria-label="Apri menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="pokeball-mark" aria-label="Poké Ball"><span /></div>
        <div className="brand">
          <div className="brand-kicker">ACCADEMIA POKÉMON</div>
          <div className="brand-name">Accademia Pokémon <span>✦</span></div>
          <div className="brand-subtitle">Portale dello studente</div>
        </div>
        <div className="student-card"><div className="student-avatar">{student.avatarId ? <img src={spriteUrl(student.avatarId)} alt="Avatar" /> : '★'}</div><div><small>PROFILO ALLIEVO</small><strong>{student?.nickname ?? 'Allenatore in formazione'}</strong><span>{student?.matricola ?? ''}</span><span>{academy === 'arancia' ? 'Accademia Arancia' : 'Accademia Uva'}</span></div></div>
      </header>
      <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={16} /> Portale</button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Pokédex Nazionale</button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria</button>
        <button className={view === 'esami' ? 'active' : ''} onClick={() => navTo('esami')}><FlaskConical size={16} /> Esami</button>
        <button className={view === 'classifica' ? 'active' : ''} onClick={() => navTo('classifica')}><Trophy size={16} /> Classifica</button>
        <button className={view === 'profilo' ? 'active' : ''} onClick={() => navTo('profilo')}><GraduationCap size={16} /> Profilo</button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca</button>
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
          {view === 'shop' && <><div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div><div className="page-heading"><div><div className="eyebrow">SERVIZI STUDENTI</div><h1>Cartoleria punti</h1><p>Oggetti acquistabili con Punti Poké e super-aiuti con Punti esame. Gli acquisti sono locali fino all’attivazione del database.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>OGGETTI POSSEDUTI</span><strong>{inventory.length}</strong></div></div><div className="shop-tabs"><button className={shopTab === 'oggetti' ? 'active' : ''} onClick={() => setShopTab('oggetti')}>Oggetti · Punti Poké</button><button className={shopTab === 'super-aiuti' ? 'active' : ''} onClick={() => setShopTab('super-aiuti')}>Super-aiuti · Punti esame</button></div>{notice && <div className="notice-inline" role="status">{notice}</div>}{shopTab === 'oggetti' ? <div className="shop-grid">{[{id:'potion',name:'Pozione',description:'Un oggetto di recupero per l’inventario.',cost:20},{id:'poke-ball',name:'Poké Ball',description:'Un classico strumento da allenatore.',cost:30},{id:'super-potion',name:'Superpozione',description:'Un oggetto di recupero avanzato.',cost:50},{id:'revive',name:'Revitalizzante',description:'Uno strumento speciale per l’inventario.',cost:80},{id:'repel',name:'Repellente',description:'Uno strumento utile durante le esplorazioni.',cost:15},{id:'rare-candy',name:'Caramella rara',description:'Un oggetto speciale da collezione.',cost:100}].map(item => <article className="shop-card" key={item.id}><img src={itemSpriteUrl(item.id)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility='hidden'; }} /><div><h3>{item.name}</h3><p>{item.description}</p><strong>{item.cost} Punti Poké</strong><button className="primary-button" disabled={progress.points < item.cost} onClick={() => buyItem(item.id,item.name,item.cost,'poke')}>Acquista</button></div></article>)}</div> : <div className="shop-grid">{[{id:'hint-pass',name:'Permesso di ripasso',description:'Oggetto simbolico per il percorso di studio.',cost:1},{id:'exam-seal',name:'Sigillo d’esame',description:'Un elemento collezionabile accademico.',cost:2},{id:'golden-notebook',name:'Quaderno d’oro',description:'Un accessorio speciale per il profilo.',cost:3}].map(item => <article className="shop-card" key={item.id}><div className="shop-symbol">★</div><div><h3>{item.name}</h3><p>{item.description}</p><strong>{item.cost} Punti esame</strong><button className="primary-button" disabled={progress.examPoints < item.cost} onClick={() => buyItem(item.id,item.name,item.cost,'exam')}>Acquista</button></div></article>)}</div>}<section className="archive-search item-archive"><h2>Archivio oggetti PokéAPI</h2><p>Catalogo degli oggetti esposti dall’API. Le immagini vengono caricate soltanto per gli elementi visibili e messe in cache dal browser.</p><label className="item-search-label">Cerca un oggetto<input value={itemSearch} onChange={event => {setItemSearch(event.target.value);setItemPage(0);}} placeholder="Nome oggetto…" /></label>{itemCatalog.length === 0 ? <div className="loading-panel"><p>{online ? 'Caricamento catalogo dalla PokéAPI…' : 'Catalogo non ancora presente in cache. Riconnettiti per scaricarlo.'}</p></div> : <><div className="item-grid">{visibleItems.map(item => <article className="item-card" key={item.name}><img src={itemSpriteUrl(item.name)} alt="" loading="lazy" onError={event => {event.currentTarget.style.visibility='hidden';}} /><span>{titleCase(item.name.replaceAll('-', ' '))}</span></article>)}</div><div className="game-pagination"><button disabled={itemPage===0} onClick={() => setItemPage(Math.max(0,itemPage-1))}>‹ Indietro</button><span>Pagina {Math.min(itemPage+1,itemPageCount)} / {itemPageCount} · {filteredItems.length} oggetti</span><button disabled={itemPage>=itemPageCount-1} onClick={() => setItemPage(Math.min(itemPageCount-1,itemPage+1))}>Avanti ›</button></div></>}</section></>}

          {view === 'esami' && <><div className="breadcrumb">Home / Area didattica / <b>Esami</b></div><div className="page-heading"><div><div className="eyebrow">DIPARTIMENTO DIDATTICO</div><h1>Esami e prove speciali</h1><p>Completa le regioni, approfondisci i tipi Pokémon e affronta obiettivi speciali. I risultati vengono salvati localmente.</p></div></div>{notice && <div className="notice-inline" role="status">{notice}</div>}<section className="archive-search"><h2>Esami regionali</h2><p>Completare una regione assegna automaticamente 1 Punto esame.</p><div className="exam-grid">{regions.map(region => {const count=progress.completedIds.filter(id=>id>=region.start&&id<=region.end).length;const total=region.end-region.start+1;const done=count===total;return <article className="exam-card" key={region.name}><div className="exam-card-mark">{done?'✓':'R'}</div><div><h3>{region.name}</h3><p>{count} di {total} Pokémon catalogati</p><div className="progress-track"><span style={{width:`${count/total*100}%`}}/></div><strong>{done?'Regione completata · Punto esame ottenuto':`${Math.round(count/total*100)}% completato`}</strong></div></article>})}</div></section><section className="archive-search"><h2>Esami per tipo</h2><p>I dati dei tipi provengono dalla PokéAPI e vengono messi in cache dopo il primo caricamento.</p>{typeLoading && <div className="loading-panel"><p>Caricamento dei 18 tipi dalla PokéAPI…</p></div>}{typeCatalog.length===0&&!typeLoading&&<div className="empty-service"><p>{online?'Apri nuovamente questa sezione per caricare i tipi.':'I tipi non sono ancora stati salvati in cache: serve una connessione al primo accesso.'}</p></div>}<div className="exam-grid">{typeCatalog.map(type=>{const ids=type.ids;const count=ids.filter(id=>completedSet.has(id)).length;const done=ids.length>0&&count===ids.length;const key=`type-${type.name}`;const claimed=completedExams.includes(key);return <article className="exam-card" key={type.name}><div className="exam-card-mark type-mark">{type.name.slice(0,2).toUpperCase()}</div><div><h3>{titleCase(type.name)}</h3><p>{count} di {ids.length} specie catalogate</p><div className="progress-track"><span style={{width:`${ids.length?count/ids.length*100:0}%`}}/></div>{done?<button className="secondary-button" disabled={claimed} onClick={()=>claimExam(key)}>{claimed?'Ricompensa riscossa':'Completa prova · +1 Punto esame'}</button>:<strong>{ids.length?Math.round(count/ids.length*100):0}% completato</strong>}</div></article>})}</div></section><section className="archive-search"><h2>Prove speciali</h2><p>Obiettivi progressivi di catalogazione. Ogni ricompensa può essere riscossa una sola volta.</p><div className="exam-grid">{[{id:'special-10',title:'Primo studio',target:10,reward:1},{id:'special-50',title:'Ricercatore in erba',target:50,reward:1},{id:'special-150',title:'Archivista Pokémon',target:150,reward:2},{id:'special-500',title:'Esperto Nazionale',target:500,reward:3},{id:'special-1025',title:'Maestro del Pokédex',target:1025,reward:10}].map(exam=>{const done=progress.completedIds.length>=exam.target;const claimed=completedExams.includes(exam.id);return <article className="exam-card" key={exam.id}><div className="exam-card-mark special-mark">★</div><div><h3>{exam.title}</h3><p>Cataloga {exam.target} Pokémon · {Math.min(progress.completedIds.length,exam.target)} / {exam.target}</p><div className="progress-track"><span style={{width:`${Math.min(100,progress.completedIds.length/exam.target*100)}%`}}/></div><strong>{exam.reward} {exam.reward===1?'Punto esame':'Punti esame'}</strong><button className="secondary-button" disabled={!done||claimed} onClick={()=>claimExam(exam.id,exam.reward)}>{claimed?'Ricompensa riscossa':done?'Riscatta ricompensa':'Prova in corso'}</button></div></article>})}</div></section></>}

          {view === 'classifica' && <><div className="breadcrumb">Home / Comunità / <b>Classifica globale</b></div><div className="page-heading"><div><div className="eyebrow">RISULTATI STUDENTI</div><h1>Classifica globale</h1><p>La graduatoria online verrà attivata quando saranno disponibili autenticazione e database condiviso.</p></div></div><section className="empty-service ranking-preview"><Trophy size={36}/><h2>Classifica online non ancora attiva</h2><p>Questa versione mantiene i tuoi risultati sul dispositivo. Senza database non è possibile confrontare in modo affidabile gli studenti o sincronizzare i risultati tra PC e smartphone.</p><div className="dashboard-strip"><div><span>I TUOI PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>I TUOI PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>POKÉMON CATALOGATI</span><strong>{progress.completedIds.length}/1025</strong></div></div></section></>}

          {view === 'profilo' && <><div className="breadcrumb">Home / Area allievo / <b>Profilo</b></div><div className="page-heading"><div><div className="eyebrow">IDENTITÀ STUDENTE</div><h1>Il tuo profilo</h1><p>Personalizza l’immagine profilo scegliendo tra i 1.025 Pokémon. Le immagini vengono caricate dalla CDN solo quando servono.</p></div></div><section className="archive-search profile-panel"><div className="profile-hero"><div className="profile-avatar-large">{student.avatarId?<img src={spriteUrl(student.avatarId)} alt="Avatar scelto"/>:'★'}</div><div><span className="section-label">PROFILO LOCALE</span><h2>{student.nickname}</h2><p>{student.matricola}</p><p>{academy==='arancia'?'Accademia Arancia':'Accademia Uva'}</p><small>Accesso con account e sincronizzazione saranno aggiunti nell’ultima fase.</small></div></div><label className="item-search-label">Cerca un Pokémon per nome o numero<input value={avatarSearch} onChange={event=>{setAvatarSearch(event.target.value);setAvatarPage(0);}} placeholder="Es. Pikachu oppure 0025"/></label><div className="avatar-grid">{visibleAvatars.map(pokemon=><button className={student.avatarId===pokemon.id?'avatar-option selected':'avatar-option'} key={pokemon.id} onClick={()=>saveAvatar(pokemon.id)} aria-label={`Scegli ${titleCase(pokemon.name)} come avatar`}><img src={spriteUrl(pokemon.id)} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/><span>{titleCase(pokemon.name)}</span></button>)}</div><div className="game-pagination"><button disabled={avatarPage===0} onClick={()=>setAvatarPage(Math.max(0,avatarPage-1))}>‹ Indietro</button><span>Pagina {Math.min(avatarPage+1,avatarPageCount)} / {avatarPageCount}</span><button disabled={avatarPage>=avatarPageCount-1} onClick={()=>setAvatarPage(Math.min(avatarPageCount-1,avatarPage+1))}>Avanti ›</button></div></section></>}

          {view === 'forum' && <><div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div><div className="page-heading"><div><div className="eyebrow">COMUNITÀ SCOLASTICA</div><h1>Bacheca studenti</h1><p>Avvisi e appunti dell'archivio Pokémon.</p></div></div><section className="forum-post"><div className="post-icon">📌</div><div><span className="section-label">AVVISO DEL PRESIDE</span><h2>Benvenuto nel Pokédex Nazionale</h2><p>Tutte le specie e tutti i numeri sono disponibili fin dall'inizio. Catalogare è un'attività continua: ogni collocazione corretta aggiunge un Punto Poké e gli errori non sottraggono punti. Completando una regione ottieni un Punto esame.</p><small>SEGRETERIA DIDATTICA</small></div></section><section className="forum-post"><div className="post-icon">📚</div><div><span className="section-label">GUIDA RAPIDA</span><h2>Come funziona la catalogazione</h2><p>Le schede Pokémon sono mescolate e possono essere trascinate sul numero Nazionale corrispondente. Su mobile, seleziona la scheda e poi tocca lo slot. Non ci sono lezioni, turni o sblocchi progressivi.</p><small>MANUALE DELLO STUDENTE</small></div></section></>}
          <footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
      <nav className="mobile-app-nav" aria-label="Navigazione principale">
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={20}/><span>Portale</span></button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={20}/><span>Pokédex</span></button>
        <button className={view === 'esami' ? 'active' : ''} onClick={() => navTo('esami')}><FlaskConical size={20}/><span>Esami</span></button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={20}/><span>Negozio</span></button>
        <button className={view === 'profilo' ? 'active' : ''} onClick={() => navTo('profilo')}><GraduationCap size={20}/><span>Profilo</span></button>
      </nav>
    </div>
  );
}
