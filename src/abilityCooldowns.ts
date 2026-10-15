export const SCANNER_LEVELS = 20;
export const RESEARCH_LEVELS = 12;
export const NUMBER_CHECK_LEVELS = 10;
export const REVEAL_SUBCATEGORY_LEVELS = 12;
export const AUTO_SORT_LEVELS = 10;

export type CooldownAbility = 'scanner' | 'research' | 'number-check' | 'reveal-subcategory' | 'auto-sort';

export const COOLDOWN_CONFIG: Record<CooldownAbility, { baseSeconds: number; levels: number }> = {
  scanner: { baseSeconds: 300, levels: SCANNER_LEVELS },
  research: { baseSeconds: 600, levels: RESEARCH_LEVELS },
  'number-check': { baseSeconds: 300, levels: NUMBER_CHECK_LEVELS },
  'reveal-subcategory': { baseSeconds: 600, levels: REVEAL_SUBCATEGORY_LEVELS },
  'auto-sort': { baseSeconds: 300, levels: AUTO_SORT_LEVELS },
};

export function abilityLevelFromInventory(abilityId: CooldownAbility, inventory: string[]) {
  const prefix = `${abilityId}-upgrade-`;
  return inventory.reduce((level, id) => {
    if (!id.startsWith(prefix)) return level;
    const parsed = Number(id.slice(prefix.length));
    return Number.isInteger(parsed) && parsed >= 2 && parsed <= COOLDOWN_CONFIG[abilityId].levels
      ? Math.max(level, parsed)
      : level;
  }, 1);
}

export function abilityCooldownSeconds(abilityId: CooldownAbility, level: number) {
  const { baseSeconds, levels } = COOLDOWN_CONFIG[abilityId];
  const safeLevel = Math.min(levels, Math.max(1, Math.floor(level) || 1));
  // Il livello massimo di ogni abilità raggiunge esattamente 10 secondi.
  if (safeLevel >= levels) return 10;
  return Math.max(10, Math.round(baseSeconds * Math.pow(10 / baseSeconds, (safeLevel - 1) / (levels - 1))));
}

export function abilityCooldownDurationMs(abilityId: CooldownAbility, level: number) {
  return abilityCooldownSeconds(abilityId, level) * 1000;
}

export function formatCooldownTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  return `${String(minutesPart).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`;
}

export function cooldownAbilityForProductId(productId: string): CooldownAbility | undefined {
  switch (productId) {
    case 'scanner': return 'scanner';
    case 'research': return 'research';
    case 'number-check': return 'number-check';
    case 'reveal-subcategory': return 'reveal-subcategory';
    case 'auto-sort': return 'auto-sort';
    default: return undefined;
  }
}
