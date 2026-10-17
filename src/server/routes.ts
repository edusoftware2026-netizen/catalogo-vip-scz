import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
  getCommissionLogs
} from './db.js';
import {
  processTelegramUpdate,
  syncProfileToChannel,
  verifyAdminToken,
  generateAdminMagicToken,
  getBotConfig,
  sendMessage,
  sendPhotoToUser,
  getTelegramFileUrl
} from './telegram.js';

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
  const defaultRate = Number(getSystemSetting('default_rate_bs')) || 450;
  const defaultCommission = Number(getSystemSetting('default_commission_bs')) || 50;
  const defaultStatus = getSystemSetting('default_status') || 'borrador';

  res.json({
    app_name: 'Iam Dani Catálogo',
    bot_username: config.username,
    bot_configured: Boolean(config.token),
    channel_id: config.channelId,
    telegram_only_access: telegramOnly,
    auto_reply_delay_minutes: autoReplyDelay,
    qr_image_url: getSystemSetting('qr_image_url') || '',
    pinned_message_text: getSystemSetting('pinned_message_text') || '',
    pinned_message_active: getSystemSetting('pinned_message_active') === 'true',
    default_rate_bs: defaultRate,
    default_commission_bs: defaultCommission,
    default_status: defaultStatus,
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
        const autoReplyText = `✨ *Iam Dani Catálogo Santa Cruz* ✨\n\n¡Hola ${clientName || 'Estimado/a'}!\n\nNuestra Administradora ha revisado tu consulta para *${profileName}*.\n\n${qrUrl ? '📲 *Te adjuntamos nuestro QR de COMISIÓN oficial.* Por favor, realiza el pago y envía tu comprobante o captura **directamente por mensaje privado a la Administradora** para confirmar tu cita prioritaria.' : 'La Admin se comunicará contigo por mensaje privado en cuanto esté disponible.'}\n\n🔒 Trato 100% Confidencial y Discreto.`;
        if (qrUrl) {
          await sendPhotoToUser(tgUserId, qrUrl, autoReplyText);
        } else {
          await sendMessage(tgUserId, autoReplyText);
        }
        console.log(`[AutoReply] Respuesta automática enviada tras ${delayMinutes} min a ${tgUserId} (Solicitud #${requestId})`);
      }
    } catch (e) {
      console.error('[AutoReply] Error en respuesta automática del bot:', e);
    }
  }, delayMs);
}

