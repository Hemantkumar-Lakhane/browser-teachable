// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from './store.js';
import { loadMobileNet, buildSpatialModel } from './ml/mobilenet.js';
import { trainModel, buildClassifier } from './ml/training.js';
import { predictImage, performLivePredictionStep } from './ml/prediction.js';
import { addNewClass, clearClassSamples, deleteClass, addSampleFromImage, importClassFolderFiles, importDatasetFromFolders } from './ui/classes.js';
import { startWebcam, stopWebcam, startCollection, stopCollection } from './ui/webcam.js';
import { setReplaySource, stopReplayAuto, scrubToEpoch, restoreFinalWeights } from './ui/replay.js';
import { runAutoAugment } from './ml/augment.js';
import { exportModel, handleModelImport } from './ml/persistence.js';
import { prepareDeploymentPackage } from './ml/deployment.js';
import { resetTrainingCharts, initTimelineChart } from './visuals/charts.js';
import { drawArchDiagram } from './visuals/architecture.js';

const KAGGLE_PROXY_URL = ''; // Optional: set to your Kaggle proxy endpoint if direct browser download is blocked.
import { inspectorDeactivate, inspectorActivate } from './visuals/inspector.js';
import { setStatus, setPipe } from './utils.js';
import { initDatasetStudio, setDatasetStudioImage, openDatasetStudio } from './ui/dataset-studio.js';
import { setupGuidedWorkflow, refreshWorkflowStep } from './ui/guided-workflow.js';
import { openLabelingModal } from './ui/labeling-studio.js';
import { initTrainingConfigControls, syncTrainingConfigFromUI, updateTrainingConfigLabels } from './ui/training-config.js';
import { loadBackbone, clearLearnedState, hasCollectedSamples, getBackboneOption } from './ml/backbone.js';

