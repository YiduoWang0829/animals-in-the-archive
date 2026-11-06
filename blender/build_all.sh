#!/bin/sh
# Rebuild every relief model. Usage: sh blender/build_all.sh [path-to-blender]
# Run from the project root.
BLENDER="${1:-blender}"
mkdir -p assets/animals/glb assets/sprites/glb
for png in assets/animals/cutouts/*.png; do
  n=$(basename "$png" .png)
  "$BLENDER" --background --python blender/make_relief.py -- "$png" "assets/animals/glb/$n.glb" | grep "make_relief\]"
done
for png in assets/sprites/eden-lion.png assets/sprites/durer-dog.png assets/sprites/marc-deer.png; do
  n=$(basename "$png" .png)
  "$BLENDER" --background --python blender/make_relief.py -- "$png" "assets/sprites/glb/$n.glb" | grep "make_relief\]"
done
