import { msg } from '@lit/localize';
export { BUILDING_TYPE_SET } from './building-types';

export const BUILDING_TYPE_IDS = [
  'Q3947',      // house
  'Q489357',    // farmhouse
  'Q13402009',  // apartment building
  'Q1307276',   // single-family detached home
  'Q16970',     // church building
  'Q108325',    // chapel
  'Q44613',     // monastery
  'Q34627',     // synagogue
  'Q1244442',   // school building
  'Q25550691',  // city hall
  'Q44494',     // mill
  'Q879050',    // manor house
  'Q16823155',  // Schloss
  'Q23413',     // castle
  'Q17715832',  // castle ruin
  'Q615810',    // water castle
  'Q1662011',   // industrial building
  'Q5526694',   // Gasthaus
  'Q1339195',   // station building
];

export function getBuildingTypeLabel(id: string): string {
  switch (id) {
    case 'Q41176': return msg('Gebäude');
    case 'Q3947': return msg('Wohnhaus');
    case 'Q489357': return msg('Bauernhaus');
    case 'Q13402009': return msg('Mehrfamilienhaus');
    case 'Q1307276': return msg('Einfamilienhaus');
    case 'Q16970': return msg('Kirchengebäude');
    case 'Q108325': return msg('Kapelle');
    case 'Q44613': return msg('Kloster');
    case 'Q34627': return msg('Synagoge');
    case 'Q1244442': return msg('Schulgebäude');
    case 'Q25550691': return msg('Rathaus');
    case 'Q44494': return msg('Mühle');
    case 'Q1303167': return msg('Scheune');
    case 'Q1207909': return msg('Stall');
    case 'Q1362225': return msg('Speicher');
    case 'Q879050': return msg('Herrenhaus');
    case 'Q16823155': return msg('Schloss');
    case 'Q23413': return msg('Burg');
    case 'Q17715832': return msg('Burgruine');
    case 'Q615810': return msg('Wasserschloss');
    case 'Q1662011': return msg('Fabrikgebäude');
    case 'Q656720': return msg('Werkstatt');
    case 'Q5526694': return msg('Gasthaus');
    case 'Q1339195': return msg('Bahnhofsgebäude');
    default: return id;
  }
}

export const OHM_TAG_TO_BUILDING_TYPE_ID: Record<string, string> = {
  house:              'Q1307276',
  detached:           'Q1307276',
  semidetached_house: 'Q1307276',
  terrace:            'Q1307276',
  residential:        'Q3947',
  apartments:         'Q13402009',
  farm:               'Q489357',
  barn:               'Q1303167',
  stable:             'Q1207909',
  warehouse:          'Q1362225',
  church:             'Q16970',
  chapel:             'Q108325',
  monastery:          'Q44613',
  synagogue:          'Q34627',
  school:             'Q1244442',
  mill:               'Q44494',
  windmill:           'Q44494',
  manor:              'Q879050',
  palace:             'Q16823155',
  castle:             'Q23413',
  fort:               'Q23413',
  industrial:         'Q1662011',
  factory:            'Q1662011',
  workshop:           'Q656720',
  hotel:              'Q5526694',
  inn:                'Q5526694',
  train_station:      'Q1339195',
};
