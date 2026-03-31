/* ==========================================================================
   detector.js — Auto-detección de marca de agua Gemini
   Usa análisis de componentes conectados + verificación de forma.
   Interfaz pluggable: {detected, rect, confidence}
   ========================================================================== */

/**
 * Detecta la marca de agua de Gemini (estrella ✦) en una imagen.
 *
 * Algoritmo:
 * 1. Escanea la esquina inferior-derecha (12% de la imagen)
 * 2. Encuentra píxeles de alta luminancia como candidatos
 * 3. Agrupa candidatos en clusters (componentes conectados)
 * 4. Filtra clusters por tamaño, aspect ratio (~1:1) y aislamiento
 * 5. Retorna el cluster más probable como watermark
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

  // Paso 1: Encontrar píxeles candidatos por luminancia
  const candidates = findBrightPixels(data, width, searchX, searchY, searchW, searchH);

  if (candidates.length < 15) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 2: Agrupar en clusters por componentes conectados
  const clusters = findClusters(candidates, 3); // distancia máx 3px entre vecinos

  if (clusters.length === 0) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 3: Evaluar cada cluster
  let bestCluster = null;
  let bestScore = 0;

  for (const cluster of clusters) {
    const score = evaluateCluster(cluster, data, width, height, searchX, searchY, searchW, searchH);
    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  if (!bestCluster || bestScore < 0.2) {
    return { detected: false, rect: null, confidence: 0 };
  }

  // Paso 4: Calcular bounding box con margen
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

/* --- Paso 1: Píxeles brillantes --- */

function findBrightPixels(data, imgWidth, sx, sy, sw, sh) {
  const LUM_THRESHOLD = 200;
  const ALPHA_THRESHOLD = 80;
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

      if (lum > LUM_THRESHOLD && a > ALPHA_THRESHOLD) {
        candidates.push({ x, y, lum });
      }
    }
  }

  return candidates;
}

/* --- Paso 2: Componentes conectados --- */

function findClusters(pixels, maxDist) {
  const visited = new Set();
  const clusters = [];
  const maxDistSq = maxDist * maxDist;

  // Index espacial simple para acelerar vecinos
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

    if (cluster.length >= 15) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/* --- Paso 3: Evaluar cluster --- */

function evaluateCluster(cluster, data, imgWidth, imgHeight, sx, sy, sw, sh) {
  const bbox = clusterBoundingBox(cluster);
  let score = 0;

  // Factor 1: Tamaño razonable (entre 10px y 80px)
  const size = Math.max(bbox.w, bbox.h);
  if (size >= 10 && size <= 80) {
    score += 0.25;
  } else if (size > 80 && size <= 150) {
    score += 0.1;
  } else {
    return 0; // demasiado grande o pequeño
  }

  // Factor 2: Aspect ratio cercano a 1:1 (la estrella es cuadrada)
  const aspect = bbox.w / (bbox.h || 1);
  if (aspect > 0.6 && aspect < 1.6) {
    score += 0.25;
  } else {
    score += 0.05;
  }

  // Factor 3: Densidad del cluster (estrella es ~30-60% del bbox)
  const area = bbox.w * bbox.h;
  const density = cluster.length / (area || 1);
  if (density > 0.15 && density < 0.75) {
    score += 0.2;
  } else {
    score += 0.05;
  }

  // Factor 4: Aislamiento — los píxeles alrededor deben ser más oscuros
  const isolation = measureIsolation(bbox, data, imgWidth, imgHeight);
  score += isolation * 0.3;

  return score;
}

function measureIsolation(bbox, data, imgWidth, imgHeight) {
  const margin = 6;
  let darkCount = 0;
  let totalSampled = 0;

  // Muestrear píxeles en un anillo de 'margin' px alrededor del bbox
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 20; i++) {
      let x, y;

      if (side === 0) { // arriba
        x = bbox.x + Math.random() * bbox.w;
        y = bbox.y - margin;
      } else if (side === 1) { // abajo
        x = bbox.x + Math.random() * bbox.w;
        y = bbox.y + bbox.h + margin;
      } else if (side === 2) { // izquierda
        x = bbox.x - margin;
        y = bbox.y + Math.random() * bbox.h;
      } else { // derecha
        x = bbox.x + bbox.w + margin;
        y = bbox.y + Math.random() * bbox.h;
      }

      x = Math.floor(x);
      y = Math.floor(y);

      if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight) continue;

      const idx = (y * imgWidth + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      totalSampled++;
      if (lum < 160) darkCount++;
    }
  }

  return totalSampled > 0 ? darkCount / totalSampled : 0;
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
