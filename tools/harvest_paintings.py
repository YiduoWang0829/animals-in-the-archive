"""Harvest ~200 public-domain paintings with animals from three open-access museum APIs
(Art Institute of Chicago, The Met, Cleveland Museum of Art; all CC0 / public domain),
balanced across animals and across styles / periods / cultures.

Usage:  python tools/harvest_paintings.py [N=200]
Writes  assets/paintings/v2/<id>.jpg (long side 1400), assets/paintings/v2/thumbs/<id>.webp
        and tools/v2_candidates.json (every candidate) + js/collection.json (the chosen N).
Depth maps and the per-painting style analysis come after: tools/v2_analyse.py.
"""
import json, os, re, sys, time, random, io, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

UA = {'User-Agent': 'animals-in-the-archive/2.0 (open-access harvester)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/paintings/v2')
os.makedirs(os.path.join(OUT, 'thumbs'), exist_ok=True)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 200

# kind -> search words (first one is the query), regex for matching titles/tags
KINDS = {
  'cat': ['cat', r'\b(cats?|kittens?|kitty)\b'],
  'dog': ['dog', r'\b(dogs?|hounds?|puppy|puppies|spaniel|terrier|poodle|greyhound|setter|pointer)\b'],
  'horse': ['horse', r'\b(horses?|mares?|stallions?|ponies|pony|colts?|foals?|steeds?|horsemen|cavalry|horseman)\b'],
  'cattle': ['cattle', r'\b(cattle|cows?|oxen|ox|bulls?|calf|calves|herd)\b'],
  'sheep': ['sheep', r'\b(sheep|lambs?|ewes?|flock|shepherd)\b'],
  'goat': ['goat', r'\b(goats?|kids)\b'],
  'deer': ['deer', r'\b(deer|stags?|does|fawns?|hinds?|elk|reindeer|antelopes?)\b'],
  'lion': ['lion', r'\b(lions?|lioness)\b'],
  'tiger': ['tiger', r'\b(tigers?|tigress)\b'],
  'leopard': ['leopard', r'\b(leopards?|panthers?|jaguars?|cheetahs?)\b'],
  'bear': ['bear', r'\b(bears?)\b'],
  'wolf': ['wolf', r'\b(wolf|wolves)\b'],
  'fox': ['fox', r'\b(fox|foxes)\b'],
  'rabbit': ['rabbit', r'\b(rabbits?|hares?|bunny)\b'],
  'monkey': ['monkey', r'\b(monkeys?|apes?|gibbons?|macaques?)\b'],
  'elephant': ['elephant', r'\b(elephants?)\b'],
  'giraffe': ['giraffe', r'\b(giraffes?)\b'],
  'camel': ['camel', r'\b(camels?|dromedar)'],
  'donkey': ['donkey', r'\b(donkeys?|ass|mules?)\b'],
  'pig': ['pig', r'\b(pigs?|swine|hogs?|boars?|sows?)\b'],
  'bird': ['birds', r'\b(birds?|sparrows?|finch|magpies?|crows?|ravens?|swallows?|pigeons?|doves?)\b'],
  'owl': ['owl', r'\b(owls?)\b'],
  'eagle': ['eagle', r'\b(eagles?|hawks?|falcons?)\b'],
  'duck': ['duck', r'\b(ducks?|geese|goose|swans?|mallards?)\b'],
  'rooster': ['rooster', r'\b(roosters?|cocks?|hens?|chickens?|poultry)\b'],
  'peacock': ['peacock', r'\b(peacocks?|peafowl|pheasants?)\b'],
  'parrot': ['parrot', r'\b(parrots?|cockatoos?|macaws?)\b'],
  'crane': ['crane', r'\b(cranes?|herons?|egrets?|storks?)\b'],
  'fish': ['fish', r'\b(fish|carp|koi|trout|salmon)\b'],
  'squirrel': ['squirrel', r'\b(squirrels?)\b'],
  'frog': ['frog', r'\b(frogs?|toads?)\b'],
}
# words that also mean "this is a still life / dead game" — skip, we want living animals
DEAD = re.compile(r'\b(dead|game piece|still life|trophy|hunt(ing)? trophy|carcass|butcher)', re.I)

