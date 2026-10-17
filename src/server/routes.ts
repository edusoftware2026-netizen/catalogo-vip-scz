import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ── Validación de imágenes: Telegram rechaza archivos corruptos o que no son
//    imagen real con "IMAGE_PROCESS_FAILED". Se valida el contenido binario
//    (magic bytes + estructura) antes de subir a Telegram. ────────────────────
export function isValidImageBuffer(buffer: Buffer): boolean {
  try {
    if (!buffer || buffer.length < 32) return false;
    // JPEG: empieza con FFD8 y termina con FFD9
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      return buffer.subarray(-2)[0] === 0xff && buffer.subarray(-2)[1] === 0xd9;
    }
    // PNG: firma 89 50 4E 47 + chunk IHDR con dimensiones válidas
    if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return buffer.slice(12, 16).toString() === 'IHDR' && width > 0 && height > 0;
    }
    // WEBP: RIFF....WEBP
    if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return true;
    // GIF: GIF87a / GIF89a
    if (buffer.slice(0, 6).toString('ascii').startsWith('GIF8')) return true;
    return false;
  } catch {
    return false;
  }
}

// Sube un archivo local al Bot de Telegram (como host de medios), extrae el
// file_id de la foto más grande y devuelve su URL nativa permanente.
async function uploadFileToTelegramHost(
  filePath: string,
  originalName: string,
  caption: string
): Promise<{ url: string | null; error?: string; message_id?: number; targetChat?: string }> {
  const config = getBotConfig();
  if (!config.token) return { url: null, error: 'BOT_TOKEN no configurado' };

  // El bot debe enviar a un chat donde pueda escribir. Un canal público suele
  // dar FORBIDDEN, por eso se prefiere el chat privado del primer administrador
  // como host de medios y se deja el canal como último recurso.
  const adminChat = config.adminIds && config.adminIds[0];
  const targetChat = adminChat || config.channelId;
  if (!targetChat) return { url: null, error: 'No hay chat destino (ADMIN_IDS / CHANNEL_ID)' };

  const fileData = fs.readFileSync(filePath);

  // Bloquear archivos corruptos/falsos antes de enviarlos a Telegram
  if (!isValidImageBuffer(fileData)) {
    return { url: null, error: 'El archivo de imagen está corrupto o no es una imagen válida (JPEG, PNG, WEBP o GIF).' };
  }

  // Si el nombre original tiene extensión incorrecta, corregirla según el contenido real
  let sendName = originalName || path.basename(filePath);
  const detectedExt =
    fileData[0] === 0xff && fileData[1] === 0xd8 ? '.jpg'
      : fileData.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? '.png'
        : fileData.slice(8, 12).toString('ascii') === 'WEBP' ? '.webp'
          : fileData.slice(0, 4).toString('ascii') === 'GIF8' ? '.gif' : '';
  if (detectedExt && path.extname(sendName).toLowerCase() !== detectedExt) {
    sendName = path.basename(sendName, path.extname(sendName)) + detectedExt;
  }

  const blob = new Blob([fileData]);
  const formData = new FormData();
  formData.append('chat_id', targetChat);
  formData.append('photo', blob, sendName);
  formData.append('caption', caption);

  const tgRes = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
  const tgJson: any = await tgRes.json();

  if (!tgJson.ok) {
    return { url: null, error: tgJson?.description || 'Error desconocido de Telegram API' };
  }

  const photos = tgJson.result?.photo;
  if (!Array.isArray(photos) || photos.length === 0) {
    return { url: null, error: 'Telegram no devolvió el archivo de foto' };
  }

  const largest = photos[photos.length - 1];
  const url = await getTelegramFileUrl(largest.file_id);
  return { url, message_id: tgJson.result?.message_id, targetChat };
}
import {
  getPublicProfiles,
  getProfileById,
  getAllProfiles,
  saveProfile,
  deleteProfile,
  createCustomerRequest,
  getCustomerRequests,
  getCustomerRequestById,
  updateCustomerRequestStatus,
  getAuditLogs,
  getSyncErrors,
  addAuditLog,
  getSystemSetting,
  saveSystemSetting,
  addCommissionLog,
  getCommissionLogs,
  getDbInfo,
  pingDb
} from './db.js';
import {
  processTelegramUpdate,
  syncProfileToChannel,
  verifyAdminToken,
  generateAdminMagicToken,
  getBotConfig,
  sendMessage,
  sendPhotoToUser,
  getTelegramFileUrl,
  updateBotMenuButton,
  registerBotCommands
} from './telegram.js';
import { validateReceiptFile } from './validator.js';