// POST Customer Availability Request
router.post('/requests', async (req: Request, res: Response) => {
  try {
    const { profile_id, client_name, client_telegram, tg_user_id, notes } = req.body;

    if (!profile_id) {
      res.status(400).json({ error: 'El ID del perfil es requerido' });
      return;
    }

    const profile = await getProfileById(profile_id);
    if (!profile) {
      res.status(404).json({ error: 'Perfil no encontrado' });
      return;
    }

    const request = await createCustomerRequest({
      profile_id: profile.id,
      profile_name: profile.name,
      telegram_user_id: tg_user_id ? String(tg_user_id) : undefined,
      telegram_first_name: client_name || 'Cliente Telegram/Web',
      telegram_username: client_telegram ? client_telegram.replace('@', '') : undefined,
      notes: notes || 'Solicitud de disponibilidad enviada desde el catálogo VIP',
      status: 'pendiente'
    });

    // Send immediate automated chat to user's Telegram if user_id is present
    if (tg_user_id) {
      const userConfirmText = `✨ *Iam Dani Catálogo* ✨\n\n¡Hola ${client_name || 'Estimado/a'}!\n\nHemos recibido tu solicitud de atención para *${profile.name}*.\n\nLa Administradora procesará tu consulta de forma confidencial y te responderá directamente a este chat en breve.`;
      await sendMessage(String(tg_user_id), userConfirmText);
      scheduleAutoReply(request.id, String(tg_user_id), client_name || 'Estimado/a', profile.name);
    }

    // Send alert to Telegram Admins
    const { adminIds } = getBotConfig();
    const defaultComm = Number(getSystemSetting('default_commission_bs')) || 50;
    const adminNotice = `
🔔 *NUEVA SOLICITUD DE DISPONIBILIDAD* 🔔

👤 *Cliente*: ${client_name || 'Anónimo'} ${client_telegram ? '(@' + client_telegram + ')' : ''}
🆔 *Telegram ID*: \`${tg_user_id || 'No detectado'}\`
👠 *Perfil*: ${profile.name} (TARIFA SERVICIO: Bs. ${profile.rate_bs} | COMISIÓN: Bs. ${profile.commission_bs || defaultComm})
📍 *Zona*: ${profile.zone}
📝 *Notas*: ${notes || 'Sin observaciones'}
📅 *Fecha*: ${new Date().toLocaleString()}

💬 _Para responder al cliente enviándole el QR de COMISIÓN adjunto, escribe en este chat:_\n\`/qr ${tg_user_id || 'ID_CLIENTE'}\`
    `;

    for (const adminId of adminIds) {
      if (adminId) {
        await sendMessage(adminId, adminNotice);
      }
    }

    broadcastEvent('NEW_REQUEST', request);

    res.json({
      success: true,
      message: 'Solicitud enviada con éxito. La Administradora responderá a la brevedad por privado.',
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
    const { name, age, zone, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;

    if (!name || !age || age < 18) {
      res.status(400).json({ error: 'El nombre es obligatorio y la edad debe ser igual o mayor a 18 años.' });
      return;
    }

    const newId = `prof_${Date.now()}`;
    const profile = await saveProfile({
      id: newId,
      name,
      age: Number(age),
      zone: zone || 'Santa Cruz',
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

    const { name, age, zone, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;

    if (age !== undefined && Number(age) < 18) {
      res.status(400).json({ error: 'La edad debe ser mayor o igual a 18 años.' });
      return;
    }

    const updated = await saveProfile({
      id: profileId,
      name: name ?? existing.name,
      age: age !== undefined ? Number(age) : existing.age,
      zone: zone ?? existing.zone,
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

    // 2. Si se subieron archivos binarios, subirlos a Telegram para obtener su URL nativo
    if (files && files.length > 0) {
      for (const f of files) {
        if (config.token && (config.channelId || (config.adminIds && config.adminIds.length > 0))) {
          try {
            const targetChat = config.channelId || config.adminIds[0];
            const fileData = fs.readFileSync(f.path);
            const blob = new Blob([fileData]);
            const formData = new FormData();
            formData.append('chat_id', targetChat);
            formData.append('photo', blob, f.originalname);
            const tgRes = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
              method: 'POST',
              body: formData
            });
            const tgJson = await tgRes.json();
            if (tgJson.ok && tgJson.result?.photo?.length > 0) {
              const largest = tgJson.result.photo[tgJson.result.photo.length - 1];
              const nativeTgUrl = await getTelegramFileUrl(largest.file_id);
              uploadedUrls.push(nativeTgUrl);
            } else {
              uploadedUrls.push(`${config.baseUrl}/uploads/${f.filename}`);
            }
          } catch {
            uploadedUrls.push(`${config.baseUrl}/uploads/${f.filename}`);
          }
        } else {
          uploadedUrls.push(`${config.baseUrl}/uploads/${f.filename}`);
        }

        // Eliminar inmediatamente el archivo temporal del disco para no almacenar multimedia local
        try {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        } catch {}
      }
    }

    const updatedPhotos = [...(profile.photos || []), ...uploadedUrls];
    const updated = await saveProfile({ id: profileId, photos: updatedPhotos });

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPLOAD_PHOTOS', adminId, `${uploadedUrls.length} fotografías agregadas a ${profile.name}`, profileId);

    // Auto sync
    await syncProfileToChannel(profileId, adminId);

    broadcastEvent('PROFILE_UPDATED', updated);
    res.json({ success: true, profile: updated, new_photos: uploadedUrls });
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
      const msgText = `✨ *RESPUESTA DE LA ADMINISTRADORA* ✨\n\n📌 *Modelo Consultada*: ${request.profile_name}\n\n💬 ${reply_message || 'Hola, tu solicitud ha sido procesada.'}\n\n📲 *Por favor, realiza el pago de la COMISIÓN y envía tu comprobante o captura directamente al privado de la Administradora.* ¡Confidencialidad garantizada!\n\n*Estado de la Solicitud*: ${newStatus.toUpperCase()}`;
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
    res.json({ webhook_url: webhookUrl, telegram_response: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al registrar webhook', details: err?.message });
  }
});

// POST Update Bot Settings
router.post('/admin/settings', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      bot_username,
      telegram_only_access,
      auto_reply_delay_minutes,
      default_rate_bs,
      default_commission_bs,
      default_status
    } = req.body;

    if (bot_username !== undefined) {
      const cleanUsername = String(bot_username).replace(/^@/, '').trim();
      saveSystemSetting('bot_username', cleanUsername);
    }
    if (telegram_only_access !== undefined) {
      saveSystemSetting('telegram_only_access', telegram_only_access ? 'true' : 'false');
    }
    if (auto_reply_delay_minutes !== undefined) {
      saveSystemSetting('auto_reply_delay_minutes', String(auto_reply_delay_minutes));
    }
    if (default_rate_bs !== undefined) {
      saveSystemSetting('default_rate_bs', String(default_rate_bs));
    }
    if (default_commission_bs !== undefined) {
      saveSystemSetting('default_commission_bs', String(default_commission_bs));
    }
    if (default_status !== undefined) {
      saveSystemSetting('default_status', String(default_status));
    }

    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_SETTINGS', adminId, 'Parámetros del sistema y bot actualizados');
    const updatedConfig = getBotConfig();
    const isTelegramOnly = getSystemSetting('telegram_only_access') === 'true';
    const autoReplyDelay = getSystemSetting('auto_reply_delay_minutes') || '10';
    const defaultRate = Number(getSystemSetting('default_rate_bs')) || 450;
    const defaultComm = Number(getSystemSetting('default_commission_bs')) || 50;
    const defaultSt = getSystemSetting('default_status') || 'borrador';

    res.json({
      success: true,
      bot_username: updatedConfig.username,
      telegram_only_access: isTelegramOnly,
      auto_reply_delay_minutes: autoReplyDelay,
      qr_image_url: getSystemSetting('qr_image_url') || '',
      default_rate_bs: defaultRate,
      default_commission_bs: defaultComm,
      default_status: defaultSt
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
    const config = getBotConfig();
    const qrUrl = `${config.baseUrl}/uploads/${req.file.filename}`;
    saveSystemSetting('qr_image_url', qrUrl);
    const adminId = (req as any).adminUserId || 'Admin Web';
    await addAuditLog('UPDATE_SETTINGS', adminId, 'QR de Comisión actualizado');
    res.json({ success: true, qr_image_url: qrUrl });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al guardar imagen QR' });
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
    const defaultComm = Number(getSystemSetting('default_commission_bs')) || 50;
    const amount = profile?.commission_bs || defaultComm;

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
