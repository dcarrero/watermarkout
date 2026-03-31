# WatermarkOut v0.5

Supprimez les filigranes des images générées par IA. **100% hors ligne** — votre image ne quitte jamais votre navigateur.

[![Licence : MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · **Français** · [Italiano](README-it.md) · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Fonctionnalités

- **Glisser-déposer**, cliquer ou Ctrl+V pour charger une image
- **Auto-détection** des filigranes Gemini (analyse de composantes connexes + score de confiance)
- **Sélection manuelle** — dessinez un rectangle sur n'importe quel filigrane
- **Inpainting algorithmique** (échantillonnage par patchs avec moyenne pondérée)
- **Curseur avant/après** pour comparer les résultats
- **Contrôle de lissage** (0-5 itérations Gaussiennes)
- **Téléchargement** en PNG propre
- **12 langues** · **Responsive** · **Accessible**
- Zéro dépendance — HTML5 + Canvas API + Vanilla JS

## Démarrage rapide

```bash
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

## Comment ça marche

1. Chargez une image (glisser, cliquer ou coller)
2. L'outil auto-détecte le filigrane ✦ de Gemini, ou sélectionnez la zone manuellement
3. L'inpainting par patchs remplit la région avec les pixels environnants
4. Comparez avec le curseur avant/après
5. Téléchargez le PNG propre

## Auteur

**David Carrero** — [carrero.es](https://carrero.es)

## Licence

[MIT](LICENSE) — libre pour usage personnel et commercial.
