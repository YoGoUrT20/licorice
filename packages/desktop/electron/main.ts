import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, shell } from 'electron'

// Fix for Windows Notifications showing 'electron.app.Electron'
// Must match appId in electron-builder.json
if (process.platform === 'win32') {
    app.setAppUserModelId('com.licorice.app');
}
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Watcher, WorktreeManager, ProcessManager } from '@licorice/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let tray: Tray | null = null;
let isQuitting = false;

import { dialog } from 'electron'

import { startServer } from './server.ts'

// Services state
let watcher: Watcher | null = null;
let worktreeManager: WorktreeManager | null = null;
const processManager = new ProcessManager(); // Global process manager is fine
let server: ReturnType<typeof import('http')['createServer']> | null = null;

// Allow global extension
declare global {
    var lastNotifiedUrl: string | null;
}

import { Store } from './store.ts';
const settingsStore = new Store({
    name: 'settings',
    defaults: {
        runOnStartup: false,
        closeToTray: true,
        notifyOnServerStart: true,
        openBrowserOnStart: true
    }
});

// Sync startup settings
app.setLoginItemSettings({
    openAtLogin: settingsStore.get('runOnStartup'),
    path: process.execPath
});

async function initializeServices(projectRoot: string) {
    if (watcher) {
        await watcher.stop();
        watcher.removeAllListeners();
    }

    watcher = new Watcher(projectRoot);
    worktreeManager = new WorktreeManager(projectRoot);

    // Re-attach listeners
    watcher.on('branch-change', (data) => {
        win?.webContents.send('branch-change', data);
    });

    watcher.on('ready', () => {
        win?.webContents.send('watcher-ready');
    });

    await watcher.start();
    return projectRoot;
}


const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

import { existsSync } from 'node:fs'

function createTray() {
    const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC as string, 'icon.png'));
    tray = new Tray(icon);
    tray.setToolTip('Licorice');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Licorice',
            click: () => win?.show()
        },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        win?.show();
    });

    // Some OS might behave differently with single click
    tray.on('click', () => {
        win?.show();
    });
}

function createWindow() {
    let preloadPath = path.join(__dirname, 'preload.mjs');

    if (!app.isPackaged && !existsSync(preloadPath)) {
        preloadPath = path.join(__dirname, '../dist-electron/preload.mjs');
    }

    console.log('Preload Path Resolved:', preloadPath);

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png'),
        webPreferences: {
            preload: preloadPath,
        },
    })

    win.on('close', (event) => {
        const closeToTray = settingsStore.get('closeToTray');
        if (!isQuitting && closeToTray) {
            event.preventDefault();
            win?.hide();
            return false;
        }
        // If NOT closeToTray, we exit normally, which triggers window-all-closed -> quit (except Mac)
    });

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    // win.webContents.openDevTools();

    // Watcher Events
    // Process Events (Global)
    processManager.on('output', (data) => {
        win?.webContents.send('process-output', data);

        // Server Detection Logic
        // Look for: "Local: http://localhost:PORT" or "http://localhost:PORT"
        if (data && data.data) {
            const str = data.data.toString();
            // Regex to find http://localhost URLs
            // Vite: "  Local:   http://localhost:5173/"
            // Next: "- Local:        http://localhost:3000"
            const urlMatch = str.match(/http:\/\/localhost:[0-9]+/);

            if (urlMatch) {
                const url = urlMatch[0];
                console.log(`[Main] Detected Server URL: ${url}`);

                // Debounce/Check if we already notified for this process/url recently?
                // For now, simplistically fire if settings allow. 
                // We assume the user won't get spam within the same millisecond, but to avoid multi-line spam:
                // We could use a Set of notified items or just fire.

                // We will use a simple cache to avoid spamming the same URL
                if (global.lastNotifiedUrl !== url) {
                    global.lastNotifiedUrl = url;

                    if (settingsStore.get('notifyOnServerStart')) {
                        new Notification({
                            title: 'Web Server Started',
                            body: `Available at: ${url}`,
                            icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png')
                        }).show();
                    }

                    if (settingsStore.get('openBrowserOnStart')) {
                        shell.openExternal(url);
                    }

                    // Reset cache after 10 seconds to allow re-notification if restarted
                    setTimeout(() => { global.lastNotifiedUrl = null; }, 10000);
                }
            }
        }
    });
    processManager.on('exit', (data) => {
        win?.webContents.send('process-exit', data);
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST as string, 'index.html'))
    }
}

