// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from './store.js';
import { loadMobileNet } from './ml/mobilenet.js';
import { trainModel, buildClassifier } from './ml/training.js';
import { predictImage, performLivePredictionStep } from './ml/prediction.js';
import { addNewClass, clearClassSamples, deleteClass, addSampleFromImage } from './ui/classes.js';
import { startWebcam, startCollection, stopCollection } from './ui/webcam.js';
import { setReplaySource, stopReplayAuto, scrubToEpoch, restoreFinalWeights } from './ui/replay.js';
import { toggleInternals } from './visuals/internals.js';
import { resetTrainingCharts, initTimelineChart } from './visuals/charts.js';
import { drawArchDiagram } from './visuals/architecture.js';
import { inspectorDeactivate, inspectorActivate } from './visuals/inspector.js';
import { setStatus, setPipe } from './utils.js';

// ── Application Entry Point ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.addSampleFromImage = addSampleFromImage;
  window.deleteClass        = deleteClass;
  window.clearClassSamples  = clearClassSamples;
  window.startCollection    = startCollection;
  window.stopCollection     = stopCollection;

  // ── Drag & Drop Uploads ────────────────────────────────────────

  const uploadArea = document.getElementById('uploadArea');
  const imageUpload = document.getElementById('imageUpload');
  const preview = document.getElementById('preview');

  uploadArea.addEventListener('click', () => imageUpload.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) readFile(f);
  });
  imageUpload.addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });
  
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      preview.src = ev.target.result;
      preview.style.display = 'block';
      preview.onload = async () => {
        setPipe('collect');
        setStatus('🖼 Image loaded. Click "Add Image" under any class to label it.', 'ready');
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

  document.getElementById('addClassBtn').addEventListener('click', () => addNewClass());
  
  document.getElementById('trainBtn').addEventListener('click', trainModel);
  
  document.getElementById('predictImgBtn').addEventListener('click', () => predictImage(preview));
  
  document.getElementById('startWebcamBtn').addEventListener('click', startWebcam);

  const startLiveBtn = document.getElementById('startLiveBtn');
  const stopLiveBtn = document.getElementById('stopLiveBtn');
  
  startLiveBtn.addEventListener('click', () => {
    if (!store.modelTrained) return setStatus('Train the model first.', 'error');
    if (!store.webcamReady)  return setStatus('Start the webcam first.', 'error');
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
    stopCollection(); stopLive();
    stopReplayAuto();
    store.epochSnapshots = [];
    store.replayTestEmb  = null;
    const replayCard = document.getElementById('replay-card');
    if (replayCard) {
      replayCard.style.display = 'none';
      document.getElementById('replayBars').innerHTML = '';
      document.getElementById('replayInsight').textContent = 'Train the model first, then select a test image to begin.';
    }
    store.classes.forEach(c => c.embeddings.forEach(t => t.dispose()));
    store.classes = []; store.nextClassId = 0;
    store.modelTrained = false;
    const qb = document.getElementById('qualityBody');
    if (qb) qb.innerHTML = '<div class="qd-empty">Collect samples to see quality analysis here.</div>';
    preview.style.display = 'none'; preview.src = '';
    document.getElementById('predWinner').style.display = 'none';
    const whyBox = document.getElementById('whyBox');
    if (whyBox) { whyBox.style.display = 'none'; whyBox.textContent = ''; }
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('trainLog').textContent = '—';
    document.getElementById('predictImgBtn').disabled = startLiveBtn.disabled = true;
    document.getElementById('collectStatus').textContent = '';
    document.getElementById('distPairs').innerHTML = '<div style="font-size:0.82rem;color:#a0aec0;">Add samples to at least 2 classes to see how separable they are.</div>';
    document.getElementById('distNote').textContent = '';
    resetTrainingCharts();
    if (store.timelineChart) { store.timelineChart.destroy(); store.timelineChart = null; }
    setPipe('load'); document.getElementById('ps-load').classList.add('done');
    setStatus('🔄 Reset complete. Start collecting samples!', 'ready');
    document.getElementById('addClassBtn').disabled = false;
    buildClassifier(2);
    addNewClass('Class A'); addNewClass('Class B');
    drawArchDiagram();
  });

  // ── Feature Specific Handlers ──────────────────────────────────

  document.getElementById('internalsToggleBtn').addEventListener('click', toggleInternals);

  const replayUseUpload = document.getElementById('replayUseUpload');
  if (replayUseUpload) {
    replayUseUpload.addEventListener('click', async () => {
      if (!preview.src || !preview.naturalWidth) return;
      await setReplaySource(preview, 'uploaded image');
      document.getElementById('replayThumb').src = preview.src;
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

  // Final Init
  loadMobileNet();

});
