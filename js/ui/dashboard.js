// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store } from '../store.js';
import { cosineSim } from '../utils.js';
import { updateDistancePanel } from '../visuals/distance.js';

// ── Global Stats & Readiness ─────────────────────────────────────

export function updateStats() {
  const statSamples = document.getElementById('statSamples');
  const statClasses = document.getElementById('statClasses');
  const total = store.classes.reduce((s, c) => s + c.embeddings.length, 0);
  if (statSamples) statSamples.textContent = total;
  if (statClasses) statClasses.textContent = store.classes.length;
  const autoAugmentBtn = document.getElementById('autoAugmentBtn');
  if (autoAugmentBtn) {
    autoAugmentBtn.disabled = total === 0;
  }
}
export function checkTrainReady() {
  const trainBtn = document.getElementById('trainBtn');
  if (trainBtn) trainBtn.disabled = !(store.classes.length >= 2 && store.classes.every(c => c.embeddings.length >= 2));
}
let qualityTimer = null;
export function scheduleQualityUpdate() {
  clearTimeout(qualityTimer);
  qualityTimer = setTimeout(renderQualityDashboard, 800);
}
export function updateDistancePanelWrap() {
  updateDistancePanel();
}

// ── Quality Dashboard Rendering ──────────────────────────────────

export async function renderQualityDashboard() {
  const body = document.getElementById('qualityBody');
  if (!body) return;
  const hasAnySamples = store.classes.some(c => c.embeddings.length > 0);
  if (!hasAnySamples) {
    body.setHTMLUnsafe('<div class="qd-empty">Collect samples to see dataset quality insights here.</div>');
    return;
  }
  body.setHTMLUnsafe('');
  const sampleCounts = store.classes.map(cls => cls.embeddings.length);
  const totalSamples = sampleCounts.reduce((sum, count) => sum + count, 0);
  const nonEmptyClasses = sampleCounts.filter(count => count > 0).length;
  const minSamples = sampleCounts.length ? Math.min(...sampleCounts) : 0;
  const maxSamples = sampleCounts.length ? Math.max(...sampleCounts) : 0;
  const weakClasses = store.classes.filter(cls => cls.embeddings.length < 5);
  const emptyClasses = store.classes.filter(cls => cls.embeddings.length === 0);
  const classSummaries = [];
  const diversityScores = [];
  for (const cls of store.classes) {
    const n = cls.embeddings.length;
    let diversityScore = null;
    if (n >= 2) {
      const embArrays = await Promise.all(cls.embeddings.map(t => t.data()));
      let pairCount = 0;
      let distSum = 0;
      const limit = Math.min(n, 20);
      for (let i = 0; i < limit; i++) {
        for (let j = i + 1; j < limit; j++) {
          const sim = cosineSim(embArrays[i], embArrays[j]);
          distSum += 1 - sim;
          pairCount++;
        }
      }
      if (pairCount > 0) {
        diversityScore = Math.min(100, Math.round(distSum / pairCount * 500));
        diversityScores.push(diversityScore);
      }
    }
    let adviceType = 'good';
    let advice = 'Class looks healthy. Keep a few examples for testing.';
    if (n === 0) {
      adviceType = 'warn';
      advice = 'Add sample images before training.';
    } else if (n < 5) {
      adviceType = 'warn';
      advice = `Add ${5 - n} more sample${5 - n === 1 ? '' : 's'} to stabilize this class.`;
    } else if (diversityScore !== null && diversityScore < 30) {
      adviceType = 'warn';
      advice = 'Samples look too similar. Add different angles, lighting, or backgrounds.';
    } else if (diversityScore !== null && diversityScore < 60) {
      adviceType = 'note';
      advice = 'Decent coverage. Add a few edge-case images for stronger generalization.';
    }
    classSummaries.push({
      cls,
      n,
      diversityScore,
      adviceType,
      advice
    });
  }
  const avgDiversity = diversityScores.length ? Math.round(diversityScores.reduce((sum, score) => sum + score, 0) / diversityScores.length) : 0;
  const balanceRatio = maxSamples ? minSamples / maxSamples : 0;
  const balanceGood = store.classes.length >= 2 && minSamples >= 2 && balanceRatio >= 0.55;
  const sampleDepthGood = weakClasses.length === 0;
  const diversityGood = avgDiversity >= 45;
  const augmentationRecommended = !sampleDepthGood || !diversityGood || !balanceGood;
  const overview = document.createElement('div');
  overview.className = 'qd-overview';
  const head = document.createElement('div');
  head.className = 'qd-overview-head';
  head.setHTMLUnsafe(`
    <div>
      <div class="qd-overview-title">Dataset Quality Overview</div>
      <div class="qd-overview-meta">${totalSamples} samples across ${nonEmptyClasses}/${store.classes.length} active classes</div>
    </div>
  `);
  overview.appendChild(head);
  const content = document.createElement('div');
  content.className = 'qd-overview-content';
  const summary = document.createElement('div');
  summary.className = 'qd-summary';
  const metrics = document.createElement('div');
  metrics.className = 'qd-metrics';
  [['Classes', `${nonEmptyClasses}/${store.classes.length}`], ['Samples', String(totalSamples)], ['Balance', balanceGood ? 'Good' : 'Needs work'], ['Variety', diversityScores.length ? `${avgDiversity}%` : 'Pending']].forEach(([label, value]) => {
    const metric = document.createElement('div');
    metric.className = 'qd-metric';
    metric.setHTMLUnsafe(`<span>${label}</span><b>${value}</b>`);
    metrics.appendChild(metric);
  });
  summary.appendChild(metrics);
  const insights = document.createElement('div');
  insights.className = 'qd-insight-grid';
  function addInsight(type, text) {
    const item = document.createElement('div');
    item.className = `qd-insight ${type}`;
    const mark = document.createElement('span');
    mark.className = 'qd-mark';
    mark.textContent = type === 'good' ? '✓' : '⚠';
    const copy = document.createElement('span');
    copy.textContent = text;
    item.append(mark, copy);
    insights.appendChild(item);
  }
  addInsight(balanceGood ? 'good' : 'warn', balanceGood ? 'Good class balance' : 'Class balance needs attention');
  addInsight(diversityGood ? 'good' : 'warn', diversityGood ? 'Lighting/background diversity detected' : 'Add more varied angles, backgrounds, or lighting');
  addInsight(sampleDepthGood ? 'good' : 'warn', sampleDepthGood ? 'Sample depth looks healthy' : 'Some classes need more samples');
  addInsight(augmentationRecommended ? 'warn' : 'good', augmentationRecommended ? 'Augmentation recommended' : 'Augmentation optional');
  summary.appendChild(insights);
  const classAdvice = document.createElement('div');
  classAdvice.className = 'qd-class-advice-list';
  const classAdviceHead = document.createElement('div');
  classAdviceHead.className = 'qd-class-advice-head';
  classAdviceHead.textContent = 'Classwise Suggestions';
  classAdvice.appendChild(classAdviceHead);
  classSummaries.slice(0, 10).forEach(({
    cls,
    n,
    diversityScore,
    adviceType,
    advice
  }) => {
    const item = document.createElement('div');
    item.className = `qd-class-advice ${adviceType}`;
    item.setHTMLUnsafe(`
      <div class="qd-class-advice-title">
        <span style="--cc:${cls.pal.color};"></span>
        <b></b>
        <em>${n} sample${n === 1 ? '' : 's'}${diversityScore !== null ? ` · ${diversityScore}% variety` : ''}</em>
      </div>
      <p></p>
    `);
    item.querySelector('b').textContent = cls.name;
    item.querySelector('p').textContent = advice;
    classAdvice.appendChild(item);
  });
  summary.appendChild(classAdvice);
  if (weakClasses.length || emptyClasses.length) {
    const note = document.createElement('div');
    note.className = 'qd-footnote';
    const names = weakClasses.slice(0, 4).map(cls => cls.name).join(', ');
    note.textContent = `Focus next: ${names}${weakClasses.length > 4 ? ` +${weakClasses.length - 4} more` : ''}.`;
    summary.appendChild(note);
  }
  content.appendChild(summary);
  const visual = document.createElement('div');
  visual.className = 'qd-visual';
  visual.setHTMLUnsafe(`
    <div class="qd-visual-head">
      <span>Sample Previews</span>
      <b>${totalSamples} samples analyzed</b>
    </div>
  `);
  const previewGroups = document.createElement('div');
  previewGroups.className = 'qd-preview-groups';
  const previewClasses = classSummaries.filter(summary => summary.n > 0);
  previewClasses.forEach(({
    cls,
    n,
    diversityScore,
    adviceType,
    advice
  }) => {
    const group = document.createElement('div');
    group.className = 'qd-preview-group';
    group.setHTMLUnsafe(`
      <div class="qd-preview-group-head">
        <span style="--cc:${cls.pal.color};">${cls.name}</span>
        <b>${n}</b>
      </div>
    `);
    const strip = document.createElement('div');
    strip.className = 'qd-preview-strip';
    const thumbs = cls.thumbs.slice(0, 4);
    thumbs.forEach((src, index) => {
      const tile = document.createElement('div');
      tile.className = 'qd-preview-tile';
      tile.title = `${cls.name}${cls.isAugmented?.[index] ? ' - augmented sample' : ''}`;
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${cls.name} sample`;
      tile.appendChild(img);
      if (cls.isAugmented?.[index]) {
        const aug = document.createElement('span');
        aug.className = 'qd-preview-aug';
        aug.textContent = 'aug';
        tile.appendChild(aug);
      }
      strip.appendChild(tile);
    });
    if (!thumbs.length) {
      const placeholder = document.createElement('div');
      placeholder.className = 'qd-preview-mini-empty';
      placeholder.textContent = `${cls.embeddings.length} samples`;
      strip.appendChild(placeholder);
    }
    group.appendChild(strip);
    const suggestion = document.createElement('div');
    suggestion.className = `qd-preview-suggestion ${adviceType}`;
    suggestion.textContent = `${diversityScore !== null ? `${diversityScore}% variety · ` : ''}${advice}`;
    group.appendChild(suggestion);
    previewGroups.appendChild(group);
  });
  if (!previewClasses.length) {
    const empty = document.createElement('div');
    empty.className = 'qd-preview-empty';
    empty.textContent = 'Image previews appear after samples are added.';
    previewGroups.appendChild(empty);
  }
  visual.appendChild(previewGroups);
  const balance = document.createElement('div');
  balance.className = 'qd-balance-strip';
  store.classes.filter(cls => cls.embeddings.length > 0).slice(0, 8).forEach(cls => {
    const row = document.createElement('div');
    row.className = 'qd-balance-row';
    const pct = maxSamples ? Math.max(6, Math.round(cls.embeddings.length / maxSamples * 100)) : 0;
    row.setHTMLUnsafe(`
      <span>${cls.name}</span>
      <div class="qd-balance-track"><div style="width:${pct}%;background:${cls.pal.color};"></div></div>
      <b>${cls.embeddings.length}</b>
    `);
    balance.appendChild(row);
  });
  visual.appendChild(balance);
  content.appendChild(visual);
  overview.appendChild(content);
  body.appendChild(overview);
}