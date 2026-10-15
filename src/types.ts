export interface PokemonSpecies {
  id: number;
  name: string;
  localizedName?: string;
}

export interface ProgressHistoryEntry {
  id: string;
  timestamp: number;
  kind: 'catalog' | 'error' | 'exam';
  title: string;
  detail: string;
}

export interface SavedProgress {
  points: number;
  completedIds: number[];
  /** Legacy save field retained for compatibility; no longer used by gameplay. */
  examPoints: number;
  completedExams?: string[];
  inventory?: string[];
  completedEntries?: string[];
  /** Unix timestamps in milliseconds; one cooldown per active ability. */
  abilityCooldowns?: Record<string, number>;
  errors?: number;
  history?: ProgressHistoryEntry[];
  /** Persistent in-progress catalog placements, synchronized with Supabase. */
  gameState?: {
    categoryPlacements: Record<string, string>;
    misplacedCards: Record<string, string>;
    openMacroId?: string | null;
    openSubcategoryId?: string | null;
    openPokemonRegionId?: string | null;
    gamePage?: number;
    /** Macrocategorie rivelate dallo Scanner, persistenti per ciascuna carta. */
    revealedMacroCategories?: Record<string, string>;
    /** Sottocategorie rivelate da Ricerca, persistenti per ciascuna carta. */
    revealedSubcategories?: Record<string, string>;
  };
}

export interface ApiNamedResource {
  name: string;
  url: string;
  localizedName?: string;
}

export interface PokemonTypeIndex {
  name: string;
  ids: number[];
}

export interface StudentProfile {
  nickname: string;
  matricola: string;
  avatarId?: number;
  profileSettings?: StudentProfileSettings;
}


export interface StudentProfileVisibility {
  bio: boolean;
  favoritePokemon: boolean;
  motto: boolean;
  activeTitle: boolean;
  badges: boolean;
  catalogStats: boolean;
  communityStats: boolean;
  academicGrade: boolean;
  matricola: boolean;
}

export interface StudentProfileSettings {
  bio: string;
  favoritePokemon: string;
  motto: string;
  activeTitle: string;
  badges: string[];
  frame: string;
  visibility: StudentProfileVisibility;
}
