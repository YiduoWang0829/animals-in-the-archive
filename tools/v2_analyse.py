"""Read every painting of the collection the way the site needs it (resumable).

For each work in js/collection.json:
  depth     Depth Anything V2 Small -> assets/paintings/v2/depth/<id>.png (white = near)
  palette   7 colours (k-means in Lab), sorted dark -> light, with weights
  stats     saturation, edge density, sky share, horizon
  look      how a visitor is re-made inside it: oil, gilded, splat, dots, facet, ink,
            woodblock, flat  (from the style bucket + the picture's own statistics)
  parts     painted animals and things (OWLv2 open-vocabulary detection, then SAM masks):
            assets/paintings/v2/parts/<id>-<n>.webp, cut out with a feathered edge
  plate     the painting with every part removed and repainted by LaMa:
            assets/paintings/v2/plate/<id>.jpg (the collage's empty world)
Usage: python tools/v2_analyse.py [ids...]   (results are merged back into js/collection.json)
"""
import json, os, sys, math, time
import numpy as np
import cv2
import torch
from PIL import Image, ImageFilter
from transformers import pipeline, SamModel, SamProcessor, Owlv2Processor, Owlv2ForObjectDetection
from simple_lama_inpainting.utils import prepare_img_and_mask, download_model
from simple_lama_inpainting.models.model import LAMA_MODEL_URL

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'assets/paintings/v2')
for d in ('depth', 'parts', 'plate'): os.makedirs(os.path.join(V2, d), exist_ok=True)
COL = os.path.join(ROOT, 'js/collection.json')
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'

print('loading models on', dev, flush=True)
depth_pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device=dev)
owl_proc = Owlv2Processor.from_pretrained('google/owlv2-base-patch16-ensemble')
owl = Owlv2ForObjectDetection.from_pretrained('google/owlv2-base-patch16-ensemble').to(dev).eval()
sam_proc = SamProcessor.from_pretrained('facebook/sam-vit-base')
sam = SamModel.from_pretrained('facebook/sam-vit-base').to(dev).eval()
lama = torch.jit.load(download_model(LAMA_MODEL_URL), map_location='cpu').eval()

# what the detector is asked to find, by animal kind (painting words help on old pictures)
QUERY = {
  'cat': 'a cat', 'dog': 'a dog', 'horse': 'a horse', 'cattle': 'a cow', 'sheep': 'a sheep', 'goat': 'a goat',
  'deer': 'a deer', 'lion': 'a lion', 'tiger': 'a tiger', 'leopard': 'a leopard', 'bear': 'a bear', 'wolf': 'a wolf',
  'fox': 'a fox', 'rabbit': 'a rabbit', 'monkey': 'a monkey', 'elephant': 'an elephant', 'giraffe': 'a giraffe',
  'camel': 'a camel', 'donkey': 'a donkey', 'pig': 'a pig', 'bird': 'a bird', 'owl': 'an owl', 'eagle': 'an eagle',
  'duck': 'a duck', 'rooster': 'a rooster', 'peacock': 'a peacock', 'parrot': 'a parrot', 'crane': 'a crane bird',
  'fish': 'a fish', 'squirrel': 'a squirrel', 'frog': 'a frog',
}
THINGS = {'tree': 'a tree', 'house': 'a house', 'person': 'a person', 'boat': 'a boat', 'flower': 'flowers',
          'rock': 'a rock', 'moon': 'the moon or the sun', 'mountain': 'a mountain', 'branch': 'a branch with leaves'}

LOOK = {'early': 'gilded', 'baroque': 'oil', 'romantic': 'oil', 'realist': 'oil', 'impressionist': 'splat',
        'pointillist': 'dots', 'postimpressionist': 'splat', 'expressionist': 'facet', 'cubist': 'facet',
        'modern': 'facet', 'japan': 'woodblock', 'china': 'ink', 'miniature': 'flat', 'folk': 'flat'}

def palette(im):
    a = np.array(im.convert('RGB').resize((160, 160)), dtype=np.uint8)
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    _, lab_l, cen = cv2.kmeans(lab, 7, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    w = np.bincount(lab_l.ravel(), minlength=7) / lab_l.size
    rgb = cv2.cvtColor(cen.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    order = np.argsort(cen[:, 0])
    return [{'c': '#%02x%02x%02x' % tuple(int(v) for v in rgb[i]), 'w': round(float(w[i]), 3)} for i in order]

def stats(im, d):
    a = np.array(im.convert('RGB').resize((320, 320)))
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV)
    sat = float(hsv[..., 1].mean() / 255)
    g = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY)
    edges = float((cv2.Canny(g, 80, 160) > 0).mean())
    dd = cv2.resize(d, (320, 320))
    top = dd[:80]
    sky = float(((top < 0.25) & (g[:80] > 110)).mean())
    rows = dd.mean(1)
    near = np.where(rows > np.median(rows))[0]
    horizon = float(near.min() / 320) if len(near) else 0.5
    return {'sat': round(sat, 3), 'edges': round(edges, 3), 'sky': round(sky, 3), 'horizon': round(horizon, 3), 'light': round(float(g.mean() / 255), 3)}

