import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Award, BookOpen, Check, CheckCircle2, Crown, Eye, EyeOff, FileText,
  GraduationCap, LockKeyhole, MessageSquare, Palette, ShieldCheck,
  Sparkles, Trophy, Users, X,
} from 'lucide-react';
import { loadAcademyCurriculum } from './academy';
import { getCommunityPublicActivity } from './community';
import type { CommunityIdentity, CommunityPublicActivity } from './community';
import type { PokemonSpecies, SavedProgress, StudentProfile, StudentProfileSettings } from './types';
import './profile.css';

type Props = {
  academy: string;
  student: StudentProfile;
  progress: SavedProgress;
  species: PokemonSpecies[];
  communityIdentity: CommunityIdentity | null;
  online: boolean;
  configured: boolean;
  communityBusy: boolean;
  communityNotice: string;
  communityError: string;
  onUpdateProfile: (profile: StudentProfile) => void;
  onChooseAvatar: (id: number) => void;
  onImportAccount: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportAccount: () => void;
};

const STARTER_IDS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];
const REGION_DATA = [
  { name: 'Kanto', start: 1, end: 151 }, { name: 'Johto', start: 152, end: 251 },
  { name: 'Hoenn', start: 252, end: 386 }, { name: 'Sinnoh', start: 387, end: 493 },
  { name: 'Unima', start: 494, end: 649 }, { name: 'Kalos', start: 650, end: 721 },
  { name: 'Alola', start: 722, end: 809 }, { name: 'Galar', start: 810, end: 905 },
  { name: 'Paldea', start: 906, end: 1025 },
];
const DEFAULT_VISIBILITY = {
  bio: true, favoritePokemon: true, motto: true, activeTitle: true,
  badges: true, catalogStats: true, communityStats: true, matricola: true,
};
const DEFAULT_SETTINGS: StudentProfileSettings = {
  bio: '', favoritePokemon: '', motto: '', activeTitle: '', badges: [],
  frame: 'academy', visibility: DEFAULT_VISIBILITY,
};
const FRAME_OPTIONS = [
  { id: 'academy', title: 'Stemma d’Accademia', description: 'Cornice istituzionale', unlock: 0 },
  { id: 'research', title: 'Ricercatore', description: 'Sblocca con 50 Pokémon', unlock: 50 },
  { id: 'archive', title: 'Archivista', description: 'Sblocca con 150 Pokémon', unlock: 150 },
  { id: 'expert', title: 'Esperto', description: 'Sblocca con 500 Pokémon', unlock: 500 },
  { id: 'master', title: 'Maestro', description: 'Completa il Pokédex nazionale', unlock: 1025 },
];
const VISIBILITY_OPTIONS: Array<{ key: keyof StudentProfileSettings['visibility']; label: string; description: string }> = [
  { key: 'bio', label: 'Presentazione', description: 'Mostra la tua breve biografia.' },
  { key: 'favoritePokemon', label: 'Pokémon preferito', description: 'Mostra la specie che preferisci.' },
  { key: 'motto', label: 'Motto personale', description: 'Mostra la frase che ti rappresenta.' },
  { key: 'activeTitle', label: 'Titolo attivo', description: 'Mostra il titolo che hai scelto.' },
  { key: 'badges', label: 'Distintivi', description: 'Mostra i tre distintivi selezionati.' },
  { key: 'catalogStats', label: 'Statistiche di catalogazione', description: 'Mostra i progressi del Pokédex e della raccolta.' },
  { key: 'communityStats', label: 'Statistiche comunitarie', description: 'Mostra solo discussioni e risposte pubbliche.' },
];