def get(url, data=None, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={**UA, **({'Content-Type': 'application/json'} if data else {})})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(1.5 * (i + 1))

def getj(url, data=None):
    return json.loads(get(url, data))

def kinds_of(text):
    t = text.lower()
    return [k for k, (_, rx) in KINDS.items() if re.search(rx, t)]

cands = {}

def add(c):
    if not c['image'] or DEAD.search(c['title'] or ''): return
    c['kinds'] = kinds_of(' '.join([c['title'] or ''] + c.get('tags', [])))
    if not c['kinds']: return
    cands.setdefault(c['id'], c)

# ---- Art Institute of Chicago ----
def aic(kind, q):
    body = {'q': q, 'limit': 60, 'fields': 'id,title,artist_title,date_display,date_start,image_id,style_title,classification_title,subject_titles,medium_display,place_of_origin,is_public_domain,thumbnail',
            'query': {'bool': {'must': [{'term': {'is_public_domain': True}}, {'term': {'classification_title.keyword': 'painting'}}, {'exists': {'field': 'image_id'}}]}}}
    try: d = getj('https://api.artic.edu/api/v1/artworks/search', json.dumps(body).encode())
    except Exception as e: print('aic fail', kind, e); return
    for x in d.get('data', []):
        if not x.get('image_id'): continue
        w = (x.get('thumbnail') or {}).get('width') or 0
        add({'id': f"aic-{x['id']}", 'museum': 'Art Institute of Chicago', 'title': x['title'], 'artist': x.get('artist_title') or 'Unknown',
             'date': x.get('date_display') or '', 'year': x.get('date_start'), 'style': x.get('style_title') or '', 'medium': x.get('medium_display') or '',
             'place': x.get('place_of_origin') or '', 'tags': x.get('subject_titles') or [],
             'image': f"https://www.artic.edu/iiif/2/{x['image_id']}/full/1400,/0/default.jpg",
             'url': f"https://www.artic.edu/artworks/{x['id']}", 'licence': 'CC0 (public domain)'})

# ---- The Met (v1.1 search) ----
def met(kind, q):
    try: d = getj('https://collectionapi.metmuseum.org/public/collection/v1.1/search?' + urllib.parse.urlencode({'hasImages': 'true', 'medium': 'Paintings', 'q': q, 'limit': 40}))
    except Exception as e: print('met fail', kind, e); return
    for oid in (d.get('objectIDs') or [])[:40]:
        try: x = getj(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}')
        except Exception: continue
        if not x.get('isPublicDomain') or not x.get('primaryImage'): continue
        add({'id': f'met-{oid}', 'museum': 'The Metropolitan Museum of Art', 'title': x['title'], 'artist': x.get('artistDisplayName') or 'Unknown',
             'date': x.get('objectDate') or '', 'year': x.get('objectBeginDate'), 'style': x.get('period') or x.get('dynasty') or '', 'medium': x.get('medium') or '',
             'place': x.get('culture') or x.get('country') or '', 'tags': [t['term'] for t in (x.get('tags') or [])],
             'image': x['primaryImage'], 'url': x.get('objectURL'), 'licence': 'CC0 (Open Access)'})
        time.sleep(0.05)

