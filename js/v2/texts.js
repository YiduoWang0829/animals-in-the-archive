// Words for the 200 works of the collection, written from each work's own record
// (title, artist, date, museum, style, the animals found in it) in English and Chinese.
// They are added to STRINGS under the same keys the three original works use
// (works.<id>, crossTime.<id>, answerHost.<id>, hostNames.<host>, hostLife.<host>),
// so the conversation runs the same way in every painting. French and Korean fall back
// to English for these generated lines.

import { STRINGS } from '../strings.js';
import { KIND, kindName, eats, scares, isBird } from './ecology.js';

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
const listEn = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const listZh = a => a.join('、');
const article = w => /^[aeiou]/i.test(w) ? 'an ' + w : 'a ' + w;
const plural = w => /(sheep|fish|deer)$/.test(w) ? w : /ox$/.test(w) ? w + 'en' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's';

// the voice of each kind of picture: its light, its time, what never happens in it
const VOICE = {
  early:    { en: { name: 'a painting older than printed books', light: 'gold leaf behind us instead of a sky', still: 'Everything in here is holy and very patient.' },
              zh: { name: '一幅比印刷书还古老的画', light: '我们身后没有天空，只有金箔', still: '这里的一切都很神圣，也很有耐心。' } },
  baroque:  { en: { name: 'an old master oil painting', light: 'one warm light from the left, and deep brown shadows', still: 'The varnish keeps everything golden, like honey.' },
              zh: { name: '一幅古典大师的油画', light: '一束从左边来的暖光，和深棕色的阴影', still: '光油把一切都封成了金色，像蜂蜜一样。' } },
  romantic: { en: { name: 'a romantic painting', light: 'a dramatic sky that is always about to storm', still: 'The storm has been coming for two hundred years. It never arrives.' },
              zh: { name: '一幅浪漫主义的画', light: '一片永远快要下暴雨的天空', still: '暴风雨已经来了两百年，却从来没有落下。' } },
  realist:  { en: { name: 'a realist painting', light: 'ordinary daylight, exactly as the painter saw it', still: 'It is an ordinary afternoon, kept forever.' },
              zh: { name: '一幅写实主义的画', light: '平常的日光，和画家看到的一模一样', still: '这是一个普通的下午，被永远留住了。' } },
  impressionist: { en: { name: 'an impressionist painting', light: 'light that flickers, made of quick little strokes', still: 'Up close we are only dabs of colour. Step back and we appear.' },
              zh: { name: '一幅印象派的画', light: '闪烁的光，全是快速的小笔触', still: '凑近看，我们只是一块块颜色；退后一步，我们才出现。' } },
  pointillist: { en: { name: 'a painting made of dots', light: 'thousands of tiny dots of pure colour', still: 'I am made of dots. Your eyes do the mixing.' },
              zh: { name: '一幅由小点组成的画', light: '成千上万个纯色的小点', still: '我是由小点组成的，颜色是在你的眼睛里混合的。' } },
  postimpressionist: { en: { name: 'a post-impressionist painting', light: 'colours far brighter than the real ones', still: 'Nothing here is the colour it should be, and we like it that way.' },
              zh: { name: '一幅后印象派的画', light: '比真实世界鲜艳得多的颜色', still: '这里没有一样东西是它“应该”的颜色，我们很喜欢这样。' } },
  expressionist: { en: { name: 'an expressionist painting', light: 'colours that show feelings instead of things', still: 'Here a colour is a feeling. Red is loud, blue is calm.' },
              zh: { name: '一幅表现主义的画', light: '表达情绪而不是物体的颜色', still: '在这里，颜色就是心情。红色很吵，蓝色很安静。' } },
  cubist:   { en: { name: 'a cubist painting', light: 'flat planes, seen from several sides at once', still: 'I can see my own back from here. It is normal, in this picture.' },
              zh: { name: '一幅立体主义的画', light: '平面的色块，同时从好几个方向看过去', still: '在这里我能看到自己的后背。在这幅画里，这很正常。' } },
  modern:   { en: { name: 'a modern painting', light: 'shapes and colours more than shadows', still: 'The painter cared about shapes more than about fur.' },
              zh: { name: '一幅现代绘画', light: '形状和颜色，多过光影', still: '画家在乎形状，比在乎毛发更多。' } },
  japan:    { en: { name: 'a Japanese painting', light: 'flat colour and fine black lines, with a lot of empty space', still: 'The empty space around us is part of the picture. It is where the air is.' },
              zh: { name: '一幅日本绘画', light: '平涂的颜色、细细的黑线，还有大片留白', still: '我们周围的空白也是画的一部分，那是空气所在的地方。' } },
  china:    { en: { name: 'a Chinese ink painting', light: 'ink and water on silk or paper, and a lot of mist', still: 'One brushstroke is a whole branch. We are made of very few strokes.' },
              zh: { name: '一幅中国水墨画', light: '绢或纸上的墨和水，还有很多雾气', still: '一笔就是一根树枝。我们是用很少的几笔画出来的。' } },
  miniature: { en: { name: 'a miniature painting', light: 'bright mineral colours and gold, painted with a single-hair brush', still: 'Every leaf in here was painted one by one with a very fine brush.' },
              zh: { name: '一幅细密画', light: '鲜艳的矿物颜料和金色，用一根毛的细笔画成', still: '这里的每一片叶子，都是用极细的笔一片一片画出来的。' } },
  folk:     { en: { name: 'a folk painting', light: 'clear, simple colours and no shadows at all', still: 'Our painter never went to art school. We came out exactly as we feel.' },
              zh: { name: '一幅民间绘画', light: '清楚简单的颜色，一点阴影都没有', still: '画我们的人没有上过美术学院，所以我们是照着感觉被画出来的。' } },
};

