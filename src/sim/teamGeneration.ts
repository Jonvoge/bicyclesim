import { COUNTRY_REGIONS } from '../data/countries.ts';
import { GENERATED_TEAM_NAMES, GENERATED_TEAM_PALETTES } from '../data/teamNames.ts';
import {
  WORLD_PRO_TEAM_COUNT,
  WORLD_STARTING_SEASON,
  WORLD_TEAM_COLOR_MIN_DISTANCE,
  WORLD_TOP_TEAM_COUNT,
} from '../data/tuning.ts';
import type { TeamIdentity, TeamPhilosophy } from '../data/types.ts';
import { AI_PHILOSOPHIES } from '../data/worldTemplates.ts';
import { deriveSeed, Rng } from './rng.ts';

export interface PlayerTeamInput {
  name: string;
  shortName: string;
  country: string;
  primaryColor: number;
  accentColor: number;
  philosophy: TeamPhilosophy;
}

export const DEFAULT_PLAYER_TEAM: PlayerTeamInput = {
  name: 'New Horizon Cycling',
  shortName: 'NHC',
  country: 'Denmark',
  primaryColor: 0x18b39a,
  accentColor: 0xffffff,
  philosophy: 'balanced',
};

function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = rng.int(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function colorDistance(left: number, right: number): number {
  const red = ((left >> 16) & 0xff) - ((right >> 16) & 0xff);
  const green = ((left >> 8) & 0xff) - ((right >> 8) & 0xff);
  const blue = (left & 0xff) - (right & 0xff);
  return Math.sqrt(red * red + green * green + blue * blue);
}

function takeDistinctPalette(
  available: typeof GENERATED_TEAM_PALETTES,
  usedPrimaryColors: readonly number[],
): (typeof GENERATED_TEAM_PALETTES)[number] {
  const index = available.findIndex((palette) =>
    usedPrimaryColors.every((color) => colorDistance(palette.primary, color) >= WORLD_TEAM_COLOR_MIN_DISTANCE),
  );
  if (index < 0) throw new Error('Generated team palette registry cannot satisfy division color distance');
  return available.splice(index, 1)[0];
}

export function generateTeamIdentities(seed: number, player: PlayerTeamInput = DEFAULT_PLAYER_TEAM): TeamIdentity[] {
  const rng = new Rng(deriveSeed(seed, 'identity'));
  const names = shuffled(GENERATED_TEAM_NAMES.filter((entry) => entry.name !== player.name && entry.shortName !== player.shortName), rng);
  const countries = shuffled(COUNTRY_REGIONS, rng);
  const seedTag = (seed >>> 0).toString(36);
  const teams: TeamIdentity[] = [];
  let generatedIndex = 0;
  const addDivision = (division: 'world' | 'pro', count: number): void => {
    const palettes = shuffled(GENERATED_TEAM_PALETTES, rng);
    const usedPrimaryColors = division === 'pro' ? [player.primaryColor] : [];
    for (let index = 0; index < count; index++) {
      const identity = names[generatedIndex];
      const palette = takeDistinctPalette(palettes, usedPrimaryColors);
      usedPrimaryColors.push(palette.primary);
      teams.push({
        id: `team-${seedTag}-${division}-${String(index + 1).padStart(2, '0')}`,
        name: identity.name,
        shortName: identity.shortName,
        country: countries[generatedIndex % countries.length].label,
        primaryColor: palette.primary,
        accentColor: palette.accent,
        philosophy: AI_PHILOSOPHIES[(generatedIndex + rng.int(AI_PHILOSOPHIES.length)) % AI_PHILOSOPHIES.length],
        foundedSeason: WORLD_STARTING_SEASON,
        isPlayer: false,
      });
      generatedIndex++;
    }
  };
  addDivision('world', WORLD_TOP_TEAM_COUNT);
  addDivision('pro', WORLD_PRO_TEAM_COUNT - 1);
  teams.push({
    id: `team-${seedTag}-player`,
    name: player.name,
    shortName: player.shortName,
    country: player.country,
    primaryColor: player.primaryColor,
    accentColor: player.accentColor,
    philosophy: player.philosophy,
    foundedSeason: WORLD_STARTING_SEASON,
    isPlayer: true,
  });
  return teams;
}