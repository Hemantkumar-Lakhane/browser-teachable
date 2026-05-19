// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { inferEmbedding } from './backbone.js';

// ── Tensor Extractions ───────────────────────────────────────────

/**
 * Extracts the 1024D embedding from the MobileNet model for a given image or video element.
 * 
 * @param {HTMLElement} src - The image or video source.
 * @returns {tf.Tensor1D|null} The embedding tensor, or null if it cannot process.
 */
export function extractEmbedding(src) {
  const emb = inferEmbedding(src);
  if (emb && emb.shape?.length) {
    store.embeddingSize = emb.shape[emb.shape.length - 1] || store.embeddingSize;
  }
  return emb;
}

// ── Statistics & Quality ─────────────────────────────────────────

/**
 * Computes the mean embedding for each class to be used for cosine similarity scoring
 * and "Why" explanations in the prediction panel.
 */
export async function computeClassMeans() {
  store.classMeans = [];
  for (const cls of store.classes) {
    if (!cls.embeddings.length) { store.classMeans.push(null); continue; }
    const stacked = tf.stack(cls.embeddings);
    const mean = tf.mean(stacked, 0);
    store.classMeans.push(await mean.data());
    stacked.dispose(); mean.dispose();
  }
}

/**
 * Warns the user if they've collected samples that are too similar visually 
 * (low variance) before training.
 */
export async function checkSampleVariance() {
  const warnEl = document.getElementById('varianceWarn');
  if (!warnEl) return;
  const warnings = [];
  for (const cls of store.classes) {
    if (cls.embeddings.length < 3) continue;
    const stacked = tf.stack(cls.embeddings);
    const mean = tf.mean(stacked, 0, true);
    const diff = stacked.sub(mean);
    const variance = tf.mean(tf.square(diff)).arraySync();
    stacked.dispose(); mean.dispose(); diff.dispose();

    if (variance < 0.005) {
      warnings.push(`"${cls.name}" (samples look very similar — add more variety)`);
    }
  }
  if (warnings.length) {
    warnEl.innerHTML = `⚠️ Low variety detected in: ${warnings.join(', ')}. Try different angles, distances, or lighting.`;
    warnEl.style.display = 'block';
  } else {
    warnEl.style.display = 'none';
  }
}