def choose_look(c, st):
    look = LOOK.get(c.get('bucket'), 'oil')
    if look == 'facet' and st['edges'] < 0.05 and st['sat'] < 0.3: look = 'flat'
    if look == 'oil' and st['sat'] > 0.45 and st['edges'] > 0.12: look = 'splat'
    if look == 'woodblock' and st['sat'] < 0.12: look = 'ink'
    return look

@torch.inference_mode()
def detect(im, kinds):
    names = [(k, QUERY[k], 'animal') for k in kinds if k in QUERY]
    names += [('animal', 'an animal', 'animal'), ('bird', 'a bird', 'animal')] if 'bird' not in kinds else [('animal', 'an animal', 'animal')]
    names += [(k, q, 'thing') for k, q in THINGS.items()]
    texts = [[q for _, q, _ in names]]
    small = im.copy(); small.thumbnail((960, 960))
    inp = owl_proc(text=texts, images=small, return_tensors='pt').to(dev)
    out = owl(**inp)
    S = max(small.size)                                    # OWLv2 pads to a square
    res = owl_proc.image_processor.post_process_object_detection(out, threshold=0.06, target_sizes=torch.tensor([[S, S]]).to(dev))[0]
    sc = im.size[0] / small.size[0]
    found = []
    for box, score, lab in zip(res['boxes'].cpu().numpy(), res['scores'].cpu().numpy(), res['labels'].cpu().numpy()):
        k, _, typ = names[lab]
        b = np.clip(box * sc, 0, [im.size[0], im.size[1], im.size[0], im.size[1]])
        if (b[2] - b[0]) * (b[3] - b[1]) < 0.0015 * im.size[0] * im.size[1]: continue        # too small to be a figure
        if (b[2] - b[0]) * (b[3] - b[1]) > 0.7 * im.size[0] * im.size[1]: continue           # the whole picture
        found.append({'kind': k, 'type': typ, 'score': float(score), 'box': b.tolist()})
    # keep the confident ones; in an abstract picture keep at least the two best animal guesses
    weak = sorted([f for f in found if f['type'] == 'animal'], key=lambda f: -f['score'])[:2]
    found = [f for f in found if f['score'] >= (0.14 if f['type'] == 'animal' else 0.22)]
    if not any(f['type'] == 'animal' for f in found): found += weak
    # non-maximum suppression across labels (an animal beats a thing on the same spot)
    found.sort(key=lambda f: (f['type'] != 'animal', -f['score']))
    keep = []
    for f in found:
        if any(iou(f['box'], g['box']) > 0.45 for g in keep): continue
        keep.append(f)
    # generic "an animal" takes the painting's own kind when it overlaps nothing better
    for f in keep:
        if f['kind'] == 'animal': f['kind'] = kinds[0] if kinds else 'animal'
    a = [f for f in keep if f['type'] == 'animal'][:7]
    t = [f for f in keep if f['type'] == 'thing'][:7]
    return a + t

def iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    i = max(0, x1 - x0) * max(0, y1 - y0)
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u else 0

@torch.inference_mode()
def segment(im, box):
    inp = sam_proc(im, input_boxes=[[[float(v) for v in box]]], return_tensors='pt')
    sizes = (inp['original_sizes'].clone(), inp['reshaped_input_sizes'].clone())
    inp = {k: (v.float() if v.is_floating_point() else v).to(dev) for k, v in inp.items()}
    out = sam(pixel_values=inp['pixel_values'], input_boxes=inp['input_boxes'], multimask_output=True)
    masks = sam_proc.image_processor.post_process_masks(out.pred_masks.cpu(), sizes[0], sizes[1])[0][0]
    best = int(out.iou_scores[0, 0].argmax())
    m = masks[best].numpy().astype(np.uint8)
    # keep the largest component inside the box, close pin holes
    x0, y0, x1, y1 = [int(v) for v in box]
    clip = np.zeros_like(m); clip[y0:y1, x0:x1] = 1; m = m * clip
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1: m = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return m

def inpaint(im, mask):
    img, m = prepare_img_and_mask(im, Image.fromarray(mask * 255), torch.device('cpu'))
    with torch.inference_mode():
        out = lama(img, m)[0].permute(1, 2, 0).cpu().numpy()
    return Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8)).resize(im.size)

