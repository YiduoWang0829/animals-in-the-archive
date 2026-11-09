// Collection data (non-text). Text lives in js/strings.js.

// sizes are the HD images in assets/paintings/hd; `realWidth` is the hung width in
// metres in the gallery (proportional to the real works, slightly enlarged)
export const WORKS = [
  {
    id: 'eden', accession: 'AIA.1615.001', style: 'eden',
    image: 'assets/paintings/garden-of-eden.jpg',
    hd: 'assets/paintings/hd/garden-of-eden.jpg',
    depth: 'assets/paintings/depth/garden-of-eden.png',
    size: [2400, 1550], realWidth: 2.3,
    hosts: ['eden-lion', 'eden-horse', 'eden-deer', 'eden-rabbit', 'eden-dog', 'eden-peacock'],
    kinds: ['lion', 'tiger', 'horse', 'deer', 'dog', 'cat', 'rabbit', 'cattle', 'bird'],   // animal kinds painted in it
    ground: [0.2, 0.22],      // where the painted ground is: height (fraction of the picture) at the front, rise with depth
    wall: 0x2a2622,
  },
  {
    id: 'hicks', accession: 'AIA.1834.002', style: 'hicks',
    image: 'assets/paintings/peaceable-kingdom.jpg',
    hd: 'assets/paintings/hd/peaceable-kingdom.jpg',
    depth: 'assets/paintings/depth/peaceable-kingdom.png',
    size: [2400, 2002], realWidth: 2.0,
    hosts: ['hicks-lion', 'hicks-cub', 'hicks-calf', 'hicks-goat', 'hicks-leopard'],
    kinds: ['lion', 'wolf', 'cattle', 'bear'],
    ground: [0.1, 0.24],      // the dark earth the animals rest on, rising towards the trees
    wall: 0x26241f,
  },
  {
    id: 'marc', accession: 'AIA.1913.003', style: 'marc',
    image: 'assets/paintings/fate-of-the-animals.jpg',
    hd: 'assets/paintings/hd/fate-of-the-animals.jpg',
    depth: 'assets/paintings/depth/fate-of-the-animals.png',
    size: [2385, 1783], realWidth: 2.4,
    hosts: ['marc-deer', 'marc-boar'],
    kinds: ['deer'],
    ground: [0.06, 0.14],
    wall: 0x22252a,
  },
];

// Painted animals that can come alive. box = sprite rect in HD pixels (hosts.json).
// faces = where its head points; inPlace = too big / interlocked to walk away.
export const HOSTS = {
  'eden-lion':    { faces: 'left' },
  'eden-horse':   { faces: 'left' },
  'eden-deer':    { faces: 'left' },
  'eden-rabbit':  { faces: 'left' },
  'eden-dog':     { faces: 'left' },
  'eden-peacock': { faces: 'right' },
  'hicks-lion':    { faces: 'left', inPlace: true },
  'hicks-cub':     { faces: 'right' },
  'hicks-calf':    { faces: 'left' },
  'hicks-goat':    { faces: 'right' },
  'hicks-leopard': { faces: 'left' },
  'marc-deer':    { faces: 'left' },
  'marc-boar':    { faces: 'right' },
};
for (const [id, h] of Object.entries(HOSTS)) {
  h.id = id; h.sprite = `assets/hosts/${id}.webp`; h.patch = `assets/hosts/${id}-patch.jpg`; h.glb = `assets/hosts/glb/${id}.glb`;
}

// Visitor species. faces = direction of the head in the photograph.
// doodle = DoodleNet (QuickDraw) classes that count as this species.
// gait = force 'hop' for animals that hop rather than walk.
export const SPECIES = [
  { id: 'domestic_cat', kind: 'cat', file: 'domestic_cat_236808539', faces: 'right', doodle: ['cat'] },
  { id: 'domestic_dog', kind: 'dog', file: 'domestic_dog_251913625', faces: 'right', doodle: ['dog'] },
  { id: 'rabbit',       kind: 'rabbit', file: 'rabbit_78502673',        faces: 'left',  doodle: ['rabbit'], gait: 'hop' },
  { id: 'red_deer',     kind: 'deer', file: 'red_deer_10941056',      faces: 'left',  doodle: ['giraffe', 'camel', 'kangaroo'] },
  { id: 'horse',        kind: 'horse', file: 'horse_121483510',        faces: 'left',  doodle: ['horse', 'cow', 'zebra'] },
  { id: 'red_fox',      kind: 'fox', file: 'red_fox_2262475',        faces: 'left',  doodle: ['raccoon'] },
  { id: 'red_squirrel', kind: 'squirrel', file: 'red_squirrel_171989381', faces: 'right', doodle: ['squirrel', 'mouse'] },
  { id: 'hedgehog',     kind: 'hedgehog', file: 'hedgehog_203070926',     faces: 'right', doodle: ['hedgehog'] },
  { id: 'owl',          kind: 'bird', file: 'owl_324147361',          faces: 'right', doodle: ['owl', 'bird', 'parrot', 'duck'], gait: 'hop' },
  { id: 'brown_bear',   kind: 'bear', file: 'brown_bear_24160860',    faces: 'right', doodle: ['bear', 'teddy-bear', 'panda'] },
  { id: 'grey_wolf',    kind: 'wolf', file: 'grey_wolf_4909114',      faces: 'right', doodle: [] },
  { id: 'lion',         kind: 'lion', file: 'lion_236419',            faces: 'left',  doodle: ['lion'] },
  { id: 'tiger',        kind: 'tiger', file: 'tiger_50541307',         faces: 'right', doodle: ['tiger'] },
].map(s => ({
  ...s,
  original: `assets/animals/originals/${s.file}.png`,
  cutout: `assets/animals/cutouts/${s.file}.png`,
  storybook: `assets/animals/storybook/${s.file}.png`,
  glb: `assets/animals/glb/${s.file}.glb`,
  glbStorybook: `assets/animals/glb-storybook/${s.file}.glb`,
}));

// Rigged, animated 3D animals (Quaternius, CC0). height = metres in the gallery
// (kept relative to each other; slightly smaller than life to suit the room).
export const ANIMALS3D = [
  { id: 'fox', kind: 'fox',         height: 0.3,  doodle: ['raccoon', 'squirrel'] },
  { id: 'shiba_inu', kind: 'dog',   height: 0.34, doodle: ['dog'] },
  { id: 'husky', kind: 'dog',       height: 0.44, doodle: [] },
  { id: 'deer', kind: 'deer',        height: 0.56, doodle: ['kangaroo'] },
  { id: 'stag', kind: 'deer',        height: 0.66, doodle: [] },
  { id: 'alpaca', kind: 'alpaca',      height: 0.64, doodle: ['camel', 'giraffe'] },
  { id: 'donkey', kind: 'donkey',      height: 0.6,  doodle: [] },
  { id: 'white_horse', kind: 'horse', height: 0.8,  doodle: ['horse'] },
  { id: 'zebra', kind: 'zebra',       height: 0.74, doodle: ['zebra'] },
  { id: 'cow', kind: 'cattle',         height: 0.7,  doodle: ['cow'] },
  { id: 'bull', kind: 'cattle',        height: 0.76, doodle: [] },
].map(a => ({ ...a, glb: `assets/animals/3d/${a.id}.glb`, thumb: `assets/animals/3d/thumbs/${a.id}.webp` }));

export const workById = id => WORKS.find(w => w.id === id);
export const animal3dById = id => ANIMALS3D.find(a => a.id === id);
export const speciesById = id => SPECIES.find(s => s.id === id);
