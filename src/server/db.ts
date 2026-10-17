import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { Profile, CustomerRequest, AuditLog, SyncErrorLog, ConversationState, ProfileStatus, RequestStatus } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'catalogo.sqlite');

let client: Client | null = null;
const settingsCache = new Map<string, string>();

/**
 * Obtener o inicializar el cliente de base de datos (Turso o SQLite local)
 */
export async function getDb(): Promise<Client> {
  if (client) return client;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    console.log(`[Turso DB] Conectando a Turso Cloud Database: ${tursoUrl.replace(/\/\/[^@]*@/, '//***@')}`);
    client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken
    });
  } else {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    console.log(`[Local SQLite DB] Usando archivo local: ${DB_FILE}`);
    client = createClient({
      url: `file:${DB_FILE}`
    });
  }

  await initTables(client);
  await seedInitialData(client);
  await loadSettingsCache(client);

  return client;
}

// Cargar ajustes del sistema en memoria para acceso sincrónico instantáneo
async function loadSettingsCache(c: Client): Promise<void> {
  try {
    const res = await c.execute("SELECT key, value FROM system_settings");
    settingsCache.clear();
    for (const row of res.rows) {
      if (row.key && row.value !== undefined) {
        settingsCache.set(String(row.key), String(row.value));
      }
    }
  } catch (err) {
    console.warn('[DB Settings Cache] Error al precargar ajustes:', err);
  }
}

