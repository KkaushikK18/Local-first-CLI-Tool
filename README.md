# DSA Vault

A local-first CLI tool for capturing, organizing, and mastering Data Structures and Algorithms problems using Spaced Repetition System (SRS).

## Features

- **Automated Capture**: Automatically extracts problem title, topic, difficulty, tags, and solution code from your active LeetCode or GeeksForGeeks browser tabs.
- **Local-First Storage**: All problems and notes are stored locally in Markdown files. Your data is yours.
- **Spaced Repetition**: Built-in SRS algorithm calculates the optimal time for you to review a problem based on your confidence level.
- **Smart Reviews**: Interactive CLI for conducting your daily revision sessions.
- **Git Sync**: Automatically syncs your vault with a remote repository to keep your learning progress safe and accessible across devices.
- **Comprehensive Stats**: Track your learning progress, confidence levels, and active streaks.

## Prerequisites

- Node.js (v18 or higher)
- Chrome or Edge Browser (for automated problem capture)
- Git (for syncing)
- SQLite (included via `better-sqlite3`)

## Installation

You can install DSA Vault globally using npm:

```bash
npm install -g dsa-vault
```

*Note: Since this tool uses `better-sqlite3`, it requires a C++ compiler to build the native module during installation. On Windows, you can install the windows-build-tools.*

## Getting Started

1. Create a directory for your DSA Vault and initialize it:
```bash
mkdir my-dsa-vault
cd my-dsa-vault
dsa-vault init
```

2. Open Chrome with remote debugging enabled. This allows the CLI to read your active tabs.
**Windows:**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```
**Mac:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```
**Linux:**
```bash
google-chrome --remote-debugging-port=9222
```

## Usage

### 1. Capturing a Problem
Solve a problem on LeetCode or GeeksForGeeks, keep the tab open, and run:
```bash
dsa-vault capture
```
It will automatically extract the code and metadata, and open your default editor so you can write notes.

### 2. Reviewing Problems
Start your daily review session:
```bash
dsa-vault review
```
You can also filter by topic or difficulty:
```bash
dsa-vault review --topic arrays --difficulty Hard
```

### 3. Searching
Quickly find a problem you solved in the past:
```bash
dsa-vault search "two sum"
```

### 4. Viewing Stats
Track your mastery and streak:
```bash
dsa-vault stats
```

### 5. Syncing
Sync your progress to GitHub/GitLab:
```bash
dsa-vault sync -m "Daily progress"
```

### 6. Diagnostics
Check if everything is configured correctly:
```bash
dsa-vault doctor
```

### Configuration
Manage your settings:
```bash
# View all settings
dsa-vault config list

# Set your preferred editor (default is vim or system default)
dsa-vault config set editor.command code

# Enable automatic push to Git
dsa-vault config set git.autoPush true
```

## Architecture
DSA Vault uses:
- **Playwright** for connecting to existing browser sessions via CDP
- **better-sqlite3** for lightning-fast SRS history and metadata queries
- **Commander.js** & **Inquirer** for interactive CLI flows
- **simple-git** for version control

## License
MIT
