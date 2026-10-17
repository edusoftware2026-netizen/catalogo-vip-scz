import React, { useState } from 'react';
import { CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';

interface AgeModalProps {
  onConfirm: () => void;
}

export const AgeModal: React.FC<AgeModalProps> = ({ onConfirm }) => {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (!accepted) return;
    sessionStorage.setItem('iamdani_age_verified_splash', 'true');
    onConfirm();
  };

  const handleReject = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950">
      <div className="w-full max-w-md bg-zinc-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-center animate-in fade-in duration-300">
        
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white mb-1 font-serif">
          CATÁLOGO VIP
        </h1>
        <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-6">
          Acceso Exclusivo & Confidencial (+18)
        </p>

        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Este sitio contiene material y servicios publicitarios dirigidos exclusivamente a adultos mayores de edad. Al acceder, confirmas que cumples con la mayoría de edad legal.
        </p>

        <label className="flex items-center gap-3 p-4 bg-zinc-950/80 border border-amber-500/30 rounded-2xl cursor-pointer mb-6 hover:border-amber-500/60 transition-colors text-left">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="w-5 h-5 rounded border-amber-500/50 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer shrink-0 accent-amber-500"
          />
          <span className="text-xs text-amber-200 font-medium select-none">
            Soy mayor de 18 años y acepto ingresar al catálogo.
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleAccept}
            disabled={!accepted}
            id="btn-accept-age"
            className={`flex-1 py-3.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
              accepted
                ? 'bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 shadow-lg shadow-amber-500/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Entrar al Catálogo
          </button>
          <button
            onClick={handleReject}
            id="btn-reject-age"
            className="py-3.5 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
          >
            Salir
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Privacidad protegida • Trato directo</span>
        </div>

      </div>
    </div>
  );
};
