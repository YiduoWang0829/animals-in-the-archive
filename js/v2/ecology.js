// Animal kinds of the collection: names, real size, and how they get along.
// Used by the conversation (who is afraid of whom), the camera (how tall the visitor
// is), the collage (a cat will not stand next to a wolf) and the sculpture.

export const KIND = {
  //            en            zh        realH (m, standing)  group
  cat:      { en: 'cat',      zh: '猫',     h: 0.3,  g: 'small' },
  dog:      { en: 'dog',      zh: '狗',     h: 0.6,  g: 'home' },
  horse:    { en: 'horse',    zh: '马',     h: 1.65, g: 'home' },
  cattle:   { en: 'ox',       zh: '牛',     h: 1.5,  g: 'home' },
  sheep:    { en: 'sheep',    zh: '羊',     h: 0.9,  g: 'home' },
  goat:     { en: 'goat',     zh: '山羊',   h: 0.8,  g: 'home' },
  deer:     { en: 'deer',     zh: '鹿',     h: 1.3,  g: 'wild' },
  lion:     { en: 'lion',     zh: '狮子',   h: 1.1,  g: 'wild' },
  tiger:    { en: 'tiger',    zh: '老虎',   h: 1.0,  g: 'wild' },
  leopard:  { en: 'leopard',  zh: '豹子',   h: 0.7,  g: 'wild' },
  bear:     { en: 'bear',     zh: '熊',     h: 1.25, g: 'wild' },
  wolf:     { en: 'wolf',     zh: '狼',     h: 0.85, g: 'wild' },
  fox:      { en: 'fox',      zh: '狐狸',   h: 0.45, g: 'wild' },
  rabbit:   { en: 'rabbit',   zh: '兔子',   h: 0.25, g: 'small' },
  monkey:   { en: 'monkey',   zh: '猴子',   h: 0.6,  g: 'wild' },
  elephant: { en: 'elephant', zh: '大象',   h: 3.0,  g: 'wild' },
  giraffe:  { en: 'giraffe',  zh: '长颈鹿', h: 5.0,  g: 'wild' },
  camel:    { en: 'camel',    zh: '骆驼',   h: 2.1,  g: 'home' },
  donkey:   { en: 'donkey',   zh: '驴',     h: 1.3,  g: 'home' },
  pig:      { en: 'pig',      zh: '猪',     h: 0.8,  g: 'home' },
  bird:     { en: 'bird',     zh: '小鸟',   h: 0.15, g: 'bird' },
  owl:      { en: 'owl',      zh: '猫头鹰', h: 0.35, g: 'bird' },
  eagle:    { en: 'eagle',    zh: '鹰',     h: 0.8,  g: 'bird' },
  duck:     { en: 'duck',     zh: '鸭子',   h: 0.4,  g: 'bird' },
  rooster:  { en: 'rooster',  zh: '公鸡',   h: 0.5,  g: 'bird' },
  peacock:  { en: 'peacock',  zh: '孔雀',   h: 1.1,  g: 'bird' },
  parrot:   { en: 'parrot',   zh: '鹦鹉',   h: 0.35, g: 'bird' },
  crane:    { en: 'crane',    zh: '鹤',     h: 1.3,  g: 'bird' },
  fish:     { en: 'fish',     zh: '鱼',     h: 0.2,  g: 'water' },
  squirrel: { en: 'squirrel', zh: '松鼠',   h: 0.22, g: 'small' },
  frog:     { en: 'frog',     zh: '青蛙',   h: 0.08, g: 'water' },
  hedgehog: { en: 'hedgehog', zh: '刺猬',   h: 0.15, g: 'small' },
  zebra:    { en: 'zebra',    zh: '斑马',   h: 1.45, g: 'wild' },
  alpaca:   { en: 'alpaca',   zh: '羊驼',   h: 1.0,  g: 'home' },
  animal:   { en: 'animal',   zh: '动物',   h: 0.8,  g: 'wild' },
};

