import {
  WORLD_CONSISTENCY_MIN,
  WORLD_CONSISTENCY_RANGE,
  WORLD_DEVELOPMENT_CURRENT_PENALTY,
  WORLD_FREE_QUALITY_MAX,
  WORLD_FREE_QUALITY_MIN,
  WORLD_PRO_QUALITY_MAX,
  WORLD_PRO_QUALITY_MIN,
  WORLD_PRO_MAX_STAT,
  WORLD_PROPOSAL_QUALITY_MAX,
  WORLD_PROPOSAL_QUALITY_MIN,
  WORLD_RIDER_AGE_MAX,
  WORLD_RIDER_AGE_MIN,
  WORLD_RIDER_BASE_STAT,
  WORLD_RIDER_PROFILE_RANGE,
  WORLD_RIDER_QUALITY_BASE,
  WORLD_RIDER_STAT_NOISE,
  WORLD_STAMINA_BASE,
  WORLD_STAMINA_ENDURANCE_RANGE,
  WORLD_STAMINA_QUALITY_RANGE,
  WORLD_TOP_QUALITY_MAX,
  WORLD_TOP_QUALITY_MIN,
} from '../data/tuning.ts';
import type { DivisionId, Rider, StatKey, TeamPhilosophy } from '../data/types.ts';
import { ARCHETYPE_PROFILES, type RiderArchetype } from '../data/worldTemplates.ts';
import { seedDevelopment } from './development.ts';
import { riderSalary } from './rating.ts';
import type { Rng } from './rng.ts';
import { generateRiderIdentity } from './riderNames.ts';

export type RiderGenerationTier = DivisionId | 'free' | 'proposal';

export interface RiderGenerationOptions {
  id: string;
  teamId: string | null;
  archetype: RiderArchetype;
  tier: RiderGenerationTier;
  philosophy: TeamPhilosophy;
  rng: Rng;
  usedNames: Set<string>;
  age?: number;
}

function clampTierStat(value: number, tier: RiderGenerationTier): number {
  const max = tier === 'world' ? 95 : WORLD_PRO_MAX_STAT;
  return Math.max(30, Math.min(max, Math.round(value)));
}

function qualityRange(tier: RiderGenerationTier): [number, number] {
  if (tier === 'world') return [WORLD_TOP_QUALITY_MIN, WORLD_TOP_QUALITY_MAX];
  if (tier === 'pro') return [WORLD_PRO_QUALITY_MIN, WORLD_PRO_QUALITY_MAX];
  if (tier === 'proposal') return [WORLD_PROPOSAL_QUALITY_MIN, WORLD_PROPOSAL_QUALITY_MAX];
  return [WORLD_FREE_QUALITY_MIN, WORLD_FREE_QUALITY_MAX];
}

export function generateWorldRider(options: RiderGenerationOptions): Rider {
  const { rng, archetype, philosophy } = options;
  const [qualityMin, qualityMax] = qualityRange(options.tier);
  let quality = qualityMin + rng.next() * (qualityMax - qualityMin);
  const age = options.age ?? WORLD_RIDER_AGE_MIN + rng.int(WORLD_RIDER_AGE_MAX - WORLD_RIDER_AGE_MIN + 1);
  if (philosophy === 'development' && age <= 23) quality -= WORLD_DEVELOPMENT_CURRENT_PENALTY;
  const profile = ARCHETYPE_PROFILES[archetype];
  const identity = generateRiderIdentity(rng, archetype, options.usedNames);
  const offensive = {} as Record<'climbing' | 'flat' | 'sprint' | 'puncheur' | 'endurance', number>;
  for (const key of Object.keys(profile) as (keyof typeof profile)[]) {
    offensive[key] = clampTierStat(
      WORLD_RIDER_BASE_STAT +
        quality * (WORLD_RIDER_QUALITY_BASE + WORLD_RIDER_PROFILE_RANGE * profile[key]) +
        rng.gaussian(0, WORLD_RIDER_STAT_NOISE),
      options.tier,
    );
  }
  const stats: Record<StatKey, number> = {
    ...offensive,
    stamina: clampTierStat(
      WORLD_STAMINA_BASE +
        quality * WORLD_STAMINA_QUALITY_RANGE +
        profile.endurance * WORLD_STAMINA_ENDURANCE_RANGE +
        rng.gaussian(0, WORLD_RIDER_STAT_NOISE),
      options.tier,
    ),
    consistency: clampTierStat(
      WORLD_CONSISTENCY_MIN + quality * WORLD_CONSISTENCY_RANGE + rng.gaussian(0, WORLD_RIDER_STAT_NOISE),
      options.tier,
    ),
  };
  const rider: Rider = {
    id: options.id,
    name: identity.name,
    nationality: identity.nationality,
    age,
    stats,
    teamId: options.teamId,
    currentFatigue: 0,
  };
  seedDevelopment(rider);
  if (rider.teamId) {
    rider.salary = riderSalary(rider);
    rider.contractSeasonsLeft = 2 + rng.int(3);
  }
  return rider;
}