# 🤝 Team Work Distribution & Project Review

*ClaimLens AI - InsurTech Web Application*

---

## 👤 Member 1: Core AI Engine & Admin Training Lab
**Role Summary:** Member 1 is the "Data Scientist." They built the core application that loads the brain of our AI (TensorFlow MobileNet) and created the administrative interface (`index.html`) that allows underwriters to create damage classes and collect training datasets.

### 📂 Code Related Files
* `js/ml/mobilenet.js` & `js/ml/dataset.js`
* `js/ui/classes.js` & `js/ml/training.js`
* `index.html` (Admin Layout)

### ⚙️ Functionality Explained Simply
* **`loadMobileNet()` & Training Loop:** Initializes the 1024-Dimension neural network. They wrote the code that actually trains the AI using the Adam optimizer across 25 epochs.
* **`buildClassifier()`:** Builds a new mini-brain on top of MobileNet to categorize specific vehicle or property damage.
* **Data Quality Dashboard:** Built the variance safety checks and thumbnail previews so that bad data doesn't corrupt the training cycle.

---

## 👤 Member 2: The Agent Portal & Field Logic
**Role Summary:** Member 2 is the "Field Engineer." They were responsible for developing the Surveyor-facing dashboard (`agent.html`), stripping away the complex ML controls and creating a clean, operational UI.

### 📂 Code Related Files
* `agent.html` (Layout, CSS, Viewport handling)
* `agent.html` (Inline `<script>` Field logic)

### ⚙️ Functionality Explained Simply
* **`agent-cam` & Stream Toggle:** Created the logic that hooks into the mobile/tablet camera seamlessly and handles the Start/Stop states.
* **Mathematical Crop Synchronization:** Ensured that the Live Stream tensors mathematically matched the exact 16:9 bounding box sizes that the Admin trained on, preventing geometric AI hallucinations.
* **Confidence Progress Bars:** Implemented the UI loops to parse the raw array of probabilities and generate real-time visual progress bars.

---

## 👤 Member 3: PDF Reporting & Evidence Generation
**Role Summary:** Member 3 is the "Compliance Officer." They developed the mechanism to freeze field assessments and translate them into official, downloadable A4 Survey PDF reports.

### 📂 Code Related Files
* `agent.html` (Workflow Logic and `@media print` CSS)

### ⚙️ Functionality Explained Simply
* **`Capture & Freeze Frame`:** Wrote the Canvas code that takes the raw video stream, draws it onto an invisible `<canvas>`, and converts it to a permanent base64 image without data loss.
* **Native Print API:** Used hidden CSS trickery (`@media print`) rather than heavy external libraries like jsPDF to format an official claim document natively via `window.print()`.
* **Dynamic Content Hydration:** Wrote the string injections that automatically pull the current time, generate a randomized Claim ID (e.g. `CLM-93412`), and change the color of the text to red or green depending on AI certainty (greater than 60%).

---

## 👤 Member 4: Model Persistence & Storage
**Role Summary:** Member 4 is the "Database Architect." They built the critical bridge between the Admin Lab and the Agent Portal by creating a file-based sharing mechanism.

### 📂 Code Related Files
* `js/ml/persistence.js`
* `agent.html` (File reading logic)

### ⚙️ Functionality Explained Simply
* **`exportModel()`:** Intercepts the completed training weights and topological layout and forces the browser to serialize them into `.json` and `.bin` physical files.
* **Metadata Construction:** Zips up the user-created Class names (e.g., "Bumper Dent") into a `metadata.json` file so the neural network remembers what text to output.
* **File Upload Reader:** Built the logic in the Agent dashboard to read multiple files simultaneously, parse the weights, and re-hydrate the TensorFlow layers seamlessly.

---

## 👤 Member 5: Security, UI/UX, & Deep Visualizations
**Role Summary:** Member 5 is the "Frontend & Analytics Lead." They handled authentication routing and built the deep visual inspectors for debugging the AI.

### 📂 Code Related Files
* `login.html`
* `js/visuals/inspector.js`
* `js/visuals/internals.js`

### ⚙️ Functionality Explained Simply
* **Enterprise Login Page:** Designed the beautiful `login.html` wall that redirects users to different files based on their credentials (Admin vs. Agent roles).
* **Live Pipeline Inspector:** Created the 5-panel X-Ray view in the Admin Lab so the team could debug *why* the AI made a decision, drawing heatmaps and tensor graphs.
* **Activation Attention Mapping:** Developed the logic that paints a glowing "heat" map over images to show which physical area the computer was staring at.

---

### 🎓 Summary for Presentation
> *"Our project transitioned from a basic tech-demo into **ClaimLens AI**, a professional InsurTech product. We divided the work functionally: The Core Engine (Admin Training), The Field Portal (Agent App), The Data Bridge (Model Export/Import), the PDF Compliance Engine (Claim Generation), and the Security/UX layer. This architecture strictly separates the backend Mathematics from the frontend Field Work, perfectly replicating a real-world enterprise software lifecycle."*
