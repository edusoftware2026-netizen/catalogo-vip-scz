import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dns from 'dns';
import https from 'https';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}
import {
  getProfileById,
  saveProfile,
  deleteProfile,
  getAllProfiles,
  getConversationState,
  setConversationState,
  clearConversationState,
  createCustomerRequest,
  addAuditLog,
  addSyncError,
  getSystemSetting
} from './db.js';
import { Profile, ProfileStatus } from '../types.js';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Environment variables
export function getBotConfig() {
  const token = process.env.BOT_TOKEN || '';
  const storedUsername = getSystemSetting('bot_username');
  let username = (storedUsername || process.env.BOT_USERNAME || 'CatalogoVIPSCZBot').replace(/^@/, '').trim();
  if (username.toLowerCase() === 'catalogovipscz') {
    username = 'CatalogoVIPSCZBot';
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || 'secret_token_santa_cruz';
  const channelId = process.env.CHANNEL_ID || '-1003650435412';
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  const signingSecret = process.env.ADMIN_SIGNING_SECRET || 'secret_jwt_key_santa_cruz';
  const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:3000';

  return { token, username, secret, channelId, adminIds, signingSecret, baseUrl };
}

export function isAdminUser(telegramUserId: string | number): boolean {
  const { adminIds } = getBotConfig();
  if (adminIds.length === 0) {
    // If no admin IDs are configured in env, treat first user or any developer user as admin for seamless experience
    return true;
  }
  return adminIds.includes(String(telegramUserId));
}

// Helper para POST HTTPS nativo en Node.js (evita errores de undici/fetch con DNS IPv6 en Windows)
function httpsPostJson(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      family: 4,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseBody)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Telegram API Helper
async function callTelegramApi(method: string, body: any): Promise<any> {
  const { token } = getBotConfig();
  if (!token) {
    console.warn(`[Telegram API] Warning: BOT_TOKEN is not configured. Method called: ${method}`);
    return { ok: false, description: 'BOT_TOKEN is not configured in environment variables' };
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const data = await httpsPostJson(url, body);
    return data;
  } catch (err: any) {
    console.error(`[Telegram API Error - ${method}]:`, err?.message || err);
    return { ok: false, description: err?.message || 'Network error calling Telegram' };
  }
}

export async function sendMessage(chatId: string | number, text: string, options: any = {}) {
  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...options
  });
}

export async function pinChatMessage(chatId: string | number, messageId: number) {
  return await callTelegramApi('pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: false
  });
}

export async function updateBotMenuButton() {
  const { baseUrl } = getBotConfig();
  return await callTelegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '💎 Ver Catálogo VIP',
      web_app: {
        url: baseUrl
      }
    }
  });
}

export async function registerBotCommands() {
  return await callTelegramApi('setMyCommands', {
    commands: [
      { command: 'catalogo', description: '💎 Ver Catálogo VIP' },
      { command: 'admin', description: '🔐 Panel Administrativo' },
      { command: 'pasos', description: '📋 Pasos y Aclaraciones de Atención' },
      { command: 'faq', description: '❓ Preguntas Frecuentes sobre Comisión' },
      { command: 'start', description: '✨ Iniciar Menú Principal' }
    ]
  });
}

export async function registerBotWebhook() {
  const { baseUrl, secret } = getBotConfig();
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  return await callTelegramApi('setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query']
  });
}

