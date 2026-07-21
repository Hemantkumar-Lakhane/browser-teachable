import { store, MAX_CLASSES, MAX_SAMPLES_PER_CLASS, PALETTE } from '../store.js';
import { updateStats, checkTrainReady } from './dashboard.js';
import { updateDistancePanelWrap, scheduleQualityUpdate } from './dashboard.js';
import { extractEmbedding } from '../ml/dataset.js';
import { captureThumbnail } from './webcam.js';
import { setStatus, setPipe } from '../utils.js';
export function updateClassName(id, el) {
  const cls = store.classes.find(c => c.id === id);
  if (cls) {
    cls.name = el.textContent.trim() || 'Untitled Tier';
    renderPredBars();
  }
}
window.updateClassName = updateClassName;
function normalizeClassLabel(name) {
  return (name || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}
function findClassByName(name) {
  const key = normalizeClassLabel(name);
  return store.classes.find(cls => normalizeClassLabel(cls.name) === key) || null;
}
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not decode ${file.name}`));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
export function finalizeSampleUpdates(statusMsg) {
  updateStats();
  checkTrainReady();
  scheduleDistanceUpdate();
  scheduleQualityUpdate();
  if (statusMsg) setStatus(statusMsg, 'ready');
}
function ensureClass(name) {
  const existing = findClassByName(name);
  if (existing) return existing;
  return addNewClass(name);
}
function getDatasetClassName(file) {
  const rel = file.webkitRelativePath || file.datasetRelativePath || file.relativePath || '';
  if (!rel) return null;
  const parts = rel.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0];
  return parts[1];
}
function getFileIdentity(file) {
  return file.webkitRelativePath || file.datasetRelativePath || file.relativePath || file.name || '';
}
function selectRandomFiles(files, maxSamples) {
  const unique = [];
  const seen = new Set();
  files.forEach(file => {
    const id = getFileIdentity(file);
    if (!id || seen.has(id)) return;
    seen.add(id);
    unique.push(file);
  });
  if (!maxSamples || unique.length <= maxSamples) return unique;
  const shuffled = unique.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxSamples);
}
export function addNewClass(name) {
  if (store.classes.length >= MAX_CLASSES) return null;
  const id = store.nextClassId++;
  const pal = PALETTE[store.classes.length % PALETTE.length];
  const cls = {
    id,
    name: name || `Class ${String.fromCharCode(65 + store.classes.length)}`,
    embeddings: [],
    thumbs: [],
    isAugmented: [],
    // Parallel to thumbs
    pal
  };
  store.classes.push(cls);
  renderClasses();
  renderPredBars();
  updateStats();
  return cls;
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
  cls.isAugmented = [];
  updateCountEl(id);
  updateStats();
  checkTrainReady();
  updateDistancePanelWrap();
  scheduleQualityUpdate();
  finalizeSampleUpdates(`Cleared all samples for "${cls.name}".`);
}
export function updateCountEl(id) {
  const el = document.getElementById(`cnt-${id}`);
  const cls = store.classes.find(c => c.id === id);
  if (el && cls) el.textContent = cls.embeddings.length;
}
export function renderClasses() {
  const classesWrap = document.getElementById('classes-wrap');
  const addClassBtn = document.getElementById('addClassBtn');
  if (!classesWrap) return;
  classesWrap.setHTMLUnsafe('');
  // Render a compact, paginated view: show only a page of classes (6 per page)
  const PER_PAGE = 6;
  if (typeof window.__classesVisibleOffset === 'undefined') window.__classesVisibleOffset = 0;
  if (typeof window.__classesPerPage === 'undefined') window.__classesPerPage = PER_PAGE;
  const offset = window.__classesVisibleOffset || 0;
  const perPage = window.__classesPerPage || PER_PAGE;
  const toRender = store.classes.slice(offset, offset + perPage);
  toRender.forEach(cls => {
    const p = cls.pal;
    const div = document.createElement('div');
    div.className = 'class-row';
    div.style.cssText = `background:${p.bg};border-color:${p.border};--cc:${p.color}`;
    div.setHTMLUnsafe(`
      <div class="class-row-top">
        <div class="cc-dot"></div>
        <span class="cc-name" style="color:${p.text}" contenteditable="true" onblur="window.updateClassName(${cls.id}, this)">${cls.name}</span>
        <span class="cc-count">Samples: <b id="cnt-${cls.id}">${cls.embeddings.length}</b></span>
        ${store.classes.length > 2 ? `<button class="btn btn-xs btn-red" onclick="window.deleteClass(${cls.id})" style="margin-left:4px;">x</button>` : ''}
      </div>
      <div class="class-row-btns">
        <button class="btn btn-xs btn-outline" id="addImgBtn-${cls.id}" onclick="window.addSampleFromImage(${cls.id})" disabled
          style="border-color:${p.border};color:${p.text}">Add Image</button>
        <button class="btn btn-xs btn-outline" onclick="window.importClassFolder(${cls.id})"
          style="border-color:${p.border};color:${p.text}">Folder</button>
        <button class="btn btn-xs btn-outline" id="collectBtn-${cls.id}" onclick="window.startCollection(${cls.id})" disabled
          style="border-color:${p.border};color:${p.text}">Webcam</button>
        <button class="btn btn-xs" onclick="window.augmentClass(${cls.id})"
          style="background:#f7fafc;border:1.5px solid #e2e8f0;color:#8b5cf6;">✨ Augment</button>
        <button class="btn btn-xs" onclick="window.clearClassSamples(${cls.id})"
          style="background:#f7fafc;border:1.5px solid #e2e8f0;color:#718096;">Clear</button>
      </div>
    `);
    classesWrap.appendChild(div);
    updateAddImgBtn(cls.id);
    updateCollectBtn(cls.id);
  });
  // Pagination controls: previous, next, collapse
  const total = store.classes.length;
  const controls = document.createElement('div');
  controls.style.padding = '8px 4px; display:flex; gap:8px; align-items:center;';
  if (offset > 0) {
    const prev = document.createElement('button');
    prev.className = 'btn btn-sm';
    prev.textContent = `◀ Show previous ${perPage}`;
    prev.addEventListener('click', () => {
      window.__classesVisibleOffset = Math.max(0, offset - perPage);
      renderClasses();
    });
    controls.appendChild(prev);
  }
  if (offset + perPage < total) {
    const next = document.createElement('button');
    next.className = 'btn btn-sm';
    next.textContent = `Show next ${perPage} ▶`;
    next.addEventListener('click', () => {
      window.__classesVisibleOffset = offset + perPage;
      renderClasses();
    });
    controls.appendChild(next);
  }
  if (offset !== 0) {
    const less = document.createElement('button');
    less.className = 'btn btn-sm';
    less.textContent = 'Show first';
    less.addEventListener('click', () => {
      window.__classesVisibleOffset = 0;
      renderClasses();
    });
    controls.appendChild(less);
  }
  if (total > perPage) {
    const info = document.createElement('div');
    info.style.marginLeft = 'auto';
    info.style.color = '#64748b';
    info.style.fontSize = '0.85rem';
    info.textContent = `Showing ${Math.min(total, offset + 1)}–${Math.min(total, offset + perPage)} of ${total} classes`;
    controls.appendChild(info);
  }
  if (controls.children.length) classesWrap.appendChild(controls);
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
  store.classes.forEach(c => {
    updateAddImgBtn(c.id);
    updateCollectBtn(c.id);
  });
}
export function renderPredBars() {
  const predBars = document.getElementById('predBars');
  if (!predBars) return;
  if (!store.classes.length) {
    predBars.setHTMLUnsafe('<div style="font-size:0.82rem;color:#a0aec0;">Train the model first, then predict here.</div>');
    return;
  }
  predBars.setHTMLUnsafe('');
  // Paginated predictions list to match classes view
  const perPage = window.__classesPerPage || 6;
  const offset = window.__classesVisibleOffset || 0;
  const toRender = store.classes.slice(offset, offset + perPage);
  toRender.forEach(cls => {
    const p = cls.pal;
    const d = document.createElement('div');
    d.className = 'pred-row';
    d.setHTMLUnsafe(`
      <div class="pred-hdr">
        <span style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block;"></span>
          ${cls.name}
        </span>
        <span id="pct-${cls.id}" style="font-size:0.78rem;font-family:monospace;">-</span>
      </div>
      <div class="pred-track">
        <div class="pred-fill" id="bar-${cls.id}" style="background:${p.color};"></div>
      </div>`);
    predBars.appendChild(d);
  });
  if (store.classes.length > perPage) {
    const note = document.createElement('div');
    note.style.fontSize = '0.82rem';
    note.style.color = '#a0aec0';
    note.style.marginTop = '6px';
    note.textContent = `Showing ${Math.min(store.classes.length, offset + 1)}–${Math.min(store.classes.length, offset + perPage)} of ${store.classes.length} classes.`;
    predBars.appendChild(note);
  }
}
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
  cls.thumbs.push(preview.src);
  cls.isAugmented.push(false);
  updateCountEl(id);
  finalizeSampleUpdates(`Added to "${cls.name}" - ${cls.embeddings.length} sample${cls.embeddings.length > 1 ? 's' : ''}.`);
}
export async function addSamplesFromFiles(id, files, options = {}) {
  const cls = store.classes.find(c => c.id === id);
  if (!cls) return {
    added: 0,
    skipped: 0
  };
  let imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (!imageFiles.length) {
    setStatus(`No supported image files found for "${cls.name}".`, 'error');
    return {
      added: 0,
      skipped: Array.from(files).length
    };
  }
  let droppedByLimit = 0;
  let skipped = 0;
  if (options.maxSamples && imageFiles.length > options.maxSamples) {
    const originalCount = imageFiles.length;
    imageFiles = selectRandomFiles(imageFiles, options.maxSamples);
    droppedByLimit = originalCount - imageFiles.length;
    skipped += droppedByLimit;
    setStatus(`Selecting ${imageFiles.length} random images for "${cls.name}" from ${originalCount} available.`, 'ready');
  }
  setPipe('embed');
  let added = 0;
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    try {
      const img = await readImageFile(file);
      const emb = extractEmbedding(img);
      if (!emb) {
        skipped++;
        continue;
      }
      cls.embeddings.push(emb);
      cls.thumbs.push(img.src);
      cls.isAugmented.push(false);
      added++;
      if (added === 1 || added % 10 === 0 || i === imageFiles.length - 1) {
        updateCountEl(id);
        updateStats();
        setStatus(`Importing "${cls.name}" - ${i + 1}/${imageFiles.length}`, 'ready');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch {
      skipped++;
    }
  }
  updateCountEl(id);
  if (!options.skipFinalize) {
    finalizeSampleUpdates(`Imported ${added} image${added === 1 ? '' : 's'} into "${cls.name}"${skipped ? ` (${skipped} skipped)` : ''}.`);
  }
  return {
    added,
    skipped
  };
}
export async function importClassFolderFiles(id, files) {
  const cls = store.classes.find(c => c.id === id);
  if (!cls) return;
  const result = await addSamplesFromFiles(id, files, {
    maxSamples: MAX_SAMPLES_PER_CLASS
  });
  if (result.added > 0) renderClasses();
}
export async function importDatasetFromFolders(files) {
  const datasetFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (!datasetFiles.length) {
    return setStatus('No images found in the selected dataset folder.', 'error');
  }
  if (store.classes.length && store.classes.every(cls => cls.embeddings.length === 0)) {
    store.classes = [];
    store.nextClassId = 0;
  }
  const grouped = new Map();
  datasetFiles.forEach(file => {
    const className = getDatasetClassName(file);
    if (!className) return;
    if (!grouped.has(className)) grouped.set(className, []);
    grouped.get(className).push(file);
  });
  const classNames = Array.from(grouped.keys());

  // Remove default empty classes to prevent them from blocking training
  store.classes = store.classes.filter(c => !(c.embeddings.length === 0 && (c.name === 'Class A' || c.name === 'Class B')));
  const newClassNames = classNames.filter(name => !findClassByName(name));
  // Allow importing large numbers of classes. The UI will show a compact
  // preview (first 12) with a "Show more" toggle so the panel doesn't break.
  if (store.classes.length + newClassNames.length > MAX_CLASSES) {
    setStatus(`Warning: importing ${classNames.length} classes exceeds the configured limit (${MAX_CLASSES}). Import will proceed; use the Show more toggle to view extras.`, 'warning');
  }
  for (const name of newClassNames) ensureClass(name);
  renderClasses();
  let totalAdded = 0;
  let totalSkipped = 0;
  for (const [className, classFiles] of grouped.entries()) {
    const cls = ensureClass(className);
    if (!cls) continue;
    const filesToImport = selectRandomFiles(classFiles, MAX_SAMPLES_PER_CLASS);
    const droppedByLimit = classFiles.length - filesToImport.length;
    setStatus(`Importing dataset class "${cls.name}" (${filesToImport.length}/${classFiles.length} files selected)...`, 'ready');
    const result = await addSamplesFromFiles(cls.id, filesToImport, {
      skipFinalize: true
    });
    totalAdded += result.added;
    totalSkipped += result.skipped + droppedByLimit;
  }
  renderClasses();
  finalizeSampleUpdates(`Dataset import complete - ${totalAdded} image${totalAdded === 1 ? '' : 's'} added across ${grouped.size} class${grouped.size === 1 ? '' : 'es'}${totalSkipped ? ` (${totalSkipped} skipped)` : ''}.`);
}