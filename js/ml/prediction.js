// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { setStatus } from '../utils.js';
import { extractEmbedding } from './dataset.js';
import { cosineSim } from '../utils.js';
import { pushTimeline } from '../visuals/charts.js';
import { runInspector } from '../visuals/inspector.js';

// ── UI Updates ───────────────────────────────────────────────────

export function showPrediction(probs, currentEmbData) {
  const predWinner = document.getElementById('predWinner');
  store.classes.forEach((cls, i) => {
    const pct = (probs[i] * 100).toFixed(1);
    const pe = document.getElementById(`pct-${cls.id}`);
    const be = document.getElementById(`bar-${cls.id}`);
    if (pe) pe.textContent = pct + '%';
    if (be) be.style.width = pct + '%';
  });
  const maxI = Array.from(probs).indexOf(Math.max(...probs));
  const winner = store.classes[maxI];
  if (winner && predWinner) {
    predWinner.style.display = 'block';
    predWinner.textContent = `🏆 ${winner.name}  (${(probs[maxI] * 100).toFixed(1)}%)`;
    predWinner.style.background = winner.pal.bg;
    predWinner.style.color = winner.pal.text;
    predWinner.style.border = `1.5px solid ${winner.pal.border}`;
  }
  if (currentEmbData) updateWhyBox(probs, currentEmbData, maxI);
}
export function updateWhyBox(probs, embData, winnerIdx) {
  const box = document.getElementById('whyBox');
  if (!box) return;
  if (!store.classMeans.length || !store.classMeans[winnerIdx]) {
    box.textContent = '';
    return;
  }
  const winner = store.classes[winnerIdx];
  const confidence = probs[winnerIdx] * 100;
  const sims = store.classMeans.map((m, i) => m ? cosineSim(embData, m) : 0);
  const winSim = (sims[winnerIdx] * 100).toFixed(0);
  const sorted = Array.from(probs).map((p, i) => ({
    p,
    i
  })).sort((a, b) => b.p - a.p);
  const second = sorted[1];
  let msg = '';
  if (confidence > 90) {
    msg = `✅ Very confident — your input is <b>${winSim}% similar</b> to the "${winner.name}" training samples.`;
  } else if (confidence > 65) {
    const secondName = store.classes[second.i]?.name || '';
    msg = `🟡 Moderately confident — leaning toward "${winner.name}" but ${(second.p * 100).toFixed(0)}% chance it's "${secondName}". Try moving closer or changing the angle.`;
  } else {
    msg = `⚠️ Uncertain — the input doesn't clearly match either class. The model sees it as <b>between clusters</b>. Add more varied training samples.`;
  }
  box.setHTMLUnsafe(msg);
}

// ── Image & Live Predictions ─────────────────────────────────────

export async function predictImage(previewEl, options = {}) {
  if (!store.modelTrained) return setStatus('Train the model first.', 'error');
  if (!previewEl || !previewEl.src || !previewEl.naturalWidth) return setStatus('Upload an image first.', 'error');
  const emb = extractEmbedding(previewEl);
  const pred = store.classifier.predict(emb);
  const [p, embData] = await Promise.all([pred.data(), emb.data()]);
  emb.dispose();
  pred.dispose();
  showPrediction(p, embData);
  const whyBox = document.getElementById('whyBox');
  if (whyBox) whyBox.style.display = 'block';

  // XAI logic
  const xaiToggle = document.getElementById('xaiToggle');
  const overlay = options.overlayEl || document.getElementById('previewOverlay');
  if (xaiToggle && xaiToggle.checked) {
    const maxI = Array.from(p).indexOf(Math.max(...p));
    setStatus('🧠 Generating XAI Explainability...', 'ready');
    const xaiResult = await window.ClaimLensXAI.generateOcclusionMap({
      source: previewEl,
      mobilenetModel: store.backbone || store.mobilenetModel,
      classifierModel: store.classifier,
      targetClassIndex: maxI,
      patchSize: 32,
      stride: 32,
      inputSize: 224,
      occlusionColor: 'rgba(128, 128, 128, 0.95)'
    });
    if (overlay) {
      overlay.src = xaiResult.overlayDataURL;
      overlay.style.display = 'block';
    }
    if (whyBox) whyBox.insertAdjacentHTML("beforeend", `<br><br><b>XAI Analysis:</b> ${xaiResult.summaryText}`);
    setStatus('✅ Prediction complete.', 'ready');
  } else if (overlay) {
    overlay.style.display = 'none';
    setStatus('✅ Prediction complete.', 'ready');
  }
}
export async function performLivePredictionStep(webcamEl) {
  if (!webcamEl.videoWidth) return;
  const emb = extractEmbedding(webcamEl);
  if (!emb) return;
  const pred = tf.tidy(() => store.classifier.predict(emb));
  const [p, embData] = await Promise.all([pred.data(), emb.data()]);
  emb.dispose();
  pred.dispose();
  showPrediction(p, embData);
  pushTimeline(p);
  await runInspector(p, webcamEl);

  // XAI logic
  const xaiToggle = document.getElementById('xaiToggle');
  const overlay = document.getElementById('webcamOverlay');
  if (xaiToggle && xaiToggle.checked) {
    const maxI = Array.from(p).indexOf(Math.max(...p));

    // Create an offscreen canvas snapshot of the webcam
    const snap = document.createElement('canvas');
    snap.width = webcamEl.videoWidth;
    snap.height = webcamEl.videoHeight;
    snap.getContext('2d').drawImage(webcamEl, 0, 0);
    const xaiResult = await window.ClaimLensXAI.generateOcclusionMap({
      source: snap,
      mobilenetModel: store.backbone || store.mobilenetModel,
      classifierModel: store.classifier,
      targetClassIndex: maxI,
      patchSize: 32,
      stride: 32,
      inputSize: 224,
      yieldEvery: 4,
      occlusionColor: 'rgba(128, 128, 128, 0.95)'
    });
    if (overlay) {
      overlay.src = xaiResult.overlayDataURL;
      overlay.style.display = 'block';
    }
  } else if (overlay) {
    overlay.style.display = 'none';
  }
}

