import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Play, Square } from 'lucide-react'

interface Worktree {
    path: string;
    branch?: string;
}

interface BranchListProps {
    activeWorktree?: string | null;
    autoStart: boolean;
}

export function BranchList({ activeWorktree, autoStart }: BranchListProps) {
    const [worktrees, setWorktrees] = useState<Worktree[]>([]);

    const previousWorktreesRef = useRef<Set<string>>(new Set());
    const autoStartRef = useRef(autoStart);
    const targetedWorktreeRef = useRef<string | null>(null);

    useEffect(() => {
        if (activeWorktree) {
            console.log("Active worktree prop received:", activeWorktree);
            targetedWorktreeRef.current = activeWorktree;
            refresh();
        }
    }, [activeWorktree]);

    useEffect(() => {
        autoStartRef.current = autoStart;
    }, [autoStart]);

    const [isCreating, setIsCreating] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [running, setRunning] = useState<Record<string, boolean>>({});

    const handleCreate = async () => {
        if (!newBranchName.trim()) return;
        await window.licorice.worktree.create(newBranchName);
        setNewBranchName('');
        setIsCreating(false);
        refresh(); // manual call is fine
    };

    const handleRemove = async (branch: string) => {
        if (confirm(`Stop preview for ${branch}?`)) {
            if (running[branch]) {
                await window.licorice.process.stop(`server-${branch}`);
            }
            await window.licorice.worktree.remove(branch);
            refresh();
        }
    }

    const handleToggleProcess = async (wt: Worktree, installFirst = true) => {
        if (!wt.branch) return;
        const id = `server-${wt.branch}`;

        if (running[wt.branch]) {
            await window.licorice.process.stop(id);
            setRunning(prev => ({ ...prev, [wt.branch!]: false }));
        } else {
            try {
                if (installFirst) {
                    console.log(`Waiting for worktree readiness for ${wt.branch}...`);
                    await window.licorice.worktree.waitReady(wt.path);

                    await window.licorice.process.start(id, 'bun run dev', [], wt.path);
                } else {
                    await window.licorice.process.start(id, 'bun run dev', [], wt.path);
                }

                setRunning(prev => ({ ...prev, [wt.branch!]: true }));
            } catch (e) {
                console.error("Failed to start process", e);
            }
        }
    }

    const refresh = async () => {
        try {
            const list = await window.licorice.worktree.list();
            setWorktrees(list);

            const shouldAutoStart = autoStartRef.current;
            const previousWorktrees = previousWorktreesRef.current;
            const targetedPath = targetedWorktreeRef.current;
            if (targetedPath) {
                // Normalize for robust comparison
                const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '');
                const targetNorm = normalize(targetedPath);

                const target = list.find(w => {
                    const wNorm = normalize(w.path);
                    // Exact match OR target is inside worktree (unlikely for worktree roots)
                    return wNorm === targetNorm || targetNorm.startsWith(wNorm + '/');
                });

                if (target) {
                    console.log("Executing Targeted Auto-Start for:", target.branch);
                    handleToggleProcess(target, true);
                    targetedWorktreeRef.current = null; // Clear target
                } else {
                    console.warn("Targeted worktree not found in list:", targetedPath, "List:", list.map(w => w.path));
                }
            }

            if (shouldAutoStart) {
                const currentPaths = new Set(list.map(w => w.path));
                const newWorktrees = list.filter(w => !previousWorktrees.has(w.path));

                console.log("Refresh check:", {
                    prevSize: previousWorktrees.size,
                    currentSize: currentPaths.size,
                    newCount: newWorktrees.length
                });

                // If we have previous state (known worktrees), start new ones.
                if (previousWorktrees.size > 0 && newWorktrees.length > 0) {
                    newWorktrees.forEach(wt => {
                        // Avoid double-starting if it was just targeted
                        if (wt.path.toLowerCase() !== targetedPath?.toLowerCase()) {
                            console.log("Auto-starting new worktree:", wt.branch);
                            handleToggleProcess(wt, true);
                        }
                    });
                } else if (previousWorktrees.size === 0 && list.length > 0) {
                    console.log("Initial worktree load, seeding tracker.");
                }

                previousWorktreesRef.current = currentPaths;
            } else {
                previousWorktreesRef.current = new Set(list.map(w => w.path));
            }

        } catch (error) {
            console.error('Failed to load worktrees', error);
        }
    };

    useEffect(() => {
        refresh();

        const cleanupWatcher = window.licorice.watcher.onBranchChange(() => {
            refresh();
        });

        // We rely on parent prop for targeting, but this ensures we catch refreshes too.
        const cleanupRepo = window.ipcRenderer.on('repo-changed', () => {
            console.log("Repo changed event in BranchList, refreshing...");
            refresh();
        });

        return () => {
            cleanupWatcher();
            cleanupRepo();
        };
    }, []);


    return (
        <div className="w-full">
            <div className="bg-steel-base p-4 flex justify-end items-center border-b border-steel-edge">
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="text-xs font-bold uppercase tracking-wider text-steel-light hover:text-accent-copper transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Workflow
                </button>
            </div>

            {isCreating && (
                <div className="bg-steel-base p-6 border-b border-steel-edge animate-slideIn">
                    <div className="flex gap-4 items-center">
                        <div className="text-accent-copper font-mono">{'>'}</div>
                        <input
                            type="text"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="feat/new-workflow-name"
                            className="flex-1 bg-transparent border-0 border-b border-steel-light text-slate-200 placeholder-steel-edge focus:ring-0 focus:border-accent-copper font-mono text-sm py-2 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 bg-accent-copper text-steel-base font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-white transition-colors"
                                disabled={!newBranchName.trim()}
                            >
                                Create
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-steel-light hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-[1px]">
                {worktrees.length === 0 && !isCreating && (
                    <div className="p-12 text-center bg-steel-base">
                        <div className="text-steel-edge mb-2">No active workflows</div>
                        <div className="text-xs text-steel-edge/50 font-mono">Create one to get started</div>
                    </div>
                )}

                {worktrees.map((wt) => {
                    const isActive = running[wt.branch!];
                    return (
                        <div key={wt.path} className="group flex items-center p-[20px_30px] bg-steel-base transition-[background] duration-200 ease-linear hover:bg-[#1e2124] border-l-[0px] border-accent-copper hover:border-l-[4px] relative overflow-hidden">
                            {/* Gear Icon Area */}
                            <div className="mr-[25px] text-steel-light transition-all duration-300 group-hover:text-accent-copper group-hover:rotate-90">
                                {/* Using the user's specific SVG path for the gear */}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[32px] h-[32px] transition-transform duration-[800ms] cubic-bezier(0.4, 0, 0.2, 1)">
                                    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                                </svg>
                            </div>

                            <div className="flex-grow flex flex-col font-mono" onClick={() => handleToggleProcess(wt)}>
                                <span className="text-[0.95rem] font-medium text-accent-active mb-1 cursor-pointer hover:text-white transition-colors">
                                    {wt.branch || 'Unknown Branch'}
                                </span>
                                <span className="text-[0.8rem] text-steel-light font-medium truncate max-w-[400px]">
                                    {wt.path}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleProcess(wt); }}
                                        className="p-2 text-steel-light hover:text-white transition-colors"
                                        title={isActive ? "Stop" : "Start"}
                                    >
                                        {isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemove(wt.branch!); }}
                                        className="p-2 text-steel-light hover:text-red-400 transition-colors"
                                        title="Remove Workflow"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div
                                    onClick={() => handleToggleProcess(wt)}
                                    className={`
                                        w-[10px] h-[10px] rounded-full cursor-pointer transition-all duration-300
                                        ${isActive
                                            ? 'bg-accent-copper shadow-[0_0_10px_#c58e65]'
                                            : 'bg-[#333]'
                                        }
                                    `}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