def analyse(c):
    src = os.path.join(ROOT, c.get('file') or f"assets/paintings/v2/{c['id']}.jpg")
    im = Image.open(src).convert('RGB')
    small = im.copy(); small.thumbnail((768, 768))
    d = np.array(depth_pipe(small)['predicted_depth'].squeeze().cpu(), dtype=np.float32)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    dimg = Image.fromarray((d * 255).astype(np.uint8)).resize(small.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.0))
    dsm = dimg.copy(); dsm.thumbnail((512, 512)); dsm.save(os.path.join(V2, 'depth', c['id'] + '.png'))
    dn = np.array(dimg.resize((256, 256)), dtype=np.float32) / 255
    c['palette'] = palette(im)
    c['stats'] = stats(im, dn)
    c['look'] = choose_look(c, c['stats'])
    # parts: the painted animals and things that can be moved
    work = im.copy(); work.thumbnail((1400, 1400)); W, H = work.size
    dets = detect(work, c.get('kinds', []))
    union = np.zeros((H, W), np.uint8)
    parts = []
    for n, f in enumerate(dets):
        m = segment(work, f['box'])
        if m.sum() < 0.0008 * W * H: continue
        ys, xs = np.where(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        a = Image.fromarray((cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0) * 255).clip(0, 255).astype(np.uint8))
        rgba = work.copy(); rgba.putalpha(a)
        crop = rgba.crop((x0, y0, x1, y1))
        if max(crop.size) > 640: crop.thumbnail((640, 640))
        fn = f"{c['id']}-{n}.webp"
        crop.save(os.path.join(V2, 'parts', fn), quality=82)
        cy = np.array(dimg.resize((W, H)))[m > 0]
        parts.append({'kind': f['kind'], 'type': f['type'], 'score': round(f['score'], 3), 'file': fn,
                      'box': [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)],
                      'depth': round(float(np.median(cy)) / 255, 3), 'area': round(float(m.sum()) / (W * H), 4)})
        union |= m
    c['parts'] = parts
    if union.any():
        um = cv2.dilate(union, np.ones((15, 15), np.uint8))
        p = work.copy(); p.thumbnail((1024, 1024))
        mm = cv2.resize(um, p.size, interpolation=cv2.INTER_NEAREST)
        plate = inpaint(p, mm)
    else:
        plate = work.copy(); plate.thumbnail((1024, 1024))
    plate.save(os.path.join(V2, 'plate', c['id'] + '.jpg'), quality=82)
    return c

ORIGINALS = [
  {'id': 'eden', 'file': 'assets/paintings/hd/garden-of-eden.jpg', 'bucket': 'baroque', 'kinds': ['lion', 'tiger', 'horse', 'deer', 'dog', 'cat', 'rabbit', 'cattle', 'bird', 'peacock']},
  {'id': 'hicks', 'file': 'assets/paintings/hd/peaceable-kingdom.jpg', 'bucket': 'folk', 'kinds': ['lion', 'wolf', 'cattle', 'bear', 'leopard', 'goat', 'sheep']},
  {'id': 'marc', 'file': 'assets/paintings/hd/fate-of-the-animals.jpg', 'bucket': 'expressionist', 'kinds': ['deer', 'pig', 'horse', 'fox']},
]

if __name__ == '__main__' and '--originals' in sys.argv:
    out = {}
    for c in [o for o in ORIGINALS if not sys.argv[2:] or o['id'] in sys.argv[2:]]:
        analyse(c)
        out[c['id']] = {k: c[k] for k in ('palette', 'stats', 'look', 'parts', 'bucket')}
        out[c['id']]['plate'] = f"assets/paintings/v2/plate/{c['id']}.jpg"
        out[c['id']]['depth2'] = f"assets/paintings/v2/depth/{c['id']}.png"
        print(c['id'], c['look'], len(c['parts']), flush=True)
    json.dump(out, open(os.path.join(ROOT, 'js/originals.json'), 'w'), indent=1, ensure_ascii=False)
    sys.exit(0)

if __name__ == '__main__':
    col = json.load(open(COL))
    only = set(sys.argv[1:])
    t0 = time.time(); done = 0
    for i, c in enumerate(col):
        if only and c['id'] not in only: continue
        if not only and 'parts' in c and os.path.exists(os.path.join(V2, 'plate', c['id'] + '.jpg')): continue
        try:
            analyse(c); done += 1
            print(f"[{i+1}/{len(col)}] {c['id']} {c['look']} animals={sum(p['type']=='animal' for p in c['parts'])} things={sum(p['type']=='thing' for p in c['parts'])} ({(time.time()-t0)/done:.1f}s each)", flush=True)
        except Exception as e:
            print('FAIL', c['id'], repr(e), flush=True)
        if done % 5 == 0: json.dump(col, open(COL, 'w'), indent=1, ensure_ascii=False)
    json.dump(col, open(COL, 'w'), indent=1, ensure_ascii=False)
    print('done', done)
