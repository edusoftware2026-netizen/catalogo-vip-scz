import React, { useEffect, useState } from 'react';
import { AdminPanel } from '../components/AdminPanel';

export const AdminApp: React.FC = () => {
  const [botUsername, setBotUsername] = useState('CatalogoVIPSCZBot');
  const [channelId, setChannelId] = useState('-1003650435412');

  useEffect(() => {
    document.title = 'Panel de Administración • Iam Dani';

    // Inicializar Telegram Mini App para el Panel Administrativo
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
      } catch {
        // Fallback
      }
    }

    // Obtener información del bot para sincronizar el panel
    fetch('/api/info')
      .then(res => res.json())
      .then(info => {
        if (info.bot_username) setBotUsername(info.bot_username);
        if (info.channel_id) setChannelId(info.channel_id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950">
      <AdminPanel
        isOpen={true}
        botUsername={botUsername}
        channelId={channelId}
      />
    </div>
  );
};

