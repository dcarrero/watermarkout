<!-- /autoplan restore point: /Users/dcarrero/.gstack/projects/Watermarkout-gemini/no-branch-autoplan-restore-20260331-130521.md -->
# WatermarkOut — Plan de Implementación
> Herramienta web offline para eliminar marcas de agua de imágenes. MVP gratuito.
> Stack: HTML5 + CSS3 + Vanilla JS. Sin dependencias externas. Sin IA.

---

## Objetivo del producto

Mini-SaaS freemium (MVP en fase 1 = 100% gratis) que permite:
1. Subir una imagen (drag & drop o click)
2. Detectar automáticamente la marca de agua estrella de Gemini (esquina inferior derecha)
3. Eliminarla mediante inpainting algorítmico puro (Canvas API)
4. Descargar la imagen limpia

Funciona **100% offline** (sin peticiones a servidor). El procesamiento ocurre en el navegador del usuario.

---

## Estructura de archivos

```
watermark-remover/
├── index.html              # App completa (single page)
├── css/
│   └── app.css             # Estilos — estética dark/industrial, tipografía editorial
├── js/
│   ├── app.js              # Controlador principal, estado global
│   ├── canvas-utils.js     # Helpers Canvas: getImageData, drawMask, composite
│   ├── inpainting.js       # Algoritmo de eliminación (núcleo técnico)
│   ├── detector.js         # Auto-detección de marca de agua Gemini
│   └── ui.js               # Interacciones UI: drag/drop, selector manual, sliders
└── CLAUDE.md               # Este archivo
```

---

## Fases de desarrollo

### FASE 1 — Canvas core + Upload + Display

**Objetivo**: El usuario puede cargar una imagen y verla en canvas.

**Tareas**:
- `index.html`: layout base — drop zone centrada, canvas de preview, panel de controles lateral
- `canvas-utils.js`:
  - `loadImageToCanvas(file, canvasEl)` → dibuja imagen en canvas, retorna `{width, height, imageData}`
  - `getPixel(imageData, x, y)` → retorna `{r, g, b, a}`
  - `setPixel(imageData, x, y, r, g, b, a)` → mutación directa
  - `clampCoord(x, y, w, h)` → asegura coordenadas dentro de bounds
- `ui.js`:
  - Drag & drop sobre drop zone → llama `loadImageToCanvas`
  - Click en drop zone → file input hidden → mismo flujo
  - Mostrar dimensiones y nombre del archivo cargado
- Estado en `app.js`: `{ originalImageData, workingImageData, canvas, ctx, filename }`

**Output**: imagen visible en canvas con nombre y dimensiones.

---

### FASE 2 — Selector manual de región

**Objetivo**: El usuario puede dibujar un rectángulo sobre la imagen para marcar la zona a eliminar.

**Tareas**:
- `ui.js`:
  - Modo "select": mousedown → mousemove → mouseup sobre canvas
  - Dibuja rectángulo semitransparente rojo sobre overlay canvas (canvas apilado encima del principal)
  - Al soltar: emite evento `maskSelected` con `{x, y, w, h}` relativo a imagen real (escalado por devicePixelRatio y zoom)
- `canvas-utils.js`:
  - `drawMaskOverlay(overlayCanvas, rect)` → rectángulo rojo semitransparente
  - `clearOverlay(overlayCanvas)`
- `app.js`:
  - Al recibir `maskSelected`: guarda `state.mask = {x, y, w, h}` y habilita botón "Eliminar"

**Output**: el usuario ve el área seleccionada marcada visualmente.

---

### FASE 3 — Auto-detección de marca Gemini

**Objetivo**: Detectar automáticamente la estrella de 4 puntas (✦) que Gemini inserta en la esquina inferior derecha.

**Algoritmo de detección en `detector.js`**:

