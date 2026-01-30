export interface IElectronAPI {
    loadPreferences: () => Promise<void>,
}

declare global {
    interface Window {
        ipcRenderer: {
            on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void;
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            send: (channel: string, ...args: any[]) => void;
            // removeListener is NOT exposed in preload, so don't include it here to avoid confusion
        }
        licorice: {
            repo: {
                select: () => Promise<string | null>
            },
            hooks: {
                install: () => Promise<boolean>
            },
            worktree: {
                list: () => Promise<any[]>,
                create: (branch: string) => Promise<any>,
                remove: (branch: string) => Promise<void>,
                link: (path: string) => Promise<boolean>,
                waitReady: (path: string) => Promise<boolean>
            },
            watcher: {
                start: () => Promise<void>,
                stop: () => Promise<void>,
                onBranchChange: (callback: (data: any) => void) => () => void
            },
            process: {
                onOutput: (callback: (data: { id: string, type: 'stdout' | 'stderr', data: string }) => void) => () => void,
                onExit: (callback: (data: { id: string, code: number }) => void) => () => void,
                start: (id: string, cmd: string, args: string[], cwd: string) => Promise<boolean>,
                stop: (id: string) => Promise<void>
            },
            settings: {
                get: (key: string) => Promise<any>,
                getAll: () => Promise<any>,
                set: (key: string, value: any) => Promise<void>
            }
        }
    }
}
