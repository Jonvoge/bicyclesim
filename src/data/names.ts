import type { RiderArchetype } from './worldTemplates.ts';

/** Curated proxy cycling names. Each culture stays internally coherent so the
 * generated peloton reads as a cast of regional cycling caricatures rather than
 * arbitrary first/surname collisions. None represent real riders. */
export interface RiderNameCulture {
  nationality: string;
  firstNames: readonly string[];
  lastNames: readonly string[];
}

export interface WorldRiderCaricature {
  name: string;
  nationality: string;
  archetypes: readonly RiderArchetype[];
}

export const WORLD_RIDER_CARICATURES: readonly WorldRiderCaricature[] = [
  { name: 'Tadeo Pogacik', nationality: 'Slovenia', archetypes: ['gcClimber', 'puncheur'] },
  { name: 'Jonas Wingegaard', nationality: 'Denmark', archetypes: ['gcClimber', 'pureClimber'] },
  { name: 'Remy Evenapool', nationality: 'Belgium', archetypes: ['gcClimber', 'rouleur', 'domestique'] },
  { name: 'Primo Roglitch', nationality: 'Slovenia', archetypes: ['gcClimber', 'puncheur'] },
  { name: 'Joao Almeira', nationality: 'Portugal', archetypes: ['gcClimber'] },
  { name: 'Juan Ayusso', nationality: 'Spain', archetypes: ['gcClimber', 'pureClimber'] },
  { name: 'Adam Yeats', nationality: 'United Kingdom', archetypes: ['gcClimber', 'puncheur'] },
  { name: 'Simon Yeats', nationality: 'United Kingdom', archetypes: ['gcClimber', 'pureClimber'] },
  { name: 'Richard Carapazzo', nationality: 'Ecuador', archetypes: ['pureClimber', 'breakaway'] },
  { name: 'Enric Masso', nationality: 'Spain', archetypes: ['gcClimber'] },
  { name: 'Carlos Rodrigez', nationality: 'Spain', archetypes: ['gcClimber'] },
  { name: 'Felix Gallo', nationality: 'Austria', archetypes: ['pureClimber'] },
  { name: 'David Gaudulet', nationality: 'France', archetypes: ['pureClimber'] },
  { name: 'Santiago Buitrago', nationality: 'Colombia', archetypes: ['pureClimber', 'breakaway'] },
  { name: 'Mikel Landara', nationality: 'Spain', archetypes: ['pureClimber'] },
  { name: 'Jai Hindler', nationality: 'Australia', archetypes: ['gcClimber'] },
  { name: 'Sepp Kussler', nationality: 'United States', archetypes: ['pureClimber', 'domestique'] },
  { name: 'Giulio Ciccone', nationality: 'Italy', archetypes: ['pureClimber', 'puncheur'] },
  { name: "Ben O'Conner", nationality: 'Australia', archetypes: ['gcClimber', 'breakaway'] },
  { name: 'Aleks Vlasson', nationality: 'Russia', archetypes: ['gcClimber'] },
  { name: 'Matthijs Van der Pool', nationality: 'Netherlands', archetypes: ['puncheur', 'sprinter'] },
  { name: 'Wout Van Art', nationality: 'Belgium', archetypes: ['puncheur', 'rouleur'] },
  { name: 'Tom Pickock', nationality: 'United Kingdom', archetypes: ['puncheur', 'pureClimber'] },
  { name: 'Julian Alaflamme', nationality: 'France', archetypes: ['puncheur'] },
  { name: 'Marc Hirscher', nationality: 'Switzerland', archetypes: ['puncheur'] },
  { name: 'Benoit Cosnefroid', nationality: 'France', archetypes: ['puncheur'] },
  { name: 'Max Schachmann', nationality: 'Germany', archetypes: ['puncheur'] },
  { name: 'Dylann Teunson', nationality: 'Belgium', archetypes: ['puncheur'] },
  { name: 'Michael Woodsy', nationality: 'Canada', archetypes: ['puncheur', 'pureClimber'] },
  { name: 'Romain Gregoire', nationality: 'France', archetypes: ['puncheur'] },
  { name: 'Quinn Simonson', nationality: 'United States', archetypes: ['puncheur', 'breakaway'] },
  { name: 'Mauro Hirschi', nationality: 'Switzerland', archetypes: ['puncheur'] },
  { name: 'Kasper Philipson', nationality: 'Belgium', archetypes: ['sprinter'] },
  { name: 'Jonathan Milanno', nationality: 'Italy', archetypes: ['sprinter'] },
  { name: 'Tim Merlien', nationality: 'Belgium', archetypes: ['sprinter'] },
  { name: 'Olav Koij', nationality: 'Netherlands', archetypes: ['sprinter'] },
  { name: 'Biniam Girmai', nationality: 'Eritrea', archetypes: ['sprinter', 'puncheur'] },
  { name: 'Sam Bennetson', nationality: 'Ireland', archetypes: ['sprinter'] },
  { name: 'Fabio Jacobsen', nationality: 'Netherlands', archetypes: ['sprinter'] },
  { name: 'Arnaud Demarre', nationality: 'France', archetypes: ['sprinter'] },
  { name: 'Caleb Ewens', nationality: 'Australia', archetypes: ['sprinter'] },
  { name: 'Dylan Groenwegen', nationality: 'Netherlands', archetypes: ['sprinter'] },
  { name: 'Jordi Meeusen', nationality: 'Belgium', archetypes: ['sprinter'] },
  { name: 'Pascal Ackerman', nationality: 'Germany', archetypes: ['sprinter'] },
  { name: 'Filippo Ganno', nationality: 'Italy', archetypes: ['rouleur'] },
  { name: 'Stefan Kueng', nationality: 'Switzerland', archetypes: ['rouleur'] },
  { name: 'Joshua Tarling', nationality: 'United Kingdom', archetypes: ['rouleur'] },
  { name: 'Remi Cavagno', nationality: 'France', archetypes: ['rouleur'] },
  { name: 'Mats Pederson', nationality: 'Denmark', archetypes: ['rouleur', 'puncheur'] },
  { name: 'Stefan Bissegger', nationality: 'Switzerland', archetypes: ['rouleur'] },
  { name: 'Victor Campenaert', nationality: 'Belgium', archetypes: ['rouleur', 'breakaway'] },
  { name: 'Yves Lampert', nationality: 'Belgium', archetypes: ['rouleur'] },
  { name: 'Edoardo Affini', nationality: 'Italy', archetypes: ['rouleur', 'domestique'] },
  { name: 'Nelson Oliveira', nationality: 'Portugal', archetypes: ['rouleur', 'domestique'] },
  { name: 'Christophe Laporte', nationality: 'France', archetypes: ['leadout', 'domestique'] },
  { name: 'Matteo Trentino', nationality: 'Italy', archetypes: ['leadout', 'domestique'] },
  { name: 'Michael Morkoff', nationality: 'Denmark', archetypes: ['leadout', 'domestique'] },
  { name: 'Danny Van Poppel', nationality: 'Netherlands', archetypes: ['leadout', 'domestique'] },
  { name: 'Jasper Stuyven', nationality: 'Belgium', archetypes: ['leadout', 'domestique'] },
  { name: 'Tim DeClerc', nationality: 'Belgium', archetypes: ['leadout', 'domestique'] },
  { name: 'Nils Politt', nationality: 'Germany', archetypes: ['leadout', 'domestique'] },
  { name: 'Luke Rowen', nationality: 'United Kingdom', archetypes: ['leadout', 'domestique'] },
  { name: 'Matej Mohorik', nationality: 'Slovenia', archetypes: ['breakaway'] },
  { name: 'Magnus Cortsen', nationality: 'Denmark', archetypes: ['breakaway'] },
  { name: 'Alberto Bettiolo', nationality: 'Italy', archetypes: ['breakaway'] },
  { name: 'Ben Healy', nationality: 'Ireland', archetypes: ['breakaway'] },
  { name: 'Kasper Asgreen', nationality: 'Denmark', archetypes: ['breakaway'] },
  { name: 'Valentin Madouas', nationality: 'France', archetypes: ['breakaway'] },
  { name: 'Neilson Powless', nationality: 'United States', archetypes: ['breakaway'] },
  { name: 'Rui Costaro', nationality: 'Portugal', archetypes: ['breakaway'] },
  { name: 'Marc Solero', nationality: 'Spain', archetypes: ['domestique'] },
  { name: 'Pavel Sivakoff', nationality: 'France', archetypes: ['domestique'] },
  { name: 'Wilco Keldermann', nationality: 'Netherlands', archetypes: ['domestique'] },
  { name: 'Laurens De Plusse', nationality: 'Belgium', archetypes: ['domestique'] },
  { name: 'Jan Tratnick', nationality: 'Slovenia', archetypes: ['domestique'] },
  { name: 'Dylan Van Baarlen', nationality: 'Netherlands', archetypes: ['domestique'] },
  { name: 'Matteo Jorgenson', nationality: 'United States', archetypes: ['domestique'] },
  { name: 'Tao Hartley', nationality: 'United Kingdom', archetypes: ['domestique'] },
  { name: 'Geraint Thomason', nationality: 'United Kingdom', archetypes: ['domestique'] },
  { name: 'Bauke Mollemann', nationality: 'Netherlands', archetypes: ['domestique'] },
];

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