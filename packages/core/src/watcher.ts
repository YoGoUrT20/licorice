import chokidar from 'chokidar';
import path from 'path';
import { EventEmitter } from 'events';

export class Watcher extends EventEmitter {
    private watcher: chokidar.FSWatcher | null = null;
    private ready: boolean = false;

    constructor(private rootPath: string) {
        super();
    }

    public async start() {
        // Watch .git/refs/heads to detect new branches
        const watchPath = path.join(this.rootPath, '.git', 'refs', 'heads');

        console.log(`Starting watcher on ${watchPath}`);

        this.watcher = chokidar.watch(watchPath, {
            persistent: true,
            ignoreInitial: false, // We want initial branches too? Maybe.
            depth: 1
        });

        this.watcher
            .on('add', (path) => this.handleBranchChange('add', path))
            .on('change', (path) => this.handleBranchChange('change', path))
            .on('unlink', (path) => this.handleBranchChange('unlink', path))
            .on('ready', () => {
                this.ready = true;
                this.emit('ready');
            });
    }

    public stop() {
        if (this.watcher) {
            this.watcher.close();
        }
    }

    private handleBranchChange(event: string, filePath: string) {
        const branchName = path.basename(filePath);
        console.log(`Detected ${event} on branch: ${branchName}`);
        this.emit('branch-change', { event, branchName });
    }
}
