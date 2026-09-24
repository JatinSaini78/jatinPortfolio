#!/usr/bin/env bash
# Generates the hero's 3D keyframes from a photo with Nano Banana Pro (Gemini 3 Pro Image),
# converts them to WebP and writes frames/manifest.json.
#
#   export GEMINI_API_KEY=...        # https://aistudio.google.com/apikey
#   tools/make-hero-frames.sh path/to/photo.jpg
#
# Frame 1 is generated from the photo. Every other pose is an edit of frame 1,
# so face, clothes, laptop, lighting and camera stay identical between frames.
set -euo pipefail

photo="${1:?usage: tools/make-hero-frames.sh path/to/photo.jpg}"
: "${GEMINI_API_KEY:?set GEMINI_API_KEY first}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/frames"
raw="$out/raw"
gen="$HOME/.claude/skills/nano-banana-pro/scripts/generate_image.py"
mkdir -p "$raw"

base_prompt='Create a premium 3D animated character render (Pixar / Apple Memoji quality, soft realistic studio lighting, subtle subsurface skin) of the man in this photo. Keep his likeness exactly: tall swept-back black pompadour with short faded sides, full neatly trimmed black beard joined to a mustache, thick straight dark eyebrows, calm dark-brown eyes, warm medium skin tone. He wears a plain charcoal hoodie and matte black over-ear headphones with a thin boom microphone. He sits behind a silver aluminium MacBook seen from behind: the closed-looking back of the lid faces the camera, with no logo. Both hands are on the keyboard, he looks down at the screen, focused. Front-facing, camera locked at chest height, perfectly centered. Show his head, shoulders and the entire laptop; the laptop base sits at the bottom of the frame and there is clear empty space above his head. Pure white seamless background with only a soft contact shadow under the laptop. Portrait 4:5 framing. No text.'

keep='Keep everything else identical to the input image: same person, face, hair, beard, hoodie, laptop, lighting, background, camera position and framing. Change only:'

gen_image() { # name prompt [input]
  local name="$1" prompt="$2" input="${3:-}"
  echo "-> $name"
  if [[ -n "$input" ]]; then
    uv run "$gen" --prompt "$prompt" --filename "$raw/$name.png" --input-image "$input" --resolution 2K
  else
    uv run "$gen" --prompt "$prompt" --filename "$raw/$name.png" --input-image "$photo" --resolution 2K
  fi
}

gen_image work-1 "$base_prompt"
base="$raw/work-1.png"
gen_image work-2 "$keep his fingers are mid-keystroke in a slightly different position and his eyes look at a different part of the screen." "$base"
gen_image left   "$keep he turns his head to his right (the viewer's left) with a curious look, eyebrows slightly raised, hands still on the keyboard." "$base"
gen_image right  "$keep he turns his head to his left (the viewer's right) with a curious look, eyebrows slightly raised, hands still on the keyboard." "$base"
gen_image hey    "$keep he looks straight into the camera, pleasantly surprised and happy to see the viewer: eyebrows up, eyes bright, a warm open smile. Headphones still on." "$base"
gen_image hi-1   "$keep the headphones are off his head and rest around his neck. He smiles broadly at the camera and waves with his right hand raised beside his head, palm open, fingers spread, tilted slightly left." "$base"
gen_image hi-2   "$keep the headphones are off his head and rest around his neck. He smiles broadly at the camera and waves with his right hand raised beside his head, palm open, fingers spread, tilted slightly right." "$raw/hi-1.png"
gen_image point  "$keep the headphones rest around his neck. He smiles at the camera and points straight down with his index finger, his arm reaching past the right side of the laptop, as if saying: scroll down." "$raw/hi-1.png"

# WebP for the web (~100-200 KB each)
uv run --with pillow python - "$raw" "$out" <<'PY'
import sys, pathlib
from PIL import Image
raw, out = map(pathlib.Path, sys.argv[1:])
for png in sorted(raw.glob('*.png')):
    im = Image.open(png).convert('RGB')
    im.thumbnail((1080, 1350))
    im.save(out / (png.stem + '.webp'), quality=82, method=6)
    print('   ', png.stem + '.webp', im.size)
PY

cat > "$out/manifest.json" <<'JSON'
{
  "mode": "keyframes",
  "frames": {
    "work": ["work-1.webp", "work-2.webp"],
    "left": "left.webp",
    "right": "right.webp",
    "hey": "hey.webp",
    "hi": ["hi-1.webp", "hi-2.webp"],
    "point": "point.webp"
  }
}
JSON
echo "Done. Review frames/*.webp, delete any bad one and re-run its line, then refresh the site."
