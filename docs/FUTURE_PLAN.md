# 🚀 ModelForge AI Studio — Platform Evolution & Future Roadmap

This document outlines the strategic roadmap for transitioning **ModelForge AI Studio** from a browser-based prototype into a fully-fledged, modular **Enterprise Edge AI Platform**.

The following milestones are designed for future sprints to expand model export architectures and optimize edge inference capabilities.

---

## 📅 Future Milestone: Multi-Architecture Model Exports
**Objective:** Break free from TensorFlow.js lock-in by supporting industry-standard universal model formats.

### The Problem
Currently, the studio exports models strictly as TensorFlow.js Weights (`.bin`) and Topology (`.json`). While excellent for web deployment, many hardware systems (like Raspberry Pi, edge cameras, or iOS apps) require different formats.

### The Implementation Strategy
Integration of an **Export Pipeline Converter**:
1. **ONNX Format Export:** Converting the trained TFJS graph into the Open Neural Network Exchange (ONNX) format, allowing seamless import into PyTorch, Scikit-learn, and C++ inference engines.
2. **TFLite Export:** Quantizing the model (reducing float32 to int8) to aggressively shrink file size and export as a `.tflite` flatbuffer, perfectly optimized for Android and microcontrollers.

---

## 📅 Future Milestone: Advanced Hyperparameter Tuning & Transfer Architectures
**Objective:** Expose advanced training configurations for professional users.

### The Strategy
* **Custom Backbones:** Allow users to swap the feature extractor from MobileNet v1 to MobileNet v2, ResNet50, or EfficientNet based on their device's memory limits.
* **Hyperparameter Matrix:** Provide advanced UI controls for adjusting the learning rate optimizer (Adam, SGD, RMSprop), dropout rates, and batch sizes in real time.

### Implementation Status
This milestone has been promoted into the current prototype:
* Training controls now expose optimizer, learning rate, epochs, batch size, dropout rate, and hidden layer size.
* The feature-extractor layer is adapter-based, with MobileNet v1/v2 support and experimental TFHub ResNet50/EfficientNet B0 loading.
* Exported metadata now records the selected backbone and training configuration for safer import compatibility checks.
