# Contributing to ModelForge AI Studio

Thank you for your interest in contributing to **ModelForge AI Studio**! We welcome contributions from everyone—whether it's fixing bugs, improving documentation, adding new features, or creating new pre-built scanners.

## Getting Started

Because this application utilizes strict WebRTC APIs (`getUserMedia`) and Fetch APIs for the model weights, it must be served over a local HTTP web server.

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone <your-fork-url>
   cd browser-teachable
   ```

2. **Start a local web server:**
   We recommend using `npx serve`:
   ```bash
   npx serve .
   ```

3. **Access the application:**
   Open your browser and navigate to `http://localhost:3000/index.html`.

## How to Contribute

### 1. Find or Create an Issue
* Check the [Issues](#) tab for any bugs or features that need help.
* If you have a new idea, please create an Issue first so we can discuss it before you spend time writing code.

### 2. Create a Branch
Create a new branch for your feature or bug fix:
```bash
git checkout -b feature/your-feature-name
# or for bug fixes
git checkout -b fix/your-bug-fix
```

### 3. Make Your Changes
* Ensure your code follows the existing style and architecture.
* ModelForge Studio does not rely on heavy frameworks (Vanilla HTML/CSS/JS). Try to keep external dependencies to a minimum.
* Test your changes locally to ensure everything works properly.

### 4. Commit and Push
Write clear, concise commit messages.
```bash
git commit -m "Add new feature X"
git push origin feature/your-feature-name
```

### 5. Submit a Pull Request (PR)
* Open a Pull Request from your branch to our `main` branch.
* Describe your changes in detail in the PR description.
* Reference any related Issues.

## Code of Conduct

By participating in this project, you agree to abide by our professional standards. Please be respectful, inclusive, and constructive in your feedback and discussions.

Happy coding! 🚀