# ---- Cleveland Museum of Art ----
def cma(kind, q):
    try: d = getj('https://openaccess-api.clevelandart.org/api/artworks/?' + urllib.parse.urlencode({'q': q, 'type': 'Painting', 'cc0': 1, 'has_image': 1, 'limit': 60}))
    except Exception as e: print('cma fail', kind, e); return
    for x in d.get('data', []):
        im = (x.get('images') or {})
        best = (im.get('print') or im.get('web') or {}).get('url')
        cr = x.get('creators') or []
        add({'id': f"cma-{x['id']}", 'museum': 'Cleveland Museum of Art', 'title': x['title'], 'artist': re.sub(r'\s*\(.*', '', cr[0]['description']) if cr else 'Unknown',
             'date': x.get('creation_date') or '', 'year': x.get('creation_date_earliest'), 'style': '', 'medium': x.get('technique') or '',
             'place': ', '.join(x.get('culture') or []), 'tags': [],
             'image': best, 'url': x.get('url'), 'licence': 'CC0'})

# European / modern / American painting departments, where the movements are
def met_dept(kind, q, dept):
    try: d = getj('https://collectionapi.metmuseum.org/public/collection/v1.1/search?' + urllib.parse.urlencode({'hasImages': 'true', 'departmentId': dept, 'q': q, 'limit': 30}))
    except Exception as e: print('met dept fail', kind, e); return
    for oid in (d.get('objectIDs') or [])[:30]:
        if f'met-{oid}' in cands: continue
        try: x = getj(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}')
        except Exception: continue
        if not x.get('isPublicDomain') or not x.get('primaryImage') or 'Painting' not in (x.get('classification') or ''): continue
        add({'id': f'met-{oid}', 'museum': 'The Metropolitan Museum of Art', 'title': x['title'], 'artist': x.get('artistDisplayName') or 'Unknown',
             'date': x.get('objectDate') or '', 'year': x.get('objectBeginDate'), 'style': x.get('period') or '', 'medium': x.get('medium') or '',
             'place': x.get('culture') or x.get('artistNationality') or '', 'tags': [t['term'] for t in (x.get('tags') or [])],
             'image': x['primaryImage'], 'url': x.get('objectURL'), 'licence': 'CC0 (Open Access)'})

def cma_dept(kind, q, dept):
    try: d = getj('https://openaccess-api.clevelandart.org/api/artworks/?' + urllib.parse.urlencode({'q': q, 'type': 'Painting', 'cc0': 1, 'has_image': 1, 'limit': 40, 'department': dept}))
    except Exception as e: print('cma dept fail', kind, e); return
    for x in d.get('data', []):
        im = (x.get('images') or {}); best = (im.get('print') or im.get('web') or {}).get('url'); cr = x.get('creators') or []
        add({'id': f"cma-{x['id']}", 'museum': 'Cleveland Museum of Art', 'title': x['title'], 'artist': re.sub(r'\s*\(.*', '', cr[0]['description']) if cr else 'Unknown',
             'date': x.get('creation_date') or '', 'year': x.get('creation_date_earliest'), 'style': '', 'medium': x.get('technique') or '',
             'place': ', '.join(x.get('culture') or []), 'tags': [], 'image': best, 'url': x.get('url'), 'licence': 'CC0'})

MOVEMENT_ARTISTS = ['Degas', 'Courbet', 'Rosa Bonheur', 'Cassatt', 'Manet', 'Monet', 'Renoir', 'Pissarro', 'Morisot', 'Sargent', 'Chase', 'Hassam',
  'Gauguin', 'Van Gogh', 'Cézanne', 'Toulouse-Lautrec', 'Bonnard', 'Vuillard', 'Redon', 'Seurat', 'Signac', 'Henri-Edmond Cross', 'Luce',
  'Franz Marc', 'Kandinsky', 'August Macke', 'Matisse', 'Derain', 'Dufy', 'Marquet', 'Rouault', 'Munch', 'Picasso', 'Braque', 'Gris', 'Léger',
  'Delaunay', 'Chagall', 'Feininger', 'Klee', 'Edward Hicks', 'Henri Rousseau', 'Ammi Phillips', 'Joseph Pickett', 'folk art', 'Gericault', 'Delacroix',
  'Landseer', 'Stubbs', 'Potter', 'Troyon', 'Millet', 'Homer', 'Remington', 'Russell', 'Audubon', 'Bellows', 'Sorolla', 'Liebermann', 'Segantini']