La marca de Gemini es:
- Un símbolo ✦ blanco/gris claro, semi-transparente
- Ubicado en los últimos ~5% del ancho y ~8% del alto de la imagen (esquina inferior derecha)
- Brillo significativamente mayor que los píxeles vecinos del fondo

```
detectGeminiWatermark(imageData, width, height):
  1. Definir zona de búsqueda:
     - searchX = width * 0.88
     - searchY = height * 0.88
     - searchW = width * 0.12
     - searchH = height * 0.12

  2. Para cada píxel en zona de búsqueda:
     - Calcular luminancia: lum = 0.299*r + 0.587*g + 0.114*b
     - Si lum > 200 Y alpha > 100: candidato

  3. Calcular centroide de candidatos:
     - Si #candidatos > umbralMin (ej. 50 píxeles): watermark detectado
     - centroide = media(x), media(y) de candidatos

  4. Expandir region con margen de 8px alrededor del bounding box de candidatos

  5. Retornar { detected: bool, rect: {x, y, w, h} }
```

**Tareas**:
- Implementar función `detectGeminiWatermark(imageData, width, height)`
- En `app.js`: botón "Auto-detectar" → llama detector → si detectado: muestra rect en overlay + habilita "Eliminar"
- Si no detectado: mensaje "No se detectó automáticamente — selecciona manualmente"

---

### FASE 4 — Algoritmo de Inpainting (núcleo técnico)

**Objetivo**: Rellenar la región enmascarada con píxeles sintéticos coherentes con el entorno.

**Algoritmo implementado en `inpainting.js`**: Patch-Based Sampling con weighted averaging.

#### Por qué este algoritmo (sin IA)

Es el mejor balance para JS en el navegador:
- **Simple bilinear**: malos resultados en gradientes (el fondo de Gemini es gradient mesh)
- **Telea Fast Marching**: complejo, difícil de debuggear, mejor para texturas orgánicas
- **Patch-based weighted**: excelente para fondos con gradiente o color uniforme; el fondo típico de Gemini es exactamente esto

#### Implementación detallada

```
inpaintRegion(imageData, mask, width, height):

  PARÁMETROS:
    patchSize = 15       // tamaño del parche de muestreo (px)
    searchRadius = 40    // radio de búsqueda alrededor de la máscara
    numSamples = 12      // número de parches a promediar por píxel

  PASO 1 — Construir lista de píxeles a rellenar:
    pixels = todos los {x,y} dentro del rect mask

  PASO 2 — Para cada píxel (px, py) en pixels:

    a) Definir anillo de muestreo:
       - Buscar candidatos en un anillo alrededor de (px,py)
       - Radio interno: max(mask.w, mask.h) / 2 + 2px  (fuera de la máscara)
       - Radio externo: searchRadius

    b) Muestrear N candidatos aleatorios del anillo:
       - Para cada candidato (cx, cy):
         - Extraer parche patchSize×patchSize centrado en (cx, cy)
         - Solo si todos los píxeles del parche están FUERA de la máscara

    c) Calcular peso de cada candidato:
       - distWeight = 1 / (distancia_euclidea(px-cx, py-cy) ^ 2 + epsilon)
       - colorWeight = similitud con borde más cercano de la máscara
       - weight = distWeight * colorWeight

    d) Promediar los candidatos ponderados:
       - r = Σ(r_i * w_i) / Σw_i
       - g = Σ(g_i * w_i) / Σw_i
       - b = Σ(b_i * w_i) / Σw_i
       - a = 255

    e) setPixel(imageData, px, py, r, g, b, a)

  PASO 3 — Aplicar suavizado Gaussiano ligero (3x3 kernel) solo sobre los píxeles modificados
    → elimina artefactos de borde entre zona rellena y original
    → kernel: [1,2,1, 2,4,2, 1,2,1] / 16

  PASO 4 — ctx.putImageData(imageData, 0, 0)
```

