// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';

// ── Replay Initializations ─────────────────────────────────────────

export function initReplayCard() {
  const replayCard = document.getElementById('replay-card');
  const epochSlider = document.getElementById('epochSlider');
  const epochEndLabel = document.getElementById('epochEndLabel');
  const replayUseUpload = document.getElementById('replayUseUpload');
  const replaySnap = document.getElementById('replaySnap');
  const replayInsight = document.getElementById('replayInsight');
  const preview = document.getElementById('preview');

  if (!store.epochSnapshots.length || !replayCard) return;
  replayCard.style.display = 'block';

  epochSlider.max   = store.epochSnapshots.length;
  epochSlider.value = 1;
  epochEndLabel.textContent = `/ ${store.epochSnapshots.length}`;

  replayUseUpload.disabled = !(preview && preview.src && preview.naturalWidth > 0);
  replaySnap.disabled      = !store.webcamReady;

  renderReplayBars();
  replayInsight.textContent = 'Select a test image above to start the replay.';
}

export function renderReplayBars() {
  const replayBars = document.getElementById('replayBars');
  if (!replayBars) return;
  replayBars.innerHTML = '';
  store.classes.forEach(cls => {
    const d = document.createElement('div');
    d.className = 'rbar-row';
    d.innerHTML = `
      <div class="rbar-hdr">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${cls.pal.color};display:inline-block;"></span>
          ${cls.name}
        </span>
        <span id="rpct-${cls.id}" style="font-family:monospace;font-size:0.78rem;">—</span>
      </div>
      <div class="rbar-track">
        <div class="rbar-fill" id="rbar-${cls.id}" style="background:${cls.pal.color};"></div>
      </div>`;
    replayBars.appendChild(d);
  });
}

// ── Scrubbing & Processing Logic ─────────────────────────────────

export async function setReplaySource(src, label) {
  if (!store.mobilenetModel) return;
  const t = tf.tidy(() => store.mobilenetModel.infer(src, true));
  store.replayTestEmb = await t.data();   
  t.dispose();

  const replayThumb = document.getElementById('replayThumb');
  const replaySourceInfo = document.getElementById('replaySourceInfo');
  const epochSlider = document.getElementById('epochSlider');
  const replayPlayBtn = document.getElementById('replayPlayBtn');
  const replayResetBtn = document.getElementById('replayResetBtn');

  if (replayThumb) replayThumb.style.display = 'block';
  if (replaySourceInfo) replaySourceInfo.innerHTML = `Test image: <b>${label}</b>. Drag the slider to scrub through epochs.`;

  epochSlider.disabled  = false;
  replayPlayBtn.disabled = false;
  replayResetBtn.disabled = false;

  epochSlider.value = 1;
  await scrubToEpoch(1);
}

export async function scrubToEpoch(epochNum) {
  if (!store.replayTestEmb || !store.epochSnapshots.length) return;

  const snapIdx = Math.min(epochNum - 1, store.epochSnapshots.length - 1);
  const snap    = store.epochSnapshots[snapIdx];
  if (!snap) return;

  const tensors = snap.weights.map(w => tf.tensor(w.data, w.shape));
  store.classifier.setWeights(tensors);
  tensors.forEach(t => t.dispose());

  const embTensor  = tf.tensor2d([Array.from(store.replayTestEmb)], [1, 1024]);
  const predTensor = store.classifier.predict(embTensor);
  const probs      = await predTensor.data();
  embTensor.dispose(); predTensor.dispose();

  const epochLabel = document.getElementById('epochLabel');
  const epochSlider = document.getElementById('epochSlider');
  const replayInsight = document.getElementById('replayInsight');

  if (epochLabel) epochLabel.textContent = `Epoch ${snap.epoch}`;
  const pct = ((snap.epoch / store.epochSnapshots.length) * 100).toFixed(0);
  if (epochSlider) epochSlider.style.setProperty('--pct', pct + '%');

  store.classes.forEach((cls, i) => {
    const p = (probs[i] * 100).toFixed(1);
    const pe = document.getElementById(`rpct-${cls.id}`);
    const be = document.getElementById(`rbar-${cls.id}`);
    if (pe) pe.textContent = p + '%';
    if (be) be.style.width  = p + '%';
  });

  const maxI      = Array.from(probs).indexOf(Math.max(...probs));
  const winner    = store.classes[maxI];
  const conf      = (probs[maxI] * 100).toFixed(1);
  const isEarly   = snap.epoch <= 5;
  const isMiddle  = snap.epoch <= 15;
  const accPct    = (snap.acc * 100).toFixed(1);
  const lossFmt   = snap.loss.toFixed(4);

  let insight = '';
  if (isEarly) {
    insight = `⚡ <b>Epoch ${snap.epoch} — Early training.</b> Loss is ${lossFmt}, accuracy ${accPct}%. Weights are still near random — predictions are mostly guesses.`;
  } else if (isMiddle) {
    insight = `📈 <b>Epoch ${snap.epoch} — Learning.</b> Loss dropping to ${lossFmt}, accuracy ${accPct}%. The model is starting to separate the classes.`;
  } else {
    const converged = snap.acc > 0.9;
    insight = converged
      ? `✅ <b>Epoch ${snap.epoch} — Converged.</b> Loss ${lossFmt}, accuracy ${accPct}%. The model confidently predicts <b>${winner?.name}</b> at ${conf}%.`
      : `🔄 <b>Epoch ${snap.epoch} — Still learning.</b> Loss ${lossFmt}, accuracy ${accPct}%. Not fully converged yet — more samples may help.`;
  }
  if (replayInsight) replayInsight.innerHTML = insight;
}

// ── Auto-Play Controls ───────────────────────────────────────────

export function stopReplayAuto() {
  if (store.replayInterval) { clearInterval(store.replayInterval); store.replayInterval = null; }
  const replayPlayBtn = document.getElementById('replayPlayBtn');
  const replayStopBtn = document.getElementById('replayStopBtn');
  if (replayPlayBtn) replayPlayBtn.disabled = !store.replayTestEmb;
  if (replayStopBtn) replayStopBtn.disabled = true;
}

export function restoreFinalWeights() {
  if (!store.epochSnapshots.length) return;
  const last    = store.epochSnapshots[store.epochSnapshots.length - 1];
  const tensors = last.weights.map(w => tf.tensor(w.data, w.shape));
  store.classifier.setWeights(tensors);
  tensors.forEach(t => t.dispose());
}

export function syncReplayButtons() {
  const replayUseUpload = document.getElementById('replayUseUpload');
  const replaySnap = document.getElementById('replaySnap');
  const preview = document.getElementById('preview');
  
  if (replayUseUpload)
    replayUseUpload.disabled = !(preview && preview.src && preview.naturalWidth > 0);
  if (replaySnap)
    replaySnap.disabled = !store.webcamReady;
}
