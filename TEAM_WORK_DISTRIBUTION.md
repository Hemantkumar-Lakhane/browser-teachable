# 🤝 Team Work Distribution & Project Review



## 👤 Member 1: Core ML Engine & Class Management
**Role Summary:** Member 1 is the "Foundation Builder." They built the core system that loads the brain of our AI (MobileNet) and created the user interface that allows users to create classes (like "Cat" or "Dog") and collect images for them.

### 📂 Code Related Files
* `js/ml/mobilenet.js`
* `js/ml/dataset.js`
* `js/ui/classes.js`
* `js/ui/webcam.js`
* `js/main.js`

### ⚙️ Functionality Explained Simply
* **`loadMobileNet()` & `extractEmbedding()`:** Imagine MobileNet as a pre-trained robot that already knows how to see the world. These functions load that robot into our app and ask it to convert images into a list of numbers (embeddings) that represent the unique features of the image.
* **`buildClassifier()`:** This builds a new, smaller brain (a neural network) on top of the MobileNet robot. It has layers (Dense, Dropout, Softmax) that take the numbers from MobileNet and learn to categorize them into the specific classes the user creates.
* **`addNewClass()`, `deleteClass()`, `clearClassSamples()`:** These are the controls for the user to create new categories (or folders) for their images, delete them if they made a mistake, or empty them entirely.
* **`renderClasses()`:** This function actually draws the visual "Cards" on the screen where users see their classes.
* **`startCollection()`, `stopCollection()`, `addSampleFromImage()`, `readFile()`:** These functions handle the camera and file uploads. They take pictures using the webcam at 5 frames per second or let users upload pictures from their computer, turning those pictures into data the AI can learn from.
* **`checkTrainReady()`, `updateStats()`:** These are the traffic cops. They check if we have enough images to start teaching the AI and update the numbers (like "15 images collected") on the screen.

---

## 👤 Member 2: Training Loop & Epoch Replay
**Role Summary:** Member 2 is the "Teacher and Historian." They wrote the code that actually trains the AI using the collected images, and they built a really cool feature to "rewind" and see what the AI learned at every step of its training.

### 📂 Code Related Files
* `js/ml/training.js`
* `js/ui/replay.js`
* `js/store.js`
* `js/main.js`

### ⚙️ Functionality Explained Simply
* **Full training loop (Adam, 25 epochs):** An "epoch" is one full read-through of all the training flashcards. This code loops through the images 25 times over, using a mathematical tool called 'Adam' to slowly adjust the AI's brain so it makes fewer mistakes.
* **`onEpochEnd` callback & `epochSnapshots`:** Every time the AI finishes one loop (epoch), this code saves a snapshot of the AI's brain weights (using `Float32Array`). It also updates the progress bar on the screen so the user knows it's working.
* **`initReplayCard()`, `renderReplayBars()`:** This draws the cool "Replay" box on the screen where users can see the timeline of the training.
* **`scrubToEpoch()`, `restoreFinalWeights()`:** These are the "Time Machine" functions. They let the user drag a slider to go back in time and load a past snapshot of the AI's brain. If they stop playing with the slider, the AI goes back to its smartest, final version.
* **Auto-play interval & `syncReplayButtons()`:** This creates the "Play/Pause" buttons that automatically step through the AI's past snapshots every 420 milliseconds, showing how its confidence grew!
* **Per-epoch insight sentence logic:** Generates a simple English sentence to explain what happened in that specific round of training (e.g., "The AI is getting more confident!").

---

## 👤 Member 3: Prediction & Explanation System
**Role Summary:** Member 3 is the "Mind Reader." They built the part of the app that looks at a new, unseen image from the webcam and guesses what it is. They also built systems to explain *why* the AI made that guess.

### 📂 Code Related Files
* `js/ml/prediction.js`
* `js/visuals/distance.js`
* `js/visuals/charts.js`
* `js/visuals/architecture.js`
* `js/utils.js`

### ⚙️ Functionality Explained Simply
* **`showPrediction()`, `renderPredBars()`:** Once training is done, this code constantly checks the webcam, asks the AI for its guess, and draws the green/red confidence bars on the screen to show how sure the AI is.
* **`computeClassMeans()`, `cosineSim()`:** How does the AI know things are similar? It finds the "average" numbers (mean embedding) for every class and uses a math trick called "Cosine Similarity" to see if a new picture's numbers point in the same direction as the average class.
* **`updateWhyBox()`:** This translates math into English! It looks at exactly *why* the AI picked a specific class and outputs a simple 3-tier English sentence explaining the reasoning to the user.
* **`checkSampleVariance()`, `updateDistancePanel()`:** These act as warnings. If the pictures inside a class are too different from each other (high variance), it tells the user. The distance panel visually shows how close or far the current webcam image is from the known classes.
* **`drawArchDiagram()`:** Draws a beautiful SVG (vector graphic) map of the Neural Network so users can literally see the shape of the AI's brain.
* **`initTimelineChart()`, `pushTimeline()`:** This creates the moving wave chart at the bottom of the screen, tracking the AI's confidence levels shifting over time in a live graph.

