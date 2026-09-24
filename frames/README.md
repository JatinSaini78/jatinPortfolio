# Hero frames

Until this folder has frames, the hero animates the SVG character in `index.html`.
Once you add frames and a `manifest.json`, `hero.js` loads them and switches to them automatically.
Serve the site over http (for example `python3 -m http.server`), because browsers block `fetch()` on `file://`.

There are two kinds of frames:

- **Keyframes (quickest):** eight 3D stills of you, generated from a photo, that crossfade between states.
- **Video frames:** a full frame sequence extracted from an AI-generated video, for truly continuous motion (steps below).

## Option A: 3D keyframes from your photo

```sh
export GEMINI_API_KEY=...                      # free key: https://aistudio.google.com/apikey
tools/make-hero-frames.sh ~/Desktop/me.jpg     # a clear, front-facing photo works best
```

The script generates `work-1`, `work-2`, `left`, `right`, `hey`, `hi-1`, `hi-2` and `point`.
It converts them to WebP and writes a `manifest.json` with `"mode": "keyframes"`.
Check each image: if one looks off, delete it and run that single step again.

Before you publish the site, delete `frames/raw/`. It holds the full-size PNGs and isn't needed online.

## Option B: video frames

### 1. Extract frames from the character video

```sh
brew install ffmpeg webp   # once
# 24 fps, 1280px wide, WebP at quality 78: sharp enough for the hero, light enough to load
ffmpeg -i character.mp4 -vf "fps=24,scale=1280:-2" -c:v libwebp -quality 78 frames/frame_%04d.webp
ls frames/*.webp | wc -l   # use this number as "count"
```

ffmpeg numbers the files from `0001`. Segments in the manifest are zero-based, so segment frame `0` loads `frame_0001.webp`.
If your files start at `0000`, add `"first": 0` to the manifest.

### 2. Mark the segments in `manifest.json`

Open the video, note the frame number where each action starts and ends, then write:

```json
{
  "fps": 24,
  "count": 192,
  "width": 1280,
  "height": 720,
  "pattern": "frame_{i}.webp",
  "pad": 4,
  "segments": {
    "work":  [0, 47],
    "left":  [48, 83],
    "right": [84, 119],
    "greet": [120, 191]
  },
  "beats": { "hey": 120, "hi": 158, "point": 178 }
}
```

- `work` plays forwards and backwards in a loop (ping-pong).
- `left` and `right` play forwards, hold on their last frame for about 2.6s, then play in reverse back into `work`.
- `greet` plays once and holds on the pointing frame. When the visitor leaves, it rewinds quickly. Played in reverse, the headset goes back on.
- `beats` sets which frame shows each message: "Hey, it's you!", "Hiiii!" and "Check out the portfolio". If you leave it out, the messages appear at fixed points through `greet`.
