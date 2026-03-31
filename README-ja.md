# WatermarkOut v0.5

AI生成画像から透かしを削除します。**100%オフライン** — 画像はブラウザの外に出ません。

[![ライセンス: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · [Italiano](README-it.md) · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · [한국어](README-ko.md) · **日本語** · [العربية](README-ar.md)

## 機能

- **ドラッグ＆ドロップ**、クリック、またはCtrl+Vで画像を読み込み
- Gemini透かしの**自動検出**（連結成分分析 + 信頼度スコア）
- **手動選択** — 透かしの上に四角形を描画
- **アルゴリズムによるインペインティング**（加重平均によるパッチベースサンプリング）
- **ビフォー/アフタースライダー**で結果を比較
- **スムージング調整**（ガウシアン反復0-5回）
- クリーンな**PNGダウンロード**
- **12言語対応** · **レスポンシブ** · **アクセシブル**
- 依存関係ゼロ — HTML5 + Canvas API + Vanilla JS

## クイックスタート

```bash
python3 -m http.server 8080
# http://localhost:8080 を開く
```

## 作者

**David Carrero** — [carrero.es](https://carrero.es)

## ライセンス

[MIT](LICENSE) — 個人および商用利用無料。