def met_artist(name):
    try: d = getj('https://collectionapi.metmuseum.org/public/collection/v1.1/search?' + urllib.parse.urlencode({'hasImages': 'true', 'artistOrCulture': 'true', 'q': name, 'limit': 60}))
    except Exception as e: print('met artist fail', name, e); return
    for oid in (d.get('objectIDs') or [])[:60]:
        if f'met-{oid}' in cands: continue
        try: x = getj(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}')
        except Exception: continue
        if not x.get('isPublicDomain') or not x.get('primaryImage') or 'Painting' not in (x.get('classification') or ''): continue
        add({'id': f'met-{oid}', 'museum': 'The Metropolitan Museum of Art', 'title': x['title'], 'artist': x.get('artistDisplayName') or 'Unknown',
             'date': x.get('objectDate') or '', 'year': x.get('objectBeginDate'), 'style': x.get('period') or '', 'medium': x.get('medium') or '',
             'place': x.get('culture') or x.get('artistNationality') or '', 'tags': [t['term'] for t in (x.get('tags') or [])],
             'image': x['primaryImage'], 'url': x.get('objectURL'), 'licence': 'CC0 (Open Access)'})
def cma_artist(name):
    try: d = getj('https://openaccess-api.clevelandart.org/api/artworks/?' + urllib.parse.urlencode({'artists': name, 'type': 'Painting', 'cc0': 1, 'has_image': 1, 'limit': 80}))
    except Exception as e: print('cma artist fail', name, e); return
    for x in d.get('data', []):
        im = (x.get('images') or {}); best = (im.get('print') or im.get('web') or {}).get('url'); cr = x.get('creators') or []
        add({'id': f"cma-{x['id']}", 'museum': 'Cleveland Museum of Art', 'title': x['title'], 'artist': re.sub(r'\s*\(.*', '', cr[0]['description']) if cr else 'Unknown',
             'date': x.get('creation_date') or '', 'year': x.get('creation_date_earliest'), 'style': '', 'medium': x.get('technique') or '',
             'place': ', '.join(x.get('culture') or []), 'tags': [], 'image': best, 'url': x.get('url'), 'licence': 'CC0'})

def nga(folder):
    # National Gallery of Art, Washington: open data (CC0) from github.com/NationalGalleryOfArt/opendata
    import csv
    csv.field_size_limit(10**8)
    imgs = {}
    for r in csv.DictReader(open(os.path.join(folder, 'published_images.csv'), encoding='utf-8')):
        if r['viewtype'] == 'primary' and r['openaccess'] == '1': imgs[r['depictstmsobjectid']] = r
    terms = {}
    for r in csv.DictReader(open(os.path.join(folder, 'objects_terms.csv'), encoding='utf-8')):
        if r.get('termtype') in ('Keyword', 'Theme', 'Style'): terms.setdefault(r['objectid'], []).append(r['term'])
    n = 0
    for r in csv.DictReader(open(os.path.join(folder, 'objects.csv'), encoding='utf-8')):
        if r['classification'] != 'Painting' or r['objectid'] not in imgs: continue
        im = imgs[r['objectid']]
        tg = terms.get(r['objectid'], [])
        style = ' '.join(t for t in tg if re.search(r'ism|naive|folk', t, re.I))
        c = {'id': f"nga-{r['objectid']}", 'museum': 'National Gallery of Art, Washington', 'title': r['title'], 'artist': r['attribution'] or 'Unknown',
             'date': r['displaydate'], 'year': int(r['beginyear']) if r['beginyear'].isdigit() else None, 'style': style, 'medium': r['medium'],
             'place': '', 'tags': tg + [im.get('assistivetext', '')[:400]],
             'image': im['iiifurl'] + '/full/!1400,1400/0/default.jpg', 'url': f"https://www.nga.gov/collection/art-object-page.{r['objectid']}.html", 'licence': 'CC0 (NGA Open Access)'}
        before = len(cands); add(c); n += len(cands) - before
    print('nga', n)

