# Browser-Teachable (ClaimLens AI)

An enterprise-grade, fully client-side Machine Learning application that runs entirely in the browser. 
This project demonstrates zero-trust AI architecture by training, evaluating, and running inference locally without sending sensitive data to a backend.

## 🚀 Features
- **Client-Side ML:** Powered by TensorFlow.js, models are trained and executed securely in the browser.
- **Privacy-First:** No images or datasets are ever uploaded to a server.
- **Dynamic Scanners:** Create custom workflows and scan data dynamically.
- **XAI (Explainable AI):** Built-in tools for interpretability and confusion matrices.
- **Enterprise UI:** Designed with modern aesthetics and security principles.

## 🛠️ Quickstart
1. Clone the repository.
2. Serve the directory using any static web server (e.g., `npx serve .` or `python -m http.server`).
3. Open `index.html` in your browser.

## 🔐 Security Posture
- **No Backend:** Attack surface is heavily minimized by remaining completely client-side.
- **XSS Mitigations:** Dynamic content rendering is properly sanitized without using `.innerHTML`.
- **Zero-Trust Data:** All data processing is done locally; no data ever leaves the user's device.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
