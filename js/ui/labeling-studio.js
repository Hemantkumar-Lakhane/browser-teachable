import { store } from '../store.js';
import { extractEmbedding } from '../ml/dataset.js';
import { runAutoAugment } from '../ml/augment.js';
let labelingState = {
  allImages: [],
  currentImageIndex: 0,
  cropRect: null,
  isDragging: false,
  dragStart: null,
  hasUnsavedChanges: false,
  zoomLevel: 100,
  filterClassId: ''
};
const labelingModal = document.getElementById('labelingStudioModal');
const closeLabelingBtn = document.getElementById('closeLabelingBtn');
const labelingGrid = document.getElementById('labelingGrid');
const labelingEditCanvas = document.getElementById('labelingEditCanvas');
const labelBrightnessSlider = document.getElementById('labelBrightnessSlider');
const labelContrastSlider = document.getElementById('labelContrastSlider');
const labelSaturationSlider = document.getElementById('labelSaturationSlider');
const labelingClassSelect = document.getElementById('labelingClassSelect');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLabel = document.getElementById('zoomLabel');
const canvasScaleWrapper = document.getElementById('canvasScaleWrapper');
const labelSearchInput = document.getElementById('labelSearchInput');
const labelClassFilterSelect = document.getElementById('labelClassFilterSelect');
const saveLabeledImageBtn = document.getElementById('saveLabeledImageBtn');
const resetEditorsBtn = document.getElementById('resetEditorsBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const applyCropRegionBtn = document.getElementById('applyCropRegionBtn');
const filterGrayscaleSlider = document.getElementById('filterGrayscaleSlider');
const filterBlurSlider = document.getElementById('filterBlurSlider');
const filterInvertSlider = document.getElementById('filterInvertSlider');

// New UI buttons
const skipImageBtn = document.getElementById('skipImageBtn');
const deleteImageBtn = document.getElementById('deleteImageBtn');
const saveAsCopyBtn = document.getElementById('saveAsCopyBtn');
const augmentSelectedBtn = document.getElementById('augmentSelectedBtn');
let currentTransforms = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  filters: {
    grayscale: 0,
    blur: 0,
    invert: 0
  }
};
let currentOriginalImage = new Image();
function markUnsaved() {
  labelingState.hasUnsavedChanges = true;
}
function setZoom(level) {
  labelingState.zoomLevel = Math.max(50, Math.min(level, 500));
  if (zoomLabel) zoomLabel.textContent = labelingState.zoomLevel + '%';
  if (canvasScaleWrapper) canvasScaleWrapper.style.transform = `scale(${labelingState.zoomLevel / 100})`;
}
export function openLabelingModal() {
  if (!labelingModal) return;

  // Attach listeners if not attached yet
  if (!labelingModal.dataset.initialized) {
    closeLabelingBtn?.addEventListener('click', () => {
      if (labelingState.hasUnsavedChanges && !confirm("You have unsaved changes. Close anyway?")) return;
      labelingModal.style.display = 'none';
    });
    const inputs = [labelBrightnessSlider, labelContrastSlider, labelSaturationSlider, filterGrayscaleSlider, filterBlurSlider, filterInvertSlider];
    inputs.forEach(input => {
      input?.addEventListener('input', () => {
        markUnsaved();
        updateCanvasDisplay();
      });
    });
    resetEditorsBtn?.addEventListener('click', resetTransforms);
    rotateLeftBtn?.addEventListener('click', () => {
      markUnsaved();
      currentTransforms.rotation -= 90;
      updateCanvasDisplay();
    });
    rotateRightBtn?.addEventListener('click', () => {
      markUnsaved();
      currentTransforms.rotation += 90;
      updateCanvasDisplay();
    });
    saveLabeledImageBtn?.addEventListener('click', saveCurrentImage);
    saveAsCopyBtn?.addEventListener('click', saveAsCopy);
    skipImageBtn?.addEventListener('click', skipImage);
    deleteImageBtn?.addEventListener('click', deleteCurrentImage);
    const augmentReviewBox = document.getElementById('augmentReviewBox');
    const augmentReviewGrid = document.getElementById('augmentReviewGrid');
    const acceptAugmentsBtn = document.getElementById('acceptAugmentsBtn');
    const cancelAugmentsBtn = document.getElementById('cancelAugmentsBtn');
    let pendingAugments = []; // Array of DataURLs

    augmentSelectedBtn?.addEventListener('click', async () => {
      if (!currentOriginalImage || !currentOriginalImage.complete) return;
      augmentSelectedBtn.disabled = true;
      augmentSelectedBtn.textContent = '⏳ Generating...';
      pendingAugments = (await import('../ml/augment.js')).generateAugmentedVariants(currentOriginalImage);
      augmentReviewGrid.setHTMLUnsafe('');
      pendingAugments.forEach((dataUrl, idx) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.height = '60px';
        img.style.borderRadius = '4px';
        img.style.cursor = 'pointer';
        img.style.border = '2px solid transparent';
        img.title = 'Click to preview on canvas';
        img.onclick = () => {
          Array.from(augmentReviewGrid.children).forEach(c => c.firstChild.style.borderColor = 'transparent');
          img.style.borderColor = '#8b5cf6';
          const previewImg = new Image();
          previewImg.onload = () => {
            labelingEditCanvas.width = previewImg.naturalWidth;
            labelingEditCanvas.height = previewImg.naturalHeight;
            labelingEditCanvas.getContext('2d').drawImage(previewImg, 0, 0);
          };
          previewImg.src = dataUrl;
        };
        const delBtn = document.createElement('button');
        delBtn.setHTMLUnsafe('✕');
        delBtn.style.position = 'absolute';
        delBtn.style.top = '-6px';
        delBtn.style.right = '-6px';
        delBtn.style.background = '#ef4444';
        delBtn.style.color = 'white';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '50%';
        delBtn.style.width = '18px';
        delBtn.style.height = '18px';
        delBtn.style.fontSize = '10px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.lineHeight = '1';
        delBtn.style.padding = '0';
        delBtn.title = 'Discard this variant';
        delBtn.onclick = e => {
          e.stopPropagation();
          pendingAugments = pendingAugments.filter(url => url !== dataUrl);
          wrapper.remove();
          if (pendingAugments.length === 0) {
            augmentReviewBox.style.display = 'none';
            augmentSelectedBtn.disabled = false;
            augmentSelectedBtn.textContent = '✨ Auto-Augment Selected Image';
            updateCanvasDisplay(); // Restore original
          }
        };
        wrapper.appendChild(img);
        wrapper.appendChild(delBtn);
        augmentReviewGrid.appendChild(wrapper);
      });
      augmentReviewBox.style.display = 'block';
    });
    acceptAugmentsBtn?.addEventListener('click', async () => {
      const current = labelingState.allImages[labelingState.currentImageIndex];
      if (!current) return;
      const cls = store.classes.find(c => c.id === current.classId);
      if (!cls) return;
      acceptAugmentsBtn.disabled = true;
      acceptAugmentsBtn.textContent = '⏳ Saving...';
      for (const dataUrl of pendingAugments) {
        const img = new Image();
        await new Promise(r => {
          img.onload = r;
          img.src = dataUrl;
        });
        const emb = extractEmbedding(img);
        if (emb) {
          cls.embeddings.push(emb);
          cls.thumbs.push(dataUrl);
          cls.isAugmented.push(true);
        }
      }

      // Clean up
      pendingAugments = [];
      augmentReviewBox.style.display = 'none';
      augmentSelectedBtn.disabled = false;
      augmentSelectedBtn.textContent = '✨ Auto-Augment Selected Image';
      acceptAugmentsBtn.disabled = false;
      acceptAugmentsBtn.textContent = '✅ Accept All';
      populateLabelingGrid(); // Refresh grid
      const {
        updateCountEl,
        updateStats,
        checkTrainReady
      } = await import('./classes.js');
      updateCountEl(current.classId);
      updateStats();
      checkTrainReady();
    });
    cancelAugmentsBtn?.addEventListener('click', () => {
      pendingAugments = [];
      augmentReviewBox.style.display = 'none';
      augmentSelectedBtn.disabled = false;
      augmentSelectedBtn.textContent = '✨ Auto-Augment Selected Image';
      updateCanvasDisplay();
    });
    labelingEditCanvas?.addEventListener('mousedown', startCrop);
    labelingEditCanvas?.addEventListener('mousemove', drawCropRect);
    labelingEditCanvas?.addEventListener('mouseup', endCrop);
    applyCropRegionBtn?.addEventListener('click', applyCrop);
    labelingClassSelect?.addEventListener('change', markUnsaved);
    zoomInBtn?.addEventListener('click', () => setZoom(labelingState.zoomLevel + 25));
    zoomOutBtn?.addEventListener('click', () => setZoom(labelingState.zoomLevel - 25));
    labelClassFilterSelect?.addEventListener('change', e => {
      labelingState.filterClassId = e.target.value;
      renderGrid();
    });
    labelSearchInput?.addEventListener('input', () => {
      renderGrid();
    });
    labelingModal.dataset.initialized = "true";
  }
  labelingState.hasUnsavedChanges = false;
  labelingModal.style.display = 'flex';
  setZoom(100); // Default zoom level
  populateLabelingGrid();
}
function populateLabelingGrid() {
  labelingState.allImages = [];
  if (labelClassFilterSelect) {
    const currentFilter = labelClassFilterSelect.value;
    labelClassFilterSelect.setHTMLUnsafe('<option value="">All Classes</option>');
    store.classes.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name;
      if (currentFilter == cls.id) opt.selected = true;
      labelClassFilterSelect.appendChild(opt);
    });
    labelingState.filterClassId = labelClassFilterSelect.value;
  }
  store.classes.forEach((cls, classIndex) => {
    cls.thumbs.forEach((thumb, thumbIndex) => {
      labelingState.allImages.push({
        classId: cls.id,
        classIndex: classIndex,
        thumbIndex: thumbIndex,
        dataUrl: thumb,
        className: cls.name
      });
    });
  });
  renderGrid();
  if (labelingState.allImages.length > 0) {
    labelingState.currentImageIndex = Math.min(labelingState.currentImageIndex, labelingState.allImages.length - 1);
    loadImageInEditor(labelingState.allImages[labelingState.currentImageIndex]);
  } else {
    const canvas = labelingEditCanvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    document.getElementById('selectedImageName').textContent = 'No images';
    document.getElementById('selectedImageInfo').textContent = '';
    if (saveLabeledImageBtn) saveLabeledImageBtn.disabled = true;
  }
}
function renderGrid() {
  if (!labelingGrid) return;
  labelingGrid.setHTMLUnsafe('');
  const searchQuery = labelSearchInput ? labelSearchInput.value.toLowerCase() : '';
  let filteredImages = labelingState.allImages.filter(img => {
    if (labelingState.filterClassId !== '' && img.classId != labelingState.filterClassId) return false;
    if (searchQuery && !img.className.toLowerCase().includes(searchQuery)) return false;
    return true;
  });
  if (filteredImages.length === 0) {
    labelingGrid.setHTMLUnsafe('<div style="grid-column:1/-1; text-align:center; color:#a0aec0; padding:40px;">No images found.</div>');
    return;
  }

  // Group by class
  const grouped = {};
  filteredImages.forEach(imgData => {
    if (!grouped[imgData.className]) grouped[imgData.className] = [];
    grouped[imgData.className].push(imgData);
  });
  for (const [className, images] of Object.entries(grouped)) {
    // Render Group Header
    const header = document.createElement('div');
    header.style.width = '100%';
    header.style.padding = '10px 4px 4px 4px';
    header.style.fontSize = '0.85rem';
    header.style.fontWeight = 'bold';
    header.style.color = '#475569';
    header.style.borderBottom = '1px solid #e2e8f0';
    header.textContent = className;
    labelingGrid.appendChild(header);

    // Render Images
    images.forEach(imgData => {
      const idx = labelingState.allImages.indexOf(imgData);
      const item = document.createElement('div');
      item.className = 'grid-item' + (idx === labelingState.currentImageIndex ? ' active' : '');
      item.setHTMLUnsafe(`
            <img src="${imgData.dataUrl}" alt="Sample ${idx}"/>
            <div class="grid-item-label">${imgData.className}</div>
          `);
      item.addEventListener('click', () => {
        if (labelingState.hasUnsavedChanges && idx !== labelingState.currentImageIndex) {
          if (!confirm("You have unsaved changes. Discard them?")) return;
        }
        labelingState.currentImageIndex = idx;
        renderGrid(); // update active class
        loadImageInEditor(imgData);
      });
      labelingGrid.appendChild(item);
    });
  }
}
function loadImageInEditor(imgData) {
  labelingState.hasUnsavedChanges = false;
  currentOriginalImage = new Image();
  currentOriginalImage.onload = () => {
    resetTransforms();
  };
  currentOriginalImage.src = imgData.dataUrl;
  document.getElementById('selectedImageName').textContent = `📸 ${imgData.className}`;

  // Setup class selector
  if (labelingClassSelect) {
    labelingClassSelect.setHTMLUnsafe('');
    store.classes.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name;
      if (cls.id === imgData.classId) opt.selected = true;
      labelingClassSelect.appendChild(opt);
    });
  }
  if (saveLabeledImageBtn) saveLabeledImageBtn.disabled = false;
}
function resetTransforms() {
  currentTransforms = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    rotation: 0,
    filters: {
      grayscale: 0,
      blur: 0,
      invert: 0
    }
  };
  if (labelBrightnessSlider) labelBrightnessSlider.value = 100;
  if (labelContrastSlider) labelContrastSlider.value = 100;
  if (labelSaturationSlider) labelSaturationSlider.value = 100;
  if (filterGrayscaleSlider) filterGrayscaleSlider.value = 0;
  if (filterBlurSlider) filterBlurSlider.value = 0;
  if (filterInvertSlider) filterInvertSlider.value = 0;
  labelingState.cropRect = null;
  labelingState.hasUnsavedChanges = false;
  updateCanvasDisplay();
}
let renderTimer = null;
function updateCanvasDisplay() {
  if (!renderTimer) {
    renderTimer = requestAnimationFrame(() => {
      renderTimer = null;
      renderCanvas();
    });
  }
}
function renderCanvas() {
  if (!labelingEditCanvas || !currentOriginalImage.src) return;
  const brightness = labelBrightnessSlider ? parseInt(labelBrightnessSlider.value) : 100;
  const contrast = labelContrastSlider ? parseInt(labelContrastSlider.value) : 100;
  const saturation = labelSaturationSlider ? parseInt(labelSaturationSlider.value) : 100;
  const grayscale = document.getElementById('filterGrayscaleSlider') ? parseInt(document.getElementById('filterGrayscaleSlider').value) : 0;
  const blur = document.getElementById('filterBlurSlider') ? parseInt(document.getElementById('filterBlurSlider').value) : 0;
  const invert = document.getElementById('filterInvertSlider') ? parseInt(document.getElementById('filterInvertSlider').value) : 0;
  currentTransforms.brightness = brightness;
  currentTransforms.contrast = contrast;
  currentTransforms.saturation = saturation;
  currentTransforms.filters.grayscale = grayscale;
  currentTransforms.filters.blur = blur;
  currentTransforms.filters.invert = invert;
  if (document.getElementById('labelBrightnessVal')) document.getElementById('labelBrightnessVal').textContent = brightness + '%';
  if (document.getElementById('labelContrastVal')) document.getElementById('labelContrastVal').textContent = contrast + '%';
  if (document.getElementById('labelSaturationVal')) document.getElementById('labelSaturationVal').textContent = saturation + '%';
  if (document.getElementById('filterGrayscaleVal')) document.getElementById('filterGrayscaleVal').textContent = grayscale + '%';
  if (document.getElementById('filterBlurVal')) document.getElementById('filterBlurVal').textContent = blur + 'px';
  if (document.getElementById('filterInvertVal')) document.getElementById('filterInvertVal').textContent = invert + '%';
  const ctx = labelingEditCanvas.getContext('2d');

  // Calculate new dimensions based on rotation
  const isRotated = Math.abs(currentTransforms.rotation % 180) === 90;
  labelingEditCanvas.width = isRotated ? currentOriginalImage.height : currentOriginalImage.width;
  labelingEditCanvas.height = isRotated ? currentOriginalImage.width : currentOriginalImage.height;
  if (document.getElementById('selectedImageInfo')) {
    document.getElementById('selectedImageInfo').textContent = `${labelingEditCanvas.width}×${labelingEditCanvas.height}px`;
  }
  ctx.clearRect(0, 0, labelingEditCanvas.width, labelingEditCanvas.height);
  ctx.save();

  // Apply filters
  let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  if (grayscale > 0) filterString += ` grayscale(${grayscale}%)`;
  if (blur > 0) filterString += ` blur(${blur}px)`;
  if (invert > 0) filterString += ` invert(${invert}%)`;
  ctx.filter = filterString;

  // Transform
  ctx.translate(labelingEditCanvas.width / 2, labelingEditCanvas.height / 2);
  ctx.rotate(currentTransforms.rotation * Math.PI / 180);
  ctx.drawImage(currentOriginalImage, -currentOriginalImage.width / 2, -currentOriginalImage.height / 2);
  ctx.restore();

  // Draw crop rect if any
  if (labelingState.cropRect) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const cr = labelingState.cropRect;
    ctx.fillRect(0, 0, labelingEditCanvas.width, cr.y);
    ctx.fillRect(0, cr.y, cr.x, cr.h);
    ctx.fillRect(cr.x + cr.w, cr.y, labelingEditCanvas.width - cr.x - cr.w, cr.h);
    ctx.fillRect(0, cr.y + cr.h, labelingEditCanvas.width, labelingEditCanvas.height - cr.y - cr.h);
    ctx.strokeStyle = 'white';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
  }
}