async function initTables(c: Client): Promise<void> {
  await c.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      description TEXT NOT NULL,
      rate_bs REAL NOT NULL,
      commission_bs REAL NOT NULL,
      photos TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      telegram_message_id INTEGER,
      priority_order INTEGER DEFAULT 0
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      profile_name TEXT NOT NULL,
      telegram_user_id TEXT,
      telegram_username TEXT,
      telegram_first_name TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT,
      receipt_url TEXT
    );
  `);

  try {
    await c.execute("ALTER TABLE customer_requests ADD COLUMN receipt_url TEXT");
  } catch {
    // Columna ya existe o migración previa
  }

  await c.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      telegram_user_id TEXT PRIMARY KEY,
      step TEXT NOT NULL,
      draft_data TEXT NOT NULL,
      active_profile_id TEXT,
      last_updated TEXT NOT NULL
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      profile_id TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS sync_errors (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      action TEXT NOT NULL,
      error_message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await c.execute(`
    CREATE TABLE IF NOT EXISTS commission_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      telegram_user TEXT NOT NULL,
      profile_name TEXT NOT NULL,
      amount_bs REAL,
      paid_at TEXT NOT NULL
    );
  `);

  // Ajustes base por defecto
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('telegram_only_access', 'true')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_reply_delay_minutes', '10')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('bot_username', 'CatalogoVIPSCZBot')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('admin_contact_username', 'danii001')");
}

async function seedInitialData(c: Client): Promise<void> {
  const check = await c.execute("SELECT COUNT(*) as count FROM profiles");
  const count = Number(check.rows[0]?.count || 0);

  if (count === 0) {
    const now = new Date().toISOString();

    const sampleProfiles: Partial<Profile>[] = [
      {
        id: 'prof_scz_01',
        name: 'Camila',
        age: 22,
        description: 'Acompañante elegante, educada y distinguida. Excelente presencia para cenas, eventos y momentos de relajación privada y reservada en Santa Cruz.',
        rate_bs: 450,
        commission_bs: 50,
        photos: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponible',
        priority_order: 1
      },
      {
        id: 'prof_scz_02',
        name: 'Valeria',
        age: 24,
        description: 'Modelo independiente de trato refinado y dulce. Atención exclusiva con máxima confidencialidad y excelente trato personal.',
        rate_bs: 500,
        commission_bs: 60,
        photos: [
          'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponible',
        priority_order: 2
      },
      {
        id: 'prof_scz_03',
        name: 'Andrea',
        age: 21,
        description: 'Elegante, atenta y distinguida. Ideal para veladas exclusivas con reserva anticipada y atención personalizada.',
        rate_bs: 450,
        commission_bs: 50,
        photos: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponible',
        priority_order: 3
      }
    ];

    for (const p of sampleProfiles) {
      await c.execute({
        sql: `INSERT INTO profiles (id, name, age, description, rate_bs, commission_bs, photos, status, created_at, updated_at, telegram_message_id, priority_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        args: [
          p.id!,
          p.name!,
          p.age!,
          p.description!,
          p.rate_bs!,
          p.commission_bs!,
          JSON.stringify(p.photos!),
          p.status!,
          now,
          now,
          p.priority_order || 0
        ]
      });
    }

    await c.execute({
      sql: `INSERT INTO audit_logs (id, action, performed_by, profile_id, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'log_init_01',
        'SYSTEM_INIT',
        'System',
        null,
        'Base de datos inicializada con perfiles de prueba en Santa Cruz',
        now
      ]
    });
  }
}

// Normalizar URLs de fotos a rutas relativas para compatibilidad móvil exterior
function normalizePhotoUrls(photos: any): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.map(url => {
    if (typeof url === 'string' && url.includes('/uploads/')) {
      const filename = url.split('/uploads/').pop();
      return `/uploads/${filename}`;
    }
    return url;
  });
}

function mapRowToProfile(row: any): Profile {
  let photosParsed: string[] = [];
  try {
    photosParsed = normalizePhotoUrls(JSON.parse((row.photos as string) || '[]'));
  } catch {
    photosParsed = [];
  }

  return {
    id: String(row.id),
    name: String(row.name),
    age: Number(row.age),
    description: String(row.description || ''),
    rate_bs: Number(row.rate_bs || 0),
    commission_bs: Number(row.commission_bs || 0),
    photos: photosParsed,
    status: row.status as ProfileStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    telegram_message_id: row.telegram_message_id ? Number(row.telegram_message_id) : undefined,
    priority_order: Number(row.priority_order || 0)
  };
}

function normalizeRequestStatus(status: unknown): RequestStatus {
  const validStatuses: RequestStatus[] = ['pendiente', 'confirmado', 'rechazado', 'completado', 'comision_pagada'];
  const value = typeof status === 'string' ? status : 'pendiente';
  return validStatuses.includes(value as RequestStatus) ? (value as RequestStatus) : 'pendiente';
}

// Data Access Methods
export async function getAllProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM profiles ORDER BY priority_order ASC, updated_at DESC");
  return res.rows.map(mapRowToProfile);
}

export async function getPublicProfiles(): Promise<Profile[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM profiles WHERE status IN ('disponible', 'ocupada') AND age >= 18 ORDER BY priority_order ASC, updated_at DESC");
  return res.rows.map(mapRowToProfile);
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM profiles WHERE id = ?",
    args: [id]
  });
  if (res.rows.length === 0) return null;
  return mapRowToProfile(res.rows[0]);
}

export async function saveProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const db = await getDb();
  const existing = await getProfileById(profile.id);
  const now = new Date().toISOString();

  // Strict safety check: Age >= 18
  if (profile.age !== undefined && profile.age < 18) {
    throw new Error('PROHIBICION LEGAL Y DE SEGURIDAD: Todos los perfiles deben ser de personas mayores de 18 años.');
  }

  if (existing) {
    const updatedName = profile.name ?? existing.name;
    const updatedAge = profile.age ?? existing.age;
    const updatedDesc = profile.description ?? existing.description;
    const updatedRate = profile.rate_bs ?? existing.rate_bs;
    const updatedCommission = profile.commission_bs ?? existing.commission_bs;
    const updatedPhotos = profile.photos ? JSON.stringify(profile.photos) : JSON.stringify(existing.photos);
    const updatedStatus = profile.status ?? existing.status;
    const updatedTgMsgId = profile.telegram_message_id !== undefined ? profile.telegram_message_id : existing.telegram_message_id;
    const updatedPriority = profile.priority_order ?? existing.priority_order;

    await db.execute({
      sql: `UPDATE profiles
            SET name = ?, age = ?, description = ?, rate_bs = ?, commission_bs = ?, photos = ?, status = ?, updated_at = ?, telegram_message_id = ?, priority_order = ?
            WHERE id = ?`,
      args: [
        updatedName,
        updatedAge,
        updatedDesc,
        updatedRate,
        updatedCommission,
        updatedPhotos,
        updatedStatus,
        now,
        updatedTgMsgId ?? null,
        updatedPriority,
        profile.id
      ]
    });
  } else {
    await db.execute({
      sql: `INSERT INTO profiles (id, name, age, description, rate_bs, commission_bs, photos, status, created_at, updated_at, telegram_message_id, priority_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        profile.id,
        profile.name || 'Sin nombre',
        profile.age || 18,
        profile.description || '',
        profile.rate_bs || 0,
        profile.commission_bs || 0,
        JSON.stringify(profile.photos || []),
        profile.status || 'borrador',
        now,
        now,
        profile.telegram_message_id || null,
        profile.priority_order || 0
      ]
    });
  }

  return (await getProfileById(profile.id))!;
}

