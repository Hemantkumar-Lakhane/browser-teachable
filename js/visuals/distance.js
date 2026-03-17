// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';

// ── Distance Calculation & Rendering ─────────────────────────────

export async function updateDistancePanel() {
  const distPairs = document.getElementById('distPairs');
  const distNote = document.getElementById('distNote');
  if (!distPairs || !distNote) return;
  const valid = store.classes.filter(c => c.embeddings.length > 0);
  if (valid.length < 2) {
    distPairs.innerHTML = '<div style="font-size:0.82rem;color:#a0aec0;">Add samples to at least 2 classes to see how separable they are.</div>';
    distNote.textContent = '';
    return;
  }

  const means = await Promise.all(valid.map(async cls => {
    const stacked = tf.stack(cls.embeddings);
    const mean    = tf.mean(stacked, 0);
    const data    = await mean.data();
    stacked.dispose(); mean.dispose();
    return { cls, data };
  }));

  const pairs = [];
  for (let i = 0; i < means.length; i++) {
    for (let j = i+1; j < means.length; j++) {
      const a = means[i].data, b = means[j].data;
      let dot=0, magA=0, magB=0;
      for (let k=0; k<a.length; k++) { dot+=a[k]*b[k]; magA+=a[k]*a[k]; magB+=b[k]*b[k]; }
      const similarity = dot / (Math.sqrt(magA)*Math.sqrt(magB));
      const distance   = ((1 - similarity)*100);  
      pairs.push({ a: means[i].cls, b: means[j].cls, distance });
    }
  }

  distPairs.innerHTML = '';
  let lowestDist = Infinity;
  pairs.forEach(pair => {
    const d    = pair.distance.toFixed(1);
    const pct  = Math.min(100, pair.distance).toFixed(1);
    const hue  = Math.round(pair.distance * 1.2);   
    const fill = `hsl(${hue}, 70%, 52%)`;

    if (pair.distance < lowestDist) lowestDist = pair.distance;

    const div = document.createElement('div');
    div.innerHTML = `
      <div class="dist-row-label">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${pair.a.pal.color};display:inline-block;"></span>
          ${pair.a.name}
          <span style="color:#a0aec0">vs</span>
          <span style="width:8px;height:8px;border-radius:50%;background:${pair.b.pal.color};display:inline-block;"></span>
          ${pair.b.name}
        </span>
        <strong style="color:${fill}">${d}% different</strong>
      </div>
      <div class="dist-track">
        <div class="dist-fill" style="width:${pct}%;background:${fill};"></div>
      </div>`;
    distPairs.appendChild(div);
  });

  const avgDist = pairs.reduce((s,p) => s+p.distance, 0) / pairs.length;
  let note = '';
  if (avgDist < 15)
    note = '⚠️ Your classes look <b>very similar</b> to the AI. The model may struggle — try more varied samples, or different subjects.';
  else if (avgDist < 35)
    note = '🟡 Classes are <b>moderately different</b>. Add more diverse samples to improve accuracy.';
  else
    note = '✅ Classes are <b>well separated</b> — the model should learn to distinguish them reliably.';
  distNote.innerHTML = note;
}