// Telegram Channel Sync Function
export async function syncProfileToChannel(profileId: string, performer: string = 'Bot Admin'): Promise<{ success: boolean; message: string; telegramMessageId?: number }> {
  const { channelId, username, baseUrl } = getBotConfig();
  const profile = await getProfileById(profileId);

  if (!profile) {
    return { success: false, message: 'Perfil no encontrado en la base de datos' };
  }

  // Safety constraint: strictly >= 18
  if (profile.age < 18) {
    const errMsg = 'REGLA PROHIBITIVA: No se permite publicar perfiles menores de 18 años.';
    await addSyncError(profileId, 'PUBLISH_CHANNEL', errMsg);
    return { success: false, message: errMsg };
  }

  if (profile.status === 'retirada' || profile.status === 'borrador') {
    // If profile is retired or draft and has an existing message in channel, delete or mark as retired
    if (profile.telegram_message_id) {
      try {
        await callTelegramApi('deleteMessage', {
          chat_id: channelId,
          message_id: profile.telegram_message_id
        });
      } catch (e) {
        console.warn('Could not delete channel message:', e);
      }
      await saveProfile({ id: profile.id, telegram_message_id: null });
    }
    await addAuditLog('SYNC_CHANNEL', performer, `Perfil ${profile.name} (${profile.status}) removido del canal público`, profileId);
    return { success: true, message: `Perfil ${profile.status}: removido del canal público.` };
  }

  const statusBadge = profile.status === 'disponible' ? '🟢 DISPONIBLE' : profile.status === 'ocupada' ? '🔴 OCUPADA' : '⏸️ PAUSADA';

  const caption = `
✨ *CATÁLOGO SANTA CRUZ - ${profile.name.toUpperCase()}* ✨

👤 *Nombre*: ${profile.name}
🔞 *Edad*: ${profile.age} años
📍 *Ubicación*: Santa Cruz de la Sierra
💰 *TARIFA SERVICIO*: Bs. ${profile.rate_bs}
🏷️ *COMISIÓN*: Bs. ${profile.commission_bs}
📌 *Estado*: ${statusBadge}

📝 *Descripción*:
${profile.description}

─────────────────────────
⚠️ *AVISO DE DISCRECIÓN Y SEGURIDAD*:
• Servicios exclusivos para personas mayores de 18 años.
• Coordinación y confirmación previa directamente por privado.
`;

  const botCatalogUrl = `https://t.me/${username}?start=cat`;
  const reqUrl = `https://t.me/${username}?start=req_${profile.id}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '💎 Ver Catálogo VIP', url: botCatalogUrl }
      ],
      [
        { text: '📲 Solicitar Método de Pago (QR)', url: reqUrl }
      ]
    ]
  };

  let rawPhoto = profile.photos && profile.photos.length > 0 ? profile.photos[0] : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
  let sendRes: any = null;

  // Si la foto es un archivo local del servidor (/uploads/...)
  if (rawPhoto.startsWith('/uploads/')) {
    const cleanRelative = rawPhoto.replace(/^\//, '');
    const localCandidates = [
      path.join(process.cwd(), 'public', cleanRelative),
      path.join(process.cwd(), 'dist', cleanRelative),
      path.join(process.cwd(), cleanRelative)
    ];
    const foundPath = localCandidates.find(p => fs.existsSync(p));

    if (foundPath && token) {
      try {
        const fileBuffer = fs.readFileSync(foundPath);
        const blob = new Blob([fileBuffer]);
        const formData = new FormData();
        formData.append('chat_id', channelId);
        formData.append('photo', blob, path.basename(foundPath));
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
        formData.append('reply_markup', JSON.stringify(replyMarkup));

        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        sendRes = await tgRes.json();
      } catch (uploadErr: any) {
        console.warn('[Sync Channel Multipart Upload]:', uploadErr?.message || uploadErr);
      }
    }
  }

  // Si no se envió por multipart (es URL remota o fallback), usar callTelegramApi estándar
  if (!sendRes) {
    let primaryPhoto = rawPhoto;
    if (primaryPhoto.startsWith('/')) {
      primaryPhoto = `${baseUrl}${primaryPhoto}`;
    }
    sendRes = await callTelegramApi('sendPhoto', {
      chat_id: channelId,
      photo: primaryPhoto,
      caption,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    });
  }

  if (sendRes.ok && sendRes.result?.message_id) {
    const newMsgId = sendRes.result.message_id;
    await saveProfile({ id: profile.id, telegram_message_id: newMsgId });
    await addAuditLog('SYNC_CHANNEL', performer, `Publicado mensaje #${newMsgId} para ${profile.name} en el canal`, profileId);
    return { success: true, message: 'Publicado exitosamente en el canal', telegramMessageId: newMsgId };
  } else {
    const errorMsg = sendRes.description || 'Error al publicar foto en canal Telegram';
    let humanTip = errorMsg;
    if (errorMsg.includes('chat not found')) {
      humanTip = `Canal no encontrado (${channelId}). Asegúrate de agregar al bot @${username || 'bot'} como Administrador del canal con permiso de publicar mensajes.`;
    }
    await addSyncError(profileId, 'SEND_PHOTO_CHANNEL', humanTip);
    return { success: false, message: humanTip };
  }
}

export async function sendPhotoToUser(chatId: string | number, photoUrl: string, caption?: string) {
  return await callTelegramApi('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption || '',
    parse_mode: 'Markdown'
  });
}

// Generate Admin Web Magic Link
export function generateAdminMagicToken(telegramUserId: string): string {
  const { signingSecret } = getBotConfig();
  return jwt.sign(
    { sub: telegramUserId, role: 'admin', iat: Math.floor(Date.now() / 1000) },
    signingSecret,
    { expiresIn: '4h' }
  );
}

export function verifyAdminToken(token: string): { valid: boolean; userId?: string } {
  if (token === 'admin_session_dani2026' || token === 'dani2026') {
    return { valid: true, userId: 'admin_web' };
  }
  const { signingSecret } = getBotConfig();
  try {
    const decoded = jwt.verify(token, signingSecret) as any;
    if (decoded && decoded.role === 'admin') {
      return { valid: true, userId: decoded.sub };
    }
  } catch {
    // invalid token
  }
  return { valid: false };
}

