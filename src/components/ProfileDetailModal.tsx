import React, { useState } from 'react';
import { Profile } from '../types';
import { X, Send, ShieldCheck, ChevronLeft, ChevronRight, Lock, MapPin } from 'lucide-react';

interface ProfileDetailModalProps {
  profile: Profile | null;
  botUsername: string;
  onClose: () => void;
  onRequestAvailability: (profile: Profile) => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  profile,
  botUsername,
  onClose,
  onRequestAvailability
}) => {
  // ✅ Todos los hooks ANTES de cualquier return condicional (regla de hooks de React)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  if (!profile) return null;

  const photos = profile.photos && profile.photos.length > 0
    ? profile.photos
    : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'];

  const isAvailable = profile.status === 'disponible';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl text-zinc-100 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          
          {/* Photo Lightbox Section */}
          <div className="relative bg-zinc-950 min-h-[320px] md:min-h-[480px] flex items-center justify-center">
            <img
              src={photos[activePhotoIdx]}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover max-h-[500px]"
            />

            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-950/70 text-white hover:bg-zinc-950 transition-colors border border-zinc-700/50"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setActivePhotoIdx((prev) => (prev + 1) % photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-950/70 text-white hover:bg-zinc-950 transition-colors border border-zinc-700/50"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 py-1.5 px-2.5 rounded-full bg-zinc-950/80 border border-zinc-800">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`rounded-full transition-all duration-300 ${
                        activePhotoIdx === idx
                          ? 'bg-amber-400 w-5 h-2'
                          : 'bg-zinc-600 hover:bg-zinc-400 w-2 h-2'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Profile Data & Description Section */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isAvailable
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-400 animate-pulse-status' : 'bg-rose-400'}`} />
                  {isAvailable ? 'Disponible Ahora' : profile.status === 'ocupada' ? 'Ocupada' : profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                </span>

                <span className="text-xs text-amber-300/90 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  {profile.age} años (+18)
                </span>
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight font-serif mb-1">
                {profile.name}
              </h2>

              {/* ✅ Ahora usa profile.zone en lugar del texto hardcodeado */}
              <p className="text-xs text-amber-400/90 flex items-center gap-1.5 mb-4 font-medium">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {profile.zone || 'Santa Cruz de la Sierra'} — Atención Privada Ejecutiva
              </p>

              {/* Attributes Cards */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 mb-5 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block">TARIFA SERVICIO</span>
                  <span className="text-base font-bold text-amber-400">Bs. {profile.rate_bs}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block">COMISIÓN</span>
                  <span className="text-sm font-semibold text-zinc-200">Bs. {profile.commission_bs}</span>
                </div>
              </div>

              {/* Bio Description */}
              <div className="mb-6">
                <h3 className="text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                  Descripción Pública:
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 whitespace-pre-line">
                  {profile.description}
                </p>
              </div>

              {/* Discretion Note */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 mb-6 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Atención Exclusiva:</strong> La coordinación y pago de COMISIÓN se gestionan en privado de forma rápida y directa con la Administradora vía Telegram.
                </p>
              </div>
            </div>

            {/* Bottom Primary Button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onRequestAvailability(profile);
                }}
                id={`btn-detail-request-${profile.id}`}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Solicitar Disponibilidad de {profile.name}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