function academyName(academy: string) {
  if (academy === 'arancia') return 'Accademia Arancia';
  if (academy === 'uva') return 'Accademia Uva';
  if (academy === 'mirtillo') return 'Istituto Mirtillo';
  return 'Accademia Pokémon';
}
function crestFile(academy: string) {
  if (academy === 'arancia') return 'naranja-academy-crest.svg';
  if (academy === 'mirtillo') return 'blueberry-academy-crest.png';
  return 'uva-academy-crest.svg';
}
function avatarUrl(id: number) {
  return import.meta.env.BASE_URL + 'images/portraits/' + id + '.png';
}
function defaultSettings(): StudentProfileSettings {
  return { ...DEFAULT_SETTINGS, visibility: { ...DEFAULT_VISIBILITY }, badges: [] };
}
function normalizeSettings(value?: StudentProfileSettings): StudentProfileSettings {
  if (!value || typeof value !== 'object') return defaultSettings();
  const raw = value as Partial<StudentProfileSettings>;
  const validFrames = FRAME_OPTIONS.map(frame => frame.id);
  const visibility = raw.visibility && typeof raw.visibility === 'object' ? raw.visibility : {};
  return {
    bio: typeof raw.bio === 'string' ? raw.bio.slice(0, 180) : '',
    favoritePokemon: typeof raw.favoritePokemon === 'string' ? raw.favoritePokemon.slice(0, 60) : '',
    motto: typeof raw.motto === 'string' ? raw.motto.slice(0, 90) : '',
    activeTitle: typeof raw.activeTitle === 'string' ? raw.activeTitle.slice(0, 80) : '',
    badges: Array.isArray(raw.badges) ? raw.badges.filter((id): id is string => typeof id === 'string').slice(0, 3) : [],
    frame: typeof raw.frame === 'string' && validFrames.includes(raw.frame) ? raw.frame : 'academy',
    visibility: { ...DEFAULT_VISIBILITY, ...visibility },
  };
}
function titleCase(value: string) {
  return value.split('-').map(part => part.charAt(0).toLocaleUpperCase('it-IT') + part.slice(1)).join(' ');
}

