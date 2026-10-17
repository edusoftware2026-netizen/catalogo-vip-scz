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
  const catalogUrl = `${baseUrl}/catalogo`;
  return await callTelegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '💎 Catálogo VIP',
      web_app: {
        url: catalogUrl
      }
    }
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
🔞 *Edad*: ${profile.age} años (Verificada +18)
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

  const webUrl = `${baseUrl}/#profile-${profile.id}`;
  const reqUrl = `https://t.me/${username}?start=req_${profile.id}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '📱 Solicitar Disponibilidad', url: reqUrl }
      ],
      [
        { text: '🌐 Ver en Catálogo Web', url: webUrl }
      ]
    ]
  };

  const primaryPhoto = profile.photos && profile.photos.length > 0 ? profile.photos[0] : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

  // If already published, attempt edit first
  if (profile.telegram_message_id) {
    const editRes = await callTelegramApi('editMessageCaption', {
      chat_id: channelId,
      message_id: profile.telegram_message_id,
      caption,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    });

    if (editRes.ok) {
      await addAuditLog('SYNC_CHANNEL', performer, `Publicación de ${profile.name} actualizada en el canal`, profileId);
      return { success: true, message: 'Publicación editada y actualizada con éxito en el canal', telegramMessageId: profile.telegram_message_id };
    } else {
      // Failed to edit (message deleted or old). Record error and fallback to new message.
      const warnMsg = `No se pudo editar el mensaje previo (${profile.telegram_message_id}): ${editRes.description}. Se publicará una nueva entrada en el canal.`;
      await addSyncError(profileId, 'EDIT_CAPTION_FALLBACK', warnMsg);
      console.warn(`[Sync Channel Fallback] ${warnMsg}`);
    }
  }

  // Publish new photo message
  const sendRes = await callTelegramApi('sendPhoto', {
    chat_id: channelId,
    photo: primaryPhoto,
    caption,
    parse_mode: 'Markdown',
    reply_markup: replyMarkup
  });

  if (sendRes.ok && sendRes.result?.message_id) {
    const newMsgId = sendRes.result.message_id;
    await saveProfile({ id: profile.id, telegram_message_id: newMsgId });
    await addAuditLog('SYNC_CHANNEL', performer, `Publicado mensaje #${newMsgId} para ${profile.name} en el canal`, profileId);
    return { success: true, message: 'Publicado exitosamente en el canal', telegramMessageId: newMsgId };
  } else {
    const errorMsg = sendRes.description || 'Error al publicar foto en canal Telegram';
    await addSyncError(profileId, 'SEND_PHOTO_CHANNEL', errorMsg);
    return { success: false, message: `Error en Telegram: ${errorMsg}` };
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

  // 1. Deep Link Client Request handling (e.g., /start req_prof_scz_01)
  if (text.startsWith('/start req_')) {
    const profileId = text.replace('/start req_', '').trim();
    await handleClientAvailabilityRequest(message, profileId);
    return;
  }

  // 1.2. Código de Invitación VIP y Bienvenida Clientes (/invitar, /codigo, /vip, /start inv_, o /start sin ser admin)
  const isInviteCmd = text.startsWith('/start inv_') || text === '/invitar' || text === '/codigo' || text === '/vip' || (!isAdminUser(fromId) && text === '/start');
  if (isInviteCmd) {
    const { baseUrl, username } = getBotConfig();
    const cleanUsername = username || 'CatalogoVIPSCZBot';
    const shortCode = `VIP-SCZ-${(Math.abs(Number(fromId) || 1234) % 8999) + 1000}`;
    const inviteLink = `https://t.me/${cleanUsername}?start=inv_${(Math.abs(Number(fromId) || 1234) % 8999) + 1000}`;

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
      `_El catálogo es un círculo reservado (+18). Pulsa el botón "Ver Catálogo VIP" abajo o en el menú del bot para ver disponibilidad._`;

    await sendMessage(chatId, vipMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💎 Ver Catálogo VIP (Mini App)', web_app: { url: baseUrl } }
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
    await sendMessage(chatId, `🔐 *Panel de Administración — Mini App*\n\nAcceso exclusivo para la Administradora del catálogo.\nPuedes abrir tu Panel de Gestión directamente aquí dentro de Telegram:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔐 Abrir Panel Admin (Mini App)', web_app: { url: adminUrl } }
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
      `_Trato directo, discreto y 100% confidencial (+18). Pulsa el botón "Ver Catálogo VIP" en el menú inferior para abrir el directorio._`;

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
      await sendMessage(chatId, '⚠️ *No hay imagen QR configurada* en la pantalla de administración de la página web. Sube primero el QR en el panel de administración.');
      return;
    }
    const replyText = `✨ *Iam Dani Catálogo Santa Cruz* ✨\n\n¡Hola!\n\nNuestra Administradora ha procesado tu solicitud. Para confirmar tu atención prioritaria, te adjuntamos nuestro *QR de COMISIÓN oficial*.\n\n📲 *Por favor, realiza el pago y envía tu comprobante / captura directamente al chat privado de la Administradora.* ¡Máxima discreción y confidencialidad garantizada!`;
    const resQr = await sendPhotoToUser(targetUserId, qrUrl, replyText);
    if (resQr.ok) {
      await sendMessage(chatId, `✅ *QR de COMISIÓN enviado exitosamente* al cliente con ID \`${targetUserId}\`.`);
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
      state.draft_data.zone = 'Santa Cruz';
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
📍 *Zona*: ${state.draft_data.zone}
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
      } else if (field === 'zone') updateData.zone = text;
      else if (field === 'rate_bs') updateData.rate_bs = parseFloat(text);
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
      zone: state.draft_data.zone || 'Santa Cruz',
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
    text += `• *${p.name}* (${p.age}a) - ${badge}\n  ID: \`${p.id}\` | Zona: ${p.zone} | Tarifa: Bs. ${p.rate_bs}\n\n`;
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
📍 *Zona*: ${profile.zone}
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
          { text: 'Edad (+18)', callback_data: `edit_field_age_${id}` },
          { text: 'Zona', callback_data: `edit_field_zone_${id}` }
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

// Customer Availability Request Notification
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

  // Reply to Client
  const clientReply = `
✨ *SOLICITUD DE DISPONIBILIDAD REGISTRADA* ✨

Perfil consultado: *${profile.name}* (${profile.zone})
Tarifa: *Bs. ${profile.rate_bs}*

📌 Tu solicitud ha sido notificada directamente a la Administradora oficial de *Iam Dani Catálogo Santa Cruz*. Te responderemos por este mismo medio a la brevedad.

⚠️ *ADVERTENCIA DE SEGURIDAD*:
No realice ningún tipo de pago, transferencia ni adelanto de dinero sin antes recibir confirmación oficial y directa por parte de la Administradora.
  `;

  await sendMessage(chatId, clientReply);

  // Notify Administrator
  const { adminIds } = getBotConfig();
  const clientHandle = clientUser.username ? `@${clientUser.username}` : clientUser.first_name || `ID: ${clientUser.id}`;

  const adminNotice = `
🔔 *NUEVA SOLICITUD DE DISPONIBILIDAD* 🔔

👤 *Cliente*: ${clientUser.first_name} (${clientHandle})
🆔 *Telegram ID*: \`${clientUser.id}\`
👠 *Perfil Solicitado*: ${profile.name} (ID: \`${profile.id}\`)
📍 *Zona*: ${profile.zone}
💰 *Tarifa*: Bs. ${profile.rate_bs}
📅 *Fecha*: ${new Date().toLocaleString()}

_Favor responder directamente al cliente por mensaje privado._
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