// DoodleNet classes (a drawing) → kind
export const DOODLE_KIND = {
  cat: 'cat', dog: 'dog', horse: 'horse', cow: 'cattle', sheep: 'sheep', giraffe: 'giraffe', elephant: 'elephant',
  camel: 'camel', lion: 'lion', tiger: 'tiger', bear: 'bear', 'teddy-bear': 'bear', panda: 'bear', rabbit: 'rabbit',
  monkey: 'monkey', pig: 'pig', bird: 'bird', owl: 'owl', duck: 'duck', parrot: 'parrot', flamingo: 'crane',
  swan: 'duck', fish: 'fish', shark: 'fish', whale: 'fish', dolphin: 'fish', frog: 'frog', squirrel: 'squirrel',
  mouse: 'squirrel', hedgehog: 'hedgehog', zebra: 'zebra', kangaroo: 'deer', raccoon: 'fox', rhinoceros: 'elephant',
  crocodile: 'frog', snake: 'frog', spider: 'frog', butterfly: 'bird', bee: 'bird', penguin: 'duck', bat: 'bird',
  dragon: 'lion', octopus: 'fish', lobster: 'fish', crab: 'fish', snail: 'frog', ant: 'frog', mosquito: 'bird',
  scorpion: 'frog', 'sea turtle': 'frog',
};

// who eats whom (in the wild): predator → prey
const EATS = {
  lion: ['cat', 'deer', 'horse', 'cattle', 'sheep', 'goat', 'donkey', 'pig', 'zebra', 'giraffe', 'camel', 'monkey', 'rabbit', 'dog', 'alpaca'],
  tiger: ['cat', 'deer', 'horse', 'cattle', 'sheep', 'goat', 'donkey', 'pig', 'monkey', 'rabbit', 'dog', 'peacock', 'alpaca'],
  leopard: ['deer', 'goat', 'sheep', 'monkey', 'rabbit', 'bird', 'pig', 'dog', 'peacock', 'fox', 'cat'],
  wolf: ['cat', 'sheep', 'goat', 'deer', 'rabbit', 'cattle', 'pig', 'fox', 'donkey', 'alpaca', 'rooster', 'squirrel'],
  bear: ['fish', 'deer', 'rabbit', 'pig', 'sheep', 'squirrel'],
  fox: ['rabbit', 'rooster', 'duck', 'bird', 'squirrel', 'frog', 'hedgehog'],
  cat: ['bird', 'fish', 'rabbit', 'squirrel', 'frog', 'duck', 'parrot'],
  dog: ['rabbit', 'squirrel', 'rooster', 'duck'],
  eagle: ['rabbit', 'fish', 'squirrel', 'duck', 'bird', 'monkey', 'hedgehog', 'frog', 'cat'],
  owl: ['bird', 'squirrel', 'frog', 'rabbit'],
  crane: ['fish', 'frog'],
  duck: ['fish', 'frog'],
  rooster: ['frog'],
  pig: ['frog'],
  hedgehog: ['frog'],
};
// who chases whom without eating (it is still frightening)
const CHASES = { dog: ['cat', 'fox', 'sheep', 'deer'], cat: ['rooster'], goat: ['dog'], elephant: ['lion', 'tiger'], horse: ['dog', 'wolf'] };
// small creatures that like to sit on a big one (oxpeckers on cattle, birds on a horse's back)
export const PERCHERS = new Set(['bird', 'parrot', 'owl', 'rooster', 'monkey', 'squirrel', 'frog', 'cat']);

export const kindName = (k, lang = 'en') => (KIND[k] || KIND.animal)[lang === 'zh' ? 'zh' : 'en'];
export const realH = k => (KIND[k] || KIND.animal).h;
export const eats = (a, b) => (EATS[a] || []).includes(b);
const CARNIVORES = new Set(['lion', 'tiger', 'leopard', 'wolf', 'bear', 'fox', 'eagle', 'owl']);
// a wild carnivore much bigger than you is frightening, whatever the table says
export const scares = (a, b) => eats(a, b) || (CHASES[a] || []).includes(b)
  || (CARNIVORES.has(a) && !CARNIVORES.has(b) && realH(a) > realH(b) * 1.8 && b !== 'elephant' && b !== 'giraffe');
export const isBird = k => (KIND[k] || {}).g === 'bird';

// how two kinds feel about each other, from b's side: 'fear' | 'hunt' | 'herd' | 'perch' | 'calm'
export function relation(a, b) {
  if (a === b) return 'herd';
  if (scares(a, b)) return 'fear';          // b is afraid of a
  if (scares(b, a)) return 'hunt';          // b wants a
  if (PERCHERS.has(b) && realH(a) > realH(b) * 4) return 'perch';
  const ga = (KIND[a] || {}).g, gb = (KIND[b] || {}).g;
  if (ga === gb && ga !== 'wild') return 'herd';
  return 'calm';
}
