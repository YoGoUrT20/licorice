import { execa, ExecaChildProcess } from 'execa';
import { EventEmitter } from 'events';

export class ProcessManager extends EventEmitter {
    private processes: Map<string, ExecaChildProcess> = new Map();

    start(id: string, command: string, args: string[], cwd: string) {

        const env: any = {
            ...process.env,
            // (required by bun)
            HOME: process.env.HOME || process.env.USERPROFILE,
            BUN_INSTALL_CACHE_DIR: process.env.BUN_INSTALL_CACHE_DIR ||
                (process.env.USERPROFILE ? `${process.env.USERPROFILE}\\.bun\\install\\cache` : undefined),
            APPDATA: process.env.APPDATA,
            LOCALAPPDATA: process.env.LOCALAPPDATA,
            PATH: process.env.PATH || (process.env as any).Path
        };

        console.log(`[ProcessManager] Spawning in ${cwd}`);
        console.log(`[ProcessManager] BUN_INSTALL_CACHE_DIR: ${env.BUN_INSTALL_CACHE_DIR}`);

        const subprocess = execa(command, args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
            shell: process.platform === 'win32' ? 'powershell.exe' : true,
            windowsHide: true
        });

        if (subprocess.stdout) {
            subprocess.stdout.on('data', (data) => {
                this.emit('output', { id, type: 'stdout', data: data.toString() });
            });
        }

        if (subprocess.stderr) {
            subprocess.stderr.on('data', (data) => {
                this.emit('output', { id, type: 'stderr', data: data.toString() });
            });
        }

        subprocess.on('exit', (code) => {
            this.emit('exit', { id, code });
            this.processes.delete(id);
        });

        this.processes.set(id, subprocess as any); // Cast if compatibility issues
        return subprocess;
    }

    stop(id: string) {
        const subprocess = this.processes.get(id);
        if (subprocess) {
            if (subprocess.pid) {
                import('tree-kill').then(kill => {
                    kill.default(subprocess.pid as number, 'SIGKILL', (err) => {
                        if (err) console.error(`Failed to kill process ${id}`, err);
                    });
                });
            } else {
                subprocess.kill();
            }
            this.processes.delete(id);
        }
    }

    stopAll() {
        for (const id of this.processes.keys()) {
            this.stop(id);
        }
    }
}