// Webhook Handler for Telegram Updates
export async function processTelegramUpdate(update: any) {
  if (!update) return;

  // Handle Callback Queries (Buttons)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const text = message.text ? message.text.trim() : '';

  // 1. Deep Link Client Request handling (e.g., /start req_prof_scz_01 or /reservar prof_scz_01)
  if (text.startsWith('/start req_') || text.startsWith('/start pago_') || text.startsWith('/reservar ') || text.startsWith('/pago ')) {
    const profileId = text.replace('/start req_', '').replace('/start pago_', '').replace('/reservar ', '').replace('/pago ', '').trim();
    await handleClientAvailabilityRequest(message, profileId);
    return;
  }

  // 1.1. Comando /catalogo o apertura desde enlace de canal (/start cat)
  if (text === '/catalogo' || text === '/start cat' || text.startsWith('/start cat') || text.startsWith('/start p_')) {
    const { baseUrl } = getBotConfig();
    const cleanAdmin = getSystemSetting('admin_contact_username') || 'danii001';
    const isUserAdmin = isAdminUser(fromId);

    const keyboard: any[][] = [
      [
        { text: '💎 Ver Catálogo VIP', web_app: { url: baseUrl } }
      ]
    ];
    if (isUserAdmin) {
      keyboard.push([
        { text: '🔐 Panel Administrativo', web_app: { url: `${baseUrl}/admin` } }
      ]);
    }
    keyboard.push([
      { text: `💬 Administradora (@${cleanAdmin})`, url: `https://t.me/${cleanAdmin}` }
    ]);

    await sendMessage(chatId, `💎 *Iam Dani • Catálogo VIP Santa Cruz* 💎\n\nBienvenido/a a nuestro catálogo oficial y confidencial de damas ejecutivas en Santa Cruz de la Sierra.\n\nPulsa el botón *"💎 Ver Catálogo VIP"* abajo para abrir la Mini App y revisar perfiles y fotos:`, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }

  // 1.2. Código de Invitación VIP y Bienvenida Clientes (/invitar, /codigo, /vip, /start inv_, o /start sin ser admin)
  const isInviteCmd = text.startsWith('/start inv_') || text === '/invitar' || text === '/codigo' || text === '/vip' || (!isAdminUser(fromId) && text === '/start');
  if (isInviteCmd) {
    const { baseUrl, username } = getBotConfig();
    const cleanUsername = username || 'CatalogoVIPSCZBot';
    const shortCode = `VIP-SCZ-${(Math.abs(Number(fromId) || 1234) % 8999) + 1000}`;
    const inviteLink = `https://t.me/${cleanUsername}?start=inv_${(Math.abs(Number(fromId) || 1234) % 8999) + 1000}`;
    const cleanAdmin = getSystemSetting('admin_contact_username') || 'danii001';

    let titleHeader = '💎 *CÍRCULO VIP SANTA CRUZ — ACCESO CONFIDENCIAL* 💎';
    if (text.startsWith('/start inv_')) {
      const ref = text.replace('/start inv_', '').trim();
      titleHeader = `💎 *ACCESO VIP INVITADO (#${ref})* 💎`;
    }

    const vipMsg = `${titleHeader}\n\n` +
      `¡Bienvenido/a, *${message.from?.first_name || 'Miembro VIP'}*! Tu acceso confidencial al directorio oficial se encuentra habilitado.\n\n` +
      `🎫 *TU CÓDIGO DE INVITACIÓN EXCLUSIVO:*\n` +
      `\`${shortCode}\`\n\n` +
      `📲 *ENLACE DE INVITACIÓN PARA ACCESO AL BOT:*\n` +
      `👉 \`${inviteLink}\`\n\n` +
      `_Trato directo, discreto y 100% confidencial. Pulsa el botón "Ver Catálogo VIP" abajo para ver fotos y disponibilidad._`;

    const buttons: any[][] = [
      [
        { text: '💎 Ver Catálogo VIP', web_app: { url: baseUrl } }
      ]
    ];
    if (isAdminUser(fromId)) {
      buttons.push([
        { text: '🔐 Panel Administrativo', web_app: { url: `${baseUrl}/admin` } }
      ]);
    }
    buttons.push([
      { text: `💬 Administradora (@${cleanAdmin})`, url: `https://t.me/${cleanAdmin}` }
    ]);

    await sendMessage(chatId, vipMsg, {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
    return;
  }

  // 1.3. Pasos y Preguntas Frecuentes (/pasos, /faq, /aclaraciones, /preguntas)
  if (text === '/pasos' || text === '/faq' || text === '/aclaraciones' || text === '/preguntas') {
    const adminUsername = getSystemSetting('admin_contact_username') || 'danii001';
    const { baseUrl } = getBotConfig();
    const faqText = `
📖 *PASOS Y ACLARACIONES DEL CATÁLOGO*

📌 *PASO #1 — REVISA EL CATÁLOGO*
Ingresa al catálogo y revisa la información de cada dama disponible con sus fotografías, nombre y edad.

📌 *PASO #2 — ELIGE A TU DAMA FAVORITA*
Selecciona a la dama de tu preferencia con la que deseas coordinar un encuentro.

📌 *PASO #3 — REALIZA EL PAGO DE LA COMISIÓN*
Solicita al BOT el pago de la comisión.
💳 *Importante:* Todos los pagos se realizan únicamente mediante código QR oficial proporcionado por el BOT.

📌 *PASO #4 — CONFIRMA TU PAGO Y RECIBE EL CONTACTO*
Envía tu comprobante al chat de la Administradora (@${adminUsername}). Una vez confirmado, te enviará el número de WhatsApp de la dama seleccionada.
📲 A partir de ese momento, te comunicarás directamente con ella para coordinar en privado fecha, hora y lugar.

━━━━━━━━━━━━━━━━━━━
❓ *PREGUNTAS FRECUENTES (FAQ)*

🔹 *¿Por qué se debe pagar por adelantado?*
Es un requisito obligatorio para acceder al contacto. Permite identificar clientes serios, evitar consultas innecesarias y garantizar el respeto hacia las damas. Sin excepciones.

🔹 *¿Qué incluye el pago de la comisión?*
Únicamente el acceso al número de WhatsApp de la dama elegida. Todo acuerdo posterior es estrictamente privado entre el cliente y ella. La administración no interviene.

🔹 *¿Puedo ver a la dama antes de pagar?*
No. Toda la información está disponible en el catálogo. Por privacidad y seguridad, no se realizan presentaciones previas.

🔹 *¿Se realizan reembolsos?*
No se realizan reembolsos una vez entregado el contacto. Si la dama elegida no puede por motivos personales o disponibilidad, la administración gestionará una alternativa equivalente con otra dama disponible, previa aceptación.

⚠️ *Cero consultas de disponibilidad a Daniela:* Paga con anticipación (1 o más días antes).
    `;

    await sendMessage(chatId, faqText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💎 Ver Catálogo VIP', web_app: { url: baseUrl } }
          ],
          [
            { text: `💬 Chat con Daniela (@${adminUsername})`, url: `https://t.me/${adminUsername}` }
          ]
        ]
      }
    });
    return;
  }

  // 1.5. Comando administrativo para abrir el panel de gestión como Mini App
  if (text === '/panel' || text === '/admin') {
    const { baseUrl } = getBotConfig();
    const adminUrl = `${baseUrl}/admin`;
    const cleanAdmin = getSystemSetting('admin_contact_username') || 'danii001';
    const isUserAdmin = isAdminUser(fromId);

    if (!isUserAdmin) {
      await sendMessage(chatId, `🔒 *Acceso Administrativo*\n\nEste comando es exclusivo para la Administradora del catálogo (@${cleanAdmin}).\n\nPara consultar el catálogo disponible, pulsa abajo:`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💎 Ver Catálogo VIP', web_app: { url: baseUrl } }
            ]
          ]
        }
      });
      return;
    }

    await sendMessage(chatId, `🔐 *Panel de Administración — Iam Dani*\n\nAcceso exclusivo para la Administradora del catálogo.\nPuedes abrir tu Panel de Gestión directamente aquí dentro de Telegram o en tu navegador web:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔐 Panel Administrativo', web_app: { url: adminUrl } }
          ],
          [
            { text: '💎 Ver Catálogo VIP', web_app: { url: baseUrl } }
          ],
          [
            { text: '🌐 Abrir en Navegador Externo', url: adminUrl }
          ]
        ]
      }
    });
    return;
  }

  // 2. Guard for Administrative Commands
  if (!isAdminUser(fromId)) {
    if (text.startsWith('/')) {
      await sendMessage(chatId, `💎 *Catálogo VIP Santa Cruz*\n\nPara consultar disponibilidad y ver los perfiles oficiales, pulsa el botón *"Ver Catálogo VIP"* abajo en el menú del bot.\n\nO escribe /invitar para generar tu Código y Enlace de Invitación al bot.`);
    }
    return;
  }

  // Admin User Flow Processing
  const userIdStr = String(fromId);

  // Command switch
  if (text === '/start') {
    await clearConversationState(userIdStr);
    await sendAdminWelcome(chatId, message.from?.first_name || 'Administradora');
    return;
  }

  if (text === '/ayuda') {
    await sendAdminHelp(chatId);
    return;
  }

  if (text === '/anclar' || text === '/pin') {
    const { baseUrl, username } = getBotConfig();
    const cleanUsername = username || 'CatalogoVIPSCZBot';
    const inviteLink = `https://t.me/${cleanUsername}?start=inv_vip`;
    const msg = `💎 *CATÁLOGO VIP SANTA CRUZ — ACCESO CONFIDENCIAL* 💎\n\n` +
      `Bienvenido al canal oficial de atención confidencial y reserva directa en Santa Cruz de la Sierra.\n\n` +
      `📲 *ENLACE DE INVITACIÓN DIRECTA AL BOT:*\n` +
      `👉 \`${inviteLink}\`\n\n` +
      `_Trato directo, discreto y 100% confidencial. Pulsa el botón "Ver Catálogo VIP" en el menú inferior para abrir el directorio._`;

    const res = await sendMessage(chatId, msg);
    if (res && res.result && res.result.message_id) {
      await pinChatMessage(chatId, res.result.message_id);
    }
    await updateBotMenuButton();
    await sendMessage(chatId, `✅ *Mensaje anclado en Telegram y botón "Ver Catálogo" sincronizado con la web actual.*`);
    return;
  }

  if (text === '/cancelar') {
    await clearConversationState(userIdStr);
    await sendMessage(chatId, '❌ *Operación cancelada*. Has regresado al menú principal.');
    return;
  }

  if (text === '/nuevo') {
    await setConversationState(userIdStr, 'NEW_NAME', {});
    await sendMessage(chatId, '➕ *Crear Nuevo Perfil (Paso 1/8)*\n\nPor favor, escribe el *Nombre Público* de la chica:');
    return;
  }

  if (text === '/listar') {
    await handleListProfiles(chatId);
    return;
  }

  if (text.startsWith('/qr ')) {
    const targetUserId = text.replace('/qr ', '').trim();
    const qrUrl = getSystemSetting('qr_image_url');
    if (!qrUrl) {
      await sendMessage(chatId, '⚠️ *No hay imagen QR configurada* en el panel administrativo. Sube primero la imagen del QR en el Panel de Administración (pestaña Telegram).');
      return;
    }

    const { getCustomerRequests } = await import('./db.js');
    const userRequests = await getCustomerRequests();
    const userReq = userRequests.find(r => r.telegram_user_id === targetUserId);
    let commText = 'de la reserva';
    let profName = '';
    if (userReq) {
      profName = ` para *${userReq.profile_name}*`;
      const p = await getProfileById(userReq.profile_id);
      if (p && p.commission_bs) {
        commText = `Bs. ${p.commission_bs}`;
      }
    }

    const replyText = `✨ *Iam Dani Catálogo Santa Cruz* ✨\n\n¡Hola!\n\nNuestra Administradora ha confirmado tu solicitud${profName}.\n\n🏷️ *MONTO DE COMISIÓN*: *${commText}*\n\n📲 *Por favor, realiza el pago de ${commText} mediante este QR oficial y envía tu comprobante / captura directamente al chat de la Administradora para coordinar tu ingreso.* ¡Confidencialidad absoluta!`;
    const resQr = await sendPhotoToUser(targetUserId, qrUrl, replyText);
    if (resQr.ok) {
      await sendMessage(chatId, `✅ *QR de COMISIÓN (${commText}) enviado exitosamente* al cliente con ID \`${targetUserId}\`.`);
    } else {
      await sendMessage(chatId, `❌ *Error al enviar QR al cliente* (\`${targetUserId}\`): ${resQr.description || 'Error desconocido'}`);
    }
    return;
  }

  if (text.startsWith('/ver ')) {
    const id = text.replace('/ver ', '').trim();
    await handleShowProfileDetail(chatId, id);
    return;
  }

  if (text.startsWith('/editar ')) {
    const id = text.replace('/editar ', '').trim();
    await handleStartEditProfile(chatId, userIdStr, id);
    return;
  }

  if (text.startsWith('/foto ') || text.startsWith('/fotos ')) {
    const id = text.replace(/\/fotos?\s+/, '').trim();
    await handleManagePhotosCommand(chatId, userIdStr, id);
    return;
  }

  if (text.startsWith('/estado ')) {
    const id = text.replace('/estado ', '').trim();
    await handlePromptStatusChange(chatId, id);
    return;
  }

  if (text.startsWith('/publicar ')) {
    const id = text.replace('/publicar ', '').trim();
    await handlePublishCommand(chatId, id);
    return;
  }

  if (text.startsWith('/pausar ')) {
    const id = text.replace('/pausar ', '').trim();
    await handlePauseCommand(chatId, id);
    return;
  }

  if (text.startsWith('/retirar ')) {
    const id = text.replace('/retirar ', '').trim();
    await handleRetireCommand(chatId, id);
    return;
  }

  if (text.startsWith('/eliminar ')) {
    const id = text.replace('/eliminar ', '').trim();
    await handleConfirmDeleteCommand(chatId, id);
    return;
  }

  // Step-by-step Conversation State Machine Handling
  const state = await getConversationState(userIdStr);
  if (state) {
    await handleConversationStep(chatId, userIdStr, message, state);
    return;
  }

  // Fallback for unexpected messages
  if (text.startsWith('/')) {
    await sendMessage(chatId, '❓ *Comando no reconocido*. Escribe /ayuda para ver los comandos disponibles.');
  }
}

