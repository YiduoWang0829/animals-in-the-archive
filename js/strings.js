// All user-facing text lives here. To add Chinese, copy `en` to `zh`, translate
// the values, and set LANG = 'zh' (or read it from ?lang=zh).
// Placeholders in {braces} are filled at runtime by t(key, vars).

export const STRINGS = {
  en: {
    siteTitle: 'Animals in the Archive',
    siteKicker: 'A digital collection in three works',
    siteIntro: 'Three paintings, five centuries of animals. Choose a work, choose who you are, and send a living animal from the photographic archive into the picture. Something inside will answer.',
    navCollection: 'Collection',
    navCredits: 'Credits',
    navAbout: 'About',
    indexHeading: 'Collection index',
    indexCount: '{n} works',
    fieldAccession: 'Accession',
    fieldArtist: 'Artist',
    fieldDate: 'Date',
    fieldStyle: 'Style / medium',
    fieldAnimals: 'Animals in this work',
    fieldCollection: 'Collection',
    viewRecord: 'View record',
    enterWork: 'Enter this work',
    close: 'Close',
    back: 'Back',
    continue: 'Continue',

    stepOf: 'Step {n} of 5',
    roleHeading: 'Who are you in this room?',
    roleIntro: 'Your role changes how the painted animal behaves when your pointer comes near.',
    roles: {
      author:  { name: 'Author',     desc: 'You made this picture. The animal recognises you, blushes, and turns to look.' },
      guard:   { name: 'Guard',      desc: 'You keep watch over the work. The animal shies away from your hand.' },
      passer:  { name: 'Passer-by',  desc: 'You are only passing through. The animal is curious and follows your pointer.' },
    },

    visitorHeading: 'Choose a visitor',
    visitorIntro: 'Send an animal from the photographic archive into the painting.',
    tabArchive: 'From the archive',
    tabDraw: 'Draw it',
    archiveRecord: 'Photograph · {file}',
    drawHint: 'Draw one animal with a few bold strokes. Mouse, pen or finger.',
    drawClear: 'Clear',
    drawRecognise: 'Recognise',
    drawLoading: 'Loading the sketch classifier…',
    drawReady: 'Classifier ready (DoodleNet, running in your browser).',
    drawUnavailable: 'Sketch recognition could not be loaded in this browser, so no guess will be shown. Please choose your visitor from the archive instead.',
    drawEmpty: 'The canvas is empty. Draw an animal first.',
    drawTop: 'Classifier’s top guesses',
    drawMatch: 'Closest in the archive',
    drawScore: 'match score {p}%',
    drawVia: 'via the drawing class “{c}”',
    drawNoMatch: 'No archive animal was recognised with confidence (best match {p}%). Try again with a clearer outline, or pick from the archive.',
    drawNote: 'DoodleNet knows 345 everyday drawing classes (QuickDraw), not these exact species. Wolf, fox and deer are matched through the nearest classes (dog; raccoon or squirrel; horse, giraffe, camel, cow or kangaroo). The score is the classifier’s own probability for those classes.',
    useMatch: 'Send the {species}',

    stageCaption: '{title} · {artist}, {date}',
    entering: '{species} is entering the picture…',
    askQuestion: 'Ask: “Do you like this painting?”',
    questionLine: 'Do you like this painting?',
    yes: 'Yes',
    no: 'No',
    toSculpt: 'Sculpt them together',
    pointerHint: {
      author: 'Move your pointer near the {animal}: it knows its author.',
      guard: 'Move your pointer near the {animal}: it is wary of guards.',
      passer: 'Move your pointer around: the {animal} will follow.',
    },

    sculptHeading: 'Sculpture room',
    sculptHint: 'Drag on a model to sculpt. Drag empty space to orbit. Scroll or pinch to zoom.',
    toolPull: 'Pull',
    toolPress: 'Press',
    toolSize: 'Brush',
    toolStrength: 'Strength',
    viewSolid: 'Solid',
    viewWire: 'Wireframe',
    resetModels: 'Reset',
    handTracking: 'Hand tracking',
    handStop: 'Stop camera',
    handStatusOff: 'Hand tracking is off. Mouse and touch always work.',
    handStatusLoading: 'Loading hand model…',
    handStatusOn: 'Pinch thumb and index finger to sculpt.',
    handStatusPinch: 'Pinching: sculpting.',
    handStatusNoHand: 'No hand in view.',
    handDenied: 'Camera unavailable or permission denied. You can keep sculpting with mouse or touch.',
    handFailed: 'Hand tracking could not start in this browser. Mouse and touch still work.',
    modelFallback: 'Model file could not be loaded; showing a relief generated in the browser instead.',
    makeCard: 'Make archive card',

    consentHeading: 'Camera consent',
    consentBody: 'Hand tracking uses your camera. Video is processed only in this browser tab by a model stored on this site. No image, video or landmark data is uploaded, recorded or saved, and the camera stops when you leave this room or press “Stop camera”.',
    consentCheck: 'I agree to use my camera locally in this session. Nothing is uploaded or saved.',
    consentStart: 'Start camera',
    consentCancel: 'Not now',

    cardHeading: 'Archive card',
    cardIntro: 'A catalogue record of your visit. It is generated in your browser and only saved if you download it.',
    cardDownload: 'Download PNG',
    playAgain: 'Play again',
    cardTitle: 'Visitor record',
    cardRecord: 'Record no.',
    cardDate: 'Date',
    cardPainting: 'Painting',
    cardRole: 'Role',
    cardSpecies: 'Visitor species',
    cardHost: 'Painted host',
    cardMood: 'Mood',
    cardCredits: 'Credits',
    cardPhotoCredit: 'Photograph: {file}, photographer to be confirmed',
    cardFooter: 'Animals in the Archive · Yiduo Wang',

    moods: {
      author: { yes: 'proud', no: 'wounded' },
      guard:  { yes: 'relieved', no: 'watchful' },
      passer: { yes: 'charmed', no: 'restless' },
    },

    species: {
      brown_bear: 'brown bear', grey_wolf: 'grey wolf', lion: 'lion',
      red_deer: 'red deer', red_fox: 'red fox', tiger: 'tiger',
    },
    speciesLatin: {
      brown_bear: 'Ursus arctos', grey_wolf: 'Canis lupus', lion: 'Panthera leo',
      red_deer: 'Cervus elaphus', red_fox: 'Vulpes vulpes', tiger: 'Panthera tigris',
    },

    // One entry per painting. `host` = the painted animal that replies.
    works: {
      eden: {
        title: 'The Garden of Eden with the Fall of Man',
        artist: 'Jan Brueghel the Elder and Peter Paul Rubens',
        date: 'c. 1615',
        style: 'Flemish Baroque · oil on panel',
        animals: 'horse, lion, tiger, leopards, ostrich, ox, peacock, parrots, dogs, cat, deer, rabbit, monkeys, heron, swans, fish',
        collection: 'Mauritshuis, The Hague (inv. 253)',
        blurb: 'Rubens painted Adam and Eve; Brueghel painted everything else, a whole menagerie studied from life and from the Brussels court collections.',
        host: 'lion',
        greet: {
          author: 'Oh, it is you. You gave me this mane. I have been sitting very still for four hundred years.',
          guard:  'I have not moved, I promise. The snake is the one you should watch.',
          passer: 'Just passing? Nobody passes through Eden. Stay until the light changes.',
        },
        welcome: 'Welcome to the garden, {visitor}.',
        yes: 'Then stay. There is room under the trees, and nobody here has eaten the apple yet.',
        no:  'Fair. It is crowded, and the parrots never stop talking.',
      },
      durer: {
        title: 'Knight, Death and the Devil',
        artist: 'Albrecht Dürer',
        date: '1513',
        style: 'Northern Renaissance · engraving',
        animals: 'horse, dog, lizard',
        collection: 'Impression reproduced from the National Gallery of Art, Washington (per Wikimedia Commons)',
        blurb: 'One of Dürer’s three “master engravings”. Every tone is cut as a line: the dog’s fur, the horse’s muscle, the rot on Death’s face.',
        host: 'dog',
        greet: {
          author: 'Master! You drew every hair on me with a burin. Every single one.',
          guard:  'I only follow the horse. I am not a threat to anyone.',
          passer: 'Keep walking with us. The knight never stops, so neither do I.',
        },
        welcome: 'A visitor in the engraving. Hello, {visitor}.',
        yes: 'Good. Then walk beside me. Black and white is warmer than it looks.',
        no:  'Understandable. Death is standing right there.',
      },
      marc: {
        title: 'Fate of the Animals (Tierschicksale)',
        artist: 'Franz Marc',
        date: '1913',
        style: 'Expressionism · oil on canvas',
        animals: 'blue deer, red boars; other animals to be verified',
        collection: 'Kunstmuseum Basel (per Wikipedia; to be verified)',
        blurb: 'Painted the year before the First World War. The right side was damaged by fire after Marc’s death and later restored by his friend Paul Klee, which is why it looks browner.',
        host: 'blue deer',
        greet: {
          author: 'Franz? You made me blue. I never asked why.',
          guard:  'Please, not so close. Everything here is already falling.',
          passer: 'You can see it too, the trees breaking? Walk with me a little.',
        },
        welcome: 'You walked into the colour, {visitor}.',
        yes: 'Then it is not only an ending. Stand here with me; the blue is quiet.',
        no:  'No one likes it at first. It was painted to be heard, not liked.',
      },
    },
    visitorYes: 'I do. I want to stay a while.',
    visitorNo: 'Not really. It makes me uneasy.',

    creditsHeading: 'Credits',
    credits: {
      paintings: 'Paintings', photos: 'Animal photographs', software: 'Software, models and fonts',
      work: 'Work', author: 'Artist', date: 'Date', collection: 'Collection', source: 'Image source', licence: 'Licence status',
      file: 'Source file', species: 'Species', record: 'Source record (per dataset metadata)', photographer: 'Photographer',
      recorded: 'Licence as recorded in dataset metadata', item: 'Item', version: 'Version', use: 'Used for',
      tbv: 'to be verified', tbc: 'to be confirmed',
      photoNote: 'These photographs come from the author’s animal archive dataset. The dataset’s metadata links each one to a public observation record and records a licence and attribution string; these are shown here as recorded, not as verified claims. Photographer and licence are to be confirmed by the author before publication.',
    },
    // Credits table content (mirrors CREDITS.md). "To be verified" is deliberate.
    creditsData: {
    paintings: [
      { work: 'The Garden of Eden with the Fall of Man', author: 'Jan Brueghel the Elder and Peter Paul Rubens', date: '1615 (Commons); often given as c. 1615',
        collection: 'Mauritshuis, The Hague, inv. 253',
        source: 'https://commons.wikimedia.org/wiki/File:Jan_Brueghel_de_Oude_en_Peter_Paul_Rubens_-_Het_aards_paradijs_met_de_zondeval_van_Adam_en_Eva.jpg',
        licence: 'Public domain (Wikimedia Commons; reproduction marked CC Public Domain Mark 1.0)' },
      { work: 'Knight, Death and the Devil', author: 'Albrecht Dürer', date: '1513',
        collection: 'Commons cites the National Gallery of Art, Washington (accession 1943.3.3519 / 1941.1.20); exact impression to be verified',
        source: 'https://commons.wikimedia.org/wiki/File:Albrecht_D%C3%BCrer_-_Knight,_Death_and_the_Devil.jpg',
        licence: 'Public domain (Wikimedia Commons; CC Public Domain Mark 1.0)' },
      { work: 'Fate of the Animals (Tierschicksale)', author: 'Franz Marc', date: '1913 (not stated on the Commons file page; to be verified)',
        collection: 'Kunstmuseum Basel (per Wikipedia; inventory number to be verified)',
        source: 'https://commons.wikimedia.org/wiki/File:Marc_tierschicksale.jpg',
        licence: 'Public domain (Wikimedia Commons; CC Public Domain Mark 1.0; Commons source given as “reproduction from art book”)' },
    ],
    photos: [
      { file: 'brown_bear_24160860.png', species: 'Brown bear', record: 'https://www.inaturalist.org/observations/16123410', recorded: 'cc0 · “no rights reserved”' },
      { file: 'grey_wolf_4909114.png', species: 'Grey wolf', record: 'https://www.inaturalist.org/observations/4126404', recorded: 'cc-by · “(c) Desiree L. Narango, some rights reserved (CC BY)”' },
      { file: 'lion_236419.png', species: 'Lion', record: 'https://www.inaturalist.org/observations/163263', recorded: 'cc-by · “(c) 66dodge, some rights reserved (CC BY)”' },
      { file: 'red_deer_10941056.png', species: 'Red deer', record: 'https://www.inaturalist.org/observations/8249012', recorded: 'cc-by · “(c) Michael Bakker Paiva, some rights reserved (CC BY)”' },
      { file: 'red_fox_2262475.png', species: 'Red fox', record: 'https://www.inaturalist.org/observations/1859843', recorded: 'cc-by · “(c) botanygirl, some rights reserved (CC BY)”' },
      { file: 'tiger_50541307.png', species: 'Tiger', record: 'https://www.inaturalist.org/observations/32235759', recorded: 'cc-by · “(c) wild_wind, some rights reserved (CC BY)”' },
    ],
    software: [
      { item: 'three.js', version: '0.170.0', use: '3D sculpture room', licence: 'MIT' },
      { item: 'MediaPipe Tasks Vision', version: '0.10.14', use: 'Optional hand tracking', licence: 'Apache-2.0' },
      { item: 'MediaPipe hand_landmarker.task (float16, v1)', version: '1', use: 'Hand landmark model', licence: 'Apache-2.0 (per MediaPipe model card; to be verified)' },
      { item: 'TensorFlow.js', version: '4.22.0', use: 'Runs the sketch classifier', licence: 'Apache-2.0' },
      { item: 'DoodleNet (ml5.js data and models)', version: 'model from ml5-data-and-models; labels from ml5@0.12.2', use: 'Sketch recognition (QuickDraw, 345 classes)', licence: 'ml5.js is MIT; model licence to be verified' },
      { item: 'Blender', version: '5.2.3 LTS', use: 'Relief models (blender/make_relief.py)', licence: 'GPL (tool only, not distributed)' },
      { item: 'rembg (isnet-general-use)', version: '2.0.87', use: 'Background removal of photographs', licence: 'MIT (tool only, not distributed)' },
      { item: 'Cormorant Garamond, Inter, IBM Plex Mono', version: 'Fontsource 5.1.0', use: 'Typography', licence: 'SIL Open Font License 1.1' },
    ],
    },

    footer: 'Animals in the Archive · a student project by Yiduo Wang, University of London',
  },
};

export const LANG = new URLSearchParams(location.search).get('lang') in STRINGS
  ? new URLSearchParams(location.search).get('lang') : 'en';

// t('roles.author.name') or t('indexCount', {n: 3})
export function t(key, vars = {}) {
  const val = key.split('.').reduce((o, k) => (o ? o[k] : undefined), STRINGS[LANG])
    ?? key.split('.').reduce((o, k) => (o ? o[k] : undefined), STRINGS.en) ?? key;
  return typeof val === 'string'
    ? val.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
    : val;
}
