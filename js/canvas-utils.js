/* ==========================================================================
   canvas-utils.js — Utilidades de Canvas y manipulación de píxeles
   ========================================================================== */

const MAX_DIMENSION = 6000;
const WARN_DIMENSION = 4000;

/**
 * Carga un archivo de imagen en un canvas.
 * Canvas dims = image dims (escalar vía CSS).
 * @param {File} file
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{width: number, height: number, imageData: ImageData, filename: string}>}
 */
export function loadImageToCanvas(file, canvas) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Formato no soportado. Usa PNG, JPG o WEBP.'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;

      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        reject(new Error(`Imagen demasiado grande (${w}×${h}). Máximo: ${MAX_DIMENSION}×${MAX_DIMENSION}.`));
        return;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const warning = (w > WARN_DIMENSION || h > WARN_DIMENSION)
        ? `Imagen grande (${w}×${h}). El procesamiento puede ser lento.`
        : null;

      resolve({ width: w, height: h, imageData, filename: file.name, warning });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer esta imagen. El archivo puede estar corrupto.'));
    };

    img.src = url;
  });
}

/**
 * Lee un píxel de ImageData (para rutas no-críticas).
 * En hot loops, usar acceso directo: data[(y * width + x) * 4]
 */
export function getPixel(imageData, x, y) {
  const idx = (y * imageData.width + x) * 4;
  const d = imageData.data;
  return { r: d[idx], g: d[idx + 1], b: d[idx + 2], a: d[idx + 3] };
}

/**
 * Escribe un píxel en ImageData (para rutas no-críticas).
 * En hot loops, usar acceso directo: data[idx] = r; ...
 */
export function setPixel(imageData, x, y, r, g, b, a) {
  const idx = (y * imageData.width + x) * 4;
  const d = imageData.data;
  d[idx] = r;
  d[idx + 1] = g;
  d[idx + 2] = b;
  d[idx + 3] = a;
}

/**
 * Clampa coordenadas dentro de los límites de la imagen.
 */
export function clampCoord(x, y, w, h) {
  return {
    x: Math.max(0, Math.min(x, w - 1)),
    y: Math.max(0, Math.min(y, h - 1)),
  };
}

/**
 * Clampa un rectángulo dentro de los límites de la imagen.
 */
export function clampRect(rect, imgW, imgH) {
  const x = Math.max(0, Math.min(rect.x, imgW));
  const y = Math.max(0, Math.min(rect.y, imgH));
  const w = Math.min(rect.w, imgW - x);
  const h = Math.min(rect.h, imgH - y);
  return { x, y, w, h };
}

/**
 * Itera sobre cada píxel dentro de un rectángulo.
 * Callback recibe (x, y, idx) donde idx es el offset en data[].
 * Usar esto evita duplicación entre detector e inpainting.
 */
export function forEachPixelInRect(imageData, rect, callback) {
  const { width } = imageData;
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(imageData.width, Math.floor(rect.x + rect.w));
  const y1 = Math.min(imageData.height, Math.floor(rect.y + rect.h));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      callback(x, y, (y * width + x) * 4);
    }
  }
}

/**
 * Dibuja un rectángulo de selección semi-transparente en el overlay canvas.
 * @param {CanvasRenderingContext2D} ctx - Contexto del overlay canvas
 * @param {{x: number, y: number, w: number, h: number}} rect - En coordenadas de imagen
 * @param {string} color - Color del overlay ('accent' | 'error' | string)
 */
export function drawMaskOverlay(ctx, rect, color = 'accent') {
  const colors = {
    accent: 'rgba(232, 255, 0, 0.25)',
    error: 'rgba(255, 68, 68, 0.25)',
    manual: 'rgba(255, 68, 68, 0.2)',
  };

  const fill = colors[color] || color;
  const stroke = color === 'accent' ? '#e8ff00' : color === 'manual' ? '#ff4444' : '#e8ff00';

  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setLineDash([]);
}

/**
 * Limpia el overlay canvas.
 */
export function clearOverlay(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Descarga el contenido de un canvas como PNG.
 * Usa toBlob con fallback a toDataURL para compatibilidad file://.
 */
export function downloadCanvas(canvas, filename) {
  const cleanName = filename
    ? filename.replace(/\.[^.]+$/, '') + '_clean.png'
    : 'image_clean.png';

  try {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, cleanName);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        fallbackDownload(canvas, cleanName);
      }
    }, 'image/png');
  } catch {
    fallbackDownload(canvas, cleanName);
  }
}

/**
 * Copia un ImageData (clon profundo).
 */
export function cloneImageData(imageData) {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
}

/**
 * Dibuja un ImageData en un canvas (reemplaza todo el contenido).
 */
export function putImageData(canvas, imageData) {
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Convierte coordenadas del mouse (relativas al elemento) a coordenadas de imagen.
 */
export function mouseToImageCoords(canvas, mouseX, mouseY) {
  const scaleX = canvas.width / canvas.offsetWidth;
  const scaleY = canvas.height / canvas.offsetHeight;
  return {
    x: Math.round(mouseX * scaleX),
    y: Math.round(mouseY * scaleY),
  };
}

/* --- Helpers internos --- */

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function fallbackDownload(canvas, filename) {
  const dataUrl = canvas.toDataURL('image/png');
  triggerDownload(dataUrl, filename);
}
