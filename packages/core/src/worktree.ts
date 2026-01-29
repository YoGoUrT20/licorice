import { simpleGit, SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

export interface Worktree {
    path: string;
    branch?: string;
}

export class WorktreeManager {
    private git: SimpleGit;
    private worktreeRoot: string;

    constructor(private projectRoot: string) {
        this.git = simpleGit(projectRoot);
        this.worktreeRoot = path.join(projectRoot, '.licorice', 'previews');
    }

    async init() {
        try {
            await fs.mkdir(this.worktreeRoot, { recursive: true });
        } catch (e) {
            // ignore, likely exists
        }
    }

    async list(): Promise<Worktree[]> {
        try {
            console.log(`[WorktreeManager] Listing worktrees for root: ${this.projectRoot}`);
            const result = await this.git.raw(['worktree', 'list', '--porcelain']);
            console.log(`[WorktreeManager] Raw git output:\n${result}`);
            return this.parseWorktrees(result);
        } catch (e) {
            console.error('[WorktreeManager] Failed to list worktrees', e);
            return [];
        }
    }

    async create(branchName: string) {
        await this.init();
        const targetPath = path.join(this.worktreeRoot, branchName);

        // Check if worktree already exists ?
        // git worktree add <path> <branch>

        try {
            console.log(`Creating worktree for ${branchName} at ${targetPath}`);
            // Check if branch exists
            try {
                await this.git.revparse(['--verify', branchName]);
                // Exists, add worktree
                await this.git.raw(['worktree', 'add', targetPath, branchName]);
            } catch (e) {
                // Doesn't exist, create new branch
                await this.git.raw(['worktree', 'add', '-b', branchName, targetPath]);
            }

            return { path: targetPath, branch: branchName };
        } catch (e: any) {
            if (e.message && e.message.includes('already exists')) {
                return { path: targetPath, branch: branchName };
            }
            throw new Error(`Failed to create worktree for ${branchName}: ${e.message}`);
        }
    }

    async remove(branchName: string) {
        const targetPath = path.join(this.worktreeRoot, branchName);
        // git worktree remove <path>
        try {
            await this.git.raw(['worktree', 'remove', targetPath, '--force']);
        } catch (e) {
            console.error(`Failed to remove worktree ${branchName}`, e);
        }
    }

    private parseWorktrees(output: string): Worktree[] {
        const lines = output.split('\n');
        const trees: Worktree[] = [];
        let current: Partial<Worktree> = {};

        const commitTree = () => {
            if (!current.path) {
                current = {};
                return;
            }

            const worktreePath = path.resolve(current.path);
            const managedRoot = path.resolve(this.worktreeRoot);
            const projectRoot = path.resolve(this.projectRoot);

            const isManaged = worktreePath.toLowerCase().startsWith(managedRoot.toLowerCase());
            const isCursor = worktreePath.toLowerCase().includes('.cursor') || worktreePath.toLowerCase().includes('worktrees');
            const isMain = worktreePath.toLowerCase() === projectRoot.toLowerCase();

            // console.log(`Checking worktree: ${worktreePath}`);
            // console.log(`  Managed: ${isManaged}, Cursor: ${isCursor}, Main: ${isMain}`);

            if (isManaged || isMain || isCursor) {
                trees.push(current as Worktree);
            } else {
                console.log(`Filtered out worktree: ${worktreePath}`);
            }
            current = {};
        };

        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                if (current.path) commitTree();
                current = { path: line.substring(9) };
            } else if (line.startsWith('branch ')) {
                current.branch = line.substring(7).replace('refs/heads/', '');
            } else if (line.startsWith('detached')) {
                current.branch = 'Detached HEAD';
            } else if (line.trim() === '' && current.path) {
                commitTree();
            }
        }
        if (current.path) commitTree();

        // Post-processing: If branch is 'Detached HEAD' or missing, use folder basename
        trees.forEach(t => {
            if (!t.branch || t.branch === 'Detached HEAD') {
                const basename = path.basename(t.path);
                // Maybe prefix with 'Cursor: ' if path contains .cursor?
                if (t.path.includes('.cursor')) {
                    t.branch = `Cursor: ${basename}`;
                } else {
                    t.branch = basename; // e.g. 'hax'
                }
            }
        });

        console.log(`Parsed ${trees.length} worktrees from ${lines.length} lines of output.`);
        trees.forEach(t => console.log(` - ${t.branch} (${t.path})`));

        return trees;
    }
}
