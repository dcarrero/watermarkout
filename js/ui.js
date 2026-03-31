/* ==========================================================================
   ui.js — Interacciones de usuario
   Selector de región, touch, before/after slider
   WatermarkOut — https://github.com/dcarrero/watermarkout
   Copyright (c) 2026 David Carrero (https://carrero.es)
   Licensed under the MIT License
   ========================================================================== */

import { mouseToImageCoords, drawMaskOverlay, clearOverlay, clampRect } from './canvas-utils.js';

/* --- Rectangle Selector --- */

/**
 * Configura el selector de rectángulo sobre el overlay canvas.
 * @param {HTMLCanvasElement} overlayCanvas
 * @param {HTMLCanvasElement} mainCanvas - Para calcular coordenadas de imagen
 * @param {(rect: {x,y,w,h}) => void} onSelect - Callback con rect en coords de imagen
 */
export function setupRectSelector(overlayCanvas, mainCanvas, onSelect) {
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentRect = null;

  function getCoords(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      mouseX: clientX - rect.left,
      mouseY: clientY - rect.top,
    };
  }

  function handleStart(e) {
    if (!overlayCanvas.dataset.selectable) return;
    e.preventDefault();

    const { mouseX, mouseY } = getCoords(e);
    const imgCoords = mouseToImageCoords(mainCanvas, mouseX, mouseY);

    isDrawing = true;
    startX = imgCoords.x;
    startY = imgCoords.y;
    currentRect = null;

    const ctx = overlayCanvas.getContext('2d');
    clearOverlay(ctx);
  }

  function handleMove(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const { mouseX, mouseY } = getCoords(e);
    const imgCoords = mouseToImageCoords(mainCanvas, mouseX, mouseY);

    const x = Math.min(startX, imgCoords.x);
    const y = Math.min(startY, imgCoords.y);
    const w = Math.abs(imgCoords.x - startX);
    const h = Math.abs(imgCoords.y - startY);

    currentRect = clampRect({ x, y, w, h }, mainCanvas.width, mainCanvas.height);

    const ctx = overlayCanvas.getContext('2d');
    clearOverlay(ctx);
    if (currentRect.w > 2 && currentRect.h > 2) {
      drawMaskOverlay(ctx, currentRect, 'manual');
    }
  }

  function handleEnd(e) {
    if (!isDrawing) return;
    e.preventDefault();
    isDrawing = false;

    if (currentRect && currentRect.w > 4 && currentRect.h > 4) {
      onSelect(currentRect);
    }
    currentRect = null;
  }

  // Mouse events
  overlayCanvas.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  // Touch events
  overlayCanvas.addEventListener('touchstart', handleStart, { passive: false });
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd, { passive: false });

  return {
    /** Habilita/deshabilita el selector */
    setEnabled(enabled) {
      overlayCanvas.dataset.selectable = enabled ? '1' : '';
      overlayCanvas.style.cursor = enabled ? 'crosshair' : 'default';
    },
    /** Dibuja un rect de detección (amarillo) */
    showDetectionRect(rect) {
      const ctx = overlayCanvas.getContext('2d');
      clearOverlay(ctx);
      drawMaskOverlay(ctx, rect, 'accent');
    },
    /** Limpia el overlay */
    clear() {
      const ctx = overlayCanvas.getContext('2d');
      clearOverlay(ctx);
    },
  };
}

/* --- Before/After Slider --- */

/**
 * Configura el slider before/after sobre los canvas.
 * Usa CSS clip-path en canvas-compare para revelar la imagen original.
 * @param {HTMLCanvasElement} compareCanvas - Canvas con la imagen original
 * @param {HTMLElement} sliderEl - Contenedor del slider
 * @param {HTMLElement} handleEl - Handle arrastrable
 */
export function setupBeforeAfter(compareCanvas, sliderEl, handleEl) {
  let isDragging = false;
  let position = 50; // porcentaje 0-100

  function updatePosition(pct) {
    position = Math.max(0, Math.min(100, pct));
    // clip-path: muestra la parte izquierda (ANTES = original)
    compareCanvas.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
    handleEl.style.left = `${position}%`;
    handleEl.setAttribute('aria-valuenow', Math.round(position));
  }

  function getPct(clientX) {
    const rect = sliderEl.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function handleStart(e) {
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    updatePosition(getPct(clientX));
    e.preventDefault();
  }

  function handleMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    updatePosition(getPct(clientX));
    e.preventDefault();
  }

  function handleEnd() {
    isDragging = false;
  }

  // Mouse
  handleEl.addEventListener('mousedown', handleStart);
  sliderEl.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);

  // Touch
  handleEl.addEventListener('touchstart', handleStart, { passive: false });
  sliderEl.addEventListener('touchstart', handleStart, { passive: false });
  window.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleEnd, { passive: false });

  // Keyboard (accesibilidad)
  handleEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') updatePosition(position - 2);
    if (e.key === 'ArrowRight') updatePosition(position + 2);
  });

  return {
    /** Muestra el slider y resetea a 50% */
    show() {
      sliderEl.hidden = false;
      compareCanvas.style.display = 'block';
      updatePosition(50);
    },
    /** Oculta el slider */
    hide() {
      sliderEl.hidden = true;
      compareCanvas.style.display = 'none';
    },
    /** Actualiza posición */
    setPosition: updatePosition,
  };
}
