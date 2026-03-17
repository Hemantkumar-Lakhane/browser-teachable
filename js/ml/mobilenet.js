// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { setStatus, setPipe } from '../utils.js';
import { addNewClass } from '../ui/classes.js';
import { drawArchDiagram } from '../visuals/architecture.js';

/**
 * Initializes and loads the pre-trained MobileNet model via the
 * external TensorFlow.js models API.
 */
export async function loadMobileNet() {
  setPipe('load');
  setStatus('⏳ Loading MobileNet… first load may take ~10 seconds.');
  const addClassBtn = document.getElementById('addClassBtn');
  try {
    store.mobilenetModel = await mobilenet.load();
    if (store.mobilenetModel.model && store.mobilenetModel.model.layers) {
      console.warn('[MobileNet] layers:', store.mobilenetModel.model.layers.map(l => l.name).join(' | '));
    }
    buildSpatialModel();
    console.warn('[MobileNet] loaded. spatialModel:', !!store.spatialModel, 'internalModels:', store.internalModels.length);
    document.getElementById('ps-load').classList.replace('active','done');
    setStatus('✅ MobileNet ready. Collect samples for each class to get started.', 'ready');
    if (addClassBtn) addClassBtn.disabled = false;
    
    // Default 2 classes
    addNewClass('Class A');
    addNewClass('Class B');
    drawArchDiagram();
  } catch(e) {
    setStatus('❌ Failed to load MobileNet. Check your internet connection.', 'error');
  }
}

/**
 * Reconstructs sub-models by iterating over MobileNet's internal layers. 
 * This enables the advanced spatial visualization needed for the inspector features.
 */
function buildSpatialModel() {
  try {
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
      } catch(e) { console.error(`[MobileNet] stage${i+1} build failed:`, e); }
    });

  } catch(e) {
    store.spatialModel = null;
    store.internalModels = [];
  }
}