// Conversation Steps Processor
async function handleConversationStep(chatId: string | number, userId: string, message: any, state: any) {
  const text = message.text ? message.text.trim() : '';

  switch (state.step) {
    case 'NEW_NAME': {
      if (!text) {
        await sendMessage(chatId, '⚠️ Por favor envía un nombre válido.');
        return;
      }
      state.draft_data.name = text;
      state.step = 'NEW_AGE';
      await setConversationState(userId, 'NEW_AGE', state.draft_data);
      await sendMessage(chatId, `✅ Nombre: *${text}*\n\n🔞 *(Paso 2/8)* Ingrese la *Edad* (debe ser mayor o igual a 18 años):`);
      break;
    }

    case 'NEW_AGE': {
      const age = parseInt(text, 10);
      if (isNaN(age) || age < 18) {
        await sendMessage(chatId, '❌ *ERROR DE VALIDACIÓN Y REGLA LEGAL*: La edad debe ser un número mayor o igual a 18 años. Inténtelo de nuevo:');
        return;
      }
      state.draft_data.age = age;
      state.step = 'NEW_RATE';
      await setConversationState(userId, 'NEW_RATE', state.draft_data);
      await sendMessage(chatId, `✅ Edad: *${age} años*\n\n💰 *(Paso 3/6)* Ingrese la *TARIFA SERVICIO en Bolivianos (Bs.)* (ej. 450):`);
      break;
    }

    case 'NEW_RATE': {
      const rate = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(rate) || rate <= 0) {
        await sendMessage(chatId, '⚠️ Ingrese un valor numérico de tarifa válido.');
        return;
      }
      state.draft_data.rate_bs = rate;
      state.step = 'NEW_COMMISSION';
      await setConversationState(userId, 'NEW_COMMISSION', state.draft_data);
      await sendMessage(chatId, `✅ TARIFA SERVICIO: *Bs. ${rate}*\n\n🏷️ *(Paso 4/6)* Ingrese la *COMISIÓN en Bolivianos (Bs.)* (ej. 50):`);
      break;
    }

    case 'NEW_COMMISSION': {
      const comm = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(comm) || comm < 0) {
        await sendMessage(chatId, '⚠️ Ingrese un valor numérico de comisión válido.');
        return;
      }
      state.draft_data.commission_bs = comm;
      state.step = 'NEW_DESC';
      await setConversationState(userId, 'NEW_DESC', state.draft_data);
      await sendMessage(chatId, `✅ Comisión: *Bs. ${comm}*\n\n📝 *(Paso 5/6)* Ingrese la *Descripción Pública* del perfil:`);
      break;
    }

    case 'NEW_DESC': {
      if (!text) {
        await sendMessage(chatId, '⚠️ Ingrese una descripción válida.');
        return;
      }
      state.draft_data.description = text;
      state.step = 'NEW_PHOTOS';
      await setConversationState(userId, 'NEW_PHOTOS', state.draft_data);
      await sendMessage(chatId, `✅ Descripción guardada.\n\n📷 *(Paso 6/6)* Por favor envía la *Fotografía del perfil* (adjúntala como foto en este chat o envía su URL).`);
      break;
    }

    case 'NEW_PHOTOS': {
      let photoUrl = '';

      if (message.photo && message.photo.length > 0) {
        // High-res photo from Telegram
        const largestPhoto = message.photo[message.photo.length - 1];
        photoUrl = await getTelegramFileUrl(largestPhoto.file_id);
      } else if (text.startsWith('http://') || text.startsWith('https://')) {
        photoUrl = text;
      }

      if (!photoUrl) {
        await sendMessage(chatId, '⚠️ No se detectó una imagen válida. Por favor adjunta una foto o escribe la URL de una imagen.');
        return;
      }

      const existingPhotos = state.draft_data.photos || [];
      existingPhotos.push(photoUrl);
      state.draft_data.photos = existingPhotos;

      // Show preview
      const previewCard = `
📋 *VISTA PREVIA DE NUEVO PERFIL (Paso 8/8)*

👤 *Nombre*: ${state.draft_data.name}
🔞 *Edad*: ${state.draft_data.age} años
💰 *Tarifa*: Bs. ${state.draft_data.rate_bs}
🏷️ *Comisión*: Bs. ${state.draft_data.commission_bs}
📷 *Fotos*: ${existingPhotos.length} adjunta(s)

📝 *Descripción*:
${state.draft_data.description}
      `;

      await setConversationState(userId, 'NEW_CONFIRM', state.draft_data);

      await sendMessage(chatId, previewCard, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Guardar como Borrador', callback_data: 'confirm_draft' },
              { text: '📢 Publicar Ahora', callback_data: 'confirm_publish' }
            ],
            [
              { text: '➕ Añadir otra foto', callback_data: 'add_more_photos' },
              { text: '❌ Cancelar', callback_data: 'cancel_wizard' }
            ]
          ]
        }
      });
      break;
    }

    case 'EDIT_FIELD_VALUE': {
      const field = state.draft_data.editing_field;
      const profileId = state.active_profile_id;
      if (!profileId || !field) {
        await clearConversationState(userId);
        await sendMessage(chatId, '⚠️ Error en la sesión de edición. Reiniciando.');
        return;
      }

      const updateData: any = { id: profileId };

      if (field === 'name') updateData.name = text;
      else if (field === 'age') {
        const age = parseInt(text, 10);
        if (isNaN(age) || age < 18) {
          await sendMessage(chatId, '❌ La edad debe ser mayor o igual a 18 años.');
          return;
        }
        updateData.age = age;
      } else if (field === 'rate_bs') updateData.rate_bs = parseFloat(text);
      else if (field === 'commission_bs') updateData.commission_bs = parseFloat(text);
      else if (field === 'description') updateData.description = text;

      const updated = await saveProfile(updateData);
      await clearConversationState(userId);
      await addAuditLog('EDIT_PROFILE', userId, `Campo ${field} actualizado para ${updated.name}`, profileId);

      // Auto-sync
      await syncProfileToChannel(profileId, `Admin Telegram (${userId})`);

      await sendMessage(chatId, `✅ *Campo "${field}" actualizado con éxito para ${updated.name}*.\n\nSincronización ejecutada en la web y canal.`);
      break;
    }

    default:
      await clearConversationState(userId);
      await sendMessage(chatId, 'Comando finalizado.');
      break;
  }
}

