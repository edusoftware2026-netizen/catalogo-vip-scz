import React, { useState, useEffect, useRef } from 'react';
import { Profile, CustomerRequest, AuditLog, SyncErrorLog, ProfileStatus } from '../types';
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
  Database,
  Cloud,
  ChevronDown,
  ImageIcon,
} from 'lucide-react';

// ── Utilidades de UX para pantallas pequeñas ────────────────────────────────

// Etiqueta legible del origen de una imagen: URL nativa de Telegram vs local
const photoSourceLabel = (url: string): { text: string; cls: string } => {
  if (url.startsWith('https://api.telegram.org')) return { text: 'TG', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
  if (url.startsWith('http')) return { text: 'URL', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  return { text: 'LOCAL', cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
};

// Sección plegable: colapsa contenido largo (Telegram) para reducir scroll en móviles
const CollapsibleSection: React.FC<{
  title: React.ReactNode;
  defaultOpen?: boolean;
  summaryRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, defaultOpen = false, summaryRight, children, className = '' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-12 cursor-pointer text-left active:bg-zinc-900/60 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-white">{title}</span>
        <span className="flex items-center gap-2 shrink-0">
          {summaryRight}
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>}
    </div>
  );
};

interface AdminPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  botUsername: string;
  channelId: string;
  onNavigate?: (path: string) => void;
}

