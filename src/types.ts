export interface PokemonSpecies {
  id: number;
  name: string;
}

export interface SavedProgress {
  points: number;
  completedIds: number[];
  examPoints: number;
}