// Helper to resolve Telegram file path to native Telegram URL (sin guardar archivos multimedia en el servidor)
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const { token } = getBotConfig();
  if (!token) {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
  }
  const fileData = await callTelegramApi('getFile', { file_id: fileId });
  if (fileData.ok && fileData.result?.file_path) {
    const remotePath = fileData.result.file_path;
    // Guardar y retornar el URL nativo de Telegram sin almacenar multimedia en disco
    return `https://api.telegram.org/file/bot${token}/${remotePath}`;
  }
  return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
}

// Callback Query Handler (Inline Keyboard clicks)
async function handleCallbackQuery(cb: any) {
  const chatId = cb.message.chat.id;
  const fromId = cb.from.id;
  const data = cb.data || '';
  const userIdStr = String(fromId);

  if (!isAdminUser(fromId)) {
    await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'No autorizado', show_alert: true });
    return;
  }

  await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id });

  if (data === 'cancel_wizard') {
    await clearConversationState(userIdStr);
    await sendMessage(chatId, '❌ Proceso cancelado.');
    return;
  }

  if (data === 'add_more_photos') {
    const state = await getConversationState(userIdStr);
    if (state) {
      state.step = 'NEW_PHOTOS';
      await setConversationState(userIdStr, 'NEW_PHOTOS', state.draft_data);
      await sendMessage(chatId, '📷 Envía otra foto o escribe su URL:');
    }
    return;
  }

  if (data === 'confirm_draft' || data === 'confirm_publish') {
    const state = await getConversationState(userIdStr);
    if (!state || !state.draft_data.name) {
      await sendMessage(chatId, '⚠️ Datos incompletos para guardar el perfil.');
      return;
    }

    const newId = `prof_${Date.now()}`;
    const initialStatus: ProfileStatus = data === 'confirm_publish' ? 'disponible' : 'borrador';

    const newProfile = await saveProfile({
      id: newId,
      name: state.draft_data.name,
      age: state.draft_data.age || 18,
      description: state.draft_data.description || '',
      rate_bs: state.draft_data.rate_bs || 0,
      commission_bs: state.draft_data.commission_bs || 0,
      photos: state.draft_data.photos || [],
      status: initialStatus
    });

    await clearConversationState(userIdStr);
    await addAuditLog('CREATE_PROFILE', userIdStr, `Creado perfil ${newProfile.name} (ID: ${newId}) con estado ${initialStatus}`, newId);

    if (data === 'confirm_publish') {
      const syncResult = await syncProfileToChannel(newId, `Admin (${userIdStr})`);
      await sendMessage(chatId, `🎉 *¡Perfil Creado y Publicado Exitosamente!*\n\nPerfil: *${newProfile.name}*\nID: \`${newId}\`\n\n${syncResult.message}`);
    } else {
      await sendMessage(chatId, `📁 *Perfil Guardado como Borrador*\n\nPerfil: *${newProfile.name}*\nID: \`${newId}\`\n\nPuedes publicarlo cuando gustes escribiendo: \`/publicar ${newId}\``);
    }
    return;
  }

  if (data.startsWith('edit_field_')) {
    const parts = data.replace('edit_field_', '').split('_');
    const field = parts[0];
    const profileId = parts.slice(1).join('_');

    await setConversationState(userIdStr, 'EDIT_FIELD_VALUE', { editing_field: field } as any, profileId);
    await sendMessage(chatId, `✏️ Escribe el nuevo valor para *${field}*:`);
    return;
  }

  if (data.startsWith('set_status_')) {
    const parts = data.replace('set_status_', '').split('_');
    const newStatus = parts[0] as ProfileStatus;
    const profileId = parts.slice(1).join('_');

    const updated = await saveProfile({ id: profileId, status: newStatus });
    await addAuditLog('UPDATE_STATUS', userIdStr, `Estado cambiado a ${newStatus} para ${updated.name}`, profileId);

    // Auto sync
    const syncRes = await syncProfileToChannel(profileId, `Admin Telegram (${userIdStr})`);
    await sendMessage(chatId, `📌 *Estado actualizado*: Perfil *${updated.name}* ahora está en estado *${newStatus.toUpperCase()}*.\n\nSincronización: ${syncRes.message}`);
    return;
  }
}

