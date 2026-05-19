import { store } from '../store.js';
import { setStatus } from '../utils.js';
import { drawArchDiagram } from '../visuals/architecture.js';
import { addNewClass } from '../ui/classes.js';
import { updateDistancePanel } from '../visuals/distance.js';
import { initReplayCard } from '../ui/replay.js';
import { computeClassMeans } from './dataset.js';
import { getBackboneSummary } from './backbone.js';
import { syncTrainingConfigFromUI, updateTrainingConfigLabels } from '../ui/training-config.js';

const ACTIVE_MODEL_DB_KEY = 'indexeddb://claimlens-active-model';
const ACTIVE_MODEL_META_KEY = 'claimlens_active_model_metadata';

function serializeEpochSnapshots() {
  return store.epochSnapshots.map(snapshot => ({
    epoch: snapshot.epoch,
    loss: snapshot.loss,
    acc: snapshot.acc,
    weights: snapshot.weights.map(weight => ({
      shape: weight.shape,
      data: Array.from(weight.data)
    }))
  }));
}

function deserializeEpochSnapshots(rawSnapshots = []) {
  if (!Array.isArray(rawSnapshots)) return [];

  return rawSnapshots
    .filter(snapshot => snapshot && Array.isArray(snapshot.weights))
    .map(snapshot => ({
      epoch: snapshot.epoch,
      loss: snapshot.loss,
      acc: snapshot.acc,
      weights: snapshot.weights.map(weight => ({
        shape: weight.shape,
        data: new Float32Array(weight.data)
      }))
    }));
}

function normalizeClassNames(meta) {
  if (!meta) return [];

  if (Array.isArray(meta.classes)) {
    return meta.classes
      .map(cls => typeof cls === 'string' ? cls : cls?.name)
      .filter(Boolean);
  }

  if (Array.isArray(meta.classNames)) {
    return meta.classNames.filter(Boolean);
  }

  return [];
}

function buildExportMetadata() {
  syncTrainingConfigFromUI();
  return {
    version: '2.0',
    date: new Date().toISOString(),
    classCount: store.classes.length,
    classes: store.classes.map(cls => cls.name),
    classMeans: store.classMeans.map(mean => mean ? Array.from(mean) : null),
    epochSnapshots: serializeEpochSnapshots(),
    replayEnabled: store.epochSnapshots.length > 0,
    backbone: getBackboneSummary(),
    trainingConfig: { ...store.trainingConfig }
  };
}

function buildBrowserRuntimeMetadata() {
  syncTrainingConfigFromUI();
  return {
    version: '2.0',
    date: new Date().toISOString(),
    classCount: store.classes.length,
    classes: store.classes.map(cls => cls.name),
    classMeans: store.classMeans.map(mean => mean ? Array.from(mean) : null),
    source: 'browser-active-model',
    backbone: getBackboneSummary(),
    trainingConfig: { ...store.trainingConfig }
  };
}

function getClassifierInputSize(model) {
  const shape = model?.inputs?.[0]?.shape || model?.layers?.[0]?.batchInputShape;
  return Array.isArray(shape) ? shape[shape.length - 1] : null;
}

export async function publishActiveModelToBrowser() {
  if (!store.classifier) {
    throw new Error('No trained/imported model is available to publish.');
  }

  if (!store.classMeans.length) {
    await computeClassMeans();
  }

  await store.classifier.save(ACTIVE_MODEL_DB_KEY);
  localStorage.setItem(ACTIVE_MODEL_META_KEY, JSON.stringify(buildBrowserRuntimeMetadata()));
}

function hideReplayCard() {
  const replayCard = document.getElementById('replay-card');
  if (!replayCard) return;

  replayCard.style.display = 'none';

  const replayBars = document.getElementById('replayBars');
  const replayInsight = document.getElementById('replayInsight');
  const replayThumb = document.getElementById('replayThumb');
  const replaySourceInfo = document.getElementById('replaySourceInfo');
  const epochSlider = document.getElementById('epochSlider');
  const epochLabel = document.getElementById('epochLabel');
  const epochEndLabel = document.getElementById('epochEndLabel');
  const replayPlayBtn = document.getElementById('replayPlayBtn');
  const replayStopBtn = document.getElementById('replayStopBtn');
  const replayResetBtn = document.getElementById('replayResetBtn');

  if (replayBars) replayBars.innerHTML = '';
  if (replayInsight) replayInsight.textContent = 'Replay history was not included with this imported model.';
  if (replayThumb) replayThumb.style.display = 'none';
  if (replaySourceInfo) {
    replaySourceInfo.textContent = 'Replay history unavailable for this imported model.';
  }
  if (epochSlider) {
    epochSlider.disabled = true;
    epochSlider.value = 1;
    epochSlider.style.setProperty('--pct', '0%');
  }
  if (epochLabel) epochLabel.textContent = 'Epoch 1';
  if (epochEndLabel) epochEndLabel.textContent = '/ 0';
  if (replayPlayBtn) replayPlayBtn.disabled = true;
  if (replayStopBtn) replayStopBtn.disabled = true;
  if (replayResetBtn) replayResetBtn.disabled = true;
}

