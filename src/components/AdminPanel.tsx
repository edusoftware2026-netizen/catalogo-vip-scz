import React, { useState, useEffect } from 'react';
import { Profile, CustomerRequest, AuditLog, SyncErrorLog } from '../types';
import {
  X,
  Lock,
  Plus,
  Edit,
  Trash2,
  Upload,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  ShieldAlert,
  Clock,
  Eye,
  Activity,
  LogOut,
  QrCode,
  Inbox,
  Banknote,
  Pin,
  Globe,
  Webhook,
  MessageSquare,
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  botUsername: string;
  channelId: string;
}

type AdminTab = 'profiles' | 'new' | 'requests' | 'telegram' | 'audit' | 'commissions';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  botUsername,
  channelId
}) => {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('profiles');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit / New Form State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    age: 18,
    zone: 'Equipetrol',
    description: '',
    rate_bs: 450,
    commission_bs: 50,
    status: 'borrador' as const,
    priority_order: 0
  });

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<FileList | null>(null);
  const [newBotUsername, setNewBotUsername] = useState(botUsername || '');
  const [telegramOnlyMode, setTelegramOnlyMode] = useState(false);
  const [autoReplyDelay, setAutoReplyDelay] = useState('10');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [pinnedMessageText, setPinnedMessageText] = useState('');
  const [pinnedMessageActive, setPinnedMessageActive] = useState(false);
  const [commissionLogs, setCommissionLogs] = useState<any[]>([]);

  // Reply state for customer requests
  const [replyingRequestId, setReplyingRequestId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<string>('confirmado');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setNewBotUsername(botUsername || '');
  }, [botUsername]);

  useEffect(() => {
    if (isOpen) {
      fetchData('');
    }
  }, [isOpen]);

  const verifyAndAuthenticate = async (tok: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tok })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setToken(tok);
        localStorage.setItem('iamdani_admin_token', tok);
        setIsAuthenticated(true);
        fetchData(tok);
      } else {
        localStorage.removeItem('iamdani_admin_token');
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (tok: string = token) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${tok}` };
      const [resP, resR, resL, resI, resComm] = await Promise.all([
        fetch('/api/admin/profiles', { headers }),
        fetch('/api/admin/requests', { headers }),
        fetch('/api/admin/logs', { headers }),
        fetch('/api/info'),
        fetch('/api/admin/commissions', { headers })
      ]);

      if (resP.ok) setProfiles(await resP.json());
      if (resR.ok) setRequests(await resR.json());
      if (resL.ok) {
        const logsData = await resL.json();
        setAuditLogs(logsData.audit_logs || []);
        setSyncErrors(logsData.sync_errors || []);
      }
      if (resI.ok) {
        const infoData = await resI.json();
        if (infoData.telegram_only_access !== undefined) setTelegramOnlyMode(Boolean(infoData.telegram_only_access));
        if (infoData.auto_reply_delay_minutes !== undefined) setAutoReplyDelay(String(infoData.auto_reply_delay_minutes));
        if (infoData.qr_image_url !== undefined) setQrImageUrl(infoData.qr_image_url);
        if (infoData.pinned_message_text !== undefined) setPinnedMessageText(infoData.pinned_message_text);
        if (infoData.pinned_message_active !== undefined) setPinnedMessageActive(Boolean(infoData.pinned_message_active));
      }
      if (resComm && resComm.ok) {
        setCommissionLogs(await resComm.json());
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar datos administrativos' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('iamdani_admin_token');
    setToken('');
    setIsAuthenticated(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.age < 18) {
      setMessage({ type: 'error', text: 'REGLA OBLIGATORIA: La edad debe ser mayor o igual a 18 años.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const isEdit = Boolean(editingProfile);
      const url = isEdit ? `/api/admin/profiles/${editingProfile!.id}` : '/api/admin/profiles';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const targetProfileId = isEdit ? editingProfile!.id : data.profile.id;
        if (selectedPhotoFiles && selectedPhotoFiles.length > 0) {
          try {
            const body = new FormData();
            for (let i = 0; i < selectedPhotoFiles.length; i++) {
              body.append('photos', selectedPhotoFiles[i]);
            }
            await fetch(`/api/admin/profiles/${targetProfileId}/photos`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body
            });
            setSelectedPhotoFiles(null);
          } catch { /* Ignore photo error */ }
        }
        setMessage({ type: 'success', text: `Perfil ${isEdit ? 'actualizado' : 'creado'} y fotografías vinculadas con éxito.` });
        setEditingProfile(null);
        setFormData({ name: '', age: 18, zone: 'Equipetrol', description: '', rate_bs: 450, commission_bs: 50, status: 'borrador', priority_order: 0 });
        fetchData();
        setActiveTab('profiles');
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar perfil' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de servidor al guardar el perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhotos = async (profileId: string) => {
    if (!selectedPhotoFiles || selectedPhotoFiles.length === 0) return;
    setUploadingPhotos(true);
    try {
      const body = new FormData();
      for (let i = 0; i < selectedPhotoFiles.length; i++) {
        body.append('photos', selectedPhotoFiles[i]);
      }
      const res = await fetch(`/api/admin/profiles/${profileId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Fotografías subidas e integradas al perfil.' });
        setSelectedPhotoFiles(null);
        if (editingProfile && data.profile) setEditingProfile(data.profile);
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al subir fotos' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de red al subir imágenes' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSyncChannel = async (profileId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Sincronización con Canal Telegram exitosa: ${data.message}` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al publicar en canal' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de servidor al sincronizar' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string, name: string) => {
    if (!window.confirm(`¿Está segura de eliminar el perfil de "${name}"? Se removerá del canal de Telegram y de la web.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessage({ type: 'success', text: `Perfil ${name} eliminado con éxito.` });
        fetchData();
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al eliminar perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/webhook/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Webhook registrado correctamente en Telegram: ${data.webhook_url}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al registrar webhook' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de comunicación al configurar webhook' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    if (!editingProfile) return;
    const updatedPhotos = (editingProfile.photos || []).filter(p => p !== photoUrl);
    setEditingProfile({ ...editingProfile, photos: updatedPhotos });
    try {
      const res = await fetch(`/api/admin/profiles/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photos: updatedPhotos })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Fotografía eliminada del perfil.' });
        fetchData();
      }
    } catch {
      setMessage({ type: 'error', text: 'Error al eliminar foto' });
    }
  };

  const handleSendReply = async (requestId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply_message: replyText, status: replyStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: data.message });
        setReplyingRequestId(null);
        setReplyText('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al enviar respuesta' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al responder solicitud' });
    } finally {
      setSendingReply(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent, customOnlyMode?: boolean) => {
    if (e) e.preventDefault();
    setLoading(true);
    const onlyMode = customOnlyMode !== undefined ? customOnlyMode : telegramOnlyMode;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bot_username: newBotUsername,
          telegram_only_access: onlyMode,
          auto_reply_delay_minutes: autoReplyDelay
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Configuración de Telegram y privacidad guardada.' });
        if (data.bot_username) setNewBotUsername(data.bot_username);
        if (data.telegram_only_access !== undefined) setTelegramOnlyMode(data.telegram_only_access);
        if (data.auto_reply_delay_minutes !== undefined) setAutoReplyDelay(String(data.auto_reply_delay_minutes));
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar configuración' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al guardar configuración' });
    } finally {
      setLoading(false);
    }
  };

  const resetNewForm = () => {
    setEditingProfile(null);
    setFormData({ name: '', age: 18, zone: 'Equipetrol', description: '', rate_bs: 450, commission_bs: 50, status: 'borrador', priority_order: 0 });
    setActiveTab('new');
  };

  if (!isOpen) return null;

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs: { id: AdminTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'profiles', icon: <Users className="w-4 h-4" />, label: 'Perfiles', badge: profiles.length },
    { id: 'requests', icon: <Inbox className="w-4 h-4" />, label: 'Solicitudes', badge: requests.length },
    { id: 'new', icon: <Plus className="w-4 h-4 text-amber-400" />, label: 'Nuevo' },
    { id: 'telegram', icon: <QrCode className="w-4 h-4" />, label: 'Telegram' },
    { id: 'commissions', icon: <Banknote className="w-4 h-4" />, label: 'Comisiones', badge: commissionLogs.length },
    { id: 'audit', icon: <Activity className="w-4 h-4" />, label: 'Auditoría' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl text-zinc-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">

        {/* ── Header ── */}
        <div className="p-4 sm:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight font-serif">
                Panel Administrativo — Iam Dani
              </h2>
              <p className="text-xs text-zinc-400">
                Canal Telegram: <span className="text-amber-400 font-mono">{channelId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            )}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Global Alert Notification ── */}
        {message && (
          <div className={`shrink-0 px-6 py-3 text-xs font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border-b border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertTriangle className="w-4 h-4 shrink-0" />
              }
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100 ml-4 text-lg leading-none cursor-pointer">×</button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Tab Bar ── */}
          <div className="flex items-center gap-0.5 px-3 sm:px-5 pt-3 bg-zinc-950/40 border-b border-zinc-800/80 overflow-x-auto scrollbar-none shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'new' ? resetNewForm() : setActiveTab(tab.id)}
                title={tab.label}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-t-lg border-b-2 transition-all cursor-pointer text-xs font-semibold whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-amber-400 text-amber-400 bg-zinc-900/40'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-amber-400/20 text-amber-400'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab Views ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

            {/* TAB: PROFILES LIST */}
            {activeTab === 'profiles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Gestión de Catálogo Completo
                  </h3>
                  <button
                    onClick={() => fetchData()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refrescar
                  </button>
                </div>

                {profiles.length === 0 ? (
                  <div className="p-10 text-center bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-2">
                    <Users className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400 text-sm font-medium">No hay perfiles creados aún</p>
                    <button onClick={resetNewForm} className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer">
                      + Crear primer perfil
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profiles.map(p => (
                      <div key={p.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors flex gap-4">
                        <img
                          src={p.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'}
                          alt={p.name}
                          className="w-20 h-28 object-cover rounded-xl border border-zinc-800 shrink-0"
                        />
                        <div className="flex-1 flex flex-col justify-between text-xs min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-white truncate">{p.name} <span className="text-zinc-500 font-normal">({p.age}a)</span></h4>
                              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                p.status === 'disponible' ? 'bg-emerald-500/20 text-emerald-400' :
                                p.status === 'ocupada' ? 'bg-rose-500/20 text-rose-400' :
                                p.status === 'pausada' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                            <p className="text-zinc-400 mt-1">📍 {p.zone} · Bs. {p.rate_bs}</p>
                            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1">{p.description}</p>
                          </div>

                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-900">
                            <button
                              onClick={() => {
                                setEditingProfile(p);
                                setFormData({
                                  name: p.name, age: p.age, zone: p.zone,
                                  description: p.description, rate_bs: p.rate_bs,
                                  commission_bs: p.commission_bs, status: p.status,
                                  priority_order: p.priority_order || 0
                                });
                                setActiveTab('new');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3 h-3" /> Editar
                            </button>

                            <button
                              onClick={() => handleSyncChannel(p.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                              title="Publicar / Sincronizar en Canal Telegram"
                            >
                              <Send className="w-3 h-3" /> Sincronizar
                            </button>

                            <button
                              onClick={() => handleDeleteProfile(p.id, p.name)}
                              className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px] ml-auto cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CREATE / EDIT FORM */}
            {activeTab === 'new' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingProfile ? `Editar Perfil: ${editingProfile.name}` : 'Crear Nuevo Perfil de Catálogo'}
                </h3>

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Nombre Público *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Edad (Mínimo 18) *</label>
                      <input
                        type="number"
                        min={18}
                        required
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Zona / Barrio</label>
                    <input
                      type="text"
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      placeholder="Ej: Equipetrol, Radial 27, Centro..."
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">TARIFA SERVICIO (Bs.)</label>
                      <input
                        type="number"
                        value={formData.rate_bs}
                        onChange={(e) => setFormData({ ...formData, rate_bs: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">COMISIÓN (Bs.)</label>
                      <input
                        type="number"
                        value={formData.commission_bs}
                        onChange={(e) => setFormData({ ...formData, commission_bs: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Estado de Publicación</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="borrador">📁 Borrador</option>
                      <option value="disponible">🟢 Disponible</option>
                      <option value="ocupada">🔴 Ocupada</option>
                      <option value="pausada">⏸️ Pausada</option>
                      <option value="retirada">🗑️ Retirada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Descripción Pública</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                    />
                  </div>

                  <div className="pt-3 border-t border-zinc-900 space-y-3">
                    <label className="block text-zinc-300 font-bold text-xs flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-amber-400" /> Seleccionar Fotos:
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                      <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border-2 border-dashed border-amber-500/50 hover:border-amber-500 text-amber-400 font-bold text-xs cursor-pointer transition-all active:scale-95 text-center">
                        <Upload className="w-4 h-4 shrink-0" />
                        <span>
                          {selectedPhotoFiles && selectedPhotoFiles.length > 0
                            ? `${selectedPhotoFiles.length} foto(s) lista(s) para subir`
                            : 'Toca aquí para abrir Galería o Archivos'}
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                          onChange={(e) => setSelectedPhotoFiles(e.target.files)}
                          className="hidden"
                        />
                      </label>

                      {editingProfile && selectedPhotoFiles && selectedPhotoFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleUploadPhotos(editingProfile.id)}
                          disabled={uploadingPhotos}
                          className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs cursor-pointer shrink-0 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingPhotos ? 'Subiendo...' : 'Subir Fotos Ahora'}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {editingProfile
                        ? 'Selecciona fotos de tu celular y presiona "Subir Fotos Ahora" o "Guardar Cambios".'
                        : 'Selecciona fotos; se vincularán al crear el perfil.'}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-60"
                  >
                    {editingProfile ? 'Guardar Cambios' : 'Crear Perfil'}
                  </button>
                </form>

                {/* Photo Gallery Manager */}
                {editingProfile && (
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4 text-xs">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-amber-400" /> Galería Actual ({editingProfile.photos?.length || 0} fotos)
                    </h4>

                    {editingProfile.photos && editingProfile.photos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {editingProfile.photos.map((photoUrl, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-zinc-800 aspect-square bg-zinc-900">
                            <img src={photoUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photoUrl)}
                              className="absolute top-1 right-1 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Eliminar foto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-[10px] text-white bg-zinc-950/70 px-1.5 rounded font-mono">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 italic">No hay fotos cargadas aún en este perfil.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: TELEGRAM & SETTINGS */}
            {activeTab === 'telegram' && (
              <div className="space-y-6 text-xs">

                {/* QR COMISIÓN */}
                <div className="p-5 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 border-2 border-amber-500/40 rounded-2xl space-y-4 shadow-lg shadow-amber-500/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                      <QrCode className="w-5 h-5" /> Imagen QR de COMISIÓN / Pago
                    </h4>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      Para Bot y Admin
                    </span>
                  </div>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    Sube aquí la fotografía de tu código QR. El bot la enviará automáticamente o tú puedes usarla con el comando <code className="text-amber-400 font-mono font-bold bg-zinc-900 px-1.5 py-0.5 rounded">/qr ID_CLIENTE</code>.
                  </p>

                  {qrImageUrl ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                      <img src={qrImageUrl} alt="QR Comisión Oficial" className="w-28 h-28 object-contain bg-white rounded-lg p-1.5 shadow-md" />
                      <div className="space-y-1 text-xs">
                        <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Imagen QR cargada en el servidor
                        </p>
                        <p className="text-zinc-400">Esta es la imagen que el sistema enviará a los clientes.</p>
                        <p className="text-zinc-500 text-[11px] font-mono break-all">{qrImageUrl}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Aún no has subido una imagen QR.
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      if (!e.target.files?.[0]) return;
                      const file = e.target.files[0];
                      const fd = new FormData();
                      fd.append('qr_image', file);
                      try {
                        setLoading(true);
                        const res = await fetch('/api/admin/settings/qr', { method: 'POST', body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.qr_image_url) setQrImageUrl(data.qr_image_url);
                          setMessage({ type: 'success', text: 'Imagen QR de Comisión subida correctamente' });
                        } else {
                          setMessage({ type: 'error', text: 'Error al guardar imagen QR' });
                        }
                      } catch {
                        setMessage({ type: 'error', text: 'Error en red al subir QR' });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="text-xs text-zinc-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-zinc-950 hover:file:bg-amber-400 cursor-pointer w-full sm:w-auto"
                  />
                </div>

                {/* MENSAJE FIJADO */}
                <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Pin className="w-4 h-4 text-amber-400" /> Mensaje Fijado en el Catálogo Web
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-zinc-400 font-medium">Estado:</span>
                      <input
                        type="checkbox"
                        checked={pinnedMessageActive}
                        onChange={(e) => setPinnedMessageActive(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className={`text-xs font-bold ${pinnedMessageActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {pinnedMessageActive ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </label>
                  </div>
                  <p className="text-zinc-400 text-xs">
                    Fija un anuncio que permanecerá visible en la parte superior del catálogo web.
                  </p>
                  <textarea
                    rows={2}
                    value={pinnedMessageText}
                    onChange={(e) => setPinnedMessageText(e.target.value)}
                    placeholder="Ej: 🔥 Disponibilidad inmediata en Equipetrol - Consultas directas al bot..."
                    className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await fetch('/api/admin/settings/pinned', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ pinned_message_text: pinnedMessageText, pinned_message_active: pinnedMessageActive })
                          });
                          if (res.ok) {
                            setMessage({ type: 'success', text: 'Mensaje fijado actualizado correctamente en el catálogo' });
                          } else {
                            setMessage({ type: 'error', text: 'Error al guardar mensaje fijado' });
                          }
                        } catch {
                          setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold transition-all cursor-pointer"
                    >
                      Guardar Mensaje Fijado
                    </button>
                  </div>
                </div>

                {/* MODO PRIVADO */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {telegramOnlyMode ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-zinc-400" />}
                        Modo Privado: Acceso Exclusivo desde Telegram
                      </h4>
                      <p className="text-zinc-400 text-xs mt-1">
                        Al activar, la web estará bloqueada para visitantes generales. Solo usuarios de Telegram (@{newBotUsername || 'bot'}) podrán acceder.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = !telegramOnlyMode;
                        setTelegramOnlyMode(nextMode);
                        handleSaveSettings(undefined, nextMode);
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        telegramOnlyMode
                          ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                      }`}
                    >
                      {telegramOnlyMode ? 'MODO PRIVADO ACTIVO' : 'ACCESO LIBRE WEB'}
                    </button>
                  </div>
                </div>

                {/* BOT USERNAME */}
                <form onSubmit={handleSaveSettings} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-400" /> Nombre de Usuario del Bot en Telegram
                  </h4>
                  <p className="text-zinc-400">
                    Username exacto del bot sin @. Los enlaces del catálogo redirigirán a este bot.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-zinc-500 font-bold text-xs">@</span>
                      <input
                        type="text"
                        value={newBotUsername.replace(/^@/, '')}
                        onChange={(e) => setNewBotUsername(e.target.value)}
                        placeholder="Ej. catalogovipscz"
                        className="w-full pl-7 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                {/* AUTO REPLY DELAY */}
                <form onSubmit={handleSaveSettings} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" /> Tiempo de Respuesta Automática del Bot
                  </h4>
                  <p className="text-zinc-400">
                    Si la Administradora tarda más de estos minutos en responder, el bot enviará un mensaje de seguimiento amable al cliente.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={autoReplyDelay}
                      onChange={(e) => setAutoReplyDelay(e.target.value)}
                      placeholder="10"
                      className="w-28 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <span className="text-zinc-400 font-bold">minutos</span>
                    <button
                      type="submit"
                      disabled={loading}
                      className="ml-auto py-2 px-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                {/* WEBHOOK */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-blue-400" /> Configuración de Webhook
                  </h4>
                  <p className="text-zinc-400">
                    El bot sincroniza automáticamente con el canal <code className="text-amber-400">{channelId}</code>.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegisterWebhook}
                    disabled={loading}
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
                  >
                    <Webhook className="w-4 h-4" />
                    Registrar / Refrescar Webhook en Telegram API
                  </button>
                </div>
              </div>
            )}

            {/* TAB: SOLICITUDES DE CLIENTES */}
            {activeTab === 'requests' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-amber-400" /> Solicitudes de Disponibilidad
                  </h3>
                  <button
                    onClick={() => fetchData()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-2">
                    <Inbox className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400">No hay solicitudes registradas aún.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map(reqItem => (
                      <div key={reqItem.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">
                                {reqItem.telegram_first_name || 'Cliente'}
                              </span>
                              {reqItem.telegram_username && (
                                <span className="text-amber-400 font-mono">@{reqItem.telegram_username}</span>
                              )}
                              <span className="text-zinc-500 font-mono text-[11px]">
                                (ID: {reqItem.telegram_user_id || 'N/A'})
                              </span>
                            </div>
                            <p className="text-zinc-300">
                              Consulta por: <strong className="text-amber-300">{reqItem.profile_name}</strong>
                            </p>
                            {reqItem.notes && (
                              <p className="text-zinc-500 text-[11px] bg-zinc-900 px-2 py-1 rounded-lg">
                                "{reqItem.notes}"
                              </p>
                            )}
                            <p className="text-zinc-500 text-[11px]">
                              {new Date(reqItem.created_at).toLocaleString('es-BO')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              reqItem.status === 'comision_pagada'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : reqItem.status === 'confirmado'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {reqItem.status === 'comision_pagada' ? 'COMISIÓN PAGADA' : reqItem.status.toUpperCase()}
                            </span>

                            {reqItem.status !== 'comision_pagada' && (
                              <button
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    const res = await fetch(`/api/admin/requests/${reqItem.id}/pay`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    if (res.ok) {
                                      setMessage({ type: 'success', text: `Comisión pagada registrada para ${reqItem.telegram_first_name}` });
                                      fetchData();
                                    } else {
                                      setMessage({ type: 'error', text: 'Error al marcar comisión pagada' });
                                    }
                                  } catch {
                                    setMessage({ type: 'error', text: 'Error en red' });
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-zinc-950 font-extrabold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs"
                              >
                                <Banknote className="w-3.5 h-3.5" /> Marcar Comisión Pagada
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Reply Section */}
                        {replyingRequestId === reqItem.id ? (
                          <div className="pt-2 border-t border-zinc-800 space-y-2">
                            <select
                              value={replyStatus}
                              onChange={(e) => setReplyStatus(e.target.value)}
                              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
                            >
                              <option value="confirmado">Confirmado</option>
                              <option value="rechazado">Rechazado</option>
                              <option value="completado">Completado</option>
                            </select>
                            <textarea
                              rows={2}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Escribe tu respuesta al cliente..."
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSendReply(reqItem.id)}
                                disabled={sendingReply}
                                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                              >
                                <Send className="w-3.5 h-3.5" />
                                {sendingReply ? 'Enviando...' : 'Enviar Respuesta'}
                              </button>
                              <button
                                onClick={() => { setReplyingRequestId(null); setReplyText(''); }}
                                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingRequestId(reqItem.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Responder via Telegram
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: COMISIONES PAGADAS */}
            {activeTab === 'commissions' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-400" /> Registro de Comisiones Pagadas
                    </h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      Historial de pagos confirmados para control de ingresos.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchData()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>

                {commissionLogs.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-2">
                    <Banknote className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400">Aún no hay comisiones marcadas como pagadas.</p>
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-bold">
                          <th className="p-3">Usuario Telegram</th>
                          <th className="p-3">Modelo</th>
                          <th className="p-3">Monto</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {commissionLogs.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-900/30 transition-colors">
                            <td className="p-3 font-mono text-amber-400 font-bold">{item.telegram_user}</td>
                            <td className="p-3 text-white font-medium">{item.profile_name}</td>
                            <td className="p-3 text-emerald-400 font-bold">Bs. {item.amount_bs || 300}</td>
                            <td className="p-3 text-zinc-400">{new Date(item.paid_at).toLocaleString('es-BO')}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" /> CONFIRMADO
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: AUDIT LOGS */}
            {activeTab === 'audit' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" /> Registro de Auditoría
                  </h3>
                  <button
                    onClick={() => fetchData()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-950/60 border border-zinc-800/80 rounded-2xl space-y-2">
                    <Activity className="w-10 h-10 text-zinc-700 mx-auto" />
                    <p className="text-zinc-400">No hay registros de auditoría aún.</p>
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="max-h-96 overflow-y-auto divide-y divide-zinc-900">
                      {auditLogs.map(log => (
                        <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-zinc-900/30 transition-colors">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold mt-0.5">
                              {log.action}
                            </span>
                            <span className="text-zinc-300 text-xs break-words">{log.details}</span>
                          </div>
                          <span className="shrink-0 text-zinc-500 text-[10px] font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('es-BO')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syncErrors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Errores de Sincronización ({syncErrors.length})
                    </h4>
                    <div className="bg-zinc-950 border border-rose-500/20 rounded-2xl overflow-hidden">
                      <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900">
                        {syncErrors.map(err => (
                          <div key={err.id} className="p-3 flex items-start justify-between gap-4">
                            <span className="text-rose-300 text-xs break-words">{err.error_message}</span>
                            <span className="shrink-0 text-zinc-500 text-[10px] font-mono">
                              {new Date(err.timestamp).toLocaleTimeString('es-BO')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
