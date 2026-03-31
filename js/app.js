/* ==========================================================================
   app.js — Orquestador principal + FSM de estado
   Bloque 2: FSM completo + interacciones + wiring de botones
   ========================================================================== */

import {
  loadImageToCanvas, cloneImageData, putImageData,
  downloadCanvas, clearOverlay,
} from './canvas-utils.js';

import { setupRectSelector, setupBeforeAfter } from './ui.js';

/* --- Estado global --- */

const state = {
  phase: 'idle', // idle | image-loaded | mask-selected | processing | done
  originalImageData: null,
  workingImageData: null,
  filename: null,
  width: 0,
  height: 0,
  mask: null,
  selectMode: false,
};

/* --- DOM refs --- */

const $ = (id) => document.getElementById(id);

const app       = document.querySelector('.app');
const dropzone  = $('dropzone');
const fileInput = $('file-input');
const canvasMain    = $('canvas-main');
const canvasOverlay = $('canvas-overlay');
const canvasCompare = $('canvas-compare');
const fileName  = $('file-name');
const fileDims  = $('file-dims');
const messageEl = $('message');

// Buttons
const btnAutodetect = $('btn-autodetect');
const btnManual     = $('btn-manual');
const btnRemove     = $('btn-remove');
const btnDownload   = $('btn-download');
const btnUndo       = $('btn-undo');
const btnNew        = $('btn-new');

// Slider
const sliderSmooth = $('slider-smooth');
const smoothValue  = $('smooth-value');

// Progress
const progressWrap = $('progress-wrap');
const progressBar  = $('progress-bar');
const progressText = $('progress-text');

// Before/After
const baSlider = $('ba-slider');
const baHandle = $('ba-handle');

// Detect feedback
const detectFeedback = $('detect-feedback');

/* --- UI modules --- */

let rectSelector;
let beforeAfter;

/* --- FSM --- */

function transition(newPhase) {
  const prev = state.phase;
  state.phase = newPhase;
  app.dataset.state = newPhase;

  // Side effects per transition
  if (newPhase === 'idle') {
    rectSelector?.setEnabled(false);
    rectSelector?.clear();
    beforeAfter?.hide();
    hideMessage();
    hideFeedback();
  }

  if (newPhase === 'image-loaded') {
    rectSelector?.setEnabled(false);
    rectSelector?.clear();
    beforeAfter?.hide();
    btnRemove.disabled = true;
    hideFeedback();
    state.mask = null;
    state.selectMode = false;

    // Auto-detección al cargar (expansión E5)
    autoDetect();
  }

  if (newPhase === 'mask-selected') {
    rectSelector?.setEnabled(false);
    btnRemove.disabled = false;
  }

  if (newPhase === 'processing') {
    rectSelector?.setEnabled(false);
    updateProgress(0);
  }

  if (newPhase === 'done') {
    rectSelector?.setEnabled(false);
    rectSelector?.clear();

    // Preparar before/after: dibujar original en compare canvas
    putImageData(canvasCompare, state.originalImageData);
    beforeAfter?.show();
  }
}

/* --- Mensajes --- */

function showMessage(text, type = 'info', duration = 4000) {
  messageEl.textContent = text;
  messageEl.className = `message message--${type}`;
  messageEl.hidden = false;
  if (duration > 0) {
    clearTimeout(messageEl._timer);
    messageEl._timer = setTimeout(() => { messageEl.hidden = true; }, duration);
  }
}

function hideMessage() {
  messageEl.hidden = true;
}

/* --- Detection feedback --- */

function showFeedback(text, type = 'found') {
  detectFeedback.textContent = text;
  detectFeedback.className = `detect-feedback detect-feedback--${type}`;
  detectFeedback.hidden = false;
}

function hideFeedback() {
  detectFeedback.hidden = true;
}

/* --- Progress --- */

function updateProgress(pct) {
  const p = Math.round(pct * 100);
  progressBar.style.setProperty('--progress', `${p}%`);
  progressBar.setAttribute('aria-valuenow', p);
  progressText.textContent = `Eliminando... ${p}%`;
}

/* --- Carga de imagen --- */

