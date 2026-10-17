import React, { useState } from 'react';
import { Profile } from '../types';
import { X, Send, AlertTriangle, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface TelegramUserContext {
  id: string;
  first_name: string;
  username?: string;
}

interface RequestModalProps {
  profile: Profile | null;
  botUsername: string;
  tgUserContext?: TelegramUserContext | null;
  onClose: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({ profile, botUsername, tgUserContext, onClose }) => {
  // ✅ Todos los hooks ANTES de cualquier return condicional (regla de hooks de React)
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!profile) return null;

  const cleanUsername = (botUsername || 'catalogovipscz').replace(/^@/, '').trim();
  const webLinkUrl = `https://t.me/${cleanUsername}?start=req_${profile.id}`;

  const handleSubmitWebForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profile.id,
          client_name: tgUserContext?.first_name || 'Cliente Telegram',
          client_telegram: tgUserContext?.username ? `@${tgUserContext.username}` : (tgUserContext?.id ? `ID:${tgUserContext.id}` : '@cliente_telegram'),
          tg_user_id: tgUserContext?.id,
          notes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Error al enviar la solicitud');
      }
    } catch {
      setError('Error de conexión al servidor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-100 my-auto">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Solicitar método de Pago
          </h3>
          <p className="text-xs text-amber-400 font-medium mt-1 leading-relaxed">
            Perfil: <span className="font-bold">{profile.name}</span>
          </p>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200/90 mb-4 flex items-start gap-2.5 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300 block mb-0.5">AVISO DE CONFIDENCIALIDAD:</strong>
            La coordinación y método de pago se gestionan en privado y directamente con la Administradora vía Telegram.
          </div>
        </div>

        {tgUserContext && (
          <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-200 mb-5 flex items-center gap-2.5 text-left">
            <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <span className="font-bold text-sky-300 block">USUARIO DE TELEGRAM IDENTIFICADO</span>
              <span>Conectado como <strong className="text-white">{tgUserContext.first_name}</strong> {tgUserContext.username ? `(@${tgUserContext.username})` : ''}. Recibirás respuesta directa a tu chat.</span>
            </div>
          </div>
        )}

        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">¡Solicitud Notificada!</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              La Administradora de <strong>Iam Dani</strong> ha sido notificada. También puedes escribirle directamente en Telegram.
            </p>
            <a
              href={webLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              Abrir Chat en Telegram
            </a>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitWebForm} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] uppercase font-bold text-zinc-300 mb-1.5">
                Mensaje u Observación {tgUserContext && <span className="text-zinc-500 font-normal normal-case">(opcional)</span>}
              </label>
              <textarea
                rows={4}
                // ✅ Ya no es required si el usuario tiene contexto Telegram identificado
                required={!tgUserContext}
                placeholder="Escribe tu consulta sobre la coordinación y método de pago..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/80 resize-none placeholder:text-zinc-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Enviando...' : 'Enviar Solicitud a la Administradora'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