function resetImportedState() {
  store.classes.forEach(cls => cls.embeddings.forEach(tensor => tensor.dispose()));
  store.classes = [];
  store.nextClassId = 0;
  store.classMeans = [];
  store.epochSnapshots = [];
  store.replayTestEmb = null;
  store.replayTestSrc = null;
}

export async function exportModel() {
  if (!store.classifier) return setStatus('No trained model found to export.', 'error');

  setStatus('Preparing model files for export...', 'ready');
  await publishActiveModelToBrowser();
  await store.classifier.save('downloads://model');

  const metadata = buildExportMetadata();

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metadata));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'metadata.json');
  document.body.appendChild(a);
  a.click();
  a.remove();

  setStatus('Model exported successfully.', 'ready');
}

export async function handleModelImport(e) {
  const files = e.target.files;
  if (!files || files.length < 3) {
    return setStatus('Select model.json, model.weights.bin, and metadata.json', 'error');
  }

  let jsonFile;
  let weightsFile;
  let metaFile;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.name.endsWith('.bin')) weightsFile = file;
    else if (file.name.includes('metadata')) metaFile = file;
    else if (file.name.endsWith('.json')) jsonFile = file;
  }

  if (!jsonFile || !weightsFile || !metaFile) {
    return setStatus('Missing required files.', 'error');
  }

  setStatus('Loading model weights...', 'ready');

  try {
    if (store.classifier) store.classifier.dispose();
    store.classifier = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, weightsFile]));
    store.classifier.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    const reader = new FileReader();
    reader.onload = async loadEvent => {
      const meta = JSON.parse(loadEvent.target.result);
      const classNames = normalizeClassNames(meta);

      if (!classNames.length) {
        setStatus('Metadata is missing class names.', 'error');
        return;
      }

      resetImportedState();
      if (meta.trainingConfig) {
        store.trainingConfig = { ...store.trainingConfig, ...meta.trainingConfig };
        Object.entries({
          epochs: 'epochsInput',
          batchSize: 'batchSizeInput',
          learningRate: 'learningRateInput',
          optimizer: 'optimizerSelect',
          dropoutRate: 'dropoutInput',
          hiddenUnits: 'hiddenUnitsInput'
        }).forEach(([key, id]) => {
          const el = document.getElementById(id);
          if (el && store.trainingConfig[key] !== undefined) el.value = store.trainingConfig[key];
        });
        updateTrainingConfigLabels();
      }

      const importedEmbeddingSize = meta.backbone?.embeddingSize || getClassifierInputSize(store.classifier) || 1024;
      const activeEmbeddingSize = store.backbone?.embeddingSize || store.embeddingSize;
      const backboneMismatch = meta.backbone?.id && meta.backbone.id !== store.backboneId;
      const shapeMismatch = activeEmbeddingSize && importedEmbeddingSize && activeEmbeddingSize !== importedEmbeddingSize;
      const canPredictWithCurrentBackbone = !backboneMismatch && !shapeMismatch;
      if (canPredictWithCurrentBackbone) store.embeddingSize = importedEmbeddingSize;

      classNames.forEach(className => addNewClass(className));

      if (Array.isArray(meta.classMeans) && meta.classMeans.length === classNames.length) {
        store.classMeans = meta.classMeans.map(mean =>
          Array.isArray(mean) ? Float32Array.from(mean) : mean
        );
      }

      if (!store.classMeans.length) {
        await computeClassMeans();
      }

      store.epochSnapshots = deserializeEpochSnapshots(meta.epochSnapshots);
      store.modelTrained = canPredictWithCurrentBackbone;

      document.getElementById('predictImgBtn').disabled = !canPredictWithCurrentBackbone;
      document.getElementById('startLiveBtn').disabled = !canPredictWithCurrentBackbone;
      document.getElementById('exportBtn').disabled = false;

      drawArchDiagram();
      await updateDistancePanel();

      if (store.epochSnapshots.length) initReplayCard();
      else hideReplayCard();

      if (canPredictWithCurrentBackbone) {
        try {
          await publishActiveModelToBrowser();
        } catch (publishErr) {
          console.warn('[ClaimLens] Imported model loaded but could not be published for other app pages.', publishErr);
        }
      }

      if (canPredictWithCurrentBackbone) {
        setStatus('Model loaded successfully.', 'ready');
      } else {
        const expected = meta.backbone?.label || `${importedEmbeddingSize}-feature backbone`;
        setStatus(`Model files loaded, but predictions are disabled because this classifier expects ${expected}. Switch to the matching backbone and re-import.`, 'error');
      }
    };

    reader.readAsText(metaFile);
  } catch (err) {
    setStatus('Error loading model: ' + err.message, 'error');
  }
}
