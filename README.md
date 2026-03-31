# WatermarkOut v0.2

Herramienta web offline para eliminar marcas de agua de imágenes generadas por IA.

**100% offline** — tu imagen nunca sale de tu navegador.

## Funcionalidades (v0.2)

- Drag & drop, click o Ctrl+V para cargar imagen
- **Auto-detección** de marca de agua Gemini (componentes conectados + confidence score)
- **Inpainting algorítmico** (patch-based sampling con weighted averaging)
- Selector manual de región (mouse + touch)
- Slider before/after para comparar resultado
- Slider de suavizado (0-5 iteraciones Gaussian)
- Descarga como PNG limpio
- Responsive (desktop, tablet, mobile)
- Sin dependencias externas — HTML5 + Canvas API + Vanilla JS

## Próximamente

- Soporte para más marcas de agua (Firefly, DALL-E, Midjourney)
- Procesamiento batch (múltiples imágenes)
- PWA instalable

## Stack

```
HTML5 + CSS3 + Vanilla JS
Canvas API · ES Modules · Zero dependencies
```

## Estructura

```
├── index.html          ← App completa (single page)
├── css/app.css         ← Estilos, tokens CSS, responsive
├── js/
│   ├── app.js          ← FSM de estado + orquestador
│   ├── canvas-utils.js ← Utilidades de Canvas
│   ├── detector.js     ← Auto-detección de watermark Gemini
│   ├── inpainting.js   ← Patch-based inpainting + Gaussian smoothing
│   └── ui.js           ← Selector de región, before/after slider
└── fonts/              ← Fuentes self-hosted (Space Mono, Bebas Neue)
```

## Uso

```bash
# Opción 1: servidor local
python3 -m http.server 8080
# Abrir http://localhost:8080

# Opción 2: abrir directamente
open index.html
```

## Licencia

MIT
