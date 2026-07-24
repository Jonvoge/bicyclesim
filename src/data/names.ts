/**
 * Proxy name pools for generating new riders each season (Phase 6, SPEC §9 —
 * recognisable-but-renamed, never real riders). Combined first + last name with a
 * matching-ish nationality; the pools are deliberately broad so the peloton keeps
 * refreshing without obvious repeats over a long dynasty.
 */

export const FIRST_NAMES: string[] = [
  'Matteo', 'Luca', 'Tobias', 'Ewan', 'Kasper', 'Mads', 'Florian', 'Silas', 'Arne', 'Bastien',
  'Nilo', 'Youri', 'Dario', 'Emrik', 'Joren', 'Aitor', 'Pelle', 'Ruben', 'Timeo', 'Iker',
  'Gustav', 'Milan', 'Sander', 'Elias', 'Noa', 'Tijl', 'Cian', 'Marek', 'Vito', 'Andris',
  'Lenny', 'Otto', 'Nando', 'Björn', 'Cesar', 'Remy', 'Kai', 'Damien', 'Sten', 'Lorenzo',
];

export const LAST_NAMES: string[] = [
  'Verbeke', 'Halloran', 'Ricci', 'Brennan', 'Sørup', 'Kessler', 'Duval', 'Novak', 'Aandal', 'Beckmann',
  'Costa', 'Vermeer', 'Salvi', 'Kowalczyk', 'Ferreira', 'Lindqvist', 'Moretz', 'Haugen', 'Petrov', 'Marchand',
  'Ibarra', 'Dekker', 'Colombo', 'Rasmus', 'Vietto', 'Engen', 'Bracco', 'Nystrom', 'Delacroix', 'Fontana',
  'Berg', 'Okonkwo', 'Suárez', 'Mikkel', 'Trentin', 'Barlow', 'Roux', 'Vasyl', 'Steiner', 'Pardo',
];

export const NATIONALITIES: string[] = [
  'Italy', 'Belgium', 'France', 'Spain', 'Netherlands', 'Denmark', 'Norway', 'Germany', 'UK', 'Slovenia',
  'Colombia', 'Switzerland', 'Portugal', 'Australia', 'USA', 'Ireland', 'Poland', 'Sweden', 'Austria', 'Ecuador',
];