export async function deleteProfile(id: string): Promise<boolean> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM profiles WHERE id = ?",
    args: [id]
  });
  return true;
}

// Customer Requests
export async function createCustomerRequest(req: Partial<CustomerRequest>): Promise<CustomerRequest> {
  const db = await getDb();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const normalizedStatus = normalizeRequestStatus(req.status || 'pendiente');

  await db.execute({
    sql: `INSERT INTO customer_requests (id, profile_id, profile_name, telegram_user_id, telegram_username, telegram_first_name, status, created_at, notes, receipt_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      req.profile_id || '',
      req.profile_name || '',
      req.telegram_user_id || null,
      req.telegram_username || null,
      req.telegram_first_name || null,
      normalizedStatus,
      now,
      req.notes || null,
      req.receipt_url || null
    ]
  });

  return {
    id,
    profile_id: req.profile_id || '',
    profile_name: req.profile_name || '',
    telegram_user_id: req.telegram_user_id,
    telegram_username: req.telegram_username,
    telegram_first_name: req.telegram_first_name,
    status: normalizedStatus,
    created_at: now,
    notes: req.notes,
    receipt_url: req.receipt_url
  };
}

export async function getCustomerRequests(): Promise<CustomerRequest[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM customer_requests ORDER BY created_at DESC LIMIT 100");
  return res.rows.map(r => ({
    id: String(r.id),
    profile_id: String(r.profile_id),
    profile_name: String(r.profile_name),
    telegram_user_id: r.telegram_user_id ? String(r.telegram_user_id) : undefined,
    telegram_username: r.telegram_username ? String(r.telegram_username) : undefined,
    telegram_first_name: r.telegram_first_name ? String(r.telegram_first_name) : undefined,
    status: normalizeRequestStatus(r.status),
    created_at: String(r.created_at),
    notes: r.notes ? String(r.notes) : undefined,
    receipt_url: r.receipt_url ? String(r.receipt_url) : undefined
  }));
}

export async function getCustomerRequestById(id: string): Promise<CustomerRequest | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM customer_requests WHERE id = ?",
    args: [id]
  });
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: String(r.id),
    profile_id: String(r.profile_id),
    profile_name: String(r.profile_name),
    telegram_user_id: r.telegram_user_id ? String(r.telegram_user_id) : undefined,
    telegram_username: r.telegram_username ? String(r.telegram_username) : undefined,
    telegram_first_name: r.telegram_first_name ? String(r.telegram_first_name) : undefined,
    status: normalizeRequestStatus(r.status),
    created_at: String(r.created_at),
    notes: r.notes ? String(r.notes) : undefined,
    receipt_url: r.receipt_url ? String(r.receipt_url) : undefined
  };
}

export async function updateCustomerRequestStatus(id: string, status: RequestStatus): Promise<void> {
  const db = await getDb();
  const normalizedStatus = normalizeRequestStatus(status);
  await db.execute({
    sql: "UPDATE customer_requests SET status = ? WHERE id = ?",
    args: [normalizedStatus, id]
  });
}

// Conversation State Machine for Telegram Bot
export async function getConversationState(userId: string): Promise<ConversationState | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM conversations WHERE telegram_user_id = ?",
    args: [userId]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    telegram_user_id: String(row.telegram_user_id),
    step: String(row.step),
    draft_data: JSON.parse(String(row.draft_data || '{}')),
    active_profile_id: row.active_profile_id ? String(row.active_profile_id) : undefined,
    last_updated: String(row.last_updated)
  };
}

export async function setConversationState(userId: string, step: string, draftData: Partial<Profile>, activeProfileId?: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO conversations (telegram_user_id, step, draft_data, active_profile_id, last_updated)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(telegram_user_id) DO UPDATE SET
            step = excluded.step,
            draft_data = excluded.draft_data,
            active_profile_id = excluded.active_profile_id,
            last_updated = excluded.last_updated`,
    args: [userId, step, JSON.stringify(draftData), activeProfileId || null, now]
  });
}