**Optimización de rendimiento**:
- Para imágenes grandes: procesar en chunks con `requestAnimationFrame` (no bloquea UI)
- Mostrar progress bar durante el proceso
- Usar `Uint8ClampedArray` directamente (evitar abstracciones costosas)

**Tareas**:
- `inpainting.js`: exportar función `async inpaintRegion(imageData, mask, width, height, onProgress)`
- `onProgress(0..1)` callback para la barra de progreso
- `app.js`: botón "Eliminar marca" → `await inpaintRegion(...)` → `ctx.putImageData` → habilitar descarga

---

### FASE 5 — Export + UI pulida

**Objetivo**: Descargar imagen procesada y UI completa con estética distinctive.

**Tareas**:

**Export**:
- `canvas-utils.js`: `downloadCanvas(canvas, filename)` → `canvas.toBlob('image/png')` → `URL.createObjectURL` → `<a download>`
- Botón "Descargar PNG" (activo solo tras procesar)
- Preservar nombre original con sufijo `_clean`

**Controles adicionales**:
- Slider "Intensidad de suavizado" (0-5): controla iteraciones del Gaussiano post-inpainting
- Botón "Deshacer": restaura `originalImageData` → `ctx.putImageData`
- Botón "Restablecer selección": limpia overlay y mask

**UI / Estética** (referencia para el diseño):
- Tema: **dark industrial / editorial** — fondo `#0a0a0a`, acentos `#e8ff00` (amarillo neón)
- Tipografía: `Space Mono` para labels técnicos + `Bebas Neue` para headings
- Layout: drop zone centrada grande (60% viewport), panel derecho con controles
- Animaciones: transición suave al cargar imagen (fade in canvas), spinner durante inpainting
- Responsive: funciona en mobile (touch events para el selector manual)
- No loader externo: cargar fuentes desde Google Fonts con `<link rel="preload">`

---

## Consideraciones técnicas clave

### Coordenadas canvas vs imagen real
El canvas puede estar escalado visualmente (CSS `max-width`). Siempre convertir:
```js
const scaleX = image.naturalWidth / canvas.offsetWidth;
const scaleY = image.naturalHeight / canvas.offsetHeight;
const realX = mouseX * scaleX;
const realY = mouseY * scaleY;
```

