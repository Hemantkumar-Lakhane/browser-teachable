import { store } from '../store.js';
import { setStatus } from '../utils.js';
import { addSampleFromImage, updateAllButtons } from './classes.js';
import { syncReplayButtons } from './replay.js';
let canvas;
let ctx;
let sourceImage;
let isDragging = false;
let dragStart = null;
let cropRect = null;
let brightness = 100;
let contrast = 100;
function getEls() {
  return {
    panel: document.getElementById('datasetStudio'),
    canvas: document.getElementById('datasetCanvas'),
    brightness: document.getElementById('editBrightness'),
    contrast: document.getElementById('editContrast'),
    brightnessVal: document.getElementById('brightnessVal'),
    contrastVal: document.getElementById('contrastVal'),
    applyCrop: document.getElementById('applyCropBtn'),
    reset: document.getElementById('resetEditBtn'),
    classSelect: document.getElementById('labelClassSelect'),
    add: document.getElementById('addEditedSampleBtn'),
    preview: document.getElementById('preview')
  };
}
function getPointer(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (evt.clientX - rect.left) * (canvas.width / rect.width))),
    y: Math.max(0, Math.min(canvas.height, (evt.clientY - rect.top) * (canvas.height / rect.height)))
  };
}
function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y)
  };
}
function draw() {
  if (!ctx || !sourceImage?.naturalWidth) return;
  const maxWidth = 760;
  const scale = Math.min(1, maxWidth / sourceImage.naturalWidth);
  canvas.width = Math.round(sourceImage.naturalWidth * scale);
  canvas.height = Math.round(sourceImage.naturalHeight * scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  if (!cropRect || cropRect.w < 6 || cropRect.h < 6) return;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.fillStyle = '#2563eb';
  [[cropRect.x, cropRect.y], [cropRect.x + cropRect.w, cropRect.y], [cropRect.x, cropRect.y + cropRect.h], [cropRect.x + cropRect.w, cropRect.y + cropRect.h]].forEach(([x, y]) => ctx.fillRect(x - 4, y - 4, 8, 8));
  ctx.restore();
}
function syncPreviewFromCanvas() {
  const {
    preview
  } = getEls();
  if (!preview) return;
  preview.src = canvas.toDataURL('image/jpeg', 0.92);
  preview.style.display = 'block';
  preview.onload = () => {
    updateAllButtons();
    syncReplayButtons();
  };
}
function applyCrop() {
  if (!cropRect || cropRect.w < 12 || cropRect.h < 12) {
    syncPreviewFromCanvas();
    return setStatus('No crop selected. Brightness/contrast edits applied to preview.', 'ready');
  }
  const out = document.createElement('canvas');
  out.width = Math.round(cropRect.w);
  out.height = Math.round(cropRect.h);
  const outCtx = out.getContext('2d');
  outCtx.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, out.width, out.height);
  sourceImage = new Image();
  sourceImage.onload = () => {
    cropRect = null;
    brightness = 100;
    contrast = 100;
    const els = getEls();
    els.brightness.value = brightness;
    els.contrast.value = contrast;
    els.brightnessVal.textContent = `${brightness}%`;
    els.contrastVal.textContent = `${contrast}%`;
    draw();
    syncPreviewFromCanvas();
    setStatus('Crop applied. Choose a class and add it as a labeled sample.', 'ready');
  };
  sourceImage.src = out.toDataURL('image/jpeg', 0.92);
}
export function refreshDatasetClassOptions() {
  const {
    classSelect,
    add
  } = getEls();
  if (!classSelect) return;
  const selected = classSelect.value;
  classSelect.setHTMLUnsafe('');
  store.classes.forEach(cls => {
    const option = document.createElement('option');
    option.value = String(cls.id);
    option.textContent = cls.name;
    classSelect.appendChild(option);
  });
  if (store.classes.some(cls => String(cls.id) === selected)) classSelect.value = selected;
  if (add) add.disabled = !sourceImage?.naturalWidth || !store.classes.length;
}
export function setDatasetStudioImage(src) {
  const els = getEls();
  if (!els.panel || !els.canvas) return;
  canvas = els.canvas;
  ctx = canvas.getContext('2d');
  sourceImage = new Image();
  sourceImage.onload = () => {
    brightness = 100;
    contrast = 100;
    cropRect = null;
    els.panel.style.display = 'block';
    els.brightness.value = brightness;
    els.contrast.value = contrast;
    els.brightnessVal.textContent = `${brightness}%`;
    els.contrastVal.textContent = `${contrast}%`;
    refreshDatasetClassOptions();
    draw();
  };
  sourceImage.src = src;
}
export function openDatasetStudio() {
  const els = getEls();
  if (!els.panel) return;
  els.panel.style.display = 'block';
  if (!sourceImage?.naturalWidth) {
    setStatus('Studio is open. Upload one image if you want crop/brightness editing.', 'ready');
  }
}
export function initDatasetStudio() {
  const els = getEls();
  if (!els.panel || !els.canvas) return;
  canvas = els.canvas;
  ctx = canvas.getContext('2d');
  els.brightness.addEventListener('input', e => {
    brightness = Number(e.target.value);
    els.brightnessVal.textContent = `${brightness}%`;
    draw();
    syncPreviewFromCanvas();
  });
  els.contrast.addEventListener('input', e => {
    contrast = Number(e.target.value);
    els.contrastVal.textContent = `${contrast}%`;
    draw();
    syncPreviewFromCanvas();
  });
  els.applyCrop.addEventListener('click', applyCrop);
  els.reset.addEventListener('click', () => {
    if (!sourceImage?.src) return;
    brightness = 100;
    contrast = 100;
    cropRect = null;
    els.brightness.value = brightness;
    els.contrast.value = contrast;
    els.brightnessVal.textContent = `${brightness}%`;
    els.contrastVal.textContent = `${contrast}%`;
    draw();
    syncPreviewFromCanvas();
  });
  els.add.addEventListener('click', () => {
    const id = Number(els.classSelect.value);
    if (!Number.isFinite(id)) return;
    syncPreviewFromCanvas();
    addSampleFromImage(id);
  });
  canvas.addEventListener('pointerdown', evt => {
    if (!sourceImage?.naturalWidth) return;
    isDragging = true;
    dragStart = getPointer(evt);
    cropRect = {
      x: dragStart.x,
      y: dragStart.y,
      w: 0,
      h: 0
    };
    canvas.setPointerCapture(evt.pointerId);
  });
  canvas.addEventListener('pointermove', evt => {
    if (!isDragging || !dragStart) return;
    cropRect = normalizeRect(dragStart, getPointer(evt));
    draw();
  });
  canvas.addEventListener('pointerup', evt => {
    isDragging = false;
    canvas.releasePointerCapture(evt.pointerId);
    if (cropRect && (cropRect.w < 12 || cropRect.h < 12)) cropRect = null;
    draw();
  });
  window.addEventListener('classes:updated', refreshDatasetClassOptions);
}