export interface GeneratedTeamName {
  name: string;
  shortName: string;
}

export interface TeamCaricature extends GeneratedTeamName {
  country: string;
}

export const WORLD_TEAM_CARICATURES: readonly TeamCaricature[] = [
  { name: 'Vismar Lease-a-Velo', shortName: 'VLV', country: 'Netherlands' },
  { name: 'Desert Crown Emirates', shortName: 'DCE', country: 'United Arab Emirates' },
  { name: 'Aeneos Grenadiers', shortName: 'AEN', country: 'United Kingdom' },
  { name: 'Lydl-Trekker', shortName: 'LTK', country: 'Germany' },
  { name: 'Crimson Bull-Bora', shortName: 'CBB', country: 'Germany' },
  { name: 'Sudal Fast-Steppe', shortName: 'SFS', country: 'Belgium' },
  { name: 'Alpecen-Deceunox', shortName: 'APD', country: 'Belgium' },
  { name: 'Groupe-Ami FDJolie', shortName: 'GAF', country: 'France' },
  { name: 'Decathlong AG2C', shortName: 'DAG', country: 'France' },
  { name: 'MoviStarlet', shortName: 'MOV', country: 'Spain' },
];

export const PRO_TEAM_CARICATURES: readonly TeamCaricature[] = [
  { name: 'Bahrein Glorious', shortName: 'BHG', country: 'Bahrain' },
  { name: 'Jaybird Alula', shortName: 'JAY', country: 'Australia' },
  { name: 'XDS Astanova', shortName: 'XDS', country: 'Kazakhstan' },
  { name: 'EF EasyPostgrad', shortName: 'EFE', country: 'United States' },
  { name: 'Picnic PosteNL', shortName: 'PPN', country: 'Netherlands' },
  { name: 'Intermarch Want-More', shortName: 'IWM', country: 'Belgium' },
  { name: 'Cofidish Credits', shortName: 'COF', country: 'France' },
  { name: 'Uno-Ex Mobility', shortName: 'UXM', country: 'Norway' },
  { name: 'Tudor Clockwork', shortName: 'TUD', country: 'Switzerland' },
  { name: 'Q36 Point-Five', shortName: 'QPF', country: 'Switzerland' },
  { name: 'Lotto Destiny', shortName: 'LTD', country: 'Belgium' },
];

export const GENERATED_TEAM_NAMES: GeneratedTeamName[] = [
  { name: 'Alpine Foundry', shortName: 'ALF' }, { name: 'Aster Union', shortName: 'AST' },
  { name: 'Baltic Relay', shortName: 'BLT' }, { name: 'Cinder Velo', shortName: 'CDV' },
  { name: 'Cobalt Roads', shortName: 'CBR' }, { name: 'Delta Rouleurs', shortName: 'DLR' },
  { name: 'Ember Racing', shortName: 'EMB' }, { name: 'Fjord Tempo', shortName: 'FJT' },
  { name: 'Granite Wheelworks', shortName: 'GRW' }, { name: 'Helio Sport', shortName: 'HEL' },
  { name: 'Ironleaf Cycling', shortName: 'ILC' }, { name: 'Juniper Course', shortName: 'JNC' },
  { name: 'Kestrel Works', shortName: 'KSW' }, { name: 'Lumen Peloton', shortName: 'LUM' },
  { name: 'Mistral Collective', shortName: 'MST' }, { name: 'Northline Racing', shortName: 'NLR' },
  { name: 'Orchid Velo', shortName: 'ORC' }, { name: 'Pioneer Chain', shortName: 'PNR' },
  { name: 'Quartz Cycling', shortName: 'QTZ' }, { name: 'Redwood Tempo', shortName: 'RWT' },
  { name: 'Solstice Sport', shortName: 'SOL' }, { name: 'Tandem Forge', shortName: 'TNF' },
  { name: 'Umber Racing', shortName: 'UMB' }, { name: 'Verde Course', shortName: 'VRC' },
  { name: 'Westwind Velo', shortName: 'WWV' }, { name: 'Yield Cycling', shortName: 'YLD' },
];

export interface GeneratedPalette {
  primary: number;
  accent: number;
}

export const GENERATED_TEAM_PALETTES: GeneratedPalette[] = [
  { primary: 0xd73a49, accent: 0xffffff }, { primary: 0x167d8d, accent: 0xffffff },
  { primary: 0xf0b429, accent: 0x17191c }, { primary: 0x3f6fd8, accent: 0xffffff },
  { primary: 0x2f9e44, accent: 0xffffff }, { primary: 0xc05a18, accent: 0xffffff },
  { primary: 0x8e4ec6, accent: 0xffffff }, { primary: 0x087f5b, accent: 0xffffff },
  { primary: 0xe03131, accent: 0xffffff }, { primary: 0x5c7cfa, accent: 0xffffff },
  { primary: 0x9c6b30, accent: 0xffffff }, { primary: 0x0b7285, accent: 0xffffff },
  { primary: 0xa61e4d, accent: 0xffffff }, { primary: 0x5f8f22, accent: 0xffffff },
  { primary: 0xe67700, accent: 0x17191c }, { primary: 0x364fc7, accent: 0xffffff },
  { primary: 0x2b8a3e, accent: 0xffffff }, { primary: 0xc92a2a, accent: 0xffffff },
  { primary: 0x6741d9, accent: 0xffffff }, { primary: 0x1098ad, accent: 0x17191c },
  { primary: 0xf08c00, accent: 0x17191c }, { primary: 0x1864ab, accent: 0xffffff },
  { primary: 0x862e9c, accent: 0xffffff }, { primary: 0x37b24d, accent: 0x17191c },
];