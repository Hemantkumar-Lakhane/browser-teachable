const STEP_IDS = ['upload', 'label', 'train', 'predict'];
const TRANSITION_MS = 260;

const STEP_PANEL_IDS = {
  upload: ['uploadCard', 'webcamCard'],
  label: ['labelCard', 'dist-card', 'quality-card'],
  train: ['trainCard', 'charts-row'],
  predict: ['predictCard', 'timeline-card', 'inspector-card', 'replay-card', 'eval-card', 'arch-card']
};

let currentStep = 'upload';
let idleTimer = null;
let panelsReady = false;

function el(id) {
  return document.getElementById(id);
}

function stepEl(step) {
  return document.querySelector(`.workflow-step[data-step="${step}"]`);
}

function messageFor(step) {
  if (step === 'upload') return 'Collect images with upload, folders, ZIP imports, Kaggle, or webcam capture.';
  if (step === 'label') return 'Organize classes, review sample quality, and edit selected images.';
  if (step === 'train') return 'Tune the training setup, start training, and watch loss/accuracy.';
  return 'Test the trained model with predictions, replay, explainability, and evaluation.';
}

function clearHints() {
  document.querySelectorAll('.workflow-step').forEach(button => button.classList.remove('current-hint'));
}

function restartIdleHint() {
  if (idleTimer) clearTimeout(idleTimer);
  clearHints();
  idleTimer = setTimeout(() => {
    const target = stepEl(currentStep);
    if (target) target.classList.add('current-hint');
    const hint = el('workflowHint');
    if (hint) hint.textContent = `${messageFor(currentStep)} Pick another tab to switch workspace focus.`;
  }, 9000);
}

function panelIdsFor(step) {
  return STEP_PANEL_IDS[step] || [];
}

function getWorkflowPanels() {
  const ids = new Set(Object.values(STEP_PANEL_IDS).flat());
  return Array.from(ids)
    .map(id => el(id))
    .filter(Boolean);
}

function preparePanels() {
  getWorkflowPanels().forEach(panel => {
    panel.classList.add('workflow-panel');
    panel.dataset.workflowPanel = 'true';
    if (!panel.dataset.workflowHomeDisplay) {
      panel.dataset.workflowHomeDisplay = getComputedStyle(panel).display || '';
    }
  });
  panelsReady = true;
}

function setPanelVisible(panel, visible, immediate = false) {
  if (!panel) return;
  if (panel.__workflowHideTimer) {
    clearTimeout(panel.__workflowHideTimer);
    panel.__workflowHideTimer = null;
  }

  if (visible) {
    panel.hidden = false;
    panel.inert = false;
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      panel.classList.remove('is-workflow-hidden');
      panel.classList.add('is-workflow-active');
    });
    return;
  }

  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  panel.classList.remove('is-workflow-active');
  panel.classList.add('is-workflow-hidden');

  if (immediate) {
    panel.hidden = true;
    return;
  }

  panel.__workflowHideTimer = setTimeout(() => {
    if (panel.classList.contains('is-workflow-hidden')) panel.hidden = true;
  }, TRANSITION_MS);
}

function syncColumnVisibility() {
  const main = document.querySelector('main');
  const leftCol = document.querySelector('.left-col');
  const rightCol = document.querySelector('.right-col');
  const activeIds = new Set(panelIdsFor(currentStep));

  if (main) main.dataset.workflowStep = currentStep;

  [leftCol, rightCol].forEach(column => {
    if (!column) return;
    const hasStepPanel = Array.from(column.children).some(child => activeIds.has(child.id));
    column.classList.toggle('workflow-column-empty', !hasStepPanel);
  });

  const visibleColumns = [leftCol, rightCol].filter(column => column && !column.classList.contains('workflow-column-empty'));
  if (main) main.classList.toggle('workflow-one-column', visibleColumns.length === 1);
}

function applyPanelVisibility(immediate = false) {
  if (!panelsReady) preparePanels();
  const activeIds = new Set(panelIdsFor(currentStep));
  getWorkflowPanels().forEach(panel => {
    setPanelVisible(panel, activeIds.has(panel.id), immediate);
  });
  syncColumnVisibility();
  document.dispatchEvent(new CustomEvent('workflow:stepchange', { detail: { step: currentStep } }));
}

function renderWorkflow() {
  STEP_IDS.forEach((step, idx) => {
    const btn = stepEl(step);
    if (!btn) return;
    btn.classList.remove('active', 'done');
    const currIndex = STEP_IDS.indexOf(currentStep);
    if (idx < currIndex) btn.classList.add('done');
    if (idx === currIndex) btn.classList.add('active');
  });
  const hint = el('workflowHint');
  if (hint) hint.textContent = messageFor(currentStep);
  applyPanelVisibility();
  restartIdleHint();
}

export function refreshWorkflowStep(step) {
  if (step && STEP_IDS.includes(step)) currentStep = step;
  renderWorkflow();
}

export function setupGuidedWorkflow() {
  preparePanels();
  document.querySelectorAll('.workflow-step').forEach(button => {
    button.addEventListener('click', () => {
      const step = button.getAttribute('data-step');
      currentStep = step;
      renderWorkflow();
    });
  });

  ['click', 'keydown', 'pointerdown'].forEach(name =>
    document.addEventListener(name, () => restartIdleHint(), { passive: true })
  );

  currentStep = 'upload';
  renderWorkflow();
  applyPanelVisibility(true);
}
