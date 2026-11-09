// All user-facing text lives here (English), with Simplified Chinese in strings.zh.js and
// Korean in strings.ko.js. The language follows ?lang=en|zh|ko (the switch in the header).
// Placeholders in {braces} are filled at runtime by t(key, vars).
import zh from './strings.zh.js';
import ko from './strings.ko.js';

export const STRINGS = {
  en: {
    siteTitle: 'Animals in the Archive',
    siteKicker: 'A digital collection in three works',
    siteIntro: 'Three paintings, five centuries of animals. Choose a work, draw or choose an animal, and walk it into the picture. Something inside will come alive.',
    navCollection: 'Collection',
    navCredits: 'Credits',
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
    stepOf: 'Step {n} of 6',

    roleHeading: 'Who are you in this room?',
    roleIntro: 'Your role changes what the animals say to you and how the painted animal reacts when you come near.',
    roles: {
      author: { name: 'Author', desc: 'You made this picture. The painted animal recognises you, blushes and turns to look.' },
      guard:  { name: 'Guard', desc: 'You keep watch over the work. The painted animal is shy and edges away from you.' },
      passer: { name: 'Passer-by', desc: 'You are only passing through. The painted animal is curious and follows you.' },
    },

    camHeading: 'Let the animals see you',
    camBody: 'With your camera on, the animals turn to look at you, you can wave to them, nod or shake your head to answer, step inside the painting by moving your head, and shape the sculpture with your hands. The video is processed only in this browser tab by models stored on this site. Nothing is uploaded, recorded or saved, and you can switch the camera off at any time.',
    consentCheck: 'I agree to use my camera locally in this session. Nothing is uploaded or saved.',
    camStart: 'Turn on camera',
    camSkip: 'Continue without camera',
    camOn: 'Camera on',
    camOff: 'Camera off',
    camStop: 'Turn camera off',
    camDenied: 'The camera is unavailable or permission was denied. Everything still works with the mouse or touch.',
    camFailed: 'Camera tracking could not start in this browser. Everything still works with the mouse or touch.',
    camLoading: 'Starting the camera…',

    studioKicker: 'Character studio',
    studioIntro: 'Your animal is your way into the painting. Draw one, or choose a living 3D animal, and see it move before it walks in.',
    studioDraw: 'Draw your own',
    studio3d: '3D animals',
    studio2d: 'Storybook animals',
    lookNatural: 'Natural',
    lookStorybookShort: 'Storybook',
    animWalk: 'Walk', animRun: 'Run', animIdle: 'Stand', animEat: 'Graze',
    walkInAs: 'Walk in as the {name}',
    walkInDrawing: 'Walk in as my drawing',
    bringMatch: 'Or bring the 3D {name}',
    dragToTurn: 'Drag to turn it around',
    animals3d: {
      fox: 'fox', wolf: 'wolf', rabbit: 'rabbit', deer: 'deer', stag: 'elk', donkey: 'donkey', horse: 'white horse', zebra: 'zebra', tiger: 'tiger', lioness: 'lioness', bear: 'brown bear',
    },
    visitorHeading: 'Who walks in?',
    visitorIntro: 'Draw an animal: your drawing becomes the character. Or choose one from the archive.',
    drawHint: 'Draw one animal from the side, with a closed outline. Mouse, pen or finger.',
    drawClear: 'Clear',
    drawRecognise: 'Recognise',
    drawLoading: 'Loading the sketch classifier…',
    drawReady: 'Classifier ready (DoodleNet, in your browser).',
    drawUnavailable: 'Sketch recognition could not be loaded in this browser, so no guess will be shown. You can still walk in as your drawing, or choose from the archive.',
    drawEmpty: 'The canvas is empty. Draw an animal first.',
    drawTop: 'Classifier’s top guesses',
    drawMatch: 'Closest in the archive',
    drawScore: 'match score {p}%',
    drawVia: 'via “{c}”',
    drawNoMatch: 'No archive animal was recognised with confidence (best {p}%). You can still walk in as your drawing.',
    drawNote: 'DoodleNet knows 345 everyday drawing classes (QuickDraw), not these exact species; deer and fox are matched through the nearest classes, and there is no class for wolf. The score is the classifier’s own probability.',
    useDrawing: 'Walk in as my drawing',
    useMatch: 'Send the {species}',
    facing: 'Head points',
    facingLeft: 'Left',
    facingRight: 'Right',
    wash: 'Colour',
    archiveHeading: 'Or choose from the archive',
    lookLabel: 'Look',
    lookStorybook: 'Storybook',
    lookPhoto: 'Photograph · 3D',
    archiveRecord: '{file}',

    loadingRoom: 'Hanging the painting…',
    visitorGreet: {
      author: 'You made this, didn’t you? Come, let’s look closer.',
      guard: 'Don’t worry, I won’t touch anything.',
      passer: 'Walk with me a moment?',
    },
    hostAsk: 'Do you like this painting?',
    answerHint: 'Nod for yes, shake your head for no.',
    yes: 'Yes',
    no: 'No',
    visitorYes: 'I do. Can I come in?',
    visitorNo: 'Not really. It makes me uneasy.',
    stepInAnyway: 'Step in anyway',
    anotherPainting: 'Choose another painting',

    // ---- conversation ({name} = the visitor's name) ----
    nameLabel: 'Give it a name',
    names: ['Pip', 'Mo', 'Biscuit', 'Luna', 'Pepper', 'Clover', 'Juniper', 'Toast', 'Olive', 'Fig', 'Bramble', 'Nutmeg', 'Wren', 'Pebble'],
    visitorHello: [
      'Hello! I’m {name}. Are you coming with me?',
      'Oh! You’re watching. Hi, I’m {name}.',
      'Psst. I’m {name}. I’ve never been in a museum before.',
      'Hello, you! Stay close, this place is enormous.',
      'I’m {name}. Can you see the painting from there?',
    ],
    waveHint: 'Wave hello',
    waveBack: [
      'Hello, hello!', 'I see you!', 'Hi! Wave again!', 'Oh, a friend!', 'Hello from in here!',
      'You waved at me!', 'Hello to you, too.',
    ],
    // a painted animal asks the visitor, the visitor answers
    qa: [
      ['What’s your name?', 'I’m {name}.', '{name}. That’s a lovely name.'],
      ['Where do you come from?', 'From the archive. Drawer seven, I think.', 'A traveller! We never travel.'],
      ['Are you hungry?', 'A little. Is that fruit over there?', 'Help yourself. It never runs out.'],
      ['Can you run fast?', 'Watch me!', 'Ha! Faster than the painter could paint.'],
      ['How long can you stay?', 'As long as my friend out there stays.', 'Then we had better be interesting.'],
      ['Are you painted too?', 'Not yet. Maybe a little, now.', 'It suits you.'],
      ['Do you have friends here?', 'I do now.', 'Good answer.'],
      ['Who is that, watching us?', 'That’s my friend. Say hello!', 'Hello, friend!'],
    ],
    // a painted animal asks you (nod = yes, shake = no)
    askYou: [
      ['How was your day? Good?', 'Good! Ours too. Nothing ever happens here, and we like it.', 'Then stay with us a while. It gets better in here.'],
      ['Can you see me properly?', 'Wonderful. Four hundred years and still visible!', 'Come closer, then. Lean in.'],
      ['Do you like animals?', 'We like you too.', 'Hm. You’ll like us, though. Give it time.'],
      ['Shall we show you around?', 'Follow us, then. Keep your eyes on {name}.', 'Fine, we will stay right here with you.'],
      ['Will you come back tomorrow?', 'We will keep your place.', 'Then let’s make today count.'],
      ['Do you want to hear a secret?', 'The painter forgot the end of my tail. Shh.', 'Then I will keep it a little longer.'],
      ['Is it raining outside?', 'Always is, somewhere. Not in here.', 'Lucky you. It never rains in a painting.'],
      ['Are you tired?', 'Sit down a moment. We will keep talking.', 'Then let’s keep going!'],
    ],
    waitingYou: ['I’m waiting for your answer…', 'Nod or shake your head. I’m listening.', 'Take your time.', 'Hello? Over here!'],
    visitorToYou: [
      'It’s even bigger inside. Are you still there?',
      'Everyone here is so polite.',
      'I can smell oil paint. And something sweet.',
      'Look at me! I’m in a painting!',
      'Don’t go anywhere, I want to show you something.',
      'Can you see the little animals in the back?',
    ],

    // ---- the gallery tour: just your animal and you ----
    switchArrive: ['This one now. Let’s have a look.', 'Another painting! Come, let’s see who lives in this one.', 'Ooh, this one. Stay close.'],
    tourArrive: ['Oh, a gallery. It’s so quiet. Come, let’s have a look.', 'A real painting! Stay with me, I want to read the label.'],
    tourLabel: 'The label says: “{title}”, by {artist}, {date}.',
    tourSee: 'I can see {animals} in there.',
    tourSame: 'Look! There’s a {kind} in there, just like me!',
    tourNotSame: 'No {kind} in this one. I’d be the very first.',
    tourDrawing: 'I can’t tell if anyone in there looks like me. I was only drawn a minute ago!',
    tourLikeQ: 'Do you like it so far?',
    tourLikeYes: 'Me too. Every time I look, I find another animal.',
    tourLikeNo: 'Give it a moment. Paintings are slow to say hello.',
    tourGoQ: 'Shall we walk in and see what it’s like inside?',
    tourGoYes: 'Here we go. Watch!',
    tourGoNo: 'Then let’s just look from here a little longer.',
    kinds: {
      fox: 'fox', dog: 'dog', deer: 'deer', horse: 'horse', cat: 'cat', rabbit: 'rabbit', cattle: 'ox', alpaca: 'alpaca',
      donkey: 'donkey', zebra: 'zebra', bear: 'bear', wolf: 'wolf', lion: 'lion', tiger: 'tiger', squirrel: 'squirrel',
      hedgehog: 'hedgehog', bird: 'bird',
    },
    // how the visitor lives, by kind: [what it is like out there, eating and sleeping]
    life: {
      fox: ['I live at the edge of a town. I sleep in the day and look for beetles and leftovers at night.', 'I eat whatever I can find, and I sleep curled up with my tail over my nose.'],
      dog: ['I live with a family. There is a sofa I’m not allowed on, and a park every morning.', 'Twice a day, from a bowl with my name on it. And I sleep wherever it’s warm.'],
      deer: ['I live in a forest. In autumn the stags call all night, and the leaves turn red.', 'I graze at dawn and dusk, and rest in the long grass when it’s quiet.'],
      horse: ['I live in a field with three other horses. We stand nose to tail when it rains.', 'Grass, hay, and an apple when someone is kind. I can sleep standing up.'],
      cat: ['I live in a flat, four floors up. I watch the pigeons from the window all day.', 'I eat at six, and again at six, and I sleep sixteen hours. It’s a good life.'],
      rabbit: ['I live in a burrow under a hedge, with far too many cousins.', 'Clover, mostly. We sleep underground with one ear open.'],
      cattle: ['I live on a farm. The farmer knows all our names.', 'I chew for hours. Then I lie down and chew some more.'],
      alpaca: ['I live high in the hills, with a herd that hums to each other.', 'Grass and hay. We sleep together in a big woolly heap.'],
      donkey: ['I live in a field by a church. Children come to scratch my ears.', 'Thistles are my favourite. I nap in the afternoon sun.'],
      zebra: ['I live on a wide plain, in a herd as long as a river.', 'We graze almost all day. Someone always stays awake to watch for lions.'],
      bear: ['I live in a forest by a river. In autumn the salmon jump right into my mouth.', 'I eat all summer, then sleep all winter in a den.'],
      wolf: ['I live with my pack in the hills. We sing to each other at night.', 'We eat together after a long hunt, and sleep in a pile in the snow.'],
      lion: ['I live on the savannah, with my pride, under one big tree.', 'We hunt at night and sleep most of the day. Twenty hours, sometimes.'],
      tiger: ['I live alone in the forest. I like rivers; I’m a good swimmer.', 'I eat a big meal and then rest for days in the shade.'],
      squirrel: ['I live at the top of an oak tree. I know every branch by heart.', 'Nuts. I bury hundreds and forget half of them. Oak trees grow where I forget.'],
      hedgehog: ['I live under a garden shed. I come out when everyone is asleep.', 'Slugs and beetles. In winter I sleep for months, rolled into a ball.'],
      bird: ['I live in an old barn. I fly out over the fields at dusk.', 'Mice, mostly. I sleep all day up in the rafters.'],
      drawing: ['I live on paper! A minute ago I was only a few lines.', 'I don’t eat. I think I am made of ink and good wishes.'],
    },
    // how each painted animal lives inside its picture: [its life, what it does all day]
    hostLife: {
      'eden-lion': ['I have lain in this exact spot since 1615. Brueghel painted me, hair by hair, and I have not blinked since.', 'I watch Adam and Eve. Every visitor asks about the apple. Nobody asks about me.'],
      'eden-horse': ['I am the white horse at the back. Brueghel put me where the light is softest.', 'I stand and shine. People lean in close to see me; that is my day.'],
      'eden-deer': ['I am the stag under the trees. My antlers took the painter a whole afternoon.', 'I listen to the parrots argue. They have been arguing for four hundred years.'],
      'eden-rabbit': ['I am the little white rabbit near Eve’s feet. Most people never notice me.', 'I keep very still and count the people who walk past. Thousands and thousands.'],
      'eden-dog': ['I am the little white dog. In 1615 dogs like me lived in palaces.', 'I stay by Eve. In a painting you don’t get bored; you just keep being.'],
      'eden-peacock': ['I am the peacock. Every one of my feathers has its own little eye painted on.', 'I show off my tail. It is the same tail every day, but it is still a very good tail.'],
      'hicks-lion': ['I am the lion. The prophecy says I will eat straw like the ox, so here I sit, looking very serious about straw.', 'I sit in the middle and keep my claws to myself. Mr Hicks painted me again and again, more than sixty times.'],
      'hicks-cub': ['I am the bear cub. In the prophecy the cow and the bear feed together, and their young lie down side by side.', 'I sleep curled up next to the calf. Nobody in here has ever been hungry enough to mind.'],
      'hicks-calf': ['I am the calf. A lion sits right above me, and I have never once been afraid.', 'I lie on the warm brown earth and listen to the children. They never stop chattering.'],
      'hicks-goat': ['I am the goat. The leopard is supposed to lie down with the young goat, and here we all are.', 'I keep my horns tidy and watch the river. Over there, people are making a promise of peace.'],
      'hicks-leopard': ['I am the leopard. A little child is touching my face, and I am letting it.', 'I lie very still. In this picture nobody hunts and nobody runs away.'],
      'marc-deer': ['I am the blue deer. Franz Marc painted me in 1913, the year before the war.', 'I stretch up towards the light while the forest falls around me. It is beautiful, and it is frightening.'],
      'marc-boar': ['We are the red boars, down in the corner. Marc made us out of red and fire.', 'We hold on to each other. In here everything is always breaking.'],
    },
    // the conversation once the visitor is inside
    insideStartled: '…?',
    insideMoved: 'Something moved. Nothing in here has moved since {date}.',
    insideHello: 'Hello! I’m {name}. I walked in from the gallery.',
    insideAskOut: 'From out there? What is it like where you live?',
    insideAskIn: 'And you? What is your life like in here?',
    insideAskEat: 'Do you eat? Do you sleep? We never do.',
    insideAskDay: 'What do you do all day?',
    insideAskFriend: 'Your friend out there, do they have animals at home?',
    insideFriendYes: 'Then they know what we mean.',
    insideFriendNo: 'Then they must visit us often.',
    insideLeave: 'I’ll have to go back to my world one day. But I’ll remember this.',
    insideRemember: 'And we will remember the one who moved.',

    // ---- inside: the opening (fixed script, about six lines) ----
    openShy: 'Oh! Um… hello. Nobody has ever walked in here before.',
    openAmazed: 'Wait… you can talk? A painted animal, and you can really talk!',
    openSorry: 'Hello! I’m {name}. I’m sorry, I didn’t mean to scare you.',
    openWhisper: 'Is it… friendly?',
    openWhisperSolo: 'Are you… friendly?',
    openFriendly: 'Very friendly! I just wanted to see your world.',
    openFollow: 'Then come, I’ll show you around. Follow me!',
    openOkay: 'Okay, I’m right behind you!',
    openHere: 'This is my favourite spot. You can see the whole picture from here.',
    openWow: 'It’s beautiful. Thank you for showing me.',
    // a painted animal reacting to the visitor's life
    reactions: ['Really? I never knew that.', 'That sounds wonderful.', 'Oh! Tell me more another time.', 'How strange, and how lovely.', 'I wish I could see that.'],
    // the visitor reacting to a painted animal's story (some are sad, so nothing cheerful)
    reactionsToHost: ['Really? I never knew that.', 'I’ll remember that.', 'Thank you for telling me.', 'Oh… I see.', 'I’m glad you told me.'],
    visitorAskYou: [
      ['Can you see the little animals at the back?', 'I knew you’d spot them!', 'Look behind the big trees. There!'],
      ['Shall I stay a little longer?', 'Then I will. It’s so nice in here.', 'Just a little, then. I want to see one more thing.'],
      ['Are you having fun out there?', 'Me too! Thank you for bringing me.', 'Then let’s find something more exciting!'],
      ['Do I look painted now?', 'I feel very old and very golden.', 'Good. I still want to look like me.'],
    ],

    // ---- getting to know each other: each question has an answer for every kind of visitor
    // and for every painting. A different mix is chosen on every visit. ----
    askVisitor: [
      'Who do you play with out there?', 'What is your favourite thing to eat?', 'Where do you sleep at night?',
      'What is the weather like in your world?', 'Are you ever frightened out there?', 'What do you do when the sun goes down?',
      'Do you have a family?', 'What is the most beautiful thing you have ever seen?',
    ],
    answerVisitor: {
      wild: [
        'My brothers and sisters, mostly. We tumble about in the long grass until someone gets cross.',
        'Whatever the season gives me: berries, beetles, roots. Autumn is the best; everything is falling and sweet.',
        'Somewhere hidden: a hollow, a den, a nest of leaves. Never in the same place twice.',
        'Real weather! Rain that soaks right through your fur, and wind that smells of everything at once.',
        'Of cars, and of loud people. The wild places are getting smaller every year.',
        'That’s when I’m most awake. Everything smells stronger in the dark, and the forest talks.',
        'A mother who taught me everything, and far too many noisy cousins.',
        'Snow falling in the forest at dawn, with no sound at all. Not even me.',
      ],
      home: [
        'With the children of my family, and the dog next door, and a ball that always rolls under the sofa.',
        'Food from my own bowl, and a treat if I sit very nicely. I sit very nicely.',
        'Somewhere warm: a basket, a stable, sometimes someone’s bed when they aren’t looking.',
        'When it rains someone lets me in. When it’s sunny I lie in it until I’m too hot.',
        'Of thunder. And of the vacuum cleaner, which is a kind of indoor thunder.',
        'I curl up and listen to the house breathing. Houses creak when they fall asleep.',
        'Humans, mostly. They’re strange, but they’re mine.',
        'The door opening when my person comes home. Every single time.',
      ],
      drawing: [
        'With the pencil that drew me. It tickles.',
        'Ink, I think. And good wishes.',
        'On a page, when the screen goes dark.',
        'A little cloudy, on the paper. Some smudges.',
        'Of the eraser. Very much of the eraser.',
        'I wait for someone to open the page again.',
        'The person who drew me. They’re watching right now.',
        'This. Walking into a real painting.',
      ],
    },
    askHost: [
      'Who do you play with in here?', 'What do you eat in a painting?', 'Where do you sleep?',
      'Does the weather ever change in here?', 'Are you ever frightened?', 'What happens when the museum closes?',
      'Who comes to look at you?', 'Do you ever get older?',
    ],
    answerHost: {
      eden: [
        'The rabbits and the little dog chase each other round Eve’s feet. Well, they would, if anyone ever let them move.',
        'Nothing! We were painted before anyone ate the apple. Nobody here has ever been hungry.',
        'We don’t. Brueghel painted us all wide awake, in one very long afternoon.',
        'Never. Always the same golden light, coming from the left. Brueghel liked it that way.',
        'Only of the snake in the tree. He has been watching all of us since 1615.',
        'The lights go off, and the parrots finally stop talking. It’s lovely.',
        'People in The Hague lean in close and try to count us. They always miss the rabbit.',
        'Not really. The varnish gets a little more golden, that’s all. Like honey.',
      ],
      hicks: [
        'The children. They lead us, the prophecy says. Mostly they lead us round in circles.',
        'Straw, they say, even the lion. The black bear has an ear of corn. Nobody eats anybody.',
        'Right here, all together, in one warm heap. Wolf next to lamb, cub next to calf.',
        'It is always early autumn in here: golden leaves and a soft sky over the river.',
        'Not in here. That is the whole point of this picture: nobody is afraid of anybody.',
        'We stay just as we are. Peace doesn’t need the lights on.',
        'People in Washington. They count the animals, then they look for the tiny treaty by the river.',
        'The paint has cracked into a fine web. That is our only wrinkle.',
      ],
      marc: [
        'We used to play with the light, before the trees started falling.',
        'Colour. We drink the blue and the red; it’s all we need.',
        'Never. Everything in here is moving, falling, shining.',
        'All the time! Storms of colour: red rain, blue wind, yellow lightning.',
        'Marc painted us just before a great war. We can feel it in the colours.',
        'In the dark, the colours keep glowing for a little while. Like embers.',
        'People stand very still in front of us. Some of them cry.',
        'Half of us burned once. Paul Klee painted us back. So yes, a little.',
      ],
    },
    // ---- the crossing: a black title card while the visitor walks into the picture ----
    crossKicker: 'Into the picture',
    crossTime: {
      eden: 'In this garden it has been the same golden afternoon since 1615.',
      hicks: 'In this kingdom it has been the same peaceful autumn afternoon since 1834.',
      marc: 'In this forest the trees have been falling since 1913, and have never landed.',
    },
    crossStill: 'The animals in here have never felt rain. They have never been hungry, never slept, never grown old.',
    crossOut: '{name} comes from out there, where animals have weather, and homes, and nights.',
    crossOutDrawing: '{name} was drawn a minute ago, out there, where animals have weather, and homes, and nights.',
    crossTrade: 'Today the painted animals will show {name} how they live inside the picture, and {name} will tell them how animals live outside it.',
    crossListen: 'Listen to what they tell each other. At the end, you will make something out of it.',
    crossSkip: 'Click to continue',
    // ---- after the conversation: what each world told the other ----
    ledgerKicker: 'What they told each other',
    ledgerIn: 'Inside the picture',
    ledgerOut: 'Out in the world',
    ledgerNote: 'Two worlds, one afternoon. Now put them together: everything they mentioned is waiting for you, torn from the painting or drawn in a notebook.',
    ledgerCollage: 'Make a collage of it',
    ledgerMonument: 'Carve it as a monument',
    ledgerStay: 'Stay a little longer',
    ledgerOpen: 'What they said',
    // captions on the collage pieces: drawn things from the real world…
    pieces: {
      sofa: 'the sofa', bowl: 'a bowl with my name on it', ball: 'a ball under the sofa', basket: 'somewhere warm to sleep',
      window: 'the window and the pigeons', house: 'a house at night', door: 'the door opening', car: 'cars',
      tree: 'a real tree', acorn: 'buried acorns', leaf: 'leaves that fall', berries: 'berries in autumn', apple: 'an apple, when someone is kind',
      grass: 'grass, all day', fish: 'the river', rain: 'real rain', sun: 'lying in the sun', moon: 'the night',
      snow: 'snow', thunder: 'thunder', wind: 'wind that smells of everything', paws: 'family', pencil: 'the pencil that drew me',
      eraser: 'the eraser', den: 'a den, a burrow',
    },
    // …and fragments torn out of the paintings
    fragments: {
      'eden-snake': 'the snake, watching since 1615', 'eden-apple': 'the apple nobody has eaten', 'eden-parrots': 'the parrots, still arguing',
      'eden-light': 'the same golden light', 'eden-rabbit': 'the rabbit nobody notices', 'eden-dog': 'the little white dog',
      'eden-peacock': 'a tail full of eyes', 'eden-lion': 'the lion who never blinks', 'eden-whitehorse': 'the white horse in the soft light',
      'eden-stag': 'the stag under the trees',
      'hicks-treaty': 'a promise of peace by the river', 'hicks-river': 'the river far away', 'hicks-children': 'the children who lead them',
      'hicks-lionface': 'a lion who eats straw', 'hicks-oxface': 'the ox, side by side with the lion', 'hicks-leopards': 'the leopard lies down with the kid',
      'hicks-tree': 'golden autumn leaves', 'hicks-bearcorn': 'a bear with an ear of corn', 'hicks-wolflamb': 'the wolf with the lamb',
      'marc-beams': 'the falling trees', 'marc-deer': 'the blue deer', 'marc-boars': 'the red boars', 'marc-light': 'yellow lightning',
      'marc-storm': 'a storm of colour', 'marc-klee': 'the part that burned, painted back',
    },
    fromTalk: 'From your conversation',
    twoWorlds: 'Two worlds',
    shuffleLayout: 'Rearrange',
    composeTalkHint: 'Everything here was mentioned while they talked: torn from the painting on the left, drawn in a notebook on the right. Drag, resize, add more from the shelf.',
    monumentTalk: 'The animals stand on the painting, with the things they talked about. Their words are carved in the stone in front.',
    inscriptionHead: 'Here {name} and the animals of {title} told each other how they live.',
    cardTold: 'They said',

    welcomeInside: 'Welcome inside, {name}. Stay close to us.',
    insideHint: 'One hand: open palm to come closer, pinch and hold to step back, pinch and drag sideways to walk round. Wave and they wave back.',
    insideHintMouse: 'You are inside the painting. Drag to look around, scroll to zoom, click the ground to walk there, click an animal to call it.',
    called: ['You called?', 'Here I am.', 'Shall we walk together?', 'I was waiting for you.', 'Follow me, there is more over there.'],
    runAway: ['Catch me!', 'This way!', 'Too slow!'],
    create: 'Create something',
    roleReact: {
      author: 'It recognises you.',
      guard: 'It keeps its distance.',
      passer: 'It follows you.',
    },

    createHeading: 'Make something of your visit',
    modeSculpt: 'Monument · 3D',
    monumentHint: 'The painting, carved into a plinth, with the animals on top as statues. Drag to walk round it, scroll to come closer, drag a statue to move it, double-click to turn it. Try the five forms and four materials.',
    monumentHands: 'Pinch and move to walk round it, pinch a statue to carry it, two open hands to come closer, swipe to change the form.',
    forms: { stele: 'Stele', cube: 'Cube', drum: 'Drum', chalice: 'Chalice', medallion: 'Medallion' },
    materials: { marble: 'Marble', bronze: 'Bronze', clay: 'Clay', painted: 'Painted' },
    modeCompose: 'New painting · 2D',
    sculptHint: 'Drag on a model to sculpt; drag empty space to turn it.',
    sculptHands: 'Pinch with your right hand to pull, left hand to press. Open hand: turn. Two open hands: zoom.',
    composeHint: 'Add animals from all three paintings. Drag to move, scroll or pinch to resize, shift-scroll to turn, double-click to flip. Change the season and the picture.',
    addAnimals: 'Animals from the collection',
    season: 'Season',
    seasons: { none: 'As painted', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
    removeSel: 'Remove selected',
    composeHands: 'Pinch an animal to carry it. Pinch with both hands to resize and turn. Swipe an open hand to change the picture.',
    toolPull: 'Pull',
    toolPress: 'Press',
    toolSize: 'Brush',
    toolStrength: 'Strength',
    viewSolid: 'Solid',
    viewWire: 'Wireframe',
    resetModels: 'Reset',
    exportGLB: 'Download .glb for Blender',
    background: 'Painting',
    variant: 'Picture',
    variants: { original: 'Original', night: 'Night', engraving: 'Engraving', prism: 'Prism', wash: 'Storybook' },
    modelFallback: 'A model file could not be loaded; a relief built in the browser is shown instead.',
    makeCard: 'Make archive card',

    cardHeading: 'Archive card',
    cardIntro: 'A catalogue record of your visit. It is generated in your browser and only saved if you download it.',
    cardDownload: 'Download PNG',
    playAgain: 'Play again',
    cardTitle: 'Visitor record',
    cardDate: 'Date',
    cardPainting: 'Painting',
    cardRole: 'Role',
    cardSpecies: 'Visitor',
    cardHost: 'Painted animals',
    cardMood: 'Mood',
    cardMade: 'Made',
    cardCredits: 'Credits',
    cardPhotoCredit: 'Visitor: {file}, photographer to be confirmed',
    cardDrawingCredit: 'Visitor: drawn by the visitor',
    card3dRealCredit: 'Visitor: “{title}” by {author}, {licence} (Sketchfab), changed for this project',
    card3dCredit: 'Visitor: 3D {name} by Quaternius (CC0)',
    cardHosts: 'Painted animals',
    cardFooter: 'Animals in the Archive · Yiduo Wang',
    madeSculpture: 'a monument in {material}',
    madePainting: 'a new painting ({variant})',
    yourDrawing: 'your own drawing',
    moods: {
      author: { yes: 'proud', no: 'wounded' },
      guard: { yes: 'relieved', no: 'watchful' },
      passer: { yes: 'charmed', no: 'restless' },
    },

    species: {
      brown_bear: 'brown bear', grey_wolf: 'grey wolf', lion: 'lion', red_deer: 'red deer', red_fox: 'red fox', tiger: 'tiger',
      domestic_cat: 'cat', domestic_dog: 'dog', rabbit: 'rabbit', horse: 'horse', owl: 'barn owl', red_squirrel: 'red squirrel', hedgehog: 'hedgehog',
    },
    speciesLatin: {
      brown_bear: 'Ursus arctos', grey_wolf: 'Canis lupus', lion: 'Panthera leo', red_deer: 'Cervus elaphus', red_fox: 'Vulpes vulpes',
      tiger: 'Panthera tigris', domestic_cat: 'Felis catus', domestic_dog: 'Canis familiaris', rabbit: 'Oryctolagus cuniculus',
      horse: 'Equus caballus', owl: 'Tyto alba', red_squirrel: 'Sciurus vulgaris', hedgehog: 'Erinaceus europaeus',
    },
    hostNames: {
      'eden-lion': 'lion', 'eden-horse': 'white horse', 'eden-deer': 'stag', 'eden-rabbit': 'white rabbit',
      'eden-dog': 'little dog', 'eden-peacock': 'peacock', 'hicks-lion': 'lion', 'hicks-cub': 'bear cub', 'hicks-calf': 'calf', 'hicks-goat': 'goat', 'hicks-leopard': 'leopard',
      'marc-deer': 'blue deer', 'marc-boar': 'red boar',
    },

    // One entry per painting. Lines work for whichever painted animal wakes up.
    works: {
      eden: {
        title: 'The Garden of Eden with the Fall of Man',
        artist: 'Jan Brueghel the Elder and Peter Paul Rubens',
        date: 'c. 1615',
        style: 'Flemish Baroque · oil on panel',
        animals: 'horse, lion, tiger, leopards, ostrich, ox, peacock, parrots, dogs, cat, deer, rabbit, monkeys, heron, swans, fish',
        collection: 'Mauritshuis, The Hague (inv. 253)',
        blurb: 'Rubens painted Adam and Eve; Brueghel painted everything else, a whole menagerie studied from life and from the Brussels court collections.',
        welcome: 'A visitor! Welcome to the garden, {visitor}.',
        greet: {
          author: 'Oh, it is you. You painted every hair on me. I have been standing still for four hundred years.',
          guard: 'I have not moved, I promise. The snake is the one you should watch.',
          passer: 'Nobody just passes through Eden. Stay until the light changes.',
        },
        chorus: ['Have you seen the snake? He never blinks.', 'The parrots say there is fruit by the water.', 'I have not run like this since the Creation.', 'Mind Adam’s foot, he is very still.'],
        facts: ['Two painters made it together: Rubens painted Adam and Eve, Brueghel painted all the animals.', 'Each animal was painted so carefully you could count its feathers.'],
        see: 'a lion, a tiger, horses, deer, dogs, a peacock, parrots and an ostrich',
        yes: 'Then come in. There is room under the trees, and nobody has eaten the apple yet.',
        no: 'Fair. It is crowded, and the parrots never stop talking.',
      },
      hicks: {
        title: 'Peaceable Kingdom',
        artist: 'Edward Hicks',
        date: 'c. 1834',
        style: 'American folk painting · oil on canvas',
        animals: 'lion, leopards, wolf, lamb, goats, ox, cows, bears, calf',
        collection: 'National Gallery of Art, Washington (1980.62.15)',
        blurb: 'Hicks, a Quaker preacher in Pennsylvania, painted this vision from the Book of Isaiah more than sixty times: wild and tame animals resting together, led by a little child. Far off by the river, William Penn makes his treaty with the Lenape.',
        welcome: 'A visitor in the kingdom. Welcome, {visitor}.',
        greet: {
          author: 'Mr Hicks? You painted us so many times. We always come out a little different.',
          guard: 'There is nothing to guard here. Nobody hurts anybody.',
          passer: 'Sit with us a while. Everyone is welcome in this kingdom.',
        },
        chorus: ['Shh, the lion is thinking about straw again.', 'The children are coming this way. Be gentle.', 'Can you see the treaty by the river? Tiny people, a very big promise.', 'Wolf and lamb, side by side. It took a while to get used to.'],
        facts: ['Edward Hicks was a Quaker preacher, and he painted this scene more than sixty times.', 'It shows a prophecy from the Bible: the wolf lies down with the lamb, and a little child leads them all.'],
        see: 'a lion, leopards, a wolf, a lamb, goats, an ox, bears and a calf',
        yes: 'Then come in quietly. In here, nobody is afraid of anybody.',
        no: 'That is all right. Peace can wait for you.',
      },
      marc: {
        title: 'Fate of the Animals (Tierschicksale)',
        artist: 'Franz Marc',
        date: '1913',
        style: 'Expressionism · oil on canvas',
        animals: 'blue deer, red boars; other animals to be verified',
        collection: 'Kunstmuseum Basel (per Wikipedia; to be verified)',
        blurb: 'Painted the year before the First World War. The right side was damaged by fire after Marc’s death and later restored by his friend Paul Klee, which is why it looks browner.',
        welcome: 'You walked up to the colour, {visitor}.',
        greet: {
          author: 'Franz? You made us these colours. We never asked why.',
          guard: 'Please, not so close. Everything here is already falling.',
          passer: 'You can see it too, the trees breaking? Come a little nearer.',
        },
        chorus: ['Everything is red and blue in here. You get used to it.', 'The trees are falling slowly. Stay near me.', 'Can you hear the colours?'],
        facts: ['Franz Marc painted it just before the First World War.', 'The right side was damaged by fire, and his friend Paul Klee repaired it.'],
        see: 'a blue deer and red boars',
        yes: 'Then it is not only an ending. Step in; the blue is quiet.',
        no: 'No one likes it at first. It was painted to be heard, not liked.',
      },
    },

    creditsHeading: 'Credits',
    credits: {
      paintings: 'Paintings', photos: 'Animal photographs', models3d: '3D animals', modelsNote: 'Realistic rigged and animated animals from Sketchfab, each credited below under the licence stated in the licence file that came with its download (CC BY 4.0, or CC BY-NC 4.0 for non-commercial use only). For this project the props (a saddle) were removed, unused animations dropped, textures reduced and the shading made painterly.', model: 'Model', hosts: 'Painted animals', software: 'Software, models and fonts',
      work: 'Work', author: 'Artist', date: 'Date', collection: 'Collection', source: 'Image source', licence: 'Licence status',
      file: 'Source file', species: 'Species', record: 'Source record', photographer: 'Photographer',
      recorded: 'Licence as recorded', via: 'Obtained from', item: 'Item', version: 'Version', use: 'Used for',
      tbv: 'to be verified', tbc: 'to be confirmed',
      photoNote: 'Each photograph links to its public observation record. The licence and attribution are shown as recorded there; photographer and licence are to be confirmed by the author before publication. The storybook illustrations are generated from these photographs by this project’s own code.',
      hostNote: 'The painted animals are cut from the public-domain paintings with Segment Anything (SAM); small hidden parts and the ground behind them were repainted with LaMa inpainting. The depth of each painting was estimated with Depth Anything V2.',
    },
    creditsData: {
      paintings: [
        { work: 'The Garden of Eden with the Fall of Man', author: 'Jan Brueghel the Elder and Peter Paul Rubens', date: '1615 (Commons); often given as c. 1615',
          collection: 'Mauritshuis, The Hague, inv. 253',
          source: 'https://commons.wikimedia.org/wiki/File:Jan_Brueghel_de_Oude_en_Peter_Paul_Rubens_-_Het_aards_paradijs_met_de_zondeval_van_Adam_en_Eva.jpg',
          licence: 'Public domain (Wikimedia Commons; reproduction marked CC Public Domain Mark 1.0)' },
        { work: 'Peaceable Kingdom', author: 'Edward Hicks', date: 'c. 1834',
          collection: 'National Gallery of Art, Washington, accession 1980.62.15, gift of Edgar William and Bernice Chrysler Garbisch (oil on canvas, 74.5 × 90.1 cm)',
          source: 'https://commons.wikimedia.org/wiki/File:Edward_Hicks,_Peaceable_Kingdom,_c._1834,_NGA_59908.jpg',
          licence: 'CC0 1.0 (National Gallery of Art Open Access, via Wikimedia Commons)' },
        { work: 'Fate of the Animals (Tierschicksale)', author: 'Franz Marc', date: '1913 (not stated on the Commons file page; to be verified)',
          collection: 'Kunstmuseum Basel (per Wikipedia; inventory number to be verified)',
          source: 'https://commons.wikimedia.org/wiki/File:Marc_tierschicksale.jpg',
          licence: 'Public domain (Wikimedia Commons; CC Public Domain Mark 1.0; source given as “reproduction from art book”)' },
      ],
      photos: [
              {
                      "file": "brown_bear_24160860.png",
                      "species": "Brown bear",
                      "record": "https://www.inaturalist.org/observations/16123410",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "your animal archive dataset"
              },
              {
                      "file": "domestic_cat_236808539.png",
                      "species": "Domestic cat",
                      "record": "https://www.inaturalist.org/observations/138537499",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "domestic_dog_251913625.png",
                      "species": "Domestic dog",
                      "record": "https://www.inaturalist.org/observations/146515389",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "grey_wolf_4909114.png",
                      "species": "Grey wolf",
                      "record": "https://www.inaturalist.org/observations/4126404",
                      "recorded": "cc-by · “(c) Desiree L. Narango, some rights reserved (CC BY)”",
                      "via": "your animal archive dataset"
              },
              {
                      "file": "hedgehog_203070926.png",
                      "species": "Hedgehog",
                      "record": "https://www.inaturalist.org/observations/120086772",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "horse_121483510.png",
                      "species": "Horse",
                      "record": "https://www.inaturalist.org/observations/74337960",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "lion_236419.png",
                      "species": "Lion",
                      "record": "https://www.inaturalist.org/observations/163263",
                      "recorded": "cc-by · “(c) 66dodge, some rights reserved (CC BY)”",
                      "via": "your animal archive dataset"
              },
              {
                      "file": "owl_324147361.png",
                      "species": "Barn owl",
                      "record": "https://www.inaturalist.org/observations/185588647",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "rabbit_78502673.png",
                      "species": "Rabbit",
                      "record": "https://www.inaturalist.org/observations/49453023",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "red_deer_10941056.png",
                      "species": "Red deer",
                      "record": "https://www.inaturalist.org/observations/8249012",
                      "recorded": "cc-by · “(c) Michael Bakker Paiva, some rights reserved (CC BY)”",
                      "via": "your animal archive dataset"
              },
              {
                      "file": "red_fox_2262475.png",
                      "species": "Red fox",
                      "record": "https://www.inaturalist.org/observations/1859843",
                      "recorded": "cc-by · “(c) botanygirl, some rights reserved (CC BY)”",
                      "via": "your animal archive dataset"
              },
              {
                      "file": "red_squirrel_171989381.png",
                      "species": "Red squirrel",
                      "record": "https://www.inaturalist.org/observations/102837347",
                      "recorded": "cc0 · “no rights reserved”",
                      "via": "iNaturalist, CC0 search, downloaded 2026-11-06"
              },
              {
                      "file": "tiger_50541307.png",
                      "species": "Tiger",
                      "record": "https://www.inaturalist.org/observations/32235759",
                      "recorded": "cc-by · “(c) wild_wind, some rights reserved (CC BY)”",
                      "via": "your animal archive dataset"
              }
      ],
      models3d: [{"file": "fox.glb", "name": "Fox", "source": "https://poly.pizza/m/Bc97C66HKi"}, {"file": "shiba_inu.glb", "name": "Shiba Inu", "source": "https://poly.pizza/m/y4wdQpg767"}, {"file": "husky.glb", "name": "Husky", "source": "https://poly.pizza/m/wcWiuEqwzq"}, {"file": "deer.glb", "name": "Deer", "source": "https://poly.pizza/m/T6Cs7tmMHJ"}, {"file": "stag.glb", "name": "Stag", "source": "https://poly.pizza/m/tQdzbZ1Cmw"}, {"file": "alpaca.glb", "name": "Alpaca", "source": "https://poly.pizza/m/bCVFD48i2l"}, {"file": "donkey.glb", "name": "Donkey", "source": "https://poly.pizza/m/qmX6nhnvp7"}, {"file": "white_horse.glb", "name": "White Horse", "source": "https://poly.pizza/m/bEdE4rmZy9"}, {"file": "zebra.glb", "name": "Zebra", "source": "https://poly.pizza/m/iclPBR6SBZ"}, {"file": "cow.glb", "name": "Cow", "source": "https://poly.pizza/m/26zM1outCr"}, {"file": "bull.glb", "name": "Bull", "source": "https://poly.pizza/m/a8PIIYwF7r"}],
      software: [
        { item: 'three.js (+ GLTFLoader, GLTFExporter, OrbitControls)', version: '0.170.0', use: 'Gallery, painting space, sculpture', licence: 'MIT' },
        { item: 'MediaPipe Tasks Vision', version: '0.10.14', use: 'Optional face and hand tracking', licence: 'Apache-2.0' },
        { item: 'MediaPipe hand_landmarker.task, blaze_face_short_range.tflite', version: 'float16 v1', use: 'Hand and face models', licence: 'Apache-2.0 per MediaPipe documentation (to be verified)' },
        { item: 'TensorFlow.js', version: '4.22.0', use: 'Runs the sketch classifier', licence: 'Apache-2.0' },
        { item: 'DoodleNet (ml5.js data and models)', version: 'labels from ml5@0.12.2', use: 'Sketch recognition (QuickDraw, 345 classes)', licence: 'ml5.js is MIT; model licence to be verified' },
        { item: 'Depth Anything V2 Small', version: 'depth-anything/Depth-Anything-V2-Small-hf', use: 'Depth maps of the paintings (offline)', licence: 'Apache-2.0 (tool only, not shipped)' },
        { item: 'Segment Anything (SAM)', version: 'facebook/sam-vit-base', use: 'Cutting out the painted animals (offline)', licence: 'Apache-2.0 (tool only, not shipped)' },
        { item: 'LaMa inpainting (big-lama)', version: 'via simple-lama-inpainting 0.1', use: 'Repainting hidden parts and ground (offline)', licence: 'Apache-2.0 (tool only, not shipped; to be verified)' },
        { item: 'Blender', version: '5.2.3 LTS', use: 'Relief models (blender/make_relief.py)', licence: 'GPL (tool only, not shipped)' },
        { item: 'rembg (isnet-general-use)', version: '2.0.87', use: 'Background removal of photographs (offline)', licence: 'MIT (tool only, not shipped)' },
        { item: 'Cormorant Garamond, Inter, IBM Plex Mono', version: 'Fontsource 5.1.0', use: 'Typography', licence: 'SIL Open Font License 1.1' },
      ],
    },

    footer: 'Animals in the Archive · a student project by Yiduo Wang, University of London',
  },
};

STRINGS.zh = zh;
STRINGS.ko = ko;
export const LANGS = [['en', 'EN'], ['zh', '中文'], ['ko', '한국어']];
export const LANG = new URLSearchParams(location.search).get('lang') in STRINGS
  ? new URLSearchParams(location.search).get('lang') : 'en';

// Korean particles depend on the word before them (a final consonant or not), and names
// are only known at run time: "{name}(이)야", "을(를)", "은(는)", "이(가)", "와(과)", "(으)로"
// become the right form once the name is in. Latin names keep the written-out form.
const JOSA = [['(이)', '이', ''], ['(으)로', '으로', '로'], ['을(를)', '을', '를'], ['은(는)', '은', '는'], ['이(가)', '이', '가'], ['와(과)', '과', '와']];
export function localize(s) {
  if (LANG !== 'ko' || typeof s !== 'string') return s;
  for (const [mark, withC, without] of JOSA) {
    let i = s.indexOf(mark);
    while (i > 0) {
      const c = s.charCodeAt(i - 1);
      if (c >= 0xac00 && c <= 0xd7a3) {
        const fin = (c - 0xac00) % 28;
        const form = mark === '(으)로' ? (fin && fin !== 8 ? withC : without) : (fin ? withC : without);
        s = s.slice(0, i) + form + s.slice(i + mark.length);
      }
      i = s.indexOf(mark, i + 1);
    }
  }
  return s;
}

// t('roles.author.name') or t('indexCount', {n: 3})
export function t(key, vars = {}) {
  const get = lang => key.split('.').reduce((o, k) => (o ? o[k] : undefined), STRINGS[lang]);
  const val = get(LANG) ?? get('en') ?? key;
  return typeof val === 'string'
    ? localize(val.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)))
    : val;
}