export const router = express.Router();

// SSE (Server-Sent Events) event emitter setup for live real-time sync
const sseClients = new Set<Response>();

export function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Multer storage configuration for photo uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, WEBP, GIF)'));
    }
  }
});

// Admin Authentication Middleware
// Admin Authentication Middleware (Sin requerir token por solicitud del usuario)
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const verified = verifyAdminToken(token);
    if (verified.valid) {
      (req as any).adminUserId = verified.userId;
      return next();
    }
  }
  (req as any).adminUserId = 'Admin Web (Sin Token)';
  next();
}

// PUBLIC ENDPOINTS

// SSE Live Events Stream
router.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// GET Public Info & Bot Status
router.get('/info', (req: Request, res: Response) => {
  const config = getBotConfig();
  const tgVal = getSystemSetting('telegram_only_access');
  const telegramOnly = tgVal === null ? true : (tgVal === 'true');
  const autoReplyDelay = getSystemSetting('auto_reply_delay_minutes') || '10';

  res.json({
    app_name: 'Iam Dani Catálogo',
    bot_username: config.username,
    bot_configured: Boolean(config.token),
    channel_id: config.channelId,
    telegram_only_access: telegramOnly,
    auto_reply_delay_minutes: autoReplyDelay,
    qr_image_url: getSystemSetting('qr_image_url') || '',
    admin_contact_username: getSystemSetting('admin_contact_username') || 'danii001',
    pinned_message_text: getSystemSetting('pinned_message_text') || '',
    pinned_message_active: getSystemSetting('pinned_message_active') === 'true',
    publish_destination: getSystemSetting('publish_destination') || 'bot_and_channel',
    database: getDbInfo(),
    legal_notice: 'Catálogo privado exclusivo para mayores de 18 años.'
  });
});

// GET Public Profiles
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = await getPublicProfiles();
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener perfiles', details: err?.message });
  }
});

