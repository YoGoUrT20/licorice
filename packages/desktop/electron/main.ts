import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
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
        if (!isQuitting) {
            event.preventDefault();
            win?.hide();
            return false;
        }
    });

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    // win.webContents.openDevTools();

    // Watcher Events
    // Process Events (Global)
    processManager.on('output', (data) => {
        win?.webContents.send('process-output', data);
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
    server = startServer((repoPath) => {
        console.log("Received repo change notification:", repoPath);

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
