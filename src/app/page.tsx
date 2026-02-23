"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";
import { Explorer } from "@/components/Explorer";
import { Sidebar } from "@/components/Sidebar";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'files' | 'shared' | 'trash'>('files');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-[#09090b] text-white overflow-hidden relative selection:bg-blue-500/30">
      {/* Global Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <Sidebar userEmail={user.email || 'User'} currentView={currentView} onViewChange={setCurrentView} onSignOut={signOut} />

      <main className="flex-1 overflow-y-auto h-screen relative scrollbar-hide py-10 px-8 sm:px-12">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header Area */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
              {currentView === 'files' ? 'Pro Vault Files' : currentView === 'shared' ? 'Shared with Me' : 'Trash'}
            </h2>
            <p className="text-sm text-zinc-400">
              {currentView === 'files' ? 'Secure end-to-end encrypted storage container.' : currentView === 'shared' ? 'Secure folders and files shared directly to your email.' : 'Deleted items will be permanently removed automatically.'}
            </p>
          </div>

          <Explorer currentView={currentView} />
        </div>
      </main>
    </div>
  );
}
