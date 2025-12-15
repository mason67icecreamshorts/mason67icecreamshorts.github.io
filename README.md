# Mini Web DAW

Lightweight browser-based digital audio workstation (DAW) built with Tone.js. Create patterns with a step sequencer, load samples per track, mix with pan/volume, add reverb/delay sends, save/load patterns to LocalStorage, and export mixes to WAV.

This repository contains a small demo site designed to run on GitHub Pages.

Quick start (local):

1. Serve the folder locally (recommended):

```bash
# from the project root
python3 -m http.server 8000
# or, if you have Node.js installed:
npx http-server -c-1
```

2. Open http://localhost:8000 in your browser and click "Open DAW".

Notes and recommendations:

- The project uses relative paths so it works when hosted at `https://<user>.github.io/<repo>`.
- Files are loaded in the browser; there is no server-side audio processing.
- For best results, allow audio context activation when prompted (click Play once).

Deployment (GitHub Pages):

- Push the repository to GitHub. In repository settings -> Pages, enable deployment from the `main` branch and root directory. The site will be available at `https://<user>.github.io/<repo>`.

Recent updates and next steps:

- Added piano-roll editor with velocity and drag-to-draw.
- Per-step note, duration and velocity support; MIDI input + per-track record enabled.
- Instrument selector including a wavetable-like preset.
- Example presets at `assets/presets/wavetable-presets.json` and a samples placeholder folder at `assets/samples/`.

If you'd like, I can:

- Add example sample files (small public-domain .wav one-shots) into `assets/samples/`.
- Improve piano-roll UX (visual duration bars, single-note mode, copy/paste patterns).
- Add a more advanced wavetable/WASM synth (closer to Serum) — this requires integrating a compiled synth or library.

Open an issue or tell me which improvements you'd like next.
