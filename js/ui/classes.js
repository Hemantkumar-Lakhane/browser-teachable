// ═══════════════════════════════════════════════════════════════
//  Teachable Machine v1.5
//  Clean v1 base + dynamic classes (up to 5) +
//  training charts + architecture diagram +
//  embedding distance meter + confidence timeline
// ═══════════════════════════════════════════════════════════════

import { store, MAX_CLASSES, PALETTE } from '../store.js';
import { updateStats, checkTrainReady } from './dashboard.js';
import { updateDistancePanelWrap, scheduleQualityUpdate } from './dashboard.js';
import { extractEmbedding } from '../ml/dataset.js';
import { captureThumbnail } from './webcam.js';
import { setStatus, setPipe } from '../utils.js';

// ── Class State Management ───────────────────────────────────────

export function addNewClass(name) {
  if (store.classes.length >= MAX_CLASSES) return;
  const id    = store.nextClassId++;
  const pal   = PALETTE[store.classes.length % PALETTE.length];
  store.classes.push({ id, name: name || `Class ${String.fromCharCode(65 + store.classes.length)}`, embeddings:[], thumbs:[], pal });
  renderClasses();
  renderPredBars();
  updateStats();
}

export function deleteClass(id) {
  const cls = store.classes.find(c => c.id === id);
  if (cls) cls.embeddings.forEach(t => t.dispose());
  store.classes = store.classes.filter(c => c.id !== id);
  renderClasses();
  renderPredBars();
  updateStats();
  updateDistancePanelWrap();
}

export function clearClassSamples(id) {
  const cls = store.classes.find(c => c.id === id);
  if (!cls) return;
  cls.embeddings.forEach(t => t.dispose());
  cls.embeddings = [];
  cls.thumbs = [];
  updateCountEl(id);
  updateStats();
  checkTrainReady();
  updateDistancePanelWrap();
  scheduleQualityUpdate();
}

// ── DOM Rendering ────────────────────────────────────────────────

export function updateCountEl(id) {
  const el = document.getElementById(`cnt-${id}`);
  const cls = store.classes.find(c => c.id === id);
  if (el && cls) el.textContent = cls.embeddings.length;
}

export function renderClasses() {
  const classesWrap = document.getElementById('classes-wrap');
  const addClassBtn = document.getElementById('addClassBtn');
  if (!classesWrap) return;
  classesWrap.innerHTML = '';
  store.classes.forEach(cls => {
    const p = cls.pal;
    const div = document.createElement('div');
    div.className = 'class-row';
    div.style.cssText = `background:${p.bg};border-color:${p.border};--cc:${p.color}`;
    div.innerHTML = `
      <div class="class-row-top">
        <div class="cc-dot"></div>
        <span class="cc-name" style="color:${p.text}">${cls.name}</span>
        <span class="cc-count">Samples: <b id="cnt-${cls.id}">${cls.embeddings.length}</b></span>
        ${store.classes.length > 2 ? `<button class="btn btn-xs btn-red" onclick="window.deleteClass(${cls.id})" style="margin-left:4px;">✕</button>` : ''}
      </div>
      <div class="class-row-btns">
        <button class="btn btn-xs btn-outline" id="addImgBtn-${cls.id}" onclick="window.addSampleFromImage(${cls.id})" disabled
          style="border-color:${p.border};color:${p.text}">🖼 Add Image</button>
        <button class="btn btn-xs btn-outline" id="collectBtn-${cls.id}" onclick="window.startCollection(${cls.id})" disabled
          style="border-color:${p.border};color:${p.text}">⏺ Webcam</button>
        <button class="btn btn-xs" onclick="window.clearClassSamples(${cls.id})"
          style="background:#f7fafc;border:1.5px solid #e2e8f0;color:#718096;">🗑</button>
      </div>
    `;
    classesWrap.appendChild(div);
    updateAddImgBtn(cls.id);
    updateCollectBtn(cls.id);
  });
  if (addClassBtn) addClassBtn.disabled = store.classes.length >= MAX_CLASSES;
}

export function updateAddImgBtn(id) {
  const preview = document.getElementById('preview');
  const btn = document.getElementById(`addImgBtn-${id}`);
  if (btn) btn.disabled = !(preview && preview.src && preview.naturalWidth > 0);
}

export function updateCollectBtn(id) {
  const btn = document.getElementById(`collectBtn-${id}`);
  if (btn) btn.disabled = !store.webcamReady;
}

export function updateAllButtons() {
  store.classes.forEach(c => { updateAddImgBtn(c.id); updateCollectBtn(c.id); });
}

export function renderPredBars() {
  const predBars = document.getElementById('predBars');
  if (!predBars) return;
  if (!store.classes.length) { predBars.innerHTML = '<div style="font-size:0.82rem;color:#a0aec0;">Train the model first, then predict here.</div>'; return; }
  predBars.innerHTML = '';
  store.classes.forEach(cls => {
    const p = cls.pal;
    const d = document.createElement('div');
    d.className = 'pred-row';
    d.innerHTML = `
      <div class="pred-hdr">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block;"></span>
          ${cls.name}
        </span>
        <span id="pct-${cls.id}" style="font-size:0.78rem;font-family:monospace;">—</span>
      </div>
      <div class="pred-track">
        <div class="pred-fill" id="bar-${cls.id}" style="background:${p.color};"></div>
      </div>`;
    predBars.appendChild(d);
  });
}

// ── Sample Addition Hooks ────────────────────────────────────────

let distTimer = null;
export function scheduleDistanceUpdate() {
  clearTimeout(distTimer);
  distTimer = setTimeout(updateDistancePanelWrap, 600);
}

export function addSampleFromImage(id) {
  const preview = document.getElementById('preview');
  if (!preview.src || !preview.naturalWidth) return setStatus('Upload an image first.', 'error');
  const cls = store.classes.find(c => c.id === id);
  if (!cls) return;
  setPipe('embed');
  const emb = extractEmbedding(preview);
  if (!emb) return;
  cls.embeddings.push(emb);
  cls.thumbs.push(captureThumbnail(preview));
  updateCountEl(id);
  updateStats();
  checkTrainReady();
  setStatus(`✅ Added to "${cls.name}" — ${cls.embeddings.length} sample${cls.embeddings.length > 1 ? 's' : ''}.`, 'ready');
  scheduleDistanceUpdate();
  scheduleQualityUpdate();
}