function city(museum) {
  return /Chicago/.test(museum) ? ['Chicago', '芝加哥'] : /Metropolitan/.test(museum) ? ['New York', '纽约']
    : /Cleveland/.test(museum) ? ['Cleveland', '克利夫兰'] : ['the museum', '博物馆'];
}

// the painted animals that can speak: the parts found in the picture that are animals
export function hostsOf(w) {
  const hs = (w.parts || []).map((p, i) => ({ ...p, i })).filter(p => p.type === 'animal').slice(0, 4)
    .map((p, k) => ({ id: `${w.id}~${p.i}`, kind: p.kind, part: p, faces: 'left', realH: (KIND[p.kind] || KIND.animal).h, inPlace: true }));
  if (hs.length) return hs;
  // nothing was found standing clear: the animal named in the title speaks from the middle of the picture
  const kind = (w.kinds || [])[0] || 'animal';
  return [{ id: `${w.id}~x`, kind, part: { box: [0.32, 0.3, 0.68, 0.78], type: 'animal', kind }, faces: 'left', realH: (KIND[kind] || KIND.animal).h, inPlace: true }];
}

export function registerWork(w) {
  const en = STRINGS.en, zh = STRINGS.zh;
  const v = VOICE[w.bucket] || VOICE.realist, s = hash(w.id);
  const [cityEn, cityZh] = city(w.museum);
  const year = w.year || parseInt(String(w.date).match(/\d{3,4}/)?.[0] || '1800', 10);
  const age = Math.max(1, new Date().getFullYear() - year);
  const ks = [...new Set(w.kinds || [])];
  const hosts = hostsOf(w);
  const seenKinds = [...new Set([...hosts.map(h => h.kind), ...ks])].filter(k => KIND[k]);
  const animalsEn = seenKinds.map(k => kindName(k));
  const animalsZh = seenKinds.map(k => kindName(k, 'zh'));
  const predator = seenKinds.find(a => seenKinds.some(b => b !== a && eats(a, b)));
  const preyOf = predator ? seenKinds.find(b => b !== predator && eats(predator, b)) : null;
  const shortTitle = w.title.length > 70 ? w.title.slice(0, 67) + '…' : w.title;
  const style = [w.style, w.medium].filter(Boolean).join(' · ');

  (en.works ||= {})[w.id] = {
    title: shortTitle, artist: w.artist, date: w.date, style: style || v.en.name,
    animals: listEn(animalsEn), collection: `${w.museum}${w.place ? ' · ' + w.place : ''}`,
    blurb: `${cap(v.en.name)}${w.place ? ' from ' + w.place : ''}, ${w.date}. ${v.en.still}`,
    welcome: `A visitor! Welcome, {visitor}.`,
    greet: {
      author: `Is it you, ${w.artist === 'Unknown' ? 'the one who painted us' : w.artist}? We still look just as you left us.`,
      guard: `We have not moved since ${year}. Well, hardly.`,
      passer: `Most people walk past. You stopped. Come closer.`,
    },
    chorus: [
      v.en.still,
      `In here there is only ${v.en.light}.`,
      predator && preyOf ? `The ${kindName(predator)} has been looking at the ${kindName(preyOf)} for ${age} years. In a painting nobody ever catches anybody.` : `We have been keeping still for ${age} years. You get good at it.`,
      `People in ${cityEn} lean in close and look for us.`,
    ],
    facts: [
      `It was painted ${/^c\.|^ca\./i.test(w.date) ? 'around ' + w.date.replace(/^c(a)?\.\s*/i, '') : 'in ' + w.date}${w.artist !== 'Unknown' ? ' by ' + w.artist : ''}: ${v.en.name}.`,
      `It belongs to the ${w.museum}, which shares it with everyone: it is in the public domain.`,
    ],
    see: animalsEn.length ? listEn(animalsEn.map(article)) : 'some animals',
    yes: `Then come in. ${v.en.still}`,
    no: `Fair enough. It is ${v.en.name}; not everyone likes that.`,
  };
  (zh.works ||= {})[w.id] = {
    title: shortTitle, artist: w.artist === 'Unknown' ? '佚名' : w.artist, date: w.date, style: style || v.zh.name,
    animals: listZh(animalsZh), collection: `${w.museum}${w.place ? ' · ' + w.place : ''}`,
    blurb: `${v.zh.name}，${w.date}。${v.zh.still}`,
    welcome: '有客人来了！欢迎你，{visitor}。',
    greet: {
      author: `是你吗，${w.artist === 'Unknown' ? '画我们的人' : w.artist}？我们还是你离开时的样子。`,
      guard: `从${year}年起我们就没动过。嗯，几乎没动过。`,
      passer: '大多数人都走过去了，你却停了下来。走近一点吧。',
    },
    chorus: [
      v.zh.still,
      `这里只有${v.zh.light}。`,
      predator && preyOf ? `${kindName(predator, 'zh')}已经盯着${kindName(preyOf, 'zh')}看了${age}年了。在画里，谁也抓不到谁。` : `我们已经一动不动地待了${age}年，早就习惯了。`,
      `${cityZh}的人们会凑得很近，来找我们。`,
    ],
    facts: [
      `这是${w.date}${w.artist !== 'Unknown' ? '由' + w.artist : ''}画的：${v.zh.name}。`,
      `它属于${w.museum}，已经进入公有领域，属于每一个人。`,
    ],
    see: animalsZh.length ? listZh(animalsZh) : '一些动物',
    yes: `那就进来吧。${v.zh.still}`,
    no: `也好。这是${v.zh.name}，不是每个人都喜欢。`,
  };
  (en.crossTime ||= {})[w.id] = `In this picture it has been the same moment since ${year}: ${v.en.light}.`;
  (zh.crossTime ||= {})[w.id] = `在这幅画里，从${year}年起一直是同一个瞬间：${v.zh.light}。`;

  // answers to the eight questions the visitor asks (askHost): play, eat, sleep, weather,
  // frightened, museum closed, who looks, getting older
  const friendsEn = animalsEn.length > 1 ? listEn(animalsEn.slice(0, 3).map(plural)) : 'the light on the grass';
  const friendsZh = animalsZh.length > 1 ? listZh(animalsZh.slice(0, 3)) : '草地上的光';
  (en.answerHost ||= {})[w.id] = [
    `With ${friendsEn}. We play by looking at each other. It is a very slow game.`,
    `Nothing. ${w.artist === 'Unknown' ? 'Whoever painted us' : w.artist} never painted anything for us to eat, and nobody here has ever been hungry.`,
    `We don’t sleep. We were painted wide awake, in ${v.en.light}.`,
    `Never. It is always ${v.en.light}. ${pick(['No rain, ever.', 'No wind, ever.', 'Not one cloud has moved.'], s)}`,
    predator && preyOf ? `The ${kindName(preyOf)} would say yes: there is a ${kindName(predator)} right there. But paint can’t bite.` : pick(['Only of people with umbrellas who stand too close.', 'Of the camera flashes, a little.', 'Of being moved to the storeroom.'], s),
    `The lights go off in ${cityEn}, and it is finally quiet. ${v.en.still}`,
    `People in ${cityEn}. Children count us. Painters copy us. Some just stand there for a long time.`,
    `Not really. ${age} years, and the paint has only cracked a little.`,
  ];
  (zh.answerHost ||= {})[w.id] = [
    `和${friendsZh}一起。我们玩的方法是互相看着。这是一个很慢很慢的游戏。`,
    `什么都不吃。${w.artist === 'Unknown' ? '画我们的人' : w.artist}没有给我们画吃的，这里谁也没饿过。`,
    `我们不睡觉。我们被画出来的时候就是醒着的，在${v.zh.light}里。`,
    `从来不变。永远都是${v.zh.light}。${pick(['从来不下雨。', '从来不刮风。', '连一朵云都没动过。'], s)}`,
    predator && preyOf ? `${kindName(preyOf, 'zh')}会说怕：旁边就有一只${kindName(predator, 'zh')}。不过颜料是咬不了人的。` : pick(['只怕撑着伞站得太近的人。', '有一点怕闪光灯。', '怕被搬进仓库。'], s),
    `${cityZh}的灯一关，这里终于安静了。${v.zh.still}`,
    `${cityZh}的人们。小孩子数我们有几只，画家临摹我们，有的人就站在那里看很久。`,
    `不太会。${age}年了，颜料只裂开了一点点。`,
  ];

  for (const h of hosts) {
    const nEn = kindName(h.kind), nZh = kindName(h.kind, 'zh');
    const fear = seenKinds.find(a => a !== h.kind && scares(a, h.kind));
    const prey = seenKinds.find(b => b !== h.kind && eats(h.kind, b));
    (en.hostNames ||= {})[h.id] = nEn; (zh.hostNames ||= {})[h.id] = nZh;
    (en.hostLife ||= {})[h.id] = [
      `I am the ${nEn} in ${v.en.name}. ${w.artist === 'Unknown' ? 'Nobody remembers who painted me' : w.artist + ' painted me'}, in ${year}, and I have stayed exactly here since.`,
      fear ? `I keep one eye on the ${kindName(fear)}. In the real world it would eat me. In here it just looks.`
        : prey ? `I could catch the ${kindName(prey)}, out there. In here we just keep each other company.`
        : isBird(h.kind) ? `I have had my wings open for ${age} years and never flown. It is restful, in a way.`
        : `I stand and I am looked at. ${v.en.still}`,
    ];
    (zh.hostLife ||= {})[h.id] = [
      `我是${v.zh.name}里的${nZh}。${w.artist === 'Unknown' ? '已经没人记得是谁画了我' : w.artist + '画了我'}，那是${year}年，从那以后我就一直待在这里。`,
      fear ? `我一直用一只眼睛盯着${kindName(fear, 'zh')}。在真实世界里，它会吃掉我；在这里，它只是看着。`
        : prey ? `在外面，我能抓住${kindName(prey, 'zh')}。在这里，我们只是互相陪伴。`
        : isBird(h.kind) ? `我的翅膀张开了${age}年，一次也没飞过。这样其实也挺安心的。`
        : `我站着，被人看着。${v.zh.still}`,
    ];
  }
  // new kinds the visitor may be (a drawn giraffe…)
  for (const [k, n] of Object.entries(KIND)) {
    (en.kinds ||= {})[k] ??= n.en; (zh.kinds ||= {})[k] ??= n.zh;
  }
  return hosts;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// how the visitor lives out in the world, for kinds the original site does not cover
export function registerLife(kind) {
  const en = STRINGS.en, zh = STRINGS.zh;
  if (en.life?.[kind]) return;
  const n = KIND[kind] || KIND.animal;
  const big = n.h > 2, bird = n.g === 'bird', water = n.g === 'water';
  (en.life ||= {})[kind] = [
    big ? `I live where the land is wide. From up here I can see over every bush and every fence.`
      : bird ? `I live in the air, mostly. I come down for food and to argue with other birds.`
      : water ? `I live in water. Everything out there is wet, cold and moving.`
      : `I live out in the world, where there is weather and night and other animals.`,
    big ? `I eat all day long: leaves from the tops of trees. I hardly sleep at all.`
      : bird ? `Seeds, insects, whatever I find. I sleep on a branch with my head under my wing.`
      : water ? `Little things that float by. I sleep with my eyes open.`
      : `I eat when I can and sleep when it is dark.`,
  ];
  (zh.life ||= {})[kind] = [
    big ? '我住在很开阔的地方。从这么高的地方，我能看到所有的灌木和篱笆后面。'
      : bird ? '我大多数时候住在天上，只有找吃的、和别的鸟吵架时才下来。'
      : water ? '我住在水里。外面的一切都是湿的、冷的、流动的。'
      : '我住在外面的世界里，那里有天气、有夜晚，还有别的动物。',
    big ? '我整天都在吃东西：树顶上的叶子。我几乎不怎么睡觉。'
      : bird ? '种子、虫子，找到什么吃什么。我睡在树枝上，把头埋在翅膀下面。'
      : water ? '吃漂过来的小东西。我睁着眼睛睡觉。'
      : '有吃的就吃，天黑了就睡。',
  ];
}
