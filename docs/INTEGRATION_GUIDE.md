# Integration Guide: Workflow Engine with Existing ML Code

This guide shows how to connect the new workflow UI with your existing ML training, prediction, and data handling code.

```javascript
import { workflowEngine } from './js/ui/workflow-engine.js';

// ── 2. CONNECT STEP 1 (Create Project) ────────────────────────────

// Listen for step 1 completion
document.getElementById('step1-next')?.addEventListener('click', () => {
const projectName = document.getElementById('projectName').value;
const modelType = document.getElementById('modelType').value;

// Save project settings
store.projectName = projectName;
store.modelType = modelType;

// Mark step complete and advance
workflowEngine.completeStep(1);
workflowEngine.goToStep(2);
});

// ── 3. CONNECT STEP 2 (Add Classes) ───────────────────────────────

// Use existing addNewClass function
document.getElementById('addClassButton')?.addEventListener('click', () => {
// Call your existing class addition logic
addNewClass();
});

// Update step 2 status when classes change
function updateStep2Status() {
const classCount = store.classes.length;
const badge = document.getElementById('step2-status');
if (badge) {
badge.textContent = `${classCount} ${classCount === 1 ? 'Class' : 'Classes'}`;
}

// Enable next button when at least 2 classes exist
const nextBtn = document.getElementById('step2-next');
if (nextBtn) {
nextBtn.disabled = classCount < 2;
}
}

// Call whenever classes change
store.onClassesChange = updateStep2Status;

// ── 4. CONNECT STEP 3 (Upload Dataset) ─────────────────────────

// Use existing upload handlers
const uploadArea = document.getElementById('uploadArea');
uploadArea?.addEventListener('drop', async (e) => {
e.preventDefault();
const files = e.dataTransfer.files;

// Use your existing file processing
for (let file of files) {
if (file.type.startsWith('image/')) {
await addSampleFromImage(file);
}
}

updateStep3Status();
});

// Update step 3 status
function updateStep3Status() {
const totalSamples = store.classes.reduce((sum, c) => sum + c.samples.length, 0);
const badge = document.getElementById('step3-status');
if (badge) {
badge.textContent = `${totalSamples} ${totalSamples === 1 ? 'Sample' : 'Samples'}`;
}

// Enable next when we have samples from all classes
const nextBtn = document.getElementById('step3-next');
if (nextBtn) {
const hasDataAllClasses = store.classes.every(c => c.samples.length > 0);
nextBtn.disabled = !hasDataAllClasses;
}
}

store.onSamplesChange = updateStep3Status;

// ── 5. CONNECT STEP 4 (Configure Training) ─────────────────────

// Read configuration values
function getTrainingConfig() {
return {
epochs: parseInt(document.getElementById('epochsInput').value) || 25,
batchSize: parseInt(document.getElementById('batchSizeInput').value) || 16,
learningRate: parseFloat(document.getElementById('learningRateInput').value) || 0.0005,
hiddenUnits: parseInt(document.getElementById('hiddenUnitsInput').value) || 128,
optimizer: document.getElementById('optimizerSelect').value || 'adam',
dropout: parseFloat(document.getElementById('dropoutInput').value) || 0.3,
};
}

// Update training stats
function updateTrainingStats() {
const totalSamples = store.classes.reduce((sum, c) => sum + c.samples.length, 0);
const classCount = store.classes.length;

document.getElementById('statSamples').textContent = totalSamples;
document.getElementById('statClasses').textContent = classCount;

// Estimate training time (rough estimate)
const epochs = parseInt(document.getElementById('epochsInput').value) || 25;
const estimatedSeconds = (totalSamples / 16) _ epochs _ 0.01; // ~10ms per batch
const minutes = Math.ceil(estimatedSeconds / 60);
document.getElementById('statTime').textContent = `~${minutes}m`;
}

// ── 6. CONNECT STEP 5 (Train Model) ───────────────────────────

document.getElementById('trainBtn')?.addEventListener('click', async () => {
const config = getTrainingConfig();

// Show training progress section
document.getElementById('training-progress-section').style.display = 'block';
document.getElementById('step5-status').textContent = 'Training...';

try {
// Call your existing training function
const result = await trainModel(config, {
onProgress: (progress) => {
// Update progress bar
const progressBar = document.getElementById('trainingProgressBar');
const percent = Math.round(progress.percent);
if (progressBar) {
progressBar.style.width = percent + '%';
document.getElementById('trainingPercent').textContent = percent + '%';
}

        // Update log
        const log = document.getElementById('trainLog');
        if (log) {
          log.innerHTML += `<div>Epoch ${progress.epoch}/${progress.epochs} - Loss: ${progress.loss.toFixed(4)}, Acc: ${progress.accuracy.toFixed(4)}</div>`;
          log.scrollTop = log.scrollHeight;
        }
      }
    });

    // Training complete
    document.getElementById('step5-status').textContent = 'Training Complete ✓';
    document.getElementById('step5-next').disabled = false;

} catch (error) {
console.error('Training error:', error);
document.getElementById('step5-status').textContent = 'Training Failed';
}
});

// ── 7. CONNECT STEP 6 (Test Predictions) ──────────────────────

// Handle webcam live predictions
document.getElementById('startLiveBtn')?.addEventListener('click', () => {
// Use your existing startCollection or startWebcam logic
startWebcam();
startLivePredictions();
});

document.getElementById('stopLiveBtn')?.addEventListener('click', () => {
// Stop live predictions
stopLivePredictions();
});

// Show predictions
function displayPrediction(predictions) {
const container = document.getElementById('predictionResults');
if (!container) return;

container.innerHTML = '';

predictions.forEach((pred, i) => {
const row = document.createElement('div');
row.className = 'pred-row';
row.innerHTML = `       <div class="pred-hdr">
        <span>${pred.class}</span>
        <span>${(pred.confidence * 100).toFixed(1)}%</span>
      </div>
      <div class="pred-track">
        <div class="pred-fill" style="width: ${pred.confidence * 100}%"></div>
      </div>
    `;
container.appendChild(row);
});

document.getElementById('predictionDisplay').style.display = 'block';
}

// ── 8. CONNECT STEP 7 (Export & Deploy) ────────────────────────

document.getElementById('exportBtn')?.addEventListener('click', async () => {
// Use your existing exportModel function
await exportModel();
});

document.getElementById('generateLinkBtn')?.addEventListener('click', async () => {
// Use your existing link generation
const link = await generateCustomerLink();

const output = document.getElementById('linkOutput');
if (output) {
output.textContent = link;
output.style.display = 'block';
}
});

// ── 9. CONNECT DATASET STUDIO ────────────────────────────────

document.getElementById('openStudioBtn')?.addEventListener('click', () => {
// Use existing dataset studio
openDatasetStudio();
workflowEngine.goToStep(3);
});

// ── 10. HANDLE RESET ──────────────────────────────────────────

document.getElementById('resetBtn')?.addEventListener('click', () => {
if (confirm('Reset all progress? This cannot be undone.')) {
// Reset ML state
store.reset();

    // Reset workflow
    workflowEngine.reset();

    // Reset UI
    document.getElementById('step1-next').dispatchEvent(new Event('click'));

}
});

// ── 11. COLLAPSIBLE SECTIONS ──────────────────────────────────

document.querySelectorAll('.collapsible-header').forEach(header => {
header.addEventListener('click', () => {
header.classList.toggle('active');
const content = header.nextElementSibling;
if (content.style.display === 'none') {
content.style.display = 'block';
} else {
content.style.display = 'none';
}
});
});

// ── 12. TEST METHOD TABS ──────────────────────────────────────

document.querySelectorAll('.test-method-btn').forEach(btn => {
btn.addEventListener('click', () => {
// Remove active from all
document.querySelectorAll('.test-method-btn').forEach(b => b.classList.remove('active'));
document.querySelectorAll('.test-method-panel').forEach(p => p.classList.remove('active'));

    // Add active to clicked
    btn.classList.add('active');
    const method = btn.dataset.method;
    document.getElementById(`${method}-method`).classList.add('active');

});
});

// ── 13. RESPONSIVE HANDLING ───────────────────────────────────

window.addEventListener('resize', () => {
// Adjust layouts if needed on resize
updateProgressLayout();
});

// ── 14. KEYBOARD SHORTCUTS ────────────────────────────────────

document.addEventListener('keydown', (e) => {
// Right arrow: next step
if (e.key === 'ArrowRight' && e.ctrlKey) {
const nextBtn = document.querySelector('[id*="-next"]:not(:disabled)');
nextBtn?.click();
}

// Left arrow: previous step
if (e.key === 'ArrowLeft' && e.ctrlKey) {
const backBtn = document.querySelector('[id*="-back"]:not(:disabled)');
backBtn?.click();
}
});

// ── HELPER FUNCTIONS ──────────────────────────────────────────

/\*\*

- Update progress layout based on content
  \*/
  function updateProgressLayout() {
  const tracker = document.querySelector('.workflow-tracker');
  if (window.innerWidth < 768) {
  tracker.style.flexWrap = 'wrap';
  } else {
  tracker.style.flexWrap = 'nowrap';
  }
  }

/\*\*

- Disable/enable next buttons based on conditions
  \*/
  function updateButtonStates() {
  // Step 2 needs at least 2 classes
  const step2Btn = document.getElementById('step2-next');
  if (step2Btn) {
  step2Btn.disabled = store.classes.length < 2;
  }

// Step 3 needs samples in all classes
const step3Btn = document.getElementById('step3-next');
if (step3Btn) {
const hasAll = store.classes.every(c => c.samples.length > 0);
step3Btn.disabled = !hasAll;
}

// Step 4 needs valid config
const step4Btn = document.getElementById('step4-next');
if (step4Btn) {
step4Btn.disabled = false; // Always allow
}

// Step 5 needs model trained
const step5Btn = document.getElementById('step5-next');
if (step5Btn) {
step5Btn.disabled = !store.modelTrained;
}

// Step 6 can always proceed to export
const step6Btn = document.getElementById('step6-next');
if (step6Btn) {
step6Btn.disabled = false;
}
}

/\*\*

- Save workflow progress to localStorage
  \*/
  function saveWorkflowProgress() {
  const progress = {
  currentStep: workflowEngine.currentStep,
  completedSteps: Array.from(workflowEngine.completedSteps),
  projectName: document.getElementById('projectName').value,
  modelType: document.getElementById('modelType').value,
  trainingConfig: getTrainingConfig(),
  };

localStorage.setItem('workflowProgress', JSON.stringify(progress));
}

/\*\*

- Load workflow progress from localStorage
  \*/
  function loadWorkflowProgress() {
  const saved = localStorage.getItem('workflowProgress');
  if (saved) {
  const progress = JSON.parse(saved);
      // Restore values
      document.getElementById('projectName').value = progress.projectName;
      document.getElementById('modelType').value = progress.modelType;

      Object.entries(progress.trainingConfig).forEach(([key, value]) => {
        const input = document.getElementById(`${key === 'learningRate' ? 'learningRateInput' : key + 'Input'}`);
        if (input) input.value = value;
      });

      // Restore workflow state
      progress.completedSteps.forEach(step => {
        workflowEngine.completeStep(step);
      });
  }
  }

// ── INITIALIZATION ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
loadWorkflowProgress();
updateButtonStates();
updateTrainingStats();
updateProgressLayout();

// Auto-save progress when anything changes
document.addEventListener('change', saveWorkflowProgress);
});

// Save on unload
window.addEventListener('beforeunload', saveWorkflowProgress);

```

## Key Integration Points

1. `workflowEngine.goToStep(n)` → Navigate to step n
2. `workflowEngine.completeStep(n)` → Mark step as complete
3. `workflowEngine.nextStep()` → Advance to next step
4. `workflowEngine.previousStep()` → Go back one step
5. `workflowEngine.reset()` → Start over
6. `workflowEngine.getProgress()` → Get completion percentage

Connect these to your existing ML functions:
- `addSampleFromImage()`
- `trainModel()`
- `predictImage()`
- `exportModel()`
- `importModel()`

Update store observers for reactive UI updates.