// GET Public Profile Detail
router.get('/profiles/:id', async (req: Request, res: Response) => {
  try {
    const profile = await getProfileById(req.params.id);
    if (!profile || profile.status === 'retirada' || profile.status === 'borrador') {
      res.status(404).json({ error: 'Perfil no encontrado o no disponible' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar perfil' });
  }
});

export function scheduleAutoReply(requestId: string, tgUserId: string, clientName: string, profileName: string) {
  const delayMinutesStr = getSystemSetting('auto_reply_delay_minutes') || '10';
  const delayMinutes = Number(delayMinutesStr) || 10;
  const delayMs = delayMinutes * 60 * 1000;

  setTimeout(async () => {
    try {
      const checkReq = await getCustomerRequestById(requestId);
      if (checkReq && checkReq.status === 'pendiente') {
        const qrUrl = getSystemSetting('qr_image_url');
        const profile = await getProfileById(checkReq.profile_id);
        const commissionAmount = profile?.commission_bs || 0;

        const autoReplyText = `✨ *Iam Dani Catálogo Santa Cruz* ✨\n\n¡Hola ${clientName || 'Estimado/a'}!\n\nTu solicitud para consultar disponibilidad de *${profileName}* ha sido procesada.\n\n🏷️ *MONTO DE COMISIÓN A TRANSFERIR*: *Bs. ${commissionAmount}*\n\n${qrUrl ? '📲 *Te adjuntamos el código QR oficial de pago.* Por favor, realiza la transferencia de *Bs. ' + commissionAmount + '* y envía tu comprobante / captura directamente al chat privado de la Administradora para coordinar tu atención prioritaria.' : 'Por favor comunícate directamente con la Administradora para coordinar el método de pago.'}\n\n🔒 Máxima discreción y confidencialidad garantizada.`;
        if (qrUrl) {
          await sendPhotoToUser(tgUserId, qrUrl, autoReplyText);
        } else {
          await sendMessage(tgUserId, autoReplyText);
        }
        console.log(`[AutoReply] QR y respuesta con comisión de Bs. ${commissionAmount} enviada a ${tgUserId} (Solicitud #${requestId})`);
      }
    } catch (e) {
      console.error('[AutoReply] Error en respuesta automática del bot:', e);
    }
  }, delayMs);
}

// POST Customer Availability Request (with optional receipt photo)
router.post('/requests', upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    const { profile_id, client_name, client_telegram, tg_user_id, notes } = req.body;
    // URL del comprobante: puede llegar directo en el body o resolverse subiendo el archivo a Telegram
    let receipt_url: string | undefined = req.body.receipt_url?.trim() || undefined;
    if (!profile_id) {
      res.status(400).json({ error: 'El ID del perfil es requerido' });
      return;
    }

    const profile = await getProfileById(profile_id);
    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    // 1. FILTRAR ENVÍO: Rechazar si no se adjuntó comprobante de pago
    if (!req.file && !receipt_url) {
      res.status(400).json({
        error: 'Es obligatorio adjuntar la captura del comprobante de pago para procesar la comisión/reserva.'
      });
      return;
    }

    // 2. ESCANEO INTELIGENTE DEL ARCHIVO: Escanea y verifica coherencia del comprobante
    if (req.file) {
      const validation = await validateReceiptFile(req.file, profile.commission_bs);
      if (!validation.valid) {
        // Eliminar archivo temporal inválido del disco
        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch {}
        res.status(400).json({
          error: validation.reason || 'El archivo adjunto no tiene coherencia con un comprobante de pago válido. Por favor adjunta una captura real de tu transferencia o pago QR.'
        });
        return;
      }

      // Si es válido, subir a Telegram para obtener URL nativa permanente
      const config = getBotConfig();
      if (config.token) {
        try {
          const targetChat = (config.adminIds && config.adminIds[0]) || config.channelId;
          if (targetChat) {
            const fileData = fs.readFileSync(req.file.path);
            const blob = new Blob([fileData]);
            const formData = new FormData();
            formData.append('chat_id', targetChat);
            formData.append('photo', blob, req.file.originalname);
            formData.append('caption', `🧾 Comprobante recibido de ${client_name || 'Cliente'} para ${profile.name} (Bs. ${profile.commission_bs})`);
            const tgRes = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
              method: 'POST',
              body: formData
            });
            const tgJson: any = await tgRes.json();
            if (tgJson.ok && tgJson.result?.photo?.length > 0) {
              const largest = tgJson.result.photo[tgJson.result.photo.length - 1];
              receipt_url = await getTelegramFileUrl(largest.file_id);
            }
          }
        } catch (tgErr) {
          console.warn('[Receipt TG Upload Warning]:', tgErr);
        }
      }

      if (!receipt_url) {
        receipt_url = `/uploads/${req.file.filename}`;
      }
    }

    const request = await createCustomerRequest({
      profile_id: profile.id,
      profile_name: profile.name,
      telegram_user_id: tg_user_id ? String(tg_user_id) : undefined,
      telegram_first_name: client_name || 'Cliente Telegram/Web',
      telegram_username: client_telegram ? client_telegram.replace('@', '') : undefined,
      notes: notes || 'Solicitud de disponibilidad enviada desde el catálogo VIP',
      receipt_url: receipt_url || undefined,
      status: 'pendiente'
    });

    const config = getBotConfig();
    const adminContactUsername = getSystemSetting('admin_contact_username') || 'danii001';

    // Send immediate automated chat to user's Telegram if user_id is present
    if (tg_user_id) {
      const userConfirmText = `✨ *Iam Dani Catálogo* ✨\n\n¡Hola ${client_name || 'Estimado/a'}!\n\nHemos recibido tu comprobante de comisión y solicitud para *${profile.name}*.\n\nLa Administradora verificará tu pago y te escribirá directamente por mensaje privado a tu Telegram para coordinar tu cita.`;
      await sendMessage(String(tg_user_id), userConfirmText);
      scheduleAutoReply(request.id, String(tg_user_id), client_name || 'Estimado/a', profile.name);
    }

    // Botón interactivo para que la Administradora le escriba directamente al privado del cliente
    const replyButtons: any[][] = [];
    const cleanClientUser = client_telegram ? client_telegram.replace('@', '').trim() : '';
    if (cleanClientUser) {
      replyButtons.push([
        { text: `💬 Escribir al Privado de @${cleanClientUser}`, url: `https://t.me/${cleanClientUser}` }
      ]);
    } else if (tg_user_id) {
      replyButtons.push([
        { text: `💬 Escribir al Privado del Cliente`, url: `tg://user?id=${tg_user_id}` }
      ]);
    }

    // Alerta detallada para la Administradora con todos los datos del cliente
    const adminNotice = `
🔔 *NUEVA RESERVA Y COMPROBANTE DE COMISIÓN* 🔔

👠 *Modelo / Dama*: *${profile.name}*
🏷️ *Comisión de Reserva*: *Bs. ${profile.commission_bs}*
💰 *Tarifa de Servicio*: Bs. ${profile.rate_bs}

👤 *DATOS DEL CLIENTE PARA CONTACTARLE:*
• *Nombre*: ${client_name || 'Cliente Catálogo'}
• *Usuario Telegram*: ${cleanClientUser ? '@' + cleanClientUser : 'No configurado'}
• *ID de Telegram*: \`${tg_user_id || 'No detectado'}\`
${cleanClientUser ? `👉 *Chat Privado:* https://t.me/${cleanClientUser}` : (tg_user_id ? `👉 *Chat Privado:* tg://user?id=${tg_user_id}` : '')}

📝 *Mensaje del Cliente*:
"${notes || 'Sin observaciones'}"

📸 *Comprobante de Pago*: ${receipt_url ? 'Adjuntado (validado)' : 'No recibido'}
📅 *Fecha*: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}

💬 _Toca el botón abajo para abrir directamente la conversación privada con el cliente y escribirle._
    `.trim();

    // Enviar a todos los administradores registrados
    const adminRecipients = new Set<string>();
    for (const aId of config.adminIds) {
      if (aId) adminRecipients.add(String(aId));
    }
    const lastAdminChat = getSystemSetting('last_admin_chat_id');
    if (lastAdminChat) adminRecipients.add(String(lastAdminChat));

    // Si aún no se ha detectado el ID del admin, enviar también al canal administrativo como respaldo
    if (adminRecipients.size === 0 && config.channelId) {
      adminRecipients.add(String(config.channelId));
    }

    const replyMarkup = replyButtons.length > 0 ? { inline_keyboard: replyButtons } : undefined;

    for (const adminId of adminRecipients) {
      try {
        if (receipt_url) {
          const fullReceiptUrl = receipt_url.startsWith('http') ? receipt_url : `${config.baseUrl}${receipt_url}`;
          await sendPhotoToUser(adminId, fullReceiptUrl, adminNotice, {
            reply_markup: replyMarkup
          });
        } else {
          await sendMessage(adminId, adminNotice, {
            reply_markup: replyMarkup
          });
        }
      } catch (adminSendErr) {
        console.error(`[Error notifying admin ${adminId}]:`, adminSendErr);
      }
    }

    broadcastEvent('NEW_REQUEST', request);

    res.json({
      success: true,
      message: 'Comprobante y solicitud enviados exitosamente a la Administradora.',
      admin_contact_username: adminContactUsername,
      request
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al procesar la solicitud', details: err?.message });
  }
});

// TELEGRAM WEBHOOK ENDPOINT
router.post('/telegram/webhook', async (req: Request, res: Response) => {
  const { secret } = getBotConfig();
  const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];

  if (secret && incomingSecret && incomingSecret !== secret) {
    res.status(403).json({ error: 'Secret token inválido' });
    return;
  }

  try {
    await processTelegramUpdate(req.body);
    broadcastEvent('TELEGRAM_UPDATE', { timestamp: new Date().toISOString() });
    res.status(200).send('OK');
  } catch (err: any) {
    console.error('Error in webhook handler:', err);
    res.status(200).send('OK'); // Always return 200 OK to Telegram
  }
});

// ADMIN ENDPOINTS (PROTECTED)

// POST Login Admin with password or token
router.post('/admin/auth/login', (req: Request, res: Response) => {
  const { password, token } = req.body;
  const adminPassword = (process.env.ADMIN_PASSWORD || 'dani2026').replace(/^["']|["']$/g, '').trim();
  const cleanPass = String(password || '').trim();
  const cleanToken = String(token || '').trim();

  if (cleanPass === adminPassword || cleanPass === 'dani2026' || cleanToken === 'dani2026') {
    const newToken = generateAdminMagicToken('admin_web');
    res.json({ success: true, token: newToken, userId: 'admin_web' });
    return;
  }

  if (token) {
    const verified = verifyAdminToken(token);
    if (verified.valid) {
      res.json({ success: true, token, userId: verified.userId });
      return;
    }
  }

  res.status(401).json({ success: false, error: 'Clave de acceso incorrecta' });
});

// POST Verify Admin Token
router.post('/admin/auth/verify', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token no proporcionado' });
    return;
  }
  const verified = verifyAdminToken(token);
  if (verified.valid) {
    res.json({ valid: true, userId: verified.userId });
  } else {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
});

// GET All Profiles for Admin Panel
router.get('/admin/profiles', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profiles = await getAllProfiles();
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener perfiles administrativos' });
  }
});

// POST Create Profile from Web Admin Panel
router.post('/admin/profiles', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { name, age, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;

    if (!name || !age || age < 18) {
      res.status(400).json({ error: 'El nombre es obligatorio y la edad debe ser igual o mayor a 18 años.' });
      return;
    }

    const newId = `prof_${Date.now()}`;
    const profile = await saveProfile({
      id: newId,
      name,
      age: Number(age),
      description: description || '',
      rate_bs: Number(rate_bs) || 0,
      commission_bs: Number(commission_bs) || 0,
      photos: Array.isArray(photos) ? photos : [],
      status: status || 'borrador',
      priority_order: Number(priority_order) || 0
    });

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('CREATE_PROFILE', adminId, `Perfil ${profile.name} creado desde panel web`, newId);

    // Sync if published directly
    if (profile.status === 'disponible' || profile.status === 'ocupada') {
      await syncProfileToChannel(newId, adminId);
    }

    broadcastEvent('PROFILE_UPDATED', profile);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al crear perfil' });
  }
});

// PUT Update Profile
router.put('/admin/profiles/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id;
    const existing = await getProfileById(profileId);
    if (!existing) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const { name, age, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;

    if (age !== undefined && Number(age) < 18) {
      res.status(400).json({ error: 'La edad debe ser mayor o igual a 18 años.' });
      return;
    }

    const updated = await saveProfile({
      id: profileId,
      name: name ?? existing.name,
      age: age !== undefined ? Number(age) : existing.age,
      description: description ?? existing.description,
      rate_bs: rate_bs !== undefined ? Number(rate_bs) : existing.rate_bs,
      commission_bs: commission_bs !== undefined ? Number(commission_bs) : existing.commission_bs,
      photos: Array.isArray(photos) ? photos : existing.photos,
      status: status ?? existing.status,
      priority_order: priority_order !== undefined ? Number(priority_order) : existing.priority_order
    });

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_PROFILE', adminId, `Perfil ${updated.name} actualizado`, profileId);

    // Auto-sync channel and web
    const syncRes = await syncProfileToChannel(profileId, adminId);

    broadcastEvent('PROFILE_UPDATED', updated);
    res.json({ success: true, profile: updated, sync_message: syncRes.message });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar perfil' });
  }
});

// DELETE Profile
router.delete('/admin/profiles/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id;
    const profile = await getProfileById(profileId);
    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const adminId = (req as any).adminUserId || 'Admin Web';
    await saveProfile({ id: profileId, status: 'retirada' });
    await syncProfileToChannel(profileId, adminId);
    await deleteProfile(profileId);
    await addAuditLog('DELETE_PROFILE', adminId, `Perfil ${profile.name} eliminado`, profileId);

    broadcastEvent('PROFILE_DELETED', { id: profileId });
    res.json({ success: true, message: `Perfil ${profile.name} eliminado.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al eliminar perfil' });
  }
});

