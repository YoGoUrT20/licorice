import { FolderPlus } from 'lucide-react'

interface Props {
    currentPath: string | null;
    recentRepos: string[];
    onSelect: (path: string) => void;
    onAdd: () => void;
    autoStartEnabled: boolean;
    onToggleAutoStart: (enabled: boolean) => void;
}

export function RepoSelector({ currentPath, recentRepos, onSelect, onAdd, autoStartEnabled, onToggleAutoStart }: Props) {
    const getRepoName = (path: string) => {
        // Handle windows/unix paths
        const normalized = path.replace(/\\/g, '/');
        const updated = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
        return updated.split('/').pop() || 'Unknown';
    }

    return (
        <nav className="flex gap-4 mb-12 border-b-2 border-steel-light relative">
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-[2px] -mb-[2px]">
                {recentRepos.map((repo) => {
                    const isActive = currentPath === repo;
                    return (
                        <button
                            key={repo}
                            onClick={() => onSelect(repo)}
                            className={`
                                relative px-6 py-3 font-bold text-sm uppercase tracking-wider
                                transition-colors duration-300 font-grotesk
                                ${isActive ? 'text-accent-copper' : 'text-steel-light hover:text-slate-300'}
                            `}
                        >
                            {getRepoName(repo)}
                            {isActive && (
                                <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-accent-copper shadow-[0_0_15px_rgba(197,142,101,0.5)]" />
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="ml-auto flex items-center gap-6 pb-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <span className="text-xs font-bold uppercase tracking-wider text-steel-light group-hover:text-accent-copper transition-colors">
                        Auto-Launch
                    </span>
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={autoStartEnabled}
                            onChange={(e) => onToggleAutoStart(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-steel-edge rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-steel-light after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-copper peer-checked:after:bg-white peer-checked:shadow-[0_0_10px_rgba(197,142,101,0.5)]"></div>
                    </div>
                </label>

                <button
                    onClick={onAdd}
                    className="p-2 text-steel-light hover:text-accent-copper transition-colors"
                    title="Open Repository"
                >
                    <FolderPlus className="w-5 h-5" />
                </button>
            </div>
        </nav>
    )
}
