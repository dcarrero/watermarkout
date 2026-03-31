# WatermarkOut v0.5

Elimina marcas de agua de imágenes generadas por IA. **100% offline** — tu imagen nunca sale de tu navegador.

[![Licencia: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · **Español** · [Français](README-fr.md) · [Italiano](README-it.md) · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Funcionalidades

- **Arrastra y suelta**, haz clic o Ctrl+V para cargar una imagen
- **Auto-detección** de marcas de agua de Gemini (análisis de componentes conectados + puntuación de confianza)
- **Selección manual** — dibuja un rectángulo sobre cualquier marca de agua
- **Inpainting algorítmico** (muestreo basado en parches con promedio ponderado)
- **Slider antes/después** para comparar resultados
- **Control de suavizado** (0-5 iteraciones Gaussianas)
- **Descarga** como PNG limpio
- **12 idiomas**: English, Español, Français, Italiano, Deutsch, Português, Nederlands, Polski, Română, 한국어, 日本語, العربية
- **Responsive** (escritorio, tablet, móvil con soporte táctil)
- **Accesible** (navegación por teclado, etiquetas ARIA, indicadores de foco)
- Sin dependencias — HTML5 + Canvas API + Vanilla JS

## Inicio rápido

```bash
python3 -m http.server 8080
# Abrir http://localhost:8080
```

## Cómo funciona

1. Carga una imagen (arrastra, haz clic o pega)
2. La herramienta auto-detecta la marca ✦ de Gemini, o selecciona el área manualmente
3. El inpainting basado en parches rellena la región con píxeles del entorno
4. Compara con el slider antes/después
5. Descarga el PNG limpio

## Formatos soportados

- **Entrada**: PNG, JPG, WEBP, GIF (primer frame)
- **Salida**: PNG (sin pérdida)
- **Tamaño máximo**: 6000×6000px

## Autor

**David Carrero** — [carrero.es](https://carrero.es)

## Licencia

[MIT](LICENSE) — libre para uso personal y comercial.
