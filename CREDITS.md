# Credits

Items marked **to be verified** or **to be confirmed** were not checked against a primary
source. They are left open on purpose and must be checked before publication.

## Paintings

The images come from Wikimedia Commons (web size and 2400 px "hd" versions). Metadata was
checked on each Commons file page on 2026-11-06.

| Work | Artist | Date | Collection | Source | Licence status |
|---|---|---|---|---|---|
| *The Garden of Eden with the Fall of Man* | Jan Brueghel the Elder and Peter Paul Rubens | 1615 per Commons; the site shows "c. 1615" | Mauritshuis, The Hague, inv. 253 | [Commons](https://commons.wikimedia.org/wiki/File:Jan_Brueghel_de_Oude_en_Peter_Paul_Rubens_-_Het_aards_paradijs_met_de_zondeval_van_Adam_en_Eva.jpg) | Public domain; CC Public Domain Mark 1.0 |
| *Peaceable Kingdom* | Edward Hicks | c. 1834, oil on canvas, 74.5 × 90.1 cm | National Gallery of Art, Washington, accession 1980.62.15, gift of Edgar William and Bernice Chrysler Garbisch | [Commons](https://commons.wikimedia.org/wiki/File:Edward_Hicks,_Peaceable_Kingdom,_c._1834,_NGA_59908.jpg) (NGA Open Access) | CC0 1.0 |
| *Fate of the Animals* (Tierschicksale) | Franz Marc | 1913, oil on canvas. **Not stated on Commons; to be verified** | Kunstmuseum Basel per Wikipedia. **Inventory number and dimensions to be verified** | [Commons](https://commons.wikimedia.org/wiki/File:Marc_tierschicksale.jpg) | Public domain; CC Public Domain Mark 1.0 |

### Derived from the paintings (this project's own processing)

- **Depth maps** (`assets/paintings/depth/`): estimated with Depth Anything V2 Small
  (`depth-anything/Depth-Anything-V2-Small-hf`, Apache-2.0), then smoothed.
- **Painted animals that come alive** (`assets/hosts/`): Eden lion, white horse, stag,
  white rabbit, little dog and peacock; Hicks's lion, bear cub, calf, goat and leopard; Marc's blue
  deer and red boars. Cut out with Segment Anything (`facebook/sam-vit-base`,
  Apache-2.0), using hand-placed boxes, points and two hand-traced outlines. Hidden parts
  and the ground behind each animal were repainted with LaMa (big-lama via
  simple-lama-inpainting; **model licence to be verified**). The repainted areas are
  machine-generated, not part of the original works.
- **Collage pieces** (`assets/collage/`): 22 animals cut from the three paintings with SAM.

## 3D animals

The 3D animals are now the realistic Sketchfab models listed under "Realistic 3D animals
(Sketchfab)" below. (Earlier versions used CC0 low-poly animals by Quaternius; they are no
longer part of the site.) Six of the models (fox, wolf, rabbit, deer, horse, lioness) are **CC BY-NC 4.0: non-commercial use only**;
if the site is ever used commercially they must be replaced.

## Animal photographs (storybook illustrations)

Six photos come from the author's own animal archive dataset (`WS2 Tracking`). Seven
(cat, dog, rabbit, horse, barn owl, red squirrel, hedgehog) were downloaded on
2026-11-06 from iNaturalist with a CC0 filter. The licence and attribution are copied as
recorded in the metadata, not as verified claims. **Photographer: to be confirmed for
all.** The storybook illustrations in `assets/animals/storybook/` are generated from
these photos by `tools/storybook.py`.

| File | Species | Photographer | Source record | Licence / attribution as recorded | Obtained from |
|---|---|---|---|---|---|
| brown_bear_24160860.png | brown bear | to be confirmed | https://www.inaturalist.org/observations/16123410 | cc0, "no rights reserved" (to be confirmed) | author’s dataset |
| domestic_cat_236808539.png | domestic cat | to be confirmed | https://www.inaturalist.org/observations/138537499 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| domestic_dog_251913625.png | domestic dog | to be confirmed | https://www.inaturalist.org/observations/146515389 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| grey_wolf_4909114.png | grey wolf | to be confirmed | https://www.inaturalist.org/observations/4126404 | cc-by, "(c) Desiree L. Narango, some rights reserved (CC BY)" (to be confirmed) | author’s dataset |
| hedgehog_203070926.png | hedgehog | to be confirmed | https://www.inaturalist.org/observations/120086772 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| horse_121483510.png | horse | to be confirmed | https://www.inaturalist.org/observations/74337960 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| lion_236419.png | lion | to be confirmed | https://www.inaturalist.org/observations/163263 | cc-by, "(c) 66dodge, some rights reserved (CC BY)" (to be confirmed) | author’s dataset |
| owl_324147361.png | owl | to be confirmed | https://www.inaturalist.org/observations/185588647 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| rabbit_78502673.png | rabbit | to be confirmed | https://www.inaturalist.org/observations/49453023 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| red_deer_10941056.png | red deer | to be confirmed | https://www.inaturalist.org/observations/8249012 | cc-by, "(c) Michael Bakker Paiva, some rights reserved (CC BY)" (to be confirmed) | author’s dataset |
| red_fox_2262475.png | red fox | to be confirmed | https://www.inaturalist.org/observations/1859843 | cc-by, "(c) botanygirl, some rights reserved (CC BY)" (to be confirmed) | author’s dataset |
| red_squirrel_171989381.png | red squirrel | to be confirmed | https://www.inaturalist.org/observations/102837347 | cc0, "no rights reserved" (to be confirmed) | iNaturalist CC0 search, 2026-11-06 |
| tiger_50541307.png | tiger | to be confirmed | https://www.inaturalist.org/observations/32235759 | cc-by, "(c) wild_wind, some rights reserved (CC BY)" (to be confirmed) | author’s dataset |

## Software, models and fonts (vendored in `vendor/`)

| Item | Version | Use | Licence |
|---|---|---|---|
| three.js (+ GLTFLoader, GLTFExporter, OrbitControls, BufferGeometryUtils) | 0.170.0 | All 3D | MIT |
| @mediapipe/tasks-vision | 0.10.14 | Optional face and hand tracking | Apache-2.0 |
| hand_landmarker.task, blaze_face_short_range.tflite | float16 v1 | Hand and face models | Apache-2.0 per MediaPipe documentation (to be verified) |
| @tensorflow/tfjs | 4.22.0 | Runs the sketch classifier | Apache-2.0 |
| DoodleNet (ml5.js data and models) | labels from ml5@0.12.2 | Sketch recognition | ml5.js MIT; **model licence to be verified** |
| Cormorant Garamond, Inter, IBM Plex Mono | Fontsource 5.1.0 | Typography | SIL OFL 1.1 |

Tools used offline (not shipped): Blender 5.2.3 LTS, rembg 2.0.87 (isnet-general-use),
PyTorch, Hugging Face transformers, Depth Anything V2, Segment Anything, LaMa, OpenCV,
Pillow, NumPy, SciPy.

## Realistic 3D animals (Sketchfab)

Each model keeps the licence file that came with its download (`<id>.license.txt`) next to the `.glb` in
`assets/animals/3d/real/`. For this project the props were removed, unused animations
dropped, textures reduced (`tools/import_model.py`, `blender/import_sketchfab.py`) and the
shading made painterly in the browser.

| File | Model | Author | Source | Licence |
|---|---|---|---|---|
| fox.glb | FOX - Realistic 3D Model (DEMO FREE) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/fox-realistic-3d-model-demo-free-83b1b144712c43d282d90c2fb15ba450) | CC BY-NC 4.0 (non-commercial) |
| wolf.glb | WOLF - Realistic 3D Model (DEMO FREE) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/wolf-realistic-3d-model-demo-free-8840b859a566485c874a27b1731e1db8) | CC BY-NC 4.0 (non-commercial) |
| rabbit.glb | RABBIT - Realistic 3D Model (DEMO FREE) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/rabbit-realistic-3d-model-demo-free-d70284ea0d7644988bdcd327c3ffb59a) | CC BY-NC 4.0 (non-commercial) |
| deer.glb | DEER - Realistic 3D Model (DEMO FREE) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/deer-realistic-3d-model-demo-free-3997d669818c4e0d8c8bcafb0a1ae2ee) | CC BY-NC 4.0 (non-commercial) |
| stag.glb | Realistic Animated Elk 3D Model | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/realistic-animated-elk-3d-model-787834f9caa2474d9f1814b807c072d7) | CC BY 4.0 |
| donkey.glb | Realistic Animated Donkey 3D Model (saddle removed) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/realistic-animated-donkey-3d-model-2b4086035df94d9e88fd0f18d34b3872) | CC BY 4.0 |
| horse.glb | HORSE - Realistic 3D Model (DEMO FREE) (saddle removed) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4) | CC BY-NC 4.0 (non-commercial) |
| zebra.glb | Zebra - Rigged | Noa Seller | [Sketchfab](https://sketchfab.com/3d-models/zebra-rigged-5d6ff2749afc438b9989f91ecb242574) | CC BY 4.0 |
| tiger.glb | Tiger rebuilt | kenchoo | [Sketchfab](https://sketchfab.com/3d-models/tiger-rebuilt-6b5d14b2de984ffcb00ee00e404ad208) | CC BY 4.0 |
| lioness.glb | LIONESS - Realistic 3D Model (DEMO FREE) | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/lioness-realistic-3d-model-demo-free-51e60bf5fe37445e91093b4b00a5b0aa) | CC BY-NC 4.0 (non-commercial) |
| bear.glb | Realistic Animated Bear 3D Model | WildMesh 3D | [Sketchfab](https://sketchfab.com/3d-models/realistic-animated-bear-3d-model-bffc3c87d2d148ff8533e1cc8a11c9f1) | CC BY 4.0 |
