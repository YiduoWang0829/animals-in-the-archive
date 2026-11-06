# Animals in the Archive

An interactive digital collection by Yiduo Wang (University of London).
Choose one of three paintings and a role, then draw an animal or choose a living 3D
one. It walks through a gallery, looks back at you, and the animals painted in the
picture wake up and talk to it. Step inside the painting to explore it in depth,
then carve a monument or make a new painting from all the animals in the collection.

Plain static site: HTML, CSS and ES-module JavaScript. No build step, no server code,
no CDN. Every library and model is vendored in `vendor/`, and all paths are relative.

## Run locally

Browsers block ES modules and model files opened from `file://`, so use a local server:

```bash
cd animals-in-the-archive
python3 tools/serve.py 8000
```

Then open http://localhost:8000. `tools/serve.py` is `python -m http.server` with
browser caching switched off, so edits always show. `python3 -m http.server 8000` also
works. The camera only works on `localhost` or `https://`.

## The experience

1. **Collection index.** Three works with catalogue metadata and generated accession numbers.
2. **Record and role.** Author, Guard or Passer-by. The role changes what the animals say
   and how the painted animals react to you (they turn to you, or turn away).
3. **Camera (optional).** An unchecked consent box, then face and hand tracking
   (MediaPipe, on this device only). Everything also works with mouse or touch.
4. **Character studio.** A full page. Draw your own animal: it becomes a walking
   watercolour character. DoodleNet suggests the nearest 3D animal, with its real score.
   Or choose one of 11 rigged 3D animals, shown on a turntable that walks, runs, stands or
   grazes, in a Natural or Storybook (ink outline) look, or one of 13 storybook animals.
5. **Gallery.** The animal walks in using its own walk or gallop animation, looks back at
   you (towards your face if the camera is on), and you can wave to it. Two or three
   painted animals, chosen at random each visit, wake up, step out of their places
   (the ground behind them was repainted), talk to the visitor, and one asks
   "Do you like this painting?" (nod or shake your head, or click).
6. **Inside the painting.** The camera passes through the frame. The painting becomes a
   depth relief you can explore: zoom in with the scroll wheel or by spreading two hands,
   pan with a drag or an open hand, and parallax follows your head. The animals live
   there: they wander, run, follow you, talk, and come when you click or pinch them.
   The visitor takes on the painting's manner.
7. **Create.** Two options:
   - **Monument (3D):** the painting carved as a relief into a plinth, with the visitor
     and painted animals as statues on top, in marble, bronze, clay or painted finish.
     Turn it by dragging or pinching, carry statues, and export it as `.glb` for Blender.
   - **New painting (2D):** a collage on any of the three paintings, using 22 animals cut
     from all three works plus your visitor. Move, scale, turn and flip them, change the
     season (spring blossom, summer, autumn leaves, winter snow) and the picture
     (night, engraving, prism, storybook).
8. **Archive card.** A catalogue-style PNG of your visit, then Play again.

Privacy: nothing is uploaded or stored. No analytics, cookies or localStorage. The camera
stops on "Turn camera off", when the tab is hidden, or when the page is closed.

## Project structure

```
index.html            page shell, import map for three.js
css/style.css         design
js/strings.js         ALL user-facing text (add a `zh` block for Chinese; ?lang=zh)
js/data.js            works, painted animals, 3D animals, storybook species
js/app.js             flow controller
js/gallery.js         gallery room, the painting as a depth relief, living animals, entering
js/animal3d.js        rigged 3D animal actor (walk/run/idle clips, painterly shading)
js/character.js       2D character actor (auto-rig + walk shader) for drawings and sprites
js/rig.js             finds the legs in a side-view silhouette
js/turntable.js       character studio stage
js/monument.js        relief plinth + statues, materials, hands, GLB export
js/compose.js         collage, seasons and picture variations
js/tracking.js        MediaPipe face + hand tracking, gestures (nod, shake, wave, swipe)
js/sketch.js          drawing pad, DoodleNet, drawing → watercolour character
js/card.js, paint.js, util.js
assets/paintings/     paintings (web + hd/) and depth maps (depth/)
assets/hosts/         painted animals that come alive (WebP) and repainted ground patches
assets/collage/       22 animals cut from the three paintings
assets/animals/3d/    rigged 3D animals (.glb) and studio thumbnails
assets/animals/       photo originals/, rembg cutouts/, storybook/ illustrations
blender/              render_thumb.py (studio thumbnails), make_relief.py, preview_render.py
tools/                serve.py, cutout.py, storybook.py, depth_maps.py,
                      segment_hosts.py, segment_collage.py, photo_metadata.json
dev/                  development test pages (not linked from the site)
vendor/               three 0.170.0, MediaPipe tasks-vision 0.10.14 + hand and face
                      models, TensorFlow.js 4.22.0, DoodleNet, fonts (OFL)
```

## Regenerate the assets

```bash
python3 -m venv ../.venv && . ../.venv/bin/activate
pip install torch torchvision transformers "rembg[cpu]" pillow numpy scipy opencv-python-headless simple-lama-inpainting
python tools/cutout.py              # photos → transparent cut-outs (rembg, isnet-general-use)
python tools/storybook.py           # cut-outs → storybook ink-and-watercolour illustrations
python tools/depth_maps.py          # paintings → depth maps (Depth Anything V2 Small)
SSL_CERT_FILE=$(python -c "import certifi;print(certifi.where())") python tools/segment_hosts.py
python tools/segment_collage.py     # every animal in the paintings → collage pieces
```

`segment_hosts.py` and `segment_collage.py` hold the hand-placed boxes and points for
each painted animal. SAM draws the outline; for the animals that come alive, LaMa
repaints hidden parts and the ground behind them. Edit the boxes there to change a cut.

Blender (tested with 5.2.3 LTS) renders the studio thumbnails:

```bash
blender --background --python blender/render_thumb.py -- assets/animals/3d/fox.glb fox.png
```

`blender/make_relief.py` is the version-1 relief generator (PNG → displaced, textured
GLB). The site no longer uses it, but it still runs. The monument's `.glb` export opens
in Blender with File → Import → glTF 2.0.

## Deploy on GitHub Pages

1. Create an empty repository on GitHub under your account, e.g. `animals-in-the-archive`.
2. In this folder:
   ```bash
   git remote add origin https://github.com/<your-user>/animals-in-the-archive.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch**, `main`, `/ (root)`, Save.
4. After a minute the site is live at `https://<your-user>.github.io/animals-in-the-archive/`.
   All paths are relative. `.nojekyll` makes Pages serve `vendor/` unchanged. Pages uses
   HTTPS, so the camera works there.

The site is about 100 MB including history. The largest file is the MediaPipe wasm (~9 MB).

## Adding Chinese

Copy `STRINGS.en` in `js/strings.js` to `STRINGS.zh`, translate the values (keep the
`{placeholders}`), and open the site with `?lang=zh`. The web fonts are Latin only, so
Chinese text uses the system font.

## Credits

See [CREDITS.md](CREDITS.md) and the in-site Credits page.
