# Animals in the Archive

An interactive digital collection by Yiduo Wang (University of London).
Choose one of three paintings and a role, then draw an animal or choose a living 3D
one. It walks through a gallery, looks back at you, and the animals painted in the
picture wake up and talk to it. Step inside: the painted animals show it how they live
in the picture, and it tells them how animals live out in the world. Everything they
mention becomes the material of the finale: a collage or a monument made of this one
conversation.

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

1. **Collection index.** Three works side by side, with catalogue metadata and generated
   accession numbers: *The Garden of Eden with the Fall of Man* (Brueghel and Rubens, c. 1615),
   *Peaceable Kingdom* (Edward Hicks, c. 1834) and *Fate of the Animals* (Franz Marc, 1913).
   The switch at the top right of this page changes the language: English, 中文, Français, 한국어.
2. **Record and role.** Author, Guard or Passer-by. The role changes what the animals say
   and how the painted animals react to you (they turn to you, or turn away).
3. **Camera (optional).** An unchecked consent box, then face and hand tracking
   (MediaPipe, on this device only). Everything also works with mouse or touch.
4. **Character studio.** A full page. Give your animal a name (or keep the suggested one). Draw your own animal: it becomes a walking
   watercolour character. DoodleNet suggests the nearest 3D animal, with its real score.
   Or choose one of 11 realistic rigged 3D animals (Sketchfab: fox, wolf, rabbit, deer, elk,
   donkey, horse, zebra, tiger, lioness, brown bear), shown on a turntable that walks, runs, stands or
   grazes, in a Natural or Storybook (ink outline) look, or one of 13 storybook animals.
5. **Gallery.** Only your animal and you. The chosen painting hangs in the middle of the
   wall, the other two either side under their own lights. Click one of them (or the ‹ ›
   buttons) and your animal walks over to it; the visit carries on at that painting. The animal
   walks in with its own walk cycle; the playback speed matches its stride, so the feet
   stay planted. It turns to you and says hello (wave with the camera on, or click it).
   It reads the wall label aloud with two facts about the work, looks at the painting,
   and tells you whether an animal like it is painted there. It asks whether you like the
   painting, then whether to go in. On yes it sets off towards the picture and the light
   closes around the painting like an iris. On the black title card that follows, white
   lines fade in one by one: the painted animals have lived one unchanging moment for
   centuries; the visitor comes from a world of weather, homes and nights; today each will
   show the other how it lives. The walk up the steps and through the frame happens behind
   the card, then the dark lifts onto the inside of the picture. All talk is one line at a
   time, and questions wait for your nod, shake or click.
6. **Inside the painting.** The camera passes through the frame, then follows your animal
   from just behind and above. Zoom moves closer to or further from the animal, and
   looking around orbits it, so you never lose it. 3D animals turn their neck and head
   (rig bones) toward you or the speaker, with the body turning only as far as a real
   animal would, and always turn before they walk. Painted (2D) animals walk with a
   stepping rhythm, breathe, and turn round rarely and smoothly. Every figure keeps its
   own space and depth, so none of them overlap. Before each exchange the visitor and the
   painted animal walk towards each other. The questions come from 64 lines, different
   on every visit. One hand steers: open palm to come closer, pinch and hold to step
   back, pinch and drag sideways to walk round. The opening is a fixed little scene: startled, shy, polite, then
   "Follow me!" / "Okay!". After that every question gets an answer. The painting becomes a
   depth relief you can explore: zoom in with the scroll wheel or by spreading two hands,
   pan with a drag or an open hand, and parallax follows your head. When you stop
   steering, the view drifts back to your animal. Two or three painted animals, chosen
   at random, start as paint, freeze, stare at the newcomer ("…?") and come alive. Then
   the two worlds compare lives: the visitor describes how its kind lives (18 kinds), and
   each painted animal describes its life in the picture (10 animals). After that they
   gather round it and keep talking, with yes/no questions for you that wait. There are about 70
   lines in `js/strings.js`. The visitor takes on the painting's manner. Whoever talks,
   the visitor turns to that animal: 3D animals turn body, neck and head, 2D ones turn
   round, and the eyes travel smoothly from one speaker to the next.
7. **What they told each other.** When the conversation ends, a ledger opens over the
   picture: on one side what the painted animals said about life inside it, on the other
   what the visitor said about life outside, each under its question. From there you
   choose a collage or a monument (or stay a little longer).
