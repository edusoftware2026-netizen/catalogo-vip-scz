import React from 'react';
import { Shield, Send, RefreshCw, Search, SlidersHorizontal, Settings } from 'lucide-react';

interface HeaderProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  botUsername: string;
  onOpenAdmin: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  botUsername,
  onOpenAdmin,
  onRefresh,
  loading
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 text-zinc-100 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Navbar */}
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center text-zinc-950 font-black text-xl shadow-lg shadow-amber-500/20 tracking-wider font-serif">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white font-serif">
                  Iam Dani
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  Santa Cruz
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Catálogo Ejecutivo & Discreto</span>
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Actualizar catálogo"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* ✅ Visible en mobile (solo ícono), texto en sm+ */}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Bot Telegram @${botUsername}`}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-linear-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/10"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Bot de Telegram</span>
            </a>

            <button
              onClick={onOpenAdmin}
              id="btn-open-admin-header"
              title="Panel de Administración"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 text-zinc-200 hover:text-amber-400 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-amber-400" />
            </button>
          </div>

        </div>

        {/* Filter Bar */}
        <div className="py-3 border-t border-zinc-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre o característica..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900/90 border border-zinc-800/90 rounded-xl text-zinc-200 text-xs focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-zinc-500"
            />
          </div>

          {/* ✅ Filtro completo con los 5 estados */}
          <div className="flex items-center justify-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={statusFilter}
                onChange={e => onStatusFilterChange(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer appearance-none pr-7"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="todos">Todos los perfiles</option>
                <option value="disponible">🟢 Disponibles ahora</option>
                <option value="ocupada">🔴 Ocupadas</option>
                <option value="pausada">⏸️ Pausadas</option>
                <option value="borrador">📁 Borradores</option>
                <option value="retirada">🗑️ Retiradas</option>
              </select>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
