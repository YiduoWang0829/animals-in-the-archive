# Animals in the Archive

An interactive digital collection by Yiduo Wang (University of London).
Pick one of three paintings, choose a role, and send an animal from a photographic
archive into the picture. The animal is repainted in the style of the work as it
crosses the frame, and an animal painted in the work replies. Then sculpt the two
together in 3D and take away a catalogue card.

Plain static site: HTML, CSS and ES-module JavaScript. No build step, no server code,
no CDN. Every library and model is vendored in `vendor/`, and all paths are relative.

## Run locally

Browsers block ES modules and model files opened from `file://`, so use a local server:

```bash
cd animals-in-the-archive
python3 -m http.server 8000
```

Then open http://localhost:8000. The camera only works on `localhost` or `https://`.

## The experience

1. **Collection index.** Three works with catalogue metadata and generated accession numbers.
2. **Record.** A frosted-glass modal with the full record.
3. **Role.** Author (the animal blushes and looks at you), Guard (it shies away from the
   pointer), Passer-by (it follows the pointer).
4. **Visitor.** Pick from the animal archive (6 species), or draw one. The sketch is
   classified in the browser by DoodleNet (TensorFlow.js). The UI shows the classifier's
   real top guesses and probability. If no archive species reaches 5 %, no match is
   claimed and you are asked to pick from the archive. If the model cannot load, the
   Draw tab says so and the archive remains available.
5. **Entrance.** The cut-out walks in from outside the frame. Inside the frame it is
   repainted per painting (`js/paint.js`): a Flemish oil glaze (Brueghel/Rubens), engraved
   hatching (Dürer), or Marc's prismatic palette. An SVG displacement filter roughens the edge.
6. **Reply.** The painted host (lion / dog / blue deer) was cropped from the painting
   (`tools/crop_sprites.py`), sits exactly where it was painted, turns toward the visitor
   and speaks. The question "Do you like this painting?" changes both animals' behaviour
   and the recorded mood.
7. **Sculpt.** Three.js loads both Blender reliefs overlapping. Drag on a model to pull or
   press; drag empty space to orbit. There is a Solid / Wireframe toggle. Optional hand
   tracking (MediaPipe HandLandmarker) needs a separate consent step; a thumb–index pinch
   is the brush.
8. **Archive card.** A PNG catalogue card generated in the browser, with a download link
   and Play again.

Privacy: nothing is uploaded or stored. There is no analytics, no cookies and no
localStorage. Camera frames are processed in the tab only after the unchecked consent
box is ticked. The camera stops on "Stop camera", Play again, leaving the room, or
hiding the tab.

## Project structure

```
index.html            page shell (+ SVG brush filters, import map for three.js)
css/style.css         design
js/strings.js         ALL user-facing text (add a `zh` block for Chinese; ?lang=zh)
js/data.js            works, species, sprite boxes, entrance paths
js/app.js             flow controller
js/stage.js           walk-in, frame crossing, host reply, role reactions
js/paint.js           per-painting painterly treatment (canvas)
js/sketch.js          drawing pad + DoodleNet classifier
js/sculpt.js          Three.js sculpting (+ in-browser fallback relief)
js/hands.js           MediaPipe hand tracking
js/card.js            archive card PNG
assets/paintings/     the three paintings
assets/animals/       originals/ (source photos), cutouts/ (rembg), glb/ (Blender)
assets/sprites/       painted animals cropped from the paintings, "plates", glb/
blender/              make_relief.py, preview_render.py, build_all.sh
tools/                crop_sprites.py, cutout.py, photo_metadata.json
vendor/               three 0.170.0, MediaPipe tasks-vision 0.10.14 + hand model,
                      TensorFlow.js 4.22.0, DoodleNet model, fonts (OFL)
```

## Regenerate the assets

Python tools (Python 3.10+):

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install "rembg[cpu]" pillow numpy scipy
python tools/cutout.py                    # photos → transparent cut-outs (isnet-general-use)
python tools/crop_sprites.py              # paintings → host sprites + plates
```

`crop_sprites.py` contains the hand-traced polygon for each painted animal. Edit the
coordinates there to change a crop.

3D reliefs with Blender (tested with Blender 5.2.3 LTS):

```bash
blender --background --python blender/make_relief.py -- assets/animals/cutouts/red_fox_2262475.png assets/animals/glb/red_fox_2262475.glb
sh blender/build_all.sh /Applications/Blender.app/Contents/MacOS/Blender   # all nine models
blender --background --python blender/preview_render.py -- assets/animals/glb/red_fox_2262475.glb preview.png
```

How `make_relief.py` works: it resamples the PNG alpha onto a grid of 140 cells on the
long side, blurs it into a soft distance field, and uses `sqrt` of that as a rounded
height. It adds a little high-pass brightness for surface detail and builds a closed mesh
(front, flatter back, side walls), smoothed lightly. It bleeds the photo colours into the
transparent border to avoid halos, applies the photo as the base-colour texture, and
exports GLB (Y-up, facing +Z). If a GLB is missing, the site falls back to a displaced
plane built in the browser from the same PNG and says so in the sculpture room.

## Deploy on GitHub Pages

1. Create an empty repository on GitHub under your account, e.g. `animals-in-the-archive`
   (no README, so the first push is clean).
2. In this folder (the local repo is already initialised and committed):
   ```bash
   git remote add origin https://github.com/<your-user>/animals-in-the-archive.git
   git branch -M main
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch `main`, folder `/ (root)`, Save.
4. After a minute the site is live at `https://<your-user>.github.io/animals-in-the-archive/`.
   All paths are relative, so it works under the repository sub-path. `.nojekyll` makes
   Pages serve the `vendor/` files unchanged.
5. Pages serves over HTTPS, so the optional camera step works there.

Repository size is about 42 MB. The largest single file is the MediaPipe wasm (~9 MB),
well under GitHub's 100 MB per-file limit.

## Adding Chinese

Copy `STRINGS.en` in `js/strings.js` to `STRINGS.zh` and translate the values (keep the
`{placeholders}`). Open the site with `?lang=zh`. Text inside the generated card also
comes from this file. The web fonts include Latin glyphs only, so Chinese text falls back
to the system font; add a CJK font if you want a matched look.

## Credits

See [CREDITS.md](CREDITS.md) and the in-site Credits page.
