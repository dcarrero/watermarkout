/* ==========================================================================
   inpainting.js — Patch-Based Sampling con weighted averaging

   Correcciones de la revisión de ingeniería aplicadas:
   - searchRadius dinámico (fix bug crítico para masks >76px)
   - Acceso directo a Uint8ClampedArray en hot loop (no getPixel/setPixel)
   - Double-buffering para Gaussian smoothing
   - Constraint suavizado: ponderar parches por fracción fuera de máscara
   ========================================================================== */

const PATCH_SIZE = 9;       // Reducido de 15 a 9 (revisión: gradientes ok con menos)
const NUM_SAMPLES = 12;
const PIXELS_PER_CHUNK = 800; // ~60fps responsiveness

/**
 * Rellena la región enmascarada con píxeles sintéticos.
 *
 * @param {ImageData} imageData - Se modifica in-place
 * @param {{x,y,w,h}} mask - Región a rellenar (en coords de imagen)
 * @param {number} width
 * @param {number} height
 * @param {(pct: number) => void} onProgress - 0..1
 * @param {number} [smoothIterations=1] - Iteraciones del Gaussian post-process
 */
export async function inpaintRegion(imageData, mask, width, height, onProgress, smoothIterations = 1) {
  const data = imageData.data;

  // searchRadius dinámico: garantiza que siempre haya espacio de búsqueda
  const halfMask = Math.max(mask.w, mask.h) / 2;
  const searchRadius = Math.ceil(halfMask + PATCH_SIZE + 8);

  // Construir set de píxeles dentro de la máscara (para lookup rápido)
  const maskSet = buildMaskSet(mask, width);

  // Construir lista de píxeles a rellenar
  const pixels = [];
  for (let y = mask.y; y < mask.y + mask.h && y < height; y++) {
    for (let x = mask.x; x < mask.x + mask.w && x < width; x++) {
      pixels.push(x, y); // flat array [x0,y0, x1,y1, ...]
    }
  }

  const totalPixels = pixels.length / 2;
  if (totalPixels === 0) return;

  // Pre-calcular colores de borde de la máscara para colorWeight
  const borderColors = sampleBorderColors(data, mask, width, height, maskSet);

  // Procesar en chunks asíncronos
  let processed = 0;

  for (let i = 0; i < pixels.length; i += PIXELS_PER_CHUNK * 2) {
    const end = Math.min(i + PIXELS_PER_CHUNK * 2, pixels.length);

    for (let j = i; j < end; j += 2) {
      const px = pixels[j];
      const py = pixels[j + 1];

      fillPixel(data, px, py, width, height, searchRadius, maskSet, borderColors);
    }

    processed += (end - i) / 2;
    onProgress(Math.min(0.9, processed / totalPixels)); // reservar 10% para smoothing

    // Yield al event loop
    await yieldFrame();
  }

  // Post-proceso: Gaussian smoothing con double-buffering
  if (smoothIterations > 0) {
    gaussianSmooth(imageData, mask, width, height, smoothIterations);
  }

  onProgress(1);
}

/* --- Relleno de un píxel individual --- */

function fillPixel(data, px, py, width, height, searchRadius, maskSet, borderColors) {
  const half = Math.floor(PATCH_SIZE / 2);

  // Recoger candidatos del área de búsqueda (fuera de la máscara)
  let totalWeight = 0;
  let sumR = 0, sumG = 0, sumB = 0;
  let samplesFound = 0;

  // Muestreo pseudo-aleatorio con seed determinista (basado en posición)
  let seed = px * 7919 + py * 6271;

  for (let attempt = 0; attempt < NUM_SAMPLES * 3 && samplesFound < NUM_SAMPLES; attempt++) {
    // LCG simple para pseudo-aleatoriedad rápida
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const angle = (seed / 0x7fffffff) * Math.PI * 2;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const dist = half + 2 + (seed / 0x7fffffff) * searchRadius;

    const cx = Math.round(px + Math.cos(angle) * dist);
    const cy = Math.round(py + Math.sin(angle) * dist);

    // Verificar bounds
    if (cx - half < 0 || cx + half >= width || cy - half < 0 || cy + half >= height) continue;

    // Calcular fracción del parche fuera de la máscara (constraint suavizado)
    const outsideFraction = patchOutsideFraction(cx, cy, half, width, maskSet);
    if (outsideFraction < 0.5) continue; // al menos 50% fuera

    // Calcular pesos
    const dx = px - cx;
    const dy = py - cy;
    const distSq = dx * dx + dy * dy;
    const distWeight = 1 / (distSq + 1);

    // Color weight: similitud con el borde más cercano
    const cidx = (cy * width + cx) * 4;
    const colorWeight = borderColorSimilarity(
      data[cidx], data[cidx + 1], data[cidx + 2],
      borderColors
    );

    const weight = distWeight * colorWeight * outsideFraction;

    sumR += data[cidx] * weight;
    sumG += data[cidx + 1] * weight;
    sumB += data[cidx + 2] * weight;
    totalWeight += weight;
    samplesFound++;
  }

  // Escribir píxel resultante
  const idx = (py * width + px) * 4;

  if (totalWeight > 0) {
    data[idx]     = Math.round(sumR / totalWeight);
    data[idx + 1] = Math.round(sumG / totalWeight);
    data[idx + 2] = Math.round(sumB / totalWeight);
    data[idx + 3] = 255;
  } else {
    // Fallback: promedio simple de los 4 vecinos más cercanos fuera de máscara
    fallbackAverage(data, px, py, width, height, maskSet, idx);
  }
}

