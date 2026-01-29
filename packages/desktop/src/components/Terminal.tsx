import { useEffect, useState } from 'react'
import { TerminalSquare } from 'lucide-react'

interface Log {
    id: string;
    type: 'stdout' | 'stderr';
    data: string;
    timestamp: number;
}

export function Terminal() {
    const [logs, setLogs] = useState<Log[]>([]);

    useEffect(() => {
        const cleanup = window.licorice.process.onOutput((output) => {
            setLogs(prev => [...prev.slice(-1000), { ...output, timestamp: Date.now() }]);
        });
        return cleanup;
    }, []);

    return (
        <div className="bg-black rounded-lg border border-slate-800 flex flex-col h-64">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Process Output</span>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1">
                {logs.length === 0 && (
                    <div className="text-slate-600 italic">Waiting for process output...</div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className={log.type === 'stderr' ? 'text-red-400' : 'text-slate-300'}>
                        <span className="text-slate-600 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        {log.data}
                    </div>
                ))}
            </div>
        </div>
    )
}
