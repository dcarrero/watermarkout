/* ==========================================================================
   detector.js — Auto-detección de marca de agua Gemini
   Usa análisis de componentes conectados + luminancia RELATIVA.
   Interfaz pluggable: {detected, rect, confidence}
   ========================================================================== */

/**
 * Detecta la marca de agua de Gemini (estrella ✦) en una imagen.
 *
 * Algoritmo:
 * 1. Escanea la esquina inferior-derecha (12% de la imagen)
 * 2. Calcula luminancia media local del fondo
 * 3. Encuentra píxeles significativamente más brillantes que el fondo (relativos)
 * 4. Agrupa candidatos en clusters (componentes conectados)
 * 5. Filtra clusters por tamaño, aspect ratio (~1:1) y aislamiento
 * 6. Retorna el cluster más probable como watermark
 *
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {{detected: boolean, rect: {x,y,w,h}|null, confidence: number}}
 */
export function detectGeminiWatermark(imageData, width, height) {
  const data = imageData.data;

  // Zona de búsqueda: esquina inferior-derecha 12%
  const searchX = Math.floor(width * 0.88);
  const searchY = Math.floor(height * 0.88);
  const searchW = width - searchX;
  const searchH = height - searchY;

  // Paso 1: Calcular luminancia media del fondo en la zona de búsqueda
  const bgLum = computeAverageLuminance(data, width, searchX, searchY, searchW, searchH);

  // Paso 2: Encontrar píxeles candidatos por luminancia RELATIVA al fondo
  const candidates = findBrightPixels(data, width, searchX, searchY, searchW, searchH, bgLum);

  if (candidates.length < 10) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 3: Agrupar en clusters por componentes conectados
  const clusters = findClusters(candidates, 3);

  if (clusters.length === 0) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 4: Evaluar cada cluster
  let bestCluster = null;
  let bestScore = 0;

  for (const cluster of clusters) {
    const score = evaluateCluster(cluster, data, width, height, bgLum);
    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  if (!bestCluster || bestScore < 0.15) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 5: Calcular bounding box con margen
  const bbox = clusterBoundingBox(bestCluster);
  const margin = 10;
  const rect = {
    x: Math.max(0, bbox.x - margin),
    y: Math.max(0, bbox.y - margin),
    w: Math.min(width - Math.max(0, bbox.x - margin), bbox.w + margin * 2),
    h: Math.min(height - Math.max(0, bbox.y - margin), bbox.h + margin * 2),
  };

  return {
    detected: true,
    rect,
    confidence: Math.min(1, bestScore),
  };
}

/* --- Luminancia media del fondo --- */

function computeAverageLuminance(data, imgWidth, sx, sy, sw, sh) {
  let totalLum = 0;
  let count = 0;
  // Muestrear cada 3 píxeles para velocidad
  const step = 3;

  for (let dy = 0; dy < sh; dy += step) {
    for (let dx = 0; dx < sw; dx += step) {
      const idx = ((sy + dy) * imgWidth + (sx + dx)) * 4;
      totalLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      count++;
    }
  }

  return count > 0 ? totalLum / count : 128;
}

/* --- Paso 2: Píxeles brillantes (relativo al fondo) --- */

function findBrightPixels(data, imgWidth, sx, sy, sw, sh, bgLum) {
  // Umbral adaptativo: el píxel debe ser significativamente más brillante que el fondo
  // En fondos oscuros (bgLum < 80): umbral absoluto de 180
  // En fondos claros (bgLum > 150): buscar píxeles que estén al menos 30 puntos sobre el fondo
  const threshold = Math.max(180, bgLum + 30);
  const ALPHA_THRESHOLD = 50;
  const candidates = [];

  for (let dy = 0; dy < sh; dy++) {
    for (let dx = 0; dx < sw; dx++) {
      const x = sx + dx;
      const y = sy + dy;
      const idx = (y * imgWidth + x) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > threshold && a > ALPHA_THRESHOLD) {
        candidates.push({ x, y, lum });
      }
    }
  }

  // Si el umbral adaptativo no encontró suficientes candidatos,
  // intentar con un delta menor (la estrella puede tener poco contraste)
  if (candidates.length < 10 && bgLum > 100) {
    candidates.length = 0;
    const softThreshold = bgLum + 15;

    for (let dy = 0; dy < sh; dy++) {
      for (let dx = 0; dx < sw; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        const idx = (y * imgWidth + x) * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum > softThreshold && a > ALPHA_THRESHOLD) {
          candidates.push({ x, y, lum });
        }
      }
    }
  }

  return candidates;
}