// Crop Logic
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}
function startCrop(e) {
  labelingState.isDragging = true;
  labelingState.dragStart = getMousePos(labelingEditCanvas, e);
  labelingState.cropRect = null;
}
function drawCropRect(e) {
  if (!labelingState.isDragging) return;
  const currentPos = getMousePos(labelingEditCanvas, e);
  const x = Math.min(labelingState.dragStart.x, currentPos.x);
  const y = Math.min(labelingState.dragStart.y, currentPos.y);
  const w = Math.abs(labelingState.dragStart.x - currentPos.x);
  const h = Math.abs(labelingState.dragStart.y - currentPos.y);
  labelingState.cropRect = {
    x,
    y,
    w,
    h
  };
  updateCanvasDisplay();
}
function endCrop(e) {
  labelingState.isDragging = false;
  if (labelingState.cropRect && (labelingState.cropRect.w < 10 || labelingState.cropRect.h < 10)) {
    labelingState.cropRect = null;
    updateCanvasDisplay();
  }
}
function applyCrop() {
  if (!labelingState.cropRect) return;
  markUnsaved();
  const cr = labelingState.cropRect;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cr.w;
  tempCanvas.height = cr.h;
  const tCtx = tempCanvas.getContext('2d');

  // Make sure we have the latest filter state
  renderCanvas();
  tCtx.drawImage(labelingEditCanvas, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);
  currentOriginalImage = new Image();
  currentOriginalImage.onload = () => {
    labelingState.cropRect = null;
    // Keep current brightness/contrast but reset rotation and filters since we baked them in
    currentTransforms.rotation = 0;
    currentTransforms.filters = {
      grayscale: false,
      blur: false,
      sharpen: false,
      invert: false
    };
    if (labelBrightnessSlider) labelBrightnessSlider.value = 100;
    if (labelContrastSlider) labelContrastSlider.value = 100;
    if (labelSaturationSlider) labelSaturationSlider.value = 100;
    updateCanvasDisplay();
  };
  currentOriginalImage.src = tempCanvas.toDataURL('image/jpeg', 0.92);
}
function saveCurrentImage() {
  const imgData = labelingState.allImages[labelingState.currentImageIndex];
  if (!imgData) return;
  labelingState.cropRect = null;
  renderCanvas();
  const finalDataUrl = labelingEditCanvas.toDataURL('image/jpeg', 0.92);
  const oldClassId = imgData.classId;
  const newClassId = parseInt(labelingClassSelect.value);

  // Update in store
  const sourceClass = store.classes[imgData.classIndex];
  const targetClass = store.classes.find(c => c.id === newClassId);

  // Extract new embedding from the preprocessed canvas
  const newEmb = extractEmbedding(labelingEditCanvas);
  if (oldClassId === newClassId) {
    sourceClass.thumbs[imgData.thumbIndex] = finalDataUrl;
    const oldEmb = sourceClass.embeddings[imgData.thumbIndex];
    if (oldEmb) oldEmb.dispose();
    if (newEmb) sourceClass.embeddings[imgData.thumbIndex] = newEmb;
  } else {
    // Move image: remove from old class, add to new class.
    const oldEmb = sourceClass.embeddings.splice(imgData.thumbIndex, 1)[0];
    if (oldEmb) oldEmb.dispose();
    sourceClass.thumbs.splice(imgData.thumbIndex, 1);
    if (targetClass) {
      if (newEmb) targetClass.embeddings.push(newEmb);
      targetClass.thumbs.push(finalDataUrl);
    }
  }

  // Trigger UI updates for class counts
  import('./classes.js').then(module => {
    if (module.updateCountEl) {
      module.updateCountEl(oldClassId);
      if (oldClassId !== newClassId) module.updateCountEl(newClassId);
    }
    if (module.renderClasses) module.renderClasses();
  });
  labelingState.hasUnsavedChanges = false;

  // Advance to next
  skipImage();
}
async function saveAsCopy() {
  if (!labelingEditCanvas || !currentOriginalImage.src) return;
  const imgData = labelingState.allImages[labelingState.currentImageIndex];
  if (!imgData) return;
  saveLabeledImageBtn.disabled = true;
  saveAsCopyBtn.disabled = true;

  // Reset crop rect temporarily to get full canvas correctly mapped
  labelingState.cropRect = null;
  renderCanvas();
  const finalDataUrl = labelingEditCanvas.toDataURL('image/jpeg', 0.92);
  const newClassId = parseInt(labelingClassSelect.value);
  const targetClass = store.classes.find(c => c.id === newClassId);

  // Extract new embedding
  const newEmb = extractEmbedding(labelingEditCanvas);
  if (targetClass) {
    if (newEmb) targetClass.embeddings.push(newEmb);
    targetClass.thumbs.push(finalDataUrl);
  }

  // Trigger UI updates
  import('./classes.js').then(module => {
    if (module.updateCountEl) module.updateCountEl(newClassId);
    if (module.renderClasses) module.renderClasses();
  });
  labelingState.hasUnsavedChanges = false;

  // Refresh grid and stay roughly at the next image
  skipImage();
}
function skipImage() {
  if (labelingState.hasUnsavedChanges && !confirm("You have unsaved changes. Skip anyway?")) return;

  // Re-populate from store in case we moved things around
  const oldIdx = labelingState.currentImageIndex;
  populateLabelingGrid();

  // Move forward if we can, staying roughly where we were if we didn't hit the end
  labelingState.currentImageIndex = Math.min(oldIdx + 1, labelingState.allImages.length - 1);

  // If we were at the end, populateLabelingGrid() reset to min(idx, length-1). But let's check if we hit the end
  if (oldIdx >= labelingState.allImages.length - 1) {
    // We were at the last image
    if (labelingState.allImages.length > 0) {
      // just loop to start or stay at end? Let's stay at end
      renderGrid();
      loadImageInEditor(labelingState.allImages[labelingState.currentImageIndex]);
      alert('✅ Reached the end of the image list!');
    }
  } else {
    renderGrid();
    loadImageInEditor(labelingState.allImages[labelingState.currentImageIndex]);
  }
}
function deleteCurrentImage() {
  const imgData = labelingState.allImages[labelingState.currentImageIndex];
  if (!imgData) return;
  if (!confirm("Are you sure you want to delete this image?")) return;
  const sourceClass = store.classes[imgData.classIndex];
  if (sourceClass) {
    const emb = sourceClass.embeddings.splice(imgData.thumbIndex, 1)[0];
    if (emb) emb.dispose(); // clean up tensor
    sourceClass.thumbs.splice(imgData.thumbIndex, 1);
  }
  labelingState.hasUnsavedChanges = false;

  // Keep index the same, re-populate handles out of bounds
  populateLabelingGrid();

  // Trigger UI updates
  import('./classes.js').then(module => {
    if (module.updateCountEl && sourceClass) module.updateCountEl(sourceClass.id);
    if (module.renderClasses) module.renderClasses();
  });
}