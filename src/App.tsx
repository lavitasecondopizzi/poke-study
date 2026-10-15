import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Archive from './Archive';
import EvolutionArchive from './EvolutionArchive';
import Leaderboard from './Leaderboard';
import PersonalRegister from './PersonalRegister';
import StudentProfilePage from './StudentProfilePage';
import StudentCard from './StudentCard';
import PublicStudentProfile from './PublicStudentProfile';
import AdminPanel from './AdminPanel';
import Cartoleria from './Cartoleria';
import Academy from './Academy';
import { Bell, BookOpen, Bookmark, BookmarkCheck, CheckCircle2, ChevronRight, CircleHelp, Clock3, CloudDownload, Database, FlaskConical, GitBranch, GraduationCap, Link2, Megaphone, Menu, MessageCircle, MessageSquare, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trophy, X } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies, PokemonTypeIndex, SavedProgress, StudentProfile } from './types';
import { createCommunityIdentity, createCommunityReply, createCommunityThread, exportCommunityMetadata, getCommunityIdentity, hasCommunityToken, importCommunityMetadata, isCommunityConfigured, listCommunityThreads, loadCommunityPlayerState, saveCommunityPlayerState } from './community';
import type { CommunityAcademy, CommunityCategory, CommunityIdentity, CommunityThread } from './community';
import { createFullCatalog, displayName, MACRO_CATEGORIES } from './catalog';
import type { CatalogCard, MacroId } from './catalog';

const NATIONAL_DEX_SIZE = 1025;

type ShopCurrency = 'poke';
export type ShopTab = 'oggetti' | 'super-aiuti';
export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  cost: number;
  currency: ShopCurrency;
  category: ShopTab;
  requires?: string[];
  requiredPokemon?: number;
  requirementLabel?: string;
  kind: 'active' | 'upgrade' | 'passive' | 'archive' | 'cosmetic' | 'mode';
};

const SCANNER_LEVELS = 20;
const RESEARCH_LEVELS = 12;
const SHOP_PRODUCTS: ShopProduct[] = [
  { id: 'scanner', name: 'Scanner', description: 'Rivela la macrocategoria corretta. Livello 1: cooldown di 5 minuti.', cost: 150, currency: 'poke', category: 'oggetti', kind: 'active' },
  ...Array.from({ length: SCANNER_LEVELS - 1 }, (_, i) => { const level = i + 2; const seconds = Math.max(10, Math.round(300 * Math.pow(10 / 300, (level - 1) / (SCANNER_LEVELS - 1)))); return { id: `scanner-upgrade-${level}`, name: `Scanner · Livello ${level}`, description: `Cooldown dello Scanner: ${seconds} secondi.`, cost: 0, currency: 'poke' as const, category: 'oggetti' as const, requires: [level === 2 ? 'scanner' : `scanner-upgrade-${level - 1}`], requirementLabel: `Acquista prima Scanner livello ${level - 1}`, kind: 'upgrade' as const }; }),
  { id: 'research', name: 'Ricerca', description: 'Rivela la sottocategoria corretta. Livello 1: cooldown di 10 minuti.', cost: 900, currency: 'poke', category: 'oggetti', requires: ['scanner'], requiredPokemon: 50, requirementLabel: 'Acquista prima lo Scanner e cataloga 50 Pokémon', kind: 'active' },
  ...Array.from({ length: RESEARCH_LEVELS - 1 }, (_, i) => { const level = i + 2; const seconds = Math.max(10, Math.round(600 * Math.pow(10 / 600, (level - 1) / (RESEARCH_LEVELS - 1)))); return { id: `research-upgrade-${level}`, name: `Ricerca · Livello ${level}`, description: `Cooldown della Ricerca: ${seconds} secondi.`, cost: 0, currency: 'poke' as const, category: 'oggetti' as const, requires: [level === 2 ? 'research' : `research-upgrade-${level - 1}`], requirementLabel: `Acquista prima Ricerca livello ${level - 1}`, kind: 'upgrade' as const }; }),
  { id: 'direct-region', name: 'Inserimento regionale rapido', description: 'Consente di inserire un Pokémon nella sua regione senza scegliere il numero esatto.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'number-check', name: 'Controllo numerazione', description: 'Segnala esclusivamente se un Pokémon è nel numero sbagliato.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'auto-sort', name: 'Smistamento automatico', description: 'Inserisci un’entità nella macrocategoria e falla smistare automaticamente nella sottocategoria corretta.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'reveal-name', name: 'Rivelazione del nome', description: 'Mostra il nome dell’entità selezionata.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'reveal-subcategory', name: 'Rivelazione sottocategoria', description: 'Mostra la sottocategoria corretta dell’entità selezionata.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  ...Array.from({ length: 8 }, (_, i) => { const level = i + 1; return { id: `multi-select-${level}`, name: `Selezione multipla · Livello ${level}`, description: `Consente di selezionare fino a ${level + 2} entità contemporaneamente, anche tra pagine diverse.`, cost: 0, currency: 'poke' as const, category: 'oggetti' as const, requires: level === 1 ? [] : [`multi-select-${level - 1}`], requirementLabel: level === 1 ? 'Nessun requisito aggiuntivo' : `Acquista prima Selezione multipla livello ${level - 1}`, kind: (level === 1 ? 'active' : 'upgrade') as 'active' | 'upgrade' }; }),
  { id: 'subcategory-errors', name: 'Evidenziazione errori', description: 'Evidenzia in rosso solo le entità nella sottocategoria sbagliata. Non controlla la numerazione.', cost: 0, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'digital-assistant', name: 'Assistente digitale', description: 'Sblocca un supporto passivo permanente per lo studio.', cost: 2, currency: 'poke', category: 'super-aiuti', kind: 'passive' },
  { id: 'evolution-archive', name: 'Archivio delle evoluzioni', description: 'Sblocca l’accesso permanente alle informazioni sulle evoluzioni.', cost: 3, currency: 'poke', category: 'super-aiuti', kind: 'archive' },
  { id: 'evolution-tools-archive', name: 'Archivio degli strumenti evolutivi', description: 'Sblocca una raccolta dedicata agli strumenti evolutivi.', cost: 3, currency: 'poke', category: 'super-aiuti', kind: 'archive' },
  { id: 'machines-archive', name: 'Archivio MT e tecniche', description: 'Sblocca una raccolta dedicata alle macchine e alle tecniche.', cost: 4, currency: 'poke', category: 'super-aiuti', kind: 'archive' },
  { id: 'fossils-archive', name: 'Archivio fossili e reperti', description: 'Sblocca una raccolta dedicata a fossili e reperti.', cost: 4, currency: 'poke', category: 'super-aiuti', kind: 'archive' },
  { id: 'held-items-archive', name: 'Archivio strumenti tenuti', description: 'Sblocca una raccolta dedicata agli strumenti tenuti.', cost: 5, currency: 'poke', category: 'super-aiuti', kind: 'archive' },
  { id: 'national-catalog', name: 'Archivio Nazionale completo', description: 'Sblocca il catalogo consultabile. Richiede tutti i 1.025 Pokémon e tutti i livelli di Scanner e Ricerca.', cost: 10, currency: 'poke', category: 'super-aiuti', requires: ['scanner', ...Array.from({ length: SCANNER_LEVELS - 1 }, (_, i) => `scanner-upgrade-${i + 2}`), 'research', ...Array.from({ length: RESEARCH_LEVELS - 1 }, (_, i) => `research-upgrade-${i + 2}`)], requiredPokemon: NATIONAL_DEX_SIZE, requirementLabel: 'Cataloga tutti i 1.025 Pokémon e acquista tutti i livelli di Scanner e Ricerca', kind: 'archive' },
  { id: 'academy-theme', name: 'Tema Accademia', description: 'Sblocca un tema grafico alternativo.', cost: 5, currency: 'poke', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'exclusive-title', name: 'Titolo esclusivo', description: 'Sblocca un titolo personale da mostrare nel profilo.', cost: 5, currency: 'poke', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'timed-training', name: 'Allenamento a tempo', description: 'Sblocca la modalità di allenamento a tempo quando disponibile.', cost: 8, currency: 'poke', category: 'super-aiuti', kind: 'mode' },
  { id: 'custom-challenges', name: 'Sfide personalizzate', description: 'Sblocca la modalità per configurare sfide quando disponibile.', cost: 10, currency: 'poke', category: 'super-aiuti', kind: 'mode' },
];
function priceShopProducts(totalEarnablePoints: number): ShopProduct[] {
  // Il budget complessivo del negozio coincide con tutti i PP ottenibili:
  // 1 per ciascuno dei 1.025 Pokémon e 1 per ogni altra voce catalogabile.
  // I pesi esprimono l'impatto dell'aiuto; i potenziamenti costano progressivamente di più.
  const weightFor = (product: ShopProduct): number => {
    const id = product.id;
    if (id === 'direct-region') return 1;
    if (id === 'reveal-name') return 1;
    if (id === 'number-check') return 2;
    if (id === 'subcategory-errors') return 2;
    if (id === 'scanner') return 3;
    if (id === 'reveal-subcategory') return 4;
    if (id === 'research') return 7;
    if (id === 'auto-sort') return 12;
    if (id.startsWith('scanner-upgrade-')) {
      const level = Number(id.slice(id.lastIndexOf('-') + 1));
      return 1.5 + (level - 2) * 0.55;
    }
    if (id.startsWith('research-upgrade-')) {
      const level = Number(id.slice(id.lastIndexOf('-') + 1));
      return 3 + (level - 2) * 1.15;
    }
    if (id.startsWith('multi-select-')) {
      const level = Number(id.slice(id.lastIndexOf('-') + 1));
      return 1 + level * 0.45;
    }
    if (id === 'digital-assistant') return 3;
    if (id === 'evolution-archive') return 3;
    if (id === 'evolution-tools-archive') return 3;
    if (id === 'machines-archive') return 4;
    if (id === 'fossils-archive') return 4;
    if (id === 'held-items-archive') return 5;
    if (id === 'national-catalog') return 12;
    if (id === 'academy-theme') return 3;
    if (id === 'exclusive-title') return 3;
    if (id === 'timed-training') return 6;
    if (id === 'custom-challenges') return 8;
    return 1;
  };
  // Il negozio è ora un catalogo unico: il budget dei PP viene ripartito
  // fra tutti gli articoli, inclusi aiuti, archivi, cosmetici e potenziamenti.
  // La somma dei prezzi dell'intero catalogo coincide con i PP ottenibili.
  const weights = SHOP_PRODUCTS.map(weightFor);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exactShares = SHOP_PRODUCTS.map((product, index) => ({
    id: product.id,
    raw: totalEarnablePoints * weights[index] / weightTotal,
    cost: Math.floor(totalEarnablePoints * weights[index] / weightTotal),
  }));
  let remainder = totalEarnablePoints - exactShares.reduce((sum, item) => sum + item.cost, 0);
  [...exactShares]
    .map(item => ({ ...item, fraction: item.raw - item.cost }))
    .sort((left, right) => right.fraction - left.fraction)
    .slice(0, remainder)
    .forEach(item => {
      const target = exactShares.find(entry => entry.id === item.id);
      if (target) target.cost += 1;
    });
  const prices = new Map(exactShares.map(item => [item.id, item.cost]));
  return SHOP_PRODUCTS.map(product => ({
    ...product,
    cost: prices.get(product.id) ?? 1,
  }));
}

function productUnlocked(product: ShopProduct, inventory: string[], completedPokemon: number) {
  return (product.requires ?? []).every(requiredId => inventory.includes(requiredId))
    && completedPokemon >= (product.requiredPokemon ?? 0);
}

function cooldownLabel(until: number, now: number) {
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  if (remaining <= 0) return 'Pronto';
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}
const SAVE_KEY = 'poke-study-progress-v1';
const ACADEMY_KEY = 'poke-study-academy-v1';
const STUDENT_KEY = 'poke-study-student-v1';
function academyName(academy: string) {
  if (academy === 'arancia') return 'Accademia Arancia';
  if (academy === 'uva') return 'Accademia Uva';
  if (academy === 'mirtillo') return 'Istituto Mirtillo';
  return 'Accademia Pokémon';
}

function AcademyCrest({ academy, className = '' }: { academy: string; className?: string }) {
  const assets: Record<string, { file: string; label: string }> = {
    arancia: { file: 'naranja-academy-crest.svg', label: 'Stemma Accademia Arancia' },
    uva: { file: 'uva-academy-crest.svg', label: 'Stemma Accademia Uva' },
    mirtillo: { file: 'blueberry-academy-crest.png', label: 'Stemma Istituto Mirtillo' },
  };
  const asset = assets[academy] ?? assets.uva;
  return <img className={className} src={`${import.meta.env.BASE_URL}images/academies/${asset.file}`} alt={asset.label} loading="eager" decoding="async" />;
}




function loadStudent(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as StudentProfile;
    return profile.nickname && profile.matricola ? profile : null;
  } catch { return null; }
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
    if (raw) { const saved = JSON.parse(raw) as Partial<SavedProgress>; return { points: Number(saved.points) || 0, completedIds: Array.isArray(saved.completedIds) ? [...new Set(saved.completedIds.filter(id => Number.isInteger(id) && id > 0 && id <= NATIONAL_DEX_SIZE))] : [], examPoints: Number(saved.examPoints) || 0, completedExams: Array.isArray(saved.completedExams) ? [...new Set(saved.completedExams.filter(id => typeof id === 'string'))] : [], inventory: Array.isArray(saved.inventory) ? [...new Set(saved.inventory.filter(id => typeof id === 'string'))] : [], completedEntries: Array.isArray(saved.completedEntries) ? [...new Set(saved.completedEntries.filter(id => typeof id === 'string'))] : [], abilityCooldowns: saved.abilityCooldowns && typeof saved.abilityCooldowns === 'object' ? saved.abilityCooldowns : {}, errors: Math.max(0, Number(saved.errors) || 0), history: Array.isArray(saved.history) ? saved.history.filter(entry => entry && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.timestamp === 'number').slice(-100) : [] }; }
  } catch { /* storage may be unavailable */ }
  return emptyProgress();
}