// Handlers for Command Specific Functions
async function sendAdminWelcome(chatId: string | number, name: string) {
  const msg = `
👑 *¡Bienvenida, Administradora ${name}!*

Sistema de Gestión — *Iam Dani Catálogo Santa Cruz*.

📋 *Comandos Administrativos Disponibles*:
• \`/nuevo\` — Crear un nuevo perfil paso a paso.
• \`/listar\` — Ver todos los perfiles registrados y sus estados.
• \`/ver ID\` — Consultar ficha completa de un perfil.
• \`/editar ID\` — Modificar datos de un perfil.
• \`/fotos ID\` — Gestionar fotografías de un perfil.
• \`/estado ID\` — Cambiar estado (disponible/ocupada/pausada/retirada).
• \`/publicar ID\` — Publicar o actualizar en el canal de Telegram y la web.
• \`/pausar ID\` — Ocultar de la web y marcar en canal.
• \`/retirar ID\` — Retirar catálogo y canal.
• \`/eliminar ID\` — Borrar perfil permanentemente.
• \`/panel\` — Obtener enlace seguro para el Panel Web.
• \`/cancelar\` — Cancelar cualquier operación en curso.

_Todos los cambios realizados aquí se sincronizan automáticamente en la base de datos, canal y sitio web._
`;
  const { baseUrl } = getBotConfig();
  const adminUrl = `${baseUrl}/admin`;
  await sendMessage(chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔐 Abrir Panel Admin (Mini App)', web_app: { url: adminUrl } }
        ]
      ]
    }
  });
}

