import React, { useState } from 'react';
import { Lock, Send, ShieldAlert, KeyRound } from 'lucide-react';

interface TelegramGateProps {
  botUsername: string;
  onAdminClick: () => void;
}

export const TelegramGate: React.FC<TelegramGateProps> = ({ botUsername, onAdminClick }) => {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');

  const cleanUsername = (botUsername || 'catalogovipscz').replace(/^@/, '').trim();
  const botUrl = `https://t.me/${cleanUsername}`;

  const handleBypassCode = (e: React.FormEvent) => {
    e.preventDefault();
    // ✅ Solo acepta el código exacto — eliminado bypass por longitud (> 6 chars)
    if (accessCode.trim() === 'dani2026') {
      sessionStorage.setItem('telegram_gate_bypass', 'true');
      window.location.reload();
    } else {
      setError('Código de acceso privado inválido.');
      setAccessCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/98 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl shadow-amber-500/10">
        
        {/* Lock Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Lock className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 inline-block">
            Acceso Privado Restringido
          </span>
          <h2 className="text-2xl font-serif font-bold text-white tracking-tight">
            Iam Dani • Catálogo VIP
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Por motivos de privacidad y seguridad, este catálogo no está disponible para acceso público web general.
          </p>
        </div>

        <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-left text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>ACCESO EXCLUSIVO DESDE TELEGRAM</span>
          </div>
          <p className="text-zinc-400 text-[11px] leading-normal">
            Para explorar los perfiles y solicitar disponibilidad, ingresa directamente a través de nuestro bot oficial de Telegram.
          </p>
        </div>

        {/* Primary Action Button to Open Telegram Bot */}
        <div className="space-y-3">
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Ingresar vía Telegram (@{cleanUsername})
          </a>

          <button
            type="button"
            onClick={onAdminClick}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            Acceso Administrativo
          </button>
        </div>

        {/* Access Code Form */}
        <form onSubmit={handleBypassCode} className="pt-2 border-t border-zinc-800/80 text-left space-y-2">
          <label className="block text-[10px] uppercase font-bold text-zinc-500">
            ¿Tienes un código de invitación o pase privado?
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Código de acceso..."
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value); setError(''); }}
              className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs cursor-pointer transition-colors"
            >
              Entrar
            </button>
          </div>
          {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
        </form>

      </div>
    </div>
  );
};