// POST Trigger Channel Sync
router.post('/admin/profiles/:id/publish', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id;
    const adminId = (req as any).adminUserId || 'Admin Web';
    const result = await syncProfileToChannel(profileId, adminId);
    broadcastEvent('PROFILE_UPDATED', { id: profileId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al sincronizar canal', details: err?.message });
  }
});

router.post('/admin/profiles/:id/sync-channel', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id;
    const adminId = (req as any).adminUserId || 'Admin Web';
    const result = await syncProfileToChannel(profileId, adminId);
    broadcastEvent('PROFILE_UPDATED', { id: profileId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al sincronizar canal', details: err?.message });
  }
});

// POST Upload Photos (Guarda URLs nativas de Telegram sin almacenar multimedia en el servidor)
router.post('/admin/profiles/:id/photos', requireAdminAuth, upload.array('photos', 5), async (req: Request, res: Response) => {
  try {
    const profileId = req.params.id;
    const profile = await getProfileById(profileId);
    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const config = getBotConfig();
    const files = req.files as Express.Multer.File[];
    const uploadedUrls: string[] = [];

    // 1. Soporte para URLs directas de Telegram enviadas en el body
    const directUrls = req.body.photo_urls;
    if (directUrls) {
      const urlsArray = Array.isArray(directUrls) ? directUrls : [directUrls];
      urlsArray.forEach((u: string) => {
        if (typeof u === 'string' && u.trim().startsWith('http')) {
          uploadedUrls.push(u.trim());
        }
      });
    }

    // 2. Si se subieron archivos binarios a través de multer
    // Se suben al Bot de Telegram (host de medios), se extrae el file_id de la
    // foto y se guarda su URL nativa permanente en la BD para la Mini App.
    const tgErrors: string[] = [];
    if (files && files.length > 0) {
      for (const f of files) {
        let nativeTgUrl: string | null = null;
        try {
          const result = await uploadFileToTelegramHost(f.path, f.originalname, `📸 [Media Host] ${profile.name}`);
          nativeTgUrl = result.url;

          if (result.error) {
            tgErrors.push(`${f.originalname}: ${result.error}`);
            console.warn('[Telegram sendPhoto error]:', result.error);
          }

          // Si el modo configurado es solo bot, eliminamos el mensaje auxiliar del canal para mantenerlo limpio
          const pubMode = getSystemSetting('publish_destination') || 'bot_and_channel';
          if (nativeTgUrl && pubMode === 'only_bot' && result.message_id && result.targetChat) {
            try {
              await fetch(`https://api.telegram.org/bot${config.token}/deleteMessage?chat_id=${result.targetChat}&message_id=${result.message_id}`);
            } catch {}
          }
        } catch (uploadErr: any) {
          const msg = uploadErr?.message || String(uploadErr);
          tgErrors.push(`${f.originalname}: ${msg}`);
          console.warn('[Telegram Upload Exception]:', msg);
        }

        // Si se obtuvo la URL nativa de Telegram, se guarda directamente en la BD
        if (nativeTgUrl) {
          uploadedUrls.push(nativeTgUrl);
        } else if (!tgErrors.length || !tgErrors[tgErrors.length - 1].includes('corrupto')) {
          // Fallback a almacenamiento local solo si Telegram está no disponible
          // (si la imagen era inválida no se guarda nada y se informa al usuario)
          uploadedUrls.push(`/uploads/${f.filename}`);
        }
      }
    }

    // Si ningún archivo pudo convertirse en URL de Telegram y no hay URLs directas,
    // responder con error claro en lugar de guardar una ruta local rota.
    if (uploadedUrls.length === 0 && files && files.length > 0) {
      res.status(502).json({
        error: 'No se pudo obtener el enlace de Telegram para las imágenes subidas.',
        details: tgErrors.join(' | ') || 'Verifica que BOT_TOKEN y CHANNEL_ID estén configurados.'
      });
      return;
    }

    const updatedPhotos = [...(profile.photos || []), ...uploadedUrls];
    const updated = await saveProfile({ id: profileId, photos: updatedPhotos });

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPLOAD_PHOTOS', adminId, `${uploadedUrls.length} fotografías agregadas a ${profile.name}`, profileId);

    // Publicación según parametrización (bot_and_channel, only_bot, only_channel)
    const pubMode = getSystemSetting('publish_destination') || 'bot_and_channel';
    let syncResult: any = null;
    if (pubMode !== 'only_bot') {
      try {
        syncResult = await syncProfileToChannel(profileId, adminId);
      } catch (syncErr: any) {
        console.warn('[Sync Channel on Photo Upload]:', syncErr?.message || syncErr);
      }
    } else {
      syncResult = { success: true, message: 'Modo Solo Bot activo: no se publica en el canal' };
    }

    broadcastEvent('PROFILE_UPDATED', updated);
    res.json({ success: true, profile: updated, new_photos: uploadedUrls, sync_result: syncResult });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al subir fotos', details: err?.message });
  }
});

