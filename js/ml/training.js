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
    await store.classifier.fit(xs, ys, {
      epochs,
      batchSize: Math.min(batchSize, xs.shape[0]),
      shuffle: true,
      validationSplit: xs.shape[0] >= 10 ? 0.1 : 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const pct = ((epoch+1)/epochs*100).toFixed(0);
          const acc = logs.acc ?? logs.accuracy ?? 0;
          progressBar.style.width = pct + '%';
          trainLog.textContent = `Epoch ${epoch+1}/${epochs} - Loss: ${logs.loss.toFixed(4)} | Acc: ${(acc*100).toFixed(1)}%`;
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
    setStatus('Training complete! Predict an image or start live prediction.', 'ready');
    trainLog.textContent = 'Model trained successfully!';
    trainBtn.disabled = false;
    predictImgBtn.disabled = false;
    startLiveBtn.disabled = false;
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
    setStatus('Training failed: ' + e.message, 'error');
    trainBtn.disabled = false;
  } finally {
    xs.dispose(); ys.dispose();
  }
}
