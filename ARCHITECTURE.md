# Architecture Overview: Browser-Teachable (ClaimLens AI)

## 1. System Design
Browser-Teachable is designed as a **Frontend-Only, Zero-Trust ML Application**. The architectural decision to run entirely in the browser (client-side) ensures maximum privacy, reduced latency, and simplified deployment.

## 2. Core Technologies
- **UI/UX Layer:** Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Machine Learning Engine:** TensorFlow.js (TFJS).
- **State Management:** IndexedDB and LocalStorage for persistent local data (datasets and model parameters).
- **Deployment:** Static file hosting (e.g., GitHub Pages, AWS S3, Vercel).

## 3. Data Flow & Security
1. **Data Ingestion:** User images are captured via the local webcam or file system.
2. **Local Processing:** Images are converted into tensors directly in the browser memory.
3. **Training:** Transfer learning is applied using MobileNet (or similar backbones) without any data leaving the device.
4. **No-Backend Guarantee:** By eliminating the backend, the application inherently mitigates server-side vulnerabilities (SQLi, SSRF, server DDOS).

## 4. XSS Prevention Strategy
To ensure frontend security, dynamic DOM rendering utilizes secure APIs (avoiding `.innerHTML`) to prevent Cross-Site Scripting (XSS) attacks. All dynamic content is sanitized or inserted using safe text/node manipulation techniques.

## 5. Scalability
Because the application is stateless and relies on client-side compute, it scales infinitely. The cost of compute is distributed to the end-users' devices, resulting in zero backend infrastructure costs.
