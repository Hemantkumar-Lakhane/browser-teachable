// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store, EPOCHS } from '../store.js';
import { setStatus, setPipe } from '../utils.js';
import { checkSampleVariance, computeClassMeans } from './dataset.js';
import { resetTrainingCharts, pushTrainingCharts } from '../visuals/charts.js';
import { drawArchDiagram } from '../visuals/architecture.js';
import { updateDistancePanel } from '../visuals/distance.js';
import { initReplayCard } from '../ui/replay.js';
import { publishActiveModelToBrowser } from './persistence.js';
import { evaluateModel } from './evaluation.js';

// ── Model Architecture Setup ─────────────────────────────────────

export function buildClassifier(n) {
  if (store.classifier) store.classifier.dispose();
  store.classifier = tf.sequential();
  store.classifier.add(tf.layers.dense({ inputShape:[1024], units:128, activation:'relu' }));
  store.classifier.add(tf.layers.dropout({ rate:0.3 }));
  store.classifier.add(tf.layers.dense({ units:64, activation:'relu' }));
  store.classifier.add(tf.layers.dense({ units:n, activation:'softmax' }));
  store.classifier.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  store.modelTrained = false;
}

// ── Training Orchestration ───────────────────────────────────────

export async function trainModel() {
  if (store.classes.length < 2) return setStatus('Need at least 2 classes.', 'error');
  if (store.classes.some(c => c.embeddings.length < 2))
    return setStatus('Each class needs at least 2 samples.', 'error');

  setPipe('train');
  const trainBtn = document.getElementById('trainBtn');
  const predictImgBtn = document.getElementById('predictImgBtn');
  const startLiveBtn = document.getElementById('startLiveBtn');
  const progressBar = document.getElementById('progressBar');
  const trainLog = document.getElementById('trainLog');

  trainBtn.disabled = predictImgBtn.disabled = startLiveBtn.disabled = true;
  progressBar.style.width = '0%';
  
  await checkSampleVariance();

  resetTrainingCharts();
  buildClassifier(store.classes.length);
  setStatus('🏋️ Training… watch the charts update live!');

  const xs = tf.concat(store.classes.flatMap(c => c.embeddings));
  const ys = tf.tensor2d(
    store.classes.flatMap((c, ci) =>
      c.embeddings.map(() => { const a = Array(store.classes.length).fill(0); a[ci]=1; return a; })
    )
  );

  store.epochSnapshots = [];

  try {
    await store.classifier.fit(xs, ys, {
      epochs: EPOCHS,
      batchSize: Math.min(16, xs.shape[0]),
      shuffle: true,
      validationSplit: 0.1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const pct = ((epoch+1)/EPOCHS*100).toFixed(0);
          const acc = logs.acc ?? logs.accuracy ?? 0;
          progressBar.style.width = pct + '%';
          trainLog.textContent = `Epoch ${epoch+1}/${EPOCHS} — Loss: ${logs.loss.toFixed(4)} | Acc: ${(acc*100).toFixed(1)}%`;
          pushTrainingCharts(epoch+1, logs.loss, acc);

          const snap = {
            epoch: epoch + 1,
            loss:  logs.loss,
            acc:   acc,
            weights: store.classifier.getWeights().map(w => {
              const arr = w.dataSync();           
              const copy = new Float32Array(arr); 
              return { data: copy, shape: w.shape };
            })
          };
          store.epochSnapshots.push(snap);
        }
      }
    });

    store.modelTrained = true;
    await computeClassMeans();   
    await publishActiveModelToBrowser();
    setPipe('predict');
    setStatus('🎉 Training complete! Predict an image or start live prediction.', 'ready');
    trainLog.textContent   = '✅ Model trained successfully!';
    trainBtn.disabled      = false;
    predictImgBtn.disabled = false;
    startLiveBtn.disabled  = false;
    document.getElementById('exportBtn').disabled = false;
    drawArchDiagram();
    updateDistancePanel();
    initReplayCard();
    await evaluateModel();
  } catch(e) {
    setStatus('❌ Training failed: ' + e.message, 'error');
    trainBtn.disabled = false;
  } finally {
    xs.dispose(); ys.dispose();
  }
}
