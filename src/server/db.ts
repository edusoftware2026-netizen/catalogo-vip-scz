import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { Profile, CustomerRequest, AuditLog, SyncErrorLog, ConversationState, ProfileStatus } from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'catalogo.sqlite');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const filebuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  initTables(db);
  seedInitialData(db);
  ensureDefaultSettings(db);
  saveDb();

  return db;
}

function ensureDefaultSettings(database: Database): void {
  database.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('telegram_only_access', 'true')`);
  database.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_reply_delay_minutes', '10')`);
  database.run(`UPDATE system_settings SET value = 'CatalogoVIPSCZBot' WHERE key = 'bot_username' AND value = 'catalogovipscz'`);
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

function initTables(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      zone TEXT NOT NULL,
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

  database.run(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      profile_name TEXT NOT NULL,
      telegram_user_id TEXT,
      telegram_username TEXT,
      telegram_first_name TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      telegram_user_id TEXT PRIMARY KEY,
      step TEXT NOT NULL,
      draft_data TEXT NOT NULL,
      active_profile_id TEXT,
      last_updated TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      profile_id TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_errors (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      action TEXT NOT NULL,
      error_message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS commission_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      telegram_user TEXT NOT NULL,
      profile_name TEXT NOT NULL,
      amount_bs REAL,
      paid_at TEXT NOT NULL
    );
  `);
}

function seedInitialData(database: Database): void {
  const check = database.exec("SELECT COUNT(*) as count FROM profiles");
  const count = check[0]?.values[0]?.[0] as number;

  if (count === 0) {
    const now = new Date().toISOString();

    const sampleProfiles: Partial<Profile>[] = [
      {
        id: 'prof_scz_01',
        name: 'Camila',
        age: 22,
        zone: 'Santa Cruz',
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
        zone: 'Santa Cruz',
        description: 'Modelo independiente de trato refinado y dulce. Atención exclusiva con máxima confidencialidad y excelente trato personal.',
        rate_bs: 500,
        commission_bs: 50,
        photos: [
          'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponible',
        priority_order: 2
      },
      {
        id: 'prof_scz_03',
        name: 'Fiorella',
        age: 21,
        zone: 'Santa Cruz',
        description: 'Elegante, atenta y distinguida. Ideal para veladas exclusivas con reserva anticipada y atención personalizada.',
        rate_bs: 400,
        commission_bs: 50,
        photos: [
          'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'ocupada',
        priority_order: 3
      },
      {
        id: 'prof_scz_04',
        name: 'Nicole',
        age: 23,
        zone: 'Santa Cruz',
        description: 'Chica carismática y muy profesional. Excelente figura, simpatía y máxima discreción garantizada en Santa Cruz.',
        rate_bs: 480,
        commission_bs: 50,
        photos: [
          'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponible',
        priority_order: 4
      }
    ];

    const stmt = database.prepare(`
      INSERT INTO profiles (id, name, age, zone, description, rate_bs, commission_bs, photos, status, created_at, updated_at, telegram_message_id, priority_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `);

    for (const p of sampleProfiles) {
      stmt.run([
        p.id!,
        p.name!,
        p.age!,
        p.zone!,
        p.description!,
        p.rate_bs!,
        p.commission_bs!,
        JSON.stringify(p.photos!),
        p.status!,
        now,
        now,
        p.priority_order || 0
      ]);
    }
    stmt.free();

    // Initial audit log
    database.run(`
      INSERT INTO audit_logs (id, action, performed_by, profile_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'log_init_01',
      'SYSTEM_INIT',
      'System',
      null,
      'Base de datos inicializada con perfiles de prueba en Santa Cruz',
      now
    ]);
  }
}

// Helper para normalizar URLs de fotos a rutas relativas para compatibilidad móvil exterior
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

// Data Access Methods
export async function getAllProfiles(): Promise<Profile[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM profiles ORDER BY priority_order ASC, updated_at DESC");
  if (!res || res.length === 0) return [];
  
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    try {
      obj.photos = normalizePhotoUrls(JSON.parse(obj.photos || '[]'));
    } catch {
      obj.photos = [];
    }
    return obj as Profile;
  });
}