/* --- Paso 3: Componentes conectados --- */

function findClusters(pixels, maxDist) {
  const visited = new Set();
  const clusters = [];
  const maxDistSq = maxDist * maxDist;

  // Index espacial para acelerar vecinos
  const grid = new Map();
  const cellSize = maxDist + 1;

  for (const p of pixels) {
    const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }

  function getNeighbors(p) {
    const cx = Math.floor(p.x / cellSize);
    const cy = Math.floor(p.y / cellSize);
    const neighbors = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = grid.get(key);
        if (!cell) continue;
        for (const q of cell) {
          if (q === p) continue;
          const distSq = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
          if (distSq <= maxDistSq) neighbors.push(q);
        }
      }
    }

    return neighbors;
  }

  for (const p of pixels) {
    const key = `${p.x},${p.y}`;
    if (visited.has(key)) continue;

    const cluster = [];
    const queue = [p];
    visited.add(key);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      for (const neighbor of getNeighbors(current)) {
        const nKey = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(nKey)) {
          visited.add(nKey);
          queue.push(neighbor);
        }
      }
    }

    if (cluster.length >= 10) {
      clusters.push(cluster);
    }
  }

  // Ordenar por tamaño (los clusters más pequeños primero — la estrella es pequeña)
  clusters.sort((a, b) => a.length - b.length);

  return clusters;
}

/* --- Paso 4: Evaluar cluster --- */

function evaluateCluster(cluster, data, imgWidth, imgHeight, bgLum) {
  const bbox = clusterBoundingBox(cluster);
  let score = 0;

  // Factor 1: Tamaño razonable (entre 8px y 100px)
  const size = Math.max(bbox.w, bbox.h);
  if (size >= 8 && size <= 100) {
    score += 0.25;
  } else if (size > 100 && size <= 200) {
    score += 0.1;
  } else {
    return 0;
  }

  // Factor 2: Aspect ratio cercano a 1:1 (la estrella es cuadrada)
  const aspect = bbox.w / (bbox.h || 1);
  if (aspect > 0.5 && aspect < 2.0) {
    score += 0.2;
  } else {
    score += 0.03;
  }

  // Factor 3: Densidad del cluster (estrella es ~20-60% del bbox)
  const area = bbox.w * bbox.h;
  const density = cluster.length / (area || 1);
  if (density > 0.1 && density < 0.8) {
    score += 0.2;
  } else {
    score += 0.03;
  }

  // Factor 4: Contraste con entorno local (más importante que aislamiento absoluto)
  const contrast = measureLocalContrast(bbox, cluster, data, imgWidth, imgHeight, bgLum);
  score += contrast * 0.35;

  return score;
}

/**
 * Mide el contraste entre el cluster y sus píxeles vecinos inmediatos.
 * Funciona tanto en fondos oscuros como claros.
 */
function measureLocalContrast(bbox, cluster, data, imgWidth, imgHeight, bgLum) {
  // Calcular luminancia media del cluster
  let clusterLum = 0;
  for (const p of cluster) {
    const idx = (p.y * imgWidth + p.x) * 4;
    clusterLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  clusterLum /= cluster.length;

  // Calcular luminancia media del anillo de 8px alrededor del bbox
  const margin = 8;
  let surroundLum = 0;
  let surroundCount = 0;

  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 30; i++) {
      let x, y;

      if (side === 0) {
        x = bbox.x + Math.random() * bbox.w;
        y = bbox.y - margin;
      } else if (side === 1) {
        x = bbox.x + Math.random() * bbox.w;
        y = bbox.y + bbox.h + margin;
      } else if (side === 2) {
        x = bbox.x - margin;
        y = bbox.y + Math.random() * bbox.h;
      } else {
        x = bbox.x + bbox.w + margin;
        y = bbox.y + Math.random() * bbox.h;
      }

      x = Math.floor(x);
      y = Math.floor(y);

      if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight) continue;

      const idx = (y * imgWidth + x) * 4;
      surroundLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      surroundCount++;
    }
  }

  if (surroundCount === 0) return 0;
  surroundLum /= surroundCount;

  // El contraste es la diferencia relativa entre el cluster y su entorno
  const diff = Math.abs(clusterLum - surroundLum);

  // Normalizar: diff de 30+ es excelente, 15 es ok, <10 es débil
  if (diff > 30) return 1.0;
  if (diff > 15) return 0.7;
  if (diff > 8) return 0.4;
  return 0.1;
}

/* --- Helpers --- */

function clusterBoundingBox(cluster) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of cluster) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
