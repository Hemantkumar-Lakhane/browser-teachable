// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { thermalColor } from '../utils.js';

// ── UI States ────────────────────────────────────────────────────

export function toggleInternals() {
  store.internalsVisible = !store.internalsVisible;
  const body = document.getElementById('internals-body');
  const label = document.getElementById('internalsToggleLabel');
  if (body) body.style.display = store.internalsVisible ? 'block' : 'none';
  if (label) label.textContent = store.internalsVisible ? '▲ collapse' : '▼ expand';
}

// ── Rendering Logics ─────────────────────────────────────────────

export function drawHeatmap(canvas, heatmap, fH, fW) {
  const size = canvas.clientWidth || 80;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  let mn = heatmap[0],
    mx = heatmap[0];
  for (let i = 1; i < heatmap.length; i++) {
    if (heatmap[i] < mn) mn = heatmap[i];
    if (heatmap[i] > mx) mx = heatmap[i];
  }
  const range = mx - mn;
  if (range < 1e-7) {
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(160,174,192,0.7)';
    ctx.font = `${Math.round(size * 0.12)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('no signal', size / 2, size / 2);
    return;
  }
  const imgData = ctx.createImageData(size, size);
  const scaleY = fH / size;
  const scaleX = fW / size;
  for (let py = 0; py < size; py++) {
    const srcRow = Math.min(Math.floor(py * scaleY), fH - 1);
    for (let px = 0; px < size; px++) {
      const srcCol = Math.min(Math.floor(px * scaleX), fW - 1);
      const t = (heatmap[srcRow * fW + srcCol] - mn) / range;
      const [r, g, b] = thermalColor(t);
      const idx = (py * size + px) * 4;
      imgData.data[idx] = r;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = b;
      imgData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
export function describeActivation(heatmap) {
  let sum = 0,
    max = 0;
  for (let i = 0; i < heatmap.length; i++) {
    sum += heatmap[i];
    if (heatmap[i] > max) max = heatmap[i];
  }
  const mean = sum / heatmap.length;
  const spread = max > 0 ? mean / max : 0;
  if (spread < 0.2) return 'sparse — a few regions activated strongly';
  if (spread < 0.5) return 'focused — moderate activation across regions';
  return 'diffuse — whole image activating this layer';
}

// ── Extraction Pipeline ──────────────────────────────────────────

let _ran = false;
export async function runInternals(normBatch) {
  const stats = [];
  const isFirst = !_ran;
  _ran = true;
  const intCanvases = [1, 2, 3, 4].map(i => document.getElementById(`int-canvas-${i}`));
  const intBadges = [1, 2, 3, 4].map(i => document.getElementById(`int-badge-${i}`));
  const internalsInsight = document.getElementById('internalsInsight');
  if (isFirst) {
    const testCanvas = intCanvases[0];
    if (testCanvas) {
      const testHeat = new Float32Array(7 * 7);
      for (let i = 0; i < 49; i++) testHeat[i] = i / 48;
      drawHeatmap(testCanvas, testHeat, 7, 7);
    }
  }
  for (let s = 0; s < store.internalModels.length; s++) {
    const {
      model,
      layerName,
      stageIdx
    } = store.internalModels[s];
    const canvas = intCanvases[stageIdx - 1];
    if (!canvas) continue;
    try {
      const featTensor = model.predict(normBatch);
      const [, fH, fW, fC] = featTensor.shape;
      const data = await featTensor.data();
      featTensor.dispose();
      if (intBadges[stageIdx - 1]) {
        intBadges[stageIdx - 1].textContent = `${fC}ch · ${fH}×${fW}`;
      }
      const heatmap = new Float32Array(fH * fW);
      for (let row = 0; row < fH; row++) {
        for (let col = 0; col < fW; col++) {
          let sum = 0;
          const base = (row * fW + col) * fC;
          for (let c = 0; c < fC; c++) sum += Math.abs(data[base + c]);
          heatmap[row * fW + col] = sum / fC;
        }
      }
      drawHeatmap(canvas, heatmap, fH, fW);
      canvas.classList.add('active-int');
      stats.push({
        stageIdx,
        fH,
        fW,
        fC,
        desc: describeActivation(heatmap),
        layerName
      });
    } catch (e) {
      console.error(`[Internals] stage${stageIdx} error:`, e.message);
    }
  }
  if (stats.length > 0 && internalsInsight) {
    const s1 = stats.find(s => s.stageIdx === 1);
    const s4 = stats.find(s => s.stageIdx === 4);
    internalsInsight.setHTMLUnsafe(`🔍 <b>Early (${s1?.layerName || 'conv1'}):</b> ${s1?.desc || '—'}. &nbsp;` + `<b>Deep (${s4?.layerName || 'conv13'}):</b> ${s4?.desc || '—'}. ` + `Resolution shrinks as depth grows — edges → textures → objects.`);
  }
}