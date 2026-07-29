import { PRO_RIDER_CARICATURES, RIDER_NAME_CULTURES, WORLD_RIDER_CARICATURES, type RiderCaricature } from '../data/names.ts';
import type { RiderArchetype } from '../data/worldTemplates.ts';
import type { Rng } from './rng.ts';

const CULTURES_BY_ARCHETYPE: Record<RiderArchetype, readonly string[]> = {
  gcClimber: ['Colombia', 'Spain', 'Slovenia', 'Italy', 'Switzerland'],
  pureClimber: ['Colombia', 'Spain', 'Portugal', 'France', 'Slovenia'],
  puncheur: ['Belgium', 'France', 'Italy', 'Netherlands', 'Ireland'],
  rouleur: ['Belgium', 'Netherlands', 'Denmark', 'Germany', 'Switzerland'],
  sprinter: ['Italy', 'France', 'United Kingdom', 'Netherlands', 'Germany'],
  leadout: ['Denmark', 'Netherlands', 'Belgium', 'Germany', 'Norway'],
  breakaway: ['France', 'Italy', 'Spain', 'Ireland', 'Poland'],
  domestique: RIDER_NAME_CULTURES.map((culture) => culture.nationality),
};

export interface RiderIdentity {
  name: string;
  nationality: string;
}

function usage(values: Set<string>, marker: string): number {
  let count = 0;
  while (values.has(`${marker}:${count + 1}`)) count++;
  return count;
}

export function createRiderNameRegistry(names: Iterable<string>): Set<string> {
  const registry = new Set<string>();
  const firstNames = new Set(RIDER_NAME_CULTURES.flatMap((culture) => culture.firstNames));
  const lastNames = new Set(RIDER_NAME_CULTURES.flatMap((culture) => culture.lastNames));
  for (const name of names) {
    registry.add(name);
    const separator = name.indexOf(' ');
    if (separator < 0) continue;
    const firstName = name.slice(0, separator);
    const lastName = name.slice(separator + 1);
    if (firstNames.has(firstName)) {
      const count = usage(registry, `@first:${firstName}`);
      registry.add(`@first:${firstName}:${count + 1}`);
    }
    if (lastNames.has(lastName)) {
      const count = usage(registry, `@last:${lastName}`);
      registry.add(`@last:${lastName}:${count + 1}`);
    }
  }
  return registry;
}

function generateCuratedRiderIdentity(
  rng: Rng,
  archetype: RiderArchetype,
  usedNames: Set<string>,
  identities: readonly RiderCaricature[],
): RiderIdentity {
  const unused = identities.filter((identity) => !usedNames.has(identity.name));
  const preferred = unused.filter((identity) => identity.archetypes.includes(archetype));
  const identity = rng.pick(preferred.length > 0 ? preferred : unused);
  if (!identity) throw new Error('World Tour rider caricature registry exhausted');
  usedNames.add(identity.name);
  return { name: identity.name, nationality: identity.nationality };
}

export function generateWorldTourRiderIdentity(rng: Rng, archetype: RiderArchetype, usedNames: Set<string>): RiderIdentity {
  return generateCuratedRiderIdentity(rng, archetype, usedNames, WORLD_RIDER_CARICATURES);
}

export function generateProTourRiderIdentity(rng: Rng, archetype: RiderArchetype, usedNames: Set<string>): RiderIdentity {
  return generateCuratedRiderIdentity(rng, archetype, usedNames, PRO_RIDER_CARICATURES);
}

export function generateRiderIdentity(rng: Rng, archetype: RiderArchetype, usedNames: Set<string>): RiderIdentity {
  const preferred = new Set(CULTURES_BY_ARCHETYPE[archetype]);
  const cultures = RIDER_NAME_CULTURES.filter((culture) => preferred.has(culture.nationality));
  for (let attempt = 0; attempt < 200; attempt++) {
    const culture = rng.pick(cultures);
    const firstName = rng.pick(culture.firstNames);
    const lastName = rng.pick(culture.lastNames);
    const name = `${firstName} ${lastName}`;
    if (usedNames.has(name)) continue;
    const firstUsage = usage(usedNames, `@first:${firstName}`);
    const lastUsage = usage(usedNames, `@last:${lastName}`);
    if (firstUsage >= 2 || lastUsage >= 2) continue;
    usedNames.add(name);
    usedNames.add(`@first:${firstName}:${firstUsage + 1}`);
    usedNames.add(`@last:${lastName}:${lastUsage + 1}`);
    return { name, nationality: culture.nationality };
  }

  const culture = rng.pick(cultures);
  for (const firstName of culture.firstNames) {
    for (const lastName of culture.lastNames) {
      const name = `${firstName} ${lastName}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return { name, nationality: culture.nationality };
      }
    }
  }
  throw new Error('Rider name registry exhausted');
}