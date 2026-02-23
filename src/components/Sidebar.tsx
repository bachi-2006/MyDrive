import { HardDrive, Share2, Trash2, LogOut, Cloud } from "lucide-react";

export function Sidebar({ userEmail, currentView, onViewChange, onSignOut }: { userEmail: string; currentView: 'files' | 'shared' | 'trash'; onViewChange: (view: 'files' | 'shared' | 'trash') => void; onSignOut: () => void }) {
    return (
        <aside className="w-64 h-screen border-r border-white/5 bg-black/20 backdrop-blur-xl hidden md:flex flex-col p-6 shrink-0 relative flex-shrink-0 z-10">
            {/* Logo area */}
            <div className="flex items-center gap-3 mb-10 pl-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <Cloud className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white leading-none">MyDisk</h1>
                    <span className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold">Pro Vault</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                <button
                    onClick={() => onViewChange('files')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${currentView === 'files' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    <HardDrive className="w-5 h-5" />
                    My Files
                </button>
                <button
                    onClick={() => onViewChange('shared')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${currentView === 'shared' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    <Share2 className="w-5 h-5" />
                    Shared with Me
                </button>
                <button
                    onClick={() => onViewChange('trash')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${currentView === 'trash' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    <Trash2 className="w-5 h-5" />
                    Trash
                </button>
            </nav>

            {/* Storage Usage Widget */}
            <div className="mt-auto mb-6 bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-zinc-300">Storage</span>
                    <span className="text-xs font-medium text-blue-400">42%</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-[42%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                </div>
                <p className="text-[11px] text-zinc-500 text-center">4.2 GB of 10 GB used</p>
            </div>

            {/* User Area */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{userEmail.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-xs font-medium text-zinc-300 truncate pr-2">{userEmail}</span>
                </div>
                <button
                    onClick={onSignOut}
                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                    title="Lock Vault"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </aside>
    );
}
