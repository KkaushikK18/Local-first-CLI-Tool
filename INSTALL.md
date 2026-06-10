# Installation Guide

## Prerequisites

- Node.js 18 or higher
- Git
- (Windows only) Visual Studio Build Tools with C++ toolset for native modules

## Installation Steps

### 1. Windows: Install Visual Studio Build Tools (REQUIRED)

**IMPORTANT:** You must install the complete C++ build tools BEFORE running npm install.

#### Option A: Install Visual Studio 2022 Build Tools (Recommended)

1. Download the Visual Studio 2022 Build Tools installer from:
   https://visualstudio.microsoft.com/downloads/ (scroll to "All Downloads" → "Tools for Visual Studio")

2. Run the installer and select **"Desktop development with C++"** workload

3. In the Installation Details panel on the right, ensure these are checked:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
   - ✅ Windows SDK (any recent version)
   - ✅ C++ CMake tools for Windows

4. Click Install (this will take 5-10 GB of disk space and 15-30 minutes)

5. **Restart your terminal/command prompt** after installation

#### Option B: Modify Existing Visual Studio Installation

If you already have Visual Studio 2019/2022 installed:

1. Open "Visual Studio Installer" from Start menu
2. Click "Modify" on your VS installation
3. Select the **"Desktop development with C++"** workload
4. In Installation Details, ensure the MSVC toolset is checked
5. Click Modify and wait for installation
6. **Restart your terminal** after installation

#### Verify Build Tools Installation

Open a **new** command prompt and run:
```bash
where cl
```

You should see a path like: `C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\cl.exe`

If you don't see this, the C++ compiler is not installed correctly.

### 2. Install Dependencies

After Build Tools are installed and terminal is restarted:

```bash
npm install
```

This will compile `better-sqlite3` and install all dependencies. It may take 2-3 minutes for the native module compilation.

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 4. Build the Project

```bash
npm run build
```

### 5. Verify Installation

```bash
node dist/cli.js --version
```

You should see the DSA Vault version number.

## About better-sqlite3

The `better-sqlite3` package is a native Node.js module that requires C++ compilation. This is why Visual Studio Build Tools with the C++ workload is mandatory on Windows.

**Common Issues:**
- Error: "missing any VC++ toolset" → The C++ compiler is not installed, follow Step 1 above
- Error: "Could not find any Visual Studio installation" → Build Tools not found, install VS 2022 Build Tools
- Error: "msvs_version not set" → Restart terminal after installing Build Tools

## Alternative: Skip better-sqlite3 (Not Recommended)

If you cannot install Visual Studio Build Tools, you can temporarily skip database functionality:

1. Remove `better-sqlite3` from package.json dependencies
2. Run `npm install`
3. Database features will not work until you add an alternative SQLite library

**Note:** This is only for development/testing. Production use requires a working database solution.

## Troubleshooting

### "gyp ERR! find VS missing any VC++ toolset"
- You installed the wrong Visual Studio components
- Solution: Run Visual Studio Installer → Modify → Select "Desktop development with C++" with MSVC toolset

### "gyp ERR! find VS could not find any Visual Studio installation"
- Build Tools are not installed or terminal hasn't been restarted
- Solution: Install VS 2022 Build Tools from step 1, then restart terminal

### Tests fail to find files
Run `npm run build` before running tests to ensure TypeScript is compiled.

### Playwright browser not found
Run `npx playwright install chromium` to download the browser binary.

### Node version mismatch
This project requires Node.js 18+. Check your version with `node --version`.
