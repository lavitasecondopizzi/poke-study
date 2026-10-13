import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Archive from './Archive';
import { BookOpen, ChevronRight, CircleHelp, FlaskConical, GraduationCap, Menu, ShoppingBag, Trophy, X } from 'lucide-react';
import type { ApiNamedResource, PokemonSpecies, PokemonTypeIndex, SavedProgress, StudentProfile } from './types';
import { createMixedLesson, displayName, MACRO_CATEGORIES } from './catalog';
import type { CatalogCard } from './catalog';

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

const SHOP_PRODUCTS: ShopProduct[] = [
  { id: 'notebook', name: 'Quaderno di ricerca', description: 'Sblocca il registro personale degli strumenti e degli archivi acquistati.', cost: 250, currency: 'poke', category: 'oggetti', kind: 'passive' },
  { id: 'scanner', name: 'Scanner', description: 'Usalo su una carta selezionata per rivelarne la macro categoria. Cooldown iniziale: 5 minuti.', cost: 150, currency: 'poke', category: 'oggetti', kind: 'active' },
  { id: 'scanner-upgrade-2', name: 'Scanner · Livello 2', description: 'Riduce il cooldown dello Scanner da 5 a 3 minuti.', cost: 250, currency: 'poke', category: 'oggetti', requires: ['scanner'], requirementLabel: 'Acquista prima lo Scanner', kind: 'upgrade' },
  { id: 'profile-background', name: 'Sfondo profilo', description: 'Sblocca un elemento cosmetico per il profilo.', cost: 600, currency: 'poke', category: 'oggetti', kind: 'cosmetic' },
  { id: 'research', name: 'Ricerca', description: 'Fornisce un indizio sulla sottocategoria della carta. Cooldown iniziale: 10 minuti.', cost: 900, currency: 'poke', category: 'oggetti', requires: ['scanner'], requiredPokemon: 50, requirementLabel: 'Acquista prima lo Scanner e cataloga 50 Pokémon', kind: 'active' },
  { id: 'research-upgrade-2', name: 'Ricerca · Livello 2', description: 'Riduce il cooldown della Ricerca da 10 a 7 minuti.', cost: 600, currency: 'poke', category: 'oggetti', requires: ['research'], requirementLabel: 'Acquista prima Ricerca', kind: 'upgrade' },
  { id: 'research-upgrade-3', name: 'Ricerca · Livello 3', description: 'Riduce il cooldown della Ricerca da 7 a 5 minuti. Livello massimo.', cost: 900, currency: 'poke', category: 'oggetti', requires: ['research-upgrade-2'], requirementLabel: 'Acquista prima Ricerca · Livello 2', kind: 'upgrade' },
  { id: 'digital-assistant', name: 'Assistente digitale', description: 'Sblocca un supporto passivo permanente per lo studio.', cost: 2, currency: 'exam', category: 'super-aiuti', kind: 'passive' },
  { id: 'evolution-archive', name: 'Archivio delle evoluzioni', description: 'Sblocca l’accesso permanente alle informazioni sulle evoluzioni.', cost: 3, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'evolution-tools-archive', name: 'Archivio degli strumenti evolutivi', description: 'Sblocca una raccolta dedicata agli strumenti evolutivi.', cost: 3, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'machines-archive', name: 'Archivio MT e tecniche', description: 'Sblocca una raccolta dedicata alle macchine e alle tecniche.', cost: 4, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'fossils-archive', name: 'Archivio fossili e reperti', description: 'Sblocca una raccolta dedicata a fossili e reperti.', cost: 4, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'held-items-archive', name: 'Archivio strumenti tenuti', description: 'Sblocca una raccolta dedicata agli strumenti tenuti.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'archive' },
  { id: 'academy-theme', name: 'Tema Accademia', description: 'Sblocca un tema grafico alternativo.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'exclusive-title', name: 'Titolo esclusivo', description: 'Sblocca un titolo personale da mostrare nel profilo.', cost: 5, currency: 'exam', category: 'super-aiuti', kind: 'cosmetic' },
  { id: 'timed-training', name: 'Allenamento a tempo', description: 'Sblocca la modalità di allenamento a tempo quando disponibile.', cost: 8, currency: 'exam', category: 'super-aiuti', kind: 'mode' },
  { id: 'custom-challenges', name: 'Sfide personalizzate', description: 'Sblocca la modalità per configurare sfide quando disponibile.', cost: 10, currency: 'exam', category: 'super-aiuti', kind: 'mode' },
];


function priceShopProducts(totalEarnablePoints: number): ShopProduct[] {
  const weights: Record<string, number> = {
    notebook: 5,
    scanner: 5,
    'scanner-upgrade-2': 10,
    'profile-background': 15,
    research: 20,
    'research-upgrade-2': 15,
    'research-upgrade-3': 30,
  };
  const pokeProducts = SHOP_PRODUCTS.filter(product => product.currency === 'poke');
  let allocated = 0;
  const costs = new Map<string, number>();
  pokeProducts.forEach((product, index) => {
    const cost = index === pokeProducts.length - 1
      ? totalEarnablePoints - allocated
      : Math.floor(totalEarnablePoints * (weights[product.id] ?? 0) / 100);
    costs.set(product.id, cost);
    allocated += cost;
  });
  return SHOP_PRODUCTS.map(product => product.currency === 'poke'
    ? { ...product, cost: costs.get(product.id) ?? product.cost }
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

function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function itemSpriteUrl(name: string) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
}

const IMAGE_CHECK_CONCURRENCY = 32;
const ITEM_IMAGE_CACHE_KEY = 'poke-study-api-items-with-images-v2';

function imageExists(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function keepItemsWithImages(items: ApiNamedResource[]): Promise<ApiNamedResource[]> {
  const valid: ApiNamedResource[] = [];
  for (let start = 0; start < items.length; start += IMAGE_CHECK_CONCURRENCY) {
    const batch = items.slice(start, start + IMAGE_CHECK_CONCURRENCY);
    const results = await Promise.all(batch.map(async item => ({
      item,
      available: await imageExists(itemSpriteUrl(item.name)),
    })));
    valid.push(...results.filter(result => result.available).map(result => result.item));
  }
  return valid;
}

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
  const [lessonReady, setLessonReady] = useState(false);
  const [message, setMessage] = useState('Seleziona una carta e classificala nella sottocategoria corretta.');
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
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [itemCatalog, setItemCatalog] = useState<ApiNamedResource[]>([]);
  const [itemCatalogLoading, setItemCatalogLoading] = useState(false);
  const [shopTab, setShopTab] = useState<'oggetti' | 'super-aiuti'>('oggetti');
  const [typeCatalog, setTypeCatalog] = useState<PokemonTypeIndex[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const [avatarPage, setAvatarPage] = useState(0);
  const [avatarSearch, setAvatarSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());

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
    if ((view !== 'shop' && view !== 'pokedex') || itemCatalog.length) return;
    let active = true;
    const cacheKey = ITEM_IMAGE_CACHE_KEY;
    setItemCatalogLoading(true);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) setItemCatalog(JSON.parse(cached) as ApiNamedResource[]);
    } catch { /* ignore broken cache */ }
    if (!navigator.onLine) {
      setItemCatalogLoading(false);
      return () => { active = false; };
    }
    fetch('https://pokeapi.co/api/v2/item?limit=2000')
      .then(response => { if (!response.ok) throw new Error('API oggetti non disponibile'); return response.json(); })
      .then(payload => (payload.results as ApiNamedResource[]).sort((a, b) => a.name.localeCompare(b.name)))
      .then(items => keepItemsWithImages(items))
      .then(itemsWithImages => {
        if (!active) return;
        setItemCatalog(itemsWithImages);
        try { localStorage.setItem(cacheKey, JSON.stringify(itemsWithImages)); } catch { /* quota storage */ }
      })
      .catch(() => { if (active && !itemCatalog.length) setNotice('Catalogo oggetti non raggiungibile: riprova quando torni online.'); })
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
    const macroOrder: Record<string, number> = Object.fromEntries(MACRO_CATEGORIES.map((category, index) => [category.id, index]));
    return [...targets.values()].sort((a, b) =>
      (macroOrder[a.macroId] ?? 99) - (macroOrder[b.macroId] ?? 99) ||
      a.name.localeCompare(b.name, 'it'),
    );
  }, [lessonDeck, lessonSolved]);
  const remainingLessonCards = useMemo(
    () => lessonDeck.filter(card => !lessonSolved.includes(card.id)),
    [lessonDeck, lessonSolved],
  );
  const filteredAvatars = species.filter(pokemon => pokemon.name.toLowerCase().includes(avatarSearch.trim().toLowerCase()) || String(pokemon.id).includes(avatarSearch.trim()));
  const avatarPageCount = Math.max(1, Math.ceil(filteredAvatars.length / 15));
  const visibleAvatars = filteredAvatars.slice(avatarPage * 15, avatarPage * 15 + 15);
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
    setLessonDeck(createMixedLesson(species, itemCatalog, progress.completedIds, progress.completedEntries ?? []));
    setLessonSolved([]);
    setLessonReady(true);
  }, [species, itemCatalog, lessonReady, progress.completedIds, progress.completedEntries]);

  function startNewLesson() {
    const nextDeck = createMixedLesson(species, itemCatalog, progress.completedIds, progress.completedEntries ?? []);
    setLessonDeck(nextDeck);
    setLessonSolved([]);
    setSelectedCardId(null);
    setWrongTargetId(null);
    setMessage(nextDeck.length ? 'Nuova lezione pronta: le carte provengono da macrocategorie diverse.' : 'Hai catalogato tutti gli elementi attualmente disponibili.');
  }

  function placeCard(cardId: string, targetId: string) {
    const card = lessonDeck.find(entry => entry.id === cardId);
    if (!card || lessonSolved.includes(cardId)) return;
    if (card.subcategoryId !== targetId) {
      setWrongTargetId(targetId);
      setSelectedCardId(null);
      setMessage(`Non corretto: ${displayName(card.name)} appartiene a “${card.subcategoryName}”. Nessuna penalità: puoi riprovare.`);
      window.setTimeout(() => setWrongTargetId(current => current === targetId ? null : current), 650);
      return;
    }

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
    setMessage(`Corretto! ${displayName(card.name)} · +1 Punto Poké.`);
  }

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
    const scannerUpgraded = currentInventory.includes('scanner-upgrade-2');
    const researchLevel = currentInventory.includes('research-upgrade-3') ? 3
      : currentInventory.includes('research-upgrade-2') ? 2 : 1;
    const cooldownMs = abilityId === 'scanner'
      ? (scannerUpgraded ? 3 : 5) * 60_000
      : (researchLevel === 3 ? 5 : researchLevel === 2 ? 7 : 10) * 60_000;
    const hint = abilityId === 'scanner'
      ? `Scanner: questa carta appartiene alla macro categoria “${card.macroName}”.`
      : `Ricerca: la sottocategoria corretta inizia con “${card.subcategoryName.charAt(0).toUpperCase()}”.`;
    setProgress(old => ({
      ...old,
      abilityCooldowns: { ...(old.abilityCooldowns ?? {}), [abilityId]: Date.now() + cooldownMs },
    }));
    setMessage(hint);
    setNotice(`${abilityId === 'scanner' ? 'Scanner' : 'Ricerca'} utilizzato. Cooldown: ${cooldownLabel(Date.now() + cooldownMs, Date.now())}.`);
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
        <p className="academy-choice-footnote">La scelta dell'accademia non modifica l’Archivio Nazionale: tutte le 1.025 specie restano disponibili fin dall'inizio.</p>
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
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={16} /> Archivio Nazionale</button>
        <button className={view === 'registro' ? 'active' : ''} onClick={() => navTo('registro')}><Trophy size={16} /> Registro personale</button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><ShoppingBag size={16} /> Cartoleria {availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</button>
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
            <div className="breadcrumb">Portale dello studente / <b>Pagina iniziale</b></div>
            <section className="welcome-panel">
              <div className="welcome-copy">
                <div className="welcome-ribbon"><span>✦</span> BENVENUTO IN ACCADEMIA</div>
                <h1>Il tuo archivio del mondo Pokémon comincia qui!</h1>
                <p>Cataloga le specie del Archivio Nazionale, tieni traccia dei tuoi progressi e scopri nuove curiosità dal nostro archivio scientifico.</p>
                <button className="enter-pokedex" onClick={() => navTo('pokedex')}><BookOpen size={18} /> ENTRA NELL’ARCHIVIO <ChevronRight size={19} /></button>
              </div>
              <div className="welcome-art"><div className="art-sun" /><div className="art-book"><BookOpen size={68} strokeWidth={1.3}/></div><div className="art-caption">IL SAPERE È LA TUA<br/>PRIMA POKÉ BALL!</div></div>
            </section>
            <div className="currency-row">
              <div className="currency-card poke-currency"><div className="currency-icon">₱</div><div><small>PORTAFOGLIO ALLIEVO</small><strong>{progress.points.toLocaleString('it-IT')} <span>Punti Poké</span></strong><p>Per strumenti e oggetti utili</p></div><div className="currency-gloss" /></div>
              <div className="currency-card exam-currency"><div className="currency-icon">★</div><div><small>RISULTATI ACCADEMICI</small><strong>{progress.examPoints.toLocaleString('it-IT')} <span>Punti esame</span></strong><p>Per sbloccare e potenziare super-aiuti</p></div><div className="currency-gloss" /></div>
            </div>
            <section className="portal-menu-panel">
              <div className="portal-panel-heading"><div><span>AREA PERSONALE</span><h2>Che cosa vuoi fare oggi?</h2></div><span className="panel-badge">MENU ALLIEVO</span></div>
              <button className="portal-menu-item" onClick={() => navTo('pokedex')}><span className="menu-item-icon blue-icon"><BookOpen size={22}/></span><span className="menu-item-copy"><strong>Archivio Nazionale</strong><small>Cataloga tutte le 1.025 specie disponibili</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('pokedex')}><span className="menu-item-icon green-icon"><FlaskConical size={22}/></span><span className="menu-item-copy"><strong>Archivio scientifico</strong><small>Cerca una specie per nome o numero</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('forum')}><span className="menu-item-icon orange-icon"><CircleHelp size={22}/></span><span className="menu-item-copy"><strong>Forum studenti</strong><small>Avvisi, guide e comunicazioni dell'Accademia</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('shop')}><span className="menu-item-icon purple-icon"><ShoppingBag size={22}/></span><span className="menu-item-copy"><strong>Negozio strumenti</strong><small>Usa i tuoi punti per prepararti alle ricerche</small></span><ChevronRight className="menu-chevron"/></button>
              <button className="portal-menu-item" onClick={() => navTo('classifica')}><span className="menu-item-icon orange-icon"><Trophy size={22}/></span><span className="menu-item-copy"><strong>Classifica globale</strong><small>Consulta il riepilogo locale; la graduatoria online arriverà con il backend</small></span><ChevronRight className="menu-chevron"/></button>
            </section>
            <section className="home-progress-panel"><div><div className="progress-medal">★</div><div><span className="section-label">IL TUO PERCORSO</span><h2>Registro personale</h2><p>Hai catalogato {progress.completedIds.length} specie su {NATIONAL_DEX_SIZE}.</p></div></div><button className="secondary-button" onClick={() => navTo('registro')}>Apri registro <ChevronRight size={15}/></button><div className="home-progress-track"><span style={{width: `${Math.min(100,progress.completedIds.length/NATIONAL_DEX_SIZE*100)}%`}}/></div></section>
          </>}
          {view === 'pokedex' && <Archive
            species={species}
            items={itemCatalog}
            loadingSpecies={loading}
            loadingItems={itemCatalogLoading}
            online={online}
            completedPokemon={progress.completedIds}
            completedEntries={progress.completedEntries ?? []}
          />}
          {view === 'pokedex' && <>
            {loadError && <div className="error-panel"><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Riprova</button></div>}
            <section className="challenge-board game-board mixed-lesson-board">
              <section className="game-zone game-slots-zone lesson-target-zone" aria-label="Sottocategorie della lezione">
                <div className="game-zone-heading"><strong>CLASSIFICA LA CARTA</strong><span>{lessonSolved.length} / {lessonDeck.length} catalogate</span></div>
                <div className="category-targets-grid">
                  {lessonTargets.map(target => <button
                    type="button"
                    key={target.id}
                    className={`category-target ${target.solved === target.total ? 'category-target-complete' : ''} ${wrongTargetId === target.id ? 'category-target-wrong' : ''}`}
                    aria-label={`Classifica in ${target.macroName}, sottocategoria ${target.name}`}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => { event.preventDefault(); const cardId = event.dataTransfer.getData('text/plain'); if (cardId) placeCard(cardId, target.id); }}
                    onClick={() => { if (selectedCardId) placeCard(selectedCardId, target.id); }}
                  >
                    <span className="category-target-macro">{target.macroName}</span>
                    <strong>{target.name}</strong>
                    <small>{target.solved} / {target.total}</small>
                  </button>)}
                  {lessonReady && lessonDeck.length === 0 && <div className="empty-service lesson-empty"><h3>Nessun elemento disponibile</h3><p>Ricollegati per caricare il catalogo degli oggetti oppure avvia una nuova lezione quando il catalogo sarà pronto.</p></div>}
                </div>
                {lessonDeck.length > 0 && lessonSolved.length === lessonDeck.length && <div className="lesson-complete-banner"><strong>Lezione completata</strong><span>Hai classificato tutti gli elementi di questa lezione.</span><button className="primary-button" type="button" onClick={startNewLesson}>Inizia una nuova lezione</button></div>}
              </section>
              <div className={`feedback-bar game-feedback ${message.startsWith('Corretto') ? 'feedback-success' : wrongTargetId !== null ? 'feedback-error' : ''}`} role="status">{message}</div>
              <section className="game-zone game-pokemon-zone" aria-label="Carte selezionabili">
                <div className="game-zone-heading"><strong>CARTE MISTE</strong><span>{remainingLessonCards.length} da classificare</span></div><div className="ability-toolbar">{inventory.includes('scanner') && <button type="button" disabled={!selectedCardId || (progress.abilityCooldowns?.scanner ?? 0) > clockNow} onClick={() => useAbility('scanner')}><strong>Scanner</strong><small>{(progress.abilityCooldowns?.scanner ?? 0) > clockNow ? cooldownLabel(progress.abilityCooldowns?.scanner ?? 0,clockNow) : 'Pronto'}</small></button>}{inventory.includes('research') && <button type="button" disabled={!selectedCardId || (progress.abilityCooldowns?.research ?? 0) > clockNow} onClick={() => useAbility('research')}><strong>Ricerca</strong><small>{(progress.abilityCooldowns?.research ?? 0) > clockNow ? cooldownLabel(progress.abilityCooldowns?.research ?? 0,clockNow) : 'Pronto'}</small></button>}</div>
                {loading ? <div className="loading-panel"><div className="pokeball-loader" /><h3>Caricamento archivio Pokémon…</h3></div>
                  : itemCatalog.length === 0 ? <div className="loading-panel"><h3>Catalogo misto non ancora pronto</h3><p>{online ? 'Caricamento del catalogo degli oggetti…' : 'Serve una prima connessione per scaricare gli oggetti. Dopo il caricamento saranno disponibili anche offline.'}</p></div>
                  : remainingLessonCards.length > 0 ? <div className="pokemon-cards mixed-card-grid">
                    {remainingLessonCards.map(card => <button
                      key={card.id}
                      type="button"
                      aria-label="Seleziona carta da classificare"
                      title="Seleziona carta"
                      className={`pokemon-card mixed-card ${selectedCardId === card.id ? 'chosen' : ''}`}
                      draggable
                      onDragStart={event => event.dataTransfer.setData('text/plain', card.id)}
                      onClick={() => { setSelectedCardId(card.id); setMessage('Carta selezionata. Tocca la sottocategoria corretta.'); }}
                    >
                      <img src={card.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                    </button>)}
                  </div>
                  : <div className="round-complete"><h3>Lezione completata!</h3><p>La prossima lezione è pronta dal tabellone superiore.</p></div>}
                <div className="lesson-macro-legend">
                  {MACRO_CATEGORIES.map(category => <span key={category.id}>{category.name}</span>)}
                </div>
              </section>
            </section>
          </>}
          {view === 'registro' && <><div className="breadcrumb">Home / Area allievo / <b>Registro personale</b></div><div className="page-heading"><div><div className="eyebrow">SEGRETERIA DIDATTICA</div><h1>Registro personale</h1><p>Il riepilogo dei progressi nel catalogo Nazionale completo.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>SPECIE CATALOGATE</span><strong>{progress.completedIds.length} <small>/ 1025</small></strong></div></div><section className="archive-search"><h2>Avanzamento per regione</h2>{regions.map(region => { const count = progress.completedIds.filter(id => id >= region.start && id <= region.end).length; const total = region.end - region.start + 1; return <div className="region-progress" key={region.name}><div><b>{region.name}</b><span>{count} / {total}</span></div><div className="progress-track"><span style={{ width: `${count / total * 100}%` }} /></div>{count === total && <small className="exam-earned">Regione completata · Punto esame ottenuto</small>}</div>})}<button className="secondary-button reset-button" onClick={() => { if (window.confirm('Vuoi azzerare punteggio e progressi salvati su questo dispositivo?')) { setProgress({ points: 0, completedIds: [], examPoints: 0, completedExams: [], inventory: [], completedEntries: [], abilityCooldowns: {} }); setLessonReady(false); setLessonDeck([]); setLessonSolved([]); setSelectedCardId(null); setMessage('Progressi azzerati. Tutti gli elementi sono nuovamente disponibili.'); } }}>Azzera progressi</button></section></>}
          {view === 'shop' && <><div className="breadcrumb">Home / Servizi / <b>Cartoleria punti</b></div><div className="page-heading"><div><div className="eyebrow">SERVIZI STUDENTI</div><h1>Cartoleria punti</h1><p>Ogni potenziamento successivo compare dopo l’acquisto del livello precedente. Il costo complessivo in Punti Poké corrisponde ai punti ottenibili catalogando tutte le entità disponibili.</p></div></div><div className="dashboard-strip"><div><span>PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>ACQUISTI DISPONIBILI</span><strong>{availableShopCount}</strong></div></div><div className="shop-tabs"><button className={shopTab === 'oggetti' ? 'active' : ''} onClick={() => setShopTab('oggetti')}>Oggetti · Punti Poké</button><button className={shopTab === 'super-aiuti' ? 'active' : ''} onClick={() => setShopTab('super-aiuti')}>Passivi, archivi e modalità · Punti esame</button></div>{notice && <div className="notice-inline" role="status">{notice}</div>}<div className="shop-grid">{shopProducts.filter(product => product.category === shopTab && (product.kind !== 'upgrade' || productUnlocked(product, inventory, progress.completedIds.length))).map(product => {const owned=inventory.includes(product.id);const unlocked=productUnlocked(product,inventory,progress.completedIds.length);const balance=product.currency==='poke'?progress.points:progress.examPoints;const canBuy=!owned&&unlocked&&balance>=product.cost&&(product.currency!=='poke'||shopPricingReady);const requirement=product.requirementLabel ?? (product.requires?.length ? `Richiede: ${product.requires.map(id=>SHOP_PRODUCTS.find(entry=>entry.id===id)?.name ?? id).join(', ')}` : 'Nessun requisito aggiuntivo');const status=owned?'Acquistato':!unlocked?'Bloccato':balance<product.cost?'Punti insufficienti':'Disponibile';return <article className={`shop-card ${!unlocked&&!owned?'shop-card-locked':''}`} key={product.id}><div className="shop-symbol">{product.kind==='active'?'⌁':product.kind==='upgrade'?'↗':product.kind==='archive'?'▤':product.kind==='cosmetic'?'✦':product.kind==='mode'?'◈':'★'}</div><div className="shop-product-content"><h3>{product.name}</h3><p>{product.description}</p><small className="shop-requirement">{requirement}</small><strong>{product.cost} {product.currency==='poke'?'Punti Poké':'Punti esame'}</strong><span className={`shop-product-status ${canBuy?'shop-product-ready':owned?'shop-product-owned':''}`}>{status}</span><button className="primary-button" disabled={!canBuy} onClick={()=>buyItem(product)}>{owned?'Acquistato':!unlocked?'Requisiti mancanti':product.currency==='poke'&&!shopPricingReady?'Calcolo del catalogo…':balance<product.cost?'Punti insufficienti':'Acquista'}</button></div></article>})}</div></>}

          {view === 'esami' && <><div className="breadcrumb">Home / Area didattica / <b>Esami</b></div><div className="page-heading"><div><div className="eyebrow">DIPARTIMENTO DIDATTICO</div><h1>Esami e prove speciali</h1><p>Completa le regioni, approfondisci i tipi Pokémon e affronta obiettivi speciali. I risultati vengono salvati localmente.</p></div></div>{notice && <div className="notice-inline" role="status">{notice}</div>}<section className="archive-search"><h2>Esami regionali</h2><p>Completare una regione assegna automaticamente 1 Punto esame.</p><div className="exam-grid">{regions.map(region => {const count=progress.completedIds.filter(id=>id>=region.start&&id<=region.end).length;const total=region.end-region.start+1;const done=count===total;return <article className="exam-card" key={region.name}><div className="exam-card-mark">{done?'✓':'R'}</div><div><h3>{region.name}</h3><p>{count} di {total} Pokémon catalogati</p><div className="progress-track"><span style={{width:`${count/total*100}%`}}/></div><strong>{done?'Regione completata · Punto esame ottenuto':`${Math.round(count/total*100)}% completato`}</strong></div></article>})}</div></section><section className="archive-search"><h2>Esami per tipo</h2><p>I dati dei tipi provengono dalla PokéAPI e vengono messi in cache dopo il primo caricamento.</p>{typeLoading && <div className="loading-panel"><p>Caricamento dei 18 tipi dalla PokéAPI…</p></div>}{typeCatalog.length===0&&!typeLoading&&<div className="empty-service"><p>{online?'Apri nuovamente questa sezione per caricare i tipi.':'I tipi non sono ancora stati salvati in cache: serve una connessione al primo accesso.'}</p></div>}<div className="exam-grid">{typeCatalog.map(type=>{const ids=type.ids;const count=ids.filter(id=>completedSet.has(id)).length;const done=ids.length>0&&count===ids.length;const key=`type-${type.name}`;const claimed=completedExams.includes(key);return <article className="exam-card" key={type.name}><div className="exam-card-mark type-mark">{type.name.slice(0,2).toUpperCase()}</div><div><h3>{titleCase(type.name)}</h3><p>{count} di {ids.length} specie catalogate</p><div className="progress-track"><span style={{width:`${ids.length?count/ids.length*100:0}%`}}/></div>{done?<button className="secondary-button" disabled={claimed} onClick={()=>claimExam(key)}>{claimed?'Ricompensa riscossa':'Completa prova · +1 Punto esame'}</button>:<strong>{ids.length?Math.round(count/ids.length*100):0}% completato</strong>}</div></article>})}</div></section><section className="archive-search"><h2>Prove speciali</h2><p>Obiettivi progressivi di catalogazione. Ogni ricompensa può essere riscossa una sola volta.</p><div className="exam-grid">{[{id:'special-10',title:'Primo studio',target:10,reward:1},{id:'special-50',title:'Ricercatore in erba',target:50,reward:1},{id:'special-150',title:'Archivista Pokémon',target:150,reward:2},{id:'special-500',title:'Esperto Nazionale',target:500,reward:3},{id:'special-1025',title:'Maestro dell’Archivio',target:1025,reward:10}].map(exam=>{const done=progress.completedIds.length>=exam.target;const claimed=completedExams.includes(exam.id);return <article className="exam-card" key={exam.id}><div className="exam-card-mark special-mark">★</div><div><h3>{exam.title}</h3><p>Cataloga {exam.target} Pokémon · {Math.min(progress.completedIds.length,exam.target)} / {exam.target}</p><div className="progress-track"><span style={{width:`${Math.min(100,progress.completedIds.length/exam.target*100)}%`}}/></div><strong>{exam.reward} {exam.reward===1?'Punto esame':'Punti esame'}</strong><button className="secondary-button" disabled={!done||claimed} onClick={()=>claimExam(exam.id,exam.reward)}>{claimed?'Ricompensa riscossa':done?'Riscatta ricompensa':'Prova in corso'}</button></div></article>})}</div></section></>}

          {view === 'classifica' && <><div className="breadcrumb">Home / Comunità / <b>Classifica globale</b></div><div className="page-heading"><div><div className="eyebrow">RISULTATI STUDENTI</div><h1>Classifica globale</h1><p>La graduatoria online verrà attivata quando saranno disponibili autenticazione e database condiviso.</p></div></div><section className="empty-service ranking-preview"><Trophy size={36}/><h2>Classifica online non ancora attiva</h2><p>Questa versione mantiene i tuoi risultati sul dispositivo. Senza database non è possibile confrontare in modo affidabile gli studenti o sincronizzare i risultati tra PC e smartphone.</p><div className="dashboard-strip"><div><span>I TUOI PUNTI POKÉ</span><strong>{progress.points}</strong></div><div><span>I TUOI PUNTI ESAME</span><strong>{progress.examPoints}</strong></div><div><span>POKÉMON CATALOGATI</span><strong>{progress.completedIds.length}/1025</strong></div></div></section></>}

          {view === 'profilo' && <><div className="breadcrumb">Home / Area allievo / <b>Profilo</b></div><div className="page-heading"><div><div className="eyebrow">IDENTITÀ STUDENTE</div><h1>Il tuo profilo</h1><p>Personalizza l’immagine profilo scegliendo tra i 1.025 Pokémon. Le immagini vengono caricate dalla CDN solo quando servono.</p></div></div><section className="archive-search profile-panel"><div className="profile-hero"><div className="profile-avatar-large">{student.avatarId?<img src={spriteUrl(student.avatarId)} alt="Avatar scelto"/>:'★'}</div><div><span className="section-label">PROFILO LOCALE</span><h2>{student.nickname}</h2><p>{student.matricola}</p><p>{academy==='arancia'?'Accademia Arancia':'Accademia Uva'}</p><small>Accesso con account e sincronizzazione saranno aggiunti nell’ultima fase.</small></div></div><label className="item-search-label">Cerca un Pokémon per nome o numero<input value={avatarSearch} onChange={event=>{setAvatarSearch(event.target.value);setAvatarPage(0);}} placeholder="Es. Pikachu oppure 0025"/></label><div className="avatar-grid">{visibleAvatars.map(pokemon=><button className={student.avatarId===pokemon.id?'avatar-option selected':'avatar-option'} key={pokemon.id} onClick={()=>saveAvatar(pokemon.id)} aria-label={`Scegli ${titleCase(pokemon.name)} come avatar`}><img src={spriteUrl(pokemon.id)} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/><span>{titleCase(pokemon.name)}</span></button>)}</div><div className="game-pagination"><button disabled={avatarPage===0} onClick={()=>setAvatarPage(Math.max(0,avatarPage-1))}>‹ Indietro</button><span>Pagina {Math.min(avatarPage+1,avatarPageCount)} / {avatarPageCount}</span><button disabled={avatarPage>=avatarPageCount-1} onClick={()=>setAvatarPage(Math.min(avatarPageCount-1,avatarPage+1))}>Avanti ›</button></div></section></>}

          {view === 'forum' && <><div className="breadcrumb">Home / Comunità / <b>Bacheca studenti</b></div><div className="page-heading"><div><div className="eyebrow">COMUNITÀ SCOLASTICA</div><h1>Bacheca studenti</h1><p>Avvisi e appunti dell'archivio Pokémon.</p></div></div><section className="forum-post"><div className="post-icon">📌</div><div><span className="section-label">AVVISO DEL PRESIDE</span><h2>Benvenuto nel Archivio Nazionale</h2><p>Tutte le specie e tutti i numeri sono disponibili fin dall'inizio. Catalogare è un'attività continua: ogni collocazione corretta aggiunge un Punto Poké e gli errori non sottraggono punti. Completando una regione ottieni un Punto esame.</p><small>SEGRETERIA DIDATTICA</small></div></section><section className="forum-post"><div className="post-icon">📚</div><div><span className="section-label">GUIDA RAPIDA</span><h2>Come funziona la catalogazione</h2><p>Ogni lezione combina carte di macrocategorie diverse. Trascina una carta nella sottocategoria corretta oppure, su mobile, seleziona la carta e tocca la destinazione. Il nome viene rivelato dopo la risposta; gli errori non sottraggono punti.</p><small>MANUALE DELLO STUDENTE</small></div></section></>}
          <footer className="site-footer"><div>© 2026 POKÉ STUDY · PORTALE DIDATTICO FAN-MADE</div><div>PROGETTO NON UFFICIALE · TUTTI I MARCHI AI RISPETTIVI PROPRIETARI</div></footer>
        </section>
      </main>
      <nav className="mobile-app-nav" aria-label="Navigazione principale">
        <button className={view === 'home' ? 'active' : ''} onClick={() => navTo('home')}><GraduationCap size={20}/><span>Portale</span></button>
        <button className={view === 'pokedex' ? 'active' : ''} onClick={() => navTo('pokedex')}><BookOpen size={20}/><span>Archivio</span></button>
        <button className={view === 'esami' ? 'active' : ''} onClick={() => navTo('esami')}><FlaskConical size={20}/><span>Esami</span></button>
        <button className={view === 'shop' ? 'active' : ''} onClick={() => navTo('shop')}><span className="mobile-shop-icon"><ShoppingBag size={20}/>{availableShopCount > 0 && <span className="shop-notification-badge" aria-label={`${availableShopCount} acquisti disponibili`}>{availableShopCount}</span>}</span><span>Negozio</span></button>
        <button className={view === 'profilo' ? 'active' : ''} onClick={() => navTo('profilo')}><GraduationCap size={20}/><span>Profilo</span></button>
      </nav>
    </div>
  );
}