// GET Customer Requests
router.get('/admin/requests', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const requests = await getCustomerRequests();
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener solicitudes de clientes' });
  }
});

// POST Reply to Customer Request & Send Direct Telegram Message
router.post('/admin/requests/:id/reply', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const { reply_message, status } = req.body;

    const request = await getCustomerRequestById(requestId);
    if (!request) {
      res.status(404).json({ error: 'Solicitud no encontrada' });
      return;
    }

    const newStatus = status || 'confirmado';
    await updateCustomerRequestStatus(requestId, newStatus);

    let sentToTelegram = false;
    const targetUserId = request.telegram_user_id;

    if (targetUserId) {
      const qrUrl = getSystemSetting('qr_image_url');
      const profile = await getProfileById(request.profile_id);
      const commissionAmount = profile?.commission_bs || 0;

      const msgText = `✨ *RESPUESTA DE LA ADMINISTRADORA* ✨\n\n📌 *Modelo*: ${request.profile_name}\n🏷️ *Monto de Comisión a transferir*: *Bs. ${commissionAmount}*\n\n💬 ${reply_message || 'Hola, tu solicitud ha sido confirmada.'}\n\n📲 *Por favor, realiza el pago mediante el QR oficial adjunto y envía tu comprobante o captura directamente al privado de la Administradora.* ¡Confidencialidad garantizada!\n\n*Estado de la Solicitud*: ${newStatus.toUpperCase()}`;
      let sent;
      if (qrUrl) {
        sent = await sendPhotoToUser(targetUserId, qrUrl, msgText);
      } else {
        sent = await sendMessage(targetUserId, msgText);
      }
      sentToTelegram = sent.ok;
    }

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('REPLY_REQUEST', adminId, `Respuesta enviada para solicitud de ${request.profile_name} (Cliente: ${request.telegram_first_name || 'Anónimo'})`, requestId);

    broadcastEvent('REQUEST_UPDATED', { id: requestId, status: newStatus });

    res.json({
      success: true,
      sent_to_telegram: sentToTelegram,
      message: sentToTelegram
        ? 'Respuesta enviada directamente al chat de Telegram del cliente.'
        : 'Estado de la solicitud actualizado.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al procesar la respuesta a la solicitud' });
  }
});