/* --- Fracción del parche fuera de la máscara --- */

function patchOutsideFraction(cx, cy, half, width, maskSet) {
  let outside = 0;
  let total = 0;
  // Muestrear esquinas + centro (5 puntos en vez de patch completo — rápido)
  const offsets = [[0, 0], [-half, -half], [half, -half], [-half, half], [half, half]];

  for (const [ox, oy] of offsets) {
    total++;
    const key = (cy + oy) * width + (cx + ox);
    if (!maskSet.has(key)) outside++;
  }

  return outside / total;
}

/* --- Similitud con colores del borde --- */

function borderColorSimilarity(r, g, b, borderColors) {
  let minDist = Infinity;

  for (let i = 0; i < borderColors.length; i += 3) {
    const dr = r - borderColors[i];
    const dg = g - borderColors[i + 1];
    const db = b - borderColors[i + 2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < minDist) minDist = dist;
  }

  // Convertir distancia a similitud (0-1)
  return 1 / (1 + minDist / 5000);
}

/* --- Muestrear colores del borde de la máscara --- */

function sampleBorderColors(data, mask, width, height, maskSet) {
  const colors = []; // flat: [r,g,b, r,g,b, ...]
  const step = Math.max(1, Math.floor(Math.max(mask.w, mask.h) / 20));

  // Borde superior e inferior
  for (let dx = 0; dx < mask.w; dx += step) {
    for (const dy of [-1, mask.h]) {
      const x = mask.x + dx;
      const y = mask.y + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const key = y * width + x;
        if (!maskSet.has(key)) {
          const idx = key * 4;
          colors.push(data[idx], data[idx + 1], data[idx + 2]);
        }
      }
    }
  }

  // Borde izquierdo y derecho
  for (let dy = 0; dy < mask.h; dy += step) {
    for (const dx of [-1, mask.w]) {
      const x = mask.x + dx;
      const y = mask.y + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const key = y * width + x;
        if (!maskSet.has(key)) {
          const idx = key * 4;
          colors.push(data[idx], data[idx + 1], data[idx + 2]);
        }
      }
    }
  }

  // Mínimo: si no hay colores, usar gris medio
  if (colors.length === 0) {
    colors.push(128, 128, 128);
  }

  return colors;
}

/* --- Fallback: promedio de vecinos --- */

function fallbackAverage(data, px, py, width, height, maskSet, targetIdx) {
  let sumR = 0, sumG = 0, sumB = 0, count = 0;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const key = ny * width + nx;
      if (maskSet.has(key)) continue;

      const nidx = key * 4;
      sumR += data[nidx];
      sumG += data[nidx + 1];
      sumB += data[nidx + 2];
      count++;
    }
  }

  if (count > 0) {
    data[targetIdx]     = Math.round(sumR / count);
    data[targetIdx + 1] = Math.round(sumG / count);
    data[targetIdx + 2] = Math.round(sumB / count);
  }
  data[targetIdx + 3] = 255;
}

/* --- Gaussian smoothing con double-buffering --- */

function gaussianSmooth(imageData, mask, width, height, iterations) {
  // Kernel 3x3: [1,2,1, 2,4,2, 1,2,1] / 16
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  const data = imageData.data;

  // Buffer de lectura (copia de la zona de trabajo)
  const bufferSize = (mask.w + 2) * (mask.h + 2) * 4;
  const readBuffer = new Uint8ClampedArray(bufferSize);
  const bufW = mask.w + 2;

  for (let iter = 0; iter < iterations; iter++) {
    // Copiar zona de trabajo + 1px margen al read buffer
    for (let dy = -1; dy <= mask.h; dy++) {
      for (let dx = -1; dx <= mask.w; dx++) {
        const sx = mask.x + dx;
        const sy = mask.y + dy;
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = ((dy + 1) * bufW + (dx + 1)) * 4;

        readBuffer[dstIdx]     = data[srcIdx];
        readBuffer[dstIdx + 1] = data[srcIdx + 1];
        readBuffer[dstIdx + 2] = data[srcIdx + 2];
        readBuffer[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    // Aplicar kernel leyendo de readBuffer, escribiendo en data
    for (let dy = 0; dy < mask.h; dy++) {
      for (let dx = 0; dx < mask.w; dx++) {
        const x = mask.x + dx;
        const y = mask.y + dy;
        if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) continue;

        let r = 0, g = 0, b = 0;
        let ki = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const bIdx = ((dy + 1 + ky) * bufW + (dx + 1 + kx)) * 4;
            const w = kernel[ki++];
            r += readBuffer[bIdx] * w;
            g += readBuffer[bIdx + 1] * w;
            b += readBuffer[bIdx + 2] * w;
          }
        }

        const outIdx = (y * width + x) * 4;
        data[outIdx]     = Math.round(r / kernelSum);
        data[outIdx + 1] = Math.round(g / kernelSum);
        data[outIdx + 2] = Math.round(b / kernelSum);
      }
    }
  }
}

/* --- Helpers --- */

function buildMaskSet(mask, width) {
  const set = new Set();
  for (let y = mask.y; y < mask.y + mask.h; y++) {
    for (let x = mask.x; x < mask.x + mask.w; x++) {
      set.add(y * width + x);
    }
  }
  return set;
}

function yieldFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
