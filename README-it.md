# WatermarkOut v0.5

Rimuovi le filigrane dalle immagini generate dall'IA. **100% offline** — la tua immagine non lascia mai il browser.

[![Licenza: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · **Italiano** · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Funzionalità

- **Trascina e rilascia**, clicca o Ctrl+V per caricare un'immagine
- **Auto-rilevamento** delle filigrane Gemini (analisi componenti connesse + punteggio di affidabilità)
- **Selezione manuale** — disegna un rettangolo su qualsiasi filigrana
- **Inpainting algoritmico** (campionamento basato su patch con media ponderata)
- **Slider prima/dopo** per confrontare i risultati
- **Controllo levigatura** (0-5 iterazioni Gaussiane)
- **Download** come PNG pulito
- **12 lingue** · **Responsive** · **Accessibile**
- Zero dipendenze — HTML5 + Canvas API + Vanilla JS

## Avvio rapido

```bash
python3 -m http.server 8080
# Aprire http://localhost:8080
```

## Come funziona

1. Carica un'immagine (trascina, clicca o incolla)
2. Lo strumento rileva automaticamente la filigrana ✦ di Gemini, oppure seleziona l'area manualmente
3. L'inpainting basato su patch riempie la regione con i pixel circostanti
4. Confronta con lo slider prima/dopo
5. Scarica il PNG pulito

## Autore

**David Carrero** — [carrero.es](https://carrero.es)

## Licenza

[MIT](LICENSE) — libero per uso personale e commerciale.
