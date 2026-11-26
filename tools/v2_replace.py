"""Swap works that are not paintings (a ceramic, a lacquer box…) out of js/collection.json for
other candidates of an under-represented style, download them, then run tools/v2_analyse.py on them.
Usage: python tools/v2_replace.py"""
import json, os, re, sys, subprocess, collections
sys.path.insert(0, os.path.dirname(__file__))
sys.argv = sys.argv[:1]
import harvest_paintings as h

ROOT = h.ROOT
col = json.load(open(os.path.join(ROOT, 'js/collection.json')))
NOT_PAINTING = re.compile(r'terracotta|lacquer|porcelain|ceramic|stoneware|earthenware|glass|enamel', re.I)
bad = [c for c in col if NOT_PAINTING.search(c.get('medium', '') + ' ' + c['title'])]
keep = [c for c in col if c not in bad]
print('removing', [c['id'] for c in bad])
cands = json.load(open(os.path.join(ROOT, 'tools/v2_candidates.json')))
have = {c['id'] for c in keep}
count = collections.Counter(c['bucket'] for c in keep)
pool = [c for c in cands if c['id'] not in have and not NOT_PAINTING.search(c.get('medium', '') + ' ' + c['title']) and c.get('image')]
for c in pool: c['bucket'] = h.bucket(c)
pool.sort(key=lambda c: count[c['bucket']])
new = []
for c in pool:
    if len(new) >= len(bad): break
    got = h.fetch(dict(c))
    if got: got.pop('image', None); new.append(got); count[got['bucket']] += 1
keep += new
json.dump(keep, open(os.path.join(ROOT, 'js/collection.json'), 'w'), indent=1, ensure_ascii=False)
print('added', [(c['id'], c['title'][:40], c['bucket']) for c in new])
if new: subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools/v2_analyse.py')] + [c['id'] for c in new], check=False)
