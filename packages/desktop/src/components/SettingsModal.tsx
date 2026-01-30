
import { X, Settings as SettingsIcon } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Settings {
    runOnStartup: boolean;
    closeToTray: boolean;
    notifyOnServerStart: boolean;
    openBrowserOnStart: boolean;
}


interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: Props) {
    const [settings, setSettings] = useState<Settings>({
        runOnStartup: false,
        closeToTray: true,
        notifyOnServerStart: true,
        openBrowserOnStart: true
    });

    useEffect(() => {
        if (isOpen) {
            window.licorice.settings.getAll().then((data) => {
                if (data) setSettings(data);
            });
        }
    }, [isOpen]);

    const updateSetting = (key: keyof Settings, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.licorice.settings.set(key, value);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center font-grotesk" onClick={onClose}>
            <div className="bg-steel-base border border-steel-edge shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[600px] p-8 relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-steel-light hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-4 mb-8 pb-4 border-b border-steel-edge">
                    <SettingsIcon className="w-8 h-8 text-accent-copper" />
                    <h2 className="text-2xl font-bold uppercase tracking-wider text-white">
                        Settings
                    </h2>
                </div>

                <div className="space-y-8">
                    {/* Run on Startup */}
                    <div className="flex items-center justify-between group">
                        <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-200 group-hover:text-accent-copper transition-colors">Run on Startup</div>
                            <div className="text-sm text-steel-light">Automatically launch Licorice when you log in.</div>
                        </div>
                        <Toggle
                            checked={settings.runOnStartup}
                            onChange={(v) => updateSetting('runOnStartup', v)}
                        />
                    </div>

                    {/* Close Behavior */}
                    <div className="flex items-center justify-between group">
                        <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-200 group-hover:text-accent-copper transition-colors">Fully Close on Exit</div>
                            <div className="text-sm text-steel-light">Quit the application instead of minimizing to tray.</div>
                        </div>
                        <Toggle
                            checked={!settings.closeToTray}
                            onChange={(v) => updateSetting('closeToTray', !v)}
                        />
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between group">
                        <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-200 group-hover:text-accent-copper transition-colors">Server Notifications</div>
                            <div className="text-sm text-steel-light">Show notification when a web server launches.</div>
                        </div>
                        <Toggle
                            checked={settings.notifyOnServerStart}
                            onChange={(v) => updateSetting('notifyOnServerStart', v)}
                        />
                    </div>

                    {/* Open in Browser */}
                    <div className="flex items-center justify-between group">
                        <div className="space-y-1">
                            <div className="font-bold text-lg text-slate-200 group-hover:text-accent-copper transition-colors">Auto-Open in Browser</div>
                            <div className="text-sm text-steel-light">Automatically open the web app in browser when it starts.</div>
                        </div>
                        <Toggle
                            checked={settings.openBrowserOnStart}
                            onChange={(v) => updateSetting('openBrowserOnStart', v)}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="w-14 h-7 bg-steel-edge border border-steel-light rounded-full peer peer-checked:after:translate-x-[28px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-steel-light after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-copper peer-checked:after:bg-white peer-checked:shadow-[0_0_10px_rgba(197,142,101,0.5)] transition-colors"></div>
        </label>
    )
}