app.on('before-quit', () => {
    isQuitting = true;
    if (server) server.close();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    } else {
        win?.show();
    }
})

// IPC Handlers
ipcMain.handle('repo:select', async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const selectedPath = result.filePaths[0];
    await initializeServices(selectedPath);
    return selectedPath;
});

ipcMain.handle('worktree:list', async () => {
    console.log("[IPC] worktree:list called");
    if (!worktreeManager) {
        console.error("[IPC] WorktreeManager not initialized");
        throw new Error("No repository selected");
    }
    const list = await worktreeManager.list();
    console.log(`[IPC] Returning ${list.length} worktrees`);
    return list;
});

ipcMain.handle('worktree:create', async (_, branch: string) => {
    if (!worktreeManager) throw new Error("No repository selected");
    return await worktreeManager.create(branch);
});

ipcMain.handle('worktree:remove', async (_, branch: string) => {
    if (!worktreeManager) throw new Error("No repository selected");
    return await worktreeManager.remove(branch);
});

ipcMain.handle('watcher:start', async () => {
    if (watcher) await watcher.start();
});

ipcMain.handle('watcher:stop', () => {
    if (watcher) watcher.stop();
});

ipcMain.handle('process:start', async (_, { id, cmd, args, cwd }) => {
    try {
        processManager.start(id, cmd, args, cwd);
        return true;
    } catch (e: any) {
        console.error(`Failed to start process ${id}`, e);
        throw e;
    }
});

ipcMain.handle('worktree:waitReady', async (_, targetPath: string) => {
    console.log(`[IPC] Waiting for worktree ready: ${targetPath}`);
    const start = Date.now();
    const timeout = 120000; // 2 minutes timeout (copying node_modules can be slow)

    let prevCount = -1;
    let stabilityCounter = 0;
    const STABILITY_THRESHOLD = 5; // 5 consecutive stable checks (5 seconds)
    const POLL_INTERVAL = 1000; // Check every second to reduce IO contention (ENOTEMPTY/EBUSY mitigation)

    while (Date.now() - start < timeout) {
        try {
            await fs.access(path.join(targetPath, 'package.json'));

            const nodeModulesPath = path.join(targetPath, 'node_modules');
            await fs.access(nodeModulesPath);

            const items = await fs.readdir(nodeModulesPath);
            const count = items.length;

            if (count > 0 && count === prevCount) {
                stabilityCounter++;
            } else {
                // Reset if count changed or is 0
                if (count !== prevCount) {
                    console.log(`[IPC] Count changed: ${prevCount} -> ${count}`);
                }
                stabilityCounter = 0;
            }

            console.log(`[IPC] ${targetPath} items: ${count}, stable: ${stabilityCounter}/${STABILITY_THRESHOLD}`);
            prevCount = count;

            if (stabilityCounter >= STABILITY_THRESHOLD) {
                console.log(`[IPC] Worktree stable (files copied): ${targetPath}`);
                return true;
            }

            await new Promise(r => setTimeout(r, POLL_INTERVAL));
        } catch (e: any) {
            // Ignore common FS errors during copy/creation
            if (e.code === 'ENOENT' || e.code === 'ENOTEMPTY' || e.code === 'EBUSY') {
                // Directory doesn't exist yet, or is being written to, wait
            } else {
                console.warn(`[IPC] Error checking worktree: ${e.message}`);
            }

            stabilityCounter = 0;
            prevCount = -1;
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
        }
    }
    throw new Error(`Timeout waiting for worktree ${targetPath} to be ready`);
});


import fs from 'node:fs/promises';
import { execa } from 'execa';
import os from 'node:os';


ipcMain.handle('hooks:install', async () => {
    try {
        const homeDir = os.homedir();
        const hooksDir = path.join(homeDir, '.licorice', 'hooks');
        const sourcePath = app.isPackaged
            ? path.join(process.resourcesPath, 'resources/post-checkout')
            : path.join(__dirname, '../resources/post-checkout');

        // Create dir
        await fs.mkdir(hooksDir, { recursive: true });

        // Copy hook
        const targetPath = path.join(hooksDir, 'post-checkout');
        await fs.copyFile(sourcePath, targetPath);

        // await fs.chmod(targetPath, '755'); 

        // Configure Global Git
        // git config --global core.hooksPath ~/.licorice/hooks
        await execa('git', ['config', '--global', 'core.hooksPath', hooksDir]);

        return true;
    } catch (e: any) {
        console.error("Failed to install hooks", e);
        throw e;
    }
});

ipcMain.handle('process:stop', async (_, id) => {
    return processManager.stop(id);
});

