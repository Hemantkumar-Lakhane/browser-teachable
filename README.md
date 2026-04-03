# 🛡️ ClaimLens AI — InsurTech Triage System

**Professional AI-powered damage assessment portal for field surveyors and insurance agents.**  
ClaimLens AI revolutionizes the motor and property claims process by empowering field surveyors with a localized, neural-network-backed computer vision engine that instantly categorizes structural damage right from their device.

---

## 🚀 Architecture Overview

ClaimLens AI operates on a **Dual-Interface Architecture**:

1. **Admin Training Lab (`index.html`)**  
   Used by Data Scientists and Underwriters to collect damage samples, train the neural network locally via MobileNet transfer learning, and export the official weighted models (`.json` & `.bin`).
   
2. **Field Agent Portal (`agent.html`)**  
   A lightweight, enterprise-grade dashboard used by field surveyors. Agents load the centralized AI models, use their device's camera, and receive real-time, mathematically deterministic risk classifications.

3. **Authentication Gateway (`login.html`)**  
   Secure role-based access simulating modern enterprise security workflows (Admin vs. Surveyor access).

---

## ✨ Key Features

### Agent Dashboard & Field Workflow
- 📷 **Live Field Stream** — Mathematically isolated live assessment that perfectly mimics training geometries.
- 📸 **Capture & Freeze** — Instantly freeze video streams on high-confidence damage frames.
- 📄 **Official PDF Generation** — Generates printable/downloadable A4 claim reports with dynamic claim IDs, timestamping, evidence snapshots, and AI confidence logic.
- 📊 **Real-time Confidence Bars** — Tracks probabilities across multiple custom damage classes simultaneously.

### Machine Learning Engine (Admin Lab)
- 🧠 **Transfer Learning** — Built on MobileNet v1 architecture representing powerful 1024D neural embeddings.
- 🏗️ **Custom Dense Classifier** — Real-time in-browser compilation of Dense(128) → Dropout(0.3) → Dense(64) → Softmax(N).
- 💾 **Model Persistence** — Easily export compiled topologies and weights natively to the filesystem to distribute to field agents.
- ⚙️ **Adam Optimiser** — Dynamic training visualization tracking loss metrics and categorical cross-entropy.

### Data Transparency & Underwriting
- 🔍 **Live Pipeline Inspector** — 5-panel X-Ray view into the algorithmic math layer (Heatmaps, 1024D Embeddings).
- 🗺️ **Activation Attention Map** — Highlights which physical regions of an image triggered the damage flag.
- 💬 **Plain-text Explanations** — Natural Language Processing translates complex cosine similarities into human-readable rationale.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **TensorFlow.js (4.14)** | Core ML framework, WebGL hardware acceleration |
| **MobileNet** | Pre-trained frozen feature extractor |
| **Vanilla HTML/CSS/JS** | Zero-framework dependency for maximum portability |
| **Chart.js** | Live neural mapping and training analysis |
| **Native DOM Print API** | Highly efficient PDF invoice generation without bloat |

---

## 🚀 How to Run

**No heavy installations required. Runs purely locally.**

1. **Serve locally**  
   You must serve the app over a local HTTP server since TensorFlow utilizes standard ES6 Modules.
   ```bash
   # Python
   python -m http.server 8080
   
   # Or Node.js
   npx serve .
   ```
2. **Launch**  
   Open `http://localhost:8080/login.html`
3. **Login Details**  
   - Admin Lab: `admin / admin`
   - Agent Portal: `agent / agent`

---

## 📄 License
MIT License — see [LICENSE](LICENSE) for details. Developed for intelligent InsurTech.
