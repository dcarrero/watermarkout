# WatermarkOut v0.5

Remove watermarks from AI-generated images. **100% offline** — your image never leaves your browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Drag & drop**, click or Ctrl+V to load an image
- **Auto-detection** of Gemini AI watermarks (connected component analysis + confidence score)
- **Manual selection** — draw a rectangle over any watermark
- **Algorithmic inpainting** (patch-based sampling with weighted averaging)
- **Before/after slider** to compare results
- **Smoothing control** (0-5 Gaussian iterations)
- **Download** as clean PNG
- **12 languages**: English, Español, Français, Italiano, Deutsch, Português, Nederlands, Polski, Română, 한국어, 日本語, العربية
- **Responsive** (desktop, tablet, mobile with touch support)
- **Accessible** (keyboard navigation, ARIA labels, focus indicators)
- Zero dependencies — HTML5 + Canvas API + Vanilla JS

## Quick start

```bash
# Option 1: local server
python3 -m http.server 8080
# Open http://localhost:8080

# Option 2: open directly
open index.html
```

## How it works

1. Load an image (drag, click, or paste)
2. The tool auto-detects the Gemini ✦ watermark, or you select the area manually
3. Patch-based inpainting fills the region with surrounding pixels
4. Compare with the before/after slider
5. Download the clean PNG

## Tech stack

```
HTML5 + CSS3 + Vanilla JS
Canvas API · ES Modules · Zero dependencies · 100% offline
```

## Project structure

```
├── index.html            ← Single-page app
├── css/app.css           ← Styles, CSS tokens, responsive, RTL
├── js/
│   ├── app.js            ← FSM state manager + orchestrator
│   ├── canvas-utils.js   ← Canvas pixel utilities
│   ├── detector.js       ← Gemini watermark auto-detection
│   ├── inpainting.js     ← Patch-based inpainting + Gaussian smoothing
│   ├── ui.js             ← Rectangle selector, before/after slider
│   └── i18n.js           ← Internationalization (12 languages)
├── fonts/                ← Self-hosted fonts (Space Mono, Bebas Neue)
├── og-image.png          ← Open Graph image for social sharing
├── LICENSE               ← MIT License
└── README.md
```

## Supported formats

- **Input**: PNG, JPG, WEBP, GIF (first frame)
- **Output**: PNG (lossless)
- **Max size**: 6000×6000px (warning at 4000×4000)

## Roadmap

- [ ] Support for more watermarks (Firefly, DALL-E, Midjourney)
- [ ] Batch processing (multiple images)
- [ ] PWA (installable offline app)
- [ ] WebAssembly for faster inpainting

## Author

**David Carrero** — [carrero.es](https://carrero.es)

## License

[MIT](LICENSE) — free for personal and commercial use.
