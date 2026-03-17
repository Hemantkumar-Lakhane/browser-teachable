// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { jetColor } from '../utils.js';
import { runInternals } from './internals.js';

let offCanvas, offCtx, gradCanvas, gradCtx;

// ── State Handlers ───────────────────────────────────────────────

function initCanvases() {
  if (!offCanvas) {
    offCanvas = document.createElement('canvas');
    offCanvas.width = offCanvas.height = 224;
    offCtx = offCanvas.getContext('2d');
    
    gradCanvas = document.createElement('canvas');
    gradCtx = gradCanvas.getContext('2d');
  }
}

export function inspectorActivate() {
  ['ins-p1','ins-p2','ins-p3','ins-p4','ins-p5']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    });
  const sub = document.getElementById('inspectorSub');
  if (sub) sub.textContent = '🔴 Live — watching every step of the pipeline in real time.';
}

export function inspectorDeactivate() {
  ['ins-p1','ins-p2','ins-p3','ins-p4','ins-p5']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
  const sub = document.getElementById('inspectorSub');
  if (sub) sub.textContent = 'Start Live Prediction to see every preprocessing step visualised in real time.';
}

// ── Core Orchestrator ────────────────────────────────────────────

export async function runInspector(softmaxProbs, webcamEl) {
  if (!webcamEl.videoWidth || !webcamEl.videoHeight) return;
  initCanvases();

  const insRawCanvas = document.getElementById('ins-raw-canvas');
  const insResizeCanvas = document.getElementById('ins-resize-canvas');
  const insNormCanvas = document.getElementById('ins-norm-canvas');
  const insEmbedCanvas = document.getElementById('ins-embed-canvas');
  const insSoftmaxCanvas = document.getElementById('ins-softmax-canvas');

  if (!insRawCanvas || !insResizeCanvas || !insNormCanvas || !insEmbedCanvas || !insSoftmaxCanvas) return;

  const insRawCtx = insRawCanvas.getContext('2d');
  const insResizeCtx = insResizeCanvas.getContext('2d');
  
  insRawCtx.drawImage(webcamEl, 0, 0, insRawCanvas.width, insRawCanvas.height);

  let normData, embData, spatData, spatShape;

  const resized255Data = tf.tidy(() => {
    const raw = tf.browser.fromPixels(webcamEl);
    const resized = tf.image.resizeBilinear(raw, [224, 224]);
    return resized.clipByValue(0, 255).cast('int32');
  });
  await tf.browser.toPixels(resized255Data, offCanvas);
  resized255Data.dispose();
  insResizeCtx.drawImage(offCanvas, 0, 0, insResizeCanvas.width, insResizeCanvas.height);

  const normBatch = tf.tidy(() => {
    const raw = tf.browser.fromPixels(webcamEl);
    const resized = tf.image.resizeBilinear(raw, [224, 224]);
    return resized.expandDims(0).div(127.5).sub(1.0);  
  });

  try {
    normData = await tf.tidy(() => normBatch.squeeze([0])).data();
    drawNormPanel(normData, insNormCanvas);

    const embTensor = tf.tidy(() => store.mobilenetModel.infer(normBatch, true));
    embData = await embTensor.data();
    embTensor.dispose();
    drawEmbeddingPanel(embData, insEmbedCanvas);

    if (store.spatialModel) {
      const spatTensor = tf.tidy(() => store.spatialModel.predict(normBatch));
      spatData = await spatTensor.data();
      spatShape = spatTensor.shape;
      spatTensor.dispose();
      drawGradCAMOverlay(spatData, spatShape[1], spatShape[2], spatShape[3], insRawCanvas, insRawCtx);
    }

    if (store.internalsVisible && store.internalModels.length > 0) {
      await runInternals(normBatch);
    }
  } finally {
    if (!normBatch.isDisposed) normBatch.dispose();
  }

  drawSoftmaxPanel(softmaxProbs, insSoftmaxCanvas);
}

// ── Drawing Utilities ────────────────────────────────────────────

function drawNormPanel(normData, canvas) {
  const ctx = canvas.getContext('2d');
  const DISP = canvas.width;   
  const GRID = 28;                    
  const step = Math.floor(224 / GRID);
  const cell = DISP / GRID;

  ctx.clearRect(0, 0, DISP, DISP);

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const srcRow = row * step;
      const srcCol = col * step;
      const idx = (srcRow * 224 + srcCol) * 3;
      const val = (normData[idx] + normData[idx+1] + normData[idx+2]) / 3; 

      let r, g, b;
      if (val < 0) {
        const t = val + 1;   
        r = Math.round(20  + t * 235);
        g = Math.round(60  + t * 195);
        b = Math.round(220 + t * 35);
      } else {
        const t = val;
        r = Math.round(255);
        g = Math.round(255 - t * 200);
        b = Math.round(255 - t * 235);
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * cell, row * cell, cell, cell);
    }
  }
}

