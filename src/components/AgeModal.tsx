import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Lock, AlertTriangle, Sparkles } from 'lucide-react';

interface AgeModalProps {
  onConfirm: () => void;
}

export const AgeModal: React.FC<AgeModalProps> = ({ onConfirm }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const verified = sessionStorage.getItem('iamdani_age_verified_splash');
    if (!verified) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (!accepted) return;
    sessionStorage.setItem('iamdani_age_verified_splash', 'true');
    setIsOpen(false);
    onConfirm();
  };

  const handleReject = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-zinc-950/95 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-sm bg-zinc-900/95 border border-amber-500/40 rounded-2xl p-5 shadow-2xl shadow-amber-500/10 text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>

        <h2 className="text-lg font-extrabold text-center tracking-tight text-white mb-1">
          CATÁLOGO VIP SANTA CRUZ
        </h2>
        <p className="text-[11px] uppercase tracking-wider text-amber-400 font-bold text-center mb-4">
          Acceso Reservado y Confidencial
        </p>

        <label className="flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl cursor-pointer mb-4 hover:bg-amber-500/15 transition-colors">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="w-5 h-5 rounded border-amber-500/50 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer shrink-0"
          />
          <span className="text-xs text-amber-200 font-medium select-none">
            Soy mayor de 18+ y acepto ingresar.
          </span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={!accepted}
            id="btn-accept-age"
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              accepted
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            ENTRAR AL CATÁLOGO VIP
          </button>
          <button
            onClick={handleReject}
            id="btn-reject-age"
            className="py-3 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium text-xs transition-all cursor-pointer"
          >
            Salir
          </button>
        </div>

      </div>
    </div>
  );
};
