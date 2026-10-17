import React, { useState, useRef } from 'react';
import { Profile } from '../types';
import {
  X,
  Send,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Upload,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';

export interface TelegramUserContext {
  id: string;
  first_name: string;
  username?: string;
}

interface ProfileDetailModalProps {
  profile: Profile | null;
  botUsername?: string;
  qrImageUrl?: string;
  adminContactUsername?: string;
  tgUserContext?: TelegramUserContext | null;
  onClose: () => void;
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  profile,
  botUsername = 'CatalogoVIPSCZBot',
  qrImageUrl = '',
  adminContactUsername = 'danii001',
  tgUserContext,
  onClose
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Estado de Aceptación Obligatoria de Reglas para visualizar el QR
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('iamdani_terms_accepted') === 'true';
  });
  const [showFullTerms, setShowFullTerms] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!profile) return null;

  const photos = profile.photos && profile.photos.length > 0
    ? profile.photos
    : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'];

  const cleanAdmin = adminContactUsername.replace(/^@/, '').trim() || 'danii001';

  const handleToggleTerms = (accepted: boolean) => {
    setHasAcceptedTerms(accepted);
    if (typeof window !== 'undefined') {
      if (accepted) {
        sessionStorage.setItem('iamdani_terms_accepted', 'true');
      } else {
        sessionStorage.removeItem('iamdani_terms_accepted');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAcceptedTerms) {
      setError('Debes leer y aceptar el procedimiento y las reglas obligatorias para continuar.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('profile_id', profile.id);
      formData.append('client_name', tgUserContext?.first_name || 'Cliente Catálogo');
      formData.append('client_telegram', tgUserContext?.username ? `@${tgUserContext.username}` : (tgUserContext?.id ? `ID:${tgUserContext.id}` : ''));
      if (tgUserContext?.id) {
        formData.append('tg_user_id', tgUserContext.id);
      }
      formData.append('notes', notes || 'Comprobante de comisión adjunto desde el catálogo');

      if (selectedFile) {
        formData.append('receipt', selectedFile);
      }

      const res = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Error al procesar el comprobante');
      }
    } catch {
      setError('Error de conexión con el servidor. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl text-zinc-100 my-auto flex flex-col max-h-[94vh]">
        
        {/* Botón de Cierre */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
            
            {/* SECCIÓN 1: GALERÍA COMPLETA DE TODAS LAS FOTOS (COLUMNA IZQUIERDA) */}
            <div className="lg:col-span-6 bg-zinc-950 p-4 sm:p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-800/80">
              
              {/* Visor Principal */}
              <div className="relative aspect-3/4 w-full bg-zinc-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <img
                  src={photos[activePhotoIdx]}
                  alt={`${profile.name} - Foto ${activePhotoIdx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-opacity duration-300"
                />

                {/* Badge Edad */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-950/80 border border-zinc-700/80 text-amber-300 backdrop-blur-md flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{profile.age} años</span>
                  </span>
                </div>

                {/* Flechas de navegación */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-950/70 text-white hover:bg-zinc-950 transition-colors border border-zinc-700/50 cursor-pointer"
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActivePhotoIdx((prev) => (prev + 1) % photos.length)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-950/70 text-white hover:bg-zinc-950 transition-colors border border-zinc-700/50 cursor-pointer"
                      aria-label="Siguiente foto"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Contador de fotos */}
                <div className="absolute bottom-2.5 right-3 bg-zinc-950/80 px-2 py-0.5 rounded-full text-[11px] font-mono text-zinc-300 border border-zinc-800">
                  {activePhotoIdx + 1} / {photos.length}
                </div>
              </div>

              {/* TIRA DE MINIATURAS: TODAS LAS FOTOS DEL CATÁLOGO */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">
                    Catálogo de Fotos ({photos.length})
                  </span>
                  <span className="text-[10px] text-amber-400 font-medium">Toca para ampliar</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`relative w-14 h-18 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activePhotoIdx === idx
                          ? 'border-amber-400 shadow-md shadow-amber-500/30 scale-105'
                          : 'border-zinc-800 opacity-60 hover:opacity-100 hover:border-zinc-600'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Miniatura ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarifa de Referencia y Descripción */}
              <div className="mt-4 pt-3 border-t border-zinc-900">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">Tarifa referencial servicio:</span>
                  <span className="font-bold text-amber-300 font-mono">Bs. {profile.rate_bs}</span>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/40">
                  {profile.description}
                </p>
              </div>

            </div>

            {/* SECCIÓN 2: TÉRMINOS OBLIGATORIOS, QR, COMISIÓN Y COMPROBANTE (COLUMNA DERECHA) */}
            <div className="lg:col-span-6 p-4 sm:p-6 flex flex-col justify-between bg-zinc-900/90">
              
              {submitted ? (
                /* VISTA DE ÉXITO TRAS ENVIAR */
                <div className="my-auto py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    ¡Comprobante y Solicitud Enviados!
                  </h3>
                  
                  <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
                    Tu comprobante de comisión para <strong className="text-amber-300">{profile.name}</strong> ha sido recibido por la Administradora en Telegram.
                  </p>

                  <div className="p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-2xl max-w-sm mx-auto text-left space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Monto Comisión:</span>
                      <span className="text-emerald-400 font-bold font-mono">Bs. {profile.commission_bs}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Administradora:</span>
                      <span className="text-amber-400 font-bold">@{cleanAdmin}</span>
                    </div>
                  </div>

                  <div className="pt-3 space-y-2 max-w-sm mx-auto">
                    <a
                      href={`https://t.me/${cleanAdmin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Contactar a @{cleanAdmin} en Telegram
                    </a>

                    <button
                      onClick={onClose}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Volver al Catálogo
                    </button>
                  </div>
                </div>
              ) : (
                /* FORMULARIO DIRECTO */
                <form onSubmit={handleSubmitProof} className="space-y-4">
                  
                  {/* Encabezado */}
                  <div>
                    <h2 className="text-2xl font-bold text-white font-serif tracking-tight">
                      {profile.name}
                    </h2>
                    <p className="text-[11px] text-amber-400 font-medium">
                      Paso Obligatorio: Pago de Comisión y Reserva
                    </p>
                  </div>

                  {/* AVISO DESTACADO: INDICACIÓN AL USUARIO PARA SOLICITAR QR */}
                  <div className="p-3.5 bg-linear-to-r from-amber-500/20 via-amber-500/10 to-zinc-950 border-2 border-amber-500/50 rounded-2xl flex items-start gap-3 shadow-md shadow-amber-500/5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-1 text-left">
                      <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                        Lectura Obligatoria para Solicitar QR
                      </h3>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        Para que el <strong>código QR de pago de la comisión</strong> sea visible y puedas adjuntar tu comprobante, <strong>es obligatorio leer todos los términos, pasos y condiciones</strong> detallados a continuación y marcar la casilla de aceptación.
                      </p>
                    </div>
                  </div>

                  {/* BLOQUE DE REGLAS Y NUEVA MODALIDAD DE ATENCIÓN */}
                  <div className="p-3.5 bg-zinc-950/90 border border-amber-500/40 rounded-2xl space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                          Comunicado Oficial y Reglas Obligatorias
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFullTerms(!showFullTerms)}
                        className="text-[11px] text-amber-400/90 hover:text-amber-300 font-medium flex items-center gap-0.5 cursor-pointer"
                      >
                        {showFullTerms ? <><ChevronUp className="w-3.5 h-3.5" /> Menos</> : <><ChevronDown className="w-3.5 h-3.5" /> Ver todo</>}
                      </button>
                    </div>

                    {/* Resumen siempre visible */}
                    <div className="text-[11px] text-zinc-300 space-y-1 leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/60">
                      <p>
                        ⚠️ <strong>Atención exclusivamente por BOT:</strong> Daniela no atiende consultas privadas de disponibilidad.
                      </p>
                      <p>
                        📅 <strong>Pago con anticipación (1 o más días antes):</strong> No se coordinan servicios ni disponibilidad para el mismo día.
                      </p>
                      <p>
                        💳 <strong>El pago es solo por la comisión:</strong> No garantiza disponibilidad inmediata. Tras verificar el pago, recibirás el contacto de WhatsApp para coordinar directamente con la chica.
                      </p>
                    </div>

                    {/* Términos completos desplegables (100% de los pasos, aclaraciones y FAQ) */}
                    {showFullTerms && (
                      <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-[11px] text-zinc-300 space-y-3.5 max-h-72 overflow-y-auto leading-relaxed animate-in fade-in duration-150 scrollbar-thin scrollbar-thumb-zinc-700">
                        <div>
                          <strong className="text-amber-300 block mb-1">📌 PASOS Y ACLARACIONES DEL CATÁLOGO</strong>
                          <ul className="space-y-1.5 text-zinc-300 pl-1">
                            <li><strong>Paso #1 — Revisa el Catálogo:</strong> Ingresa y revisa la información de cada dama disponible con sus fotografías, nombre y edad.</li>
                            <li><strong>Paso #2 — Elige a tu Dama Favorita:</strong> Selecciona a la persona de tu preferencia con la que deseas coordinar.</li>
                            <li><strong>Paso #3 — Realiza el Pago de la Comisión:</strong> Solicita al BOT el pago de la comisión. <em>Todos los pagos se realizan únicamente mediante código QR oficial proporcionado por el BOT.</em></li>
                            <li><strong>Paso #4 — Confirma tu Pago y Recibe el Contacto:</strong> Envía tu comprobante al chat de la administradora (@{cleanAdmin}). Una vez verificado el pago, te enviará el número de contacto de la dama seleccionada. A partir de ese momento, deberás comunicarte directamente con ella para consultar disponibilidad y coordinar de manera privada el encuentro.</li>
                          </ul>
                        </div>

                        <div>
                          <strong className="text-amber-300 block mb-1">❓ PREGUNTAS FRECUENTES SOBRE EL PAGO DE COMISIÓN</strong>
                          <div className="space-y-2 pl-1">
                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/60">
                              <span className="text-amber-400 font-bold block mb-0.5">¿Por qué se debe pagar la comisión por adelantado?</span>
                              <p className="text-zinc-400 text-[10px]">Es un requisito obligatorio para acceder al contacto. Permite identificar clientes realmente interesados, evitar consultas innecesarias y garantizar el respeto hacia las damas y su tiempo. Sin excepciones.</p>
                            </div>

                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/60">
                              <span className="text-amber-400 font-bold block mb-0.5">¿Qué incluye el pago de la comisión?</span>
                              <p className="text-zinc-400 text-[10px]">Incluye únicamente el acceso al número de WhatsApp de la dama elegida. Cualquier acuerdo posterior será exclusivamente entre el cliente y la dama de manera privada. La administración no interviene en dichas coordinaciones.</p>
                            </div>

                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/60">
                              <span className="text-amber-400 font-bold block mb-0.5">¿Puedo ver a la dama antes de pagar?</span>
                              <p className="text-zinc-400 text-[10px]">No. Toda la información necesaria se encuentra en el catálogo (fotografías, descripción y detalles). Por respeto a la privacidad y seguridad, no se realizan presentaciones ni se proporcionan números antes de pagar la comisión.</p>
                            </div>

                            <div className="bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/60">
                              <span className="text-amber-400 font-bold block mb-0.5">¿Se realizan reembolsos?</span>
                              <p className="text-zinc-400 text-[10px]">Como política general, no se realizan reembolsos de la comisión una vez entregado el contacto. Si la dama elegida no puede concretar por motivos personales o falta de disponibilidad, la administración podrá gestionar una alternativa equivalente con otra dama disponible, previa aceptación del cliente.</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <strong className="text-amber-300 block mb-1">⚠️ ACLARACIONES IMPORTANTES SOBRE DISPONIBILIDAD</strong>
                          <ul className="space-y-1 text-zinc-300 pl-1 text-[10px]">
                            <li>• <strong>Cero consultas de disponibilidad a Daniela:</strong> No escribir al privado preguntando si alguna dama está libre. La modalidad exige pagar con anticipación.</li>
                            <li>• <strong>El pago no garantiza disponibilidad inmediata:</strong> Si pagas el mismo día o a última hora, Daniela no se hace responsable si la dama no puede atenderte.</li>
                            <li>• <strong>Recomendación:</strong> Paga la comisión con 1 o más días de anticipación (ej: para el domingo, pagar viernes o sábado) y coordina directamente con ella.</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* CASILLA DE ACEPTACIÓN OBLIGATORIA */}
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 cursor-pointer select-none hover:bg-amber-500/15 transition-colors">
                      <input
                        type="checkbox"
                        checked={hasAcceptedTerms}
                        onChange={(e) => handleToggleTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-amber-500 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] text-amber-200 font-medium leading-tight">
                        <strong>Declaro haber leído y comprendido los pasos, aclaraciones del catálogo y condiciones del servicio:</strong> Entiendo que el pago incluye únicamente el acceso al contacto, no se reembolsa, no garantiza disponibilidad para el mismo día y coordinaré directamente con la dama.
                      </span>
                    </label>
                  </div>

                  {/* BLOQUE CONDICIONAL: SI NO ACEPTA, QR BLOQUEADO; SI ACEPTA, QR VISIBLE */}
                  {!hasAcceptedTerms ? (
                    <div className="p-6 rounded-2xl bg-zinc-950/90 border-2 border-dashed border-amber-500/30 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Lock className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">
                        Código QR de Pago Bloqueado
                      </h4>
                      <p className="text-xs text-amber-200/90 max-w-sm mx-auto leading-relaxed">
                        Para solicitar y ver el código QR con el monto de la comisión, primero <strong>debes leer todos los términos, pasos y condiciones</strong> detallados arriba y marcar la casilla de aceptación obligatoria.
                      </p>
                    </div>
                  ) : (
                    /* QR VISIBLE Y FORMULARIO DESBLOQUEADO */
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      
                      {/* CAJA DESTACADA: QR + SOLO PRECIO DE LA COMISIÓN */}
                      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-amber-500/40 text-center space-y-3 shadow-inner">
                        
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                          <QrCode className="w-3.5 h-3.5" /> CÓDIGO QR OFICIAL DE COMISIÓN
                        </div>

                        {/* QR Code Display */}
                        <div className="flex justify-center items-center">
                          {qrImageUrl ? (
                            <div className="p-2.5 bg-white rounded-2xl shadow-xl border border-amber-500/30 max-w-44">
                              <img
                                src={qrImageUrl}
                                alt="QR de Pago de Comisión"
                                className="w-36 h-36 sm:w-40 sm:h-40 object-contain mx-auto"
                              />
                            </div>
                          ) : (
                            <div className="w-36 h-36 bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-3 text-zinc-500 text-center">
                              <QrCode className="w-10 h-10 mb-1 opacity-40" />
                              <span className="text-[10px] leading-tight">Solicita el QR directamente a @{cleanAdmin}</span>
                            </div>
                          )}
                        </div>

                        {/* PRECIO SOLO DE LA COMISIÓN */}
                        <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
                          <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-semibold">
                            Monto a transferir (Solo Comisión):
                          </span>
                          <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                            Bs. {profile.commission_bs}
                          </span>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Realiza la transferencia de este monto exacto para procesar tu solicitud.
                          </p>
                        </div>
                      </div>

                      {/* BOTÓN PARA ADJUNTAR CAPTURA DE COMPROBANTE DE PAGO */}
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                          id="receipt-file-input"
                        />

                        {!selectedFile ? (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 px-3.5 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                            Adjuntar captura de comprobante de pago
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-emerald-500/40 flex items-center gap-3">
                            {previewUrl && (
                              <img
                                src={previewUrl}
                                alt="Preview comprobante"
                                className="w-12 h-12 object-cover rounded-lg border border-zinc-800"
                              />
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Comprobante listo</span>
                              </div>
                              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveFile}
                              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Eliminar archivo"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* CAMPO DE MENSAJE BREVE PARA LA ADMINISTRADORA (@danii001) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-300 mb-1 text-left">
                          Mensaje breve para la Administradora (@{cleanAdmin}):
                        </label>
                        <textarea
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={`Ej: Hola Dani, te adjunto mi comprobante para coordinar mi cita con ${profile.name}...`}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                        />
                      </div>

                      {error && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{error}</span>
                        </div>
                      )}

                      {/* BOTÓN DE ENVÍO */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-zinc-950 font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {submitting ? (
                          <span>Enviando comprobante...</span>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Enviar Comprobante y Solicitar Atención
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-zinc-500 text-center">
                        🔒 Al enviar, confirmas tu aceptación de las condiciones de atención.
                      </p>

                    </div>
                  )}

                </form>
              )}

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
