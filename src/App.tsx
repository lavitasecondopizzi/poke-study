import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from 'react';
import Archive from './Archive';
import { Bell, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Clock3, FlaskConical, GraduationCap, Menu, MessageSquare, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Trophy, X } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies, PokemonTypeIndex, SavedProgress, StudentProfile } from './types';
import { createCommunityIdentity, createCommunityReply, createCommunityThread, exportCommunityMetadata, getCommunityIdentity, hasCommunityToken, importCommunityMetadata, isCommunityConfigured, listCommunityThreads } from './community';
import type { CommunityAcademy, CommunityCategory, CommunityIdentity, CommunityThread } from './community';
import { createFullCatalog, MACRO_CATEGORIES } from './catalog';
import type { CatalogCard, MacroId } from './catalog';

const NATIONAL_DEX_SIZE = 1025;

type ShopCurrency = 'poke' | 'exam';
type ShopTab = 'oggetti' | 'super-aiuti';
type ShopProduct = {
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
  { id: 'digital-assistant', name: 'Assistente digitale', description: 'Sblocca un supporto passivo permanente per lo studio.', cost: 2, currency: 'exam', category: 'super-aiuti', kind: 'passive' },
  { id: 'evolution-archive', name: 'Archivio delle evoluzioni', description: 'Sblocca l’accesso permanente alle informazioni sulle evoluzioni.', cost: 3, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'evolution-tools-archive', name: 'Archivio degli strumenti evolutivi', description: 'Sblocca una raccolta dedicata agli strumenti evolutivi.', cost: 3, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'machines-archive', name: 'Archivio MT e tecniche', description: 'Sblocca una raccolta dedicata alle macchine e alle tecniche.', cost: 4, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'fossils-archive', name: 'Archivio fossili e reperti', description: 'Sblocca una raccolta dedicata a fossili e reperti.', cost: 4, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'held-items-archive', name: 'Archivio strumenti tenuti', description: 'Sblocca una raccolta dedicata agli strumenti tenuti.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'national-catalog', name: 'Archivio Nazionale completo', description: 'Sblocca il catalogo consultabile. Richiede tutti i 1.025 Pokémon e tutti i livelli di Scanner e Ricerca.', cost: 10, currency: 'exam', category: 'super-aiuti', requires: ['scanner', ...Array.from({ length: SCANNER_LEVELS - 1 }, (_, i) => `scanner-upgrade-${i + 2}`), 'research', ...Array.from({ length: RESEARCH_LEVELS - 1 }, (_, i) => `research-upgrade-${i + 2}`)], requiredPokemon: NATIONAL_DEX_SIZE, requirementLabel: 'Cataloga tutti i 1.025 Pokémon e acquista tutti i livelli di Scanner e Ricerca', kind: 'archive' },
  { id: 'academy-theme', name: 'Tema Accademia', description: 'Sblocca un tema grafico alternativo.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'exclusive-title', name: 'Titolo esclusivo', description: 'Sblocca un titolo personale da mostrare nel profilo.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'timed-training', name: 'Allenamento a tempo', description: 'Sblocca la modalità di allenamento a tempo quando disponibile.', cost: 8, currency: 'exam', category: 'super-aiuti', kind: 'mode' },
  { id: 'custom-challenges', name: 'Sfide personalizzate', description: 'Sblocca la modalità per configurare sfide quando disponibile.', cost: 10, currency: 'exam', category: 'super-aiuti', kind: 'mode' },
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
    return 0;
  };
  const purchasable = SHOP_PRODUCTS.filter(product => product.currency === 'poke');
  const weights = purchasable.map(weightFor);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const exactShares = purchasable.map((product, index) => ({
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
  return SHOP_PRODUCTS.map(product => product.currency === 'poke'
    ? { ...product, cost: prices.get(product.id) ?? product.cost }
    : product);
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
    mirtillo: { file: 'blueberry-academy-crest.svg', label: 'Stemma Istituto Mirtillo' },
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
    if (raw) { const saved = JSON.parse(raw) as Partial<SavedProgress>; return { points: Number(saved.points) || 0, completedIds: Array.isArray(saved.completedIds) ? saved.completedIds : [], examPoints: Number(saved.examPoints) || 0, completedExams: Array.isArray(saved.completedExams) ? saved.completedExams : [], inventory: Array.isArray(saved.inventory) ? saved.inventory : [], completedEntries: Array.isArray(saved.completedEntries) ? saved.completedEntries : [], abilityCooldowns: saved.abilityCooldowns && typeof saved.abilityCooldowns === 'object' ? saved.abilityCooldowns : {} }; }
  } catch { /* storage may be unavailable */ }
  return { points: 0, completedIds: [], examPoints: 0, completedExams: [], inventory: [], completedEntries: [], abilityCooldowns: {} };
}

function titleCase(name: string) {
  return name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

const STARTER_POKEMON_IDS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912];

function avatarPortraitUrl(id: number) {
  return `${import.meta.env.BASE_URL}images/portraits/${id}.png`;
}

const ITEM_IMAGE_CACHE_KEY = 'poke-study-local-items-v1';

function resourceId(url: string) {
  const parts = url.split('/').filter(Boolean);
  return Number(parts[parts.length - 1] ?? 0);
}

export default function App() {
  const [species, setSpecies] = useState<PokemonSpecies[]>([]);
  const [progress, setProgress] = useState<SavedProgress>(loadProgress);
  const [lessonDeck, setLessonDeck] = useState<CatalogCard[]>([]);
  const [lessonSolved, setLessonSolved] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [wrongTargetId, setWrongTargetId] = useState<string | null>(null);
  const [misplacedCards, setMisplacedCards] = useState<Record<string, string>>({});
  const [categoryPlacements, setCategoryPlacements] = useState<Record<string, string>>({});
  const [lessonReady, setLessonReady] = useState(false);
  const [gamePage, setGamePage] = useState(0);
  const [openMacroId, setOpenMacroId] = useState<MacroId | null>(null);
  const [openPokemonRegionId, setOpenPokemonRegionId] = useState<string | null>(null);
  const [openSubcategoryId, setOpenSubcategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState('Seleziona una carta e classificala nella sottocategoria corretta.');
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
  const [view, setView] = useState('home');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [itemCatalog, setItemCatalog] = useState<ApiNamedResource[]>([]);
  const [itemCatalogLoading, setItemCatalogLoading] = useState(false);
  const [shopTab, setShopTab] = useState<'oggetti' | 'super-aiuti'>('oggetti');
  const [typeCatalog, setTypeCatalog] = useState<PokemonTypeIndex[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [communityIdentity, setCommunityIdentity] = useState<CommunityIdentity | null>(null);
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
  const [forumCategoryFilter, setForumCategoryFilter] = useState<'tutte' | CommunityCategory>('tutte');
  const [forumSort, setForumSort] = useState<'recenti' | 'attive'>('recenti');
  const [showThreadComposer, setShowThreadComposer] = useState(false);
  const communityConfigured = isCommunityConfigured();
  const displayNickname = communityIdentity?.nickname ?? student?.nickname ?? 'Allenatore in formazione';

  const visibleCommunityThreads = useMemo(() => {
    const query = forumSearch.trim().toLocaleLowerCase('it-IT');
    return communityThreads
      .filter(thread => forumCategoryFilter === 'tutte' || thread.category === forumCategoryFilter)
      .filter(thread => !query || [thread.title, thread.body, thread.author?.nickname ?? '', ...(thread.posts ?? []).map(post => post.body), ...(thread.posts ?? []).map(post => post.author?.nickname ?? '')].join(' ').toLocaleLowerCase('it-IT').includes(query))
      .sort((a, b) => forumSort === 'attive'
        ? new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [communityThreads, forumSearch, forumCategoryFilter, forumSort]);

  useEffect(() => {
    let active = true;
    if (hasCommunityToken()) {
      getCommunityIdentity()
        .then(identity => { if (active) setCommunityIdentity(identity); })
        .catch(error => { if (active) setCommunityError(error instanceof Error ? error.message : 'Identità online non verificabile. Importa i metadati esportati in precedenza per recuperare l’account.'); });
    }
    // Non creare automaticamente una nuova identità se il token manca o non è più valido:
    // senza i metadati esportati, la vecchia identità non è recuperabile.
    return () => { active = false; };
  }, []);

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
    if ((view !== 'shop' && view !== 'pokedex' && view !== 'game') || itemCatalog.length) return;
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
    if (view !== 'esami' || typeCatalog.length) return;
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
  const visibleAvatars = species.filter(pokemon => STARTER_POKEMON_IDS.includes(pokemon.id));
  const currentProfileAvatarId = STARTER_POKEMON_IDS.includes(student?.avatarId ?? -1) ? student?.avatarId : STARTER_POKEMON_IDS[0];
  const inventory = progress.inventory ?? [];
  const completedExams = progress.completedExams ?? [];
  const shopProducts = useMemo(
    () => priceShopProducts(NATIONAL_DEX_SIZE + itemCatalog.length),
    [itemCatalog.length],
  );
  const shopPricingReady = itemCatalog.length > 0;
  const availableShopCount = shopProducts.filter(product => !inventory.includes(product.id)
    && productUnlocked(product, inventory, progress.completedIds.length)
    && (product.currency !== 'poke' || shopPricingReady)
    && (product.currency === 'poke' ? progress.points : progress.examPoints) >= product.cost).length;

  useEffect(() => {
    if (lessonReady || species.length === 0 || itemCatalog.length === 0) return;
    setLessonDeck(createFullCatalog(species, itemCatalog, progress.completedIds, progress.completedEntries ?? []));
    setLessonSolved([]);
    setLessonReady(true);
  }, [species, itemCatalog, lessonReady, progress.completedIds, progress.completedEntries]);

  function placeCard(cardId: string, targetId: string) {
    const card = lessonDeck.find(entry => entry.id === cardId);
    if (!card || lessonSolved.includes(cardId)) return;
    const subcategoryTarget = lessonTargets.find(target => target.id === targetId);
    if (subcategoryTarget) {
      const slots = lessonDeck.filter(entry => entry.subcategoryId === targetId);
      const occupied = new Set(Object.values(categoryPlacements)
        .filter(value => value.startsWith('category-slot:' + targetId + ':'))
        .map(value => Number(value.split(':').pop())));
      const firstFree = slots.findIndex((_, index) => !occupied.has(index));
      if (firstFree >= 0) targetId = 'category-slot:' + targetId + ':' + firstFree;
    }
    const pokemonSlotMatch = targetId.match(/^pokemon-slot:(\d+)$/);
    const categorySlotMatch = targetId.match(/^category-slot:(.+):(\d+)$/);
    const targetSubcategoryId = categorySlotMatch ? categorySlotMatch[1] : targetId;
    if (categorySlotMatch) setCategoryPlacements(old => {
      const next = { ...old };
      for (const [existingId, existingTarget] of Object.entries(next)) {
        if (existingId === cardId || existingTarget === targetId) delete next[existingId];
      }
      next[cardId] = targetId;
      return next;
    });
    const isCorrect = pokemonSlotMatch
      ? card.kind === 'pokemon' && card.pokemonId === Number(pokemonSlotMatch[1])
      : card.subcategoryId === targetSubcategoryId;
    if (!isCorrect) {
      setMisplacedCards(old => ({ ...old, [cardId]: targetId }));
      setSelectedCardId(null);
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
        const examsBefore = regions.filter(region =>
          Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
            .every(id => old.completedIds.includes(id)),
        ).length;
        const examsAfter = regions.filter(region =>
          Array.from({ length: region.end - region.start + 1 }, (_, i) => region.start + i)
            .every(id => completedIds.includes(id)),
        ).length;
        return {
          ...old,
          points: old.points + 1,
          completedIds,
          examPoints: old.examPoints + Math.max(0, examsAfter - examsBefore),
        };
      }
      const completedEntries = old.completedEntries ?? [];
      if (completedEntries.includes(card.id)) return old;
      return { ...old, points: old.points + 1, completedEntries: [...completedEntries, card.id] };
    });
    setSelectedCardId(null);
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
      const profile = { nickname: cleanNickname, matricola: createMatricola() };
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
      const profile = { nickname: identity.nickname, matricola: createMatricola() };
      try {
        localStorage.setItem(ACADEMY_KEY, identity.academy);
        localStorage.setItem(STUDENT_KEY, JSON.stringify(profile));
      } catch {
        throw new Error('Identità verificata, ma non è stato possibile salvare il profilo locale. Verifica le impostazioni di archiviazione del browser e riprova.');
      }
      setAcademy(identity.academy);
      setNickname(identity.nickname);
      setCommunityIdentity(identity);
      setStudent(profile);
      setCommunityNotice('Account esistente recuperato. È stata mantenuta la stessa identità online.');
      setShowEnrollmentCard(true);
    } catch (error) {
      setEnrollmentError(error instanceof Error ? error.message : 'Recupero account non riuscito. Verifica di aver selezionato il file JSON esportato da Poké Study.');
    } finally {
      input.value = '';
      setEnrollmentBusy(false);
    }
  }

  function navTo(next: string) {
    if (next === 'pokedex' && !(progress.inventory ?? []).includes('national-catalog')) {
      setNotice('Archivio Nazionale bloccato: cataloga tutti i 1.025 Pokémon e acquista tutti i potenziamenti informativi usando i Punti Poké, poi sbloccalo con i Punti esame.');
      setMobileMenu(false);
      setMobileMoreOpen(false);
      return;
    }
    setView(next);
    setMobileMenu(false);
    setMobileMoreOpen(false);
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

  function buyItem(product: ShopProduct) {
    const currentInventory = progress.inventory ?? [];
    if (currentInventory.includes(product.id)) { setNotice('Questo articolo è già stato acquistato.'); return; }
    if (!productUnlocked(product, currentInventory, progress.completedIds.length)) {
      setNotice(product.requirementLabel ? `Requisito non soddisfatto: ${product.requirementLabel}.` : 'Questo articolo non è ancora sbloccato.');
      return;
    }
    const balance = product.currency === 'poke' ? progress.points : progress.examPoints;
    if (balance < product.cost) { setNotice('Punti insufficienti per questo acquisto.'); return; }
    setProgress(old => {
      const oldInventory = old.inventory ?? [];
      const oldBalance = product.currency === 'poke' ? old.points : old.examPoints;
      if (oldInventory.includes(product.id) || oldBalance < product.cost
        || !productUnlocked(product, oldInventory, old.completedIds.length)) return old;
      return {
        ...old,
        points: product.currency === 'poke' ? old.points - product.cost : old.points,
        examPoints: product.currency === 'exam' ? old.examPoints - product.cost : old.examPoints,
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
      setCommunityNotice('Metadati account esportati. Conserva il file in un luogo privato: contiene il token di accesso.');
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
      setCommunityNotice('Identità ufficiale importata e verificata dal server. Il nickname ufficiale verrà usato nel portale quando sei connesso.');
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

  function saveAvatar(id: number) {
    if (!student) return;
    const updated = { ...student, avatarId: id };
    try { localStorage.setItem(STUDENT_KEY, JSON.stringify(updated)); } catch { /* storage unavailable */ }
    setStudent(updated);
    setNotice('Immagine profilo aggiornata.');
  }

  if (!academy || !student) {
    const selectedAcademy = academyName(academy);
    if (academy && !student) {
      return (
        <main className="academy-choice-shell enrollment-shell">
          <div className="academy-choice-topline"><span>POKÉ STUDY</span><span>SEGRETERIA DIGITALE · IMMATRICOLAZIONE</span></div>
          <header className="academy-choice-brand">
            <div className="pokeball-mark" aria-hidden="true"><span /></div>
            <div><span className="academy-choice-kicker">ISTITUTO DI RICERCA POKÉMON</span><h1>Completa l'immatricolazione</h1><p>Nuovo allievo · Anno accademico 2026/27</p></div>
          </header>
          <div className="enrollment-stepper" aria-label="Fase 2 di 3">
            <div className="enrollment-step is-complete"><span>✓</span><small>Accademia</small></div><i />
            <div className="enrollment-step is-current"><span>2</span><small>Identità</small></div><i />
            <div className="enrollment-step"><span>3</span><small>Conferma</small></div>
          </div>
          <section className="academy-choice-intro enrollment-intro">
            <span className="academy-choice-label">ACCADEMIA SELEZIONATA</span>
            <h2>{selectedAcademy}</h2>
            <p>Scegli il nickname ufficiale che userai nel portale. La prima immatricolazione crea un'identità online; i progressi del gioco continueranno a essere salvati localmente su questo dispositivo.</p>
          </section>
          <form className="enrollment-form" onSubmit={completeEnrollment}>
            <div className="enrollment-field-heading"><span>01</span><div><label htmlFor="student-nickname">Nickname allievo</label><small>Sarà il nome mostrato nella Bacheca e nel portale quando l'identità è verificata.</small></div></div>
            <input id="student-nickname" name="nickname" type="text" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Es. AllenatorePikachu" maxLength={24} autoComplete="nickname" required />
            <div className="enrollment-guidelines"><span>✓</span><p>Da 1 a 24 caratteri. Non serve una password né un indirizzo email; per creare l'identità la prima volta è necessaria una connessione Internet.</p></div>
            {enrollmentError && <p className="community-account-error" role="alert">{enrollmentError}</p>}
            {communityError && hasCommunityToken() && <div className="enrollment-recovery-alert"><strong>Identità online da verificare</strong><p>Il token presente nel browser non è stato verificato. Importa il file di recupero dell'account corretto per evitare di creare un'identità diversa.</p></div>}
            <button className="enrollment-submit" type="submit" disabled={enrollmentBusy}>{enrollmentBusy ? 'Verifica e registrazione…' : 'Crea identità e immatricolati'} {!enrollmentBusy && <ChevronRight size={18} />}</button>
            <button className="enrollment-back" type="button" disabled={enrollmentBusy} onClick={() => { setAcademy(''); setNickname(''); setEnrollmentError(''); }}>← Torna alla scelta dell'accademia</button>
          </form>
          <section className="enrollment-recovery-panel">
            <div className="enrollment-recovery-icon"><CheckCircle2 size={20}/></div>
            <div className="enrollment-recovery-copy"><strong>Hai già un account Poké Study?</strong><p>Recupera la stessa identità importando il file JSON esportato in precedenza. Il nickname e l'accademia saranno ripresi dall'account verificato.</p></div>
            <label className="community-import-button enrollment-import-button">Importa account esistente<input type="file" accept="application/json,.json" disabled={enrollmentBusy || communityBusy || !communityConfigured} onChange={event => void recoverEnrollmentAccount(event)} /></label>
          </section>
          <p className="academy-choice-footnote">Il file di recupero contiene una credenziale privata: non condividerlo. La matricola identifica il profilo locale, mentre il file permette di recuperare la stessa identità online.</p>
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
        <div className="enrollment-stepper" aria-label="Fase 1 di 3">
          <div className="enrollment-step is-current"><span>1</span><small>Accademia</small></div><i />
          <div className="enrollment-step"><span>2</span><small>Identità</small></div><i />
          <div className="enrollment-step"><span>3</span><small>Conferma</small></div>
        </div>
        <section className="academy-choice-intro admission-intro">
          <span className="academy-choice-label">NUOVO ALLIEVO · ANNO ACCADEMICO 2026/27</span>
          <h2>Seleziona la tua accademia</h2>
          <p>La tua avventura di studio comincia qui. Scegli il campus ispirato alla tua versione di Pokémon: potrai iniziare subito a catalogare le specie e costruire il tuo registro personale.</p>
        </section>
        <div className="academy-choice-grid">
          <button type="button" className="academy-choice-card academy-orange" onClick={() => chooseAcademy('arancia')}>
            <div className="academy-choice-card-top"><span>01 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest crest-orange"><AcademyCrest academy="arancia" className="academy-crest-image" /></div>
            <span className="academy-game-tag">POKÉMON SCARLATTO</span>
            <h3>Accademia Arancia</h3>
            <p>Un campus solare, tradizione di ricerca e spirito d'iniziativa.</p>
            <span className="academy-enroll">SCEGLI ACCADEMIA <ChevronRight size={17}/></span>
          </button>
          <button type="button" className="academy-choice-card academy-purple" onClick={() => chooseAcademy('uva')}>
            <div className="academy-choice-card-top"><span>02 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest crest-purple"><AcademyCrest academy="uva" className="academy-crest-image" /></div>
            <span className="academy-game-tag">POKÉMON VIOLETTO</span>
            <h3>Accademia Uva</h3>
            <p>Un campus elegante, ricerca metodica e nuove prospettive.</p>
            <span className="academy-enroll">SCEGLI ACCADEMIA <ChevronRight size={17}/></span>
          </button>
          <button type="button" className="academy-choice-card academy-blueberry" onClick={() => chooseAcademy('mirtillo')}>
            <div className="academy-choice-card-top"><span>03 / CAMPUS</span><span className="academy-campus-status">AMMISSIONI APERTE</span></div>
            <div className="academy-crest crest-blueberry"><AcademyCrest academy="mirtillo" className="academy-crest-image" /></div>
            <span className="academy-game-tag">IL DISCO INDACO</span>
            <h3>Istituto Mirtillo</h3>
            <p>Un campus internazionale dedicato all'allenamento e alle lotte Pokémon.</p>
            <span className="academy-enroll">SCEGLI ACCADEMIA <ChevronRight size={17}/></span>
          </button>
        </div>
        <section className="admission-info-grid" aria-label="Informazioni sull'immatricolazione">
          <article><span>01</span><div><strong>Scegli il campus</strong><p>Arancia, Uva o Mirtillo: tutti i campus danno accesso allo stesso catalogo.</p></div></article>
          <article><span>02</span><div><strong>Registra la tua identità</strong><p>Nickname ufficiale senza password o email. Puoi recuperare l'account con il file privato.</p></div></article>
          <article><span>03</span><div><strong>Inizia a studiare</strong><p>La progressione e gli acquisti restano sul dispositivo e non vengono cancellati dall'immatricolazione.</p></div></article>
        </section>
        <p className="academy-choice-footnote">L'accademia modifica l'identità visiva del campus, non la disponibilità delle specie: tutti i 1.025 Pokémon sono previsti nel percorso.</p>
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
        <div className="enrollment-stepper" aria-label="Fase 3 di 3">
          <div className="enrollment-step is-complete"><span>✓</span><small>Accademia</small></div><i />
          <div className="enrollment-step is-complete"><span>✓</span><small>Identità</small></div><i />
          <div className="enrollment-step is-current"><span>3</span><small>Conferma</small></div>
        </div>
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
        <button className="mobile-toggle" aria-label="Apri menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <div className="pokeball-mark" aria-label="Poké Ball"><span /></div>
        <div className="brand">
          <div className="brand-kicker">ACCADEMIA POKÉMON</div>
          <div className="brand-name">Accademia Pokémon <span>✦</span></div>
          <div className="brand-subtitle">Portale dello studente</div>
        </div>
        <button type="button" className="student-card" onClick={() => navTo('profilo')} aria-label="Apri il profilo studente"><AcademyCrest academy={academy} className="student-card-crest" /><span className="student-avatar">{currentProfileAvatarId ? <img src={avatarPortraitUrl(currentProfileAvatarId)} alt="" /> : '★'}</span><span className="student-card-copy"><small>PROFILO ALLIEVO · APRI</small><strong>{displayNickname}</strong><span>{student?.matricola ?? ''}</span><span>{academyName(academy)}</span></span></button>
      </header>
      <nav className={`main-nav ${mobileMenu ? 'nav-open' : ''}`}>
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={16} /> Portale</button>
        <button className={view === 'game' ? 'active' : ''} onClick={() => navTo('game')}><FlaskConical size={16} /> Gioca</button>
        {view !== 'game' && <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Archivio Nazionale</button>}
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria {availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</button>
        <button className={view === 'esami' ? 'active' : ''} onClick={() => navTo('esami')}><FlaskConical size={16} /> Esami</button>
        <button className={view === 'classifica' ? 'active' : ''} onClick={() => navTo('classifica')}><Trophy size={16} /> Classifica</button>
        <button className={view === 'profilo' ? 'active' : ''} onClick={() => navTo('profilo')}><GraduationCap size={16} /> Profilo</button>
        <button className={view === 'forum' ? 'active' : ''} onClick={() => navTo('forum')}><CircleHelp size={16} /> Bacheca</button>
        <div className="nav-status">ARCHIVIO NAZIONALE · 1–1025</div>
      </nav>

      <main className={view === 'game' ? "page-layout game-layout" : "page-layout"}>
        <aside className="sidebar">
          <section className="side-box">
            <h2>AREA ALLIEVO</h2>
            <button className={view === 'pokedex' ? 'side-active' : ''} onClick={() => navTo('pokedex')}>▸ Archivio Nazionale</button>
            <button className={view === 'registro' ? 'side-active' : ''} onClick={() => navTo('registro')}>▸ Registro personale</button>
            <button className={view === 'shop' ? 'side-active' : ''} onClick={() => navTo('shop')}>▸ Cartoleria punti {availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</button>
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
            <div className="portal-dashboard">
              {notice && <div className="notice-inline portal-notice" role="status">{notice}</div>}
              <section className="portal-hero">
                <div className="portal-hero-copy">
                  <span className="portal-eyebrow"><GraduationCap size={14}/> AREA PERSONALE · ACCADEMIA POKÉMON</span>
                  <h1>Benvenuto{displayNickname ? `, ${displayNickname}` : ''}.</h1>
                  <p>Il tuo percorso di ricerca è pronto. Classifica nuove carte, accumula Punti Poké e completa le prove regionali per ottenere Punti esame.</p>
                  <div className="portal-hero-actions">
                    <button className="portal-primary-action" onClick={() => navTo('game')}><FlaskConical size={17}/> Continua a giocare <ChevronRight size={17}/></button>
                    <button className="portal-secondary-action" onClick={() => navTo('esami')}>Vai agli esami</button>
                  </div>
                </div>
                <div className="portal-hero-progress" aria-label={`${progress.completedIds.length} Pokémon catalogati su ${NATIONAL_DEX_SIZE}`}>
                  <div className="portal-progress-ring" style={{'--progress': `${Math.min(100, progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%` } as CSSProperties}>
                    <div><strong>{Math.round(progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%</strong><span>COMPLETATO</span></div>
                  </div>
                  <span className="portal-progress-caption">{progress.completedIds.length.toLocaleString('it-IT')} / {NATIONAL_DEX_SIZE.toLocaleString('it-IT')} Pokémon</span>
                </div>
                <div className="portal-hero-shine" aria-hidden="true"/>
              </section>

              <section className="portal-student-strip" aria-label="Stato del profilo e dell'account">
                <div className="portal-student-campus"><AcademyCrest academy={academy} className="portal-campus-mark" /><div><small>IL TUO CAMPUS</small><strong>{academyName(academy)}</strong><span>{student.matricola}</span></div></div>
                <div className="portal-student-identity"><span className={communityIdentity ? 'portal-identity-dot is-verified' : hasCommunityToken() ? 'portal-identity-dot is-pending' : 'portal-identity-dot is-local'}></span><div><small>IDENTITÀ PORTALE</small><strong>{communityIdentity ? 'Online verificata' : hasCommunityToken() ? 'Da verificare' : 'Profilo locale'}</strong><span>{communityIdentity ? 'Nickname ufficiale attivo' : online ? 'Progressi salvati su questo browser' : 'Offline · dati locali disponibili'}</span></div></div>
                <button type="button" onClick={() => navTo('profilo')}>Gestisci profilo <ChevronRight size={15}/></button>
              </section>

              <section className="portal-stat-grid" aria-label="Riepilogo progressi">
                <article className="portal-stat-card portal-stat-points">
                  <span className="portal-stat-icon">₱</span>
                  <div><small>PORTAFOGLIO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div>
                  <button aria-label="Apri Cartoleria" onClick={() => navTo('shop')}><ChevronRight size={17}/></button>
                </article>
                <article className="portal-stat-card portal-stat-exams">
                  <span className="portal-stat-icon">★</span>
                  <div><small>RISULTATI ACCADEMICI</small><strong>{progress.examPoints.toLocaleString('it-IT')}</strong><span>Punti esame</span></div>
                  <button aria-label="Apri gli esami" onClick={() => navTo('esami')}><ChevronRight size={17}/></button>
                </article>
                <article className="portal-stat-card portal-stat-catalog">
                  <span className="portal-stat-icon"><BookOpen size={20}/></span>
                  <div><small>CATALOGO NAZIONALE</small><strong>{progress.completedIds.length.toLocaleString('it-IT')}<i> / 1.025</i></strong><span>Specie catalogate</span></div>
                  <button aria-label="Apri il registro personale" onClick={() => navTo('registro')}><ChevronRight size={17}/></button>
                </article>
              </section>

              <section className="portal-shortcuts">
                <div className="portal-section-heading"><div><span>ACCESSO RAPIDO</span><h2>Da dove vuoi iniziare?</h2></div><span className="portal-section-note">IL TUO DESK</span></div>
                <div className="portal-shortcut-grid">
                  <button className="portal-shortcut portal-shortcut-game" onClick={() => navTo('game')}>
                    <span className="portal-shortcut-icon"><FlaskConical size={22}/></span><span className="portal-shortcut-copy"><strong>Gioco di classificazione</strong><small>Classifica le carte e guadagna Punti Poké.</small></span><ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                  <button className="portal-shortcut portal-shortcut-record" onClick={() => navTo('registro')}>
                    <span className="portal-shortcut-icon"><Trophy size={22}/></span><span className="portal-shortcut-copy"><strong>Registro personale</strong><small>Controlla risultati e avanzamento.</small></span><ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                  <button className="portal-shortcut portal-shortcut-exams" onClick={() => navTo('esami')}>
                    <span className="portal-shortcut-icon"><GraduationCap size={22}/></span><span className="portal-shortcut-copy"><strong>Esami regionali</strong><small>Completa una regione per ottenere Punti esame.</small></span><ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                  <button className="portal-shortcut portal-shortcut-shop" onClick={() => navTo('shop')}>
                    <span className="portal-shortcut-icon"><ShoppingBag size={22}/></span><span className="portal-shortcut-copy"><strong>Cartoleria punti</strong><small>Acquista strumenti e potenziamenti.</small></span>{availableShopCount > 0 && <span className="portal-shortcut-badge">{availableShopCount}</span>}<ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                  <button className="portal-shortcut portal-shortcut-archive" onClick={() => navTo('pokedex')}>
                    <span className="portal-shortcut-icon"><BookOpen size={22}/></span><span className="portal-shortcut-copy"><strong>Archivio Nazionale</strong><small>{inventory.includes('national-catalog') ? 'Consulta Pokémon, strumenti e materiali.' : 'Si sblocca dopo la catalogazione completa e gli acquisti richiesti.'}</small></span><ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                  <button className="portal-shortcut portal-shortcut-profile" onClick={() => navTo('profilo')}>
                    <span className="portal-shortcut-icon"><GraduationCap size={22}/></span><span className="portal-shortcut-copy"><strong>Profilo allievo</strong><small>Personalizza il tuo avatar e consulta la matricola.</small></span><ChevronRight className="portal-shortcut-arrow" size={18}/>
                  </button>
                </div>
              </section>

              <section className="portal-progress-panel">
                <div className="portal-progress-panel-heading"><div><span>IL TUO PERCORSO</span><h2>Avanzamento Pokédex</h2></div><strong>{Math.round(progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%</strong></div>
                <div className="portal-progress-track"><span style={{width: `${Math.min(100, progress.completedIds.length / NATIONAL_DEX_SIZE * 100)}%`}}/></div>
                <div className="portal-progress-panel-footer"><span>{progress.completedIds.length.toLocaleString('it-IT')} specie catalogate</span><span>{(NATIONAL_DEX_SIZE - Math.min(NATIONAL_DEX_SIZE, progress.completedIds.length)).toLocaleString('it-IT')} ancora da scoprire</span></div>
              </section>
            </div>
          </>}
          {view === 'pokedex' && (inventory.includes('national-catalog') ? <Archive
            species={species}
            items={itemCatalog}
            loadingSpecies={loading}
            loadingItems={itemCatalogLoading}
            online={online}
            completedPokemon={progress.completedIds}
            completedEntries={progress.completedEntries ?? []}
          /> : <section className="archive-search"><div className="eyebrow">ACCESSO RISERVATO</div><h1>Archivio Nazionale bloccato</h1><p>Per consultare le informazioni devi catalogare tutti i 1.025 Pokémon, acquistare con i Punti Poké Scanner e tutti i livelli di Ricerca, quindi acquistare questo archivio con i Punti esame.</p><p>Pokémon catalogati: <strong>{progress.completedIds.length} / {NATIONAL_DEX_SIZE}</strong></p><button className="primary-button" onClick={() => navTo('shop')}>Vai alla Cartoleria punti</button></section>)}
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
                        const isWrong = Boolean(placedCard && placedCard.subcategoryId !== currentSubcategory.id);
                        return <button type="button" key={slotId} className={'pokemon-number-slot category-entity-slot ' + (placedCard ? 'category-entity-filled ' : '') + (isWrong && inventory.includes('subcategory-errors') ? 'pokemon-number-wrong' : '')} aria-label={placedCard ? 'Entità inserita, posizione ' + (index + 1) : 'Posizione vuota ' + (index + 1)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (id) placeCard(id, slotId); }} onClick={() => {
                          if (placed) { setCategoryPlacements(old => { const next = { ...old }; delete next[placed[0]]; return next; }); setMisplacedCards(old => { const next = { ...old }; delete next[placed[0]]; return next; }); setLessonSolved(old => old.filter(id => id !== placed[0])); setWrongTargetId(null); return; }
                          if (selectedCardId) placeCard(selectedCardId, slotId);
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
                      <span>{openMacroId === 'pokemon' ? 'Seleziona una regione per aprire l’elenco numerato' : 'Apri la sottocartella corretta per la carta selezionata'}</span>
                    </div>
                    <div className="category-targets-grid subfolder-grid">
                      {currentMacroTargets.map(target => <button
                        type="button"
                        key={target.id}
                        className={'category-target subfolder-target ' + (target.solved === target.total ? 'category-target-complete ' : '')}
                        aria-label={openMacroId === 'pokemon' ? 'Apri la regione ' + target.name : 'Classifica in ' + target.name}
                        onDragOver={event => event.preventDefault()}
                        onDrop={event => { event.preventDefault(); const cardId = event.dataTransfer.getData('text/plain'); if (cardId && openMacroId !== 'pokemon') placeCard(cardId, target.id); }}
                        onClick={() => {
                          if (openMacroId === 'pokemon') {
                            setOpenPokemonRegionId(target.id);
                            setWrongTargetId(null);
                            setMessage('Regione ' + target.name + ' aperta. Seleziona una carta Pokémon e poi la sua posizione numerata.');
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
              <div className={`feedback-bar game-feedback ${message.startsWith('Corretto') ? 'feedback-success' : message && wrongTargetId !== null ? 'feedback-error' : ''}`} role="status">{message}</div>
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
                        aria-label={selectedCardId === card.id ? 'Carta selezionata' : 'Seleziona carta da classificare'}
                        title="Seleziona carta"
                        className={`pokemon-card mixed-card ${selectedCardId === card.id ? 'chosen' : ''}`}
                        draggable
                        onDragStart={event => event.dataTransfer.setData('text/plain', card.id)}
                        onClick={() => { setSelectedCardId(card.id); setMessage('Carta selezionata. Apri una macrocategoria e poi la sottocategoria corretta.'); }}
                      >
                        <img src={card.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
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
                    {view === 'registro' && <><div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div><div className="page-heading"><div><div className="eyebrow">SEGRETERIA DIDATTICA</div><h1>Registro personale</h1><p>Il riepilogo dei progressi nel catalogo Nazionale completo.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length} <small>/ 1025</small></strong></div></div><section className="archive-search"><h2>Avanzamento per regione</h2>{regions.map(region => { const count = progress.completedIds.filter(id => id >= region.start && id <= region.end).length; const total = region.end - region.start + 1; return <div className="region-progress" key={region.name}><div><b>{region.name}</b><span>{count} / {total}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div>{count === total && <small className="exam-earned">Regione completata · Punto esame ottenuto</small>}</div>})}<button className="secondary-button reset-button" onClick={() => { if (window.confirm('Vuoi azzerare punteggio e progressi salvati su questo dispositivo?')) { setProgress({ points: 0, completedIds: [], examPoints: 0, completedExams: [], inventory: [], completedEntries: [], abilityCooldowns: {} }); setLessonReady(false); setLessonDeck([]); setLessonSolved([]); setSelectedCardId(null); setMessage('Progressi azzerati. Tutti gli elementi sono nuovamente disponibili.'); } }}>Azzera progressi</button></section></>}
          {view === 'shop' && <>
            <div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div>
            <section className="shop-hero">
              <div className="shop-hero-copy">
                <span className="eyebrow">NEGOZIO DELL’ACCADEMIA</span>
                <h1>Cartoleria punti</h1>
                <p>Investi i punti guadagnati per sbloccare strumenti, potenziamenti e nuovi archivi. Gli acquisti permanenti restano nel tuo profilo.</p>
              </div>
              <div className="shop-wallets">
                <div className="shop-wallet shop-wallet-poke"><span className="shop-wallet-icon">✦</span><div><small>IL TUO SALDO</small><strong>{progress.points.toLocaleString('it-IT')}</strong><span>Punti Poké</span></div></div>
                <div className="shop-wallet shop-wallet-exam"><span className="shop-wallet-icon">★</span><div><small>IL TUO SALDO</small><strong>{progress.examPoints.toLocaleString('it-IT')}</strong><span>Punti esame</span></div></div>
              </div>
            </section>
            <section className="shop-guide-strip">
              <div><span className="shop-guide-number">01</span><div><strong>Scegli una sezione</strong><small>Strumenti e potenziamenti oppure contenuti speciali.</small></div></div>
              <div><span className="shop-guide-number">02</span><div><strong>Controlla i requisiti</strong><small>Le schede indicano cosa serve per sbloccare ogni acquisto.</small></div></div>
              <div><span className="shop-guide-number">03</span><div><strong>Acquista e usa</strong><small>Gli elementi acquistati restano disponibili.</small></div></div>
            </section>
            <div className="shop-section-heading"><div><span className="eyebrow">CATALOGO</span><h2>Cosa vuoi sbloccare?</h2></div><span className="shop-available-count">{availableShopCount} acquistabili ora</span></div>
            <div className="shop-tabs" role="tablist" aria-label="Sezioni della cartoleria">
              <button role="tab" aria-selected={shopTab === 'oggetti'} className={shopTab === 'oggetti' ? 'active' : ''} onClick={() => setShopTab('oggetti')}>
                <span className="shop-tab-icon"><ShoppingBag size={19}/></span><span><strong>Strumenti e potenziamenti</strong><small>Paghi in Punti Poké</small></span><span className="shop-tab-count">{shopProducts.filter(product => product.category === 'oggetti' && !inventory.includes(product.id) && productUnlocked(product, inventory, progress.completedIds.length) && (product.currency !== 'poke' || shopPricingReady) && progress.points >= product.cost).length}</span>
              </button>
              <button role="tab" aria-selected={shopTab === 'super-aiuti'} className={shopTab === 'super-aiuti' ? 'active' : ''} onClick={() => setShopTab('super-aiuti')}>
                <span className="shop-tab-icon"><Trophy size={19}/></span><span><strong>Archivi e contenuti speciali</strong><small>Paghi in Punti esame</small></span><span className="shop-tab-count">{shopProducts.filter(product => product.category === 'super-aiuti' && !inventory.includes(product.id) && productUnlocked(product, inventory, progress.completedIds.length) && progress.examPoints >= product.cost).length}</span>
              </button>
            </div>
            {notice && <div className="notice-inline" role="status">{notice}</div>}
            <div className="shop-catalog-intro"><div><strong>{shopTab === 'oggetti' ? 'Strumenti per la tua ricerca' : 'Premi per i tuoi progressi'}</strong><p>{shopTab === 'oggetti' ? 'Gli strumenti attivi aiutano durante la classificazione; i livelli successivi migliorano quelli già acquistati.' : 'Usa i Punti esame ottenuti completando le prove per sbloccare archivi, modalità e personalizzazioni.'}</p></div><span>{shopProducts.filter(product => product.category === shopTab).length} articoli</span></div>
            <div className="shop-grid shop-grid-refactor">
              {shopProducts.filter(product => product.category === shopTab && product.kind !== 'upgrade').sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name, 'it')).map(product => {
                const owned = inventory.includes(product.id);
                const unlocked = productUnlocked(product, inventory, progress.completedIds.length);
                const balance = product.currency === 'poke' ? progress.points : progress.examPoints;
                const upgradeIds = product.id === 'scanner' ? Array.from({ length: SCANNER_LEVELS - 1 }, (_, index) => `scanner-upgrade-${index + 2}`) : product.id === 'research' ? Array.from({ length: RESEARCH_LEVELS - 1 }, (_, index) => `research-upgrade-${index + 2}`) : product.id === 'multi-select-1' ? Array.from({ length: 7 }, (_, index) => `multi-select-${index + 2}`) : [];
                const upgrades = upgradeIds.map(id => shopProducts.find(entry => entry.id === id)).filter((entry): entry is ShopProduct => Boolean(entry));
                const purchasedUpgrades = upgrades.filter(upgrade => inventory.includes(upgrade.id)).length;
                const currentLevel = (owned ? 1 : 0) + purchasedUpgrades;
                const nextUpgrade = owned ? upgrades.find(upgrade => !inventory.includes(upgrade.id)) : undefined;
                const purchaseProduct = nextUpgrade ?? product;
                const isUpgradeAction = owned && Boolean(nextUpgrade);
                const purchaseUnlocked = owned ? Boolean(nextUpgrade && productUnlocked(nextUpgrade, inventory, progress.completedIds.length)) : unlocked;
                const purchaseBalance = purchaseProduct.currency === 'poke' ? progress.points : progress.examPoints;
                const canBuy = !owned ? unlocked && balance >= product.cost && (product.currency !== 'poke' || shopPricingReady) : Boolean(nextUpgrade && purchaseUnlocked && purchaseBalance >= purchaseProduct.cost && (purchaseProduct.currency !== 'poke' || shopPricingReady));
                const requirement = product.requirementLabel ?? (product.requires?.length ? `Acquista prima: ${product.requires.map(id => SHOP_PRODUCTS.find(entry => entry.id === id)?.name ?? id).join(', ')}` : product.requiredPokemon ? `Cataloga almeno ${product.requiredPokemon} Pokémon` : 'Nessun requisito aggiuntivo');
                const requirements = [...(product.requires ?? []).map(id => ({ label: `Acquista ${SHOP_PRODUCTS.find(entry => entry.id === id)?.name ?? id}`, done: inventory.includes(id) })), ...(product.requiredPokemon ? [{ label: `Cataloga ${product.requiredPokemon} Pokémon (${Math.min(progress.completedIds.length, product.requiredPokemon)}/${product.requiredPokemon})`, done: progress.completedIds.length >= product.requiredPokemon, ratio: Math.min(1, progress.completedIds.length / product.requiredPokemon) }] : [])];
                const requirementProgress = requirements.length ? requirements.reduce((sum, item) => sum + ('ratio' in item ? item.ratio : item.done ? 1 : 0), 0) / requirements.length : unlocked ? 1 : 0;
                const displayDescription = owned && nextUpgrade ? nextUpgrade.description : product.description;
                const displayCost = owned && nextUpgrade ? nextUpgrade.cost : product.cost;
                const displayCurrency = owned && nextUpgrade ? nextUpgrade.currency : product.currency;
                const status = owned && !nextUpgrade ? 'Livello massimo' : owned ? 'Posseduto' : unlocked ? balance < product.cost ? 'Punti insufficienti' : 'Disponibile' : 'Requisiti in corso';
                const icon = product.kind === 'active' ? <FlaskConical size={23}/> : product.kind === 'upgrade' ? <ChevronRight size={23}/> : product.kind === 'archive' ? <BookOpen size={23}/> : product.kind === 'cosmetic' ? <GraduationCap size={23}/> : product.kind === 'mode' ? <Trophy size={23}/> : <BookOpen size={23}/>;
                return <article className={`shop-card shop-card-refactor ${owned ? 'is-owned' : ''} ${!unlocked && !owned ? 'is-locked' : ''} ${canBuy ? 'is-affordable' : ''}`} key={product.id}>
                  <div className={`shop-product-icon shop-product-icon-${product.kind}`}>{icon}</div>
                  <div className="shop-product-content">
                    <div className="shop-product-topline"><span className="shop-product-type">{product.kind === 'active' ? 'STRUMENTO ATTIVO' : product.kind === 'passive' ? 'VANTAGGIO PERMANENTE' : product.kind === 'archive' ? 'ARCHIVIO' : product.kind === 'mode' ? 'MODALITÀ' : 'PERSONALIZZAZIONE'}</span><span className={`shop-product-status ${owned && !nextUpgrade ? 'shop-product-owned' : canBuy ? 'shop-product-ready' : !unlocked && !owned ? 'shop-product-locked-status' : ''}`}>{status}</span></div>
                    <h3>{product.name}{upgrades.length > 0 && <span className="shop-level-count">{Math.max(owned ? 1 : 0, currentLevel)}/{upgrades.length + 1}</span>}</h3>
                    <p>{displayDescription}</p>
                    {upgrades.length > 0 && <div className="shop-level-track" aria-label={`Livello ${currentLevel} di ${upgrades.length + 1}`}><span style={{width:`${currentLevel / (upgrades.length + 1) * 100}%`}}/></div>}
                    {!owned && requirements.length > 0 && <div className="shop-requirement-progress"><div className="shop-requirement-copy"><strong>{unlocked ? 'Requisiti completati' : 'Completa i requisiti per sbloccare'}</strong><span>{Math.round(requirementProgress * 100)}%</span></div><div className="shop-level-track"><span style={{width:`${requirementProgress * 100}%`}}/></div><ul>{requirements.map((item,index)=><li className={item.done ? 'requirement-done' : ''} key={index}><span>{item.done ? '✓' : '○'}</span>{item.label}</li>)}</ul></div>}
                    {owned && nextUpgrade && <div className="shop-next-upgrade"><strong>Livello successivo · {currentLevel + 1}/{upgrades.length + 1}</strong><span>{nextUpgrade.name}: {nextUpgrade.description}</span></div>}
                    {!owned && requirements.length === 0 && <div className="shop-product-requirement requirement-met"><span>✓</span>{requirement}</div>}
                    <div className="shop-product-footer"><div className="shop-price"><strong>{displayCost.toLocaleString('it-IT')}</strong><span>{displayCurrency === 'poke' ? 'Punti Poké' : 'Punti esame'}</span></div>
                      {owned && !nextUpgrade ? <button className="shop-buy-button shop-buy-disabled" disabled>Livello massimo</button>
                        : !purchaseUnlocked ? <span className="shop-requirements-waiting">Requisiti da completare</span>
                        : <button className="shop-buy-button" disabled={!canBuy} onClick={() => buyItem(purchaseProduct)}>{isUpgradeAction ? 'Aggiorna' : 'Acquista'}</button>}
                    </div>
                  </div>
                </article>;
              })}
            </div>
          </>}

          {view === 'esami' && <><div className="breadcrumb">Home / Area didattica / <b>Esami</b></div><div className="page-heading"><div><div className="eyebrow">DIPARTIMENTO DIDATTICO</div><h1>Esami e prove speciali</h1><p>Completa le regioni, approfondisci i tipi Pokémon e affronta obiettivi speciali. I risultati vengono salvati localmente.</p></div></div>{notice && <div className="notice-inline" role="status">{notice}</div>}<section className="archive-search"><h2>Esami regionali</h2><p>Completare una regione assegna automaticamente 1 Punto esame.</p><div className="exam-grid">{regions.map(region => {const count=progress.completedIds.filter(id=>id>=region.start&&id<=region.end).length;const total=region.end-region.start+1;const done=count===total;return <article className="exam-card" key={region.name}><div className="exam-card-mark">{done?'✓':'R'}</div><div><h3>{region.name}</h3><p>{count} di {total} Pokémon catalogati</p><div className="progress-track"><span style={{width:`${count/total*100}%`}}/></div><strong>{done?'Regione completata · Punto esame ottenuto':`${Math.round(count/total*100)}% completato`}</strong></div></article>})}</div></section><section className="archive-search"><h2>Esami per tipo</h2><p>I dati dei tipi provengono dalla PokéAPI e vengono messi in cache dopo il primo caricamento.</p>{typeLoading && <div className="loading-panel"><p>Caricamento dei 18 tipi dalla PokéAPI…</p></div>}{typeCatalog.length===0&&!typeLoading&&<div className="empty-service"><p>{online?'Apri nuovamente questa sezione per caricare i tipi.':'I tipi non sono ancora stati salvati in cache: serve una connessione al primo accesso.'}</p></div>}<div className="exam-grid">{typeCatalog.map(type=>{const ids=type.ids;const count=ids.filter(id=>completedSet.has(id)).length;const done=ids.length>0&&count===ids.length;const key=`type-${type.name}`;const claimed=completedExams.includes(key);return <article className="exam-card" key={type.name}><div className="exam-card-mark type-mark">{type.name.slice(0,2).toUpperCase()}</div><div><h3>{titleCase(type.name)}</h3><p>{count} di {ids.length} specie catalogate</p><div className="progress-track"><span style={{width:`${ids.length?count/ids.length*100:0}%`}}/></div>{done?<button className="secondary-button" disabled={claimed} onClick={()=>claimExam(key)}>{claimed?'Ricompensa riscossa':'Completa prova · +1 Punto esame'}</button>:<strong>{ids.length?Math.round(count/ids.length*100):0}% completato</strong>}</div></article>})}</div></section><section className="archive-search"><h2>Prove speciali</h2><p>Obiettivi progressivi di catalogazione. Ogni ricompensa può essere riscossa una sola volta.</p><div className="exam-grid">{[{id:'special-10',title:'Primo studio',target:10,reward:1},{id:'special-50',title:'Ricercatore in erba',target:50,reward:1},{id:'special-150',title:'Archivista Pokémon',target:150,reward:2},{id:'special-500',title:'Esperto Nazionale',target:500,reward:3},{id:'special-1025',title:'Maestro dell’Archivio',target:1025,reward:10}].map(exam=>{const done=progress.completedIds.length>=exam.target;const claimed=completedExams.includes(exam.id);return <article className="exam-card" key={exam.id}><div className="exam-card-mark special-mark">★</div><div><h3>{exam.title}</h3><p>Cataloga {exam.target} Pokémon · {Math.min(progress.completedIds.length,exam.target)} / {exam.target}</p><div className="progress-track"><span style={{width:`${Math.min(100,progress.completedIds.length/exam.target*100)}%`}}/></div><strong>{exam.reward} {exam.reward===1?'Punto esame':'Punti esame'}</strong><button className="secondary-button" disabled={!done||claimed} onClick={()=>claimExam(exam.id,exam.reward)}>{claimed?'Ricompensa riscossa':done?'Riscatta ricompensa':'Prova in corso'}</button></div></article>})}</div></section></>}

          {view === 'classifica' && <><div className="breadcrumb">Home / Comunità / <b>Classifica globale</b></div><div className="page-heading"><div><div className="eyebrow">RISULTATI STUDENTI</div><h1>Classifica globale</h1><p>La graduatoria online verrà attivata quando saranno disponibili autenticazione e database condiviso.</p></div></div><section className="empty-service ranking-preview"><Trophy size={36}/><h2>Classifica online non ancora attiva</h2><p>Questa versione mantiene i tuoi risultati sul dispositivo. Senza database non è possibile confrontare in modo affidabile gli studenti o sincronizzare i risultati tra PC e smartphone.</p><div className="dashboard-strip"><div><span>I TUOI PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>I TUOI PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>POKÉMON CATALOGATI</span><strong>{progress.completedIds.length}/1025</strong></div></div></section></>}

          {view === 'profilo' && <><div className="breadcrumb">Home / Area allievo / <b>Profilo</b></div><div className="page-heading"><div><div className="eyebrow">IDENTITÀ STUDENTE</div><h1>Il tuo profilo</h1><p>Scegli il tuo Pokémon starter preferito: tutti i nove gruppi regionali sono disponibili in formato ritratto.</p></div></div><section className="archive-search profile-panel"><div className="profile-hero"><div className="profile-academy-crest"><AcademyCrest academy={academy} className="profile-academy-crest-image" /></div><div className="profile-avatar-large">{currentProfileAvatarId?<img src={avatarPortraitUrl(currentProfileAvatarId)} alt="Avatar scelto"/>:'★'}</div><div><span className="section-label">{communityIdentity ? 'NICKNAME UFFICIALE' : 'NICKNAME LOCALE'}</span><h2>{displayNickname}</h2><p>{student.matricola}</p><p>{academyName(academy)}</p><small>{communityIdentity ? 'Nickname ufficiale verificato online.' : online ? 'Identità online non verificata: importa i metadati dell’account per recuperarla.' : 'Modalità offline: viene usato il nickname salvato su questo dispositivo.'}</small></div></div><section className="community-account-panel" aria-labelledby="community-account-title">
              <div className="community-account-heading"><div><span className="section-label">SINCRONIZZAZIONE ACCOUNT</span><h3 id="community-account-title">Identità community</h3></div><span className={communityIdentity ? 'community-status community-status-active' : 'community-status'}>{communityIdentity ? 'VERIFICATA' : communityConfigured ? 'NON COLLEGATA' : 'NON CONFIGURATA'}</span></div>
              <p className="community-account-description">Il nickname dell’identità online verificata viene usato in tutto il portale quando sei connesso. Offline viene mostrato il nickname locale. Esporta e conserva i metadati: se perdi la sessione, solo quel file permette di recuperare la stessa identità.</p>
              {communityIdentity ? <div className="community-identity-summary"><AcademyCrest academy={communityIdentity.academy} className="community-identity-crest" /><strong>{communityIdentity.nickname}</strong><span>{academyName(communityIdentity.academy)}</span><small>Identità verificata dal server · {communityIdentity.id.slice(0, 8)}</small></div> : <div className="community-account-actions"><label className="community-import-button">Importa metadati account<input type="file" accept="application/json,.json" disabled={!communityConfigured || communityBusy} onChange={event => void importCommunityAccount(event)} /></label></div>}
              {communityIdentity && <div className="community-account-actions"><button type="button" className="secondary-button" disabled={communityBusy} onClick={() => void downloadCommunityAccount()}>{communityBusy ? 'Attendere…' : 'Esporta metadati account'}</button><label className="community-import-button">Sostituisci/importa account<input type="file" accept="application/json,.json" disabled={communityBusy} onChange={event => void importCommunityAccount(event)} /></label></div>}
              {!communityConfigured && <p className="community-account-hint">Servizio in attesa di configurazione: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nell'ambiente di build.</p>}
              {communityNotice && <p className="community-account-success" role="status">{communityNotice}</p>}
              {communityError && <p className="community-account-error" role="alert">{communityError}</p>}
              <p className="community-account-warning">Il file esportato contiene una credenziale privata: chi lo possiede può usare questa identità. Non condividerlo e non pubblicarlo.</p>
            </section>
            <div className="avatar-picker-heading"><div><span className="section-label">SCEGLI IL TUO STARTER</span><p>27 Pokémon iniziali · 3 per regione</p></div><span className="avatar-picker-count">{visibleAvatars.length} disponibili</span></div><div className="avatar-grid">{visibleAvatars.map(pokemon=><button type="button" className={currentProfileAvatarId===pokemon.id?'avatar-option selected':'avatar-option'} key={pokemon.id} onClick={()=>saveAvatar(pokemon.id)} aria-label={`Scegli ${titleCase(pokemon.name)} come avatar`}><span className="avatar-portrait-frame"><img src={avatarPortraitUrl(pokemon.id)} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/></span><span className="avatar-option-name">{titleCase(pokemon.name)}</span><small className="avatar-option-region">{regions.find(region=>pokemon.id>=region.start&&pokemon.id<=region.end)?.name}</small></button>)}</div></section></>}

          {view === 'forum' && <>
            <div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div>
            <div className="page-heading forum-heading forum-hero">
              <div className="forum-hero-copy">
                <div className="eyebrow"><span className="forum-live-dot" /> COMUNITÀ SCOLASTICA · POKÉ STUDY</div>
                <h1>Bacheca studenti</h1>
                <p>Confrontati con gli altri allievi, condividi strategie e trova risposte per il tuo percorso.</p>
                <div className="forum-hero-tags"><span><MessageSquare size={13}/> Discussioni</span><span><GraduationCap size={13}/> Comunità d’Accademia</span></div>
              </div>
              <div className="forum-heading-mark forum-hero-emblem"><GraduationCap size={28}/><span>AREA<br/>STUDENTI</span></div>
            </div>

            <section className="forum-featured forum-featured-notice">
              <div className="forum-featured-top"><span className="forum-pin"><Bell size={12}/> AVVISO IN EVIDENZA</span><span className="forum-date">SEGRETERIA DIDATTICA</span></div>
              <div className="forum-featured-body"><div className="forum-featured-icon"><GraduationCap size={25}/></div><div><h2>Benvenuto nell’Archivio Nazionale</h2><p>Tutte le specie e tutti i numeri sono disponibili fin dall’inizio. Ogni collocazione corretta assegna un Punto Poké; gli errori non sottraggono punti. Completando una regione ottieni un Punto esame.</p></div><span className="forum-notice-check"><CheckCircle2 size={16}/> UFFICIALE</span></div>
            </section>

            <section className="community-forum-panel forum-workspace">
              <div className="forum-workspace-heading">
                <div><span className="section-label">SPAZIO CONDIVISO</span><h2>Discussioni</h2><p>Le novità e le conversazioni della comunità.</p></div>
                <div className="forum-workspace-actions">
                  <button type="button" className="forum-refresh-button" disabled={!communityIdentity || communityForumLoading} onClick={() => { if (communityIdentity) { setCommunityForumLoading(true); setCommunityForumError(''); listCommunityThreads().then(setCommunityThreads).catch(error => setCommunityForumError(error instanceof Error ? error.message : 'Impossibile aggiornare la Bacheca.')).finally(() => setCommunityForumLoading(false)); } }}><Clock3 size={15}/> Aggiorna</button>
                  {communityIdentity && <button type="button" className="secondary-button forum-new-thread-button" onClick={() => setShowThreadComposer(open => !open)}>{showThreadComposer ? <X size={15}/> : <Plus size={16}/>} {showThreadComposer ? 'Chiudi' : 'Nuova discussione'}</button>}
                </div>
              </div>

              {!communityConfigured ? <div className="community-forum-empty"><strong>Bacheca in configurazione</strong><p>Il servizio online non è disponibile in questa versione. Riprova dopo il rilascio della build aggiornata.</p></div> : !communityIdentity ? <div className="forum-login-prompt"><div className="forum-prompt-icon"><GraduationCap size={24}/></div><div><strong>Accedi alla comunità</strong><p>Per leggere e pubblicare discussioni serve un’identità online verificata.</p></div><button type="button" className="secondary-button" onClick={() => navTo('profilo')}>Vai al Profilo <ChevronRight size={15}/></button></div> : <>
                <div className="forum-community-stats">
                  <div><span>DISCUSSIONI</span><strong>{communityThreads.length}</strong></div>
                  <div><span>RISPOSTE</span><strong>{communityThreads.reduce((sum, thread) => sum + (thread.posts?.length ?? 0), 0)}</strong></div>
                  <div><span>LA TUA ACCADEMIA</span><strong>{communityIdentity.academy === 'arancia' ? 'Arancia' : communityIdentity.academy === 'uva' ? 'Uva' : 'Mirtillo'}</strong></div>
                </div>
                {showThreadComposer && <form className="community-thread-form forum-composer" onSubmit={event => void submitCommunityThread(event)}>
                  <div className="forum-composer-heading"><div><span className="section-label">CONTRIBUISCI ALLA BACHECA</span><h3>Apri una discussione</h3></div><button type="button" className="forum-icon-button" aria-label="Chiudi composizione" onClick={() => setShowThreadComposer(false)}><X size={17}/></button></div>
                  <label>Titolo <input required minLength={5} maxLength={120} value={communityThreadTitle} onChange={event => setCommunityThreadTitle(event.target.value)} placeholder="Es. Consigli per completare Paldea"/></label>
                  <div className="forum-form-row"><label>Area tematica <select value={communityThreadCategory} onChange={event => setCommunityThreadCategory(event.target.value as CommunityCategory)}><option value="generale">Generale</option><option value="domande">Domande</option><option value="strategie">Strategie</option><option value="annunci">Annunci</option></select></label><div className="forum-compose-hint"><Sparkles size={15}/><span>Scrivi un titolo chiaro e resta in tema con l’Accademia.</span></div></div>
                  <label>Messaggio <textarea required maxLength={5000} rows={4} value={communityThreadBody} onChange={event => setCommunityThreadBody(event.target.value)} placeholder="Condividi la tua domanda o esperienza…"/></label>
                  <div className="forum-composer-footer"><span>{communityThreadBody.length}/5000 caratteri</span><button type="submit" className="secondary-button" disabled={communityForumLoading || communityThreadTitle.trim().length < 5 || !communityThreadBody.trim()}>{communityForumLoading ? 'Pubblicazione…' : <><Plus size={15}/> Pubblica discussione</>}</button></div>
                </form>}

                <div className="forum-discovery">
                  <div className="forum-search-box"><Search size={17}/><input aria-label="Cerca nella Bacheca" type="search" value={forumSearch} onChange={event => setForumSearch(event.target.value)} placeholder="Cerca titoli, messaggi o studenti…"/>{forumSearch && <button type="button" aria-label="Cancella ricerca" onClick={() => setForumSearch('')}><X size={15}/></button>}</div>
                  <label className="forum-sort-control"><SlidersHorizontal size={15}/><span>Ordina</span><select aria-label="Ordina discussioni" value={forumSort} onChange={event => setForumSort(event.target.value as 'recenti' | 'attive')}><option value="recenti">Più recenti</option><option value="attive">Ultima attività</option></select></label>
                </div>
                <div className="forum-category-tabs" aria-label="Filtra per area tematica">
                  {([{id:'tutte',label:'Tutte',icon:<Sparkles size={14}/>},{id:'generale',label:'Generale',icon:<MessageSquare size={14}/>},{id:'domande',label:'Domande',icon:<CircleHelp size={14}/>},{id:'strategie',label:'Strategie',icon:<Trophy size={14}/>},{id:'annunci',label:'Annunci',icon:<Bell size={14}/>} ] as {id:'tutte'|CommunityCategory;label:string;icon:ReactNode}[]).map(category => <button type="button" key={category.id} className={forumCategoryFilter===category.id?'active':''} aria-pressed={forumCategoryFilter===category.id} onClick={() => setForumCategoryFilter(category.id)}>{category.icon}{category.label}{category.id!=='tutte' && <span>{communityThreads.filter(thread=>thread.category===category.id).length}</span>}</button>)}
                </div>
                {communityForumError && <p className="community-account-error" role="alert">{communityForumError}</p>}
                {communityForumLoading && <p className="forum-loading" role="status"><span className="forum-loading-pulse"/> Aggiornamento della Bacheca…</p>}
                {!communityForumLoading && visibleCommunityThreads.length===0 && <div className="forum-empty-state"><div className="forum-empty-icon"><Search size={22}/></div><strong>{communityThreads.length===0?'La Bacheca è pronta per la prima discussione':'Nessun risultato'}</strong><p>{communityThreads.length===0?'Avvia una conversazione e dai il via alla comunità.':'Prova a modificare la ricerca o selezionare un’altra area tematica.'}</p>{communityThreads.length===0 ? <button type="button" className="secondary-button" onClick={() => setShowThreadComposer(true)}><Plus size={15}/> Crea la prima discussione</button> : <button type="button" className="forum-clear-filters" onClick={() => {setForumSearch('');setForumCategoryFilter('tutte');}}>Azzera filtri</button>}</div>}
                <div className="community-thread-list forum-thread-list">{visibleCommunityThreads.map(thread => <article className="community-thread-card forum-thread-card" key={thread.id}>
                  <div className="community-thread-meta"><span>{({ generale: 'Generale', domande: 'Domande', strategie: 'Strategie', annunci: 'Annunci' } as Record<CommunityCategory, string>)[thread.category]}</span><time dateTime={thread.created_at}>{new Date(thread.created_at).toLocaleString('it-IT')}</time></div>
                  <h3>{thread.title}</h3><p className="community-thread-author"><span className={thread.author?.academy==='uva'?'forum-author-avatar forum-avatar-grape':thread.author?.academy==='mirtillo'?'forum-author-avatar forum-avatar-blueberry':'forum-author-avatar'}>{(thread.author?.nickname??'S').slice(0,1).toLocaleUpperCase('it-IT')}</span><strong>{thread.author?.nickname ?? 'Studente'}</strong><span className="forum-author-separator">·</span><span>{academyName(thread.author?.academy ?? 'arancia')}</span></p>
                  <p className="community-thread-body">{thread.body}</p>
                  <div className="forum-thread-footer"><span><MessageSquare size={14}/>{thread.posts?.length ?? 0} {(thread.posts?.length ?? 0)===1?'risposta':'risposte'}</span><button type="button" onClick={() => setCommunityReplyOpen(old => ({...old,[thread.id]:!old[thread.id]}))} className="forum-reply-action" aria-expanded={Boolean(communityReplyOpen[thread.id])} aria-label={`Rispondi a ${thread.title}`}>{communityReplyOpen[thread.id]?<X size={14}/>:<MessageSquare size={14}/>} {communityReplyOpen[thread.id]?'Annulla':'Rispondi'}</button></div>
                  {(thread.posts ?? []).map(post => <div className="community-reply" key={post.id}><p>{post.body}</p><small>{post.author?.nickname ?? 'Studente'} · {new Date(post.created_at).toLocaleString('it-IT')}</small></div>)}
                  {communityReplyOpen[thread.id] && <form className="community-reply-form" onSubmit={event => void submitCommunityReply(event, thread.id)}><label htmlFor={`reply-${thread.id}`}>La tua risposta</label><textarea id={`reply-${thread.id}`} required maxLength={2000} rows={2} value={communityReplyDrafts[thread.id] ?? ''} onChange={event => setCommunityReplyDrafts(old => ({ ...old, [thread.id]: event.target.value }))} placeholder="Aggiungi un contributo…"/><div className="forum-reply-form-footer"><span>Max 2.000 caratteri</span><button type="submit" className="secondary-button" disabled={communityForumLoading || !(communityReplyDrafts[thread.id] ?? '').trim()}>{communityForumLoading?'Invio…':'Invia risposta'}</button></div></form>}
                </article>)}</div>
              </>}
            </section>

            <div className="forum-section-heading"><div><span className="section-label">ORIENTAMENTO</span><h2>Guide per gli allievi</h2></div><span className="forum-count">2 GUIDE</span></div>
            <div className="forum-guide-grid">
              <article className="forum-guide-card"><div className="forum-guide-icon guide-blue"><BookOpen size={22}/></div><div className="forum-guide-copy"><span className="section-label">GUIDA RAPIDA</span><h3>Come catalogare</h3><p>Trascina una carta nella sottocategoria corretta. Su mobile, seleziona la carta e tocca la destinazione. Il nome viene rivelato dopo la risposta.</p><button type="button" className="forum-action" onClick={() => navTo('game')}>Vai a Gioca <ChevronRight size={15}/></button></div></article>
              <article className="forum-guide-card"><div className="forum-guide-icon guide-gold"><Trophy size={22}/></div><div className="forum-guide-copy"><span className="section-label">PROGRESSI</span><h3>Punti e ricompense</h3><p>Controlla i Pokémon catalogati, i Punti Poké e i Punti esame. Le regioni completate sbloccano le relative ricompense.</p><button type="button" className="forum-action" onClick={() => navTo('registro')}>Apri il registro <ChevronRight size={15}/></button></div></article>
            </div>
            <section className="forum-help-strip"><div className="forum-help-symbol"><CircleHelp size={19}/></div><div><strong>Ti serve un riepilogo dei progressi?</strong><p>Nel Registro personale trovi l'avanzamento per regione e il totale delle specie catalogate.</p></div><button type="button" className="secondary-button" onClick={() => navTo('registro')}>Apri registro</button></section>
          </>}<footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
      {mobileMoreOpen && <div className="mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
        <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Altre sezioni" onClick={event => event.stopPropagation()}>
          <div className="mobile-more-heading"><div><span>AREA ALLIEVO</span><strong>Altre sezioni</strong></div><button type="button" aria-label="Chiudi menu" onClick={() => setMobileMoreOpen(false)}><X size={19}/></button></div>
          <div className="mobile-more-grid">
            <button type="button" onClick={() => navTo('pokedex')}><BookOpen size={20}/><span>Archivio Nazionale</span>{!inventory.includes('national-catalog') && <small>Bloccato</small>}</button>
            <button type="button" onClick={() => navTo('shop')}><ShoppingBag size={20}/><span>Cartoleria punti</span>{availableShopCount > 0 && <small>{availableShopCount} disponibili</small>}</button>
            <button type="button" onClick={() => navTo('classifica')}><Trophy size={20}/><span>Classifica</span></button>
            <button type="button" onClick={() => navTo('profilo')}><GraduationCap size={20}/><span>Profilo allievo</span></button>
            <button type="button" onClick={() => navTo('forum')}><CircleHelp size={20}/><span>Bacheca</span></button>
          </div>
        </section>
      </div>}
      <nav className="mobile-app-nav" aria-label="Navigazione principale">
        <button className={view === 'home' ? 'active' : ''} aria-current={view === 'home' ? 'page' : undefined} onClick={() => navTo('home')}><GraduationCap size={21}/><span>Portale</span></button>
        <button className={view === 'game' ? 'active' : ''} aria-current={view === 'game' ? 'page' : undefined} onClick={() => navTo('game')}><FlaskConical size={21}/><span>Gioca</span></button>
        <button className={view === 'registro' ? 'active' : ''} aria-current={view === 'registro' ? 'page' : undefined} onClick={() => navTo('registro')}><Trophy size={21}/><span>Registro</span></button>
        <button className={view === 'esami' ? 'active' : ''} aria-current={view === 'esami' ? 'page' : undefined} onClick={() => navTo('esami')}><GraduationCap size={21}/><span>Esami</span></button>
        <button className={['pokedex','shop','classifica','profilo','forum'].includes(view) ? 'active' : ''} aria-expanded={mobileMoreOpen} aria-haspopup="dialog" onClick={() => setMobileMoreOpen(open => !open)}><Menu size={21}/><span>Altro</span></button>
      </nav>
    </div>
  );
}