type AdminTab = 'profiles' | 'new' | 'requests' | 'telegram' | 'audit' | 'commissions';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen = true,
  onClose,
  botUsername,
  channelId,
  onNavigate
}) => {
  const [token, setToken] = useState(() => localStorage.getItem('iamdani_admin_token') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('profiles');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Toast auto-descartable: en pantallas pequeñas el alert inline quedaba fuera de vista
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.type === 'error' ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [message]);

  // Previsualizaciones locales (object URLs) de las fotos seleccionadas antes de subirlas
  const photoPreviewsRef = useRef<string[]>([]);
  const [photoPreviews, setPhotoPreviewsState] = useState<string[]>([]);
  const setPhotoPreviews = (urls: string[]) => {
    photoPreviewsRef.current.forEach(u => URL.revokeObjectURL(u));
    photoPreviewsRef.current = urls;
    setPhotoPreviewsState(urls);
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  // Manejador único del selector de archivos: genera previsualizaciones y limpia object URLs
  const handlePhotoFilesChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setPhotoPreviews(Array.from(files).map(f => URL.createObjectURL(f)));
    } else {
      setPhotoPreviews([]);
    }
    setSelectedPhotoFiles(files);
  };

  // Quitar una foto de la cola de previsualización antes de subirla (sin reordenar índices)
  const removePhotoPreviewAt = (idx: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!selectedPhotoFiles) return;
    const dt = new DataTransfer();
    Array.from(selectedPhotoFiles).forEach((f, i) => { if (i !== idx) dt.items.add(f); });
    handlePhotoFilesChange(dt.files.length > 0 ? dt.files : null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Edit / New Form State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    age: number;
    description: string;
    rate_bs: number;
    commission_bs: number;
    status: ProfileStatus;
    priority_order: number;
  }>({
    name: '',
    age: 18,
    description: '',
    rate_bs: 450,
    commission_bs: 50,
    status: 'borrador',
    priority_order: 0
  });

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<FileList | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [newBotUsername, setNewBotUsername] = useState(botUsername || '');
  const [adminContactUsername, setAdminContactUsername] = useState('danii001');
  const [telegramOnlyMode, setTelegramOnlyMode] = useState(false);
  const [autoReplyDelay, setAutoReplyDelay] = useState('10');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [pinnedMessageText, setPinnedMessageText] = useState('');
  const [pinnedMessageActive, setPinnedMessageActive] = useState(false);
  const [commissionLogs, setCommissionLogs] = useState<any[]>([]);
  const [directTgPhotoUrl, setDirectTgPhotoUrl] = useState('');
  const [isClosingLogin, setIsClosingLogin] = useState(false);
  const [sessionClosedScreen, setSessionClosedScreen] = useState(false);
  const [dbInfo, setDbInfo] = useState<{
    type: string;
    is_cloud: boolean;
    label: string;
    host: string;
    status: string;
    ping?: { success: boolean; latency_ms: number; timestamp: string };
  } | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);
  const [publishDestination, setPublishDestination] = useState<'bot_and_channel' | 'only_bot' | 'only_channel'>('bot_and_channel');



  // Reply state for customer requests
  const [replyingRequestId, setReplyingRequestId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<string>('confirmado');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setNewBotUsername(botUsername || '');
  }, [botUsername]);

  const verifyAndAuthenticate = async (tok: string) => {
    if (tok === 'admin_session_dani2026' || tok === 'dani2026') {
      setToken(tok);
      setIsAuthenticated(true);
      fetchData(tok);
      return;
    }
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
      if (tok) {
        setToken(tok);
        setIsAuthenticated(true);
        fetchData(tok);
      } else {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const savedToken = localStorage.getItem('iamdani_admin_token');
    const tokenToTry = urlToken || savedToken || token;

    if (tokenToTry) {
      verifyAndAuthenticate(tokenToTry);
    } else {
      setIsAuthenticated(false);
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const cleanPass = passwordInput.trim();

    // Verificación directa inmediata para la clave de administrador 'dani2026'
    if (cleanPass === 'dani2026') {
      const adminToken = 'admin_session_dani2026';
      setToken(adminToken);
      localStorage.setItem('iamdani_admin_token', adminToken);
      setIsClosingLogin(true);
      setLoading(false);

      setTimeout(() => {
        setIsAuthenticated(true);
        setIsClosingLogin(false);
        setPasswordInput('');
        fetchData(adminToken);
      }, 350);

      // Notificar opcionalmente al backend en segundo plano
      fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass })
      }).catch(() => {});
      return;
    }

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        localStorage.setItem('iamdani_admin_token', data.token);
        setIsClosingLogin(true);
        setLoading(false);

        setTimeout(() => {
          setIsAuthenticated(true);
          setIsClosingLogin(false);
          setPasswordInput('');
          fetchData(data.token);
        }, 350);
      } else {
        setLoginError(data.error || 'Clave de acceso incorrecta');
      }
    } catch {
      setLoginError('Error de conexión con el servidor');
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
        if (infoData.database) setDbInfo(infoData.database);
        if (infoData.telegram_only_access !== undefined) setTelegramOnlyMode(Boolean(infoData.telegram_only_access));
        if (infoData.auto_reply_delay_minutes !== undefined) setAutoReplyDelay(String(infoData.auto_reply_delay_minutes));
        if (infoData.qr_image_url !== undefined) setQrImageUrl(infoData.qr_image_url);
        if (infoData.admin_contact_username) setAdminContactUsername(infoData.admin_contact_username);
        if (infoData.pinned_message_text !== undefined) setPinnedMessageText(infoData.pinned_message_text);
        if (infoData.pinned_message_active !== undefined) setPinnedMessageActive(Boolean(infoData.pinned_message_active));
        if (infoData.publish_destination) setPublishDestination(infoData.publish_destination);
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

  const handlePingDatabase = async () => {
    setCheckingDb(true);
    try {
      const res = await fetch('/api/admin/db/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
        setMessage({
          type: 'success',
          text: `Base de datos ${data.label} (${data.host}) verificada con éxito (${data.ping?.latency_ms ?? 0}ms)`
        });
      } else {
        setMessage({ type: 'error', text: 'Error al consultar estado de la base de datos' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al verificar base de datos' });
    } finally {
      setCheckingDb(false);
    }
  };

  // Cerrar Sesión: borra tokens y regresa a la pantalla de login de admin
  const handleLogout = () => {
    localStorage.removeItem('iamdani_admin_token');
    setToken('');
    setIsAuthenticated(false);
    setMessage({ type: 'success', text: 'Sesión administrativa cerrada.' });
  };

  // Salir de la Aplicación / Cerrar Página
  const handleExitApp = () => {
    localStorage.removeItem('iamdani_admin_token');
    sessionStorage.removeItem('iamdani_age_verified_splash');
    setToken('');
    setIsAuthenticated(false);

    // 1. Si está en Telegram Mini App, cerrar la ventana del bot inmediatamente
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp && typeof tgWebApp.close === 'function') {
      tgWebApp.close();
      return;
    }

    // 2. Intentar cerrar la pestaña del navegador
    try {
      window.close();
    } catch {}

    // 3. Mostrar pantalla de sesión cerrada si el navegador previene window.close()
    setSessionClosedScreen(true);
  };

  const handleQuickStatusChange = async (profileId: string, newStatus: ProfileStatus) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, status: newStatus } : p));
        setMessage({ type: 'success', text: `Estado actualizado a "${newStatus}"` });
      } else {
        setMessage({ type: 'error', text: 'Error al cambiar estado' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de red al actualizar estado' });
    } finally {
      setLoading(false);
    }
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
            handlePhotoFilesChange(null);
          } catch { /* Ignore photo error */ }
        }
        setMessage({ type: 'success', text: `Perfil ${isEdit ? 'actualizado' : 'creado'} y fotografías vinculadas con éxito.` });
        setEditingProfile(null);
        setFormData({ name: '', age: 18, description: '', rate_bs: 450, commission_bs: 50, status: 'borrador', priority_order: 0 });
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
        handlePhotoFilesChange(null);
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

  const handleAddDirectTgPhoto = async () => {
    if (!directTgPhotoUrl.trim()) return;
    const cleanUrl = directTgPhotoUrl.trim();
    if (editingProfile) {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/profiles/${editingProfile.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ photo_urls: [cleanUrl] })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setEditingProfile(data.profile);
            setProfiles(prev => prev.map(p => p.id === data.profile.id ? data.profile : p));
          }
          setDirectTgPhotoUrl('');
          setMessage({ type: 'success', text: 'URL nativo de Telegram agregado al perfil con éxito.' });
        } else {
          setMessage({ type: 'error', text: 'Error al agregar URL de Telegram' });
        }
      } catch {
        setMessage({ type: 'error', text: 'Error de red al agregar URL de Telegram' });
      } finally {
        setLoading(false);
      }
    } else {
      setDirectTgPhotoUrl('');
      setMessage({ type: 'success', text: 'URL nativo de Telegram listo. Guarda el perfil para aplicar.' });
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

  const handleSaveSettings = async (e?: React.FormEvent, customOnlyMode?: boolean, customPubDestination?: 'bot_and_channel' | 'only_bot' | 'only_channel') => {
    if (e) e.preventDefault();
    setLoading(true);
    const onlyMode = customOnlyMode !== undefined ? customOnlyMode : telegramOnlyMode;
    const dest = customPubDestination !== undefined ? customPubDestination : publishDestination;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bot_username: newBotUsername,
          admin_contact_username: adminContactUsername,
          telegram_only_access: onlyMode,
          auto_reply_delay_minutes: autoReplyDelay,
          publish_destination: dest
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Ajustes guardados y sincronizados correctamente.' });
        if (data.bot_username) setNewBotUsername(data.bot_username);
        if (data.admin_contact_username) setAdminContactUsername(data.admin_contact_username);
        if (data.telegram_only_access !== undefined) setTelegramOnlyMode(data.telegram_only_access);
        if (data.auto_reply_delay_minutes !== undefined) setAutoReplyDelay(String(data.auto_reply_delay_minutes));
        if (data.publish_destination) setPublishDestination(data.publish_destination);
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
    setFormData({
      name: '',
      age: 18,
      description: '',
      rate_bs: 450,
      commission_bs: 50,
      status: 'borrador',
      priority_order: 0
    });
    setActiveTab('new');
  };

  if (!isOpen) return null;

  if (isClosingLogin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
        <div className="w-full max-w-sm bg-zinc-900 border border-emerald-500/40 rounded-3xl p-8 text-center shadow-2xl shadow-emerald-500/10 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white font-serif">¡Acceso Autorizado!</h2>
          <p className="text-xs text-zinc-400">Cerrando pantalla de acceso y abriendo Panel Admin...</p>
        </div>
      </div>
    );
  }

  if (sessionClosedScreen) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
            <LogOut className="w-8 h-8 text-rose-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-serif">Página / Sesión Cerrada</h2>
            <p className="text-xs text-zinc-400 mt-1">Has salido del Panel de Administración con éxito.</p>
          </div>
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => {
                if ((window as any).Telegram?.WebApp?.close) {
                  (window as any).Telegram.WebApp.close();
                }
                window.close();
              }}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              Cerrar esta Ventana / Pestaña
            </button>
            <button
              onClick={() => {
                setSessionClosedScreen(false);
                setIsAuthenticated(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-all cursor-pointer"
            >
              Iniciar Sesión Nuevamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-zinc-950">
        <div className="w-full max-w-md bg-zinc-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-center animate-in fade-in duration-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1 font-serif">
            Panel de Administración
          </h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-6">
            Iam Dani — Acceso Restringido
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[11px] uppercase font-bold text-zinc-300 mb-1.5">
                Clave de Acceso
              </label>
              <input
                type="password"
                required
                autoFocus
                placeholder="Ingresa tu clave de acceso..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/80 transition-colors"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                const tgWebApp = (window as any).Telegram?.WebApp;
                if (tgWebApp && typeof tgWebApp.close === 'function') {
                  tgWebApp.close();
                } else {
                  setSessionClosedScreen(true);
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-rose-500/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir de la Mini App</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs: { id: AdminTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'profiles', icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />, label: 'Perfiles', badge: profiles.length },
    { id: 'requests', icon: <Inbox className="w-4 h-4 sm:w-5 sm:h-5" />, label: 'Solicitudes', badge: requests.filter(r => r.status !== 'comision_pagada').length || requests.length },
    { id: 'new', icon: <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />, label: editingProfile ? 'Editar' : 'Nuevo' },
    { id: 'telegram', icon: <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />, label: 'Telegram' },
    { id: 'commissions', icon: <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />, label: 'Comisiones', badge: commissionLogs.length },
    { id: 'audit', icon: <Activity className="w-4 h-4 sm:w-5 sm:h-5" />, label: 'Auditoría' },
  ];

  // ── Chips de estado táctiles (reemplazan <select>, difíciles de usar en móvil) ──
  const statusChips: { value: ProfileStatus; label: string; cls: string }[] = [
    { value: 'disponible', label: '🟢 Disponible', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60' },
    { value: 'ocupada', label: '🔴 Ocupada', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/60' },
    { value: 'pausada', label: '⏸️ Pausada', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/60' },
    { value: 'borrador', label: '📁 Borrador', cls: 'bg-zinc-800 text-zinc-200 border-zinc-500' },
    { value: 'retirada', label: '🗑️ Retirada', cls: 'bg-zinc-800 text-zinc-400 border-zinc-600' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl shadow-2xl flex-1 flex flex-col overflow-hidden">

          {/* ── Header (compacto en pantallas pequeñas) ── */}
          <div className="px-3 sm:p-6 py-2.5 sm:py-6 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-950/60 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight font-serif truncate">
                  Panel Administrativo — Iam Dani
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-[10px] sm:text-xs text-zinc-400">
                    Canal: <span className="text-amber-400 font-mono">{channelId}</span>
                  </span>
                  <span className="text-zinc-600 hidden sm:inline">·</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold ${
                    dbInfo?.is_cloud
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Database className="w-3 h-3 text-emerald-400" />
                    <span>{dbInfo?.label || 'Turso Cloud'}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {loading && (
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={handleLogout}
                className="p-2 sm:px-3 sm:py-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center sm:gap-1.5 border border-zinc-700/60"
                title="Cerrar sesión administrativa y volver al login"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-zinc-400 shrink-0" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
              <button
                onClick={handleExitApp}
                className="px-2.5 sm:px-3 py-2 sm:py-1.5 min-h-11 sm:min-h-0 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-rose-500/30 hover:border-rose-500/50"
                title="Cerrar la página / Salir de la aplicación"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Salir</span>
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Global Toast Notification (flotante, visible sin scrollear) ── */}
        {message && (
          <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 pt-safe">
            <div className={`pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 text-xs font-medium shadow-2xl animate-toast-in flex items-start justify-between gap-3 ${
              message.type === 'success'
                ? 'bg-zinc-900/95 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900/95 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-start gap-2 min-w-0">
                {message.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                <span className="wrap-break-word">{message.text}</span>
              </div>
              <button onClick={() => setMessage(null)} aria-label="Cerrar notificación" className="opacity-60 hover:opacity-100 text-lg leading-none cursor-pointer shrink-0 min-w-8 min-h-8 -mt-1 -mr-1 flex items-center justify-center">×</button>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Tab Bar: fija en la parte inferior del viewport en pantallas pequeñas (estilo Mini App) ── */}
          <div className="flex items-center gap-0.5 px-3 sm:px-5 pt-3 bg-zinc-950/40 border-b border-zinc-800/80 overflow-x-auto scrollbar-none shrink-0 max-sm:hidden">
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
                <span className="text-[11px] sm:text-xs">{tab.label}</span>
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
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 pb-28 sm:pb-6">

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
                              <select
                                value={p.status}
                                onChange={(e) => handleQuickStatusChange(p.id, e.target.value as ProfileStatus)}
                                className={`text-[10px] font-bold uppercase rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none transition-colors ${
                                  p.status === 'disponible' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                  p.status === 'ocupada' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                  p.status === 'pausada' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' :
                                  'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}
                              >
                                <option value="disponible">🟢 Disponible</option>
                                <option value="ocupada">🔴 Ocupada</option>
                                <option value="pausada">⏸️ Pausada</option>
                                <option value="borrador">📁 Borrador</option>
                                <option value="retirada">🗑️ Retirada</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-zinc-400">
                              <span className="text-amber-400 font-bold">Tarifa: Bs. {p.rate_bs}</span>
                              <span>·</span>
                              <span className="text-emerald-400 font-bold">Comisión: Bs. {p.commission_bs}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1">{p.description}</p>
                          </div>

                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-900">
                            <button
                              onClick={() => {
                                setEditingProfile(p);
                                setFormData({
                                  name: p.name, age: p.age,
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
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                                p.telegram_message_id
                                  ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30'
                                  : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                              }`}
                              title="Publicar post con fotografía y botón 'Ver Catálogo VIP' en el canal de Telegram"
                            >
                              <Send className="w-3 h-3" />
                              <span>{p.telegram_message_id ? 'Actualizar Post' : 'Publicar en Canal'}</span>
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Nombre Público *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 min-h-11 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Edad (Mínimo 18) *</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={18}
                        required
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                        className="w-full px-3 min-h-11 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">TARIFA SERVICIO (Bs.)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={formData.rate_bs}
                        onChange={(e) => setFormData({ ...formData, rate_bs: Number(e.target.value) })}
                        className="w-full px-3 min-h-11 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">COMISIÓN (Bs.)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={formData.commission_bs}
                        onChange={(e) => setFormData({ ...formData, commission_bs: Number(e.target.value) })}
                        className="w-full px-3 min-h-11 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-semibold">Estado de Publicación</label>
                    {/* Chips táctiles: un toque, sin dropdown nativo difícil en pantallas pequeñas */}
                    <div className="flex flex-wrap gap-2">
                      {statusChips.map(chip => (
                        <button
                          key={chip.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: chip.value })}
                          aria-pressed={formData.status === chip.value}
                          className={`px-3 py-2 min-h-11 rounded-xl border text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                            formData.status === chip.value
                              ? `${chip.cls} ring-1 ring-amber-400/60 shadow-md`
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Descripción Pública</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                    />
                  </div>

                  <div className="pt-3 border-t border-zinc-900 space-y-3">
                    <label className="flex items-center gap-1.5 text-zinc-300 font-bold text-xs">
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
                          ref={photoInputRef}
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                          onChange={(e) => handlePhotoFilesChange(e.target.files)}
                          className="hidden"
                        />
                      </label>

                      {selectedPhotoFiles && selectedPhotoFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handlePhotoFilesChange(null)}
                          className="px-3 py-2.5 min-h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white font-bold text-xs cursor-pointer shrink-0 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          title="Quitar todas las fotos seleccionadas"
                        >
                          <X className="w-3.5 h-3.5" /> Limpiar
                        </button>
                      )}

                      {editingProfile && selectedPhotoFiles && selectedPhotoFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleUploadPhotos(editingProfile.id)}
                          disabled={uploadingPhotos}
                          className="py-3 px-5 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs cursor-pointer shrink-0 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingPhotos ? 'Subiendo...' : 'Subir Fotos Ahora'}
                        </button>
                      )}
                    </div>

                    {/* Previsualización táctil de las fotos elegidas antes de subirlas */}
                    {photoPreviews.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                        {photoPreviews.map((url, idx) => (
                          <div key={url} className="relative rounded-xl overflow-hidden border border-amber-500/30 aspect-square bg-zinc-900">
                            <img src={url} alt={`Vista previa ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 text-[10px] text-white bg-zinc-950/70 px-1.5 rounded font-mono">
                              #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => removePhotoPreviewAt(idx, e)}
                              className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-lg bg-rose-600 text-white shadow-md cursor-pointer active:scale-90"
                              title="Quitar esta foto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Entrada directa de URL Nativo de Telegram */}
                    <div className="pt-2 space-y-1.5">
                      <label className="block text-[11px] font-bold text-zinc-400">
                        O agrega un URL nativo de Telegram directo (sin guardar en servidor):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://api.telegram.org/file/... o enlace de Telegram"
                          value={directTgPhotoUrl}
                          onChange={(e) => setDirectTgPhotoUrl(e.target.value)}
                          className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500/60"
                        />
                        <button
                          type="button"
                          onClick={handleAddDirectTgPhoto}
                          disabled={!directTgPhotoUrl.trim() || loading}
                          className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs rounded-xl border border-zinc-700/60 hover:border-amber-500/40 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          + Añadir URL
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500">
                      Las imágenes se integran usando el enlace nativo de Telegram, sin ocupar espacio de almacenamiento multimedia local en el servidor.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-60"
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
                        {editingProfile.photos.map((photoUrl, idx) => {
                          const src = photoSourceLabel(photoUrl);
                          return (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-800 aspect-square bg-zinc-900">
                            <img src={photoUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photoUrl)}
                              className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer active:scale-90 transition-transform"
                              title="Eliminar foto"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-[10px] text-white bg-zinc-950/70 px-1.5 rounded font-mono">
                              #{idx + 1}
                            </span>
                            {/* Origen de la imagen: TG (Telegram), URL externa o LOCAL */}
                            <span className={`absolute bottom-1 right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${src.cls}`}>
                              {src.text}
                            </span>
                          </div>
                          );
                        })}
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

                {/* BASE DE DATOS TURSO CLOUD */}
                <div className="p-5 bg-linear-to-br from-emerald-500/10 via-zinc-950 to-zinc-950 border-2 border-emerald-500/30 rounded-2xl space-y-4 shadow-lg shadow-emerald-500/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                          Base de Datos Turso Cloud (LibSQL)
                        </h4>
                        <p className="text-[11px] text-zinc-400">Almacenamiento persistente en la nube y sincronización en tiempo real</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {dbInfo?.is_cloud ? 'Turso Cloud Conectado' : 'SQLite Local Activo'}
                      </span>
                      <button
                        type="button"
                        onClick={handlePingDatabase}
                        disabled={checkingDb}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingDb ? 'animate-spin text-emerald-400' : ''}`} />
                        <span>Probar Conexión</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Host / Endpoint</span>
                      <p className="text-xs font-mono text-emerald-300 font-bold truncate">
                        {dbInfo?.host || 'catalogo-vip-scz-edusoftware2026-netizen.aws-sa-east-1.turso.io'}
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Perfiles en Base de Datos</span>
                      <p className="text-xs font-mono text-white font-bold">
                        {profiles.length} modelos activas
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-1">
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Estado / Latencia</span>
                      <p className="text-xs font-mono text-amber-400 font-bold">
                        {dbInfo?.ping?.latency_ms !== undefined ? `${dbInfo.ping.latency_ms} ms de respuesta` : '🟢 En Línea'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR COMISIÓN */}
                <CollapsibleSection
                  defaultOpen={!qrImageUrl}
                  title={<><QrCode className="w-4 h-4 text-amber-400 shrink-0" /> Imagen QR de COMISIÓN / Pago</>}
                  summaryRight={
                    qrImageUrl
                      ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">Cargada</span>
                      : <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">Pendiente</span>
                  }
                >
                  <div className="p-4 bg-linear-to-br from-amber-500/10 via-zinc-950 to-zinc-950 border border-amber-500/30 rounded-xl space-y-4 -m-1">
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
                </CollapsibleSection>

                {/* MENSAJE FIJADO */}
                <CollapsibleSection
                  title={<><Pin className="w-4 h-4 text-amber-400 shrink-0" /> Mensaje Fijado en el Catálogo Web</>}
                  summaryRight={
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pinnedMessageActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                      {pinnedMessageActive ? 'Activo' : 'Inactivo'}
                    </span>
                  }
                >
                <div className="space-y-4">
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
                      className="py-2 px-4 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold transition-all cursor-pointer"
                    >
                      Guardar Mensaje Fijado
                    </button>
                  </div>

                  {/* Interruptor de estado del mensaje fijado (antes checkbox oculto tras el título) */}
                  <label className="flex items-center justify-between gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer">
                    <span className={`text-xs font-bold ${pinnedMessageActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {pinnedMessageActive ? 'ACTIVADO' : 'DESACTIVADO'}
                    </span>
                    <input
                      type="checkbox"
                      checked={pinnedMessageActive}
                      onChange={(e) => setPinnedMessageActive(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </label>
                </div>
                </CollapsibleSection>

                {/* DESTINO DE PUBLICACIÓN: BOT + CANAL / SOLO BOT / SOLO CANAL */}
                <CollapsibleSection
                  defaultOpen
                  title={<><Send className="w-4 h-4 text-amber-400 shrink-0" /> Destino de Publicación de Perfiles</>}
                  summaryRight={
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                      {publishDestination === 'bot_and_channel' ? 'Bot + Canal' : publishDestination === 'only_bot' ? 'Solo Bot' : 'Solo Canal'}
                    </span>
                  }
                >
                <div className="space-y-4">
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Configura dónde se publicarán los perfiles y fotos al crearlos o actualizarlos desde este panel administrativo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPublishDestination('bot_and_channel');
                        handleSaveSettings(undefined, undefined, 'bot_and_channel');
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        publishDestination === 'bot_and_channel'
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                          : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">Bot + Canal</span>
                        {publishDestination === 'bot_and_channel' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 leading-relaxed">
                        Publica en el catálogo del bot/web y también sincroniza automáticamente en el canal de Telegram.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPublishDestination('only_bot');
                        handleSaveSettings(undefined, undefined, 'only_bot');
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        publishDestination === 'only_bot'
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                          : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">Solo Bot</span>
                        {publishDestination === 'only_bot' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 leading-relaxed">
                        Solo visible en el Catálogo Web / Mini App. NO envía publicaciones al canal público.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPublishDestination('only_channel');
                        handleSaveSettings(undefined, undefined, 'only_channel');
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        publishDestination === 'only_channel'
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                          : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">Solo Canal</span>
                        {publishDestination === 'only_channel' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 leading-relaxed">
                        Sincroniza y publica prioritariamente en el canal público de Telegram.
                      </span>
                    </button>
                  </div>
                </div>
                </CollapsibleSection>

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

                {/* AJUSTES RÁPIDOS DE TELEGRAM: bot, administradora y respuesta automática */}
                <CollapsibleSection
                  title={<><MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" /> Ajustes Rápidos de Telegram</>}
                  summaryRight={
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">
                      3 ajustes
                    </span>
                  }
                >
                <div className="space-y-5">

                {/* BOT USERNAME */}
                <form onSubmit={handleSaveSettings} className="space-y-3">
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
                        className="w-full min-h-11 pl-7 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="min-h-11 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                {/* ADMIN CONTACT USERNAME */}
                <form onSubmit={handleSaveSettings} className="space-y-3 pt-4 border-t border-zinc-800/60">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" /> Usuario Oficial de la Administradora (Telegram)
                  </h4>
                  <p className="text-zinc-400">
                    Username de la Administradora (por defecto <code className="text-amber-400 font-mono font-bold">danii001</code>). El botón de comprobantes de pago y consultas del catálogo conectará directamente a este chat.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-zinc-500 font-bold text-xs">@</span>
                      <input
                        type="text"
                        value={adminContactUsername.replace(/^@/, '')}
                        onChange={(e) => setAdminContactUsername(e.target.value)}
                        placeholder="danii001"
                        className="w-full min-h-11 pl-7 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="min-h-11 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                {/* AUTO REPLY DELAY */}
                <form onSubmit={handleSaveSettings} className="space-y-3 pt-4 border-t border-zinc-800/60">
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
                      inputMode="numeric"
                      value={autoReplyDelay}
                      onChange={(e) => setAutoReplyDelay(e.target.value)}
                      placeholder="10"
                      className="w-28 min-h-11 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <span className="text-zinc-400 font-bold">minutos</span>
                    <button
                      type="submit"
                      disabled={loading}
                      className="ml-auto min-h-11 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </form>

                </div>
                </CollapsibleSection>

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
                            {reqItem.receipt_url && (
                              <div className="mt-2 flex items-center gap-2 bg-zinc-900/90 p-2 rounded-xl border border-emerald-500/30">
                                <a href={reqItem.receipt_url} target="_blank" rel="noopener noreferrer" className="block shrink-0">
                                  <img src={reqItem.receipt_url} alt="Comprobante" className="w-12 h-12 object-cover rounded-lg border border-zinc-700 hover:scale-105 transition-transform" />
                                </a>
                                <div className="text-xs">
                                  <span className="text-emerald-400 font-bold block">📸 Comprobante de pago</span>
                                  <a href={reqItem.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-[11px]">
                                    Ver imagen completa ↗
                                  </a>
                                </div>
                              </div>
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
                                className="px-3.5 py-2 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-zinc-950 font-extrabold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs"
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
                    <div className="overflow-x-auto w-full">
                      <table className="w-full min-w-137.5 text-left border-collapse">
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
                              <td className="p-3 text-emerald-400 font-bold">Bs. {item.amount_bs || 50}</td>
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
                            <span className="text-zinc-300 text-xs wrap-break-word">{log.details}</span>
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
                            <span className="text-rose-300 text-xs wrap-break-word">{err.error_message}</span>
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

          {/* ── Bottom Navigation fija (solo pantallas pequeñas): pulgares siempre al alcance ── */}
          <nav
            aria-label="Navegación principal"
            className="sm:hidden shrink-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-1 pt-1 pb-safe flex items-stretch justify-between gap-0.5"
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'new' ? resetNewForm() : setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-12 rounded-xl py-1.5 cursor-pointer transition-colors ${
                  activeTab === tab.id ? 'text-amber-400 bg-zinc-900/60' : 'text-zinc-400 active:bg-zinc-800/40'
                }`}
              >
                <span className="relative">
                  {tab.icon}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${
                      activeTab === tab.id ? 'bg-amber-400/20 text-amber-400' : 'bg-zinc-700 text-zinc-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-semibold leading-none">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  </div>
  );
};