function drawEmbeddingPanel(embData, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;    
  const H = canvas.height;   

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f7fafc';
  ctx.fillRect(0, 0, W, H);

  let maxVal = 0;
  for (let i = 0; i < embData.length; i++) {
    if (embData[i] > maxVal) maxVal = embData[i];
  }
  if (maxVal === 0) {
    ctx.fillStyle = '#a0aec0';
    ctx.font = '9px Segoe UI';
    ctx.fillText('No activation', 6, H/2);
    return;
  }

  const n = embData.length;  
  const padB = 4;               

  ctx.beginPath();
  ctx.moveTo(0, H - padB);

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const norm = embData[i] / maxVal;          
    const y = H - padB - norm * (H - padB - 4);
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineTo(W, H - padB);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(102,126,234,0.85)');
  grad.addColorStop(1, 'rgba(102,126,234,0.08)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const norm = embData[i] / maxVal;
    const y = H - padB - norm * (H - padB - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  let maxIdx = 0;
  for (let i = 0; i < n; i++) { if (embData[i] > embData[maxIdx]) maxIdx = i; }

  const peakX = (maxIdx / (n - 1)) * W;
  const peakNorm = embData[maxIdx] / maxVal;
  const peakY = H - padB - peakNorm * (H - padB - 4);

  ctx.beginPath();
  ctx.arc(peakX, peakY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f56565';
  ctx.fill();

  ctx.fillStyle = '#4a5568';
  ctx.font = 'bold 8px Segoe UI';
  const labelX = peakX > W - 60 ? peakX - 58 : peakX + 4;
  ctx.fillText(`peak f${maxIdx} = ${maxVal.toFixed(2)}`, labelX, Math.max(peakY - 3, 10));
}

export function drawSoftmaxPanel(probs, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;    
  const H = canvas.height;   

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f7fafc';
  ctx.fillRect(0, 0, W, H);

  const n = store.classes.length;
  const padV = 8;
  const barH = Math.min(18, (H - padV * (n + 1)) / n);
  const trackW = W - 8;

  store.classes.forEach((cls, i) => {
    const prob = probs[i] || 0;
    const y = padV + i * (barH + padV);

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(4, y, trackW, barH, 3);
    ctx.fill();

    const fillW = prob * trackW;
    if (fillW > 0) {
      ctx.fillStyle = cls.pal.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(4, y, fillW, barH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = prob > 0.5 ? 'white' : '#4a5568';
    ctx.font = `bold ${Math.min(9, barH - 2)}px Segoe UI`;
    ctx.fillText(`${cls.name}  ${(prob*100).toFixed(1)}%`, 8, y + barH * 0.68);
  });
}

function drawGradCAMOverlay(spatData, fH, fW, fC, canvas, ctx) {
  const heatmap = new Float32Array(fH * fW);
  for (let row = 0; row < fH; row++) {
    for (let col = 0; col < fW; col++) {
      let sum = 0;
      const base = (row * fW + col) * fC;
      for (let c = 0; c < fC; c++) sum += Math.max(0, spatData[base + c]); 
      heatmap[row * fW + col] = sum / fC;
    }
  }

  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < heatmap.length; i++) {
    if (heatmap[i] < mn) mn = heatmap[i];
    if (heatmap[i] > mx) mx = heatmap[i];
  }
  const range = mx - mn || 1;
  for (let i = 0; i < heatmap.length; i++) heatmap[i] = (heatmap[i] - mn) / range;

  gradCanvas.width = fW;
  gradCanvas.height = fH;
  const imgData = gradCtx.createImageData(fW, fH);
  for (let i = 0; i < fH * fW; i++) {
    const [r,g,b] = jetColor(heatmap[i]);
    imgData.data[i*4] = r;
    imgData.data[i*4+1] = g;
    imgData.data[i*4+2] = b;
    imgData.data[i*4+3] = Math.round(heatmap[i] * 180 + 20); 
  }
  gradCtx.putImageData(imgData, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.52;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(gradCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const lW = canvas.width;
  const lH = 14;
  const lY = canvas.height - lH;
  
  const lg = ctx.createLinearGradient(0, 0, lW, 0);
  lg.addColorStop(0, '#0000ff');
  lg.addColorStop(0.25,'#00ffff');
  lg.addColorStop(0.5, '#00ff00');
  lg.addColorStop(0.75,'#ffff00');
  lg.addColorStop(1, '#ff0000');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, lY, lW, lH);
  ctx.fillStyle = lg;
  ctx.fillRect(4, lY + 3, lW - 8, lH - 6);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 7px Segoe UI';
  ctx.fillText('low attention', 5, lY + lH - 3);
  ctx.textAlign = 'right';
  ctx.fillText('high attention', lW - 4, lY + lH - 3);
  ctx.textAlign = 'left';
}
