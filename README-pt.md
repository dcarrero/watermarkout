# WatermarkOut v0.5

Remova marcas d'água de imagens geradas por IA. **100% offline** — sua imagem nunca sai do seu navegador.

[![Licença: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · [Italiano](README-it.md) · [Deutsch](README-de.md) · **Português** · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · [日本語](README-ja.md) · [العربية](README-ar.md)

## Funcionalidades

- **Arrastar e soltar**, clicar ou Ctrl+V para carregar uma imagem
- **Auto-detecção** de marcas d'água do Gemini (análise de componentes conectados + pontuação de confiança)
- **Seleção manual** — desenhe um retângulo sobre qualquer marca d'água
- **Inpainting algorítmico** (amostragem baseada em patches com média ponderada)
- **Slider antes/depois** para comparar resultados
- **Controle de suavização** (0-5 iterações Gaussianas)
- **Download** como PNG limpo
- **12 idiomas** · **Responsivo** · **Acessível**
- Zero dependências — HTML5 + Canvas API + Vanilla JS

## Início rápido

```bash
python3 -m http.server 8080
# Abrir http://localhost:8080
```

## Como funciona

1. Carregue uma imagem (arraste, clique ou cole)
2. A ferramenta detecta automaticamente a marca ✦ do Gemini, ou selecione a área manualmente
3. O inpainting baseado em patches preenche a região com pixels ao redor
4. Compare com o slider antes/depois
5. Baixe o PNG limpo

## Autor

**David Carrero** — [carrero.es](https://carrero.es)

## Licença

[MIT](LICENSE) — livre para uso pessoal e comercial.