export default function StudentProfilePage({
  academy, student, progress, species, communityIdentity, online, configured,
  communityBusy, communityNotice, communityError, onUpdateProfile, onChooseAvatar,
  onImportAccount, onExportAccount,
}: Props) {
  const savedSettings = useMemo(() => normalizeSettings(student.profileSettings), [student.profileSettings]);
  const [draft, setDraft] = useState<StudentProfileSettings>(savedSettings);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [communityActivity, setCommunityActivity] = useState<CommunityPublicActivity | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [academicGrade, setAcademicGrade] = useState(0);
  const [academicLoading, setAcademicLoading] = useState(false);

  useEffect(() => setDraft(savedSettings), [savedSettings]);
  useEffect(() => {
    let active = true;
    if (!communityIdentity || !configured || !online) {
      setCommunityActivity(null);
      setAcademicGrade(0);
      return () => { active = false; };
    }
    setCommunityLoading(true);
    setAcademicLoading(true);
    getCommunityPublicActivity()
      .then(activity => { if (active) setCommunityActivity(activity); })
      .catch(() => { if (active) setCommunityActivity(null); })
      .finally(() => { if (active) setCommunityLoading(false); });
    loadAcademyCurriculum()
      .then(data => {
        if (!active) return;
        const passedGrades = data.attempts.filter(attempt =>
          attempt.attempt_kind === 'grade_exam' && attempt.status === 'submitted' && attempt.passed === true,
        ).map(attempt => attempt.grade_number ?? 0);
        setAcademicGrade(Math.max(0, ...passedGrades));
      })
      .catch(() => { if (active) setAcademicGrade(0); })
      .finally(() => { if (active) setAcademicLoading(false); });
    return () => { active = false; };
  }, [communityIdentity?.id, communityIdentity?.nickname, communityIdentity?.academy, configured, online]);

  const pokemonCount = new Set(progress.completedIds).size;
  const completedEntries = new Set(progress.completedEntries ?? []).size;
  const completedRegions = REGION_DATA.filter(region =>
    progress.completedIds.filter(id => id >= region.start && id <= region.end).length === region.end - region.start + 1,
  );
  const ownThreads = communityActivity?.discussions ?? 0;
  const ownReplies = communityActivity?.replies ?? 0;

  const titles = useMemo(() => {
    const result: Array<{ id: string; label: string; description: string }> = [];
    if (pokemonCount >= 1) result.push({ id: 'title-first-study', label: 'Apprendista Pokédex', description: 'Hai catalogato il tuo primo Pokémon.' });
    if (pokemonCount >= 50) result.push({ id: 'title-collector', label: 'Collezionista', description: 'Hai catalogato almeno 50 Pokémon.' });
    if (pokemonCount >= 150) result.push({ id: 'title-researcher', label: 'Ricercatore Pokémon', description: 'Hai catalogato almeno 150 Pokémon.' });
    if (pokemonCount >= 500) result.push({ id: 'title-national-expert', label: 'Esperto Nazionale', description: 'Hai catalogato almeno 500 Pokémon.' });
    if (pokemonCount >= 1025) result.push({ id: 'title-archive-master', label: 'Maestro dell’Archivio', description: 'Hai completato il Pokédex nazionale.' });
    completedRegions.forEach(region => result.push({ id: 'title-region-' + region.name.toLowerCase(), label: 'Custode di ' + region.name, description: 'Hai completato la regione ' + region.name + '.' }));
    if (academicGrade > 0) result.push({ id: 'title-grade-' + academicGrade, label: 'Allievo di Grado ' + academicGrade, description: 'Hai superato l’esame di grado ' + academicGrade + '.' });
    if (ownThreads > 0) result.push({ id: 'title-community-author', label: 'Voce della Bacheca', description: 'Hai pubblicato una discussione pubblica.' });
    if (ownReplies > 0) result.push({ id: 'title-community-helper', label: 'Compagno di Studio', description: 'Hai contribuito con una risposta pubblica.' });
    return result;
  }, [pokemonCount, completedRegions, academicGrade, ownThreads, ownReplies]);

  const badges = useMemo(() => {
    const result: Array<{ id: string; label: string; description: string; icon: string }> = [];
    if (pokemonCount >= 50) result.push({ id: 'badge-50', label: 'Collezionista', description: '50 Pokémon catalogati', icon: 'star' });
    if (pokemonCount >= 150) result.push({ id: 'badge-150', label: 'Ricercatore', description: '150 Pokémon catalogati', icon: 'research' });
    if (pokemonCount >= 500) result.push({ id: 'badge-500', label: 'Esperto Nazionale', description: '500 Pokémon catalogati', icon: 'expert' });
    if (pokemonCount >= 1025) result.push({ id: 'badge-1025', label: 'Pokédex completo', description: '1.025 Pokémon catalogati', icon: 'master' });
    completedRegions.forEach(region => result.push({ id: 'badge-region-' + region.name.toLowerCase(), label: region.name, description: 'Regione completata', icon: 'region' }));
    if (completedEntries >= 50) result.push({ id: 'badge-entries-50', label: 'Catalogatore', description: '50 entità extra catalogate', icon: 'catalog' });
    if (ownThreads > 0) result.push({ id: 'badge-community-thread', label: 'Prima discussione', description: 'Hai pubblicato una discussione pubblica', icon: 'community' });
    if (ownReplies >= 10) result.push({ id: 'badge-community-replies', label: 'Punto di riferimento', description: 'Hai pubblicato 10 risposte pubbliche', icon: 'replies' });
    return result;
  }, [pokemonCount, completedEntries, completedRegions, ownThreads, ownReplies]);

  const unlockedFrames = useMemo(() => FRAME_OPTIONS.filter(frame => pokemonCount >= frame.unlock), [pokemonCount]);
  const visibleAvatars = species.filter(pokemon => STARTER_IDS.includes(pokemon.id));
  const currentAvatar = STARTER_IDS.includes(student.avatarId ?? -1) ? student.avatarId! : STARTER_IDS[0];
  const activeTitle = titles.find(title => title.id === draft.activeTitle);
  const activeBadges = badges.filter(badge => draft.badges.includes(badge.id)).slice(0, 3);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedSettings);

  useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(() => {
      const allowedTitles = new Set(titles.map(title => title.id));
      const allowedBadges = new Set(badges.map(badge => badge.id));
      const next: StudentProfileSettings = {
        ...draft,
        bio: draft.bio.trim().slice(0, 180),
        favoritePokemon: draft.favoritePokemon.slice(0, 60),
        motto: draft.motto.trim().slice(0, 90),
        activeTitle: allowedTitles.has(draft.activeTitle) ? draft.activeTitle : '',
        badges: draft.badges.filter(id => allowedBadges.has(id)).slice(0, 3),
        frame: unlockedFrames.some(frame => frame.id === draft.frame) ? draft.frame : 'academy',
        visibility: { ...DEFAULT_VISIBILITY, ...draft.visibility },
      };
      if (JSON.stringify(next) !== JSON.stringify(savedSettings)) {
        onUpdateProfile({ ...student, profileSettings: next });
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draft, dirty, titles, badges, unlockedFrames, savedSettings, student, onUpdateProfile]);

  function updateDraft<K extends keyof StudentProfileSettings>(key: K, value: StudentProfileSettings[K]) {
    setDraft(old => ({ ...old, [key]: value }));
  }
  function toggleBadge(id: string) {
    setDraft(old => {
      const current = old.badges.filter(badgeId => badges.some(badge => badge.id === badgeId));
      if (current.includes(id)) return { ...old, badges: current.filter(badgeId => badgeId !== id) };
      if (current.length >= 3) return old;
      return { ...old, badges: [...current, id] };
    });
  }
  const favoritePokemonName = species.find(pokemon => String(pokemon.id) === draft.favoritePokemon)?.name;
  const communityStatsAvailable = Boolean(communityIdentity && configured && online && communityActivity !== null);
  const publicTitle = draft.visibility.activeTitle ? activeTitle?.label : '';
  const publicBadgeList = draft.visibility.badges ? activeBadges : [];

  return (
    <div className="student-profile-page">
      <div className="breadcrumb profile-breadcrumb">Home / Area allievo / <b>Profilo studente</b></div>
      <header className="student-profile-hero">
        <div className="student-profile-hero-copy">
          <div className="student-profile-eyebrow"><ShieldCheck size={15}/> IDENTITÀ STUDENTE · PROFILO CONFIGURABILE</div>
          <h1>Il tuo profilo</h1>
          <p>Personalizza la tua presenza, scegli il titolo attivo e decidi quali informazioni mostrare.</p>
          <div className="student-profile-hero-meta">
            <span><GraduationCap size={15}/>{academyName(academy)}</span>
            <span><FileText size={15}/>Matricola {student.matricola}</span>
            {communityIdentity && <span><CheckCircle2 size={15}/>Identità community verificata</span>}
          </div>
        </div>
        <img className="student-profile-hero-crest" src={import.meta.env.BASE_URL + 'images/academies/' + crestFile(academy)} alt={'Stemma ' + academyName(academy)}/>
      </header>

      <div className="student-profile-layout">
        <div className="student-profile-main">
          <section className="student-profile-card student-profile-identity">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">IDENTITÀ</span><h2>La tua scheda allievo</h2><p>Nickname, avatar e Accademia restano collegati al tuo account.</p></div><span className="student-profile-status"><CheckCircle2 size={14}/> Attiva</span></div>
            <div className={'student-profile-identity-preview profile-frame-' + (unlockedFrames.some(frame => frame.id === draft.frame) ? draft.frame : 'academy')}>
              <div className="student-profile-avatar-wrap"><img src={avatarUrl(currentAvatar)} alt="Avatar Pokémon selezionato"/><span className="student-profile-avatar-check"><Check size={13}/></span></div>
              <div className="student-profile-identity-copy"><span className="student-profile-kicker">{academyName(academy).toLocaleUpperCase('it-IT')}</span><h3>{communityIdentity?.nickname ?? student.nickname}</h3>{publicTitle && <span className="student-profile-title-pill"><Crown size={13}/>{publicTitle}</span>}<p>{draft.motto.trim() || 'Il tuo percorso di ricerca comincia qui.'}</p><div className="student-profile-identity-meta"><span><GraduationCap size={14}/>{academyName(academy)}</span><span><FileText size={14}/>{student.matricola}</span></div></div>
              {draft.visibility.badges && <div className="student-profile-active-badges">{activeBadges.map(badge => <span key={badge.id} title={badge.description}><Award size={16}/><small>{badge.label}</small></span>)}</div>}
            </div>
            <div className="student-profile-inline-note"><ShieldCheck size={15}/><span>Il nickname, la matricola e l’Accademia ufficiale sono gestiti dall’identità studente. L’avatar resta scelto tra i Pokémon predefiniti.</span></div>
            <div className="student-profile-avatar-heading"><div><h3>Avatar Pokémon</h3><p>27 avatar predefiniti · 3 per regione</p></div><span>{visibleAvatars.length} disponibili</span></div>
            <div className="student-profile-avatar-grid">{visibleAvatars.map(pokemon => <button type="button" key={pokemon.id} className={currentAvatar === pokemon.id ? 'student-profile-avatar-option is-selected' : 'student-profile-avatar-option'} onClick={() => onChooseAvatar(pokemon.id)} aria-pressed={currentAvatar === pokemon.id} aria-label={'Scegli ' + titleCase(pokemon.name) + ' come avatar'}><img src={avatarUrl(pokemon.id)} alt="" loading="lazy"/><strong>{titleCase(pokemon.name)}</strong><small>{REGION_DATA.find(region => pokemon.id >= region.start && pokemon.id <= region.end)?.name}</small></button>)}</div>
          </section>

          <section className="student-profile-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">PRESENTAZIONE</span><h2>Informazioni facoltative</h2><p>Puoi lasciarle vuote e scegliere se mostrarle nell’anteprima pubblica.</p></div><FileText size={22}/></div>
            <div className="student-profile-fields">
              <label className="student-profile-field student-profile-field-wide"><span>Presentazione <small>{draft.bio.length}/180</small></span><textarea value={draft.bio} maxLength={180} rows={3} onChange={event => updateDraft('bio', event.target.value)} placeholder="Racconta cosa ti interessa studiare…"/></label>
              <label className="student-profile-field"><span>Pokémon preferito</span><select value={draft.favoritePokemon} onChange={event => updateDraft('favoritePokemon', event.target.value)}><option value="">Non specificato</option>{species.map(pokemon => <option value={String(pokemon.id)} key={pokemon.id}>#{String(pokemon.id).padStart(4,'0')} · {titleCase(pokemon.name)}</option>)}</select></label>
              <label className="student-profile-field"><span>Motto personale <small>{draft.motto.length}/90</small></span><input value={draft.motto} maxLength={90} onChange={event => updateDraft('motto', event.target.value)} placeholder="Una frase che ti rappresenta"/></label>
            </div>
          </section>

          <section className="student-profile-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">TITOLI E DISTINTIVI</span><h2>Il tuo percorso</h2><p>I titoli e i distintivi si sbloccano con i risultati; puoi mostrarne un titolo e fino a tre distintivi.</p></div><Trophy size={23}/></div>
            <label className="student-profile-field"><span>Titolo attivo</span><select value={draft.activeTitle} onChange={event => updateDraft('activeTitle', event.target.value)}><option value="">Nessun titolo attivo</option>{titles.map(title => <option value={title.id} key={title.id}>{title.label}</option>)}</select></label>
            {titles.length > 0 ? <div className="student-profile-unlocked-list"><strong><Crown size={15}/> Titoli sbloccati ({titles.length})</strong>{titles.map(title => <div key={title.id} className={draft.activeTitle === title.id ? 'is-active' : ''}><span><strong>{title.label}</strong><small>{title.description}</small></span><button type="button" onClick={() => updateDraft('activeTitle', title.id)}>{draft.activeTitle === title.id ? <><Check size={14}/> Attivo</> : 'Attiva'}</button></div>)}</div> : <div className="student-profile-empty-unlocks"><LockKeyhole size={18}/><span>Completa qualche attività per sbloccare il primo titolo.</span></div>}
            <div className="student-profile-badge-heading"><strong>Distintivi da mostrare</strong><span>{draft.badges.filter(id => badges.some(badge => badge.id === id)).length}/3 selezionati</span></div>
            {badges.length ? <div className="student-profile-badge-grid">{badges.map(badge => { const selected = draft.badges.includes(badge.id); const disabled = !selected && draft.badges.filter(id => badges.some(item => item.id === id)).length >= 3; return <button type="button" key={badge.id} className={'student-profile-badge-option ' + (selected ? 'is-selected' : '')} disabled={disabled} onClick={() => toggleBadge(badge.id)} aria-pressed={selected}><span><Award size={19}/></span><strong>{badge.label}</strong><small>{badge.description}</small><em>{selected ? <><Check size={13}/> Selezionato</> : 'Seleziona'}</em></button>; })}</div> : <div className="student-profile-empty-unlocks"><LockKeyhole size={18}/><span>Non hai ancora distintivi sbloccati. Continua a catalogare o partecipa alla Bacheca.</span></div>}
          </section>

          <section className="student-profile-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">ESTETICA</span><h2>Cornice del profilo</h2><p>Le cornici si sbloccano con la catalogazione e usano sempre i colori della tua Accademia.</p></div><Palette size={23}/></div>
            <div className="student-profile-frame-grid">{FRAME_OPTIONS.map(frame => { const unlocked = pokemonCount >= frame.unlock; return <button type="button" key={frame.id} disabled={!unlocked} onClick={() => updateDraft('frame', frame.id)} className={'student-profile-frame-option profile-frame-' + frame.id + (draft.frame === frame.id ? ' is-selected' : '') + (!unlocked ? ' is-locked' : '')} aria-pressed={draft.frame === frame.id}><span className="student-profile-frame-sample"><span/><span/><span/></span><strong>{frame.title}</strong><small>{unlocked ? (frame.unlock === 0 ? 'Disponibile' : 'Sbloccata') : frame.description}</small>{draft.frame === frame.id ? <em><Check size={13}/> Selezionata</em> : !unlocked ? <em><LockKeyhole size={13}/> Bloccata</em> : <em>Seleziona</em>}</button>; })}</div>
          </section>

          <section className="student-profile-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">PRIVACY</span><h2>Visibilità del profilo</h2><p>Queste scelte definiscono cosa includere nell’anteprima pubblica. I dati ufficiali dell’identità non vengono modificati.</p></div><Eye size={23}/></div>
            <div className="student-profile-visibility-list">{VISIBILITY_OPTIONS.map(option => <label key={option.key} className="student-profile-visibility-row"><span className="student-profile-visibility-icon">{draft.visibility[option.key] ? <Eye size={16}/> : <EyeOff size={16}/>}</span><span className="student-profile-visibility-copy"><strong>{option.label}</strong><small>{option.description}</small></span><input type="checkbox" checked={draft.visibility[option.key]} onChange={event => updateDraft('visibility', { ...draft.visibility, [option.key]: event.target.checked })}/></label>)}</div>
            <div className="student-profile-privacy-note"><ShieldCheck size={17}/><span>La matricola è l’identificativo pubblico predefinito; il nickname resta riservato all’area personale e non viene mostrato nelle aree pubbliche.</span></div>
          </section>
        </div>

        <aside className="student-profile-side">
          <section className="student-profile-card student-profile-public-preview">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">ANTEPRIMA</span><h2>Profilo pubblico</h2><p>Si aggiorna automaticamente con le tue modifiche.</p></div><button type="button" className="student-profile-preview-open" onClick={() => setPreviewOpen(true)}><Eye size={15}/> Anteprima completa</button></div>
            <div className={'student-profile-public-card profile-frame-' + (unlockedFrames.some(frame => frame.id === draft.frame) ? draft.frame : 'academy')}>
              <img className="student-profile-public-crest" src={import.meta.env.BASE_URL + 'images/academies/' + crestFile(academy)} alt=""/>
              <img className="student-profile-public-avatar" src={avatarUrl(currentAvatar)} alt=""/>
              <h3>{student.matricola}</h3>
              <span className="student-profile-public-academy">{academyName(academy)}</span>
              {draft.visibility.activeTitle && activeTitle && <span className="student-profile-title-pill"><Crown size={13}/>{activeTitle.label}</span>}
              {draft.visibility.bio && draft.bio.trim() && <p>{draft.bio.trim()}</p>}
              {draft.visibility.favoritePokemon && favoritePokemonName && <div className="student-profile-public-favorite"><Sparkles size={14}/> Pokémon preferito: {titleCase(favoritePokemonName)}</div>}
              {draft.visibility.motto && draft.motto.trim() && <blockquote>“{draft.motto.trim()}”</blockquote>}
              {publicBadgeList.length > 0 && <div className="student-profile-public-badges">{publicBadgeList.map(badge => <span key={badge.id}><Award size={14}/>{badge.label}</span>)}</div>}
              {draft.visibility.catalogStats && <div className="student-profile-public-stats"><div><strong>{pokemonCount.toLocaleString('it-IT')}</strong><small>Pokémon</small></div><div><strong>{completedEntries.toLocaleString('it-IT')}</strong><small>Altre entità</small></div><div><strong>{progress.points.toLocaleString('it-IT')} ₱</strong><small>Punti Poké</small></div></div>}
              {draft.visibility.communityStats && <div className="student-profile-public-community"><strong><MessageSquare size={14}/> Attività pubblica</strong>{communityLoading || communityStatsAvailable ? <span>{ownThreads} discussioni · {ownReplies} risposte</span> : <span>{communityIdentity ? 'Statistiche non disponibili offline' : 'Collega un account community per mostrarle'}</span>}</div>}
            </div>
            <p className="student-profile-preview-note">Questa anteprima rispetta le opzioni di visibilità selezionate. Le modifiche vengono salvate automaticamente.</p>
          </section>

          <section className="student-profile-card student-profile-stats-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">STATISTICHE</span><h2>Il tuo percorso</h2></div><Sparkles size={20}/></div>
            <div className="student-profile-stat-list"><div><span><BookOpen size={16}/> Pokédex completato</span><strong>{pokemonCount.toLocaleString('it-IT')} / 1.025</strong></div><div className="student-profile-stat-track"><span style={{width: Math.min(100, pokemonCount / 1025 * 100) + '%'}}/></div><div><span><Award size={16}/> Altre entità</span><strong>{completedEntries.toLocaleString('it-IT')}</strong></div><div><span><Trophy size={16}/> Punti Poké</span><strong>{progress.points.toLocaleString('it-IT')} ₱</strong></div><div><span><Palette size={16}/> Cornici sbloccate</span><strong>{unlockedFrames.length} / {FRAME_OPTIONS.length}</strong></div><div><span><MessageSquare size={16}/> Discussioni pubbliche</span><strong>{communityLoading ? '…' : communityStatsAvailable ? ownThreads : '—'}</strong></div><div><span><Users size={16}/> Risposte pubbliche</span><strong>{communityLoading ? '…' : communityStatsAvailable ? ownReplies : '—'}</strong></div><div><span><GraduationCap size={16}/> Grado accademico</span><strong>{academicLoading ? '…' : academicGrade > 0 ? 'Grado ' + academicGrade : 'In formazione'}</strong></div></div>
          </section>

          <section className="student-profile-card student-profile-account-card">
            <div className="student-profile-section-heading"><div><span className="student-profile-kicker">ACCOUNT</span><h2>Recupero e sincronizzazione</h2></div><ShieldCheck size={20}/></div>
            <div className="student-profile-account-status"><span className={communityIdentity ? 'is-online' : 'is-local'}/><div><strong>{communityIdentity ? 'Identità community verificata' : 'Profilo locale'}</strong><small>{communityIdentity ? 'Profilo e progressi vengono sincronizzati quando sei online.' : 'I dati sono salvati in questo browser.'}</small></div></div>
            {communityIdentity && <div className="student-profile-account-identity"><strong>{communityIdentity.nickname}</strong><span>{communityIdentity.id.slice(0, 8)} · {communityIdentity.academy}</span></div>}
            <div className="student-profile-account-actions">{communityIdentity && <button type="button" className="student-profile-button student-profile-button-secondary" onClick={onExportAccount} disabled={communityBusy}><FileText size={15}/>{communityBusy ? 'Attendere…' : 'Esporta file di recupero'}</button>}<label className="student-profile-import-button"><FileText size={15}/>Importa account<input type="file" accept="application/json,.json" disabled={!configured || communityBusy} onChange={onImportAccount}/></label></div>
            {!configured && <p className="student-profile-account-hint">Il servizio community non è configurato in questa build. Il profilo locale continua a funzionare.</p>}
            {!online && <p className="student-profile-account-hint">Sei offline: le modifiche restano sul dispositivo e saranno sincronizzate al ritorno online.</p>}
            {communityNotice && <p className="student-profile-account-success" role="status">{communityNotice}</p>}
            {communityError && <p className="student-profile-account-error" role="alert">{communityError}</p>}
            <p className="student-profile-account-warning">Il file di recupero contiene una credenziale privata equivalente a una password: conservalo in un luogo sicuro e non condividerlo.</p>
          </section>
        </aside>
      </div>

      {previewOpen && <div className="student-profile-preview-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}><section className="student-profile-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="student-profile-preview-title"><header><div><span className="student-profile-kicker">POKÉ STUDY · ANTEPRIMA</span><h2 id="student-profile-preview-title">Così appare il tuo profilo pubblico</h2><p>Questa vista riflette le modifiche attuali e le impostazioni di privacy.</p></div><button type="button" onClick={() => setPreviewOpen(false)} aria-label="Chiudi anteprima"><X size={20}/></button></header><div className="student-profile-preview-dialog-body"><div className={'student-profile-public-card profile-frame-' + (unlockedFrames.some(frame => frame.id === draft.frame) ? draft.frame : 'academy')}><img className="student-profile-public-crest" src={import.meta.env.BASE_URL + 'images/academies/' + crestFile(academy)} alt=""/><img className="student-profile-public-avatar" src={avatarUrl(currentAvatar)} alt=""/><h3>{student.matricola}</h3><span className="student-profile-public-academy">{academyName(academy)}</span>{draft.visibility.activeTitle && activeTitle && <span className="student-profile-title-pill"><Crown size={13}/>{activeTitle.label}</span>}{draft.visibility.bio && draft.bio.trim() && <p>{draft.bio.trim()}</p>}{draft.visibility.favoritePokemon && favoritePokemonName && <div className="student-profile-public-favorite"><Sparkles size={14}/> Pokémon preferito: {titleCase(favoritePokemonName)}</div>}{draft.visibility.motto && draft.motto.trim() && <blockquote>“{draft.motto.trim()}”</blockquote>}{publicBadgeList.length > 0 && <div className="student-profile-public-badges">{publicBadgeList.map(badge => <span key={badge.id}><Award size={14}/>{badge.label}</span>)}</div>}{draft.visibility.catalogStats && <div className="student-profile-public-stats"><div><strong>{pokemonCount.toLocaleString('it-IT')}</strong><small>Pokémon</small></div><div><strong>{completedEntries.toLocaleString('it-IT')}</strong><small>Altre entità</small></div><div><strong>{progress.points.toLocaleString('it-IT')} ₱</strong><small>Punti Poké</small></div></div>}{draft.visibility.communityStats && <div className="student-profile-public-community"><strong><MessageSquare size={14}/> Attività pubblica</strong>{communityLoading || communityStatsAvailable ? <span>{ownThreads} discussioni · {ownReplies} risposte</span> : <span>{communityIdentity ? 'Statistiche non disponibili offline' : 'Collega un account community per mostrarle'}</span>}</div>}</div></div></section></div>}
    </div>
  );
}