export async function clearConversationState(userId: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM conversations WHERE telegram_user_id = ?",
    args: [userId]
  });
}

// Audit Logs
export async function addAuditLog(action: string, performedBy: string, details: string, profileId?: string): Promise<void> {
  const db = await getDb();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO audit_logs (id, action, performed_by, profile_id, details, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, action, performedBy, profileId || null, details, now]
  });
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
  return res.rows.map(r => ({
    id: String(r.id),
    action: String(r.action),
    performed_by: String(r.performed_by),
    profile_id: r.profile_id ? String(r.profile_id) : undefined,
    details: String(r.details),
    timestamp: String(r.timestamp)
  }));
}

export async function addSyncError(profileId: string, action: string, errorMessage: string): Promise<void> {
  const db = await getDb();
  const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO sync_errors (id, profile_id, action, error_message, timestamp, status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
    args: [id, profileId, action, errorMessage, now]
  });
}

export async function getSyncErrors(): Promise<SyncErrorLog[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM sync_errors ORDER BY timestamp DESC LIMIT 50");
  return res.rows.map(r => {
    const statusValue = String(r.status);
    const status: SyncErrorLog['status'] =
      statusValue === 'pending' || statusValue === 'resolved' || statusValue === 'retried'
        ? statusValue
        : 'pending';

    return {
      id: String(r.id),
      profile_id: String(r.profile_id),
      action: String(r.action),
      error_message: String(r.error_message),
      timestamp: String(r.timestamp),
      status
    };
  });
}

// System Settings (con cache en memoria para rendimiento instantáneo)
export function getSystemSetting(key: string): string | null {
  return settingsCache.get(key) || null;
}

export async function saveSystemSetting(key: string, value: string): Promise<void> {
  settingsCache.set(key, value);
  const db = await getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
    args: [key, value]
  });
}

// Commission Logs Management (Individuales por perfil)
export interface CommissionLog {
  id: string;
  request_id?: string;
  telegram_user: string;
  profile_name: string;
  amount_bs: number;
  paid_at: string;
}

export async function addCommissionLog(telegram_user: string, profile_name: string, amount_bs: number, request_id?: string): Promise<CommissionLog> {
  const db = await getDb();
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const paid_at = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO commission_logs (id, request_id, telegram_user, profile_name, amount_bs, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, request_id || null, telegram_user, profile_name, amount_bs, paid_at]
  });
  return { id, request_id, telegram_user, profile_name, amount_bs, paid_at };
}

export async function getCommissionLogs(): Promise<CommissionLog[]> {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM commission_logs ORDER BY paid_at DESC");
  return res.rows.map(r => ({
    id: String(r.id),
    request_id: r.request_id ? String(r.request_id) : undefined,
    telegram_user: String(r.telegram_user),
    profile_name: String(r.profile_name),
    amount_bs: Number(r.amount_bs || 0),
    paid_at: String(r.paid_at)
  }));
}

export function getDbInfo() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const host = tursoUrl.replace(/^libsql:\/\//, '').replace(/^https?:\/\//, '');
    return {
      type: 'turso',
      is_cloud: true,
      label: 'Turso Cloud DB',
      host: host,
      status: 'connected'
    };
  }
  return {
    type: 'sqlite',
    is_cloud: false,
    label: 'SQLite Local',
    host: 'data/catalogo.sqlite',
    status: 'connected'
  };
}

export async function pingDb(): Promise<{ success: boolean; latency_ms: number; timestamp: string }> {
  const db = await getDb();
  const start = Date.now();
  await db.execute("SELECT 1");
  const latency_ms = Date.now() - start;
  return {
    success: true,
    latency_ms,
    timestamp: new Date().toISOString()
  };
}

