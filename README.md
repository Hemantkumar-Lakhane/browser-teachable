# 🔬 GlassBox AI — Teachable Machine v1.5

**Interactive in-browser image classifier with real-time neural network visualisation.**  
No server. No cloud. No installation. Just open in a browser and train your own AI.

---

## 🧠 What is GlassBox AI?

Most AI tools are black boxes — you give input, get output, and have no idea what happened in between. **GlassBox AI** makes the entire process transparent.
Train a real image classifier in under 2 minutes using your webcam. Then watch the AI explain every step — from raw pixels to prediction — in real time.
Built entirely in the browser using **TensorFlow.js**. No backend, no data uploads, no cost.

---

## ✨ Features

### Core ML
- 🧠 **Transfer Learning** — MobileNet v1 frozen feature extractor (1024D embeddings)
- 🏗️ **Custom Classifier** — Dense(128) → Dropout(0.3) → Dense(64) → Softmax(N)
- ⚙️ **Adam Optimiser** — lr=0.0005, 25 epochs, categorical cross-entropy
- 📦 **2–5 Dynamic Classes** — add, rename, delete classes on the fly
- 📷 **Webcam Collection** — live 5fps sample capture
- 🖼️ **Image Upload** — drag and drop or file picker

### Data Quality
- 📊 **Sample Quality Dashboard** — per-class thumbnail grid with diversity scoring
- 🎯 **Diversity Score** (0–100%) — computed from mean pairwise cosine distance
- 🔴 **Near-Duplicate Flagging** — highlights redundant frames with orange border
- ⚠️ **Pre-training Variance Warning** — catches bad data before you waste training time

### Training Transparency
- 📈 **Live Training Charts** — loss and accuracy curves updating every epoch
- 🎚️ **Epoch Replay Slider** — scrub through all 25 epochs after training
- ▶️ **Auto-play Mode** — watch the model learn in real time at 420ms/epoch
- 💬 **Per-epoch Insight** — Early training / Learning / Converged labels

### Prediction Transparency
- 🔍 **Live Pipeline Inspector** — 5 panels showing every transformation step
  - Raw webcam frame with attention overlay
  - Resized 224×224 input
  - Normalisation heatmap (blue=−1 → red=+1)
  - 1024D embedding sparkline with peak marker
  - Softmax probability bars
- 🗺️ **Activation Attention Map** — highlights which regions of the image influenced the prediction (jet colourmap overlay)
- 💡 **"Why" Explanation Box** — natural language explanation using cosine similarity to class means
- 📉 **Embedding Distance Meter** — shows class separability before training
- 🕐 **Confidence Timeline** — 40-point scrolling history of prediction probabilities

### Network Visualisation
- 🏛️ **Architecture SVG Diagram** — dynamically drawn after training showing all 7 layers
- 🔬 **MobileNet Internals** — 4-stage feature map visualiser *(in progress)*

---

## 🚀 How to Run

**No installation required.**

### Option 1 — Local Node server (Recommended)
You need to serve the files over HTTP because we use ES modules (`<script type="module">`). Opening the HTML file directly via `file://` might block modules.
```bash
# Using python
python -m http.server 8080

# Or using Node
npx serve .
# Open http://localhost:8080 in Chrome or Edge
```

### Option 2 — Live Server (VS Code)
1. Install Live Server extension in VS Code
2. Right-click `index.html` → Open with Live Server

> ⚠️ **Important:** Must be opened in Chrome or Edge. Firefox has limited WebGL support for TensorFlow.js. Safari is not supported.

---

## 🎮 Quick Start Guide

1. **Load** — Wait for MobileNet to load (3–5 seconds on first open)
2. **Add Classes** — Click `+ Add Class` to create 2–5 categories
3. **Collect Samples** — Use webcam or upload images (minimum 5 per class, 20+ recommended)
4. **Check Quality** — Review the Sample Quality Dashboard before training
5. **Train** — Click `Train Model` and watch the loss curve drop
6. **Predict** — Start live webcam prediction or upload a test image
7. **Explore** — Open Pipeline Inspector, Epoch Replay, and the Why Box to understand what the model learned

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |

| TensorFlow.js | 4.14.0 | ML framework, WebGL acceleration |
| MobileNet | @tensorflow-models | Frozen feature extractor |
| Chart.js | 4.4.0 | Training charts and timeline |
| Canvas 2D API | Native | All visualisation rendering |
| HTML / CSS / JS | Vanilla | Zero framework dependencies |

---

```
glassbox-ai/
├── index.html       ← Main entrypoint, loads JS as modules
├── css/             ← Stylesheets
├── js/
│   ├── main.js      ← Application orchestrator
│   ├── store.js     ← Centralised application state
│   ├── ml/          ← TensorFlow.js logic (training, prediction, etc.)
│   ├── ui/          ← DOM state & Event Listeners
│   └── visuals/     ← Canvas drawing & Chart.js rendering
└── _backup/         ← Original monorepo files (for legacy purposes)
```

---

## 📜 Version History

| Version | Key Features Added |
|---|---|
| v1.0 | Base classifier, MobileNet transfer learning, webcam collection, image upload |
| v1.2 | Dynamic classes (up to 5), training charts, architecture diagram, embedding distance, confidence timeline |
| v1.3 | Epoch replay slider, Why explanation box, variance warning, attention map, pipeline inspector |
| v1.4 | Sample quality dashboard, thumbnail grid, diversity scoring, near-duplicate flagging |
| v1.5 | Tensor memory management, MobileNet internals visualiser, complete feature integration |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <b>GlassBox AI</b> — Making AI transparent, one layer at a time.
</div>
