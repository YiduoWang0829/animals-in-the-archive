# Credits

Items marked **to be verified** or **to be confirmed** were not checked against a
primary source. They are left open on purpose and must be checked before publication.

## Paintings

Image files come from Wikimedia Commons; the metadata below was checked on each Commons
file page on 2026-11-06.

| Work | Artist | Date | Collection | Source | Licence status |
|---|---|---|---|---|---|
| *The Garden of Eden with the Fall of Man* (Het aards paradijs met de zondeval van Adam en Eva) | Jan Brueghel the Elder and Peter Paul Rubens (figures by Rubens, landscape and animals by Brueghel, per Commons) | 1615 per Commons; the site shows "c. 1615" | Mauritshuis, The Hague, inv. 253 | [Commons file](https://commons.wikimedia.org/wiki/File:Jan_Brueghel_de_Oude_en_Peter_Paul_Rubens_-_Het_aards_paradijs_met_de_zondeval_van_Adam_en_Eva.jpg) (source given as Geheugen van Nederland / Mauritshuis) | Public domain; reproduction marked CC Public Domain Mark 1.0 |
| *Knight, Death and the Devil* (Der Reiter) | Albrecht Dürer | 1513, engraving | Commons cites the National Gallery of Art, Washington (accessions 1943.3.3519 and 1941.1.20). **Which impression this file shows: to be verified** | [Commons file](https://commons.wikimedia.org/wiki/File:Albrecht_D%C3%BCrer_-_Knight,_Death_and_the_Devil.jpg) | Public domain; CC Public Domain Mark 1.0 |
| *Fate of the Animals* (Tierschicksale) | Franz Marc | 1913, oil on canvas. **Not stated on the Commons file page; to be verified** (Wikipedia gives 1913) | Kunstmuseum Basel per Wikipedia. **Inventory number and dimensions to be verified** (sources disagree) | [Commons file](https://commons.wikimedia.org/wiki/File:Marc_tierschicksale.jpg) (source given as "reproduction from art book") | Public domain; CC Public Domain Mark 1.0 |

Painted animals cropped as sprites (`tools/crop_sprites.py`, polygons traced by hand):
the lion (Eden), the dog (Dürer, head and shoulders above the horse's leg) and the blue
deer (Marc).

## Animal photographs

Source folder: `Desktop/ucl coding/WS2 Tracking/animal_archive_data/photographs/images`
(the author's animal archive dataset, 6 species × 50 photos). One photograph per species
was chosen: full body, side or three-quarter view. Each original is kept in
`assets/animals/originals/`, and the rembg cut-out (isnet-general-use) is in
`assets/animals/cutouts/`.

**Photographer: to be confirmed for all photos.** The dataset's own metadata
(`metadata/photographs.csv`) links each file to an iNaturalist observation and records a
licence and attribution string. These are copied below *as recorded*, not as verified
claims. Check each record page before publishing. Several are recorded as CC BY, which
requires attribution.

| File | Species | Photographer | Source record (per dataset metadata) | Licence / attribution as recorded |
|---|---|---|---|---|
| brown_bear_24160860.png | Brown bear (*Ursus arctos*) | to be confirmed | https://www.inaturalist.org/observations/16123410 | cc0, "no rights reserved" (to be confirmed) |
| grey_wolf_4909114.png | Grey wolf (*Canis lupus*) | to be confirmed | https://www.inaturalist.org/observations/4126404 | cc-by, "(c) Desiree L. Narango, some rights reserved (CC BY)" (to be confirmed) |
| lion_236419.png | Lion (*Panthera leo*) | to be confirmed | https://www.inaturalist.org/observations/163263 | cc-by, "(c) 66dodge, some rights reserved (CC BY)" (to be confirmed) |
| red_deer_10941056.png | Red deer (*Cervus elaphus*) | to be confirmed | https://www.inaturalist.org/observations/8249012 | cc-by, "(c) Michael Bakker Paiva, some rights reserved (CC BY)" (to be confirmed) |
| red_fox_2262475.png | Red fox (*Vulpes vulpes*) | to be confirmed | https://www.inaturalist.org/observations/1859843 | cc-by, "(c) botanygirl, some rights reserved (CC BY)" (to be confirmed) |
| tiger_50541307.png | Tiger (*Panthera tigris*) | to be confirmed | https://www.inaturalist.org/observations/32235759 | cc-by, "(c) wild_wind, some rights reserved (CC BY)" (to be confirmed) |

## Software, models and fonts (vendored in `vendor/`)

| Item | Version | Use | Licence |
|---|---|---|---|
| three.js (core, GLTFLoader, OrbitControls, BufferGeometryUtils) | 0.170.0 (npm) | Sculpture room | MIT (`vendor/three-0.170.0/LICENSE`) |
| @mediapipe/tasks-vision | 0.10.14 (npm) | Optional hand tracking | Apache-2.0 |
| hand_landmarker.task (float16, v1) | from storage.googleapis.com/mediapipe-models | Hand landmark model | Apache-2.0 per MediaPipe documentation (to be verified) |
| @tensorflow/tfjs | 4.22.0 (npm) | Runs the sketch classifier | Apache-2.0 |
| DoodleNet model | `ml5js/ml5-data-and-models@master/models/doodlenet` (fetched 2026-11-06) | Sketch recognition, 345 QuickDraw classes | Model licence to be verified. Class list and preprocessing follow ml5@0.12.2 (MIT, `vendor/doodlenet/ml5-LICENSE.md`) |
| Cormorant Garamond, Inter, IBM Plex Mono | Fontsource 5.1.0 | Typography | SIL OFL 1.1 (licence files in `vendor/fonts/`) |

Tools used to make the assets (not shipped): Blender 5.2.3 LTS (`blender/make_relief.py`),
rembg 2.0.87 with isnet-general-use, Pillow, NumPy, SciPy.
