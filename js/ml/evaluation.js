import { store } from '../store.js';
import { getModelZipSize } from './deployment.js';

/**
 * Calculates and renders the Confusion Matrix and Evaluation Metrics
 * (Precision, Recall, F1-Score) after training completes.
 */
export async function evaluateModel() {
  const evalCard = document.getElementById('eval-card');
  const matrixWrapper = document.getElementById('confusionMatrixWrapper');
  const tableBody = document.getElementById('metricsTableBody');
  if (!evalCard || !matrixWrapper || !tableBody) return;

  // Show the card
  evalCard.style.display = 'block';
  const numClasses = store.classes.length;
  if (numClasses < 2) return;

  // Initialize confusion matrix: matrix[actual][predicted]
  const matrix = Array(numClasses).fill(0).map(() => Array(numClasses).fill(0));

  // Run predictions on all training embeddings
  let totalSamples = 0;

  // To avoid blocking the UI, we batch predictions or just run them synchronously since dataset is small
  store.classes.forEach((actualClass, actualIdx) => {
    actualClass.embeddings.forEach(embedding => {
      totalSamples++;
      const input = embedding.rank === 1 ? embedding.expandDims(0) : embedding.reshape([1, store.embeddingSize || embedding.shape[embedding.shape.length - 1]]);
      const prediction = store.classifier.predict(input);
      const predictedIdx = prediction.argMax(1).dataSync()[0];
      matrix[actualIdx][predictedIdx]++;

      // Cleanup
      prediction.dispose();
      if (input !== embedding) input.dispose();
    });
  });

  // Calculate Precision, Recall, F1 for each class
  const metrics = [];
  let totalCorrect = 0;
  for (let i = 0; i < numClasses; i++) {
    let tp = matrix[i][i];
    totalCorrect += tp;
    let fp = 0;
    let fn = 0;
    for (let j = 0; j < numClasses; j++) {
      if (i !== j) {
        fp += matrix[j][i]; // Others predicted as this class
        fn += matrix[i][j]; // This class predicted as others
      }
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : 2 * (precision * recall) / (precision + recall);
    metrics.push({
      name: store.classes[i].name,
      precision,
      recall,
      f1,
      support: tp + fn
    });
  }

  // Calculate macro averages
  let sumPrecision = 0,
    sumRecall = 0,
    sumF1 = 0;
  metrics.forEach(m => {
    sumPrecision += m.precision;
    sumRecall += m.recall;
    sumF1 += m.f1;
  });
  store.evaluationMetrics.evalAccuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;
  store.evaluationMetrics.macroPrecision = sumPrecision / numClasses;
  store.evaluationMetrics.macroRecall = sumRecall / numClasses;
  store.evaluationMetrics.macroF1 = sumF1 / numClasses;

  // Single-frame Inference Latency Benchmark
  if (store.backbone && store.classifier) {
    try {
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = store.backbone.inputSize || 224;
      dummyCanvas.height = store.backbone.inputSize || 224;

      // Warm up
      for (let w = 0; w < 3; w++) {
        const warmupEmb = store.backbone.infer(dummyCanvas);
        const warmupPred = store.classifier.predict(warmupEmb);
        await Promise.all([warmupEmb.data(), warmupPred.data()]);
        warmupEmb.dispose();
        warmupPred.dispose();
      }

      // Benchmark loops
      const numRuns = 20;
      let totalLatency = 0;
      for (let i = 0; i < numRuns; i++) {
        const startTime = performance.now();
        const emb = store.backbone.infer(dummyCanvas);
        const pred = store.classifier.predict(emb);
        await Promise.all([emb.data(), pred.data()]);
        const endTime = performance.now();
        totalLatency += endTime - startTime;
        emb.dispose();
        pred.dispose();
      }
      store.evaluationMetrics.avgInferenceLatency = totalLatency / numRuns;
    } catch (e) {
      console.warn("Latency benchmark failed", e);
    }
  }

  // Calculate ZIP Size
  try {
    store.evaluationMetrics.modelZipSizeMB = await getModelZipSize();
  } catch (e) {
    console.warn("Could not calculate ZIP size", e);
  }

  // Render Confusion Matrix
  renderConfusionMatrix(matrix, matrixWrapper);

  // Render Metrics Table
  renderMetricsTable(metrics, tableBody);
}
function renderConfusionMatrix(matrix, wrapper) {
  const numClasses = store.classes.length;
  let html = '<table class="cm-table">';

  // Header Row
  html += '<tr><th>Actual \\ Pred</th>';
  for (let i = 0; i < numClasses; i++) {
    html += `<th title="${store.classes[i].name}">${store.classes[i].name}</th>`;
  }
  html += '</tr>';

  // Find max value for color scaling
  let maxVal = 0;
  matrix.forEach(row => row.forEach(val => {
    if (val > maxVal) maxVal = val;
  }));

  // Data Rows
  for (let i = 0; i < numClasses; i++) {
    html += `<tr><th title="${store.classes[i].name}">${store.classes[i].name}</th>`;
    for (let j = 0; j < numClasses; j++) {
      const val = matrix[i][j];
      const isCorrect = i === j;
      // Calculate color intensity (0.0 to 1.0)
      const intensity = maxVal === 0 ? 0 : val / maxVal;

      // Correct predictions get a green hue, incorrect get a red hue
      let bgColor = isCorrect ? `rgba(72, 187, 120, ${intensity * 0.8 + 0.1})` // Green
      : `rgba(245, 101, 101, ${intensity * 0.8 + 0.1})`; // Red

      if (val === 0) bgColor = '#f8fafc'; // empty cells

      const textColor = intensity > 0.5 ? '#fff' : '#475569';
      html += `<td class="cm-cell" style="background-color:${bgColor}; color:${textColor};">${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  wrapper.setHTMLUnsafe(html);
}
function renderMetricsTable(metrics, tbody) {
  let html = '';
  metrics.forEach(m => {
    html += `
      <tr>
        <td style="font-weight:600; color:#1e293b;">${m.name} <span style="font-size:0.7rem;color:#94a3b8;font-weight:400;">(n=${m.support})</span></td>
        <td>${(m.precision * 100).toFixed(1)}%</td>
        <td>${(m.recall * 100).toFixed(1)}%</td>
        <td style="font-weight:600; color:${m.f1 > 0.8 ? '#48bb78' : m.f1 > 0.5 ? '#ecc94b' : '#f56565'};">${(m.f1 * 100).toFixed(1)}%</td>
      </tr>
    `;
  });
  tbody.setHTMLUnsafe(html);
}