// Settings Handlers
ipcMain.handle('settings:get', (_, key) => settingsStore.get(key));
ipcMain.handle('settings:getAll', () => settingsStore.getAll());
ipcMain.handle('settings:set', (_, key, value) => {
    settingsStore.set(key, value);

    // Side effects
    if (key === 'runOnStartup') {
        app.setLoginItemSettings({
            openAtLogin: value,
            path: process.execPath
        });
    }
    return true;
});

app.whenReady().then(async () => {
    // Explicitly setup Bun environment on startup
    try {
        console.log("[Main] resolving Bun environment...");
        const { stdout: version } = await execa('bun', ['--version']);
        console.log(`[Main] Bun version: ${version}`);

        const { stdout: cachePath } = await execa('bun', ['pm', 'cache']);
        if (cachePath) {
            const cleanPath = cachePath.trim();
            console.log(`[Main] Setting BUN_INSTALL_CACHE_DIR to: ${cleanPath}`);
            process.env.BUN_INSTALL_CACHE_DIR = cleanPath;
        }

        // Debug logging
        console.log(`[Main] USERPROFILE: ${process.env.USERPROFILE}`);
        console.log(`[Main] LOCALAPPDATA: ${process.env.LOCALAPPDATA}`);
    } catch (e) {
        console.error("[Main] Failed to resolve Bun environment:", e);
    }

    createTray();
    createWindow();

    // Start notification server
    server = startServer((repoPath, url) => {
        console.log("Received repo change notification:", repoPath, url);

        // Normalize path if it comes from Git Bash (e.g. /c/Users/...)
        // Simple regex to replace leading /c/ with C:/ (and other drive letters)
        let normalizedPath = repoPath;
        const gitBashMatch = repoPath.match(/^\/([a-zA-Z])\/(.*)$/);
        if (gitBashMatch) {
            const drive = gitBashMatch[1].toUpperCase();
            const rest = gitBashMatch[2];
            normalizedPath = `${drive}:/${rest}`;
            console.log("Normalized Git Bash path to:", normalizedPath);
        }

        console.log("Received path:", normalizedPath);

        // Notification moved to after worktree resolution to get full context

        // Resolve the "Main" worktree if we are inside a linked worktree (like Cursor agent worktrees)
        // Command: git -C <path> worktree list --porcelain
        // The first 'worktree' entry is ALWAYS the main repository root.
        execa('git', ['-C', normalizedPath, 'worktree', 'list', '--porcelain'])
            .then(({ stdout }) => {
                const lines = stdout.split('\n');
                const firstWorktreeLine = lines.find(line => line.startsWith('worktree '));
                if (firstWorktreeLine) {
                    const rootPath = firstWorktreeLine.substring(9).trim();
                    console.log("Resolved Main Repository Root:", rootPath);

                    // Show notification with context
                    // ONLY Notify on Repo Change if we want that... 
                    // User requested "Notification on Web Server Launch", which we now handle via process output.
                    // The previous "Licorice Server Detected" here was misleading. 
                    // We can keep a subtle "Switched to..." notification or remove it.
                    // For now, removing the misleading notification to avoid confusion with the REAL server start.
                    /*
                   if (settingsStore.get('notifyOnServerStart')) {
                       const repoName = path.basename(rootPath);
                       const worktreeName = path.basename(normalizedPath);
                       const body = (normalizedPath === rootPath) 
                           ? `Repo: ${repoName}` 
                           : `${repoName} | ${worktreeName}`;

                       new Notification({
                           title: 'Repository Switched',
                           body: body,
                           icon: path.join(process.env.VITE_PUBLIC as string, 'icon.png')
                       }).show();
                   }
                   */

                    // We definitely don't want to try opening a browser here unless we have a URL from the hook (which we don't)
                    if (settingsStore.get('openBrowserOnStart') && url) {
                        shell.openExternal(url);
                    }

                    return rootPath;
                }
                return normalizedPath;
            })
            .catch(e => {
                console.warn("Failed to resolve worktree root, using raw path:", e);
                return normalizedPath;
            })
            .then(finalPath => {
                console.log("Switching to repo:", finalPath);
                return initializeServices(finalPath).then(() => finalPath);
            })
            .then((path) => {
                if (win) {
                    // Send both the Project Root (for app context) and the Active Worktree (for auto-start)
                    win.webContents.send('repo-changed', { root: path, active: normalizedPath });
                }
            })
            .catch(err => {
                console.error("Failed to switch repo:", err);
            });
    });
})
