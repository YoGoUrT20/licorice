import { useState, useEffect } from 'react'
import { BranchList } from './components/BranchList'
import { Terminal } from './components/Terminal'
import { RepoSelector } from './components/RepoSelector'
import { SettingsModal } from './components/SettingsModal'

function App() {
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const [activeWorktree, setActiveWorktree] = useState<string | null>(null);
    const [recentRepos, setRecentRepos] = useState<string[]>([]);
    const [autoStart, setAutoStart] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        // Load recent repos
        const savedRecents = localStorage.getItem('licorice_recent_repos');
        if (savedRecents) {
            try {
                const parsed = JSON.parse(savedRecents);
                if (Array.isArray(parsed)) {
                    setRecentRepos(parsed);
                    // Select first one if available and no current selection
                    if (parsed.length > 0 && !currentPath) {
                        setCurrentPath(parsed[0]);
                    }
                }
            } catch (e) {
                console.error("Failed to parse recent repos", e);
            }
        }

        // Load Auto-Start preference
        const savedAutoStart = localStorage.getItem('licorice_autostart');
        if (savedAutoStart !== null) {
            setAutoStart(savedAutoStart === 'true');
        }

        // Automatic Hooks Installation
        const installHooks = async () => {
            try {
                await window.licorice.hooks.install();
                console.log("Global Git Hooks verified/installed.");
            } catch (e) {
                console.warn("Failed to auto-install hooks:", e);
                // Non-critical, just warn
            }
        };
        installHooks();
    }, []);

    const saveRecents = (repos: string[]) => {
        setRecentRepos(repos);
        localStorage.setItem('licorice_recent_repos', JSON.stringify(repos));
    }

    const handleToggleAutoStart = (enabled: boolean) => {
        setAutoStart(enabled);
        localStorage.setItem('licorice_autostart', String(enabled));
    }

    const handleRepoSelect = (path: string) => {
        setCurrentPath(path);
        setActiveWorktree(null);
    }

    const handleAddRepo = async () => {
        try {
            const path = await window.licorice.repo.select();
            if (path) {
                const newRecents = Array.from(new Set([path, ...recentRepos]));
                saveRecents(newRecents);
                handleRepoSelect(path);
            }
        } catch (error) {
            console.error('Failed to select repo', error);
        }
    };


    useEffect(() => {
        const cleanup = window.ipcRenderer.on('repo-changed', (_: any, payload: any) => {
            const root = typeof payload === 'string' ? payload : payload.root;
            const active = typeof payload === 'object' ? payload.active : null;

            console.log("Repo changed via Auto-Detect:", { root, active });

            // Allow side-effect: add to recents if not present
            setRecentRepos(prev => {
                if (!prev.includes(root)) {
                    const updated = [root, ...prev];
                    localStorage.setItem('licorice_recent_repos', JSON.stringify(updated));
                    return updated;
                }
                return prev;
            });

            setCurrentPath(root);
            setActiveWorktree(active);
        });

        return () => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gearbox-gradient text-slate-200 p-8 font-grotesk">
            <div className="p-10 bg-transparent min-h-[480px]">
                <RepoSelector
                    currentPath={currentPath}
                    recentRepos={recentRepos}
                    onSelect={handleRepoSelect}
                    onAdd={handleAddRepo}
                    autoStartEnabled={autoStart}
                    onToggleAutoStart={handleToggleAutoStart}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                />

                <div className="flex flex-col gap-[1px] bg-steel-edge border border-steel-edge shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    {currentPath ? (
                        <BranchList activeWorktree={activeWorktree} autoStart={autoStart} />
                    ) : (
                        <div className="p-8 bg-steel-base text-center text-steel-light">
                            No repository selected. Add one via the + button.
                        </div>
                    )}
                </div>

                {currentPath && (
                    <div className="mt-8">
                        <Terminal />
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