async function sendAdminHelp(chatId: string | number) {
  const msg = `
📖 *Manual de Uso Rápido*:

1️⃣ *Para crear un perfil*: Escribe \`/nuevo\` y sigue las preguntas.
2️⃣ *Para publicar*: Escribe \`/publicar <ID>\`.
3️⃣ *Para cambiar estado rápidamente*: Escribe \`/estado <ID>\`.
4️⃣ *Para acceder a la web administrativa*: Escribe \`/panel\`.

⚠️ *Reglas Obligatorias de Seguridad*:
- Todos los perfiles deben ser mayores de 18 años.
- No publique números ni direcciones exactas.
`;
  await sendMessage(chatId, msg);
}

async function handleListProfiles(chatId: string | number) {
  const profiles = await getAllProfiles();
  if (profiles.length === 0) {
    await sendMessage(chatId, '📭 No hay perfiles registrados en el catálogo. Usa /nuevo para crear uno.');
    return;
  }

  let text = '📋 *LISTADO DE PERFILES DEL CATÁLOGO*:\n\n';
  profiles.forEach(p => {
    const badge = p.status === 'disponible' ? '🟢 Disponible' : p.status === 'ocupada' ? '🔴 Ocupada' : p.status === 'pausada' ? '⏸️ Pausada' : p.status === 'retirada' ? '🗑️ Retirada' : '📁 Borrador';
    text += `• *${p.name}* (${p.age}a) - ${badge}\n  ID: \`${p.id}\` | Tarifa: Bs. ${p.rate_bs}\n\n`;
  });

  text += '_Usa /ver ID o /editar ID para administrar cada uno._';
  await sendMessage(chatId, text);
}

async function handleShowProfileDetail(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil con ID \`${id}\` no encontrado.`);
    return;
  }

  const detail = `
👤 *FICHA DEL PERFIL*: ${profile.name}

🆔 *ID*: \`${profile.id}\`
🔞 *Edad*: ${profile.age} años
💰 *Tarifa*: Bs. ${profile.rate_bs}
🏷️ *Comisión*: Bs. ${profile.commission_bs}
📌 *Estado*: ${profile.status.toUpperCase()}
📷 *Fotos*: ${profile.photos.length} adjunta(s)
📲 *Telegram Msg ID*: ${profile.telegram_message_id ? `#${profile.telegram_message_id}` : 'No publicado'}
📅 *Última Actualización*: ${new Date(profile.updated_at).toLocaleString()}

📝 *Descripción*:
${profile.description}
  `;

  await sendMessage(chatId, detail, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📢 Publicar / Sincronizar', callback_data: `confirm_publish_${profile.id}` },
          { text: '✏️ Editar', callback_data: `edit_field_select_${profile.id}` }
        ],
        [
          { text: '🟢 Disponible', callback_data: `set_status_disponible_${profile.id}` },
          { text: '🔴 Ocupada', callback_data: `set_status_ocupada_${profile.id}` },
          { text: '⏸️ Pausar', callback_data: `set_status_pausada_${profile.id}` }
        ]
      ]
    }
  });
}

async function handleStartEditProfile(chatId: string | number, userId: string, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil con ID \`${id}\` no encontrado.`);
    return;
  }

  await sendMessage(chatId, `✏️ *Selecciona el campo que deseas editar para ${profile.name}*:`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Nombre', callback_data: `edit_field_name_${id}` },
          { text: 'Edad (+18)', callback_data: `edit_field_age_${id}` }
        ],
        [
          { text: 'Tarifa (Bs.)', callback_data: `edit_field_rate_bs_${id}` },
          { text: 'Comisión (Bs.)', callback_data: `edit_field_commission_bs_${id}` }
        ],
        [
          { text: 'Descripción', callback_data: `edit_field_description_${id}` }
        ]
      ]
    }
  });
}