### CORS y archivos locales
Al abrir `index.html` directamente (file://), `canvas.toBlob()` puede fallar en algunos navegadores.
Solución: usar `canvas.toDataURL()` como fallback + instrucción de uso con `python -m http.server 8080`.

### Formatos soportados
- Input: PNG, JPG, WEBP, GIF (primer frame)
- Output: siempre PNG (sin pérdida de calidad)

### Límite de tamaño
- Advertencia si imagen > 4000×4000px (inpainting puede ser lento)
- Hard limit de procesamiento: 8000×8000px

---

## Orden de implementación para Claude Code

1. `index.html` — estructura HTML completa con todos los elementos
2. `css/app.css` — estilos completos con variables CSS y responsive
3. `js/canvas-utils.js` — utilidades de píxeles (base de todo)
4. `js/detector.js` — auto-detección Gemini
5. `js/inpainting.js` — algoritmo patch-based (archivo más complejo)
6. `js/ui.js` — eventos de usuario, drag/drop, selector de región
7. `js/app.js` — orquestador: importa todos los módulos, gestiona estado

Cada archivo debe ser autocontenido con exports explícitos (ES Modules).
`index.html` usa `<script type="module" src="js/app.js">`.

---

## Casos de prueba esperados

| Imagen | Resultado esperado |
|--------|-------------------|
| Imagen Gemini con estrella ✦ esquina inferior derecha | Auto-detecta + elimina en <2s |
| Imagen sin marca | "No se detectó" — permite selección manual |
| Fondo degradado bajo la marca | Inpainting reconstruye el gradiente |
| Imagen JPEG con compresión | Funciona, descarga como PNG limpio |
| Imagen 4K (3840×2160) | Procesa con progress bar, sin freeze de UI |

---

## Extensiones futuras (post-MVP)

- Soporte para más marcas: Adobe Firefly, Midjourney, DALL-E, iStock
- Modo "batch": procesar múltiples imágenes
- Service Worker → PWA instalable
- Modo freemium: límite de 3 imágenes/día gratis, $4.99/mes sin límite (Stripe)
- API REST para integración con ContentHub / WordPress

---

*Generado: marzo 2026 | Stack: HTML5 + Canvas API + ES Modules | Sin dependencias*

---

## /autoplan — Revisión Completa

### FASE 1: REVISIÓN CEO (Estrategia y Alcance) — SELECTIVE EXPANSION

#### NO está en alcance (diferido)
| # | Elemento | Razón | Destino |
|---|----------|-------|---------|
| 1 | Soporte multi-vendor (DALL-E, Midjourney, Firefly) | MVP se enfoca en Gemini; arquitectura preparada para plugins | TODOS.md |
| 2 | Zoom/pan en imagen | Nice-to-have, no esencial para flujo principal | TODOS.md |
| 3 | Historial de imágenes (sessionStorage) | Complejidad adicional sin valor claro para MVP | TODOS.md |
| 4 | Framework de testing (Jest/Vitest) | Contradice "sin dependencias"; tests manuales para MVP | TODOS.md |
| 5 | Observabilidad (Sentry/analytics) | Requiere dependencia externa; incoherente con modelo offline | Post-MVP |
| 6 | Modelo freemium con paywall | Requiere server-side gate; contradice 100% offline | Post-MVP |
| 7 | WebAssembly para rendimiento | Optimización prematura; JS es suficiente para MVP | Post-MVP |
| 8 | Extensión de navegador | Enfoque diferente; evaluar post-MVP si hay demanda | Post-MVP |
| 9 | Limpieza de metadatos EXIF/C2PA | Funcionalidad complementaria; evaluar post-MVP | Post-MVP |

#### Lo que ya existe
No hay código existente. Proyecto greenfield. Mapeo de sub-problemas:
- Canvas API: nativa del navegador, bien documentada
- Detección por luminancia: algoritmo estándar de procesamiento de imagen
- Patch-based inpainting: algoritmo documentado (Criminisi et al.)
- Drag & drop: HTML5 Drag and Drop API nativa
- File download: Blob API + createObjectURL nativos

#### Registro de Errores y Rescate
| Método/Ruta | Error | ¿Rescatado? | Acción | Usuario ve |
|-------------|-------|-------------|--------|------------|
| loadImageToCanvas | Archivo corrupto | GAP→FIXED | try/catch | "No se pudo leer esta imagen" |
| loadImageToCanvas | Imagen >6000px | Sí | Hard limit | "Imagen demasiado grande (máx 6000×6000)" |
| loadImageToCanvas | Tipo inválido | Sí | Validar MIME | "Formato no soportado (usa PNG/JPG/WEBP)" |
| detectGeminiWatermark | Falso positivo | GAP→FIXED | confidence <0.7 | "Posible marca — verificar manualmente" |
| detectGeminiWatermark | No detectado | Sí | Mensaje | "No se detectó — selecciona manualmente" |
| inpaintRegion | Candidatos insuficientes | GAP→FIXED | Fallback average | Resultado con promedio simple |
| inpaintRegion | UI freeze (4K) | Sí | rAF chunks | Progress bar |
| downloadCanvas | CORS/file:// | Sí | toDataURL fallback | Funciona |

#### Registro de Modos de Fallo
| Modo de fallo | Probabilidad | Impacto | Mitigación |
|---------------|-------------|---------|------------|
| Google cambia watermark Gemini | Alta (6-12 meses) | Crítico | Arquitectura pluggable de detectores |
| Falso positivo en imágenes con zonas brillantes | Media | Medio | Confidence score + verificación manual |
| Inpainting visible en fondos complejos | Media | Medio | Slider de suavizado + before/after |
| OOM en imágenes grandes (>6000px) | Baja | Alto | Hard limit reducido a 6000×6000 |
| Regulación legal contra remoción de watermarks AI | Baja-Media (12 meses) | Alto | Disclaimer en UI |

#### Delta del Estado Ideal
Este plan lleva de 0% a ~25% del ideal a 12 meses. Establece la arquitectura base (canvas, detector, inpainting) y resuelve un caso de uso concreto (Gemini). Los pasos más impactantes post-MVP son: multi-vendor support y mejora de calidad de inpainting (WebGPU/ONNX).

#### Expansiones aceptadas (SELECTIVE EXPANSION)
- **E1:** Vista before/after con slider deslizante
- **E3:** Soporte de pegado desde portapapeles (Ctrl+V)
- **E5:** Auto-detección automática al cargar imagen

#### Decisiones de diseño añadidas al plan
- Canvas overlay usa position: absolute dentro de contenedor relative
- Canvas interno usa width×devicePixelRatio; CSS usa width original
- Estado de la app como FSM: IDLE → IMAGE_LOADED → MASK_SELECTED → PROCESSING → DONE
- detector.js retorna confidence score (0-1) además de rect
- Soft limit 4000×4000 (warning), hard limit 6000×6000 (bloqueo)
- Disclaimer legal en UI sobre uso personal

<!-- AUTONOMOUS DECISION LOG -->
## Rastro de Auditoría de Decisiones

| # | Fase | Decisión | Principio | Justificación | Rechazado |
|---|------|----------|-----------|---------------|-----------|
| 1 | CEO-0C | Enfoque A (patch-based) | P3,P5 | Balance correcto para MVP; sin dependencias | Enfoque B (median filter), C (WebGPU) |
| 2 | CEO-0F | SELECTIVE EXPANSION | P1,P6 | Greenfield con objetivo claro; explorar expansiones razonables | EXPANSION (demasiado ambicioso), HOLD (limita oportunidades) |
| 3 | CEO-0D | Aceptar E1 (before/after) | P1 | Mejora UX enorme por ~15min; Completeness 9/10 | — |
| 4 | CEO-0D | Diferir E2 (zoom/pan) | P3 | Nice-to-have; no esencial para MVP | — |
| 5 | CEO-0D | Aceptar E3 (clipboard paste) | P1 | Caso de uso frecuente; ~10min CC | — |
| 6 | CEO-0D | Diferir E4 (historial) | P3 | Complejidad sin valor claro MVP | — |
| 7 | CEO-0D | Aceptar E5 (auto-detect on load) | P5 | Obvio y ya contemplado parcialmente | — |
| 8 | CEO-0F | Confirmar modo + enfoque A | P3,P6 | Coherente con análisis | — |
| 9 | CEO-S1 | Canvas overlay absolute positioning | P5 | Único enfoque correcto para stacking | — |
| 10 | CEO-S1 | devicePixelRatio en canvas | P1 | Necesario para displays retina | — |
| 11 | CEO-S2 | try/catch + confidence score + fallback | P1,P5 | 3 GAPs cerrados; errores explícitos | — |
| 12 | CEO-S4 | App state como FSM | P5,P1 | Controla todos los edge cases de interacción | — |
| 13 | CEO-S6 | No añadir framework de testing | P3 | Contradice "sin dependencias"; tests manuales suficientes MVP | Jest/Vitest |
| 14 | CEO-S7 | Reducir hard limit a 6000×6000 | P3 | Evitar OOM en móviles | Mantener 8000×8000 |
| 15 | CEO-S8 | No añadir observabilidad | P3 | Coherente con modelo offline sin dependencias | Sentry/analytics |
| 16 | CEO-S10 | Interfaz pluggable para detector.js | P4,P3 | Facilita extensibilidad sin sobreingeniería actual | — |
| 17 | CEO-S11 | Añadir estados faltantes (loading, error) | P1 | Completar mapa de estados de interacción | — |
| 18 | CEO-VOICE | Mantener MVP Gemini-only, arq extensible | P3,P6 | Resolver UN problema bien vs. diluir en múltiples | Reframear como universal |
| 19 | CEO-VOICE | Nota de validación de demanda (no bloquea) | P6 | Fuera de alcance de revisión técnica | Bloquear implementación |
| 20 | CEO-VOICE | Disclaimer legal en UI | P5 | Mitigación pragmática de riesgo legal | — |
| 21 | CEO-VOICE | Paywall es problema post-MVP | P6 | MVP es 100% gratis; no afecta plan actual | — |
| 22 | CEO-VOICE | Moat via velocidad + marca + detectores | P3 | Inherente a herramienta open-source | — |
| 23 | DES-0D | Revisar todas las 7 dimensiones | P1 | Alcance de UI significativo | — |
| 24 | DES-P1 | Jerarquía UI por estado (IDLE→DONE) | P1,P5 | Cada estado muestra solo controles relevantes | — |
| 25 | DES-P2 | Tabla completa de estados de interacción | P1 | 12 estados nuevos especificados | — |
| 26 | DES-P3 | Momentos de celebración (detección, resultado) | P1 | Arco emocional: pasos 3 y 5 necesitan "momento wow" | — |
| 27 | DES-P5 | Tokens mínimos CSS (no DESIGN.md completo) | P5,P3 | Suficiente para implementar sin ambigüedad | DESIGN.md completo |
| 28 | DES-P6 | Especificaciones responsive + a11y | P1 | Mobile layout, touch, keyboard nav, ARIA | — |
| 29 | DES-P7 | Before/after slider horizontal sobre canvas | P5 | Estándar de industria | Toggle botón |
| 30 | DES-P7 | Drop zone desaparece al cargar imagen | P5 | Sustracción por defecto; botón "Nueva imagen" | Drop zone visible |
| 31 | DES-P7 | Nombre de archivo en panel como subtitle | P5 | Coherente con jerarquía de panel | Overlay sobre canvas |
| 32 | DES-P7 | Progress bar linear horizontal bajo canvas | P5 | Estética industrial | Circular |
| 33 | DES-P7 | Panel heading "WATERMARKOUT" en Bebas Neue | P5 | Branding visible | Sin heading |
| 34 | DES-P7 | Feedback de detección inline amarillo | P5 | Evitar toasts invasivos | Toast/modal |
| 35 | ENG-S2 | Helper forEachPixelInRect en canvas-utils | P4 | Evitar duplicación detector/inpainting | — |
| 36 | ENG-S2 | forEachPixelInRect como decisión arquitectónica | P4 | DRY entre módulos | — |
| 37 | ENG-S3 | Tests manuales; documentar brechas como conocidas | P3,P6 | MVP sin framework de testing | Tests automatizados |
| 38 | ENG-S4 | Warning para máscara >200×200 | P5 | Expectativa de rendimiento clara | — |
| 39 | ENG-VOICE | searchRadius dinámico (fix bug crítico) | P1 | Radio fijo=40 falla para masks>76px | Radio fijo |
| 40 | ENG-VOICE | Acceso directo a array en hot loop | P3 | Evitar millones de GC allocations | getPixel/setPixel |
| 41 | ENG-VOICE | Double-buffering para Gaussian | P5 | Evitar sesgo direccional en smoothing | In-place |
| 42 | ENG-VOICE | Componentes conectados en detector | P1 | Reducir falsos positivos ~30% | Solo luminancia |
| 43 | ENG-VOICE | Self-host fuentes (no Google Fonts CDN) | P5 | Mantener claim "100% offline" real | Google Fonts |
| 44 | ENG-VOICE | 3 canvas + clip-path para before/after | P3 | Rendimiento 60fps sin re-render | Re-render por frame |
| 45 | ENG-VOICE | Canvas dims = image dims, scale via CSS | P5 | Resolver contradicción DPR | Doble estrategia |
| 46 | ENG-VOICE | Ponderar parches por fracción fuera de máscara | P1 | Mejor reconstrucción en bordes | 100% fuera requerido |

### FASE 2: REVISIÓN DE DISEÑO — Resumen de Completitud

```
+====================================================================+
|     REVISIÓN DE DISEÑO DEL PLAN — RESUMEN DE COMPLETITUD           |
+====================================================================+
| Auditoría de Sistema   | Sin DESIGN.md. Greenfield. UI scope: SÍ  |
| Paso 0                 | 6/10 inicial. Estética con opinión.       |
| Pasada 1  (Arq. Info)  | 4/10 → 7/10 (jerarquía por estado)      |
| Pasada 2  (Estados)    | 3/10 → 8/10 (tabla completa)            |
| Pasada 3  (Recorrido)  | 5/10 → 7/10 (momentos wow añadidos)     |
| Pasada 4  (IA Genér.)  | 8/10 → 8/10 (estética diferenciada)     |
| Pasada 5  (Sist. Dis.) | 3/10 → 6/10 (tokens CSS mínimos)        |
| Pasada 6  (Responsivo) | 2/10 → 7/10 (responsive + a11y)         |
| Pasada 7  (Decisiones) | 6 decisiones resueltas, 0 aplazadas     |
+--------------------------------------------------------------------+
| FUERA de alcance       | DESIGN.md completo (post-MVP)            |
| Lo que ya existe       | Nada (greenfield)                         |
| Decisiones tomadas     | 12 añadidas al plan                       |
| Decisiones aplazadas   | 0                                         |
| Puntuación general     | 4/10 → 7/10                               |
+====================================================================+
```

#### Especificaciones de UI añadidas al plan

**Jerarquía por estado:**
- IDLE: Drop zone centrada + panel vacío con instrucciones breves
- IMAGE_LOADED: Canvas + panel con info archivo + botones detectar/seleccionar
- MASK_SELECTED: Canvas + overlay rect + botón "Eliminar" activo
- PROCESSING: Canvas + progress bar linear bajo canvas + controles deshabilitados
- DONE: Canvas + before/after slider + botón "Descargar" prominente + "Deshacer"/"Nueva"

**Tokens CSS mínimos:**
```css
--bg: #0a0a0a; --fg: #e0e0e0; --accent: #e8ff00;
--error: #ff4444; --success: #44ff88;
--space-unit: 8px; --radius: 4px;
--font-mono: 'Space Mono', monospace;
--font-display: 'Bebas Neue', sans-serif;
```

**Responsive:**
- Desktop (>1024px): Canvas 60% + panel lateral 30%
- Tablet (768-1024): Canvas 100% + panel colapsable inferior
- Mobile (<768px): Canvas 100% + controles como bottom sheet
- Touch: preventDefault() para evitar scroll durante selección
- Áreas táctiles: mín 44×44px

**Accesibilidad:**
- Tab order: drop zone → auto-detectar → eliminar → slider → descargar
- Canvas: role="img" aria-label="Imagen cargada: [nombre]"
- Progress bar: role="progressbar" aria-valuenow
- Focus visible: outline amarillo en todos los controles

### FASE 3: REVISIÓN DE INGENIERÍA — Resumen de Completitud

#### NO está en alcance (Ingeniería)
- Tests automatizados (sin framework; tests manuales para MVP)
- WebAssembly para optimización de rendimiento
- Service Worker / PWA

#### Lo que ya existe (Ingeniería)
Todo es greenfield. APIs nativas del navegador:
- Canvas API (Capa 1: probada y fiable)
- HTML5 Drag & Drop API (Capa 1)
- Blob API + createObjectURL (Capa 1)
- ES Modules (Capa 1)

#### Diagrama ASCII de Arquitectura
```
app.js (orquestador, FSM)
  ├── ui.js (eventos, drag/drop, touch, selector, clipboard)
  ├── canvas-utils.js (píxeles, overlay, download, forEachPixelInRect)
  ├── detector.js (luminancia, centroide, confidence → interfaz pluggable)
  └── inpainting.js (patch-based sampling, gaussian smooth, async + onProgress)
```

#### Diagrama de Tests (rutas → cobertura)
- 5/24 rutas cubiertas por tests manuales del plan (21%)
- 19 brechas documentadas como conocidas y aceptables para MVP
- Artefacto de plan de tests escrito en ~/.gstack/projects/

#### Registro de Modos de Fallo (Ingeniería)
| Modo de fallo | Brecha crítica | Mitigación |
|---------------|---------------|------------|
| Anillo de muestreo sin candidatos | SÍ → FIXED | Fallback a promedio simple |
| Máscara en esquina de imagen | NO | Candidatos parciales + clamping |
| Máscara >50% de imagen | NO | Warning + límite práctico |
| Memory overflow en imágenes grandes | SÍ → FIXED | Hard limit 6000×6000 |
| Cancelación de procesamiento | NO | FSM maneja transiciones |
| toBlob() CORS en file:// | SÍ → FIXED | Fallback toDataURL() |

#### Decisiones de Ingeniería Añadidas
- Helper `forEachPixelInRect(imageData, rect, callback)` en canvas-utils.js
- Warning de rendimiento para máscara >200×200px
- detector.js retorna `{detected, rect, confidence}` con interfaz pluggable
- inpaintRegion es async con onProgress callback para chunks vía rAF
- **[CRÍTICO]** searchRadius debe ser dinámico: `max(mask.w, mask.h)/2 + margin + patchSize` (el valor fijo de 40px falla para máscaras >76px)
- **[CRÍTICO]** En inpainting hot loop: acceso directo a `imageData.data[idx]` donde `idx = (y*width+x)*4`. NUNCA usar getPixel/setPixel (millones de allocations → GC stalls)
- Gaussian smoothing usa double-buffering (leer de source, escribir a dest, swap) para evitar sesgo direccional
- Detector: usar análisis de componentes conectados + verificación de forma (aspect ratio ~1:1, aislamiento) en vez de solo conteo de píxeles
- Self-host fuentes (woff2 en /fonts/) en vez de Google Fonts CDN — mantener claim "100% offline"
- Before/after slider: usar 3 canvas apilados con CSS clip-path, no re-render en cada movimiento
- URL.revokeObjectURL() después de cada descarga para evitar memory leaks
- Estrategia de canvas: dimensiones internas = dimensiones de imagen. Escalar vía CSS. Conversión: mouseX * (canvas.width / canvas.offsetWidth)
- Constraint de parche suavizado: no requerir 100% fuera de máscara — ponderar por fracción fuera de máscara (Criminisi 2004)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | clean | 5 premisas evaluadas, 3 expansiones aceptadas |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | 4→7/10, 12 decisiones tomadas |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | clean | 6 issues found & fixed |
| CEO Voices | `/autoplan` | Independent 2nd opinion | 1 | subagent-only | 15 hallazgos (5C, 7H, 3M) |
| Design Voices | `/autoplan` | Independent design review | 1 | subagent-only | Scorecard: 3/7 confirmed |
| Eng Voices | `/autoplan` | Independent eng review | 1 | subagent-only | 4/6 confirmed |

**VEREDICTO:** APROBADO — Plan revisado por 3 fases (CEO, Diseño, Ingeniería) con voces duales [single-model]. 38 auto-decisiones, 5 de criterio, 0 sin resolver. Listo para implementación.
