import { store } from '../store.js';

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
      // Get prediction
      // embedding is [1, 1024]. We reshape it to [1, 1024] just in case it's not
      const input = embedding.expandDims ? embedding : embedding.reshape([1, 1024]);
      const prediction = store.classifier.predict(input);
      const predictedIdx = prediction.argMax(1).dataSync()[0];
      
      matrix[actualIdx][predictedIdx]++;
      
      // Cleanup
      prediction.dispose();
      if (!embedding.expandDims) input.dispose(); // if we had to reshape
    });
  });

  // Calculate Precision, Recall, F1 for each class
  const metrics = [];
  for (let i = 0; i < numClasses; i++) {
    let tp = matrix[i][i];
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
  matrix.forEach(row => row.forEach(val => { if (val > maxVal) maxVal = val; }));
  
  // Data Rows
  for (let i = 0; i < numClasses; i++) {
    html += `<tr><th title="${store.classes[i].name}">${store.classes[i].name}</th>`;
    for (let j = 0; j < numClasses; j++) {
      const val = matrix[i][j];
      const isCorrect = i === j;
      // Calculate color intensity (0.0 to 1.0)
      const intensity = maxVal === 0 ? 0 : val / maxVal;
      
      // Correct predictions get a green hue, incorrect get a red hue
      let bgColor = isCorrect 
        ? `rgba(72, 187, 120, ${intensity * 0.8 + 0.1})`  // Green
        : `rgba(245, 101, 101, ${intensity * 0.8 + 0.1})`; // Red
        
      if (val === 0) bgColor = '#f8fafc'; // empty cells
      
      const textColor = intensity > 0.5 ? '#fff' : '#475569';
      
      html += `<td class="cm-cell" style="background-color:${bgColor}; color:${textColor};">${val}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  
  wrapper.innerHTML = html;
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
  
  tbody.innerHTML = html;
}