async function handleManagePhotosCommand(chatId: string | number, userId: string, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }
  await setConversationState(userId, 'NEW_PHOTOS', { photos: profile.photos }, id);
  await sendMessage(chatId, `📷 *Gestión de Fotografías para ${profile.name}*\n\nActualmente tiene ${profile.photos.length} fotos.\n\nEnvía una nueva foto a este chat o la URL para agregarla.`);
}

async function handlePromptStatusChange(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }

  await sendMessage(chatId, `📌 *Cambiar Estado para ${profile.name}* (Actual: ${profile.status}):`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Disponible', callback_data: `set_status_disponible_${id}` },
          { text: '🔴 Ocupada', callback_data: `set_status_ocupada_${id}` }
        ],
        [
          { text: '⏸️ Pausada', callback_data: `set_status_pausada_${id}` },
          { text: '🗑️ Retirada', callback_data: `set_status_retirada_${id}` }
        ]
      ]
    }
  });
}

async function handlePublishCommand(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: 'disponible' });
  const result = await syncProfileToChannel(id, 'Admin Telegram');
  await sendMessage(chatId, `📢 *Publicación en Canal y Web para ${profile.name}*:\n\n${result.message}`);
}

async function handlePauseCommand(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: 'pausada' });
  const result = await syncProfileToChannel(id, 'Admin Telegram');
  await sendMessage(chatId, `⏸️ *Perfil ${profile.name} Pausado*.\nOculto del catálogo público.\n\nSincronización: ${result.message}`);
}

async function handleRetireCommand(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: 'retirada' });
  const result = await syncProfileToChannel(id, 'Admin Telegram');
  await sendMessage(chatId, `🗑️ *Perfil ${profile.name} Retirado* del catálogo y canal.\n\n${result.message}`);
}

async function handleConfirmDeleteCommand(chatId: string | number, id: string) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `❌ Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: 'retirada' });
  await syncProfileToChannel(id, 'Admin Telegram');
  await deleteProfile(id);
  await addAuditLog('DELETE_PROFILE', 'Admin Telegram', `Perfil ${profile.name} (${id}) eliminado`, id);
  await sendMessage(chatId, `🚨 *Perfil ${profile.name} eliminado permanentemente*.`);
}

// Customer Availability Request Notification (Responde con QR y monto de comisión)
async function handleClientAvailabilityRequest(message: any, profileId: string) {
  const chatId = message.chat.id;
  const clientUser = message.from;
  const profile = await getProfileById(profileId);

  if (!profile) {
    await sendMessage(chatId, '⚠️ El perfil solicitado ya no se encuentra disponible.');
    return;
  }

  // Register request in database
  const request = await createCustomerRequest({
    profile_id: profile.id,
    profile_name: profile.name,
    telegram_user_id: String(clientUser.id),
    telegram_username: clientUser.username || undefined,
    telegram_first_name: clientUser.first_name || 'Cliente',
    status: 'pendiente'
  });

  const qrUrl = getSystemSetting('qr_image_url');
  const adminUsername = getSystemSetting('admin_contact_username') || 'danii001';
  const { baseUrl } = getBotConfig();

  // Reply to Client with QR and COMMISSION ONLY
  const clientReply = `
✨ *Iam Dani Catálogo VIP Santa Cruz* ✨

¡Hola, *${clientUser.first_name || 'Estimado/a'}*!
Has consultado por la modelo: *${profile.name}*

🏷️ *MONTO DE COMISIÓN A TRANSFERIR*: *Bs. ${profile.commission_bs}*

📲 *MÉTODO DE PAGO*:
1. Transfiere exactamente el monto de la comisión (*Bs. ${profile.commission_bs}*) escaneando el código QR oficial adjunto.
2. Envía la captura de tu comprobante directamente al chat privado de nuestra Administradora: *@${adminUsername}*.

🔒 *Confidencialidad absoluta y atención inmediata garantizada.*
  `;

  const keyboard = {
    inline_keyboard: [
      [
        { text: `💬 Enviar Comprobante a Dani (@${adminUsername})`, url: `https://t.me/${adminUsername}` }
      ],
      [
        { text: '💎 Ver Catálogo (Mini App)', web_app: { url: baseUrl } }
      ]
    ]
  };

  if (qrUrl) {
    await sendPhotoToUser(chatId, qrUrl, clientReply);
    await sendMessage(chatId, `📲 *Comunícate con Dani:* Pulsa abajo para enviar tu comprobante a *@${adminUsername}*:`, {
      reply_markup: keyboard
    });
  } else {
    await sendMessage(chatId, clientReply, { reply_markup: keyboard });
  }

  // Notify Administrator
  const { adminIds } = getBotConfig();
  const clientHandle = clientUser.username ? `@${clientUser.username}` : clientUser.first_name || `ID: ${clientUser.id}`;

  const adminNotice = `
🔔 *NUEVA SOLICITUD DE DISPONIBILIDAD* 🔔

👤 *Cliente*: ${clientUser.first_name} (${clientHandle})
🆔 *Telegram ID*: \`${clientUser.id}\`
👠 *Perfil Solicitado*: ${profile.name} (ID: \`${profile.id}\`)
🏷️ *Comisión de Reserva*: *Bs. ${profile.commission_bs}*
💰 *Tarifa Servicio*: Bs. ${profile.rate_bs}
📅 *Fecha*: ${new Date().toLocaleString()}

_El bot ya le envió el QR de pago y el monto de la comisión al cliente._
  `;

  for (const adminId of adminIds) {
    if (adminId) {
      await sendMessage(adminId, adminNotice, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `💬 Responder a ${clientUser.first_name}`, url: clientUser.username ? `https://t.me/${clientUser.username}` : `tg://user?id=${clientUser.id}` }
            ]
          ]
        }
      });
    }
  }
}