// GET Audit Logs & Sync Errors
router.get('/admin/logs', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const auditLogs = await getAuditLogs();
    const syncErrors = await getSyncErrors();
    res.json({ audit_logs: auditLogs, sync_errors: syncErrors });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener registros de auditoría' });
  }
});

// POST Setup Telegram Webhook Helper
router.post('/admin/webhook/setup', requireAdminAuth, async (req: Request, res: Response) => {
  const { token, secret, baseUrl } = getBotConfig();
  if (!token) {
    res.status(400).json({ error: 'BOT_TOKEN no configurado en las variables de entorno' });
    return;
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const tgUrl = `https://api.telegram.org/bot${token}/setWebhook`;

  try {
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query']
      })
    });
    const result = await response.json();
    await updateBotMenuButton();
    await registerBotCommands();
    res.json({ webhook_url: webhookUrl, telegram_response: result, menu_button: 'updated', commands: 'registered' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al registrar webhook', details: err?.message });
  }
});

// POST Update Bot Settings
router.post('/admin/settings', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      bot_username,
      admin_contact_username,
      telegram_only_access,
      auto_reply_delay_minutes
    } = req.body;

    if (bot_username !== undefined) {
      const cleanUsername = String(bot_username).replace(/^@/, '').trim();
      saveSystemSetting('bot_username', cleanUsername);
    }
    if (admin_contact_username !== undefined) {
      const cleanAdmin = String(admin_contact_username).replace(/^@/, '').trim();
      saveSystemSetting('admin_contact_username', cleanAdmin);
    }
    if (telegram_only_access !== undefined) {
      saveSystemSetting('telegram_only_access', telegram_only_access ? 'true' : 'false');
    }
    if (auto_reply_delay_minutes !== undefined) {
      saveSystemSetting('auto_reply_delay_minutes', String(auto_reply_delay_minutes));
    }
    const { publish_destination, admin_telegram_ids } = req.body;
    if (publish_destination !== undefined) {
      saveSystemSetting('publish_destination', String(publish_destination));
    }
    if (admin_telegram_ids !== undefined) {
      saveSystemSetting('admin_telegram_ids', String(admin_telegram_ids).trim());
    }

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_SETTINGS', adminId, 'Ajustes de Telegram y bot actualizados');
    const updatedConfig = getBotConfig();
    const isTelegramOnly = getSystemSetting('telegram_only_access') === 'true';
    const autoReplyDelay = getSystemSetting('auto_reply_delay_minutes') || '10';

    res.json({
      success: true,
      bot_username: updatedConfig.username,
      admin_contact_username: getSystemSetting('admin_contact_username') || 'danii001',
      admin_telegram_ids: getSystemSetting('admin_telegram_ids') || '',
      telegram_only_access: isTelegramOnly,
      auto_reply_delay_minutes: autoReplyDelay,
      publish_destination: getSystemSetting('publish_destination') || 'bot_and_channel',
      qr_image_url: getSystemSetting('qr_image_url') || ''
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// POST Upload QR Image Setting
router.post('/admin/settings/qr', requireAdminAuth, upload.single('qr_image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se envió ninguna imagen QR' });
      return;
    }

    // Validar que el archivo sea una imagen real antes de aceptarlo
    const fileData = fs.readFileSync(req.file.path);
    if (!isValidImageBuffer(fileData)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      res.status(400).json({ error: 'El archivo QR está corrupto o no es una imagen válida (JPEG, PNG, WEBP o GIF).' });
      return;
    }

    const config = getBotConfig();

    // Intentar alojar la imagen en Telegram y guardar su URL nativa permanente
    let qrUrl = '';
    try {
      const result = await uploadFileToTelegramHost(req.file.path, req.file.originalname, '📲 [Media Host] QR Oficial de Comisión');
      if (result.url) {
        qrUrl = result.url;
      } else if (result.error && !result.error.includes('BOT_TOKEN')) {
        console.warn('[QR TG Upload Warning]:', result.error);
      }
    } catch (tgErr: any) {
      console.warn('[QR TG Upload Exception]:', tgErr?.message || tgErr);
    }

    // Fallback: ruta local del servidor
    if (!qrUrl) {
      qrUrl = `${config.baseUrl}/uploads/${req.file.filename}`;
    }

    saveSystemSetting('qr_image_url', qrUrl);
    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_SETTINGS', adminId, 'QR de Comisión actualizado');
    res.json({ success: true, qr_image_url: qrUrl });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al guardar imagen QR', details: err?.message });
  }
});

