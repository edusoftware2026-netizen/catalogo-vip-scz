import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { Header } from '../components/Header';
import { ProfileCard } from '../components/ProfileCard';
import { ProfileDetailModal, TelegramUserContext } from '../components/ProfileDetailModal';
import { AgeModal } from '../components/AgeModal';
import { ShieldCheck, Heart, Send, Sparkles, AlertTriangle, UserCheck, X } from 'lucide-react';

export const CatalogApp: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const [botUsername, setBotUsername] = useState('CatalogoVIPSCZBot');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [adminContactUsername, setAdminContactUsername] = useState('danii001');
  const [pinnedText, setPinnedText] = useState('');
  const [pinnedActive, setPinnedActive] = useState(false);

  const [showIntroBanner, setShowIntroBanner] = useState(true);

  // Age gate state (pantalla inicial obligatoria +18)
  const [isAgeVerified, setIsAgeVerified] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('iamdani_age_verified_splash') === 'true';
  });

  // Telegram User Context state
  const [tgUser, setTgUser] = useState<TelegramUserContext | null>(null);

  // Initialize Telegram WebApp SDK & document title
  useEffect(() => {
    document.title = 'Iam Dani • Catálogo VIP Santa Cruz';

    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp) {
      try {
        tgWebApp.ready();
        tgWebApp.expand();
        if (typeof tgWebApp.setHeaderColor === 'function') {
          tgWebApp.setHeaderColor('#09090b');
        }
        if (typeof tgWebApp.setBackgroundColor === 'function') {
          tgWebApp.setBackgroundColor('#09090b');
        }
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

    // URL fallback (?tg_user_id=123&first_name=Nombre)
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntroBanner(false);
    }, 5000);
    return () => clearTimeout(timer);
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
        if (info.qr_image_url) setQrImageUrl(info.qr_image_url);
        if (info.admin_contact_username) setAdminContactUsername(info.admin_contact_username);
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

    // Subscribe to SSE for live real-time updates
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'PROFILE_UPDATE' || payload.type === 'INITIAL_STATE') {
          fetchProfiles();
        }
      } catch {
        // Ignore parse error
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExitApp = () => {
    // 1. En Telegram Mini App, cerrar la Mini App completamente
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp && typeof tgWebApp.close === 'function') {
      tgWebApp.close();
      return;
    }

    // 2. En navegador web, reiniciar la verificación de edad (+18)
    sessionStorage.removeItem('iamdani_age_verified_splash');
    setIsAgeVerified(false);
  };

  // Pantalla inicial obligatoria de +18
  if (!isAgeVerified) {
    return (
      <AgeModal
        onConfirm={() => {
          setIsAgeVerified(true);
          fetchProfiles();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      
      {/* Header del Catálogo con botón Salir y Actualizar */}
      <Header
        onRefresh={fetchProfiles}
        onExit={handleExitApp}
        loading={loading}
      />

      {/* Vista Principal del Catálogo */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Banner de bienvenida temporal */}
        {showIntroBanner && (
          <div className="relative rounded-2xl bg-linear-to-r from-zinc-900 via-zinc-900/95 to-zinc-950 border border-amber-500/30 p-4 sm:p-6 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
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
                    Catálogo Profesional
                  </span>
                  {tgUser && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 border border-sky-500/40 text-sky-300">
                      <UserCheck className="w-3 h-3" />
                      {tgUser.first_name}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-serif">
                  Directorio Exclusivo
                </h2>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Catálogo oficial actualizado en tiempo real. Trato directo y discreción absoluta.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mensaje fijado por la administración */}
        {pinnedActive && pinnedText && (
          <div className="mb-6 p-4 rounded-2xl bg-linear-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/40 text-amber-200 text-sm flex items-center gap-3 shadow-lg shadow-amber-500/5">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 font-medium">
              <strong className="text-amber-400 uppercase tracking-wide mr-2">[Anuncio Fijado]</strong>
              {pinnedText}
            </div>
          </div>
        )}

        {/* Sección de cuadrícula de perfiles */}
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
              <h4 className="text-base font-bold text-white">No se encontraron perfiles</h4>
              <p className="text-xs text-zinc-400">No hay perfiles disponibles en este momento.</p>
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
                  onRequestAvailability={(prof) => setSelectedProfile(prof)}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Footer Legal para Clientes (Sin enlaces de administración) */}
      <footer className="mt-12 bg-zinc-950 border-t border-zinc-900 text-zinc-400 text-xs py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Aviso de Privacidad y Cumplimiento Legal:</strong> Este sitio opera exclusivamente como catálogo publicitario privado de servicios para adultos mayores de 18 años. Queda estrictamente prohibida la presencia o solicitud de menores de edad. Todas las coordinaciones son confidenciales entre adultos consensuados.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500 pt-2">
            <p>© {new Date().getFullYear()} Iam Dani Catálogo. Todos los derechos reservados.</p>
            <div className="flex items-center gap-4">
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 flex items-center gap-1 transition-colors">
                <Send className="w-3.5 h-3.5" /> Bot de Telegram
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal de Detalle Único con Fotos, QR, Comisión y Envío de Comprobante */}
      <ProfileDetailModal
        profile={selectedProfile}
        botUsername={botUsername}
        qrImageUrl={qrImageUrl}
        adminContactUsername={adminContactUsername}
        tgUserContext={tgUser}
        onClose={() => setSelectedProfile(null)}
      />

    </div>
  );
};

