import { store } from '../store.js';
import { setStatus, setPipe } from '../utils.js';
import { checkSampleVariance, computeClassMeans } from './dataset.js';
import { resetTrainingCharts, pushTrainingCharts } from '../visuals/charts.js';
import { drawArchDiagram } from '../visuals/architecture.js';
import { updateDistancePanel } from '../visuals/distance.js';
import { initReplayCard } from '../ui/replay.js';
import { publishActiveModelToBrowser } from './persistence.js';
import { evaluateModel } from './evaluation.js';
import { syncTrainingConfigFromUI } from '../ui/training-config.js';

function createOptimizer(type, learningRate) {
  const lr = Math.min(1, Math.max(0.000001, Number(learningRate) || 0.0005));
  if (type === 'sgd') return tf.train.sgd(lr);
  if (type === 'rmsprop') return tf.train.rmsprop(lr);
  return tf.train.adam(lr);
}

export function buildClassifier(n) {
  const config = store.trainingConfig;
  const inputSize = store.embeddingSize || 1024;
  const hiddenUnits = Math.max(8, parseInt(config.hiddenUnits, 10) || 128);
  const dropoutRate = Math.min(0.8, Math.max(0, Number(config.dropoutRate) || 0));

  if (store.classifier) store.classifier.dispose();
  store.classifier = tf.sequential();
  store.classifier.add(tf.layers.dense({ inputShape:[inputSize], units:hiddenUnits, activation:'relu' }));
  if (dropoutRate > 0) store.classifier.add(tf.layers.dropout({ rate:dropoutRate }));
  store.classifier.add(tf.layers.dense({ units:Math.max(8, Math.round(hiddenUnits / 2)), activation:'relu' }));
  store.classifier.add(tf.layers.dense({ units:n, activation:'softmax' }));
  store.classifier.compile({
    optimizer: createOptimizer(config.optimizer, config.learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  store.modelTrained = false;
}

export async function trainModel() {
  if (!store.backbone) return setStatus('Load a feature extractor first.', 'error');
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

  const config = syncTrainingConfigFromUI();
  const epochs = Math.max(1, parseInt(config.epochs, 10) || 25);
  const batchSize = Math.max(1, parseInt(config.batchSize, 10) || 16);

  resetTrainingCharts();
  buildClassifier(store.classes.length);
  setStatus(`Training with ${config.optimizer.toUpperCase()} - ${epochs} epochs - batch ${batchSize}.`);

  const xs = tf.concat(store.classes.flatMap(c => c.embeddings));
  const ys = tf.tensor2d(
    store.classes.flatMap((c, ci) =>
      c.embeddings.map(() => { const a = Array(store.classes.length).fill(0); a[ci]=1; return a; })
    )
  );

  store.epochSnapshots = [];

  try {
    // Helper to draw the inline mini loss chart.
    function drawMiniLossChart(losses) {
      const canvas = document.getElementById('trainingLossMini');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!losses.length) return;
      const maxLoss = Math.max(...losses);
      const minLoss = Math.min(...losses);
      const range = maxLoss - minLoss || 1;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < losses.length; i++) {
        const x = (i / Math.max(1, losses.length - 1)) * (canvas.width - 10) + 5;
        const y = canvas.height - 5 - ((losses[i] - minLoss) / range) * (canvas.height - 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    function drawMiniAccChart(accs) {
      const canvas = document.getElementById('trainingAccMini');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!accs.length) return;
      const maxAcc = Math.max(...accs);
      const minAcc = Math.min(...accs);
      const range = Math.max(0.1, maxAcc - minAcc);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < accs.length; i++) {
        const x = (i / Math.max(1, accs.length - 1)) * (canvas.width - 10) + 5;
        const y = canvas.height - 5 - ((accs[i] - minAcc) / range) * (canvas.height - 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const losses = [], accs = [];
    await store.classifier.fit(xs, ys, {
      epochs,
      batchSize: Math.min(batchSize, xs.shape[0]),
      shuffle: true,
      validationSplit: xs.shape[0] >= 10 ? 0.1 : 0,
      callbacks: {
        onBatchEnd: async function(batch, logs) {
          if (window.__trainingCancelled) {
            if (this?.model) this.model.stopTraining = true;
            else if (store.classifier) store.classifier.stopTraining = true;
            if (window.reportTrainingProgress) {
              window.reportTrainingProgress({ message: 'Training cancelled by user.' });
            }
          }
          await tf.nextFrame();
        },
        onEpochEnd: function(epoch, logs) {
          if (window.__trainingCancelled) {
            if (this?.model) this.model.stopTraining = true;
            else if (store.classifier) store.classifier.stopTraining = true;
          }
          const pct = ((epoch+1)/epochs*100).toFixed(0);
          const acc = logs.acc ?? logs.accuracy ?? 0;
          progressBar.style.width = pct + '%';
          trainLog.textContent = `Epoch ${epoch+1}/${epochs} - Loss: ${logs.loss.toFixed(4)} | Acc: ${(acc*100).toFixed(1)}%`;
          pushTrainingCharts(epoch+1, logs.loss, acc);

          // Update inline training progress.
          losses.push(logs.loss);
          accs.push(acc);
          drawMiniLossChart(losses);
          drawMiniAccChart(accs);

          if (window.reportTrainingProgress) {
            window.reportTrainingProgress({
              epoch: epoch + 1,
              totalEpochs: epochs,
              loss: logs.loss,
              acc: acc,
              percent: Math.round(pct)
            });
          }

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

    if (window.__trainingCancelled) {
      throw new Error('Training cancelled by user.');
    }

    store.modelTrained = true;
    await computeClassMeans();
    await publishActiveModelToBrowser();
    setPipe('predict');
    setStatus('Training complete! Upload a test image or start live prediction.', 'ready');
    trainLog.textContent = 'Model trained successfully!';

    // Report training finished to the inline progress panel.
    if (window.trainingFinished) {
      window.trainingFinished({
        summary: `Trained ${epochs} epochs with ${store.classes.length} classes and ${xs.shape[0]} samples.`,
        message: '✅ Training complete!'
      });
    }

    trainBtn.disabled = false;
    predictImgBtn.disabled = false;
    startLiveBtn.disabled = false;
    if (window.syncPredictUploadState) window.syncPredictUploadState();
    document.getElementById('exportBtn').disabled = false;
    const deployPackageBtn = document.getElementById('deployPackageBtn');
    if (deployPackageBtn) deployPackageBtn.disabled = false;
    const xaiToggle = document.getElementById('xaiToggle');
    if (xaiToggle) xaiToggle.disabled = false;
    drawArchDiagram();
    updateDistancePanel();
    initReplayCard();
    await evaluateModel();
  } catch(e) {
    const isCancelled = e.message && e.message.toLowerCase().includes('cancel');
    const errorMsg = isCancelled ? 'Training cancelled by user.' : 'Training failed: ' + e.message;
    setStatus(errorMsg, isCancelled ? 'warn' : 'error');
    trainBtn.disabled = false;
    predictImgBtn.disabled = false;
    startLiveBtn.disabled = false;
    if (window.syncPredictUploadState) window.syncPredictUploadState();
    const xaiToggle = document.getElementById('xaiToggle');
    if (xaiToggle) xaiToggle.disabled = false;
    // Report error/cancellation to the inline progress panel.
    if (window.reportTrainingProgress) {
      window.reportTrainingProgress({ message: errorMsg });
    }
    if (isCancelled) {
      if (window.trainingFinished) {
        window.trainingFinished({ message: errorMsg, summary: 'Training cancelled by user.' });
      }
    } else {
      throw e;
    }
  } finally {
    xs.dispose(); ys.dispose();
  }
}
