# 🤝 Team Work Distribution & Project Review

*ModelForge AI Studio - Browser-based Edge AI Platform*

---

## 👤 Member 1: Core AI Engine & Training Configurator
**Role Summary:** Member 1 is the "Lead Machine Learning Engineer." They built the core application that loads the baseline AI models and created the training infrastructure to allow custom classification.

### 📂 Code Related Files
* `js/ml/backbone.js` & `js/ml/dataset.js`
* `js/ml/training.js` & `js/ui/classes.js`

### ⚙️ Functionality Explained Simply
* **Backbone Integration:** Implemented the logic to load and switch between MobileNet v1/v2, ResNet50, and EfficientNet feature extractors natively in the browser.
* **Hyperparameter Tuning:** Developed the dynamic dense-layer "mini-brain" and allowed users to configure Optimizers (Adam, SGD), Learning Rates, Epochs, and Batch Sizes visually.
* **Training Loop:** Managed the TensorFlow.js WebGL-accelerated training cycle and integrated the real-time `Chart.js` loss/accuracy rendering.

---

## 👤 Member 2: Dataset Pipeline & Cloud Integrations
**Role Summary:** Member 2 is the "Data Engineering Specialist." They were responsible for developing the dataset sourcing pipelines and the built-in Labeling Studio for data cleaning.

### 📂 Code Related Files
* `js/ui/labeling-studio.js`
* `js/main.js` (Cloud Import Logic)
* `css/styles.css`

### ⚙️ Functionality Explained Simply
* **Cloud Dataset Importer:** Integrated `JSZip` to fetch heavy `.zip` dataset files directly from Kaggle and Web URLs into the browser's memory without freezing.
* **Visual Transformations:** Built the Canvas geometry logic for drag-and-drop bounding box cropping, rotation, and applying CSS hardware-accelerated visual filters.
* **Auto-Augmentation Engine:** Developed the logic for procedural dataset multiplication to prevent model overfitting.

---

## 👤 Member 3: Professional Evaluation & Explainable AI (XAI)
**Role Summary:** Member 3 is the "Analytics & Transparency Lead." They handled model validation and built deep visual inspectors to eliminate the AI "black box" effect.

### 📂 Code Related Files
* `js/visuals/internals.js` & `js/visuals/charts.js`
* `js/ml/prediction.js`

### ⚙️ Functionality Explained Simply
* **Enterprise Validation:** Wrote the mathematical logic to compute real-time Confusion Matrices, Precision, Recall, and F1-Scores.
* **PDF Report Generation:** Developed the functionality to export detailed model evaluation reports natively.
* **XAI Occlusion Heatmaps:** Built the complex algorithm that slides a masking window across images to calculate and paint glowing "heat" maps, proving exactly which physical areas the AI focused on.

---

## 👤 Member 4: Offline PWA Architecture & Storage
**Role Summary:** Member 4 is the "Platform Architect." They transformed the web application into a 100% Offline, installable product.

### 📂 Code Related Files
* `sw.js` & `manifest.json`
* `js/ml/persistence.js`
* `js/store.js`

### ⚙️ Functionality Explained Simply
* **Progressive Web App (PWA):** Implemented Service Workers to aggressively cache all system assets (HTML, CSS, JS), enabling the entire AI studio to operate without an internet connection.
* **IndexedDB Model Persistence:** Replaced basic file downloads with seamless local database storage, allowing users to save and load their trained weights seamlessly across sessions.
* **Model Serialization:** Built the logic to export neural network topologies into `.json` and `.bin` physical files for external use.

---

## 👤 Member 5: Industry Scanners & Field Deployment
**Role Summary:** Member 5 is the "Deployment Engineer." They developed the isolated, domain-specific testing portals (Scanners) that run the trained models in real-world scenarios.

### 📂 Code Related Files
* `agri-scanner.html`, `waste-scanner.html`, `qa-scanner.html`
* `dynamic-scanner.html` & `customer-link.html`
* `js/ui/webcam.js`

### ⚙️ Functionality Explained Simply
* **Pre-built Industry Scanners:** Designed and coded the isolated deployment UIs tailored for Agriculture (Crop Disease), Manufacturing (QA Check), and Environmental (Waste Sorting) use cases.
* **Dynamic Webcam Inference:** Managed the `requestAnimationFrame` loops that constantly ping the trained AI model against live webcam feeds for zero-latency predictions.
* **Client Intake Portal:** Developed the lightweight URL generation logic that allows clients to test models instantly via a clean, stripped-down interface.

---

### 🎓 Summary for Presentation
> *"Our project transitioned from a basic tech-demo into **ModelForge AI Studio**, a professional, zero-latency Edge AI platform. We divided the work functionally among 5 domains: Core ML & Hyperparameters, Cloud Data Pipelines, Pro Evaluation & XAI, PWA Offline Architecture, and Industry Scanners. This distribution perfectly replicates a real-world MLOps lifecycle—from cloud data ingestion to offline edge deployment."*