8. **Create.** Both are built from this visit's conversation. Every answer is tagged in
   `js/exchange.js` with the things it mentions; things from the painted world are torn
   out of the painting itself (the snake, Death's hourglass, the falling trees: 22
   fragments), things from the real world are drawn in ink on notebook paper (a bowl, rain,
   a sofa, snow: 25 drawings).
   - **New painting (2D):** "Two worlds": the painting is torn open on the right and a
     field-notebook page shows through. The painted animal stands on the painting, your
     animal on the page, facing each other across the tear. The fragments lie on the
     painting, the drawings on the page, and two of the lines they said are pinned over
     the top as paper slips. The shelf holds everything the conversation mentioned plus
     27 animals cut from all three works. Move, scale, turn, flip, rearrange; change the
     season (spring blossom, summer, autumn leaves, winter snow) and the picture (night,
     engraving, prism, storybook), or turn "Two worlds" off.
   - **Monument (3D):** the painting carved in relief, with the visitor and painted
     animals as statues and the real-world things they talked about as small statues
     between them. Their words are carved into a low stone in front. There are five
     forms: stele, cube, drum (the painting wrapped round it), chalice and medallion, and
     four materials: marble, bronze, clay and painted. Swipe a hand to change the form.
     Turn it by dragging or pinching, carry statues, and export it as `.glb` for Blender.
9. **Archive card.** A catalogue-style PNG of your visit, with one line from each side, then Play again.

Privacy: nothing is uploaded or stored. No analytics, cookies or localStorage. The camera
stops on "Turn camera off", when the tab is hidden, or when the page is closed.

Inside the paintings, the visitor only ever stands, walks, or moves its head: every change
of place or direction is made with its legs walking (a turn is stepped round; the walk's
playback rate is tied to the ground speed so the feet never slide), and nothing is moved
by hand. Only animals painted standing speak; animals painted lying or sitting stay part
of the picture (a flat painted figure cannot be redrawn standing without inventing it).
In the Peaceable Kingdom the speakers are the standing ox and the standing leopard, who
speak from where they stand; the visitor walks over to them.

## Project structure

```
index.html            page shell, import map for three.js
css/style.css         design
js/strings.js         ALL user-facing text in English; strings.zh.js and strings.ko.js translate it
js/data.js            works, painted animals, 3D animals, storybook species
js/app.js             flow controller
js/gallery.js         gallery room, the painting as a depth relief, living animals, entering
js/animal3d.js        rigged 3D animal actor (walk/run/idle clips, painterly shading)
js/character.js       2D character actor (auto-rig + walk shader) for drawings and sprites
js/rig.js             finds the legs in a side-view silhouette
js/turntable.js       character studio stage
js/monument.js        relief plinth + statues, materials, hands, GLB export
js/compose.js         collage ("two worlds" page), seasons and picture variations
js/exchange.js        what each line talks about; torn painting fragments, ink drawings, quote slips
js/tracking.js        MediaPipe face + hand tracking, gestures (nod, shake, wave, swipe)
js/sketch.js          drawing pad, DoodleNet, drawing → watercolour character
js/card.js, paint.js, util.js
assets/paintings/     paintings (web + hd/) and depth maps (depth/)
assets/hosts/         painted animals that come alive (WebP) and repainted ground patches
assets/collage/       27 animals cut from the three paintings
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

## Languages

English is in `js/strings.js`, Simplified Chinese in `js/strings.zh.js`, French in
`js/strings.fr.js` and Korean in `js/strings.ko.js`, key for key (any missing key falls back to English). The language
follows `?lang=en|zh|fr|ko`, set by the switch at the top right of the first page. The credits
table stays in English: it is the original record of sources and licences. Korean
particles after a name (이/가, 을/를, 은/는, 와/과, (으)로) are chosen at run time by
`localize()` in `strings.js`, because names are only known then. The web fonts are Latin
only; Chinese and Korean use the system's serif and sans faces (Songti, Myeongjo, PingFang,
Apple SD Gothic Neo, or the Noto equivalents). French typography (a narrow no-break space before ? ! ; : and inside « ») is applied
in `strings.fr.js`. The Korean and French texts have not yet been read by native
speakers; please have them checked before publication.

No import map is needed: every module imports three.js by a relative path, so the site
also runs in Safari 15 and 16 (import maps only arrived in Safari 16.4).

## Credits

See [CREDITS.md](CREDITS.md) and the in-site Credits page.
