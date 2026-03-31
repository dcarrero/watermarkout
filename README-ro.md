# WatermarkOut v0.5

Elimină filigranele din imaginile generate de AI. **100% offline** — imaginea ta nu părăsește niciodată browserul.

[![Licență: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · [Italiano](README-it.md) · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · **Română** · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Funcționalități

- **Trage și plasează**, click sau Ctrl+V pentru a încărca o imagine
- **Auto-detectare** a filigranelor Gemini (analiză componente conectate + scor de încredere)
- **Selecție manuală** — desenează un dreptunghi peste orice filigran
- **Inpainting algoritmic** (eșantionare bazată pe patch-uri cu medie ponderată)
- **Slider înainte/după** pentru compararea rezultatelor
- **Control de netezire** (0-5 iterații Gaussiene)
- **Descărcare** ca PNG curat
- **12 limbi** · **Responsive** · **Accesibil**
- Zero dependențe — HTML5 + Canvas API + Vanilla JS

## Start rapid

```bash
python3 -m http.server 8080
# Deschide http://localhost:8080
```

## Autor

**David Carrero** — [carrero.es](https://carrero.es)

## Licență

[MIT](LICENSE) — gratuit pentru uz personal și comercial.