// ── Application Entry Point ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDatasetStudio();
  setupGuidedWorkflow();
  initTrainingConfigControls(handleBackboneChange);
  window.addSampleFromImage = addSampleFromImage;
  window.augmentClass       = (id) => runAutoAugment(id);
  window.deleteClass        = deleteClass;
  window.clearClassSamples  = clearClassSamples;
  window.startCollection    = startCollection;
  window.stopCollection     = stopCollection;

  // ── Drag & Drop Uploads ────────────────────────────────────────

  const uploadArea = document.getElementById('uploadArea');
  const imageUpload = document.getElementById('imageUpload');
  const datasetFolderInput = document.getElementById('datasetFolderInput');
  const datasetZipInput = document.getElementById('datasetZipInput');
  const classFolderInput = document.getElementById('classFolderInput');
  const importDatasetBtn = document.getElementById('importDatasetBtn');
  const importZipBtn = document.getElementById('importZipBtn');
  const openStudioBtn = document.getElementById('openStudioBtn');
  const preview = document.getElementById('preview');
  const predictUploadDropzone = document.getElementById('predictUploadDropzone');
  const predictImageUpload = document.getElementById('predictImageUpload');
  const predictUploadBtn = document.getElementById('predictUploadBtn');
  const predictPreview = document.getElementById('predictPreview');
  const predictPreviewOverlay = document.getElementById('predictPreviewOverlay');
  const predictPreviewWrap = document.getElementById('predictPreviewWrap');
  const predictUploadStatus = document.getElementById('predictUploadStatus');
  let pendingClassFolderId = null;

  function hasPredictionImage() {
    return !!(predictPreview && predictPreview.src && predictPreview.naturalWidth > 0);
  }

  function syncPredictUploadState() {
    const predictImgBtn = document.getElementById('predictImgBtn');
    if (predictImgBtn) predictImgBtn.disabled = !(store.modelTrained && hasPredictionImage());
    const replayUseUploadBtn = document.getElementById('replayUseUpload');
    if (replayUseUploadBtn) {
      replayUseUploadBtn.disabled = !(store.epochSnapshots.length && hasPredictionImage());
    }
  }

  window.syncPredictUploadState = syncPredictUploadState;

  function clearPredictionUpload() {
    if (predictImageUpload) predictImageUpload.value = '';
    if (predictPreview) {
      predictPreview.removeAttribute('src');
      predictPreview.onload = null;
    }
    if (predictPreviewOverlay) {
      predictPreviewOverlay.removeAttribute('src');
      predictPreviewOverlay.style.display = 'none';
    }
    if (predictPreviewWrap) predictPreviewWrap.classList.remove('has-image');
    if (predictUploadStatus) predictUploadStatus.textContent = 'No prediction image selected.';
    syncPredictUploadState();
  }

  function clearPredictionResults() {
    const predWinner = document.getElementById('predWinner');
    if (predWinner) {
      predWinner.style.display = 'none';
      predWinner.textContent = '';
      predWinner.removeAttribute('style');
      predWinner.style.display = 'none';
    }
    const whyBox = document.getElementById('whyBox');
    if (whyBox) {
      whyBox.style.display = 'none';
      whyBox.textContent = '';
    }
    if (predictPreviewOverlay) {
      predictPreviewOverlay.removeAttribute('src');
      predictPreviewOverlay.style.display = 'none';
    }
    const webcamOverlay = document.getElementById('webcamOverlay');
    if (webcamOverlay) {
      webcamOverlay.removeAttribute('src');
      webcamOverlay.style.display = 'none';
    }
    store.classes.forEach(cls => {
      const pct = document.getElementById(`pct-${cls.id}`);
      const bar = document.getElementById(`bar-${cls.id}`);
      if (pct) pct.textContent = '—';
      if (bar) bar.style.width = '0%';
    });
  }

  function setPredictionImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Choose an image file for prediction.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      if (!predictPreview) return;
      predictPreview.onload = () => {
        if (predictPreviewWrap) predictPreviewWrap.classList.add('has-image');
        if (predictPreviewOverlay) {
          predictPreviewOverlay.removeAttribute('src');
          predictPreviewOverlay.style.display = 'none';
        }
        if (predictUploadStatus) {
          predictUploadStatus.textContent = store.modelTrained
            ? `${file.name} is ready for prediction.`
            : `${file.name} is ready. Train the model to predict it.`;
        }
        syncPredictUploadState();
      };
      predictPreview.src = e.target.result;
      refreshWorkflowStep('predict');
    };
    reader.readAsDataURL(file);
  }

  window.importClassFolder = id => {
    pendingClassFolderId = id;
    if (classFolderInput) classFolderInput.click();
  };

  uploadArea.addEventListener('click', () => imageUpload.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) readFile(f);
  });
  imageUpload.addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });

  if (predictUploadDropzone && predictImageUpload) {
    predictUploadDropzone.addEventListener('click', () => predictImageUpload.click());
    predictUploadDropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        predictImageUpload.click();
      }
    });
    predictUploadDropzone.addEventListener('dragover', e => {
      e.preventDefault();
      predictUploadDropzone.classList.add('is-drag-over');
    });
    predictUploadDropzone.addEventListener('dragleave', () => {
      predictUploadDropzone.classList.remove('is-drag-over');
    });
    predictUploadDropzone.addEventListener('drop', e => {
      e.preventDefault();
      predictUploadDropzone.classList.remove('is-drag-over');
      setPredictionImage(e.dataTransfer.files[0]);
    });
    predictImageUpload.addEventListener('change', e => {
      if (e.target.files[0]) setPredictionImage(e.target.files[0]);
    });
  }
  if (predictUploadBtn && predictImageUpload) {
    predictUploadBtn.addEventListener('click', e => {
      e.stopPropagation();
      predictImageUpload.click();
    });
  }

  if (openStudioBtn) {
    openStudioBtn.addEventListener('click', () => {
      openDatasetStudio();
      refreshWorkflowStep('label');
    });
  }
  if (importDatasetBtn && datasetFolderInput) {
    importDatasetBtn.addEventListener('click', () => datasetFolderInput.click());
  }
  if (importZipBtn && datasetZipInput) {
    importZipBtn.addEventListener('click', () => datasetZipInput.click());
  }
  if (datasetFolderInput) {
    datasetFolderInput.addEventListener('change', async e => {
      if (e.target.files?.length) {
        await importDatasetFromFolders(e.target.files);
        if (openStudioBtn) openStudioBtn.disabled = false;
      }
      refreshWorkflowStep('label');
      e.target.value = '';
    });
  }
  if (datasetZipInput) {
    datasetZipInput.addEventListener('change', async e => {
      if (e.target.files?.length) {
        const zipFile = e.target.files[0];
        try {
          await processDatasetZip(zipFile, zipFile.name);
          if (openStudioBtn) openStudioBtn.disabled = false;
        } catch (err) {
          setStatus(err.message || 'ZIP import failed.', 'error');
        }
      }
      refreshWorkflowStep('label');
      e.target.value = '';
    });
  }
  if (classFolderInput) {
    classFolderInput.addEventListener('change', async e => {
      if (pendingClassFolderId !== null && e.target.files?.length) {
        await importClassFolderFiles(pendingClassFolderId, e.target.files);
        if (openStudioBtn) openStudioBtn.disabled = false;
      }
      pendingClassFolderId = null;
      e.target.value = '';
    });
  }

  const importCloudBtn = document.getElementById('importCloudBtn');
  const cloudImportModal = document.getElementById('cloudImportModal');
  const closeCloudImportBtn = document.getElementById('closeCloudImportBtn');
  const kagglePathInput = document.getElementById('kagglePathInput');
  const kagglePresetButtons = document.querySelectorAll('.kagglePresetBtn');
  const cloudImportProgress = document.getElementById('cloudImportProgress');
  const cloudImportStatusText = document.getElementById('cloudImportStatusText');
  const cloudImportProgressBar = document.getElementById('cloudImportProgressBar');
  const cloudImportError = document.getElementById('cloudImportError');
  const startCloudImportBtn = document.getElementById('startCloudImportBtn');

  function resetCloudImportState() {
    if (cloudImportError) {
      cloudImportError.style.display = 'none';
      cloudImportError.textContent = '';
    }
    if (cloudImportProgress) {
      cloudImportProgress.style.display = 'none';
    }
    if (cloudImportProgressBar) {
      cloudImportProgressBar.style.width = '0%';
    }
  }

  function updateCloudImportStatus(message, percent = 0) {
    if (cloudImportStatusText) cloudImportStatusText.textContent = message;
    if (cloudImportProgress) cloudImportProgress.style.display = 'flex';
    if (cloudImportProgressBar) cloudImportProgressBar.style.width = `${percent}%`;
  }

  function showCloudImportError(message) {
    if (cloudImportError) {
      cloudImportError.style.display = 'block';
      cloudImportError.textContent = message;
    }
    if (cloudImportProgressBar) cloudImportProgressBar.style.width = '0%';
  }

  function openCloudModal() {
    if (!cloudImportModal) return;
    cloudImportModal.style.display = 'flex';
    resetCloudImportState();
    if (kagglePathInput) kagglePathInput.value = '';
  }

  function closeCloudModal() {
    if (!cloudImportModal) return;
    cloudImportModal.style.display = 'none';
  }

  if (importCloudBtn) {
    importCloudBtn.addEventListener('click', openCloudModal);
  }
  if (closeCloudImportBtn) {
    closeCloudImportBtn.addEventListener('click', closeCloudModal);
  }
  if (cloudImportModal) {
    cloudImportModal.addEventListener('click', e => {
      if (e.target === cloudImportModal) closeCloudModal();
    });
  }
  const kaggleSizeLabel = document.getElementById('kaggleSizeLabel');
  if (kagglePresetButtons) {
    kagglePresetButtons.forEach(button => {
      button.addEventListener('click', () => {
        const path = button.dataset.path;
        if (kagglePathInput) kagglePathInput.value = path;
        const size = button.getAttribute('data-size');
        if (kaggleSizeLabel) kaggleSizeLabel.textContent = size ? `Size: ${size}` : '';
      });
    });
  }

  if (kagglePathInput && kaggleSizeLabel) {
    kagglePathInput.addEventListener('input', () => { kaggleSizeLabel.textContent = ''; });
  }
  // ── Inline training progress controls ─────────────────────────
  const trainingPanel = document.getElementById('trainingPanel');
  const trainingProgressBar = document.getElementById('trainingProgressBar');
  const trainingStatusText = document.getElementById('trainingStatusText');
  const trainingRunLog = document.getElementById('trainingRunLog');
  const trainingCancelBtn = document.getElementById('trainingCancelBtn');
  const trainingCloseBtn = document.getElementById('trainingCloseBtn');
  const trainingEta = document.getElementById('trainingEta');

  function showTrainingPanel() {
    if (trainingPanel) trainingPanel.style.display = 'block';
    if (trainingProgressBar) trainingProgressBar.style.width = '0%';
    if (trainingStatusText) {
      trainingStatusText.textContent = 'Preparing training…';
      trainingStatusText.style.color = '#475569';
    }
    if (trainingRunLog) trainingRunLog.innerHTML = '';
    showTrainingCancel();
    if (trainingEta) trainingEta.textContent = '—';
  }

  function hideTrainingPanel() {
    if (trainingPanel) trainingPanel.style.display = 'none';
  }


  function appendTrainingLog(msg) {
    if (!trainingRunLog) return;
    const p = document.createElement('div');
    p.textContent = msg;
    trainingRunLog.appendChild(p);
    trainingRunLog.scrollTop = trainingRunLog.scrollHeight;
  }

  function updateTrainingProgress({ epoch, totalEpochs, loss, acc, percent, message, eta }) {
    if (message && trainingStatusText) {
      trainingStatusText.textContent = message;
      if (message.includes('error') || message.includes('failed')) {
        trainingStatusText.style.color = '#dc2626';
      } else {
        trainingStatusText.style.color = '#475569';
      }
    }
    if (typeof percent === 'number' && trainingProgressBar) trainingProgressBar.style.width = `${percent}%`;
    else if (epoch && totalEpochs && trainingProgressBar) {
      const pct = Math.round((epoch / totalEpochs) * 100);
      trainingProgressBar.style.width = `${pct}%`;
    }
    if (typeof loss !== 'undefined' || typeof acc !== 'undefined') {
      appendTrainingLog(`Epoch ${epoch || '?'} — loss: ${loss !== undefined ? loss.toFixed(4) : '-'}  acc: ${acc !== undefined ? (acc*100).toFixed(2)+'%' : '-'} `);
    }
    if (eta && trainingEta) trainingEta.textContent = eta;
  }

  function showTrainingClose() {
    if (trainingCloseBtn) trainingCloseBtn.style.display = 'inline-block';
    if (trainingCancelBtn) trainingCancelBtn.style.display = 'none';
  }

  function showTrainingCancel() {
    if (trainingCloseBtn) trainingCloseBtn.style.display = 'none';
    if (trainingCancelBtn) {
      trainingCancelBtn.style.display = 'inline-block';
      trainingCancelBtn.disabled = false;
    }
  }

  // Expose functions so training logic can call them
  window.reportTrainingProgress = updateTrainingProgress;
  window.trainingFinished = (info) => {
    updateTrainingProgress({ message: info?.message || 'Training complete', percent: 100 });
    appendTrainingLog(info?.summary || 'Training finished successfully.');
    showTrainingClose();
  };

  if (trainingCancelBtn) {
    trainingCancelBtn.addEventListener('click', () => {
      window.__trainingCancelled = true;
      trainingCancelBtn.disabled = true;
      updateTrainingProgress({ message: 'Stopping training…' });
      appendTrainingLog('User requested cancellation. Waiting for training loop to stop.');
    });
  }
  if (trainingCloseBtn) {
    trainingCloseBtn.addEventListener('click', () => hideTrainingPanel());
  }
  if (startCloudImportBtn) {
    startCloudImportBtn.addEventListener('click', async () => {
      if (!startCloudImportBtn) return;
      startCloudImportBtn.disabled = true;
      try {
        const path = kagglePathInput?.value.trim() || '';
        await importKaggleDataset(path);
        if (openStudioBtn) openStudioBtn.disabled = false;
        refreshWorkflowStep('label');
        if (cloudImportModal) closeCloudModal();
      } catch (err) {
        showCloudImportError(err.message || 'Import failed.');
      } finally {
        if (startCloudImportBtn) startCloudImportBtn.disabled = false;
      }
    });
  }
  
  async function importKaggleDataset(path) {
    if (!path) throw new Error('Enter a Kaggle dataset path like owner/dataset.');
    const parts = path.split('/').map(part => part.trim()).filter(Boolean);
    if (parts.length !== 2) throw new Error('Kaggle dataset path must be owner/dataset.');
    const [ownerSlug, datasetSlug] = parts;
    updateCloudImportStatus('Downloading from Kaggle…', 10);
    const blob = await fetchKaggleZip(ownerSlug, datasetSlug);
    await processDatasetZip(blob, `${ownerSlug}-${datasetSlug}`);
  }

  async function fetchKaggleZip(ownerSlug, datasetSlug) {
    const directUrl = `https://www.kaggle.com/api/v1/datasets/download/${ownerSlug}/${datasetSlug}`;

    // Helper: perform a streamed fetch and return a Blob while updating progress
    async function streamedFetch(url, options = {}) {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);

      const contentLengthHeader = response.headers.get('Content-Length') || response.headers.get('content-length');
      const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

      // If streaming not supported, fallback to blob
      if (!response.body || typeof response.body.getReader !== 'function') {
        const blobFallback = await response.blob();
        updateCloudImportStatus(`Downloaded ${Math.round(blobFallback.size/1024)} KB`, 60);
        return blobFallback;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length || value.byteLength || 0;

        if (total) {
          const pct = 10 + Math.round((received / total) * 60); // map to 10-70
          updateCloudImportStatus(`Downloading from Kaggle… ${Math.round(received/1024)} KB / ${Math.round(total/1024)} KB`, pct);
        } else {
          updateCloudImportStatus(`Downloading from Kaggle… ${Math.round(received/1024)} KB`, 25);
        }
      }

      const blob = new Blob(chunks, { type: 'application/zip' });
      updateCloudImportStatus(`Downloaded ${Math.round(blob.size/1024)} KB`, 75);
      return blob;
    }

    if (KAGGLE_PROXY_URL) {
      const proxyUrl = new URL(KAGGLE_PROXY_URL);
      proxyUrl.searchParams.set('ownerSlug', ownerSlug);
      proxyUrl.searchParams.set('datasetSlug', datasetSlug);
      try {
        // Proxy may accept POST body with dataset info
        const blob = await streamedFetch(proxyUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerSlug, datasetSlug })
        });
        return blob;
      } catch (err) {
        throw new Error(`Proxy download failed: ${err.message}`);
      }
    }

    try {
      const blob = await streamedFetch(directUrl, { headers: { 'Accept': 'application/zip' } });
      return blob;
    } catch (err) {
      throw new Error('Kaggle download blocked by browser CORS or requires authentication. Configure a proxy or retry with a supported dataset path.');
    }
  }

  function getMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      case 'gif':
        return 'image/gif';
      default:
        return '';
    }
  }

  function detectCommonRoot(paths) {
    const normalized = paths.map(path => path.split('/').filter(Boolean));
    if (!normalized.length) return '';
    const root = normalized[0][0];
    if (!root) return '';
    const allMatch = normalized.every(parts => parts[0] === root);
    return allMatch ? `${root}/` : '';
  }

  async function processDatasetZip(blob, sourceLabel) {
    updateCloudImportStatus('Extracting dataset archive…', 35);
    const zip = await JSZip.loadAsync(blob);
    const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.(jpe?g|png|webp|bmp|gif)$/i.test(entry.name));
    if (!entries.length) throw new Error('No image files found inside the ZIP archive.');

    const commonRoot = detectCommonRoot(entries.map(entry => entry.name));
    const files = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const stripped = entry.name.replace(commonRoot, '');
      const parts = stripped.split('/').filter(Boolean);
      if (!parts.length) continue;
      const fileName = parts[parts.length - 1];
      const mimeType = getMimeType(fileName);
      if (!mimeType) continue;
      const blobData = await entry.async('blob');
      const file = new File([blobData], fileName, { type: mimeType });
      const relativePath = parts.length > 1
        ? `${parts.slice(0, -1).join('/')}/${fileName}`
        : `Imported/${fileName}`;
      try {
        file.datasetRelativePath = relativePath;
      } catch (err) {
        Object.defineProperty(file, 'datasetRelativePath', {
          value: relativePath,
          writable: false,
          configurable: true,
          enumerable: false
        });
      }
      files.push(file);
      if (cloudImportProgressBar) {
        const percent = 35 + Math.round((40 * (i + 1)) / entries.length);
        cloudImportProgressBar.style.width = `${percent}%`;
      }
    }

    if (!files.length) throw new Error('No supported image files were imported from the archive.');
    updateCloudImportStatus(`Importing ${files.length} images into the workspace…`, 80);
    await importDatasetFromFolders(files);
    updateCloudImportStatus(`Imported ${files.length} image${files.length === 1 ? '' : 's'} from ${sourceLabel}.`, 100);
  }
  
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      preview.src = ev.target.result;
      preview.style.display = 'block';
      preview.onload = async () => {
        if (openStudioBtn) openStudioBtn.disabled = false;
        setPipe('collect');
        setDatasetStudioImage(preview.src);
        setStatus('Image loaded. Edit it in Dataset Studio, then add it to a label.', 'ready');
        refreshWorkflowStep('label');
        import('./ui/classes.js').then((classes) => {
             classes.updateAllButtons();
        });
        import('./ui/replay.js').then((replay) => {
             replay.syncReplayButtons();
        });
      };
    };
    reader.readAsDataURL(file);
  }

  // ── Global Button Listeners ────────────────────────────────────

  const openLabelingStudioBtn = document.getElementById('openLabelingStudioBtn');
  if (openLabelingStudioBtn) {
    openLabelingStudioBtn.addEventListener('click', () => {
      openLabelingModal();
      refreshWorkflowStep('label');
    });
  }

  document.getElementById('addClassBtn').addEventListener('click', () => addNewClass());
  
  document.getElementById('trainBtn').addEventListener('click', async () => {
    // Show inline training progress and mark training as not cancelled.
    window.__trainingCancelled = false;
    refreshWorkflowStep('train');
    showTrainingPanel();

    try {
      // Let the inline panel render before heavy training starts.
      await new Promise(resolve => setTimeout(resolve, 50));
      await trainModel();
      // training.js should call window.reportTrainingProgress / window.trainingFinished
    } catch (err) {
      updateTrainingProgress({ message: `Training error: ${err.message || err}` });
      // allow user to close
      showTrainingClose();
    }
  });
  
  document.getElementById('predictImgBtn').addEventListener('click', () => {
    refreshWorkflowStep('predict');
    predictImage(predictPreview, { overlayEl: predictPreviewOverlay });
  });
  
  const startWebcamBtn = document.getElementById('startWebcamBtn');
  if (startWebcamBtn) startWebcamBtn.addEventListener('click', startWebcam);
  const predictStartCameraBtn = document.getElementById('predictStartCameraBtn');
  if (predictStartCameraBtn) predictStartCameraBtn.addEventListener('click', startWebcam);

  const startLiveBtn = document.getElementById('startLiveBtn');
  const exportEvalPdfBtn = document.getElementById('exportEvalPdfBtn');
  if (exportEvalPdfBtn) {
    exportEvalPdfBtn.addEventListener('click', () => {
      const totalSamples = store.classes.reduce((sum, c) => sum + c.embeddings.length, 0);
      const accVal = store.epochSnapshots.length > 0 ? (store.epochSnapshots[store.epochSnapshots.length - 1].acc * 100).toFixed(1) : 'N/A';
      
      let classesHtml = '';
      store.classes.forEach(cls => {
        classesHtml += `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #e2e8f0;">
            <span style="font-weight:600; color:${cls.pal.text}; display:flex; items-align:center; gap:8px;">
              <span style="width:12px; height:12px; border-radius:50%; background:${cls.pal.color}; display:inline-block; margin-top:4px;"></span>
              ${cls.name}
            </span>
            <span style="color:#64748b; font-size:14px;">${cls.embeddings.length} Samples</span>
          </div>
        `;
      });

      const distPairsHtml = document.getElementById('distPairs') ? document.getElementById('distPairs').innerHTML : '<i>Not computed yet.</i>';
      const distNoteHtml = document.getElementById('distNote') ? document.getElementById('distNote').innerHTML : '';
      const varianceHtml = document.getElementById('varianceWarn') ? document.getElementById('varianceWarn').innerHTML : '';

      const reportHtml = `
        <h1 style="color:#0f172a; margin-bottom: 5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">ModelForge AI — Detailed Evaluation Report</h1>
        <p style="color:#64748b; font-size:14px; margin-top:0;">Generated on: ${new Date().toLocaleString()}</p>
        
        <div style="margin-top:20px; display:flex; gap:20px; flex-wrap:wrap;">
          <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <h3 style="margin-top:0; color:#334155; font-size:16px;">Dataset Statistics</h3>
            <ul style="padding-left:20px; font-size:14px; margin-bottom:0;">
              <li><b>Total Classes:</b> ${store.classes.length}</li>
              <li><b>Total Samples:</b> ${totalSamples}</li>
              <li><b>Training Epochs:</b> ${store.epochSnapshots.length}</li>
              <li><b>Optimizer:</b> ${store.trainingConfig.optimizer.toUpperCase()}</li>
            </ul>
          </div>
          <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <h3 style="margin-top:0; color:#334155; font-size:16px;">Model Performance</h3>
            <ul style="padding-left:20px; font-size:14px; margin-bottom:0;">
              <li><b>Final Training Accuracy:</b> ${accVal}%</li>
              <li><b>Evaluation Accuracy (CM):</b> ${(store.evaluationMetrics.evalAccuracy * 100 || 0).toFixed(1)}%</li>
              <li><b>Architecture:</b> ${(store.backbone?.label || 'MobileNet v1')} + Dense Classifier</li>
              <li><b>Macro Precision:</b> ${(store.evaluationMetrics.macroPrecision * 100 || 0).toFixed(1)}%</li>
              <li><b>Macro Recall:</b> ${(store.evaluationMetrics.macroRecall * 100 || 0).toFixed(1)}%</li>
              <li><b>Macro F1-Score:</b> ${(store.evaluationMetrics.macroF1 * 100 || 0).toFixed(1)}%</li>
              <li><b>Avg. Training Time/Epoch:</b> ${(store.evaluationMetrics.avgTrainingTimePerEpoch || 0).toFixed(0)} ms (Steady: ${(store.evaluationMetrics.steadyAvgTrainingTimePerEpoch || 0).toFixed(0)} ms)</li>
              <li><b>Inference Latency:</b> ${(store.evaluationMetrics.avgInferenceLatency || 0).toFixed(1)} ms / frame</li>
              <li><b>Exported Model Size (ZIP):</b> ${(store.evaluationMetrics.modelZipSizeMB || 0).toFixed(2)} MB</li>
            </ul>
          </div>
        </div>

        <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">1. Class Breakdown</h2>
        <div style="margin-top:10px; background:#fff; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
          ${classesHtml}
          ${varianceHtml ? `<div style="margin-top:15px; padding:10px; background:#fffbeb; color:#92400e; border-left:4px solid #f59e0b; font-size:13px;"><b>Data Quality Note:</b> ${varianceHtml}</div>` : ''}
        </div>

        <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">2. Sample Quality & Diversity</h2>
        <div style="margin-top:10px; background:#fff; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
          ${document.getElementById('qualityBody') ? document.getElementById('qualityBody').innerHTML : '<i>Not computed yet.</i>'}
        </div>

        <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">3. Inter-Class Semantic Distance (Separability)</h2>
        <div style="margin-top:10px; background:#fff; padding:15px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px;">
          ${distPairsHtml}
          <div style="margin-top:15px; font-size:13px; color:#475569;">${distNoteHtml}</div>
        </div>

        <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">4. Confusion Matrix</h2>
        <div style="overflow-x:hidden; margin-top:10px;">
          ${document.getElementById('confusionMatrixWrapper').innerHTML}
        </div>
        
        <h2 style="color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:5px; margin-top:30px;">5. Classification Metrics</h2>
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
              ${document.getElementById('metricsTableBody').innerHTML}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top:40px; text-align:center; color:#94a3b8; font-size:12px;">
          <i>This report is auto-generated strictly in-browser via ModelForge AI. No data was transmitted to external servers.</i>
        </div>
      `;
      
      const printArea = document.getElementById('print-area');
      if (printArea) {
        printArea.innerHTML = reportHtml;
        window.print();
      }
    });
  }
  const stopLiveBtn = document.getElementById('stopLiveBtn');
  
  startLiveBtn.addEventListener('click', () => {
    if (!store.modelTrained) return setStatus('Train the model first.', 'error');
    if (!store.webcamReady)  return setStatus('Start the webcam first.', 'error');
    refreshWorkflowStep('predict');
    stopLive();
    stopLiveBtn.disabled  = false;
    startLiveBtn.disabled = true;
    document.getElementById('predWinner').style.display = 'block';
    const whyBox = document.getElementById('whyBox');
    if (whyBox) whyBox.style.display = 'block';
    setStatus('🔴 Live prediction running…', 'ready');
    initTimelineChart();
    inspectorActivate();   

    store.predInterval = setInterval(async () => {
      const webcamEl = document.getElementById('webcam');
      await performLivePredictionStep(webcamEl);
    }, 200);
  });

  stopLiveBtn.addEventListener('click', stopLive);
  function stopLive() {
    if (store.predInterval) { clearInterval(store.predInterval); store.predInterval = null; }
    stopLiveBtn.disabled  = true;
    startLiveBtn.disabled = !store.modelTrained;
    inspectorDeactivate();  
  }

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset everything? All samples and training will be lost.')) return;
    try {
      stopLive();
      stopWebcam();
      stopReplayAuto();
      store.epochSnapshots = [];
      store.replayTestEmb = null;
      store.replayTestSrc = null;
      store.classMeans = [];
      const replayCard = document.getElementById('replay-card');
      if (replayCard) replayCard.style.display = 'none';
      const replayBars = document.getElementById('replayBars');
      if (replayBars) replayBars.innerHTML = '';
      const replayInsight = document.getElementById('replayInsight');
      if (replayInsight) replayInsight.textContent = 'Train the model first, then select a test image to begin.';

      store.classes.forEach(c => c.embeddings.forEach(t => t.dispose()));
      store.classes = [];
      store.nextClassId = 0;
      store.modelTrained = false;

      const qb = document.getElementById('qualityBody');
      if (qb) qb.innerHTML = '<div class="qd-empty">Collect samples to see dataset quality insights here.</div>';
      if (preview) {
        preview.style.display = 'none';
        preview.removeAttribute('src');
      }
      clearPredictionUpload();
      clearPredictionResults();
      if (openStudioBtn) openStudioBtn.disabled = true;
      const datasetStudio = document.getElementById('datasetStudio');
      if (datasetStudio) datasetStudio.style.display = 'none';
      const progressBar = document.getElementById('progressBar');
      if (progressBar) progressBar.style.width = '0%';
      const trainLog = document.getElementById('trainLog');
      if (trainLog) trainLog.textContent = '—';
      const predictImgBtn = document.getElementById('predictImgBtn');
      if (predictImgBtn) predictImgBtn.disabled = true;
      if (startLiveBtn) startLiveBtn.disabled = true;
      const xaiToggle = document.getElementById('xaiToggle');
      if (xaiToggle) {
        xaiToggle.checked = false;
        xaiToggle.disabled = true;
      }
      const exportBtn = document.getElementById('exportBtn');
      if (exportBtn) exportBtn.disabled = true;
      const generateLinkBtn = document.getElementById('generateLinkBtn');
      if (generateLinkBtn) generateLinkBtn.disabled = true;
      const linkOutput = document.getElementById('linkOutput');
      if (linkOutput) {
        linkOutput.style.display = 'none';
        linkOutput.textContent = '';
      }
      const deployPackageBtn = document.getElementById('deployPackageBtn');
      if (deployPackageBtn) deployPackageBtn.disabled = true;
      const collectStatus = document.getElementById('collectStatus');
      if (collectStatus) collectStatus.textContent = '';
      const distPairs = document.getElementById('distPairs');
      if (distPairs) distPairs.innerHTML = '<div style="font-size:0.82rem;color:#a0aec0;">Add samples to at least 2 classes to see how separable they are.</div>';
      const distNote = document.getElementById('distNote');
      if (distNote) distNote.textContent = '';
      resetTrainingCharts();
      if (store.timelineChart) {
        store.timelineChart.destroy();
        store.timelineChart = null;
      }
      store.timelineTick = 0;
      setPipe('load');
      const loadStep = document.getElementById('ps-load');
      if (loadStep) loadStep.classList.add('done');
      const addClassBtn = document.getElementById('addClassBtn');
      if (addClassBtn) addClassBtn.disabled = false;
      buildClassifier(2);
      addNewClass('Class A');
      addNewClass('Class B');
      updateTrainingConfigLabels();
      drawArchDiagram();
      refreshWorkflowStep('upload');
      setStatus('🔄 Reset complete. Start collecting samples!', 'ready');
    } catch (err) {
      console.error('[Reset] failed:', err);
      setStatus(`Reset failed: ${err.message || err}`, 'error');
    }
  });

  // ── Feature Specific Handlers ──────────────────────────────────

  const replayUseUpload = document.getElementById('replayUseUpload');
  if (replayUseUpload) {
    replayUseUpload.addEventListener('click', async () => {
      if (!hasPredictionImage()) return;
      await setReplaySource(predictPreview, 'prediction image');
      document.getElementById('replayThumb').src = predictPreview.src;
    });
  }

  const replaySnap = document.getElementById('replaySnap');
  if (replaySnap) {
    replaySnap.addEventListener('click', async () => {
      const webcamEl = document.getElementById('webcam');
      if (!store.webcamReady || !webcamEl.videoWidth) return;
      const snap = document.createElement('canvas');
      snap.width = webcamEl.videoWidth; snap.height = webcamEl.videoHeight;
      snap.getContext('2d').drawImage(webcamEl, 0, 0);
      document.getElementById('replayThumb').src = snap.toDataURL('image/jpeg', 0.85);
      await setReplaySource(snap, 'webcam snapshot');
    });
  }

  const epochSlider = document.getElementById('epochSlider');
  if (epochSlider) {
    epochSlider.addEventListener('input', async () => {
      stopReplayAuto();
      await scrubToEpoch(parseInt(epochSlider.value));
    });
  }

  const replayPlayBtn = document.getElementById('replayPlayBtn');
  const replayStopBtn = document.getElementById('replayStopBtn');
  const replayResetBtn = document.getElementById('replayResetBtn');

  if (replayPlayBtn) {
    replayPlayBtn.addEventListener('click', () => {
      if (!store.replayTestEmb) return;
      stopReplayAuto();
      let e = parseInt(epochSlider.value);
      if (e >= store.epochSnapshots.length) e = 1;   

      replayPlayBtn.disabled = true;
      replayStopBtn.disabled = false;

      store.replayInterval = setInterval(async () => {
        epochSlider.value = e;
        await scrubToEpoch(e);
        e++;
        if (e > store.epochSnapshots.length) {
          stopReplayAuto();
          restoreFinalWeights();
        }
      }, 420);
    });
  }

  if (replayStopBtn) {
    replayStopBtn.addEventListener('click', () => {
      stopReplayAuto();
      restoreFinalWeights();
    });
  }

  if (replayResetBtn) {
    replayResetBtn.addEventListener('click', async () => {
      stopReplayAuto();
      epochSlider.value = 1;
      await scrubToEpoch(1);
    });
  }

  // Model Persistence Handlers
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportModel);

  const deployPackageBtn = document.getElementById('deployPackageBtn');
  if (deployPackageBtn) {
    deployPackageBtn.addEventListener('click', async () => {
      deployPackageBtn.disabled = true;
      try {
        await prepareDeploymentPackage();
      } catch (err) {
        setStatus('Deployment package failed: ' + err.message, 'error');
      } finally {
        deployPackageBtn.disabled = !store.modelTrained;
      }
    });
  }
  
  const importFiles = document.getElementById('importFiles');
  if (importFiles) importFiles.addEventListener('change', handleModelImport);

  const autoAugmentBtn = document.getElementById('autoAugmentBtn');
  if (autoAugmentBtn) autoAugmentBtn.addEventListener('click', runAutoAugment);

  // Final Init
  loadMobileNet();
  refreshWorkflowStep('upload');

});

