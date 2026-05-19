import { store } from '../store.js';
import { setStatus } from '../utils.js';

const TFHUB_BACKBONES = {
  resnet50: {
    id: 'resnet50',
    label: 'ResNet50',
    shortLabel: 'ResNet50',
    description: 'High-capacity feature extractor. Slower, stronger on varied visual datasets.',
    url: 'https://tfhub.dev/google/tfjs-model/imagenet/resnet_v2_50/feature_vector/3/default/1',
    inputSize: 224,
    normalize: 'zero-one'
  },
  efficientnetb0: {
    id: 'efficientnetb0',
    label: 'EfficientNet B0',
    shortLabel: 'EfficientNet',
    description: 'Accuracy-focused extractor with efficient scaling. Heavier than MobileNet.',
    url: 'https://tfhub.dev/tensorflow/tfjs-model/efficientnet/b0/feature-vector/1/default/1',
    inputSize: 224,
    normalize: 'zero-one'
  }
};

export const BACKBONE_OPTIONS = [
  {
    id: 'mobilenet-v1',
    label: 'MobileNet v1',
    shortLabel: 'MobileNet v1',
    description: 'Fast default backbone for browser training.',
    type: 'mobilenet',
    version: 1,
    alpha: 1.0,
    inputSize: 224
  },
  {
    id: 'mobilenet-v2',
    label: 'MobileNet v2',
    shortLabel: 'MobileNet v2',
    description: 'Better feature extractor with similar browser-friendly footprint.',
    type: 'mobilenet',
    version: 2,
    alpha: 1.0,
    inputSize: 224
  },
  {
    ...TFHUB_BACKBONES.resnet50,
    type: 'tfhub'
  },
  {
    ...TFHUB_BACKBONES.efficientnetb0,
    type: 'tfhub'
  }
];

export function getBackboneOption(id = store.backboneId) {
  return BACKBONE_OPTIONS.find(option => option.id === id) || BACKBONE_OPTIONS[0];
}

export function getBackboneSummary() {
  const option = getBackboneOption();
  return {
    id: option.id,
    label: option.label,
    embeddingSize: store.embeddingSize || 1024,
    inputSize: option.inputSize || 224
  };
}

export function hasCollectedSamples() {
  return store.classes.some(cls => cls.embeddings.length > 0);
}

export function clearLearnedState({ clearSamples = true } = {}) {
  if (clearSamples) {
    store.classes.forEach(cls => {
      cls.embeddings.forEach(tensor => tensor.dispose());
      cls.embeddings = [];
      cls.thumbs = [];
      cls.isAugmented = [];
    });
  }
  if (store.classifier) {
    store.classifier.dispose();
    store.classifier = null;
  }
  store.modelTrained = false;
  store.classMeans = [];
  store.epochSnapshots = [];
  store.replayTestEmb = null;
  store.replayTestSrc = null;

  const progressBar = document.getElementById('progressBar');
  if (progressBar) progressBar.style.width = '0%';
  const trainLog = document.getElementById('trainLog');
  if (trainLog) trainLog.textContent = '-';
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.disabled = true;
  const deployPackageBtn = document.getElementById('deployPackageBtn');
  if (deployPackageBtn) deployPackageBtn.disabled = true;
  const predictImgBtn = document.getElementById('predictImgBtn');
  if (predictImgBtn) predictImgBtn.disabled = true;
  const startLiveBtn = document.getElementById('startLiveBtn');
  if (startLiveBtn) startLiveBtn.disabled = true;
  const replayCard = document.getElementById('replay-card');
  if (replayCard) replayCard.style.display = 'none';
}

function preprocessForGraphModel(source, option) {
  return tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [option.inputSize, option.inputSize]);
    const batch = resized.toFloat().expandDims(0);
    if (option.normalize === 'minus-one-one') return batch.div(127.5).sub(1);
    return batch.div(255);
  });
}

function flattenFeatureTensor(tensor) {
  if (tensor.rank === 2) return tensor;
  const featureCount = tensor.shape.slice(1).reduce((product, value) => product * value, 1);
  return tensor.reshape([tensor.shape[0], featureCount]);
}

async function detectEmbeddingSize(backbone, option) {
  const sample = tf.zeros([1, option.inputSize || 224, option.inputSize || 224, 3]);
  let emb;
  try {
    emb = backbone.infer(sample, true);
    const shape = emb.shape;
    return shape[shape.length - 1] || shape.slice(1).reduce((product, value) => product * value, 1);
  } finally {
    sample.dispose();
    if (emb) emb.dispose();
  }
}

async function loadMobilenetBackbone(option) {
  const model = await mobilenet.load({ version: option.version, alpha: option.alpha });
  const adapter = {
    ...option,
    model,
    infer(source) {
      return model.infer(source, true);
    }
  };
  adapter.embeddingSize = await detectEmbeddingSize(adapter, option);
  return adapter;
}

async function loadTfHubBackbone(option) {
  const model = await tf.loadGraphModel(option.url, { fromTFHub: true });
  const adapter = {
    ...option,
    model,
    infer(source) {
      return tf.tidy(() => {
        const input = source instanceof tf.Tensor ? source : preprocessForGraphModel(source, option);
        const output = model.predict(input);
        const tensor = Array.isArray(output) ? output[0] : output;
        return flattenFeatureTensor(tensor).clone();
      });
    }
  };
  adapter.embeddingSize = await detectEmbeddingSize(adapter, option);
  return adapter;
}

export async function loadBackbone(backboneId = store.backboneId) {
  const option = getBackboneOption(backboneId);
  setStatus(`Loading ${option.label} feature extractor... first load may take a bit.`);

  const adapter = option.type === 'tfhub'
    ? await loadTfHubBackbone(option)
    : await loadMobilenetBackbone(option);

  if (store.backbone?.model && store.backbone.model !== adapter.model) {
    if (store.backbone.model.dispose) store.backbone.model.dispose();
    else if (store.backbone.model.model?.dispose) store.backbone.model.model.dispose();
  }

  store.backbone = adapter;
  store.backboneId = option.id;
  store.embeddingSize = adapter.embeddingSize;
  store.mobilenetModel = adapter;
  store.spatialModel = null;
  store.internalModels = [];
  return adapter;
}

export function inferEmbedding(source) {
  if (!store.backbone) return null;
  if (source instanceof HTMLVideoElement && (!source.videoWidth || !source.videoHeight)) return null;
  return tf.tidy(() => store.backbone.infer(source).clone());
}