---

## 👤 Member 4: Sample Quality Dashboard
**Role Summary:** Member 4 is the "Data Quality Inspector." AI is only as good as the data you feed it. This member built a dashboard that automatically audits the user's images and tells them if they need better, more diverse pictures.

### 📂 Code Related Files
* `js/ui/dashboard.js`
* `js/ui/classes.js`
* `js/visuals/charts.js`
* `js/ui/webcam.js`

### ⚙️ Functionality Explained Simply
* **`captureThumbnail()`:** Every time the user adds an image, this grabs a tiny 48x48 pixel thumbnail version to show on the screen without slowing down the computer.
* **`scheduleQualityUpdate()`, `renderQualityDashboard()`:** A timer that waits 800 milliseconds before doing heavy calculations so it doesn't freeze the app. Then, it runs the engine to update the Quality Dashboard. 
* **Pairwise cosine distance & Diversity score:** It pairs up every image in a class against every other image (up to 400 pairs!) to see how similar they are. It calculates a "Diversity Score" from 0 to 100. If the score is low, it means all the pictures look exactly the same, which is bad for learning!
* **Near-duplicate flagging:** If two pictures look almost identical (similarity > 985%), it flags them with an orange border to warn the user that they are wasting space.
* **Three recommendation tiers:** Based on the scores, it gives simple advice like "Good job!", "Try different angles," or "Your images are too similar."
* **`resetTrainingCharts()`, `pushTrainingCharts()`:** Draws the Live Training Loss and Accuracy charts so the user can see if the AI is getting "smarter" (accuracy goes up, loss goes down) in real-time.

---

## 👤 Member 5: Live Pipeline Inspector & Attention Map
**Role Summary:** Member 5 is the "X-Ray Technician." They built the advanced visualizations that let users peek underneath the hood and see exactly what the AI system is "looking at" inside a picture.

### 📂 Code Related Files
* `js/visuals/inspector.js`
* `js/visuals/internals.js`
* `js/ml/prediction.js`
* `js/ml/mobilenet.js`
* `js/utils.js`

### ⚙️ Functionality Explained Simply
* **`runInspector()`, `inspectorActivate()`, `inspectorDeactivate()`:** Controls the master switch to open up the complex 5-panel "Inspector Mode" where advanced users can see the raw numbers the AI is processing.
* **`drawNormPanel()`, `drawEmbeddingPanel()`, `drawSoftmaxPanel()`:** These draw visual graphs! 
  * The Norm Panel shows normalisation heatmaps.
  * The Embedding Panel draws a jagged 1024-point line graph representing the raw, distilled MobileNet data.
  * Softmax Panel draws the final probability numbers.
* **`buildSpatialModel()`, `drawGradCAMOverlay()`:** This is the magic "Attention Map." It builds a special sub-model to peek back into MobileNet to figure out *which pixels* in the image were the most important. It then overlays a glowing, semi-transparent heat-map over the camera feed so the user can see if the AI is looking at the dog's face, or just the background!
* **`jetColor()`, `thermalColor()`:** These are math functions that translate boring numbers into cool, colorful gradients, going from blue (cold/unimportant) to red (hot/very important).
* **`runInternals()`, `drawHeatmap()`, `describeActivation()`:** These handle the deeper AI internals, tracking how the data pushes through the different layers, and writes a description of whether the AI's focus is "sharp and focused" or "diffuse and confused."

---

### 🎓 Summary for Your Teacher 
When presenting this to your teacher, you can proudly state:
> *"Our team divided the project by **System Modules**. Instead of stepping on each other's toes, we gave everyone full ownership of a vertical slice of the application. The Core Engine, the Training Loop, the Prediction UI, Data Quality, and Deep Visualizations were all handled in parallel. This cleanly separates our logic across different JavaScript files, preventing code-collision and allowing each member to specialize in their respective computational or visual tasks!"*

Great work to the entire team, the code is well organized and the separation of concerns is highly professional! 👏