export async function getPublicProfiles(): Promise<Profile[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM profiles WHERE status IN ('disponible', 'ocupada') AND age >= 18 ORDER BY priority_order ASC, updated_at DESC");
  if (!res || res.length === 0) return [];
  
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    try {
      obj.photos = normalizePhotoUrls(JSON.parse(obj.photos || '[]'));
    } catch {
      obj.photos = [];
    }
    return obj as Profile;
  });
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM profiles WHERE id = ?");
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, any>;
    stmt.free();
    let photosParsed: string[] = [];
    try {
      photosParsed = normalizePhotoUrls(JSON.parse(row.photos || '[]'));
    } catch {
      photosParsed = [];
    }
    return { ...row, photos: photosParsed } as unknown as Profile;
  }
  stmt.free();
  return null;
}

export async function saveProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const database = await getDb();
  const existing = await getProfileById(profile.id);
  const now = new Date().toISOString();

  // Strict safety check: Age >= 18
  if (profile.age !== undefined && profile.age < 18) {
    throw new Error('PROHIBICION LEGAL Y DE SEGURIDAD: Todos los perfiles deben ser de personas mayores de 18 años.');
  }

  if (existing) {
    const updatedName = profile.name ?? existing.name;
    const updatedAge = profile.age ?? existing.age;
    const updatedZone = profile.zone ?? existing.zone;
    const updatedDesc = profile.description ?? existing.description;
    const updatedRate = profile.rate_bs ?? existing.rate_bs;
    const updatedCommission = profile.commission_bs ?? existing.commission_bs;
    const updatedPhotos = profile.photos ? JSON.stringify(profile.photos) : JSON.stringify(existing.photos);
    const updatedStatus = profile.status ?? existing.status;
    const updatedTgMsgId = profile.telegram_message_id !== undefined ? profile.telegram_message_id : existing.telegram_message_id;
    const updatedPriority = profile.priority_order ?? existing.priority_order;

    database.run(`
      UPDATE profiles
      SET name = ?, age = ?, zone = ?, description = ?, rate_bs = ?, commission_bs = ?, photos = ?, status = ?, updated_at = ?, telegram_message_id = ?, priority_order = ?
      WHERE id = ?
    `, [
      updatedName,
      updatedAge,
      updatedZone,
      updatedDesc,
      updatedRate,
      updatedCommission,
      updatedPhotos,
      updatedStatus,
      now,
      updatedTgMsgId,
      updatedPriority,
      profile.id
    ]);
  } else {
    database.run(`
      INSERT INTO profiles (id, name, age, zone, description, rate_bs, commission_bs, photos, status, created_at, updated_at, telegram_message_id, priority_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      profile.id,
      profile.name || 'Sin nombre',
      profile.age || 18,
      profile.zone || 'Santa Cruz',
      profile.description || '',
      profile.rate_bs || 0,
      profile.commission_bs || 0,
      JSON.stringify(profile.photos || []),
      profile.status || 'borrador',
      now,
      now,
      profile.telegram_message_id || null,
      profile.priority_order || 0
    ]);
  }

  saveDb();
  return (await getProfileById(profile.id))!;
}

export async function deleteProfile(id: string): Promise<boolean> {
  const database = await getDb();
  database.run("DELETE FROM profiles WHERE id = ?", [id]);
  saveDb();
  return true;
}

// Customer Requests
export async function createCustomerRequest(req: Partial<CustomerRequest>): Promise<CustomerRequest> {
  const database = await getDb();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  database.run(`
    INSERT INTO customer_requests (id, profile_id, profile_name, telegram_user_id, telegram_username, telegram_first_name, status, created_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    req.profile_id || '',
    req.profile_name || '',
    req.telegram_user_id || null,
    req.telegram_username || null,
    req.telegram_first_name || null,
    req.status || 'pendiente',
    now,
    req.notes || ''
  ]);

  saveDb();
  return {
    id,
    profile_id: req.profile_id || '',
    profile_name: req.profile_name || '',
    telegram_user_id: req.telegram_user_id,
    telegram_username: req.telegram_username,
    telegram_first_name: req.telegram_first_name,
    status: req.status as any || 'pendiente',
    created_at: now,
    notes: req.notes
  };
}

