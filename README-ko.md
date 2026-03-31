# WatermarkOut v0.5

AI 생성 이미지에서 워터마크를 제거합니다. **100% 오프라인** — 이미지가 브라우저를 떠나지 않습니다.

[![라이선스: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) · [Español](README-es.md) · [Français](README-fr.md) · [Italiano](README-it.md) · [Deutsch](README-de.md) · [Português](README-pt.md) · [Nederlands](README-nl.md) · [Polski](README-pl.md) · [Română](README-ro.md) · **한국어** · [日本語](README-ja.md) · [العربية](README-ar.md)

## 기능

- **드래그 앤 드롭**, 클릭 또는 Ctrl+V로 이미지 로드
- Gemini 워터마크 **자동 감지** (연결 요소 분석 + 신뢰도 점수)
- **수동 선택** — 워터마크 위에 사각형 그리기
- **알고리즘 인페인팅** (가중 평균을 사용한 패치 기반 샘플링)
- **전/후 슬라이더**로 결과 비교
- **스무딩 조절** (가우시안 반복 0-5회)
- 깨끗한 **PNG 다운로드**
- **12개 언어** · **반응형** · **접근성 지원**
- 의존성 없음 — HTML5 + Canvas API + Vanilla JS

## 빠른 시작

```bash
python3 -m http.server 8080
# http://localhost:8080 열기
```

## 저자

**David Carrero** — [carrero.es](https://carrero.es)

## 라이선스

[MIT](LICENSE) — 개인 및 상업적 사용 무료.