function emptyProgress(): SavedProgress {
  return { points: 0, completedIds: [], examPoints: 0, completedExams: [], inventory: [], completedEntries: [], abilityCooldowns: {}, errors: 0, history: [] };
}

const STARTER_POKEMON_IDS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];

function avatarPortraitUrl(id: number) {
  return `${import.meta.env.BASE_URL}images/portraits/${id}.png`;
}

const ITEM_IMAGE_CACHE_KEY = 'poke-study-local-items-v2';

function resourceId(url: string) {
  const parts = url.split('/').filter(Boolean);
  return Number(parts[parts.length - 1] ?? 0);
}


type PortalDashboardProps = {
  academy: string;
  displayNickname: string;
  student: StudentProfile;
  communityIdentity: CommunityIdentity | null;
  online: boolean;
  progress: SavedProgress;
  currentProfileAvatarId: number | undefined;
  availableShopCount: number;
  inventory: string[];
  notice: string;
  onNavigate: (next: string) => void;
};

function PortalDashboard({
  academy, displayNickname, student, communityIdentity, online, progress,
  currentProfileAvatarId, availableShopCount, inventory, notice, onNavigate,
}: PortalDashboardProps) {
  const completed = Math.min(progress.completedIds.length, NATIONAL_DEX_SIZE);
  const remaining = Math.max(0, NATIONAL_DEX_SIZE - completed);
  const percentage = Math.round(completed / NATIONAL_DEX_SIZE * 100);
  const archiveUnlocked = inventory.includes('national-catalog');
  const identityLabel = communityIdentity
    ? 'Identità online verificata'
    : hasCommunityToken()
      ? 'Verifica da completare'
      : 'Profilo locale';

  const shortcuts = [
    { id: 'game', title: 'Gioca', description: 'Classifica le carte e guadagna Punti Poké.', icon: <FlaskConical size={21} />, className: 'portal-v2-game' },
    { id: 'pokedex', title: 'Archivio Nazionale', description: archiveUnlocked ? 'Consulta specie, strumenti e materiali.' : 'Accesso riservato: consulta i requisiti per sbloccarlo.', icon: <BookOpen size={21} />, className: 'portal-v2-archive', status: archiveUnlocked ? 'Disponibile' : 'Bloccato' },
    ...(inventory.includes('evolution-archive') ? [{ id: 'evolutions', title: 'Archivio delle evoluzioni', description: 'Consulta le linee evolutive e le condizioni di evoluzione.', icon: <GitBranch size={21} />, className: 'portal-v2-archive', status: 'Disponibile' }] : []),
    { id: 'registro', title: 'Registro personale', description: 'Rivedi i risultati e il tuo avanzamento.', icon: <Trophy size={21} />, className: 'portal-v2-record' },
    { id: 'academia', title: 'Accademia', description: 'Segui le lezioni, sostieni i test e consulta la pagella.', icon: <BookOpen size={21} />, className: 'portal-v2-academy' },
    { id: 'shop', title: 'Cartoleria', description: 'Acquista strumenti e potenziamenti.', icon: <ShoppingBag size={21} />, className: 'portal-v2-shop', status: availableShopCount > 0 ? availableShopCount + ' disponibili' : undefined },
  ];

  return (
    <div className="portal-dashboard portal-dashboard-refactor">
      {notice && <div className="notice-inline portal-notice" role="status">{notice}</div>}

      <section className="portal-v2-hero" aria-labelledby="portal-welcome-title">
        <div className="portal-v2-hero-copy">
          <span className="portal-v2-eyebrow"><GraduationCap size={15} /> AREA PERSONALE · {academyName(academy).toLocaleUpperCase('it-IT')}</span>
          <h1 id="portal-welcome-title">Bentornato, {displayNickname}.</h1>
          <p>Catalogazione, attività accademiche e progressi.</p>
          <div className="portal-v2-actions">
            <button type="button" className="portal-v2-primary" onClick={() => onNavigate('game')}><FlaskConical size={17} /> Continua a giocare <ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="portal-v2-campus-card">
          <div className="portal-v2-campus-heading"><span>IL TUO CAMPUS</span><span className="portal-v2-status-dot" /></div>
          <AcademyCrest academy={academy} className="portal-v2-crest" />
          <strong>{academyName(academy)}</strong>
          <span className="portal-v2-matricola">Matricola {student.matricola}</span>
          <div className="portal-v2-mini-progress" aria-label={percentage + '% del catalogo completato'}>
            <div><span>Catalogo Nazionale</span><strong>{percentage}%</strong></div>
            <div className="portal-v2-track"><span style={{ width: percentage + '%' }} /></div>
            <small>{completed.toLocaleString('it-IT')} di {NATIONAL_DEX_SIZE.toLocaleString('it-IT')} specie</small>
          </div>
        </div>
        <span className="portal-v2-orbit portal-v2-orbit-one" aria-hidden="true" />
        <span className="portal-v2-orbit portal-v2-orbit-two" aria-hidden="true" />
      </section>

      <section className="portal-v2-metrics" aria-label="Riepilogo del tuo account">
        <article className="portal-v2-metric portal-v2-metric-points">
          <span className="portal-v2-metric-icon">₱</span>
          <div><small>PORTAFOGLIO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div>
          <button type="button" aria-label="Apri la Cartoleria" onClick={() => onNavigate('shop')}><ChevronRight size={18} /></button>
        </article>
        <article className="portal-v2-metric portal-v2-metric-exams">
          <span className="portal-v2-metric-icon">✦</span>
          <div><small>AIUTI SBLOCCATI</small><strong>{inventory.length.toLocaleString('it-IT')}</strong><span>Strumenti e archivi</span></div>
          <button type="button" aria-label="Apri la Cartoleria" onClick={() => onNavigate('shop')}><ChevronRight size={18} /></button>
        </article>
        <article className="portal-v2-metric portal-v2-metric-catalog">
          <span className="portal-v2-metric-icon"><BookOpen size={21} /></span>
          <div><small>CATALOGO NAZIONALE</small><strong>{completed.toLocaleString('it-IT')}<i> / 1.025</i></strong><span>Specie catalogate</span></div>
          <button type="button" aria-label="Apri il Registro personale" onClick={() => onNavigate('registro')}><ChevronRight size={18} /></button>
        </article>
      </section>

      <section className="portal-v2-section" aria-labelledby="portal-shortcuts-title">
        <div className="portal-v2-section-heading">
          <div><span>ACCESSO RAPIDO</span><h2 id="portal-shortcuts-title">Da dove vuoi iniziare?</h2></div>
          
        </div>
        <div className="portal-v2-shortcut-grid">
          {shortcuts.map(item => (
            <button type="button" key={item.id} className={'portal-v2-shortcut ' + item.className} onClick={() => onNavigate(item.id)}>
              <span className="portal-v2-shortcut-icon">{item.icon}</span>
              <span className="portal-v2-shortcut-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
              {item.status && <span className={'portal-v2-shortcut-status' + (item.id === 'pokedex' && !archiveUnlocked ? ' is-locked' : '')}>{item.status}</span>}
              <ChevronRight className="portal-v2-shortcut-arrow" size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="portal-v2-lower-grid">
        <article className="portal-v2-progress-card">
          <div className="portal-v2-section-heading portal-v2-progress-heading">
            <div><span>IL TUO PERCORSO</span><h2>Avanzamento Pokédex</h2></div>
            <strong>{percentage}%</strong>
          </div>
          <div className="portal-v2-track portal-v2-main-track"><span style={{ width: percentage + '%' }} /></div>
          <div className="portal-v2-progress-foot"><span>{completed.toLocaleString('it-IT')} specie catalogate</span><span>{remaining.toLocaleString('it-IT')} da scoprire</span></div>
          <div className="portal-v2-progress-note"><BookOpen size={17} /></div>
        </article>
        <article className="portal-v2-account-card">
          <div className="portal-v2-section-heading"><div><span>STATO ACCOUNT</span><h2>La tua identità</h2></div></div>
          <div className="portal-v2-account-person">
            <span className="portal-v2-avatar">{currentProfileAvatarId ? <img src={avatarPortraitUrl(currentProfileAvatarId)} alt="" /> : '★'}</span>
            <div><strong>{displayNickname}</strong><small>{student.matricola}</small></div>
          </div>
          <div className="portal-v2-account-status"><span className={'portal-v2-identity-indicator ' + (communityIdentity ? 'is-verified' : hasCommunityToken() ? 'is-pending' : 'is-local')} /><div><strong>{identityLabel}</strong><small>{communityIdentity ? 'Il profilo online è attivo.' : hasCommunityToken() ? 'Controlla la connessione per verificare il profilo.' : 'I progressi restano salvati su questo browser.'}</small></div></div>
          <div className="portal-v2-account-status"><span className={'portal-v2-identity-indicator ' + (online ? 'is-verified' : 'is-pending')} /><div><strong>{online ? 'Connessione disponibile' : 'Modalità offline'}</strong><small>{online ? 'I servizi online sono raggiungibili.' : 'Puoi continuare con i dati già salvati.'}</small></div></div>
          <button type="button" className="portal-v2-account-link" onClick={() => onNavigate('profilo')}>Gestisci profilo <ChevronRight size={16} /></button>
        </article>
      </section>
    </div>
  );
}

export default function App() {
  const [species, setSpecies] = useState<PokemonSpecies[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [lessonDeck, setLessonDeck] = useState<CatalogCard[]>([]);
  const [lessonSolved, setLessonSolved] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [wrongTargetId, setWrongTargetId] = useState<string | null>(null);
  const [misplacedCards, setMisplacedCards] = useState<Record<string, string>>(() => progress.gameState?.misplacedCards ?? {});
  const [categoryPlacements, setCategoryPlacements] = useState<Record<string, string>>(() => progress.gameState?.categoryPlacements ?? {});
  const [lessonReady, setLessonReady] = useState(false);
  const [gamePage, setGamePage] = useState(() => progress.gameState?.gamePage ?? 0);
  const [openMacroId, setOpenMacroId] = useState<MacroId | null>(() => {
    const value = progress.gameState?.openMacroId;
    return value === 'pokemon' || value === 'items' || value === 'berries' || value === 'machines' || value === 'special' ? value : null;
  });
  const [openPokemonRegionId, setOpenPokemonRegionId] = useState<string | null>(() => progress.gameState?.openPokemonRegionId ?? null);
  const [openSubcategoryId, setOpenSubcategoryId] = useState<string | null>(() => progress.gameState?.openSubcategoryId ?? null);
  const setMessage = (_message: string) => {}; // Il feedback di classificazione resta intenzionalmente nascosto durante il gioco.
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [academy, setAcademy] = useState<string>(() => {
    try { return localStorage.getItem(ACADEMY_KEY) ?? ''; } catch { return ''; }
  });
  const [student, setStudent] = useState<StudentProfile | null>(loadStudent);
  const [showEnrollmentCard, setShowEnrollmentCard] = useState(false);
  const [nickname, setNickname] = useState('');
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [view, setView] = useState(() => {
    try {
      const savedView = localStorage.getItem('poke-study-current-view');
      return savedView || 'home';
    } catch {
      return 'home';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('poke-study-current-view', view);
    } catch {
      // La navigazione continua a funzionare anche se il browser blocca localStorage.
    }
  }, [view]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [itemCatalog, setItemCatalog] = useState<ApiNamedResource[]>([]);
  const [itemCatalogLoading, setItemCatalogLoading] = useState(false);
  const [typeCatalog, setTypeCatalog] = useState<PokemonTypeIndex[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [communityIdentity, setCommunityIdentity] = useState<CommunityIdentity | null>(null);
  const [identityCheckComplete, setIdentityCheckComplete] = useState(() => !hasCommunityToken());
  const [cloudStateIdentityId, setCloudStateIdentityId] = useState<string | null>(null);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communityNotice, setCommunityNotice] = useState('');
  const [communityThreads, setCommunityThreads] = useState<CommunityThread[]>([]);
  const [communityForumLoading, setCommunityForumLoading] = useState(false);
  const [communityForumError, setCommunityForumError] = useState('');
  const [communityThreadTitle, setCommunityThreadTitle] = useState('');
  const [communityThreadBody, setCommunityThreadBody] = useState('');
  const [communityThreadCategory, setCommunityThreadCategory] = useState<CommunityCategory>('generale');
  const [communityReplyDrafts, setCommunityReplyDrafts] = useState<Record<string, string>>({});
  const [communityReplyOpen, setCommunityReplyOpen] = useState<Record<string, boolean>>({});
  const [forumSearch, setForumSearch] = useState('');
  const [forumCategoryFilter, setForumCategoryFilter] = useState<'tutte' | 'discussioni' | 'domande' | 'annunci' | 'preferiti'>('tutte');
  const [forumSort, setForumSort] = useState<'recenti' | 'attive'>('recenti');
  const [showThreadComposer, setShowThreadComposer] = useState(false);
  const [forumFavorites, setForumFavorites] = useState<string[]>([]);
  const [forumDraftSaved, setForumDraftSaved] = useState(false);
  const [publicProfileId, setPublicProfileId] = useState<string | null>(null);
  const communityConfigured = isCommunityConfigured();
  const displayNickname = communityIdentity?.nickname ?? student?.nickname ?? 'Allenatore in formazione';

  const visibleCommunityThreads = useMemo(() => {
    const query = forumSearch.trim().toLocaleLowerCase('it-IT');
    return communityThreads
      .filter(thread => {
        if (forumCategoryFilter === 'tutte') return true;
        if (forumCategoryFilter === 'discussioni') return thread.category === 'generale' || thread.category === 'strategie';
        if (forumCategoryFilter === 'preferiti') return forumFavorites.includes(thread.id);
        return thread.category === forumCategoryFilter;
      })
      .filter(thread => !query || [thread.title, thread.body, thread.author?.matricola ?? '', ...(thread.posts ?? []).map(post => post.body), ...(thread.posts ?? []).map(post => post.author?.matricola ?? '')].join(' ').toLocaleLowerCase('it-IT').includes(query))
      .sort((a, b) => forumSort === 'attive'
        ? new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [communityThreads, forumSearch, forumCategoryFilter, forumSort, forumFavorites]);

  useEffect(() => {
    if (!communityIdentity) {
      setForumFavorites([]);
      return;
    }
    const key = `poke-study-forum-favorites-v1-${communityIdentity.id}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
      setForumFavorites(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
      const rawDraft = localStorage.getItem(`poke-study-forum-draft-v1-${communityIdentity.id}`);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as { title?: unknown; body?: unknown; category?: unknown };
        setCommunityThreadTitle(current => current || (typeof draft.title === 'string' ? draft.title : ''));
        setCommunityThreadBody(current => current || (typeof draft.body === 'string' ? draft.body : ''));
        if (draft.category === 'generale' || draft.category === 'domande' || draft.category === 'strategie' || draft.category === 'annunci') {
          setCommunityThreadCategory(draft.category);
        }
        setForumDraftSaved(true);
      }
    } catch {
      setForumFavorites([]);
    }
  }, [communityIdentity]);

  useEffect(() => {
    if (!communityIdentity) return;
    const key = `poke-study-forum-draft-v1-${communityIdentity.id}`;
    if (!communityThreadTitle.trim() && !communityThreadBody.trim()) {
      try { localStorage.removeItem(key); } catch { /* local storage is optional */ }
      setForumDraftSaved(false);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify({ title: communityThreadTitle, body: communityThreadBody, category: communityThreadCategory, savedAt: new Date().toISOString() }));
      setForumDraftSaved(true);
    } catch {
      setForumDraftSaved(false);
    }
  }, [communityIdentity, communityThreadTitle, communityThreadBody, communityThreadCategory]);

  useEffect(() => {
    let active = true;
    if (!hasCommunityToken()) {
      setIdentityCheckComplete(true);
      return () => { active = false; };
    }
    getCommunityIdentity()
      .then(identity => { if (active) setCommunityIdentity(identity); })
      .catch(error => {
        if (active) setCommunityError(error instanceof Error ? error.message : 'Identità online non verificabile. Importa i metadati esportati in precedenza per recuperare l’account.');
      })
      .finally(() => { if (active) setIdentityCheckComplete(true); });
    // Verifica l'identità prima di mostrare la scelta dell'accademia.
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!communityIdentity || !communityConfigured || cloudStateIdentityId === communityIdentity.id) return;
    setCloudStateIdentityId(null);
    loadCommunityPlayerState()
      .then(async remote => {
        if (!active) return;
        let nextStudent: StudentProfile;
        let nextProgress: SavedProgress;
        if (remote.profile && remote.progress) {
          nextStudent = {
            nickname: communityIdentity.nickname,
            matricola: remote.profile.matricola,
            ...(remote.profile.avatarId ? { avatarId: remote.profile.avatarId } : {}),
            ...(remote.profile.profileSettings ? { profileSettings: remote.profile.profileSettings } : {}),
          };
          nextProgress = remote.progress;
        } else {
          // Migrate local data only when the stored profile matches this verified account.
          const localProfile = loadStudent();
          let localAcademy = '';
          try { localAcademy = localStorage.getItem(ACADEMY_KEY) ?? ''; } catch { /* storage unavailable */ }
          const sameLocalAccount = localProfile?.nickname === communityIdentity.nickname
            && localAcademy === communityIdentity.academy;
          nextStudent = sameLocalAccount && localProfile
            ? { ...localProfile, nickname: communityIdentity.nickname, matricola: communityIdentity.matricola }
            : { nickname: communityIdentity.nickname, matricola: communityIdentity.matricola };
          nextProgress = sameLocalAccount ? loadProgress() : emptyProgress();
          await saveCommunityPlayerState(nextStudent, nextProgress);
        }
        if (!active) return;
        setAcademy(communityIdentity.academy);
        setStudent(nextStudent);
        setProgress(nextProgress);
        setCategoryPlacements(nextProgress.gameState?.categoryPlacements ?? {});
        setMisplacedCards(nextProgress.gameState?.misplacedCards ?? {});
        setOpenMacroId((nextProgress.gameState?.openMacroId as MacroId | null | undefined) ?? null);
        setOpenSubcategoryId(nextProgress.gameState?.openSubcategoryId ?? null);
        setOpenPokemonRegionId(nextProgress.gameState?.openPokemonRegionId ?? null);
        setGamePage(nextProgress.gameState?.gamePage ?? 0);
        try {
          localStorage.setItem(ACADEMY_KEY, communityIdentity.academy);
          localStorage.setItem(STUDENT_KEY, JSON.stringify(nextStudent));
          localStorage.setItem(SAVE_KEY, JSON.stringify(nextProgress));
        } catch { /* local cache is optional */ }
        setCloudStateIdentityId(communityIdentity.id);
        setCommunityError('');
      })
      .catch(error => {
        if (!active) return;
        setCommunityError(error instanceof Error
          ? `Impossibile caricare/sincronizzare i dati dal database: ${error.message}`
          : 'Impossibile caricare i dati del giocatore dal database. Riprova quando sei online.');
      });
    return () => { active = false; };
  }, [communityIdentity, communityConfigured, cloudStateIdentityId, online]);

  useEffect(() => {
    if (!communityIdentity || cloudStateIdentityId !== communityIdentity.id || !student || !online) return;
    let active = true;
    const profileSnapshot = student;
    const progressSnapshot = progress;
    const timer = window.setTimeout(() => {
      saveCommunityPlayerState(profileSnapshot, progressSnapshot)
        .then(() => { if (active) setCommunityError(''); })
        .catch(error => {
          if (active) setCommunityError(error instanceof Error
            ? `Modifiche salvate sul dispositivo ma non ancora sincronizzate: ${error.message}`
            : 'Modifiche non ancora sincronizzate con il database. Riprova quando sei online.');
        });
    }, 700);
    return () => { active = false; window.clearTimeout(timer); };
  }, [communityIdentity, cloudStateIdentityId, student, progress, online]);

  useEffect(() => {
    if (view !== 'forum' || !communityIdentity || !communityConfigured) return;
    let active = true;
    setCommunityForumLoading(true);
    setCommunityForumError('');
    listCommunityThreads()
      .then(threads => { if (active) setCommunityThreads(threads); })
      .catch(error => { if (active) setCommunityForumError(error instanceof Error ? error.message : 'Impossibile caricare la Bacheca.'); })
      .finally(() => { if (active) setCommunityForumLoading(false); });
    return () => { active = false; };
  }, [view, communityIdentity, communityConfigured]);

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
        setSpecies(list);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('Non è stato possibile caricare il catalogo Pokémon. Controlla la connessione e riprova.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* storage may be unavailable */ }
  }, [progress]);

  useEffect(() => {
    if (!lessonReady) return;
    setProgress(old => {
      const nextGameState = {
        categoryPlacements,
        misplacedCards,
        openMacroId,
        openSubcategoryId,
        openPokemonRegionId,
        gamePage,
      };
      if (JSON.stringify(old.gameState) === JSON.stringify(nextGameState)) return old;
      return { ...old, gameState: nextGameState };
    });
  }, [lessonReady, categoryPlacements, misplacedCards, openMacroId, openSubcategoryId, openPokemonRegionId, gamePage]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if ((view !== 'shop' && view !== 'pokedex' && view !== 'evolutions' && view !== 'game' && view !== 'registro') || itemCatalog.length) return;
    let active = true;
    const cacheKey = ITEM_IMAGE_CACHE_KEY;
    setItemCatalogLoading(true);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setItemCatalog(JSON.parse(cached) as ApiNamedResource[]);
    } catch { /* ignore broken cache */ }
    fetch(`${import.meta.env.BASE_URL}data/items.json`)
      .then(response => { if (!response.ok) throw new Error('Catalogo locale strumenti non disponibile'); return response.json(); })
      .then(items => {
        if (!active) return;
        const sorted = (items as ApiNamedResource[]).sort((a, b) => a.name.localeCompare(b.name));
        setItemCatalog(sorted);
        try { localStorage.setItem(cacheKey, JSON.stringify(sorted)); } catch { /* quota storage */ }
      })
      .catch(() => { if (active && !itemCatalog.length) setNotice('Catalogo locale strumenti non disponibile: aggiorna la pagina quando sei online.'); })
      .finally(() => { if (active) setItemCatalogLoading(false); });
    return () => { active = false; };
  }, [view, online]);

  useEffect(() => {
    if (view !== 'registro' || typeCatalog.length) return;
    let active = true;
    const cacheKey = 'poke-study-api-types-v1';
    try { const cached = localStorage.getItem(cacheKey); if (cached) { setTypeCatalog(JSON.parse(cached) as PokemonTypeIndex[]); return; } } catch { /* ignore broken cache */ }
    if (!navigator.onLine) { setNotice('I progressi per tipo richiedono un primo caricamento online.'); return; }
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

  const lessonTargets = useMemo(() => {
    const targets = new Map<string, { id: string; macroId: string; macroName: string; name: string; total: number; solved: number }>();
    for (const card of lessonDeck) {
      const existing = targets.get(card.subcategoryId);
      if (existing) {
        existing.total += 1;
        if (lessonSolved.includes(card.id)) existing.solved += 1;
      } else {
        targets.set(card.subcategoryId, {
          id: card.subcategoryId,
          macroId: card.macroId,
          macroName: card.macroName,
          name: card.subcategoryName,
          total: 1,
          solved: lessonSolved.includes(card.id) ? 1 : 0,
        });
      }
    }
    for (const region of regions) {
      const id = 'pokemon-' + region.name.toLowerCase();
      targets.set(id, {
        id, macroId: 'pokemon', macroName: 'Pokémon', name: region.name,
        total: region.end - region.start + 1,
        solved: progress.completedIds.filter(pokemonId => pokemonId >= region.start && pokemonId <= region.end).length,
      });
    }
    const macroOrder: Record<string, number> = Object.fromEntries(MACRO_CATEGORIES.map((category, index) => [category.id, index]));
    const regionOrder = new Map(regions.map((region, index) => [region.name, index]));
    return [...targets.values()].sort((a, b) =>
      (macroOrder[a.macroId] ?? 99) - (macroOrder[b.macroId] ?? 99) ||
      (a.macroId === 'pokemon' && b.macroId === 'pokemon'
        ? (regionOrder.get(a.name) ?? 99) - (regionOrder.get(b.name) ?? 99)
        : a.name.localeCompare(b.name, 'it')),
    );
  }, [lessonDeck, lessonSolved, progress.completedIds]);
  const remainingLessonCards = useMemo(
    () => lessonDeck.filter(card => !lessonSolved.includes(card.id) && !Object.prototype.hasOwnProperty.call(misplacedCards, card.id)),
    [lessonDeck, lessonSolved, misplacedCards],
  );
  const gamePageSize = 15;
  const gamePageCount = Math.max(1, Math.ceil(remainingLessonCards.length / gamePageSize));
  const safeGamePage = Math.min(gamePage, gamePageCount - 1);
  const visibleGameCards = remainingLessonCards.slice(safeGamePage * gamePageSize, safeGamePage * gamePageSize + gamePageSize);
  const currentMacroTargets = openMacroId ? lessonTargets.filter(target => target.macroId === openMacroId) : [];
  const currentMacro = MACRO_CATEGORIES.find(category => category.id === openMacroId);
  const currentPokemonRegion = openPokemonRegionId ? regions.find(region => 'pokemon-' + region.name.toLowerCase() === openPokemonRegionId) : undefined;
  const currentSubcategory = openSubcategoryId ? lessonTargets.find(target => target.id === openSubcategoryId) : undefined;
  const currentSubcategoryCards = currentSubcategory ? lessonDeck.filter(card => card.subcategoryId === currentSubcategory.id) : [];
  const macroFolderCounts = MACRO_CATEGORIES.map(category => ({
    ...category,
    total: lessonTargets.filter(target => target.macroId === category.id).reduce((sum, target) => sum + target.total, 0),
    solved: lessonTargets.filter(target => target.macroId === category.id).reduce((sum, target) => sum + target.solved, 0),
  }));
  useEffect(() => {
    if (gamePage !== safeGamePage) setGamePage(safeGamePage);
  }, [gamePage, safeGamePage]);
  const currentProfileAvatarId = STARTER_POKEMON_IDS.includes(student?.avatarId ?? -1) ? student?.avatarId : STARTER_POKEMON_IDS[0];
  const inventory = progress.inventory ?? [];
  const shopProducts = useMemo(
    () => priceShopProducts(NATIONAL_DEX_SIZE + itemCatalog.length),
    [itemCatalog.length],
  );
  const shopPricingReady = itemCatalog.length > 0;
  const availableShopCount = shopProducts.filter(product => !inventory.includes(product.id)
    && productUnlocked(product, inventory, progress.completedIds.length)
    && shopPricingReady
    && progress.points >= product.cost).length;

  useEffect(() => {
    if (lessonReady || species.length === 0 || itemCatalog.length === 0) return;
    const fullDeck = createFullCatalog(species, itemCatalog, [], []);
    setLessonDeck(fullDeck);
    setLessonSolved(fullDeck.filter(card => card.kind === 'pokemon'
      ? progress.completedIds.includes(card.pokemonId ?? -1)
      : (progress.completedEntries ?? []).includes(card.id)).map(card => card.id));
    setLessonReady(true);
  }, [species, itemCatalog, lessonReady, progress.completedIds, progress.completedEntries]);

  function toggleCardSelection(cardId: string) {
    const multiLevel = Math.max(0, ...(progress.inventory ?? []).map(id => /^multi-select-([1-8])$/.test(id) ? Number(id.match(/[1-8]$/)?.[0] ?? 0) : 0));
    const maxSelected = multiLevel > 0 ? multiLevel + 2 : 1;
    setSelectedCardIds(current => {
      if (current.includes(cardId)) {
        const next = current.filter(id => id !== cardId);
        setSelectedCardId(primary => primary === cardId ? (next[next.length - 1] ?? null) : primary);
        return next;
      }
      if (current.length >= maxSelected) {
        setMessage(`Puoi selezionare al massimo ${maxSelected} entità con il potenziamento acquistato.`);
        return current;
      }
      setSelectedCardId(cardId);
      setMessage(maxSelected > 1 ? `Selezionate ${current.length + 1} di ${maxSelected} entità. Seleziona una destinazione per classificare la carta principale; le altre selezioni resteranno attive.` : 'Carta selezionata. Apri una macrocategoria e poi la sottocategoria corretta.');
      return [...current, cardId];
    });
  }

  function placeCard(cardId: string, targetId: string) {
    // Se la carta è nella selezione multipla, applica la destinazione a tutte.
    const batchIds = selectedCardIds.includes(cardId) && selectedCardIds.length > 1
      ? [...selectedCardIds]
      : [cardId];
    if (batchIds.length > 1) {
      const targetSubcategoryId = targetId.match(/^category-slot:(.+):\d+$/)?.[1] ?? targetId;
      const targetIsSubcategory = lessonTargets.some(target => target.id === targetSubcategoryId);
      if (targetIsSubcategory) {
        const capacity = lessonDeck.filter(entry => entry.subcategoryId === targetSubcategoryId).length;
        const occupied = new Set(Object.entries(categoryPlacements)
          .filter(([, value]) => value.startsWith('category-slot:' + targetSubcategoryId + ':'))
          .map(([, value]) => Number(value.split(':').pop())));
        if (capacity - occupied.size < batchIds.length) {
          setMessage(`La destinazione non ha abbastanza posizioni libere per tutte le ${batchIds.length} entità selezionate.`);
          return;
        }
      }
      batchIds.forEach(id => placeSingleCard(id, targetId));
      return;
    }
    placeSingleCard(cardId, targetId);
  }

  function placeSingleCard(cardId: string, targetId: string) {
    const card = lessonDeck.find(entry => entry.id === cardId);
    if (!card || lessonSolved.includes(cardId)) return;
    const requestedCategorySlot = targetId.match(/^category-slot:(.+):(\d+)$/);
    const requestedSubcategoryId = requestedCategorySlot ? requestedCategorySlot[1] : targetId;
    const subcategoryTarget = lessonTargets.find(target => target.id === requestedSubcategoryId);
    const pokemonSlotMatch = targetId.match(/^pokemon-slot:(\d+)$/);
    const categorySlotMatch = targetId.match(/^category-slot:(.+):(\d+)$/);
    const targetSubcategoryId = categorySlotMatch ? categorySlotMatch[1] : targetId;
    if (subcategoryTarget || categorySlotMatch) setCategoryPlacements(old => {
      const next = { ...old };
      const targetPrefix = 'category-slot:' + requestedSubcategoryId + ':';
      delete next[cardId];
      const occupied = new Set(Object.entries(next)
        .filter(([, value]) => value.startsWith(targetPrefix))
        .map(([, value]) => Number(value.split(':').pop())));
      const slots = lessonDeck.filter(entry => entry.subcategoryId === requestedSubcategoryId);
      const requestedIndex = categorySlotMatch ? Number(categorySlotMatch[2]) : -1;
      const index = requestedIndex >= 0 && !occupied.has(requestedIndex)
        ? requestedIndex
        : slots.findIndex((_, slotIndex) => !occupied.has(slotIndex));
      if (index >= 0) next[cardId] = targetPrefix + index;
      return next;
    });
    const isCorrect = pokemonSlotMatch
      ? card.kind === 'pokemon' && card.pokemonId === Number(pokemonSlotMatch[1])
      : card.subcategoryId === targetSubcategoryId;
    if (!isCorrect) {
      setMisplacedCards(old => ({ ...old, [cardId]: targetId }));
      const errorTarget = pokemonSlotMatch ? `Pokédex nazionale #${pokemonSlotMatch[1]}` : (lessonTargets.find(target => target.id === targetSubcategoryId)?.name ?? targetSubcategoryId);
      const errorTimestamp = Date.now();
      setProgress(old => ({ ...old, errors: (old.errors ?? 0) + 1, history: [...(old.history ?? []), { id: `error-${errorTimestamp}-${card.id}`, timestamp: errorTimestamp, kind: 'error' as const, title: 'Tentativo non corretto', detail: `${card.name} · destinazione: ${errorTarget}` }].slice(-100) }));
      setSelectedCardId(cardId);
      setWrongTargetId(inventory.includes('subcategory-errors') ? targetId : null);
      setMessage('');
      return;
    }

    setMisplacedCards(old => {
      if (!(cardId in old)) return old;
      const next = { ...old };
      delete next[cardId];
      return next;
    });
    setLessonSolved(old => old.includes(cardId) ? old : [...old, cardId]);
    setProgress(old => {
      if (card.kind === 'pokemon') {
        const pokemonId = card.pokemonId;
        if (!pokemonId || old.completedIds.includes(pokemonId)) return old;
        const completedIds = [...old.completedIds, pokemonId];
        const timestamp = Date.now();
        const newEvents = [
          { id: `catalog-${timestamp}-${card.id}`, timestamp, kind: 'catalog' as const, title: 'Pokémon catalogato', detail: `${card.name} · numero nazionale #${pokemonId}` },
        ];
        return { ...old, points: old.points + 1, completedIds, history: [...(old.history ?? []), ...newEvents].slice(-100) };
      }
      const completedEntries = old.completedEntries ?? [];
      if (completedEntries.includes(card.id)) return old;
      const timestamp = Date.now();
      return { ...old, points: old.points + 1, completedEntries: [...completedEntries, card.id], history: [...(old.history ?? []), { id: `catalog-${timestamp}-${card.id}`, timestamp, kind: 'catalog' as const, title: 'Entità classificata', detail: `${card.name} · ${card.subcategoryName}` }].slice(-100) };
    });
    setSelectedCardIds(current => {
      const next = current.filter(id => id !== cardId);
      setSelectedCardId(primary => primary === cardId ? (next[next.length - 1] ?? null) : primary);
      return next;
    });
    setWrongTargetId(null);
    setMessage(pokemonSlotMatch ? 'Pokémon collocato correttamente. +1 Punto Poké.' : 'Classificazione corretta. +1 Punto Poké. Le informazioni restano riservate: sbloccale con gli strumenti acquistati.');
  }

  function chooseAcademy(next: string) {
    setAcademy(next);
  }

  async function completeEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    if (!academy || !cleanNickname || enrollmentBusy) return;
    setEnrollmentBusy(true);
    setEnrollmentError('');
    try {
      if (!communityConfigured) throw new Error('Il servizio account online non è configurato. Riprova dopo il rilascio della versione aggiornata.');
      let identity: CommunityIdentity;
      if (hasCommunityToken()) {
        identity = await getCommunityIdentity();
        if (identity.nickname !== cleanNickname || identity.academy !== academy) {
          throw new Error('Nel browser è già presente un altro account online. Importa i metadati dell’account corretto prima di completare l’iscrizione.');
        }
      } else {
        identity = await createCommunityIdentity(cleanNickname, academy as CommunityAcademy);
      }
      const profile: StudentProfile = student?.nickname === identity.nickname
        ? { ...student, nickname: identity.nickname, matricola: identity.matricola }
        : { nickname: cleanNickname, matricola: identity.matricola };
      try {
        localStorage.setItem(ACADEMY_KEY, academy);
        localStorage.setItem(STUDENT_KEY, JSON.stringify(profile));
      } catch {
        throw new Error('Impossibile salvare il profilo su questo dispositivo. Verifica lo spazio disponibile e le impostazioni del browser.');
      }
      setCommunityIdentity(identity);
      setStudent(profile);
      setShowEnrollmentCard(true);
    } catch (error) {
      setEnrollmentError(error instanceof Error ? error.message : 'Non è stato possibile creare l’account online. Controlla la connessione e riprova.');
    } finally {
      setEnrollmentBusy(false);
    }
  }

  async function recoverEnrollmentAccount(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || enrollmentBusy || communityBusy) return;
    setEnrollmentBusy(true);
    setEnrollmentError('');
    setCommunityError('');
    try {
      const identity = await importCommunityMetadata(await file.text());
      const remote = await loadCommunityPlayerState();
      let profile: StudentProfile;
      let restoredProgress: SavedProgress;
      if (remote.profile && remote.progress) {
        profile = {
          nickname: identity.nickname,
          matricola: remote.profile.matricola,
          ...(remote.profile.avatarId ? { avatarId: remote.profile.avatarId } : {}),
            ...(remote.profile.profileSettings ? { profileSettings: remote.profile.profileSettings } : {}),
        };
        restoredProgress = remote.progress;
      } else {
        const localProfile = loadStudent();
        let localAcademy = '';
        try { localAcademy = localStorage.getItem(ACADEMY_KEY) ?? ''; } catch { /* storage unavailable */ }
        const sameLocalAccount = localProfile?.nickname === identity.nickname && localAcademy === identity.academy;
        profile = sameLocalAccount && localProfile
          ? { ...localProfile, nickname: identity.nickname, matricola: identity.matricola }
          : { nickname: identity.nickname, matricola: identity.matricola };
        restoredProgress = sameLocalAccount ? loadProgress() : emptyProgress();
        await saveCommunityPlayerState(profile, restoredProgress);
      }
      try {
        localStorage.setItem(ACADEMY_KEY, identity.academy);
        localStorage.setItem(STUDENT_KEY, JSON.stringify(profile));
        localStorage.setItem(SAVE_KEY, JSON.stringify(restoredProgress));
      } catch {
        throw new Error('Account verificato, ma non è stato possibile aggiornare la cache locale. I dati restano nel database; verifica le impostazioni del browser.');
      }
      setAcademy(identity.academy);
      setNickname(identity.nickname);
      setCommunityIdentity(identity);
      setStudent(profile);
      setProgress(restoredProgress);
      setCloudStateIdentityId(identity.id);
      setCommunityNotice('Account verificato. Profilo, avatar e progressi sono stati caricati dal database.');
      setShowEnrollmentCard(true);
    } catch (error) {
      setEnrollmentError(error instanceof Error ? error.message : 'Recupero account non riuscito. Verifica di aver selezionato il file JSON esportato da Poké Study.');
    } finally {
      input.value = '';
      setEnrollmentBusy(false);
    }
  }

  function navTo(next: string) {
    // La voce Archivio resta raggiungibile: la schermata stessa spiega i requisiti di sblocco.
    setView(next);
    setMobileMenu(false);
    setMobileMoreOpen(false);
    setNotice('');
  }

  function resetProgress() {
    if (!window.confirm('Vuoi azzerare punti, catalogazione, risultati, medaglie e storico? Il profilo studente e la matricola resteranno invariati.')) return;
    setProgress(emptyProgress());
    setLessonReady(false);
    setLessonDeck([]);
    setLessonSolved([]);
    setSelectedCardId(null);
    setSelectedCardIds([]);
    setMisplacedCards({});
    setCategoryPlacements({});
    setWrongTargetId(null);
    setMessage('Progressi azzerati. Il profilo studente è rimasto invariato.');
    setNotice('Registro personale azzerato. Profilo e matricola conservati.');
  }

  function buyItem(product: ShopProduct) {
    const currentInventory = progress.inventory ?? [];
    if (currentInventory.includes(product.id)) { setNotice('Questo articolo è già stato acquistato.'); return; }
    if (!productUnlocked(product, currentInventory, progress.completedIds.length)) {
      setNotice(product.requirementLabel ? `Requisito non soddisfatto: ${product.requirementLabel}.` : 'Questo articolo non è ancora sbloccato.');
      return;
    }
    if (progress.points < product.cost) { setNotice('Punti Poké insufficienti per questo acquisto.'); return; }
    setProgress(old => {
      const oldInventory = old.inventory ?? [];
      if (oldInventory.includes(product.id) || old.points < product.cost
        || !productUnlocked(product, oldInventory, old.completedIds.length)) return old;
      return {
        ...old,
        points: old.points - product.cost,
        inventory: [...oldInventory, product.id],
      };
    });
    setNotice(`Acquisto registrato: ${product.name}.`);
  }

  function useAbility(abilityId: 'scanner' | 'research') {
    if (!selectedCardId) { setNotice('Seleziona prima una carta da analizzare.'); return; }
    const card = lessonDeck.find(entry => entry.id === selectedCardId);
    if (!card || lessonSolved.includes(card.id)) { setNotice('Seleziona una carta ancora da classificare.'); return; }
    if (!(progress.inventory ?? []).includes(abilityId)) return;
    const until = progress.abilityCooldowns?.[abilityId] ?? 0;
    if (until > Date.now()) { setNotice(`Abilità in ricarica: ${cooldownLabel(until, Date.now())}.`); return; }
    const currentInventory = progress.inventory ?? [];
    const scannerLevel = Math.max(1, ...currentInventory.filter(id => id.startsWith('scanner-upgrade-')).map(id => Number(id.slice(id.lastIndexOf('-') + 1))));
    const researchLevel = Math.max(1, ...currentInventory.filter(id => id.startsWith('research-upgrade-')).map(id => Number(id.slice(id.lastIndexOf('-') + 1))));
    const cooldownMs = abilityId === 'scanner'
      ? Math.max(10_000, Math.round(300_000 * Math.pow(10 / 300, (scannerLevel - 1) / (SCANNER_LEVELS - 1))))
      : Math.max(10_000, Math.round(600_000 * Math.pow(10 / 600, (researchLevel - 1) / (RESEARCH_LEVELS - 1))));
    const hint = abilityId === 'scanner'
      ? `Scanner: questa carta appartiene alla macro categoria “${card.macroName}”.`
      : `Ricerca: la sottocategoria corretta è “${card.subcategoryName}”.`;
    setProgress(old => ({
      ...old,
      abilityCooldowns: { ...(old.abilityCooldowns ?? {}), [abilityId]: Date.now() + cooldownMs },
    }));
    setMessage(hint);
    setNotice(`${abilityId === 'scanner' ? 'Scanner' : 'Ricerca'} utilizzato. Cooldown: ${cooldownLabel(Date.now() + cooldownMs, Date.now())}.`);
  }

  async function downloadCommunityAccount() {
    setCommunityBusy(true);
    setCommunityError('');
    setCommunityNotice('');
    try {
      const metadata = await exportCommunityMetadata();
      const blob = new Blob([metadata], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'poke-study-account.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setCommunityNotice('File di recupero esportato. Contiene solo il riferimento dell’account e la credenziale privata: conservalo in un luogo sicuro e non condividerlo.');
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Esportazione account non riuscita.');
    } finally {
      setCommunityBusy(false);
    }
  }

  async function importCommunityAccount(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setCommunityBusy(true);
    setCommunityError('');
    setCommunityNotice('');
    try {
      const identity = await importCommunityMetadata(await file.text());
      setCommunityIdentity(identity);
      setCommunityError('');
      setCommunityNotice('Credenziale verificata dal server. Caricamento di profilo, avatar e progressi dal database…');
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Importazione account non riuscita.');
    } finally {
      input.value = '';
      setCommunityBusy(false);
    }
  }

  async function submitCommunityThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!communityIdentity) { setCommunityForumError('Crea o importa prima un’identità community dal Profilo.'); return; }
    setCommunityForumLoading(true);
    setCommunityForumError('');
    try {
      await createCommunityThread({ title: communityThreadTitle, body: communityThreadBody, category: communityThreadCategory });
      setCommunityThreadTitle('');
      setCommunityThreadBody('');
      setShowThreadComposer(false);
      if (communityIdentity) { try { localStorage.removeItem(`poke-study-forum-draft-v1-${communityIdentity.id}`); } catch { /* local storage is optional */ } }
      setForumDraftSaved(false);
      setCommunityThreads(await listCommunityThreads());
    } catch (error) {
      setCommunityForumError(error instanceof Error ? error.message : 'Non è stato possibile pubblicare la discussione.');
    } finally {
      setCommunityForumLoading(false);
    }
  }

  async function submitCommunityReply(event: FormEvent<HTMLFormElement>, threadId: string) {
    event.preventDefault();
    const body = (communityReplyDrafts[threadId] ?? '').trim();
    if (!body || !communityIdentity) return;
    setCommunityForumLoading(true);
    setCommunityForumError('');
    try {
      await createCommunityReply(threadId, body);
      setCommunityReplyDrafts(old => ({ ...old, [threadId]: '' }));
      setCommunityThreads(await listCommunityThreads());
    } catch (error) {
      setCommunityForumError(error instanceof Error ? error.message : 'Non è stato possibile pubblicare la risposta.');
    } finally {
      setCommunityForumLoading(false);
    }
  }

  function updateStudentProfile(updated: StudentProfile) {
    try { localStorage.setItem(STUDENT_KEY, JSON.stringify(updated)); } catch { /* storage unavailable */ }
    setStudent(updated);
  }

  function saveAvatar(id: number) {
    if (!student || !STARTER_POKEMON_IDS.includes(id)) return;
    updateStudentProfile({ ...student, avatarId: id });
    setNotice('Immagine profilo aggiornata.');
  }

  if (!identityCheckComplete || (communityIdentity && cloudStateIdentityId !== communityIdentity.id) || (Boolean(communityError) && hasCommunityToken() && !communityIdentity)) {
    const recoveryFailed = Boolean(communityError);
    const identityVerified = identityCheckComplete && Boolean(communityIdentity) && !recoveryFailed;

    return (
      <main className="recovery-screen">
        <div className="recovery-topbar">
          <a className="recovery-wordmark" href={import.meta.env.BASE_URL} aria-label="Poké Study, pagina iniziale">
            <span className="recovery-wordmark-mark"><span /></span>
            <span><strong>Poké Study</strong><small>PORTALE DELLO STUDENTE</small></span>
          </a>
          <span className="recovery-topbar-label">AREA RISERVATA</span>
        </div>

        <div className="recovery-layout">
          <section className={'recovery-card' + (recoveryFailed ? ' is-error' : '')} aria-labelledby="recovery-title" role={recoveryFailed ? 'alert' : 'status'} aria-live="polite">
            <div className="recovery-card-header">
              <span className="recovery-kicker">{recoveryFailed ? 'SINCRONIZZAZIONE INTERROTTA' : 'ACCESSO SICURO'}</span>
              <span className={'recovery-state-pill' + (recoveryFailed ? ' is-error' : '')}>
                <span aria-hidden="true" />
                {recoveryFailed ? 'Richiesto intervento' : 'Connessione in corso'}
              </span>
            </div>

            <div className="recovery-illustration" aria-hidden="true">
              {recoveryFailed ? <CloudDownload size={32} strokeWidth={1.7} /> : <div className="recovery-spinner"><span /></div>}
            </div>

            <h1 id="recovery-title">{recoveryFailed ? 'Non siamo riusciti a recuperare i dati' : 'Bentornato in Poké Study'}</h1>
            <p className="recovery-lead">
              {recoveryFailed
                ? 'Il portale non è riuscito a verificare il tuo account. I dati non vengono sovrascritti: puoi riprovare o importare un salvataggio.'
                : 'Stiamo verificando la tua identità e sincronizzando il profilo prima di aprire il portale.'}
            </p>

            {!recoveryFailed && <ol className="recovery-steps" aria-label="Fasi del recupero dati">
              <li className={identityCheckComplete ? 'is-complete' : 'is-current'}><span className="recovery-step-icon"><ShieldCheck size={17}/></span><span><strong>Verifica dell’account</strong><small>{identityCheckComplete ? 'Verifica completata' : 'Controllo delle credenziali'}</small></span><span className="recovery-step-status">{identityCheckComplete ? <CheckCircle2 size={17}/> : <span className="recovery-step-pulse"/>}</span></li>
              <li className={identityVerified ? 'is-complete' : identityCheckComplete ? 'is-current' : 'is-pending'}><span className="recovery-step-icon"><Database size={17}/></span><span><strong>Profilo e progressi</strong><small>{identityVerified ? 'Dati recuperati' : identityCheckComplete ? 'Recupero dei dati salvati' : 'In attesa della verifica'}</small></span><span className="recovery-step-status">{identityVerified ? <CheckCircle2 size={17}/> : identityCheckComplete ? <span className="recovery-step-pulse"/> : <Clock3 size={16}/>}</span></li>
              <li className="is-pending"><span className="recovery-step-icon"><GraduationCap size={17}/></span><span><strong>Preparazione del portale</strong><small>Ultimo passaggio prima dell’accesso</small></span><span className="recovery-step-status"><Clock3 size={16}/></span></li>
            </ol>}

            {recoveryFailed && <div className="recovery-error-detail">
              <strong>Dettaglio</strong>
              <p>{communityError}</p>
            </div>}

            {recoveryFailed && <div className="recovery-actions">
              <button type="button" className="recovery-primary-action" onClick={() => window.location.reload()}><RefreshCw size={16}/> Riprova il recupero</button>
              <div className="recovery-divider"><span>oppure</span></div>
              <label className="recovery-import-action">Importa un salvataggio<input type="file" accept="application/json,.json" disabled={enrollmentBusy || communityBusy || !communityConfigured} onChange={event => void recoverEnrollmentAccount(event)} /></label>
              {!communityConfigured && <small className="recovery-import-note">Importazione non disponibile: il servizio account non è configurato.</small>}
            </div>}

            <footer className="recovery-card-footer"><ShieldCheck size={15}/><span>{recoveryFailed ? 'Il recupero non modifica automaticamente il salvataggio locale.' : 'I tuoi dati vengono caricati prima di mostrare l’area personale.'}</span></footer>
          </section>
          <p className="recovery-page-footnote">POKÉ STUDY <span>·</span> PORTALE DIDATTICO FAN-MADE</p>
        </div>
      </main>
    );
  }

  if (!academy || !student) {
    const selectedAcademy = academyName(academy);
    if (academy && !student) {
      return (
        <main className="academy-choice-shell enrollment-shell">
          <div className="academy-choice-topline"><span>POKÉ STUDY</span><span>SEGRETERIA DIGITALE · IMMATRICOLAZIONE</span></div>
          <header className="academy-choice-brand">
            <div className="pokeball-mark" aria-hidden="true"><span /></div>
            <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Immatricolazione</h1><p>Anno accademico 2026/27</p></div>
          </header>
          <section className="academy-choice-intro enrollment-intro">
            <h2>Scegli il tuo nickname</h2>
            <p>Sarà il nome con cui comparirai nel portale.</p>
            <div className="enrollment-selected-academy">
              <div className="enrollment-selected-crest"><AcademyCrest academy={academy} className="academy-crest-image" /></div>
              <div><small>ACCADEMIA SELEZIONATA</small><strong>{selectedAcademy}</strong></div>
            </div>
          </section>
          <form className="enrollment-form" onSubmit={completeEnrollment}>
            <div className="enrollment-field-heading"><span>01</span><div><label htmlFor="student-nickname">Nickname</label><small>Da 1 a 24 caratteri.</small></div></div>
            <input id="student-nickname" name="nickname" type="text" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Es. AllenatorePikachu" maxLength={24} autoComplete="nickname" required />
            {enrollmentError && <p className="community-account-error" role="alert">{enrollmentError}</p>}
            {communityError && hasCommunityToken() && <div className="enrollment-recovery-alert"><strong>Identità online da verificare</strong><p>Token non verificato. Importa il file di recupero corretto.</p></div>}
            <button className="enrollment-submit" type="submit" disabled={enrollmentBusy}>{enrollmentBusy ? 'Verifica e registrazione…' : 'Crea identità e immatricolati'} {!enrollmentBusy && <ChevronRight size={18} />}</button>
            <button className="enrollment-back" type="button" disabled={enrollmentBusy} onClick={() => { setAcademy(''); setNickname(''); setEnrollmentError(''); }}>← Torna alla scelta dell'accademia</button>
          </form>
        </main>
      );
    }
    return (
      <main className="academy-choice-shell admission-shell">
        <div className="academy-choice-topline"><span>POKÉ STUDY</span><span>PORTALE DI AMMISSIONE · 2026/27</span></div>
        <header className="academy-choice-brand">
          <div className="pokeball-mark" aria-hidden="true"><span /></div>
          <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Accademia Pokémon</h1><p>Portale dello studente · Nuova immatricolazione</p></div>
        </header>
        <section className="academy-choice-intro admission-intro">
          <h2>Scegli l’accademia</h2>
          
        </section>
        <section className="enrollment-recovery-panel admission-recovery-panel" aria-label="Recupero salvataggio">
          <div className="enrollment-recovery-icon"><CheckCircle2 size={20}/></div>
          <div className="enrollment-recovery-copy"><strong>Sei già uno studente?</strong><p>Importa il file di recupero per caricare profilo e progressi salvati.</p></div>
          <label className="community-import-button enrollment-import-button">{enrollmentBusy ? 'Caricamento…' : 'Importa salvataggio'}<input type="file" accept="application/json,.json" disabled={enrollmentBusy || communityBusy || !communityConfigured} onChange={event => void recoverEnrollmentAccount(event)} /></label>
        </section>
        {(enrollmentError || communityError) && <p className="community-account-error" role="alert">{enrollmentError || communityError}</p>}
        <div className="academy-choice-grid">
          <button type="button" className="academy-choice-card academy-orange" onClick={() => chooseAcademy('arancia')}>
            <div className="academy-choice-card-top"><span>01 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest crest-orange"><AcademyCrest academy="arancia" className="academy-crest-image" /></div>
            <span className="academy-game-tag">POKÉMON SCARLATTO</span>
            <h3>Accademia Arancia</h3>
            <span className="academy-enroll">SCEGLI <ChevronRight size={17}/></span>
          </button>
          <button type="button" className="academy-choice-card academy-purple" onClick={() => chooseAcademy('uva')}>
            <div className="academy-choice-card-top"><span>02 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest crest-purple"><AcademyCrest academy="uva" className="academy-crest-image" /></div>
            <span className="academy-game-tag">POKÉMON VIOLETTO</span>
            <h3>Accademia Uva</h3>
            <span className="academy-enroll">SCEGLI <ChevronRight size={17}/></span>
          </button>
          <button type="button" className="academy-choice-card academy-blueberry" onClick={() => chooseAcademy('mirtillo')}>
            <div className="academy-choice-card-top"><span>03 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest"><AcademyCrest academy="mirtillo" className="academy-crest-image" /></div>
            <span className="academy-game-tag">IL DISCO INDACO</span>
            <h3>Istituto Mirtillo</h3>
            <span className="academy-enroll">SCEGLI <ChevronRight size={17}/></span>
          </button>
        </div>

      </main>
    );
  }

  if (showEnrollmentCard && student) {
    return (
      <main className="academy-choice-shell enrollment-shell enrollment-success">
        <div className="academy-choice-topline"><span>POKÉ STUDY</span><span>SEGRETERIA DIGITALE · ESITO UFFICIALE</span></div>
        <header className="academy-choice-brand">
          <div className="pokeball-mark" aria-hidden="true"><span /></div>
          <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Immatricolazione completata</h1><p>Benvenuto nel portale, {displayNickname}.</p></div>
        </header>
        <section className="enrollment-completion-banner"><span className="enrollment-completion-mark"><CheckCircle2 size={27}/></span><AcademyCrest academy={academy} className="enrollment-completion-crest" /><div><span>AMMISSIONE CONFERMATA</span><h2>{academyName(academy)}</h2><p>Il profilo locale è pronto e l'identità online è stata verificata.</p></div></section>
        <section className="matricola-card" aria-label="Codice matricola assegnato">
          <span>CODICE MATRICOLA LOCALE</span>
          <strong>{student.matricola}</strong>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(student.matricola); }}>Copia matricola</button>
        </section>
        <section className="enrollment-next-steps">
          <h3>Prima di entrare</h3>
          <div><span>1</span><p><strong>Conserva la matricola</strong><small>Identifica il profilo salvato su questo browser.</small></p></div>
          <div><span>2</span><p><strong>Scarica il file di recupero</strong><small>Ti permette di ripristinare la stessa identità online su un altro browser.</small></p></div>
          <div><span>3</span><p><strong>Inizia a catalogare</strong><small>I progressi di gioco restano locali e non vengono sincronizzati con l'identità online.</small></p></div>
        </section>
        {communityNotice && <p className="community-account-success" role="status">{communityNotice}</p>}
        {communityError && <p className="community-account-error" role="alert">{communityError}</p>}
        <div className="enrollment-success-actions">
          <button className="enrollment-submit enrollment-export" type="button" disabled={communityBusy} onClick={() => void downloadCommunityAccount()}>{communityBusy ? 'Preparazione file…' : 'Scarica file di recupero'} <ChevronRight size={18}/></button>
          <button className="enrollment-enter" type="button" onClick={() => { setShowEnrollmentCard(false); setView('home'); }}>Entra nel portale <ChevronRight size={18}/></button>
        </div>
        <p className="academy-choice-footnote">Il file JSON contiene una credenziale privata: conservalo in un luogo sicuro e non condividerlo. Se lo perdi insieme alla sessione, la stessa identità non può essere recuperata automaticamente.</p>
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
        <button className="mobile-toggle" aria-label={mobileMenu ? "Chiudi menu" : "Apri menu"} aria-expanded={mobileMenu} aria-controls="main-navigation" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="pokeball-mark" aria-label="Poké Ball"><span /></div>
        <div className="brand">
          <div className="brand-kicker">ACCADEMIA POKÉMON</div>
          <div className="brand-name">Accademia Pokémon <span>✦</span></div>
          <div className="brand-subtitle">Portale dello studente</div>
        </div>
        <StudentCard academy={academy} academyLabel={academyName(academy)} nickname={displayNickname} matricola={student?.matricola ?? ''} avatarId={currentProfileAvatarId} onOpen={() => navTo('profilo')} />
      </header>
      <nav id="main-navigation" aria-label="Navigazione principale" className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'home' ? 'active' : ''} aria-current={view === 'home' ? 'page' : undefined} onClick={() => navTo('home')}><GraduationCap size={16} /> Portale</button>
        <button className={view === 'game' ? 'active' : ''} aria-current={view === 'game' ? 'page' : undefined} onClick={() => navTo('game')}><FlaskConical size={16} /> Gioca</button>
        <button className={view === 'pokedex' ? 'active' : ''} aria-current={view === 'pokedex' ? 'page' : undefined} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Archivio Nazionale {!inventory.includes('national-catalog') && <span className="nav-lock-label">Bloccato</span>}</button>
        {inventory.includes('evolution-archive') && <button className={view === 'evolutions' ? 'active' : ''} aria-current={view === 'evolutions' ? 'page' : undefined} onClick={() => navTo('evolutions')}><GitBranch size={16} /> Archivio delle evoluzioni</button>}
        <button className={view === 'registro' ? 'active' : ''} aria-current={view === 'registro' ? 'page' : undefined} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} aria-current={view === 'shop' ? 'page' : undefined} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria {availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</button>
        <button className={view === 'academia' ? 'active' : ''} aria-current={view === 'academia' ? 'page' : undefined} onClick={() => navTo('academia')}><GraduationCap size={16} /> Accademia</button>
        <button className={view === 'classifica' ? 'active' : ''} aria-current={view === 'classifica' ? 'page' : undefined} onClick={() => navTo('classifica')}><Trophy size={16} /> Classifica</button>
        <button className={view === 'forum' ? 'active' : ''} aria-current={view === 'forum' ? 'page' : undefined} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca</button>
        {communityIdentity?.role === 'amministratore' && <button className={view === 'amministrazione' ? 'active' : ''} aria-current={view === 'amministrazione' ? 'page' : undefined} onClick={() => navTo('amministrazione')}><ShieldCheck size={16} /> Amministrazione</button>}
        <div className="nav-status">ARCHIVIO NAZIONALE · 1–1025</div>
      </nav>

      <main className={view === 'game' ? "page-layout game-layout" : "page-layout"}>
        <aside className="sidebar">
          <section className="side-box">
            <h2>AREA ALLIEVO</h2>
            <button className={view === 'pokedex' ? 'side-active' : ''} aria-current={view === 'pokedex' ? 'page' : undefined} onClick={() => navTo('pokedex')}>▸ Archivio Nazionale</button>
            {inventory.includes('evolution-archive') && <button className={view === 'evolutions' ? 'side-active' : ''} aria-current={view === 'evolutions' ? 'page' : undefined} onClick={() => navTo('evolutions')}>▸ Archivio delle evoluzioni</button>}
            <button className={view === 'registro' ? 'side-active' : ''} aria-current={view === 'registro' ? 'page' : undefined} onClick={() => navTo('registro')}>▸ Registro personale</button>
            <button className={view === 'shop' ? 'side-active' : ''} aria-current={view === 'shop' ? 'page' : undefined} onClick={() => navTo('shop')}>▸ Cartoleria {availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</button>
            <button className={view === 'academia' ? 'side-active' : ''} aria-current={view === 'academia' ? 'page' : undefined} onClick={() => navTo('academia')}>▸ Accademia</button>
          </section>
          <section className="side-box">
            <h2>LIBRETTO PERSONALE</h2>
            <div className="stat-row"><span>Punti Poké</span><strong>{progress.points}</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%` }} /></div>
            <small className="muted">{progress.completedIds.length} / {NATIONAL_DEX_SIZE} specie catalogate</small>
          </section>
          <section className="notice-box"><strong>AVVISO DEL PRESIDE</strong><p>Ogni collocazione corretta assegna 1 Punto Poké.</p></section>
          <div className="side-footer">POKÉ STUDY v0.2<br />Un progetto fan-made.</div>
        </aside>

        <section className="content">
          {view === 'home' && <PortalDashboard
            academy={academy}
            displayNickname={displayNickname}
            student={student}
            communityIdentity={communityIdentity}
            online={online}
            progress={progress}
            currentProfileAvatarId={currentProfileAvatarId}
            availableShopCount={availableShopCount}
            inventory={inventory}
            notice={notice}
            onNavigate={navTo}
          />}
          {view === 'evolutions' && (inventory.includes('evolution-archive') ? <EvolutionArchive species={species} items={itemCatalog} online={online} /> : <section className="archive-search"><div className="eyebrow">ACCESSO RISERVATO</div><h1>Archivio delle evoluzioni bloccato</h1><p>Acquista l’Archivio delle evoluzioni nella Cartoleria per consultare le linee evolutive.</p><button className="primary-button" onClick={() => navTo('shop')}>Vai alla Cartoleria</button></section>)}
          {view === 'pokedex' && (inventory.includes('national-catalog') ? <Archive
            species={species}
            items={itemCatalog}
            loadingSpecies={loading}
            loadingItems={itemCatalogLoading}
            online={online}
            completedPokemon={progress.completedIds}
            completedEntries={progress.completedEntries ?? []}
          /> : <section className="archive-search"><div className="eyebrow">ACCESSO RISERVATO</div><h1>Archivio Nazionale bloccato</h1><p>Per consultare le informazioni devi catalogare tutti i 1.025 Pokémon e acquistare con i Punti Poké lo Scanner, tutti i livelli di Ricerca e l’Archivio Nazionale.</p><p>Pokémon catalogati: <strong>{progress.completedIds.length} / {NATIONAL_DEX_SIZE}</strong></p><button className="primary-button" onClick={() => navTo('shop')}>Vai alla Cartoleria</button></section>)}
          {view === 'game' && <>
            {loadError && <div className="error-panel"><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Riprova</button></div>}
            <section className="challenge-board game-board mixed-lesson-board">
              <section className="game-zone game-slots-zone lesson-target-zone" aria-label="Cartelle di classificazione">
                <div className="game-zone-heading">
                  <strong>{currentSubcategory ? `SOTTOCARTELLA · ${currentSubcategory.name.toLocaleUpperCase('it')}` : currentMacro ? `CARTELLA · ${currentMacro.name.toLocaleUpperCase('it')}` : 'SCEGLI UNA MACROCATEGORIA'}</strong>
                  <span>{lessonSolved.length} / {lessonDeck.length} classificate</span>
                </div>
                {openSubcategoryId !== null && currentSubcategory ? (
                  <>
                    <div className="folder-toolbar">
                      <button type="button" className="folder-back-button" onClick={() => setOpenSubcategoryId(null)}>← Sottocategorie</button>
                      <span>{currentSubcategory.name} · scegli una posizione vuota</span>
                    </div>
                    <div className="pokemon-number-grid category-entity-grid" aria-label={'Posizioni della sottocategoria ' + currentSubcategory.name}>
                      {currentSubcategoryCards.map((_, index) => {
                        const slotId = 'category-slot:' + currentSubcategory.id + ':' + index;
                        const placed = Object.entries(categoryPlacements).find(([, placedTarget]) => placedTarget === slotId);
                        const placedCard = placed ? lessonDeck.find(entry => entry.id === placed[0]) : undefined;
                        const isWrong = Boolean(placedCard && (placedCard.subcategoryId !== currentSubcategory.id || Boolean(misplacedCards[placed[0]])));
                        return <button type="button" key={slotId} className={'pokemon-number-slot category-entity-slot ' + (placedCard ? 'category-entity-filled ' : '') + (isWrong && inventory.includes('subcategory-errors') ? 'pokemon-number-wrong' : '')} aria-label={placedCard ? 'Entità inserita, posizione ' + (index + 1) : 'Posizione vuota ' + (index + 1)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) placeCard(id, slotId); }} onClick={() => {
                          if (placedCard && lessonSolved.includes(placedCard.id)) {
                            setMessage('Questa entità è corretta e bloccata: non può essere rimossa.');
                            return;
                          }
                          if (placedCard) {
                            setCategoryPlacements(old => {
                              const next = { ...old };
                              delete next[placedCard.id];
                              return next;
                            });
                            setMisplacedCards(old => {
                              const next = { ...old };
                              delete next[placedCard.id];
                              return next;
                            });
                            setWrongTargetId(null);
                            setMessage('Entità errata rimossa dallo slot e restituita al catalogo.');
                            return;
                          }
                          if (selectedCardId) placeCard(selectedCardId, currentSubcategory.id);
                        }}>
                          {placedCard ? <img className="category-entity-image" src={placedCard.imageUrl} alt="" /> : <span className="empty-entity-slot" aria-hidden="true">+</span>}
                        </button>;
                      })}
                    </div>
                  </>
                ) : openMacroId === null ? (
                  <div className="category-targets-grid macro-folder-grid">
                    {macroFolderCounts.map(folder => <button
                      type="button"
                      key={folder.id}
                      className={'category-target macro-folder ' + (wrongTargetId === folder.id ? 'category-target-wrong' : '')}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => { event.preventDefault(); const cardId = event.dataTransfer.getData('text/plain'); if (cardId) placeCard(cardId, folder.id); }}
                      onClick={() => { setOpenMacroId(folder.id); setOpenPokemonRegionId(null); setOpenSubcategoryId(null); }}
                    >
                      <span className="folder-icon" aria-hidden="true">📁</span>
                      <span className="category-target-macro">MACROCATEGORIA</span>
                      <strong>{folder.name}</strong>
                      <small>{folder.solved} / {folder.total}</small>
                      {Object.entries(misplacedCards).filter(([, targetId]) => targetId === folder.id).map(([cardId]) => { const card = lessonDeck.find(entry => entry.id === cardId); return card ? <span key={cardId} role="button" tabIndex={0} className="misplaced-card-chip" title="Riprendi entità" onClick={event => { event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Entità ripresa: puoi ricollocarla.'); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Entità ripresa: puoi ricollocarla.'); } }}><img src={card.imageUrl} alt="" /></span> : null; })}
                    </button>)}
                  </div>
                ) : openMacroId === 'pokemon' && currentPokemonRegion ? (
                  <>
                    <div className="folder-toolbar">
                      <button type="button" className="folder-back-button" onClick={() => setOpenPokemonRegionId(null)}>← Regioni</button>
                      <span>{currentPokemonRegion.name} · scegli il numero corretto per la carta selezionata</span>
                    </div>
                    <div className="pokemon-number-grid" aria-label={'Posizioni Pokémon di ' + currentPokemonRegion.name}>
                      {Array.from({ length: currentPokemonRegion.end - currentPokemonRegion.start + 1 }, (_, index) => {
                        const nationalId = currentPokemonRegion.start + index;
                        const regionalNumber = index + 1;
                        const isCompleted = progress.completedIds.includes(nationalId);
                        const slotId = 'pokemon-slot:' + nationalId;
                        return <button
                          type="button"
                          key={nationalId}
                          className={'pokemon-number-slot pokemon-number-entity-slot ' + (isCompleted ? 'pokemon-number-complete ' : '') + (wrongTargetId === slotId ? 'pokemon-number-wrong' : '')}
                          aria-label={currentPokemonRegion.name + ', posizione regionale ' + regionalNumber + ', numero nazionale ' + nationalId + (isCompleted ? ', già completato' : '')}
                          disabled={isCompleted}
                          onDragOver={event => event.preventDefault()}
                          onDrop={event => { event.preventDefault(); const cardId = event.dataTransfer.getData('text/plain'); if (cardId) placeCard(cardId, slotId); }}
                          onClick={() => { if (selectedCardId) placeCard(selectedCardId, slotId); else setMessage('Seleziona prima una carta Pokémon, poi scegli il numero in cui collocarla.'); }}
                        >
                          <strong>#{String(regionalNumber).padStart(3, '0')}</strong>
                          <small>N. {String(nationalId).padStart(4, '0')}</small>
                          {isCompleted && (() => { const pokemon = lessonDeck.find(entry => entry.kind === 'pokemon' && entry.pokemonId === nationalId); return pokemon ? <img className="category-entity-image" src={pokemon.imageUrl} alt="" /> : <span aria-hidden="true">✓</span>; })()}
                          {Object.entries(misplacedCards).filter(([, targetId]) => targetId === slotId).map(([cardId]) => { const card = lessonDeck.find(entry => entry.id === cardId); return card ? <span key={cardId} role="button" tabIndex={0} className="misplaced-slot-chip" title="Riprendi Pokémon" onClick={event => { event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Pokémon ripreso: puoi ricollocarlo.'); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Pokémon ripreso: puoi ricollocarlo.'); } }}><img src={card.imageUrl} alt="" /></span> : null; })}
                        </button>;
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="folder-toolbar">
                      <button type="button" className="folder-back-button" onClick={() => { setOpenPokemonRegionId(null); setOpenMacroId(null); }}>← Indietro</button>
                      <span>{openMacroId === 'pokemon' ? (inventory.includes('direct-region') ? 'Seleziona un Pokémon e tocca la sua regione, oppure trascinalo nella regione senza scegliere il numero' : 'Seleziona una regione per aprire l’elenco numerato') : 'Apri la sottocartella corretta per la carta selezionata'}</span>
                    </div>
                    <div className="category-targets-grid subfolder-grid">
                      {currentMacroTargets.map(target => <button
                        type="button"
                        key={target.id}
                        className={'category-target subfolder-target ' + (target.solved === target.total ? 'category-target-complete ' : '')}
                        aria-label={openMacroId === 'pokemon' ? 'Apri la regione ' + target.name : 'Classifica in ' + target.name}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => {
                          event.preventDefault();
                          const cardId = event.dataTransfer.getData('text/plain');
                          if (!cardId) return;
                          if (openMacroId !== 'pokemon') {
                            placeCard(cardId, target.id);
                            return;
                          }
                          const draggedCard = lessonDeck.find(card => card.id === cardId);
                          if (inventory.includes('direct-region') && draggedCard?.kind === 'pokemon') {
                            placeCard(cardId, target.id);
                            setWrongTargetId(null);
                          }
                        }}
                        onClick={() => {
                          if (openMacroId === 'pokemon') {
                            const selectedCard = selectedCardId ? lessonDeck.find(card => card.id === selectedCardId) : undefined;
                            if (inventory.includes('direct-region') && selectedCard?.kind === 'pokemon') {
                              placeCard(selectedCard.id, target.id);
                              setWrongTargetId(null);
                              return;
                            }
                            setOpenPokemonRegionId(target.id);
                            setWrongTargetId(null);
                            setMessage('Regione ' + target.name + ' aperta. Seleziona un Pokémon e poi il suo numero, oppure trascinalo qui con Inserimento regionale rapido.');
                          } else {
                            setOpenSubcategoryId(target.id);
                            setWrongTargetId(null);
                          }
                        }}
                      >
                        <span className="folder-icon" aria-hidden="true">📂</span>
                        <strong>{target.name}</strong>
                        <small>{target.solved} / {target.total} {openMacroId === 'pokemon' ? 'posizioni completate' : 'classificate'}</small>
                        {Object.entries(misplacedCards).filter(([, targetId]) => targetId === target.id).map(([cardId]) => { const card = lessonDeck.find(entry => entry.id === cardId); return card ? <span key={cardId} role="button" tabIndex={0} className="misplaced-card-chip" title="Riprendi entità" onClick={event => { event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Entità ripresa: puoi ricollocarla.'); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setMisplacedCards(old => { const next = { ...old }; delete next[cardId]; return next; }); setWrongTargetId(null); setMessage('Entità ripresa: puoi ricollocarla.'); } }}><img src={card.imageUrl} alt="" /></span> : null; })}
                      </button>)}
                    </div>
                  </>
                )}
                {lessonReady && lessonDeck.length === 0 && <div className="empty-service lesson-empty"><h3>Catalogo completato</h3><p>Hai già classificato tutte le entità disponibili.</p></div>}
              </section>
              <section className="game-zone game-pokemon-zone" aria-label="Carte da classificare">
                <div className="game-zone-heading"><strong>ENTITÀ DA CLASSIFICARE</strong><span>{remainingLessonCards.length} rimanenti</span></div>
                <div className="ability-toolbar">{inventory.includes('scanner') && <button type="button" disabled={!selectedCardId || (progress.abilityCooldowns?.scanner ?? 0) > clockNow} onClick={() => useAbility('scanner')}><strong>Scanner</strong><small>{(progress.abilityCooldowns?.scanner ?? 0) > clockNow ? cooldownLabel(progress.abilityCooldowns?.scanner ?? 0,clockNow) : 'Pronto'}</small></button>}{inventory.includes('research') && <button type="button" disabled={!selectedCardId || (progress.abilityCooldowns?.research ?? 0) > clockNow} onClick={() => useAbility('research')}><strong>Ricerca</strong><small>{(progress.abilityCooldowns?.research ?? 0) > clockNow ? cooldownLabel(progress.abilityCooldowns?.research ?? 0,clockNow) : 'Pronto'}</small></button>}</div>
                {loading ? <div className="loading-panel"><div className="pokeball-loader" /><h3>Caricamento Pokémon…</h3></div>
                  : itemCatalog.length === 0 ? <div className="loading-panel"><h3>Catalogo in caricamento</h3><p>{online ? 'Caricamento degli oggetti e dei materiali…' : 'Serve una prima connessione per scaricare il catalogo completo.'}</p></div>
                  : visibleGameCards.length > 0 ? <>
                    <div className="game-pagination game-pagination-cards">
                      <button type="button" onClick={() => setGamePage(page => Math.max(0, page - 1))} disabled={safeGamePage === 0}>‹ Indietro</button>
                      <span>Pagina {safeGamePage + 1} / {gamePageCount}</span>
                      <button type="button" onClick={() => setGamePage(page => Math.min(gamePageCount - 1, page + 1))} disabled={safeGamePage >= gamePageCount - 1}>Avanti ›</button>
                    </div>
                    <div className="pokemon-cards mixed-card-grid">
                      {visibleGameCards.map(card => <button
                        key={card.id}
                        type="button"
                        aria-label={selectedCardIds.includes(card.id) ? 'Carta selezionata' : 'Seleziona carta da classificare'}
                        title="Seleziona carta"
                        className={`pokemon-card mixed-card ${selectedCardIds.includes(card.id) ? 'chosen' : ''}`}
                        draggable
                        onDragStart={event => event.dataTransfer.setData('text/plain', card.id)}
                        onClick={() => toggleCardSelection(card.id)}
                      >
                        <img src={card.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                        {inventory.includes('reveal-name') && <span className="revealed-card-name">{displayName(card.name)}</span>}
                      </button>)}
                    </div>
                    <div className="game-pagination game-pagination-cards">
                      <button type="button" onClick={() => setGamePage(page => Math.max(0, page - 1))} disabled={safeGamePage === 0}>‹ Indietro</button>
                      <span>Pagina {safeGamePage + 1} / {gamePageCount}</span>
                      <button type="button" onClick={() => setGamePage(page => Math.min(gamePageCount - 1, page + 1))} disabled={safeGamePage >= gamePageCount - 1}>Avanti ›</button>
                    </div>
                  </>
                  : <div className="round-complete"><h3>Catalogo completato!</h3><p>Hai classificato tutte le entità disponibili. I progressi sono stati salvati.</p></div>}
              </section>
            </section>
          </>}
                    {view === 'registro' && <PersonalRegister progress={progress} species={species} items={itemCatalog} loading={loading || itemCatalogLoading} configured={isCommunityConfigured()} identityReady={Boolean(communityIdentity)} academy={academy} typeCatalog={typeCatalog} typeLoading={typeLoading} online={online} onReset={resetProgress} />}
          {view === 'shop' && <Cartoleria
            academy={academy}
            progress={progress}
            availableShopCount={availableShopCount}
            shopProducts={shopProducts}
            inventory={inventory}
            shopPricingReady={shopPricingReady}
            productUnlocked={productUnlocked}
            buyItem={buyItem}
            notice={notice}
          />}

          {view === 'classifica' && <Leaderboard
            academy={academy}
            academyName={academyName(academy)}
            communityIdentity={communityIdentity}
            communityConfigured={communityConfigured}
            progress={progress}
            onConnect={() => navTo('profilo')}
            onOpenPublicProfile={setPublicProfileId}
          />}

          {view === 'profilo' && <StudentProfilePage
            academy={academy}
            student={student}
            progress={progress}
            species={species}
            communityIdentity={communityIdentity}
            online={online}
            configured={communityConfigured}
            communityBusy={communityBusy}
            communityNotice={communityNotice}
            communityError={communityError}
            onUpdateProfile={updateStudentProfile}
            onChooseAvatar={saveAvatar}
            onImportAccount={importCommunityAccount}
            onExportAccount={() => void downloadCommunityAccount()}
          />}

          {view === 'academia' && <Academy configured={isCommunityConfigured()} identityReady={Boolean(communityIdentity)} onOpenProfile={() => navTo('profilo')} />}

          {view === 'amministrazione' && <AdminPanel identity={communityIdentity} />}

          {view === 'forum' && <>
            <div className="breadcrumb">Home / Comunità / <b>Bacheca</b></div>
            <header className="forum-v2-hero">
              <div className="forum-v2-hero-copy">
                <span className="forum-v2-eyebrow"><GraduationCap size={14}/> PORTALE STUDENTI · POKÉ STUDY</span>
                <h1>Bacheca</h1>
                <p>Domande, idee e avvisi della comunità scolastica.</p>
                <div className="forum-v2-hero-meta"><span><MessageSquare size={14}/>{communityThreads.length} discussioni</span><span><MessageCircle size={14}/>{communityThreads.reduce((sum, thread) => sum + (thread.posts?.length ?? 0), 0)} risposte</span></div>
              </div>
              <div className="forum-v2-crest" aria-hidden="true"><GraduationCap size={28}/><span>AREA<br/>STUDENTI</span></div>
            </header>

            <section className="forum-v2-announcement" aria-label="Avviso della segreteria">
              <div className="forum-v2-announcement-ribbon"><Megaphone size={14}/> AVVISO DEL PORTALE <span>SEGRETERIA DIDATTICA</span></div>
              <div className="forum-v2-announcement-body"><span className="forum-v2-announcement-icon"><BookOpen size={23}/></span><div><h2>Benvenuto nella Bacheca</h2><p>Condividi dubbi e strategie, rispondi agli altri allievi e consulta gli annunci. Mantieni le conversazioni pertinenti e rispettose.</p></div><span className="forum-v2-official"><CheckCircle2 size={15}/> UFFICIALE</span></div>
            </section>

            <section className="forum-v2-workspace" aria-labelledby="forum-v2-discussions-title">
              <div className="forum-v2-section-heading">
                <div><span className="section-label">SPAZIO CONDIVISO</span><h2 id="forum-v2-discussions-title">Conversazioni</h2><p>Trova una discussione o aprine una nuova.</p></div>
                <div className="forum-v2-actions">
                  <button type="button" className="forum-v2-quiet-action" disabled={!communityIdentity || communityForumLoading} onClick={() => { if (communityIdentity) { setCommunityForumLoading(true); setCommunityForumError(''); listCommunityThreads().then(setCommunityThreads).catch(error => setCommunityForumError(error instanceof Error ? error.message : 'Impossibile aggiornare la Bacheca.')).finally(() => setCommunityForumLoading(false)); } }}><RefreshCw size={15}/> Aggiorna</button>
                  {communityIdentity && <button type="button" className="forum-v2-primary-action" onClick={() => setShowThreadComposer(open => !open)}>{showThreadComposer ? <X size={15}/> : <Plus size={16}/>} {showThreadComposer ? 'Chiudi' : 'Nuova discussione'}</button>}
                </div>
              </div>

              {!communityConfigured ? <div className="forum-v2-state-card"><Database size={24}/><div><strong>Bacheca in configurazione</strong><p>Il servizio online non è disponibile. Riprova dopo il rilascio della configurazione aggiornata.</p></div></div> : !communityIdentity ? <div className="forum-v2-state-card"><ShieldCheck size={24}/><div><strong>Accedi alla comunità</strong><p>Per leggere e pubblicare discussioni serve un’identità online verificata.</p></div><button type="button" className="forum-v2-primary-action" onClick={() => navTo('profilo')}>Vai al Profilo <ChevronRight size={15}/></button></div> : <>
                <div className="forum-v2-stat-grid">
                  <div><span>DISCUSSIONI</span><strong>{communityThreads.length}</strong><small>nella Bacheca</small></div>
                  <div><span>RISPOSTE</span><strong>{communityThreads.reduce((sum, thread) => sum + (thread.posts?.length ?? 0), 0)}</strong><small>contributi degli allievi</small></div>
                  <div><span>PREFERITI</span><strong>{forumFavorites.length}</strong><small>salvati per il tuo account</small></div>
                </div>

                {showThreadComposer && <form className="forum-v2-composer" onSubmit={event => void submitCommunityThread(event)}>
                  <div className="forum-v2-composer-heading"><div><span className="section-label">CONTRIBUISCI ALLA COMUNITÀ</span><h3>Nuova discussione</h3><p>Scrivi un titolo chiaro e aggiungi il contesto necessario.</p></div><button type="button" className="forum-v2-icon-button" aria-label="Chiudi composizione" onClick={() => setShowThreadComposer(false)}><X size={17}/></button></div>
                  <label>Titolo della discussione<input required minLength={5} maxLength={120} value={communityThreadTitle} onChange={event => setCommunityThreadTitle(event.target.value)} placeholder="Es. Come completare il Pokédex di Paldea"/></label>
                  <div className="forum-v2-form-row"><label>Sezione<select value={communityThreadCategory} onChange={event => setCommunityThreadCategory(event.target.value as CommunityCategory)}><option value="generale">Discussioni</option><option value="domande">Domande</option><option value="annunci">Annunci</option></select></label><span className="forum-v2-draft-status"><CheckCircle2 size={14}/>{forumDraftSaved ? 'Bozza salvata su questo dispositivo' : 'Bozza in preparazione'}</span></div>
                  <label>Messaggio<textarea required maxLength={5000} rows={5} value={communityThreadBody} onChange={event => setCommunityThreadBody(event.target.value)} placeholder="Condividi la tua domanda, esperienza o strategia…"/></label>
                  <div className="forum-v2-composer-footer"><span>{communityThreadBody.length.toLocaleString('it-IT')} / 5.000 caratteri · La bozza viene salvata automaticamente.</span><button type="submit" className="forum-v2-primary-action" disabled={communityForumLoading || communityThreadTitle.trim().length < 5 || !communityThreadBody.trim()}>{communityForumLoading ? <><RefreshCw size={15} className="forum-v2-spinning"/> Pubblicazione…</> : <><Plus size={15}/> Pubblica discussione</>}</button></div>
                </form>}

                <div className="forum-v2-discovery">
                  <label className="forum-v2-search"><Search size={18}/><input aria-label="Cerca nella Bacheca" type="search" value={forumSearch} onChange={event => setForumSearch(event.target.value)} placeholder="Cerca titoli, messaggi, risposte o matricole…"/>{forumSearch && <button type="button" aria-label="Cancella ricerca" onClick={() => setForumSearch('')}><X size={15}/></button>}</label>
                  <label className="forum-v2-sort"><SlidersHorizontal size={15}/><span>Ordina per</span><select aria-label="Ordina discussioni" value={forumSort} onChange={event => setForumSort(event.target.value as 'recenti' | 'attive')}><option value="recenti">Più recenti</option><option value="attive">Ultima attività</option></select></label>
                </div>

                <div className="forum-v2-filters" aria-label="Filtra le discussioni">
                  {([
                    {id:'tutte',label:'Tutte',count:communityThreads.length,icon:<Sparkles size={15}/>},
                    {id:'discussioni',label:'Discussioni',count:communityThreads.filter(thread => thread.category === 'generale' || thread.category === 'strategie').length,icon:<MessageSquare size={15}/>},
                    {id:'domande',label:'Domande',count:communityThreads.filter(thread => thread.category === 'domande').length,icon:<CircleHelp size={15}/>},
                    {id:'annunci',label:'Annunci',count:communityThreads.filter(thread => thread.category === 'annunci').length,icon:<Bell size={15}/>},
                    {id:'preferiti',label:'Preferiti',count:forumFavorites.length,icon:<Bookmark size={15}/>}
                  ] as {id:'tutte'|'discussioni'|'domande'|'annunci'|'preferiti';label:string;count:number;icon:ReactNode}[]).map(category => <button type="button" key={category.id} className={forumCategoryFilter === category.id ? 'is-active' : ''} aria-pressed={forumCategoryFilter === category.id} onClick={() => setForumCategoryFilter(category.id)}>{category.icon}<span>{category.label}</span><small>{category.count}</small></button>)}
                </div>

                {communityForumError && <div className="forum-v2-error" role="alert"><CircleHelp size={18}/><div><strong>Operazione non riuscita</strong><p>{communityForumError}</p></div><button type="button" onClick={() => setCommunityForumError('')} aria-label="Chiudi messaggio"><X size={16}/></button></div>}
                {communityForumLoading && <div className="forum-v2-loading" role="status"><span className="forum-v2-loading-pulse"/><span>Aggiornamento delle conversazioni…</span></div>}
                {!communityForumLoading && visibleCommunityThreads.length === 0 && <div className="forum-v2-empty"><span><Search size={24}/></span><h3>{forumCategoryFilter === 'preferiti' ? 'Nessun preferito salvato' : communityThreads.length === 0 ? 'La Bacheca è pronta' : 'Nessuna discussione trovata'}</h3><p>{forumCategoryFilter === 'preferiti' ? 'Salva una discussione con il segnalibro per ritrovarla rapidamente.' : communityThreads.length === 0 ? 'Apri la prima conversazione e avvia lo scambio con gli altri allievi.' : 'Prova a cambiare ricerca o sezione.'}</p>{communityThreads.length === 0 && <button type="button" className="forum-v2-primary-action" onClick={() => setShowThreadComposer(true)}><Plus size={15}/> Crea la prima discussione</button>}{communityThreads.length > 0 && <button type="button" className="forum-v2-quiet-action" onClick={() => {setForumSearch('');setForumCategoryFilter('tutte');}}>Azzera filtri</button>}</div>}

                <div className="forum-v2-thread-list">{visibleCommunityThreads.map(thread => {
                  const isFavorite = forumFavorites.includes(thread.id);
                  const categoryLabel = thread.category === 'domande' ? 'Domande' : thread.category === 'annunci' ? 'Annunci' : 'Discussioni';
                  return <article className="forum-v2-thread-card" id={`discussione-${thread.id}`} key={thread.id}>
                    <div className="forum-v2-thread-top"><span className={`forum-v2-category-tag category-${thread.category}`}>{thread.category === 'annunci' ? <Megaphone size={13}/> : thread.category === 'domande' ? <CircleHelp size={13}/> : <MessageSquare size={13}/>} {categoryLabel}</span><time dateTime={thread.created_at}>{new Date(thread.created_at).toLocaleDateString('it-IT', {day:'2-digit',month:'short',year:'numeric'})} · {new Date(thread.created_at).toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'})}</time></div>
                    <h3>{thread.title}</h3>
                    <div className="forum-v2-author"><span className={`forum-v2-avatar ${thread.author?.academy === 'uva' ? 'academy-uva' : thread.author?.academy === 'mirtillo' ? 'academy-mirtillo' : 'academy-arancia'}`}>{(thread.author?.matricola ?? 'S').slice(0,1).toLocaleUpperCase('it-IT')}</span><button type="button" disabled={!thread.author?.id} onClick={() => {if (thread.author?.id) setPublicProfileId(thread.author.id);}}>{thread.author?.matricola ?? 'Matricola non disponibile'}</button><span>·</span><span>{academyName(thread.author?.academy ?? 'arancia')}</span><span className="forum-v2-author-dot">·</span><span>{thread.posts?.length ?? 0} {(thread.posts?.length ?? 0) === 1 ? 'risposta' : 'risposte'}</span></div>
                    <p className="forum-v2-thread-body">{thread.body}</p>
                    <div className="forum-v2-thread-actions"><span><MessageCircle size={15}/>{thread.posts?.length ?? 0} risposte</span><div><button type="button" className={`forum-v2-action-button ${isFavorite ? 'is-saved' : ''}`} aria-pressed={isFavorite} onClick={() => setForumFavorites(current => {const next = current.includes(thread.id) ? current.filter(id => id !== thread.id) : [...current, thread.id]; try {localStorage.setItem(`poke-study-forum-favorites-v1-${communityIdentity.id}`, JSON.stringify(next));} catch {/* local storage is optional */} return next;})}>{isFavorite ? <BookmarkCheck size={15}/> : <Bookmark size={15}/>} {isFavorite ? 'Salvata' : 'Salva'}</button><a className="forum-v2-action-button" href={`#discussione-${thread.id}`} aria-label={`Link diretto a: ${thread.title}`}><Link2 size={15}/> Link diretto</a><button type="button" className="forum-v2-action-button forum-v2-reply-button" onClick={() => setCommunityReplyOpen(old => ({...old,[thread.id]:!old[thread.id]}))} aria-expanded={Boolean(communityReplyOpen[thread.id])}>{communityReplyOpen[thread.id] ? <X size={15}/> : <MessageSquare size={15}/>} {communityReplyOpen[thread.id] ? 'Chiudi risposte' : 'Rispondi'}</button></div></div>
                    {(thread.posts ?? []).map(post => <div className="forum-v2-reply" key={post.id}><p>{post.body}</p><small><button type="button" disabled={!post.author?.id} onClick={() => {if (post.author?.id) setPublicProfileId(post.author.id);}}>{post.author?.matricola ?? 'Matricola non disponibile'}</button><span>·</span>{new Date(post.created_at).toLocaleString('it-IT')}</small></div>)}
                    {communityReplyOpen[thread.id] && <form className="forum-v2-reply-form" onSubmit={event => void submitCommunityReply(event, thread.id)}><label htmlFor={`reply-${thread.id}`}>La tua risposta</label><textarea id={`reply-${thread.id}`} required maxLength={2000} rows={3} value={communityReplyDrafts[thread.id] ?? ''} onChange={event => setCommunityReplyDrafts(old => ({...old,[thread.id]:event.target.value}))} placeholder="Aggiungi un contributo utile…"/><div><span>Massimo 2.000 caratteri</span><button type="submit" className="forum-v2-primary-action" disabled={communityForumLoading || !(communityReplyDrafts[thread.id] ?? '').trim()}>{communityForumLoading ? 'Invio…' : 'Invia risposta'}</button></div></form>}
                  </article>;
                })}</div>
              </>}
            </section>
          </>}<footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
      {publicProfileId && <PublicStudentProfile identityId={publicProfileId} species={species} onClose={() => setPublicProfileId(null)} />}
      {mobileMoreOpen && <div className="mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
        <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Altre sezioni" onClick={event => event.stopPropagation()}>
          <div className="mobile-more-heading"><div><span>AREA ALLIEVO</span><strong>Altre sezioni</strong></div><button type="button" aria-label="Chiudi menu" onClick={() => setMobileMoreOpen(false)}><X size={19}/></button></div>
          <div className="mobile-more-grid">
            <button type="button" className={view === 'pokedex' ? 'active' : ''} aria-current={view === 'pokedex' ? 'page' : undefined} onClick={() => navTo('pokedex')}><BookOpen size={20}/><span>Archivio Nazionale</span>{!inventory.includes('national-catalog') && <small>Bloccato</small>}</button>
            <button type="button" className={view === 'shop' ? 'active' : ''} aria-current={view === 'shop' ? 'page' : undefined} onClick={() => navTo('shop')}><ShoppingBag size={20}/><span>Cartoleria</span>{availableShopCount > 0 && <small>{availableShopCount} disponibili</small>}</button>
            <button type="button" className={view === 'classifica' ? 'active' : ''} aria-current={view === 'classifica' ? 'page' : undefined} onClick={() => navTo('classifica')}><Trophy size={20}/><span>Classifica</span></button>
            <button type="button" className={view === 'forum' ? 'active' : ''} aria-current={view === 'forum' ? 'page' : undefined} onClick={() => navTo('forum')}><CircleHelp size={20}/><span>Bacheca</span></button>
            {communityIdentity?.role === 'amministratore' && <button type="button" className={view === 'amministrazione' ? 'active' : ''} aria-current={view === 'amministrazione' ? 'page' : undefined} onClick={() => navTo('amministrazione')}><ShieldCheck size={20}/><span>Amministrazione</span></button>}
            <button type="button" className={view === 'academia' ? 'active' : ''} aria-current={view === 'academia' ? 'page' : undefined} onClick={() => navTo('academia')}><GraduationCap size={20}/><span>Accademia</span></button>
          </div>
        </section>
      </div>}
      <nav className="mobile-app-nav" aria-label="Navigazione principale">
        <button className={view === 'home' ? 'active' : ''} aria-current={view === 'home' ? 'page' : undefined} onClick={() => navTo('home')}><GraduationCap size={21}/><span>Portale</span></button>
        <button className={view === 'game' ? 'active' : ''} aria-current={view === 'game' ? 'page' : undefined} onClick={() => navTo('game')}><FlaskConical size={21}/><span>Gioca</span></button>
        <button className={view === 'registro' ? 'active' : ''} aria-current={view === 'registro' ? 'page' : undefined} onClick={() => navTo('registro')}><Trophy size={21}/><span>Registro</span></button>
        <button className={view === 'academia' ? 'active' : ''} aria-current={view === 'academia' ? 'page' : undefined} onClick={() => navTo('academia')}><GraduationCap size={21}/><span>Accademia</span></button>
        <button className={mobileMoreOpen ? 'active' : ''} aria-expanded={mobileMoreOpen} aria-haspopup="dialog" onClick={() => setMobileMoreOpen(open => !open)}><Menu size={21}/><span>Altro</span></button>
      </nav>
    </div>
  );
}