def harvest_artists():
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(met_artist, MOVEMENT_ARTISTS)); list(ex.map(cma_artist, MOVEMENT_ARTISTS))

def harvest():
    jobs = []
    with ThreadPoolExecutor(6) as ex:
        for k, (q, _) in KINDS.items():
            for f in (met, cma): jobs.append(ex.submit(f, k, q))
            for dept in (11, 21, 1): jobs.append(ex.submit(met_dept, k, q, dept))
            for dept in ('Modern European Painting and Sculpture', 'European Painting and Sculpture', 'American Painting and Sculpture'):
                jobs.append(ex.submit(cma_dept, k, q, dept))
        for j in jobs: j.result()
    print('candidates', len(cands))

# ---- style buckets: what the visitor will be turned into ----
ARTISTS = {
  'impressionist': 'monet|renoir|pissarro|sisley|morisot|cassatt|degas|manet|caillebotte|guillaumin|bazille|boudin|jongkind|sargent|chase|hassam|twachtman|liebermann|sorolla|mancini',
  'postimpressionist': 'gauguin|van gogh|c[ée]zanne|toulouse|bonnard|vuillard|redon|denis|s[ée]rusier|b[ée]rnard|anquetin|munch|hodler|segantini|ensor',
  'pointillist': 'seurat|signac|cross|luce|rysselberghe|angrand|dubois-pillet|petitjean',
  'expressionist': 'franz marc|kandinsky|macke|matisse|derain|vlaminck|kirchner|nolde|jawlensky|m[üu]nter|rouault|pechstein|heckel|dufy|marquet|kokoschka|schiele|campendonk',
  'cubist': 'picasso|braque|gris|l[ée]ger|delaunay|gleizes|metzinger|villon|marcoussis|duchamp|feininger|kupka|marc chagall|chagall',
  'folk': 'hicks|rousseau|phillips|pickett|bombois|vivin|folk|naive|limner|unidentified american',
  'realist': 'courbet|bonheur|troyon|millet|homer|landseer|bellows|remington|russell|audubon|potter',
  'romantic': 'g[ée]ricault|delacroix|stubbs',
}

def bucket(c):
    s = ' '.join([c['style'], c['medium'], c['place'], c['title'], c['artist']]).lower()
    y = c.get('year') or 1800
    for b, rx in ARTISTS.items():
        if re.search(r'\b(' + rx + r')\b', c['artist'].lower()): return b
    if re.search(r'japan|edo|meiji|ukiyo', s): return 'japan'
    if re.search(r'china|chinese|qing|ming|song dynasty|yuan|korea', s): return 'china'
    if re.search(r'india|mughal|rajput|persia|iran|deccan|pahari', s): return 'miniature'
    if re.search(r'cubis|abstract|futuris|orphis|constructiv', s): return 'cubist'
    if re.search(r'expression|fauv|blaue reiter|die br', s): return 'expressionist'
    if re.search(r'pointill|neo-impression|divisionis', s): return 'pointillist'
    if re.search(r'post-impression|nabis|symbolis', s): return 'postimpressionist'
    if re.search(r'impression', s): return 'impressionist'
    if re.search(r'folk|naive|na[iï]f|american primitive|itinerant', s): return 'folk'
    if y and y >= 1905: return 'modern'
    if y and y >= 1860: return 'impressionist' if re.search(r'monet|renoir|pissarro|sisley|morisot|cassatt|degas|caillebotte', s) else 'realist'
    if y and y >= 1750: return 'romantic'
    if y and y >= 1580: return 'baroque'
    return 'early'

