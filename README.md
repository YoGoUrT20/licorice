# Licorice 🍬

**The Automated Manual Testing Environment for AI-Assisted Development.**

Licorice is an open-source Desktop Application designed to streamline the workflow of developers who use Git Worktrees. It acts as an intelligent orchestration layer, automatically managing your development servers and contexts as you switch between branches and worktrees.

Designed for modern "Agentic" workflows where AI coding assistants (like Cursor, Windsurf, or custom agents) generate multiple branches/worktrees for different features, Licorice ensures you never have to manually `cd`, `npm install`, and `npm run dev` every time you want to preview a change.

## 🚀 Features

### ✅ Already Implemented
*   **Worktree Visualization**: Beautiful, card-based interface to view all active Git worktrees.
*   **Smart Auto-Start**: Automatically potentially runs `bun install` and `bun run dev` (or your configured script) when a worktree is created or detected.
*   **Context Awareness**: Uses **Global Git Hooks** to detect when you checkout a branch in your terminal or IDE, automatically focusing the relevant worktree in the Licorice UI and spinning up environment resources.
*   **Process Management**: Integrated terminal output for every running worktree server. Start, stop, and restart environments with a click.
*   **Stealth Mode**: Designed to run alongside your editor with a compact, auto-hiding menu interface.

## 🗺️ Roadmap

We are building the ultimate companion for the AI-native developer.

*   [ ] **Package Manager Agnosticism**: Support for `npm`, `pnpm`, and `yarn` (currently primarily optimized for `bun`).
*   [ ] **Configurable Pipelines**: Define custom startup commands per project (e.g., `docker-compose up` instead of just local scripts).
*   [ ] **CLI Tool**: Command-line tool for creating worktrees and starting/stopping servers.
*   [ ] **Vs code extension**: (Self explanatory)
*   [ ] **Linux & macOS Full Support**: Ensure parity across all operating systems (Currently Windows/WSL focused).


## 📦 Getting Started

### Prerequisites
*   [Bun](https://bun.sh) installed.
*   Git 2.5+ (for worktree support).

### Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/yoogurt20/licorice.git
    cd licorice
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

3.  Run the development build:
    ```bash
    bun run dev
    ```

4.  **Auto-Detection Setup**:
    On first launch, Licorice will attempt to install a global `post-checkout` hook. This allows the app to respond instantly to terminal commands. You can toggle "Auto-Launch" in the top-right corner.

## 🤝 Contributing

Contributions are welcome! This is an open-source project.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