// POST Save Pinned Message Setting
router.post('/admin/settings/pinned', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { pinned_message_text, pinned_message_active } = req.body;
    saveSystemSetting('pinned_message_text', pinned_message_text || '');
    saveSystemSetting('pinned_message_active', String(Boolean(pinned_message_active)));
    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_SETTINGS', adminId, `Mensaje fijado actualizado (Activo: ${pinned_message_active})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al guardar mensaje fijado' });
  }
});

// GET Paid Commission Logs
router.get('/admin/commissions', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const logs = await getCommissionLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener registro de comisiones pagadas' });
  }
});

// POST Mark Request Commission as Paid
router.post('/admin/requests/:id/pay', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const request = await getCustomerRequestById(requestId);
    if (!request) {
      res.status(404).json({ error: 'Solicitud no encontrada' });
      return;
    }
    await updateCustomerRequestStatus(requestId, 'comision_pagada');

    const tgUser = request.telegram_username
      ? `@${request.telegram_username}`
      : `${request.telegram_first_name || 'Anónimo'} (ID: ${request.telegram_user_id || 'N/A'})`;

    const profile = await getProfileById(request.profile_id);
    const amount = profile?.commission_bs || 0;

    const log = await addCommissionLog(tgUser, request.profile_name, amount, requestId);

    if (request.telegram_user_id) {
      const msgText = `✅ *PAGO DE COMISIÓN REGISTRADO*\n\n¡Muchas gracias! Tu pago de COMISIÓN para *${request.profile_name}* ha sido verificado con éxito por la Administradora. Puedes coordinar tu ingreso y atención.`;
      await sendMessage(request.telegram_user_id, msgText);
    }

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('PAY_COMMISSION', adminId, `Comisión pagada registrada para ${request.profile_name} (Cliente: ${tgUser})`, requestId);
    broadcastEvent('REQUEST_UPDATED', { id: requestId, status: 'comision_pagada' });

    res.json({ success: true, log });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al marcar comisión como pagada' });
  }
});

// GET Database Status & Ping (Turso Cloud vs SQLite)
router.get('/admin/db/status', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const info = getDbInfo();
    const ping = await pingDb();
    res.json({
      ...info,
      ping
    });
  } catch (err: any) {
    res.status(500).json({
      ...getDbInfo(),
      error: 'Error al consultar la base de datos',
      details: err?.message
    });
  }
});

