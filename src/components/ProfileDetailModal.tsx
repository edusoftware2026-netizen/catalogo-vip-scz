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
  FileText,
  MapPin,
  Sparkles
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

  // Control de la nueva ventana / modal para el Código QR y Condiciones
  const [showQrModal, setShowQrModal] = useState(false);

  // Consentimiento específico para el perfil actual:
  // Una vez que el usuario da su consentimiento, no vuelve a aparecer las reglas en este perfil
  // (muestra directamente el QR), y se reinicia cuando abra otro perfil.
  const [consentedProfileId, setConsentedProfileId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!profile) return null;

  const isCurrentProfileConsented = consentedProfileId === profile.id;

  const photos = profile.photos && profile.photos.length > 0
    ? profile.photos
    : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'];

  const cleanAdmin = adminContactUsername.replace(/^@/, '').trim() || 'danii001';

  const handleToggleTerms = (accepted: boolean) => {
    if (accepted) {
      setConsentedProfileId(profile.id);
    } else {
      setConsentedProfileId(null);
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
    if (!isCurrentProfileConsented) {
      setError('Debes leer y aceptar el procedimiento oficial para continuar.');
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
      formData.append('notes', notes || 'Comprobante de reserva adjunto desde el catálogo');

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
        setError(data.error || 'Error al procesar la reserva');
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
        
        {/* Botón de Cierre de la vista de la modelo */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
            
            {/* SECCIÓN 1: GALERÍA DE FOTOS (COLUMNA IZQUIERDA - SIN MINI-IMÁGENES REDUNDANTES) */}
            <div className="lg:col-span-6 bg-zinc-950 p-4 sm:p-6 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-zinc-800/80">
              
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

            </div>

            {/* SECCIÓN 2: PERFIL DE LA MODELO Y BOTÓN VISIBLE PARA CÓDIGO QR (COLUMNA DERECHA) */}
            <div className="lg:col-span-6 p-5 sm:p-7 flex flex-col justify-between bg-zinc-900/90 space-y-6">
              
              <div className="space-y-5">
                {/* Encabezado y Datos de la Modelo */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Perfil Exclusivo
                    </span>
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-500" /> Santa Cruz
                    </span>
                  </div>

                  <h2 className="text-3xl font-extrabold text-white font-serif tracking-tight">
                    {profile.name}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {profile.age} años · Modelo verificada del catálogo
                  </p>
                </div>

                {/* TARIFAS INDIVIDUALES CLARAS (SIN REDUNDANCIA) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-left">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      Tarifa de Servicio
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5 block">
                      Bs. {profile.rate_bs}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      Referencial encuentro
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left">
                    <span className="text-[10px] uppercase font-bold text-amber-300/80 tracking-wider block">
                      Reserva / Anticipo
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5 block">
                      Bs. {profile.commission_bs}
                    </span>
                    <span className="text-[10px] text-amber-300/70 block mt-0.5">
                      Pago anticipado BOT
                    </span>
                  </div>
                </div>

                {/* DESCRIPCIÓN */}
                <div className="space-y-1.5 text-left">
                  <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
                    Sobre {profile.name}
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-800/60 whitespace-pre-line">
                    {profile.description || 'Perfil seleccionado para el catálogo VIP Santa Cruz.'}
                  </p>
                </div>

                {/* NOTA DE PRIVACIDAD */}
                <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/50 text-[11px] text-zinc-400 leading-relaxed">
                  🔒 Coordinación 100% privada y confidencial. Tras la verificación de la reserva oficial, recibirás el contacto de WhatsApp para coordinar directamente con {profile.name}.
                </div>
              </div>

              {/* BOTÓN PROMINENTE Y VISIBLE: CÓDIGO QR PARA RESERVA */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-linear-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <QrCode className="w-5 h-5 text-zinc-950 shrink-0" />
                  <span>CÓDIGO QR PARA RESERVA</span>
                </button>

                <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                  Presiona el botón para abrir el procedimiento oficial y habilitar el código QR de reserva.
                </p>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* ============================================================== */}
      {/* NUEVA VENTANA / MODAL: PROCEDIMIENTO OFICIAL Y CÓDIGO QR       */}
      {/* (PANTALLA MÁS GRANDE Y REGLAS CONDICIONADAS AL CONSENTIMIENTO)  */}
      {/* ============================================================== */}
      {showQrModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2.5 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl sm:max-w-3xl bg-zinc-900 border border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] text-zinc-100">
            
            {/* Cabecera de la ventana */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base sm:text-xl font-bold text-white font-serif">
                    Procedimiento y Código QR
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dama: <strong className="text-amber-300">{profile.name}</strong> · Monto Reserva: <strong className="text-amber-400 font-mono">Bs. {profile.commission_bs}</strong>
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido de la ventana */}
            <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-5 text-left">
              
              {submitted ? (
                /* VISTA DE ÉXITO TRAS ENVIAR */
                <div className="py-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    ¡Solicitud de Reserva Enviada!
                  </h3>
                  
                  <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto">
                    Tu comprobante para <strong className="text-amber-300">{profile.name}</strong> ha sido recibido por la Administradora en Telegram.
                  </p>

                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md mx-auto text-left space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between text-zinc-400">
                      <span>Monto de Reserva:</span>
                      <span className="text-emerald-400 font-bold font-mono">Bs. {profile.commission_bs}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Administradora:</span>
                      <span className="text-amber-400 font-bold">@{cleanAdmin}</span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3 max-w-md mx-auto">
                    <a
                      href={`https://t.me/${cleanAdmin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-4 px-5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Contactar a @{cleanAdmin} en Telegram
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setShowQrModal(false);
                        onClose();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Finalizar y Volver al Catálogo
                    </button>
                  </div>
                </div>
              ) : !isCurrentProfileConsented ? (
                /* ======================================================= */
                /* CASO 1: AÚN NO HA DADO SU CONSENTIMIENTO PARA ESTE PERFIL */
                /* PANTALLA DE REGLAS MÁS GRANDE CON BARRA DESLIZANTE       */
                /* ======================================================= */
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs uppercase font-extrabold text-amber-300 tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" />
                      Procedimiento Oficial de Reserva
                    </span>
                    <span className="text-xs text-amber-400/90 font-medium animate-pulse">
                      Desliza verticalmente hasta el final ↓
                    </span>
                  </div>

                  {/* CONTENEDOR GRANDE CON BARRA VERTICAL DESLIZANTE */}
                  <div className="p-5 sm:p-6 bg-zinc-950 rounded-2xl border border-zinc-800 max-h-[62vh] sm:max-h-[68vh] overflow-y-scroll text-xs sm:text-sm text-zinc-300 space-y-5 leading-relaxed scrollbar-thin scrollbar-thumb-amber-500/50 scrollbar-track-zinc-900">
                    
                    {/* Pasos */}
                    <div className="space-y-2">
                      <strong className="text-amber-300 text-sm block border-b border-zinc-800 pb-1">
                        📌 PASOS Y ACLARACIONES DEL CATÁLOGO
                      </strong>
                      <ul className="space-y-2.5 text-zinc-300 pl-1">
                        <li>
                          <strong className="text-white">Paso #1 — Revisa el Catálogo:</strong> Ingresa y revisa la información de cada dama disponible con sus fotografías, nombre y edad.
                        </li>
                        <li>
                          <strong className="text-white">Paso #2 — Elige a tu Dama Favorita:</strong> Selecciona a la persona de tu preferencia con la que deseas coordinar.
                        </li>
                        <li>
                          <strong className="text-white">Paso #3 — Realiza el Pago de Reserva:</strong> Solicita al BOT el pago correspondiente. <em>Todos los pagos se realizan únicamente mediante código QR oficial proporcionado por el BOT.</em>
                        </li>
                        <li>
                          <strong className="text-white">Paso #4 — Confirma tu Pago y Recibe el Contacto:</strong> Envía tu comprobante al chat de la administradora (@{cleanAdmin}). Una vez verificado el pago, te enviará el número de contacto de la dama seleccionada. A partir de ese momento, deberás comunicarte directamente con ella para consultar disponibilidad y coordinar de manera privada el encuentro.
                        </li>
                      </ul>
                    </div>

                    {/* FAQs */}
                    <div className="space-y-3 pt-2">
                      <strong className="text-amber-300 text-sm block border-b border-zinc-800 pb-1">
                        ❓ PREGUNTAS FRECUENTES SOBRE LA RESERVA
                      </strong>
                      <div className="space-y-3">
                        <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
                          <span className="text-amber-400 font-bold block mb-1 text-xs sm:text-sm">
                            ¿Por qué se debe pagar por adelantado?
                          </span>
                          <p className="text-zinc-400 text-xs leading-relaxed">
                            Es un requisito obligatorio para acceder al contacto. Permite identificar clientes realmente interesados, evitar consultas innecesarias y garantizar el respeto hacia las damas y su tiempo. Sin excepciones.
                          </p>
                        </div>

                        <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
                          <span className="text-amber-400 font-bold block mb-1 text-xs sm:text-sm">
                            ¿Qué incluye el pago?
                          </span>
                          <p className="text-zinc-400 text-xs leading-relaxed">
                            Incluye únicamente el acceso al número de WhatsApp de la dama elegida. Cualquier acuerdo posterior será exclusivamente entre el cliente y la dama de manera privada. La administración no interviene en dichas coordinaciones.
                          </p>
                        </div>

                        <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
                          <span className="text-amber-400 font-bold block mb-1 text-xs sm:text-sm">
                            ¿Puedo ver a la dama antes de pagar?
                          </span>
                          <p className="text-zinc-400 text-xs leading-relaxed">
                            No. Toda la información necesaria se encuentra en el catálogo (fotografías, descripción y detalles). Por respeto a la privacidad y seguridad, no se realizan presentaciones ni se proporcionan números antes de pagar la reserva.
                          </p>
                        </div>

                        <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800">
                          <span className="text-amber-400 font-bold block mb-1 text-xs sm:text-sm">
                            ¿Se realizan reembolsos?
                          </span>
                          <p className="text-zinc-400 text-xs leading-relaxed">
                            Como política general, no se realizan reembolsos una vez entregado el contacto. Si la dama elegida no puede concretar por motivos personales o falta de disponibilidad, la administración podrá gestionar una alternativa equivalente con otra dama disponible, previa aceptación del cliente.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Aclaraciones disponibilidad */}
                    <div className="space-y-2 pt-2">
                      <strong className="text-amber-300 text-sm block border-b border-zinc-800 pb-1">
                        ⚠️ ACLARACIONES IMPORTANTES SOBRE DISPONIBILIDAD
                      </strong>
                      <ul className="space-y-1.5 text-zinc-300 pl-1 text-xs sm:text-sm">
                        <li>• <strong className="text-white">Cero consultas de disponibilidad a Daniela:</strong> No escribir al privado preguntando si alguna dama está libre. La modalidad exige pagar con anticipación.</li>
                        <li>• <strong className="text-white">El pago no garantiza disponibilidad inmediata:</strong> Si pagas el mismo día o a última hora, Daniela no se hace responsable si la dama no puede atenderte.</li>
                        <li>• <strong className="text-white">Recomendación:</strong> Paga la reserva con 1 o más días de anticipación (ej: para el domingo, pagar viernes o sábado) y coordina directamente con ella.</li>
                      </ul>
                    </div>

                    {/* AL FINAL RECIÉN: DECLARACIÓN DE ACEPTACIÓN CON CASILLA CHECK */}
                    <div className="pt-3 border-t border-zinc-800">
                      <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 cursor-pointer select-none hover:bg-amber-500/15 transition-colors">
                        <input
                          type="checkbox"
                          checked={isCurrentProfileConsented}
                          onChange={(e) => handleToggleTerms(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-amber-200 font-semibold leading-relaxed">
                          <strong>Declaro haber leído y acepto los pasos, aclaraciones del catálogo y condiciones del servicio:</strong> Entiendo que el pago incluye únicamente el acceso al contacto, no se reembolsa, no garantiza disponibilidad para el mismo día y coordinaré directamente con la dama.
                        </span>
                      </label>
                    </div>

                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* CASO 2: EL USUARIO YA DIO SU CONSENTIMIENTO                               */
                /* LAS REGLAS YA NO APARECEN MÁS; MUESTRA DIRECTAMENTE EL QR Y LA RESERVA    */
                /* ========================================================================= */
                <div className="space-y-5 animate-in fade-in duration-200">
                  
                  {/* CAJA DE CÓDIGO QR Y PRECIO */}
                  <div className="p-5 rounded-2xl bg-zinc-950 border border-amber-500/40 text-center space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                      <QrCode className="w-4 h-4 text-amber-400" />
                      CÓDIGO QR OFICIAL
                    </div>

                    {/* Visor de QR */}
                    <div className="flex justify-center items-center">
                      {qrImageUrl ? (
                        <div className="p-3 bg-white rounded-2xl shadow-xl border border-amber-500/30 max-w-52">
                          <img
                            src={qrImageUrl}
                            alt="QR Oficial de Pago"
                            className="w-44 h-44 sm:w-48 sm:h-48 object-contain mx-auto"
                          />
                        </div>
                      ) : (
                        <div className="w-44 h-44 bg-zinc-900 border border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center p-3 text-zinc-500 text-center">
                          <QrCode className="w-10 h-10 mb-1 opacity-40" />
                          <span className="text-xs leading-tight">Solicita el QR directamente a @{cleanAdmin}</span>
                        </div>
                      )}
                    </div>

                    {/* PRECIO EXACTO */}
                    <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl max-w-sm mx-auto">
                      <span className="text-xs uppercase tracking-wider text-zinc-400 block font-semibold">
                        Monto a transferir:
                      </span>
                      <span className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono">
                        Bs. {profile.commission_bs}
                      </span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Transfiere el monto exacto mediante este código QR para procesar tu solicitud.
                      </p>
                    </div>
                  </div>

                  {/* FORMULARIO PARA ADJUNTAR COMPROBANTE Y SOLICITAR RESERVA */}
                  <form onSubmit={handleSubmitProof} className="space-y-4">
                    
                    {/* Botón para adjuntar captura */}
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
                          className="w-full py-3.5 px-4 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                          Adjuntar captura de comprobante de pago
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-500/40 flex items-center gap-3">
                          {previewUrl && (
                            <img
                              src={previewUrl}
                              alt="Preview comprobante"
                              className="w-12 h-12 object-cover rounded-lg border border-zinc-800"
                            />
                          )}
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-1 text-emerald-400 text-xs sm:text-sm font-bold">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Comprobante listo</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Eliminar archivo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mensaje breve para la administradora */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5 text-left">
                        Mensaje breve para la Administradora (@{cleanAdmin}):
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={`Ej: Hola Dani, te adjunto comprobante para coordinar mi cita con ${profile.name}...`}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 transition-colors"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* BOTÓN SOLICITAR RESERVA */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 px-5 rounded-xl bg-linear-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-zinc-950 font-extrabold text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? (
                        <span>Procesando Reserva...</span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Solicitar Reserva
                        </>
                      )}
                    </button>
                  </form>

                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