export async function getCustomerRequests(): Promise<CustomerRequest[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM customer_requests ORDER BY created_at DESC");
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as CustomerRequest;
  });
}

export async function getCustomerRequestById(id: string): Promise<CustomerRequest | null> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM customer_requests WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as unknown as CustomerRequest;
  }
  stmt.free();
  return null;
}

export async function updateCustomerRequestStatus(id: string, status: string): Promise<void> {
  const database = await getDb();
  database.run("UPDATE customer_requests SET status = ? WHERE id = ?", [status, id]);
  saveDb();
}

// Conversation State Machine for Telegram Bot
export async function getConversationState(userId: string): Promise<ConversationState | null> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM conversations WHERE telegram_user_id = ?");
  stmt.bind([userId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      telegram_user_id: row.telegram_user_id as string,
      step: row.step as string,
      draft_data: JSON.parse((row.draft_data as string) || '{}'),
      active_profile_id: row.active_profile_id as string || undefined,
      last_updated: row.last_updated as string
    };
  }
  stmt.free();
  return null;
}

export async function setConversationState(userId: string, step: string, draftData: Partial<Profile>, activeProfileId?: string): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  database.run(`
    INSERT INTO conversations (telegram_user_id, step, draft_data, active_profile_id, last_updated)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      step = excluded.step,
      draft_data = excluded.draft_data,
      active_profile_id = excluded.active_profile_id,
      last_updated = excluded.last_updated
  `, [
    userId,
    step,
    JSON.stringify(draftData),
    activeProfileId || null,
    now
  ]);
  saveDb();
}

export async function clearConversationState(userId: string): Promise<void> {
  const database = await getDb();
  database.run("DELETE FROM conversations WHERE telegram_user_id = ?", [userId]);
  saveDb();
}

// Audit Logs & Sync Errors
export async function addAuditLog(action: string, performedBy: string, details: string, profileId?: string): Promise<void> {
  const database = await getDb();
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  database.run(`
    INSERT INTO audit_logs (id, action, performed_by, profile_id, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, action, performedBy, profileId || null, details, now]);
  saveDb();
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as AuditLog;
  });
}

export async function addSyncError(profileId: string, action: string, errorMessage: string): Promise<void> {
  const database = await getDb();
  const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  database.run(`
    INSERT INTO sync_errors (id, profile_id, action, error_message, timestamp, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `, [id, profileId, action, errorMessage, now]);
  saveDb();
}

export async function getSyncErrors(): Promise<SyncErrorLog[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM sync_errors ORDER BY timestamp DESC LIMIT 50");
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as SyncErrorLog;
  });
}

export function getSystemSetting(key: string): string | null {
  if (!db) return null;
  const stmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const val = stmt.getAsObject().value as string;
    stmt.free();
    return val;
  }
  stmt.free();
  return null;
}

export function saveSystemSetting(key: string, value: string): void {
  if (!db) return;
  db.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
  saveDb();
}

// Commission Logs Management
export interface CommissionLog {
  id: string;
  request_id?: string;
  telegram_user: string;
  profile_name: string;
  amount_bs: number;
  paid_at: string;
}

export async function addCommissionLog(telegram_user: string, profile_name: string, amount_bs?: number, request_id?: string): Promise<CommissionLog> {
  const database = await getDb();
  const defaultComm = Number(getSystemSetting('default_commission_bs')) || 50;
  const finalAmount = (amount_bs !== undefined && amount_bs !== null) ? Number(amount_bs) : defaultComm;
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const paid_at = new Date().toISOString();
  const stmt = database.prepare("INSERT INTO commission_logs (id, request_id, telegram_user, profile_name, amount_bs, paid_at) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run([id, request_id || null, telegram_user, profile_name, finalAmount, paid_at]);
  stmt.free();
  saveDb();
  return { id, request_id, telegram_user, profile_name, amount_bs: finalAmount, paid_at };
}

export async function getCommissionLogs(): Promise<CommissionLog[]> {
  const database = await getDb();
  const res = database.exec("SELECT * FROM commission_logs ORDER BY paid_at DESC");
  if (!res || res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as CommissionLog;
  });
}
