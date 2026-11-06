// Collection data (non-text). Text for each work lives in js/strings.js → works.
// Coordinates are fractions of the painting's width / height.

export const WORKS = [
  {
    id: 'eden',
    accession: 'AIA.1615.001',
    image: 'assets/paintings/garden-of-eden.jpg',
    size: [960, 620],
    style: 'eden',                       // painterly treatment key (js/paint.js)
    host: {
      id: 'eden-lion',
      sprite: 'assets/sprites/eden-lion.png',
      plate: 'assets/sprites/eden-lion-plate.jpg',
      glb: 'assets/sprites/glb/eden-lion.glb',
      box: [687, 346, 785, 452],          // pixels in the painting (sprites.json)
    },
    // visitor walks in from `side` and stops with its feet at `end`
    entry: { side: 'left', end: [0.6, 0.715], width: 0.1 },
  },
  {
    id: 'durer',
    accession: 'AIA.1513.002',
    image: 'assets/paintings/knight-death-devil.jpg',
    size: [960, 1247],
    style: 'durer',
    host: {
      id: 'durer-dog',
      sprite: 'assets/sprites/durer-dog.png',
      plate: 'assets/sprites/durer-dog-plate.jpg',
      glb: 'assets/sprites/glb/durer-dog.glb',
      box: [431, 890, 654, 1044],
    },
    entry: { side: 'left', end: [0.27, 0.975], width: 0.24 },
  },
  {
    id: 'marc',
    accession: 'AIA.1913.003',
    image: 'assets/paintings/fate-of-the-animals.jpg',
    size: [960, 718],
    style: 'marc',
    host: {
      id: 'marc-deer',
      sprite: 'assets/sprites/marc-deer.png',
      plate: 'assets/sprites/marc-deer-plate.jpg',
      glb: 'assets/sprites/glb/marc-deer.glb',
      box: [375, 272, 573, 693],
    },
    entry: { side: 'right', end: [0.77, 0.975], width: 0.21 },
  },
];

// Visitor species. `faces` = direction the head points in the photograph.
// `doodle` = DoodleNet (QuickDraw) classes that count as this species.
export const SPECIES = [
  { id: 'brown_bear', file: 'brown_bear_24160860', faces: 'right', doodle: ['bear', 'teddy-bear', 'panda'] },
  { id: 'grey_wolf',  file: 'grey_wolf_4909114',  faces: 'right', doodle: ['dog'] },
  { id: 'lion',       file: 'lion_236419',        faces: 'left',  doodle: ['lion'] },
  { id: 'red_deer',   file: 'red_deer_10941056',  faces: 'left',  doodle: ['horse', 'giraffe', 'camel', 'cow', 'kangaroo'] },
  { id: 'red_fox',    file: 'red_fox_2262475',    faces: 'left',  doodle: ['raccoon', 'squirrel'] },
  { id: 'tiger',      file: 'tiger_50541307',     faces: 'right', doodle: ['tiger', 'cat'] },
].map(s => ({
  ...s,
  original: `assets/animals/originals/${s.file}.png`,
  cutout: `assets/animals/cutouts/${s.file}.png`,
  glb: `assets/animals/glb/${s.file}.glb`,
}));

export const workById = id => WORKS.find(w => w.id === id);
export const speciesById = id => SPECIES.find(s => s.id === id);
