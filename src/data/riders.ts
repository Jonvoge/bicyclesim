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
  flat: number,
  sprint: number,
  puncheur: number,
  endurance: number,
  stamina: number,
  consistency: number,
): Stats {
  return { climbing, flat, sprint, puncheur, endurance, stamina, consistency };
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

// Authored so each terrain has a DEEP field of specialists and no rider is elite
// everywhere: the star all-rounders (Pogar / van Aerts / van der Piel) are the best
// at one or two disciplines and merely ordinary outside them, so pure sprinters own
// the flats, pure climbers own the summits, and puncheurs own the hills.
// STARTING VALUES — the real balance pass is Phase 8.
export const RIDERS: Rider[] = [
  // --- Grenoble Grenadiers (player) ---
  //                                          clm flat spr pun end sta con
  rider('gr-pogar', 'Tano Pogar', 'Slovenia', 26, 't-grenoble', stats(92, 78, 55, 80, 86, 85, 82)), // GC climber, hills threat
  rider('gr-gann', 'Fabio Gann', 'Italy', 28, 't-grenoble', stats(55, 95, 58, 62, 82, 78, 80)), // TT/rouleur (parked until TTs)
  rider('gr-philq', 'Jesper Philquist', 'Belgium', 27, 't-grenoble', stats(30, 50, 95, 56, 72, 70, 80)), // pure sprinter — fastest in the field
  rider('gr-berg', 'Lars Bergsen', 'Norway', 29, 't-grenoble', stats(86, 58, 40, 62, 84, 80, 74)), // climber
  rider('gr-kobbel', 'Tomas Kobbel', 'Belgium', 30, 't-grenoble', stats(45, 68, 66, 84, 84, 76, 70)), // puncheur / cobbles
  rider('gr-vance', 'Milo Vance', 'France', 21, 't-grenoble', stats(68, 64, 56, 70, 74, 72, 58)), // young all-rounder, streaky

  // --- Vesma Lease-a-Bike ---
  rider('vm-vinge', 'Jonas Vingeborg', 'Denmark', 28, 't-vesma', stats(95, 76, 32, 66, 90, 88, 84)), // the pure climber — summit king
  rider('vm-wout', 'Wouter van Aerts', 'Belgium', 29, 't-vesma', stats(60, 80, 73, 92, 84, 80, 80)), // classics/cobbles king (not a bunch sprinter)
  rider('vm-sep', 'Sepp Kussler', 'USA', 27, 't-vesma', stats(84, 60, 36, 56, 85, 82, 74)), // climbing domestique
  rider('vm-tiel', 'Tiel van Dijk', 'Netherlands', 26, 't-vesma', stats(56, 72, 66, 70, 80, 74, 72)), // rouleur / all-rounder
  rider('vm-benno', 'Benno Aerts', 'Belgium', 25, 't-vesma', stats(30, 56, 90, 60, 70, 68, 78)), // sprinter

  // --- UAD Emirates ---
  rider('ua-remco', 'Remi Evenpol', 'Belgium', 25, 't-uad', stats(89, 90, 46, 72, 86, 84, 83)), // climber / GC, summit contender
  rider('ua-mvdp', 'Mathis van der Piel', 'Netherlands', 29, 't-uad', stats(52, 74, 72, 96, 84, 78, 80)), // puncheur king — hills & cobbles
  rider('ua-phil', 'Jasper Philmore', 'Belgium', 26, 't-uad', stats(28, 52, 93, 58, 68, 66, 80)), // sprinter
  rider('ua-domingo', 'Diego Domingo', 'Spain', 24, 't-uad', stats(89, 56, 34, 56, 84, 80, 70)), // pure climber — summit contender
  rider('ua-adam', 'Adam Yeats', 'UK', 31, 't-uad', stats(90, 64, 38, 64, 82, 78, 72)), // pure climber — summit contender

  // --- Soudo Quick-Track ---
  rider('so-rogla', 'Primoz Roglar', 'Slovenia', 34, 't-soudo', stats(90, 82, 48, 66, 84, 80, 78)), // veteran climber / GC
  rider('so-merlin', 'Merlin Kwait', 'Belgium', 30, 't-soudo', stats(44, 70, 72, 86, 84, 74, 70)), // puncheur — hills & cobbles
  rider('so-ilan', 'Ilan Girard', 'France', 27, 't-soudo', stats(34, 54, 91, 62, 72, 70, 76)), // sprinter
  rider('so-mick', 'Mick Landa', 'Spain', 28, 't-soudo', stats(86, 60, 36, 58, 83, 78, 70)), // climber
  rider('so-reck', 'Jonas Reck', 'Germany', 25, 't-soudo', stats(56, 78, 62, 66, 78, 72, 74)), // rouleur / all-rounder

  // --- Movistrella (Spanish GC / climbing squad) ---
  rider('mv-ayuso', 'Bruno Ayoso', 'Spain', 22, 't-movistrella', stats(91, 66, 42, 74, 86, 82, 76)), // young climbing star
  rider('mv-mas', 'Enric Maset', 'Spain', 29, 't-movistrella', stats(87, 60, 40, 62, 85, 80, 78)), // GC climber
  rider('mv-rubio', 'Diego Rubín', 'Colombia', 27, 't-movistrella', stats(84, 58, 44, 72, 83, 78, 72)), // climber / puncheur
  rider('mv-oliveira', 'Nuno Oliveiro', 'Portugal', 30, 't-movistrella', stats(58, 86, 60, 66, 82, 76, 78)), // rouleur / breakaway
  rider('mv-garcia', 'Iván Gárcez', 'Spain', 25, 't-movistrella', stats(32, 60, 88, 60, 70, 68, 76)), // sprinter
  rider('mv-romo', 'Pau Romero', 'Spain', 24, 't-movistrella', stats(80, 56, 38, 58, 82, 80, 68)), // climbing domestique

  // --- Bora Hansburg (German all-round / sprint squad) ---
  rider('bo-hindley', 'Jai Hindmarsh', 'Australia', 28, 't-bora', stats(88, 74, 44, 70, 87, 84, 80)), // GC climber
  rider('bo-ackermann', 'Pascal Ackerson', 'Germany', 30, 't-bora', stats(28, 62, 92, 58, 68, 66, 78)), // pure sprinter
  rider('bo-schachmann', 'Max Schachner', 'Germany', 29, 't-bora', stats(60, 76, 62, 84, 84, 78, 76)), // puncheur / classics
  rider('bo-buchmann', 'Emil Buchner', 'Germany', 31, 't-bora', stats(85, 62, 38, 60, 84, 80, 74)), // climber
  rider('bo-palzer', 'Anton Pfalz', 'Germany', 26, 't-bora', stats(62, 84, 56, 70, 82, 76, 70)), // rouleur / breakaway
  rider('bo-meeus', 'Jordi Meuss', 'Belgium', 24, 't-bora', stats(30, 66, 84, 60, 70, 68, 74)), // sprinter / lead-out

  // --- Lido-Trec (classics & cobbles squad) ---
  rider('li-pedersen', 'Mark Pedersson', 'Denmark', 28, 't-lido', stats(42, 80, 74, 90, 86, 80, 82)), // classics / cobbles leader
  rider('li-mollema', 'Bram Mollena', 'Netherlands', 33, 't-lido', stats(66, 82, 52, 72, 84, 78, 74)), // rouleur / breakaway
  rider('li-ciccone', 'Gino Ciccardo', 'Italy', 29, 't-lido', stats(86, 60, 40, 66, 83, 78, 74)), // climber
  rider('li-stuyven', 'Jasper Struyve', 'Belgium', 31, 't-lido', stats(34, 78, 76, 80, 82, 78, 78)), // cobbles rouleur
  rider('li-nys', 'Thibau Nyssen', 'Belgium', 23, 't-lido', stats(52, 68, 66, 82, 78, 74, 66)), // young puncheur
  rider('li-simmons', 'Quinn Simmons', 'USA', 24, 't-lido', stats(58, 74, 60, 68, 80, 76, 72)), // rouleur domestique

  // --- Astara Cycling (GC / climbing squad) ---
  rider('as-lopez', 'Miguel Lópes', 'Colombia', 30, 't-astara', stats(88, 62, 42, 68, 85, 80, 74)), // climber
  rider('as-vlasov', 'Alexei Vlassenko', 'Kazakhstan', 28, 't-astara', stats(86, 84, 44, 68, 86, 82, 80)), // GC climber / rouleur
  rider('as-fedorov', 'Yevgen Fedirko', 'Ukraine', 24, 't-astara', stats(58, 66, 60, 80, 80, 76, 72)), // puncheur
  rider('as-scaroni', 'Cristian Scaroni', 'Italy', 28, 't-astara', stats(74, 72, 50, 66, 82, 78, 72)), // rouleur / climbing domestique
  rider('as-nibali', 'Vito Nibaldi', 'Italy', 32, 't-astara', stats(82, 70, 48, 70, 84, 80, 78)), // all-rounder / descender
  rider('as-gruzdev', 'Dmitri Gruzdov', 'Kazakhstan', 26, 't-astara', stats(32, 62, 87, 58, 70, 68, 76)), // sprinter
];

export const RIDERS_BY_ID: Map<string, Rider> = new Map(RIDERS.map((r) => [r.id, r]));
