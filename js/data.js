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
    wall: 0x2a2622,
  },
  {
    id: 'durer', accession: 'AIA.1513.002', style: 'durer',
    image: 'assets/paintings/knight-death-devil.jpg',
    hd: 'assets/paintings/hd/knight-death-devil.jpg',
    depth: 'assets/paintings/depth/knight-death-devil.png',
    size: [1847, 2400], realWidth: 1.45,
    hosts: ['durer-horse', 'durer-dog'],
    wall: 0x24231f,
  },
  {
    id: 'marc', accession: 'AIA.1913.003', style: 'marc',
    image: 'assets/paintings/fate-of-the-animals.jpg',
    hd: 'assets/paintings/hd/fate-of-the-animals.jpg',
    depth: 'assets/paintings/depth/fate-of-the-animals.png',
    size: [2385, 1783], realWidth: 2.4,
    hosts: ['marc-deer', 'marc-boar'],
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
  'durer-horse':  { faces: 'left', inPlace: true },
  'durer-dog':    { faces: 'left' },
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
  { id: 'domestic_cat', file: 'domestic_cat_236808539', faces: 'right', doodle: ['cat'] },
  { id: 'domestic_dog', file: 'domestic_dog_251913625', faces: 'right', doodle: ['dog'] },
  { id: 'rabbit',       file: 'rabbit_78502673',        faces: 'left',  doodle: ['rabbit'], gait: 'hop' },
  { id: 'red_deer',     file: 'red_deer_10941056',      faces: 'left',  doodle: ['giraffe', 'camel', 'kangaroo'] },
  { id: 'horse',        file: 'horse_121483510',        faces: 'left',  doodle: ['horse', 'cow', 'zebra'] },
  { id: 'red_fox',      file: 'red_fox_2262475',        faces: 'left',  doodle: ['raccoon'] },
  { id: 'red_squirrel', file: 'red_squirrel_171989381', faces: 'right', doodle: ['squirrel', 'mouse'] },
  { id: 'hedgehog',     file: 'hedgehog_203070926',     faces: 'right', doodle: ['hedgehog'] },
  { id: 'owl',          file: 'owl_324147361',          faces: 'right', doodle: ['owl', 'bird', 'parrot', 'duck'], gait: 'hop' },
  { id: 'brown_bear',   file: 'brown_bear_24160860',    faces: 'right', doodle: ['bear', 'teddy-bear', 'panda'] },
  { id: 'grey_wolf',    file: 'grey_wolf_4909114',      faces: 'right', doodle: [] },
  { id: 'lion',         file: 'lion_236419',            faces: 'left',  doodle: ['lion'] },
  { id: 'tiger',        file: 'tiger_50541307',         faces: 'right', doodle: ['tiger'] },
].map(s => ({
  ...s,
  original: `assets/animals/originals/${s.file}.png`,
  cutout: `assets/animals/cutouts/${s.file}.png`,
  storybook: `assets/animals/storybook/${s.file}.png`,
  glb: `assets/animals/glb/${s.file}.glb`,
  glbStorybook: `assets/animals/glb-storybook/${s.file}.glb`,
}));

export const workById = id => WORKS.find(w => w.id === id);
export const speciesById = id => SPECIES.find(s => s.id === id);