// ── Batch Test on Held-Out Folder ────────────────────────────────

export async function runBatchTest(files, progressCb, completeCb) {
  if (!store.modelTrained) return setStatus('Train the model first.', 'error');
  if (!files || files.length === 0) return setStatus('No files selected.', 'error');
  const numClasses = store.classes.length;
  const matrix = Array(numClasses).fill(0).map(() => Array(numClasses).fill(0));
  let totalProcessed = 0;
  let totalSkipped = 0;
  const classMap = {};
  store.classes.forEach((cls, i) => {
    classMap[cls.name] = i;
  });
  const offscreenImg = new Image();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith('image/')) {
      totalSkipped++;
      continue;
    }
    const parts = file.webkitRelativePath.split('/');
    if (parts.length < 2) {
      totalSkipped++;
      continue;
    }
    const trueLabel = parts[parts.length - 2];
    if (classMap[trueLabel] === undefined) {
      console.warn(`Skipping file ${file.name} — folder "${trueLabel}" does not match any trained class.`);
      totalSkipped++;
      continue;
    }
    const actualIdx = classMap[trueLabel];
    await new Promise(resolve => {
      offscreenImg.onload = resolve;
      offscreenImg.onerror = () => {
        totalSkipped++;
        resolve();
      };
      offscreenImg.src = URL.createObjectURL(file);
    });
    if (!offscreenImg.naturalWidth) continue;
    const backbone = store.backbone || store.mobilenetModel;
    if (!backbone) continue;
    const emb = tf.tidy(() => backbone.infer(offscreenImg));
    if (!emb) continue;
    const pred = store.classifier.predict(emb);
    const p = await pred.data();
    const predictedIdx = Array.from(p).indexOf(Math.max(...p));
    matrix[actualIdx][predictedIdx]++;
    emb.dispose();
    pred.dispose();
    URL.revokeObjectURL(offscreenImg.src);
    totalProcessed++;
    if (progressCb) {
      progressCb(totalProcessed, files.length - totalSkipped);
    }
  }
  const metrics = [];
  let totalCorrect = 0;
  let totalSamples = 0;
  for (let i = 0; i < numClasses; i++) {
    let tp = matrix[i][i];
    totalCorrect += tp;
    let fp = 0;
    let fn = 0;
    for (let j = 0; j < numClasses; j++) {
      if (i !== j) {
        fp += matrix[j][i];
        fn += matrix[i][j];
      }
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : 2 * (precision * recall) / (precision + recall);
    const support = tp + fn;
    totalSamples += support;
    metrics.push({
      name: store.classes[i].name,
      precision,
      recall,
      f1,
      support
    });
  }
  let sumPrecision = 0,
    sumRecall = 0,
    sumF1 = 0;
  metrics.forEach(m => {
    sumPrecision += m.precision;
    sumRecall += m.recall;
    sumF1 += m.f1;
  });
  const testResults = {
    evalAccuracy: totalSamples > 0 ? totalCorrect / totalSamples : 0,
    macroPrecision: sumPrecision / numClasses,
    macroRecall: sumRecall / numClasses,
    macroF1: sumF1 / numClasses,
    matrix,
    metrics,
    totalProcessed,
    totalSkipped,
    totalSamples
  };
  store.testResults = testResults;
  setStatus(`Batch test complete: ${totalProcessed} images.`, 'ready');
  if (completeCb) {
    completeCb(testResults);
  }
}
export function generateTestReport() {
  if (!store.testResults) return;
  const res = store.testResults;
  const numClasses = store.classes.length;

  // Build confusion matrix HTML
  let matrixHtml = '<table class="cm-table" style="width:100%; border-collapse:collapse; font-size:14px; text-align:center;">';
  matrixHtml += '<tr><th style="padding:10px; border:1px solid #e2e8f0; background:#f1f5f9;">Actual \\ Pred</th>';
  for (let i = 0; i < numClasses; i++) {
    matrixHtml += `<th style="padding:10px; border:1px solid #e2e8f0; background:#f1f5f9;" title="${store.classes[i].name}">${store.classes[i].name}</th>`;
  }
  matrixHtml += '</tr>';
  let maxVal = 0;
  res.matrix.forEach(row => row.forEach(val => {
    if (val > maxVal) maxVal = val;
  }));
  for (let i = 0; i < numClasses; i++) {
    matrixHtml += `<tr><th style="padding:10px; border:1px solid #e2e8f0; background:#f1f5f9;" title="${store.classes[i].name}">${store.classes[i].name}</th>`;
    for (let j = 0; j < numClasses; j++) {
      const val = res.matrix[i][j];
      const isCorrect = i === j;
      const intensity = maxVal === 0 ? 0 : val / maxVal;
      const bg = isCorrect ? `rgba(16, 185, 129, ${intensity})` : `rgba(239, 68, 68, ${intensity})`;
      matrixHtml += `<td style="padding:10px; border:1px solid #e2e8f0; background:${bg};">${val}</td>`;
    }
    matrixHtml += '</tr>';
  }
  matrixHtml += '</table>';

  // Build metrics table HTML
  let metricsHtml = '';
  res.metrics.forEach(m => {
    metricsHtml += `
      <tr>
        <td style="padding:10px; border:1px solid #e2e8f0;">${m.name}</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${(m.precision * 100).toFixed(1)}%</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${(m.recall * 100).toFixed(1)}%</td>
        <td style="padding:10px; border:1px solid #e2e8f0;">${(m.f1 * 100).toFixed(1)}%</td>
      </tr>
    `;
  });
  const reportHtml = `
    <h1 style="color:#0f172a; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">ModelForge AI — Held-Out Test Set Evaluation</h1>
    <p style="color:#64748b; font-size:14px; margin-top:0;">Generated on: ${new Date().toLocaleString()}</p>
    
    <div style="margin-top:20px; display:flex; gap:20px; flex-wrap:wrap;">
      <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
        <h3 style="margin-top:0; color:#334155; font-size:16px;">Test Set Statistics</h3>
        <ul style="padding-left:20px; font-size:14px; margin-bottom:0;">
          <li><b>Total Processed:</b> ${res.totalProcessed}</li>
          <li><b>Total Skipped:</b> ${res.totalSkipped}</li>
          <li><b>Number of Classes:</b> ${numClasses}</li>
        </ul>
      </div>
      <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
        <h3 style="margin-top:0; color:#334155; font-size:16px;">Test Performance</h3>
        <ul style="padding-left:20px; font-size:14px; margin-bottom:0;">
          <li><b>Overall Accuracy:</b> ${(res.evalAccuracy * 100).toFixed(1)}%</li>
          <li><b>Macro Precision:</b> ${(res.macroPrecision * 100).toFixed(1)}%</li>
          <li><b>Macro Recall:</b> ${(res.macroRecall * 100).toFixed(1)}%</li>
          <li><b>Macro F1-Score:</b> ${(res.macroF1 * 100).toFixed(1)}%</li>
        </ul>
      </div>
    </div>

    <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">1. Confusion Matrix</h2>
    <div style="overflow-x:hidden; margin-top:10px;">
      ${matrixHtml}
    </div>
    
    <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">2. Classification Metrics</h2>
    <div style="margin-top:10px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
            <th style="padding:10px; border:1px solid #e2e8f0;">Class</th>
            <th style="padding:10px; border:1px solid #e2e8f0;">Precision</th>
            <th style="padding:10px; border:1px solid #e2e8f0;">Recall</th>
            <th style="padding:10px; border:1px solid #e2e8f0;">F1-Score</th>
          </tr>
        </thead>
        <tbody>
          ${metricsHtml}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:40px; text-align:center; color:#94a3b8; font-size:12px;">
      <i>This report is auto-generated strictly in-browser via ModelForge AI. No data was transmitted to external servers.</i>
    </div>
  `;

  // Create a temporary hidden div for printing
  const printArea = document.getElementById('print-area');
  if (printArea) {
    printArea.setHTMLUnsafe(reportHtml);
    window.print();
  } else {
    const div = document.createElement('div');
    div.id = 'temp-print-area';
    div.setHTMLUnsafe(reportHtml);
    document.body.appendChild(div);
    window.print();
    document.body.removeChild(div);
  }
}