import { store } from '../store.js';
import { BACKBONE_OPTIONS, getBackboneOption } from '../ml/backbone.js';
const CONFIG_FIELDS = {
  epochs: {
    id: 'epochsInput',
    type: 'int',
    min: 1,
    max: 200
  },
  batchSize: {
    id: 'batchSizeInput',
    type: 'int',
    min: 1,
    max: 256
  },
  learningRate: {
    id: 'learningRateInput',
    type: 'float',
    min: 0.000001,
    max: 1
  },
  optimizer: {
    id: 'optimizerSelect',
    type: 'string'
  },
  dropoutRate: {
    id: 'dropoutInput',
    type: 'float',
    min: 0,
    max: 0.8
  },
  hiddenUnits: {
    id: 'hiddenUnitsInput',
    type: 'int',
    min: 8,
    max: 1024
  }
};
function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
function readField(field) {
  const el = document.getElementById(field.id);
  if (!el) return null;
  if (field.type === 'string') return el.value;
  const value = field.type === 'int' ? parseInt(el.value, 10) : parseFloat(el.value);
  return clamp(value, field.min, field.max);
}
export function syncTrainingConfigFromUI() {
  Object.entries(CONFIG_FIELDS).forEach(([key, field]) => {
    const value = readField(field);
    if (value !== null) store.trainingConfig[key] = value;
  });
  updateTrainingConfigLabels();
  return {
    ...store.trainingConfig
  };
}
export function updateTrainingConfigLabels() {
  const statEpochs = document.getElementById('statEpochs');
  if (statEpochs) statEpochs.textContent = store.trainingConfig.epochs;
  const dropoutValue = document.getElementById('dropoutValue');
  if (dropoutValue) dropoutValue.textContent = `${Math.round(store.trainingConfig.dropoutRate * 100)}%`;
  const backboneMeta = document.getElementById('backboneMeta');
  if (backboneMeta) {
    const option = getBackboneOption();
    backboneMeta.textContent = `${option.shortLabel} - ${store.embeddingSize || option.embeddingSize || 1024} features`;
  }
}
export function initTrainingConfigControls(onBackboneChange) {
  const backboneSelect = document.getElementById('backboneSelect');
  if (backboneSelect) {
    backboneSelect.setHTMLUnsafe(BACKBONE_OPTIONS.map(option => `<option value="${option.id}">${option.label}</option>`).join(''));
    backboneSelect.value = store.backboneId;
    backboneSelect.addEventListener('change', async event => {
      if (onBackboneChange) await onBackboneChange(event.target.value);
      updateTrainingConfigLabels();
    });
  }
  Object.entries(CONFIG_FIELDS).forEach(([key, field]) => {
    const el = document.getElementById(field.id);
    if (!el) return;
    el.value = store.trainingConfig[key];
    el.addEventListener('input', syncTrainingConfigFromUI);
    el.addEventListener('change', syncTrainingConfigFromUI);
  });
  updateTrainingConfigLabels();
}