async function handleFile(file) {
  if (!file) return;

  try {
    const result = await loadImageToCanvas(file, canvasMain);

    canvasOverlay.width = result.width;
    canvasOverlay.height = result.height;
    canvasCompare.width = result.width;
    canvasCompare.height = result.height;

    state.originalImageData = cloneImageData(result.imageData);
    state.workingImageData = result.imageData;
    state.filename = result.filename;
    state.width = result.width;
    state.height = result.height;
    state.mask = null;

    fileName.textContent = result.filename;
    fileDims.textContent = `${result.width} × ${result.height}`;

    if (result.warning) {
      showMessage(result.warning, 'warning', 5000);
    }

    transition('image-loaded');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

/* --- Auto-detección (placeholder — se reemplaza en Bloque 3) --- */

async function autoDetect() {
  try {
    // Importación dinámica: si detector.js no existe aún, no falla
    const { detectGeminiWatermark } = await import('./detector.js');

    const result = detectGeminiWatermark(
      state.workingImageData, state.width, state.height
    );

    if (result.detected && result.confidence >= 0.7) {
      state.mask = result.rect;
      rectSelector.showDetectionRect(result.rect);
      showFeedback('✦ Marca detectada', 'found');
      transition('mask-selected');
    } else if (result.detected && result.confidence < 0.7) {
      state.mask = result.rect;
      rectSelector.showDetectionRect(result.rect);
      showFeedback('Posible marca — verificar manualmente', 'maybe');
      transition('mask-selected');
    } else {
      showFeedback('No se detectó marca automáticamente. Usa "Selección manual" para marcar la zona.', 'notfound');
    }
  } catch {
    showFeedback('Usa "Selección manual" para marcar la zona a eliminar.', 'notfound');
  }
}

/* --- Inpainting (placeholder — se reemplaza en Bloque 3) --- */

async function runInpainting() {
  if (!state.mask || state.phase !== 'mask-selected') return;

  transition('processing');

  try {
    const { inpaintRegion } = await import('./inpainting.js');
    const smoothing = parseInt(sliderSmooth.value, 10);

    // Trabajar sobre una copia
    const workData = cloneImageData(state.workingImageData);

    await inpaintRegion(
      workData, state.mask, state.width, state.height,
      (pct) => updateProgress(pct),
      smoothing
    );

    state.workingImageData = workData;
    putImageData(canvasMain, workData);

    showMessage('¡Marca eliminada!', 'success', 3000);
    transition('done');
  } catch (err) {
    showMessage(
      err.message || 'Error al procesar. Intenta con otra selección.',
      'error'
    );
    transition('mask-selected');
  }
}

/* --- Drag & drop --- */

function setupDragDrop() {
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

/* --- Clipboard paste (Ctrl+V) --- */

function setupClipboard() {
  document.addEventListener('paste', (e) => {
    if (state.phase !== 'idle' && state.phase !== 'image-loaded') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { handleFile(file); return; }
      }
    }
  });
}

/* --- Botones --- */

function setupButtons() {
  // Auto-detectar
  btnAutodetect.addEventListener('click', () => {
    if (state.phase === 'image-loaded' || state.phase === 'mask-selected') {
      rectSelector.clear();
      hideFeedback();
      state.mask = null;
      transition('image-loaded');
    }
  });

  // Selección manual
  btnManual.addEventListener('click', () => {
    if (state.phase !== 'image-loaded' && state.phase !== 'mask-selected') return;
    state.selectMode = true;
    rectSelector.setEnabled(true);
    rectSelector.clear();
    hideFeedback();
    state.mask = null;
    btnRemove.disabled = true;
    showMessage('Dibuja un rectángulo sobre la marca de agua', 'info', 3000);
  });

  // Eliminar
  btnRemove.addEventListener('click', () => {
    if (state.mask && state.phase === 'mask-selected') {
      const area = state.mask.w * state.mask.h;
      if (area > 200 * 200) {
        showMessage('Área grande — el procesamiento puede tardar unos segundos.', 'warning', 3000);
      }
      runInpainting();
    }
  });

  // Descargar
  btnDownload.addEventListener('click', () => {
    if (state.phase === 'done') {
      downloadCanvas(canvasMain, state.filename);
    }
  });

  // Deshacer
  btnUndo.addEventListener('click', () => {
    if (state.phase !== 'done') return;
    putImageData(canvasMain, cloneImageData(state.originalImageData));
    state.workingImageData = cloneImageData(state.originalImageData);
    beforeAfter?.hide();
    transition('image-loaded');
  });

  // Nueva imagen
  btnNew.addEventListener('click', () => {
    state.originalImageData = null;
    state.workingImageData = null;
    state.filename = null;
    state.mask = null;

    canvasMain.getContext('2d').clearRect(0, 0, canvasMain.width, canvasMain.height);
    clearOverlay(canvasOverlay.getContext('2d'));
    canvasCompare.getContext('2d').clearRect(0, 0, canvasCompare.width, canvasCompare.height);

    fileInput.value = '';
    transition('idle');
  });

  // Slider de suavizado
  sliderSmooth.addEventListener('input', () => {
    smoothValue.textContent = sliderSmooth.value;
  });
}

/* --- Init --- */

function init() {
  // Setup UI modules
  rectSelector = setupRectSelector(canvasOverlay, canvasMain, (rect) => {
    state.mask = rect;
    state.selectMode = false;
    rectSelector.setEnabled(false);
    showFeedback(`Selección: ${rect.w}×${rect.h}px`, 'found');
    transition('mask-selected');
  });

  beforeAfter = setupBeforeAfter(canvasCompare, baSlider, baHandle);

  // Setup event handlers
  setupDragDrop();
  setupClipboard();
  setupButtons();

  // Initial state
  transition('idle');
}

init();

export { state, transition, showMessage, handleFile };