def choose():
    rng = random.Random(7)
    pool = list(cands.values()); rng.shuffle(pool)
    seen = {}
    def series(c): return re.sub(r'[^a-z]', '', (c['title'] or '').lower())[:14]
    pool2 = []
    for c in pool:
        k = series(c); seen[k] = seen.get(k, 0) + 1
        if seen[k] <= 2: pool2.append(c)
    pool = pool2
    for c in pool: c['bucket'] = bucket(c)
    picked, used = [], set()
    by_b = {}
    for c in pool: by_b.setdefault(c['bucket'], []).append(c)
    kind_count = {k: 0 for k in KINDS}
    # round-robin over styles, inside each style prefer the least-represented animal
    CAP = {'miniature': 18, 'japan': 22, 'china': 20, 'early': 10, 'folk': 24, 'realist': 26, 'romantic': 24, 'baroque': 24}
    while len(picked) < N and any(by_b.values()):
        progressed = False
        for b in sorted(by_b):
            lst = by_b[b]
            if not lst or sum(1 for c in picked if c['bucket'] == b) >= CAP.get(b, 999): continue
            lst.sort(key=lambda c: min(kind_count[k] for k in c['kinds']))
            c = lst.pop(0)
            picked.append(c); progressed = True
            for k in c['kinds']: kind_count[k] += 1
            if len(picked) >= N: break
        if not progressed: break
    print('buckets', {b: sum(1 for c in picked if c['bucket'] == b) for b in by_b})
    print('kinds', kind_count)
    return picked

def fetch(c):
    jpg = os.path.join(OUT, c['id'] + '.jpg')
    if not os.path.exists(jpg):
        try:
            im = Image.open(io.BytesIO(get(c['image']))).convert('RGB')
        except Exception as e:
            print('img fail', c['id'], e); return None
        im.thumbnail((1400, 1400), Image.LANCZOS)
        if min(im.size) < 360: return None
        im.save(jpg, quality=84, optimize=True, progressive=True)
        t = im.copy(); t.thumbnail((420, 420), Image.LANCZOS)
        t.save(os.path.join(OUT, 'thumbs', c['id'] + '.webp'), quality=78)
    with Image.open(jpg) as im: c['size'] = list(im.size)
    return c

if __name__ == '__main__':
    cf = os.path.join(ROOT, 'tools/v2_candidates.json')
    if os.path.exists(cf) and '--refresh' not in sys.argv:
        cands.update({c['id']: c for c in json.load(open(cf))})
        if '--nga' in sys.argv:
            nga(sys.argv[sys.argv.index('--nga') + 1]); json.dump(list(cands.values()), open(cf, 'w'), indent=1, ensure_ascii=False)
        if '--artists' in sys.argv:
            harvest_artists(); json.dump(list(cands.values()), open(cf, 'w'), indent=1, ensure_ascii=False)
    else:
        harvest(); json.dump(list(cands.values()), open(cf, 'w'), indent=1, ensure_ascii=False)
    chosen = choose()
    with ThreadPoolExecutor(8) as ex: got = [c for c in ex.map(fetch, chosen) if c]
    # top up if some images failed
    extra = [c for c in cands.values() if c['id'] not in {g['id'] for g in got}]
    random.Random(3).shuffle(extra)
    CAPS = {'miniature': 18, 'japan': 22, 'china': 20, 'early': 10, 'folk': 24, 'realist': 26, 'romantic': 24, 'baroque': 24}
    extra.sort(key=lambda c: sum(1 for g in got if g['bucket'] == bucket(c)))
    for c in extra:
        if len(got) >= N: break
        c['bucket'] = bucket(c)
        if sum(1 for g in got if g['bucket'] == c['bucket']) >= CAPS.get(c['bucket'], 999): continue
        if fetch(c): got.append(c)
    for c in got: c.pop('image', None)
    json.dump(got, open(os.path.join(ROOT, 'js/collection.json'), 'w'), indent=1, ensure_ascii=False)
    print('saved', len(got))
