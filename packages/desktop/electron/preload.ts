import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
console.log('Preload script loaded!');
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(channel: string, listener: (event: any, ...args: any[]) => void) {
        const subscription = (event: any, ...args: any[]) => listener(event, ...args)
        ipcRenderer.on(channel, subscription)
        return () => {
            ipcRenderer.removeListener(channel, subscription)
        }
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },
})

contextBridge.exposeInMainWorld('licorice', {
    repo: {
        select: () => ipcRenderer.invoke('repo:select'),
    },
    hooks: {
        install: () => ipcRenderer.invoke('hooks:install'),
    },
    worktree: {
        list: () => ipcRenderer.invoke('worktree:list'),
        create: (branch: string) => ipcRenderer.invoke('worktree:create', branch),
        remove: (branch: string) => ipcRenderer.invoke('worktree:remove', branch),
        link: (path: string) => ipcRenderer.invoke('worktree:link', path), // Might be deprecated but keeping to not break if used elsewhere? 
        // User removed link in main, so this will fail if called. 
        // But user request is to add waitReady. 
        waitReady: (path: string) => ipcRenderer.invoke('worktree:waitReady', path),
    },
    watcher: {
        start: () => ipcRenderer.invoke('watcher:start'),
        stop: () => ipcRenderer.invoke('watcher:stop'),
        onBranchChange: (callback: (data: any) => void) => {
            const listener = (_: any, data: any) => callback(data);
            ipcRenderer.on('branch-change', listener);
            return () => ipcRenderer.off('branch-change', listener);
        }
    },
    process: {
        onOutput: (callback: (data: { id: string, type: 'stdout' | 'stderr', data: string }) => void) => {
            const listener = (_: any, data: any) => callback(data);
            ipcRenderer.on('process-output', listener);
            return () => ipcRenderer.off('process-output', listener);
        },
        onExit: (callback: (data: { id: string, code: number }) => void) => {
            const listener = (_: any, data: any) => callback(data);
            ipcRenderer.on('process-exit', listener);
            return () => ipcRenderer.off('process-exit', listener);
        },
        start: (id: string, cmd: string, args: string[], cwd: string) => ipcRenderer.invoke('process:start', { id, cmd, args, cwd }),
        stop: (id: string) => ipcRenderer.invoke('process:stop', id)
    }
})
