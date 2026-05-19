import { store } from '../store.js';
import { setStatus, setPipe } from '../utils.js';
import { addNewClass } from '../ui/classes.js';
import { drawArchDiagram } from '../visuals/architecture.js';
import { loadBackbone, getBackboneOption } from './backbone.js';
import { updateTrainingConfigLabels } from '../ui/training-config.js';

/**
 * Initializes and loads the selected frozen feature extractor.
 */
export async function loadMobileNet() {
  setPipe('load');
  const option = getBackboneOption();
  setStatus(`Loading ${option.label}... first load may take ~10 seconds.`);
  const addClassBtn = document.getElementById('addClassBtn');
  const importDatasetBtn = document.getElementById('importDatasetBtn');

  try {
    await loadBackbone(store.backboneId);
    if (store.mobilenetModel?.model?.layers) {
      console.warn('[Backbone] layers:', store.mobilenetModel.model.layers.map(l => l.name).join(' | '));
    }

    buildSpatialModel();
    console.warn('[Backbone] loaded:', store.backboneId, 'embeddingSize:', store.embeddingSize, 'spatialModel:', !!store.spatialModel, 'internalModels:', store.internalModels.length);
    document.getElementById('ps-load').classList.replace('active','done');
    setStatus(`${option.label} ready. Collect samples for each class to get started.`, 'ready');
    if (addClassBtn) addClassBtn.disabled = false;
    if (importDatasetBtn) importDatasetBtn.disabled = false;

    if (!store.classes.length) {
      addNewClass('Class A');
      addNewClass('Class B');
    }
    updateTrainingConfigLabels();
    drawArchDiagram();
  } catch(e) {
    console.error('[Backbone] load failed:', e);
    setStatus(`Failed to load ${option.label}. Check your internet connection or choose MobileNet v1.`, 'error');
  }
}

/**
 * Reconstructs sub-models for MobileNet internals. Non-MobileNet graph
 * backbones still train and predict, but skip the deep layer inspector.
 */
export function buildSpatialModel() {
  try {
    if (!store.backbone || store.backbone.type !== 'mobilenet') {
      store.spatialModel = null;
      store.internalModels = [];
      return;
    }

    const base = store.mobilenetModel.model;
    if (!base || !base.layers) return;
    const layerNames = base.layers.map(l => l.name);

    const lastConvName = layerNames.find(n => n.includes('conv_pw_13_relu'))
                      || layerNames.find(n => n.includes('conv_pw_13'));
    if (lastConvName) {
      store.spatialModel = tf.model({ inputs: base.inputs, outputs: base.getLayer(lastConvName).output });
    }

    const stageCandidates = [
      ['conv_pw_1_relu', 'conv_pw_1', 'conv1_relu', 'conv_dw_1_relu', 'Conv1_relu'],
      ['conv_pw_5_relu', 'conv_pw_5', 'conv_dw_5_relu'],
      ['conv_pw_9_relu', 'conv_pw_9', 'conv_dw_9_relu'],
      ['conv_pw_13_relu','conv_pw_13','conv_dw_13_relu'],
    ];

    store.internalModels = [];
    stageCandidates.forEach((candidates, i) => {
      const found = candidates.find(c => layerNames.includes(c));
      if (!found) return;
      try {
        const m = tf.model({ inputs: base.inputs, outputs: base.getLayer(found).output });
        store.internalModels.push({ model: m, layerName: found, stageIdx: i + 1 });
        const lbl = document.getElementById(`int-layer-${i + 1}`);
        if (lbl) lbl.textContent = found;
      } catch(e) { console.error(`[Backbone] stage${i+1} build failed:`, e); }
    });
  } catch(e) {
    store.spatialModel = null;
    store.internalModels = [];
  }
}
