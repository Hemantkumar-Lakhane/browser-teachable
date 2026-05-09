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
    const pct = (probs[i]*100).toFixed(1);
    const pe  = document.getElementById(`pct-${cls.id}`);
    const be  = document.getElementById(`bar-${cls.id}`);
    if (pe) pe.textContent = pct + '%';
    if (be) be.style.width  = pct + '%';
  });
  const maxI   = Array.from(probs).indexOf(Math.max(...probs));
  const winner = store.classes[maxI];
  if (winner && predWinner) {
    predWinner.style.display    = 'block';
    predWinner.textContent      = `🏆 ${winner.name}  (${(probs[maxI]*100).toFixed(1)}%)`;
    predWinner.style.background = winner.pal.bg;
    predWinner.style.color      = winner.pal.text;
    predWinner.style.border     = `1.5px solid ${winner.pal.border}`;
  }
  if (currentEmbData) updateWhyBox(probs, currentEmbData, maxI);
}

export function updateWhyBox(probs, embData, winnerIdx) {
  const box = document.getElementById('whyBox');
  if (!box) return;
  if (!store.classMeans.length || !store.classMeans[winnerIdx]) { box.textContent = ''; return; }

  const winner     = store.classes[winnerIdx];
  const confidence = probs[winnerIdx] * 100;

  const sims = store.classMeans.map((m, i) => m ? cosineSim(embData, m) : 0);
  const winSim = (sims[winnerIdx] * 100).toFixed(0);

  const sorted = Array.from(probs).map((p,i) => ({p,i})).sort((a,b) => b.p - a.p);
  const second = sorted[1];

  let msg = '';
  if (confidence > 90) {
    msg = `✅ Very confident — your input is <b>${winSim}% similar</b> to the "${winner.name}" training samples.`;
  } else if (confidence > 65) {
    const secondName = store.classes[second.i]?.name || '';
    msg = `🟡 Moderately confident — leaning toward "${winner.name}" but ${(second.p*100).toFixed(0)}% chance it's "${secondName}". Try moving closer or changing the angle.`;
  } else {
    msg = `⚠️ Uncertain — the input doesn't clearly match either class. The model sees it as <b>between clusters</b>. Add more varied training samples.`;
  }
  box.innerHTML = msg;
}

// ── Image & Live Predictions ─────────────────────────────────────

export async function predictImage(previewEl) {
  if (!store.modelTrained) return setStatus('Train the model first.', 'error');
  if (!previewEl.src || !previewEl.naturalWidth) return setStatus('Upload an image first.', 'error');
  const emb  = extractEmbedding(previewEl);
  const pred = store.classifier.predict(emb);
  const p    = await pred.data();
  emb.dispose(); pred.dispose();
  showPrediction(p);
  
  // XAI logic
  const xaiToggle = document.getElementById('xaiToggle');
  const overlay = document.getElementById('previewOverlay');
  if (xaiToggle && xaiToggle.checked) {
    const maxI = Array.from(p).indexOf(Math.max(...p));
    setStatus('🧠 Generating XAI Explainability...', 'ready');
    const xaiResult = await window.ClaimLensXAI.generateOcclusionMap({
      source: previewEl,
      mobilenetModel: store.mobilenetModel,
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
    const whyBox = document.getElementById('whyBox');
    if (whyBox) whyBox.innerHTML += `<br><br><b>XAI Analysis:</b> ${xaiResult.summaryText}`;
    setStatus('✅ Prediction complete.', 'ready');
  } else if (overlay) {
    overlay.style.display = 'none';
  }
}

export async function performLivePredictionStep(webcamEl) {
  if (!webcamEl.videoWidth) return;

  const emb  = tf.tidy(() => store.mobilenetModel.infer(webcamEl, true));   
  const pred = tf.tidy(() => store.classifier.predict(emb));
  const [p, embData] = await Promise.all([pred.data(), emb.data()]);
  emb.dispose(); pred.dispose();

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
    snap.width = webcamEl.videoWidth; snap.height = webcamEl.videoHeight;
    snap.getContext('2d').drawImage(webcamEl, 0, 0);

    const xaiResult = await window.ClaimLensXAI.generateOcclusionMap({
      source: snap,
      mobilenetModel: store.mobilenetModel,
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
