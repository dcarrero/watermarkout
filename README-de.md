# WatermarkOut v0.5

Entfernen Sie Wasserzeichen von KI-generierten Bildern. **100% offline** — Ihr Bild verlässt nie Ihren Browser.

[![Lizenz: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · [Italiano](README-it.md) · **Deutsch** · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Funktionen

- **Drag & Drop**, Klick oder Strg+V zum Laden eines Bildes
- **Auto-Erkennung** von Gemini-Wasserzeichen (Analyse verbundener Komponenten + Konfidenzwert)
- **Manuelle Auswahl** — zeichnen Sie ein Rechteck über ein beliebiges Wasserzeichen
- **Algorithmisches Inpainting** (Patch-basiertes Sampling mit gewichtetem Durchschnitt)
- **Vorher/Nachher-Slider** zum Vergleichen der Ergebnisse
- **Glättungsregler** (0-5 Gaußsche Iterationen)
- **Download** als sauberes PNG
- **12 Sprachen** · **Responsive** · **Barrierefrei**
- Keine Abhängigkeiten — HTML5 + Canvas API + Vanilla JS

## Schnellstart

```bash
python3 -m http.server 8080
# Öffnen Sie http://localhost:8080
```

## So funktioniert es

1. Laden Sie ein Bild (ziehen, klicken oder einfügen)
2. Das Tool erkennt automatisch das Gemini ✦ Wasserzeichen, oder wählen Sie den Bereich manuell
3. Patch-basiertes Inpainting füllt den Bereich mit umgebenden Pixeln
4. Vergleichen Sie mit dem Vorher/Nachher-Slider
5. Laden Sie das saubere PNG herunter

## Autor

**David Carrero** — [carrero.es](https://carrero.es)

## Lizenz

[MIT](LICENSE) — frei für persönliche und kommerzielle Nutzung.
