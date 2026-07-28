/** Curated proxy cycling names. Each culture stays internally coherent so the
 * generated peloton reads as a cast of regional cycling caricatures rather than
 * arbitrary first/surname collisions. None represent real riders. */
export interface RiderNameCulture {
  nationality: string;
  firstNames: readonly string[];
  lastNames: readonly string[];
}

export const RIDER_NAME_CULTURES: readonly RiderNameCulture[] = [
  { nationality: 'Belgium', firstNames: ['Jef', 'Staf', 'Rik', 'Seppe', 'Lowie', 'Bram', 'Wannes', 'Dries'], lastNames: ['Van Kassei', 'Vervaeke', 'De Kroon', 'Van Loen', 'Koppenberg', 'Vandamme', 'De Zwart', 'Verstraete', 'Van Pelt', 'Maesveld'] },
  { nationality: 'Colombia', firstNames: ['Camilo', 'Jairo', 'Esteban', 'Nicolas', 'Mateo', 'Santiago', 'Julian', 'Andres'], lastNames: ['Cumbre', 'Montoya', 'Quintero', 'Salazar', 'Paredes', 'Valderrama', 'Rincon', 'Cifuentes', 'Arboleda', 'Zambrano'] },
  { nationality: 'Denmark', firstNames: ['Mikkel', 'Asger', 'Lasse', 'Soren', 'Emil', 'Troels', 'Nikolaj', 'Frederik'], lastNames: ['Stormgaard', 'Vinter', 'Skovlund', 'Ravn', 'Holmgaard', 'Birkedal', 'Kjaer', 'Sonderby', 'Falkenberg', 'Mosegaard'] },
  { nationality: 'France', firstNames: ['Lucien', 'Remi', 'Bastien', 'Amaury', 'Gaspard', 'Theo', 'Loic', 'Clement'], lastNames: ['Delorme', 'Chasson', 'Beaulieu', 'Rochefort', 'Vautrin', 'Bellande', 'Montclair', 'Giraudon', 'Lacombe', 'Fournier'] },
  { nationality: 'Germany', firstNames: ['Florian', 'Hannes', 'Till', 'Konrad', 'Felix', 'Moritz', 'Lukas', 'Jannik'], lastNames: ['Kraftwerk', 'Steinbach', 'Kessler', 'Eisenhut', 'Waldner', 'Bruckmann', 'Vogelsang', 'Reinert', 'Albrecht', 'Dornfeld'] },
  { nationality: 'Ireland', firstNames: ['Cian', 'Ronan', 'Eamon', 'Fintan', 'Oisin', 'Darragh', 'Niall', 'Conall'], lastNames: ['Halloran', 'Kelleher', 'Finnerty', 'Moriarty', 'Doolan', 'Brennan', 'Flannery', 'Rafferty', 'Keegan', 'Sweeney'] },
  { nationality: 'Italy', firstNames: ['Enzo', 'Taddeo', 'Lorenzo', 'Vito', 'Dario', 'Nico', 'Matteo', 'Elio'], lastNames: ['Bellaforte', 'Montelupo', 'Bottega', 'Ventresca', 'Scalvino', 'Brancati', 'Ferrarini', 'Lombardi', 'Ravello', 'Cortese'] },
  { nationality: 'Netherlands', firstNames: ['Koen', 'Ties', 'Jurre', 'Boudewijn', 'Sjoerd', 'Niek', 'Thijs', 'Pim'], lastNames: ['Van Daal', 'De Ruiter', 'Windhorst', 'Van Bruggen', 'Kruiswijk', 'De Molen', 'Hoogland', 'Van Rijn', 'Boskamp', 'Veldhuis'] },
  { nationality: 'Norway', firstNames: ['Eirik', 'Sindre', 'Torbjorn', 'Magnus', 'Hakon', 'Oskar', 'Anders', 'Knut'], lastNames: ['Fjell', 'Nordhagen', 'Solberg', 'Havik', 'Brekke', 'Lindstrom', 'Aasheim', 'Skarstad', 'Vikdal', 'Torgersen'] },
  { nationality: 'Poland', firstNames: ['Marek', 'Witold', 'Jakub', 'Bartosz', 'Tomasz', 'Kacper', 'Piotr', 'Maciej'], lastNames: ['Kowalik', 'Zielonka', 'Brzezny', 'Walczak', 'Krawiec', 'Mazurczyk', 'Nowowiejski', 'Sobczak', 'Lisowski', 'Bednarek'] },
  { nationality: 'Portugal', firstNames: ['Tiago', 'Nuno', 'Rui', 'Afonso', 'Duarte', 'Goncalo', 'Leandro', 'Miguel'], lastNames: ['Pedreira', 'Figueira', 'Valente', 'Loureiro', 'Correia', 'Madruga', 'Sequeira', 'Fonseca', 'Barroso', 'Tavares'] },
  { nationality: 'Slovenia', firstNames: ['Jure', 'Rok', 'Blaz', 'Miha', 'Anze', 'Luka', 'Ziga', 'Nejc'], lastNames: ['Kovarnik', 'Zupanc', 'Planinc', 'Kranjec', 'Vidmar', 'Rozman', 'Breznik', 'Dolenc', 'Kastelic', 'Mlakar'] },
  { nationality: 'Spain', firstNames: ['Iker', 'Xabier', 'Aitor', 'Unai', 'Gorka', 'Cesar', 'Nando', 'Ruben'], lastNames: ['Mendaza', 'Gorritxu', 'Serrano', 'Valcazar', 'Etxeberri', 'Montoro', 'Arrieta', 'Paredon', 'Llorente', 'Zubia'] },
  { nationality: 'Sweden', firstNames: ['Nils', 'Albin', 'Gustav', 'Ludvig', 'Stellan', 'Isak', 'Viggo', 'Arvid'], lastNames: ['Lindqvist', 'Nystrom', 'Berglund', 'Sundvall', 'Ekholm', 'Norberg', 'Falkman', 'Blomqvist', 'Hedstrom', 'Lagergren'] },
  { nationality: 'Switzerland', firstNames: ['Silvan', 'Loris', 'Fabian', 'Nino', 'Janis', 'Pascal', 'Reto', 'Gian'], lastNames: ['Amsler', 'Zurcher', 'Bergtal', 'Kellerhals', 'Sennwald', 'Furrer', 'Gisler', 'Baumann', 'Rothlin', 'Wenger'] },
  { nationality: 'United Kingdom', firstNames: ['Alfie', 'Rupert', 'Callum', 'Miles', 'Hugh', 'Oscar', 'Kit', 'Rowan'], lastNames: ['Spindle', 'Barlow', 'Fairweather', 'Cromwell', 'Hawthorn', 'Pritchard', 'Gearson', 'Whitlock', 'Ashdown', 'Cadence'] },
];

export const FIRST_NAMES = RIDER_NAME_CULTURES.flatMap((culture) => culture.firstNames);
export const LAST_NAMES = RIDER_NAME_CULTURES.flatMap((culture) => culture.lastNames);
export const NATIONALITIES = RIDER_NAME_CULTURES.map((culture) => culture.nationality);