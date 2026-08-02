import React, { useState, useEffect } from 'react';
import { Profile } from './types';
import { Header } from './components/Header';
import { ProfileCard } from './components/ProfileCard';
import { ProfileDetailModal } from './components/ProfileDetailModal';
import { RequestModal, TelegramUserContext } from './components/RequestModal';
import { AgeModal } from './components/AgeModal';
import { AdminPanel } from './components/AdminPanel';
import { TelegramGate } from './components/TelegramGate';
import { ShieldCheck, Heart, Send, Sparkles, AlertTriangle, Lock, UserCheck, X } from 'lucide-react';

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [requestProfile, setRequestProfile] = useState<Profile | null>(null);

  const [botUsername, setBotUsername] = useState('CatalogoVIPSCZBot');
  const [channelId, setChannelId] = useState('-1003650435412');
  const [telegramOnlyAccess, setTelegramOnlyAccess] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [pinnedText, setPinnedText] = useState('');
  const [pinnedActive, setPinnedActive] = useState(false);

  const [showIntroBanner, setShowIntroBanner] = useState(true);

  // Telegram User Context state
  const [tgUser, setTgUser] = useState<TelegramUserContext | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntroBanner(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 1. Check Telegram Mini App WebApp script
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp) {
      try {
        tgWebApp.ready();
        tgWebApp.expand();
        const unsafeUser = tgWebApp.initDataUnsafe?.user;
        if (unsafeUser && unsafeUser.id) {
          setTgUser({
            id: String(unsafeUser.id),
            first_name: unsafeUser.first_name || 'Usuario Telegram',
            username: unsafeUser.username
          });
        }
      } catch {
        // Fallback
      }
    }

    // 2. Check URL params fallback (?tg_user_id=123456&username=dani&first_name=Dani)
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('tg_user_id') || params.get('user_id') || params.get('tg_id');
    if (qId) {
      setTgUser({
        id: qId,
        first_name: params.get('first_name') || params.get('name') || 'Usuario Telegram',
        username: params.get('username') || undefined
      });
    }
  }, []);

  // Fetch Public Info & Profiles
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const [resProfiles, resInfo] = await Promise.all([
        fetch('/api/profiles'),
        fetch('/api/info')
      ]);

      if (resProfiles.ok) {
        const data = await resProfiles.json();
        setProfiles(data);
      }
      if (resInfo.ok) {
        const info = await resInfo.json();
        if (info.bot_username) setBotUsername(info.bot_username);
        if (info.channel_id) setChannelId(info.channel_id);
        if (info.telegram_only_access !== undefined) setTelegramOnlyAccess(Boolean(info.telegram_only_access));
        if (info.pinned_message_text !== undefined) setPinnedText(info.pinned_message_text);
        if (info.pinned_message_active !== undefined) setPinnedActive(Boolean(info.pinned_message_active));
      }
    } catch {
      setError('Error al cargar la lista de perfiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();

    // Check hash for direct profile link or admin token
    if (window.location.hash.startsWith('#admin')) {
      setIsAdminOpen(true);
    }

    // Subscribe to SSE for live real-time updates when Administrator updates profiles on Telegram
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = () => {
      fetchProfiles();
    };
    eventSource.addEventListener('PROFILE_UPDATED', () => fetchProfiles());
    eventSource.addEventListener('PROFILE_DELETED', () => fetchProfiles());
    eventSource.addEventListener('TELEGRAM_UPDATE', () => fetchProfiles());

    return () => {
      eventSource.close();
    };
  }, []);

  // Filter profiles by search term and status
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isBypassed = typeof window !== 'undefined' && (
    sessionStorage.getItem('telegram_gate_bypass') === 'true' ||
    Boolean(localStorage.getItem('iamdani_admin_token')) ||
    Boolean(new URLSearchParams(window.location.search).get('token'))
  );

  const isAccessAllowed = !telegramOnlyAccess || Boolean(tgUser) || isBypassed || isAdminOpen;

  if (!isAccessAllowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <TelegramGate
          botUsername={botUsername}
          onAdminClick={() => setIsAdminOpen(true)}
        />
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          botUsername={botUsername}
          channelId={channelId}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      
      {/* Age Modal Gate (+18) */}
      <AgeModal onConfirm={() => fetchProfiles()} />

      {/* Main Header & Navbar */}
      <Header
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        botUsername={botUsername}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onRefresh={fetchProfiles}
        loading={loading}
      />

      {/* Main Catalog View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro Splash Welcome Banner (desaparece automático tras 5s o con botón X) */}
        {showIntroBanner && (
          <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-950 border border-amber-500/30 p-4 sm:p-6 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <button
              onClick={() => setShowIntroBanner(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer z-20"
              title="Cerrar introducción"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Catálogo Profesional • Santa Cruz
                  </span>
                  {tgUser && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300">
                      <UserCheck className="w-3 h-3" />
                      {tgUser.first_name}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-serif">
                  Directorio Exclusivo Santa Cruz
                </h2>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Catálogo oficial actualizado en tiempo real. Trato directo y discreción absoluta.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pinned Announcement Banner from Admin */}
        {pinnedActive && pinnedText && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/40 text-amber-200 text-sm flex items-center gap-3 shadow-lg shadow-amber-500/5">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 font-medium">
              <strong className="text-amber-400 uppercase tracking-wide mr-2">[Anuncio Fijado]</strong>
              {pinnedText}
            </div>
          </div>
        )}

        {/* Profiles Grid Section */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-zinc-300 flex items-center gap-2">
              <span>Perfiles Activos</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px]">
                {filteredProfiles.length}
              </span>
            </h3>
            {searchTerm && (
              <span className="text-xs text-amber-400 font-medium">
                Búsqueda: <span className="font-bold">"{searchTerm}"</span>
              </span>
            )}
          </div>

          {loading && profiles.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-400">Cargando catálogo profesional...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-16 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-3">
              <Heart className="w-10 h-10 text-zinc-600 mx-auto" />
              <h4 className="text-base font-bold text-white">No se encontraron coincidencia de perfiles</h4>
              <p className="text-xs text-zinc-400">Intenta cambiar los términos de búsqueda o estado de disponibilidad.</p>
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('todos'); }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Restablecer catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProfiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  botUsername={botUsername}
                  onSelectProfile={(prof) => setSelectedProfile(prof)}
                  onRequestAvailability={(prof) => setRequestProfile(prof)}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Legal Footer & Discretion Disclaimer */}
      <footer className="mt-12 bg-zinc-950 border-t border-zinc-900 text-zinc-400 text-xs py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Aviso de Privacidad y Cumplimiento Legal:</strong> Este sitio opera exclusivamente como catálogo publicitario privado de servicios para adultos mayores de 18 años en Santa Cruz de la Sierra, Bolivia. Queda estrictamente prohibida la presencia o solicitud de menores de edad. Todas las coordinaciones son confidenciales entre adultos consensuados.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500 pt-2">
            <p>© {new Date().getFullYear()} Iam Dani Catálogo Santa Cruz. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 flex items-center gap-1 transition-colors">
                <Send className="w-3.5 h-3.5" /> Bot de Telegram
              </a>
              <button onClick={() => setIsAdminOpen(true)} className="hover:text-amber-400 transition-colors cursor-pointer">
                Acceso Administrativo
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Profile Detail Lightbox Modal */}
      <ProfileDetailModal
        profile={selectedProfile}
        botUsername={botUsername}
        onClose={() => setSelectedProfile(null)}
        onRequestAvailability={(prof) => setRequestProfile(prof)}
      />

      {/* Customer Availability Request Modal */}
      <RequestModal
        profile={requestProfile}
        botUsername={botUsername}
        tgUserContext={tgUser}
        onClose={() => setRequestProfile(null)}
      />

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        botUsername={botUsername}
        channelId={channelId}
      />

    </div>
  );
}
