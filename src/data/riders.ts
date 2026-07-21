import type { Rider, StatKey } from './types.ts';

/**
 * Minimal MVP roster (SPEC §4): one player team of 6 + three rival teams of 5.
 * Proxy names only — recognisable-but-renamed (SPEC §9). Stats are 1–100 and are
 * authored so the right specialist wins the right stage type; overlaps between
 * offensive stats are intentional and fine (SPEC §5.4).
 *
 * STARTING VALUES — expect to tune once races can be watched.
 */

type Stats = Record<StatKey, number>;

function stats(
  climbing: number,
  timeTrial: number,
  sprint: number,
  puncheur: number,
  endurance: number,
  stamina: number,
  consistency: number,
): Stats {
  return { climbing, timeTrial, sprint, puncheur, endurance, stamina, consistency };
}

function rider(
  id: string,
  name: string,
  nationality: string,
  age: number,
  teamId: string,
  s: Stats,
): Rider {
  return { id, name, nationality, age, teamId, stats: s, currentFatigue: 0 };
}

export const RIDERS: Rider[] = [
  // --- Grenoble Grenadiers (player) ---
  //                                          clm  tt  spr pun end sta con
  rider('gr-pogar', 'Tano Pogar', 'Slovenia', 26, 't-grenoble', stats(92, 80, 62, 88, 90, 85, 82)),
  rider('gr-gann', 'Fabio Gann', 'Italy', 28, 't-grenoble', stats(55, 95, 60, 58, 82, 78, 80)),
  rider('gr-philq', 'Jesper Philquist', 'Belgium', 27, 't-grenoble', stats(30, 55, 94, 60, 72, 70, 78)),
  rider('gr-berg', 'Lars Bergsen', 'Norway', 29, 't-grenoble', stats(84, 60, 40, 66, 84, 80, 72)),
  rider('gr-kobbel', 'Tomas Kobbel', 'Belgium', 30, 't-grenoble', stats(45, 70, 68, 82, 85, 76, 70)),
  rider('gr-vance', 'Milo Vance', 'France', 21, 't-grenoble', stats(70, 66, 58, 72, 74, 72, 55)),

  // --- Vesma Lease-a-Bike ---
  rider('vm-vinge', 'Jonas Vingeborg', 'Denmark', 28, 't-vesma', stats(94, 78, 35, 74, 92, 88, 84)),
  rider('vm-wout', 'Wouter van Aerts', 'Belgium', 29, 't-vesma', stats(62, 82, 86, 90, 88, 80, 80)),
  rider('vm-sep', 'Sepp Kussler', 'USA', 27, 't-vesma', stats(82, 62, 38, 60, 86, 82, 74)),
  rider('vm-tiel', 'Tiel van Dijk', 'Netherlands', 26, 't-vesma', stats(58, 74, 66, 70, 80, 74, 72)),
  rider('vm-benno', 'Benno Aerts', 'Belgium', 25, 't-vesma', stats(32, 58, 88, 64, 70, 68, 76)),

  // --- UAD Emirates ---
  rider('ua-remco', 'Remi Evenpol', 'Belgium', 25, 't-uad', stats(88, 92, 48, 80, 88, 84, 83)),
  rider('ua-mvdp', 'Mathis van der Piel', 'Netherlands', 29, 't-uad', stats(55, 76, 82, 95, 86, 78, 79)),
  rider('ua-phil', 'Jasper Philmore', 'Belgium', 26, 't-uad', stats(28, 54, 92, 62, 68, 66, 80)),
  rider('ua-domingo', 'Diego Domingo', 'Spain', 24, 't-uad', stats(86, 58, 36, 58, 84, 80, 70)),
  rider('ua-adam', 'Adam Yeats', 'UK', 31, 't-uad', stats(88, 66, 40, 68, 82, 78, 72)),

  // --- Soudo Quick-Track ---
  rider('so-rogla', 'Primoz Roglar', 'Slovenia', 34, 't-soudo', stats(90, 84, 50, 76, 86, 80, 78)),
  rider('so-merlin', 'Merlin Kwait', 'Belgium', 30, 't-soudo', stats(44, 72, 74, 84, 84, 74, 68)),
  rider('so-ilan', 'Ilan Girard', 'France', 27, 't-soudo', stats(34, 56, 90, 66, 72, 70, 74)),
  rider('so-mick', 'Mick Landa', 'Spain', 28, 't-soudo', stats(85, 62, 38, 62, 83, 78, 70)),
  rider('so-reck', 'Jonas Reck', 'Germany', 25, 't-soudo', stats(56, 80, 62, 68, 78, 72, 74)),
];

export const RIDERS_BY_ID: Map<string, Rider> = new Map(RIDERS.map((r) => [r.id, r]));
