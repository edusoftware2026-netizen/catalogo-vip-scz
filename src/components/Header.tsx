import React from 'react';
import { Shield, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  onExit?: () => void;
  loading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  onExit,
  loading = false
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 text-zinc-100 shadow-2xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Top Navbar */}
        <div className="flex items-center justify-between h-18 sm:h-20">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-zinc-950 font-black text-lg sm:text-xl shadow-lg shadow-amber-500/20 tracking-wider font-serif shrink-0">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-serif">
                  Iam Dani
                </h1>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Catálogo Ejecutivo & Discreto</span>
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Actualizar catálogo"
                className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}

            {onExit && (
              <button
                onClick={onExit}
                title="Salir del catálogo"
                className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-zinc-300 hover:text-rose-400 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Salir</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
