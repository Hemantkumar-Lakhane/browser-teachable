// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

/**
 * Global application state.
 * 
 * Instead of relying on global variables attached to `window`, all shared
 * mutable state (models, user classes, hardware state, visualizations) 
 * is centralized here.
 */
export const store = {
  // MobileNet and Transfer Learning
  mobilenetModel: null,
  classifier: null,
  modelTrained: false,
  
  // Custom classes the user manages
  classes: [],
  nextClassId: 0,
  
  // Webcam & sampling
  webcamReady: false,
  collectionInterval: null,
  predInterval: null,
  activeCollectId: null,
  
  // Model training snapshots allowing timeline "scrubbing"
  epochSnapshots: [],
  replayTestEmb: null,
  replayTestSrc: null,
  replayInterval: null,
  
  // Average embedding arrays for calculating cosine similarity.
  classMeans: [],
  
  // Advanced architecture inspection
  spatialModel: null,
  internalModels: [],
  internalsVisible: false,

  // Chartjs objects holding references to canvases
  lossChart: null,
  accChart: null,
  timelineChart: null,
  timelineTick: 0
};

/**
 * Aesthetic palette array assigning consistent color codes to user classes.
 */
export const PALETTE = [
  { color: '#667eea', bg: '#ebf4ff', border: '#bee3f8', text: '#2b6cb0' },
  { color: '#f6ad55', bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
  { color: '#48bb78', bg: '#f0fff4', border: '#c6f6d5', text: '#276749' },
  { color: '#f56565', bg: '#fff5f5', border: '#fed7d7', text: '#c53030' },
  { color: '#9f7aea', bg: '#faf5ff', border: '#e9d8fd', text: '#553c9a' },
];

export const MAX_CLASSES = 5;
export const EPOCHS = 25;
export const THUMB_SIZE = 48;
export const THUMB_MAX = 12;
export const timelineMax = 40;