async function handleBackboneChange(nextBackboneId) {
  const previousBackboneId = store.backboneId;
  const select = document.getElementById('backboneSelect');
  const option = getBackboneOption(nextBackboneId);

  if (nextBackboneId === previousBackboneId) return;
  if (hasCollectedSamples() || store.modelTrained) {
    const ok = confirm('Changing the backbone clears collected embeddings and the trained classifier. Continue?');
    if (!ok) {
      if (select) select.value = previousBackboneId;
      return;
    }
  }

  clearLearnedState({ clearSamples: true });
  store.classes.forEach(cls => {
    const cnt = document.getElementById(`cnt-${cls.id}`);
    if (cnt) cnt.textContent = '0';
  });

  try {
    setStatus(`Switching to ${option.label}...`);
    await loadBackbone(nextBackboneId);
    buildSpatialModel();
    syncTrainingConfigFromUI();
    updateTrainingConfigLabels();
    drawArchDiagram();
    setStatus(`${option.label} ready. Recollect samples for the new feature space.`, 'ready');
  } catch (err) {
    console.error('[Backbone] switch failed:', err);
    if (select) select.value = previousBackboneId;
    try {
      await loadBackbone(previousBackboneId);
      buildSpatialModel();
    } catch (rollbackErr) {
      console.error('[Backbone] rollback failed:', rollbackErr);
    }
    updateTrainingConfigLabels();
    drawArchDiagram();
    setStatus(`Could not load ${option.label}: ${err.message}`, 'error');
  }
}
