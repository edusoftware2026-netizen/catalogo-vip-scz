var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server/db.ts
var db_exports = {};
__export(db_exports, {
  addAuditLog: () => addAuditLog,
  addCommissionLog: () => addCommissionLog,
  addSyncError: () => addSyncError,
  clearConversationState: () => clearConversationState,
  createCustomerRequest: () => createCustomerRequest,
  deleteProfile: () => deleteProfile,
  getAllProfiles: () => getAllProfiles,
  getAuditLogs: () => getAuditLogs,
  getCommissionLogs: () => getCommissionLogs,
  getConversationState: () => getConversationState,
  getCustomerRequestById: () => getCustomerRequestById,
  getCustomerRequests: () => getCustomerRequests,
  getDb: () => getDb,
  getDbInfo: () => getDbInfo,
  getProfileById: () => getProfileById,
  getPublicProfiles: () => getPublicProfiles,
  getSyncErrors: () => getSyncErrors,
  getSystemSetting: () => getSystemSetting,
  pingDb: () => pingDb,
  saveProfile: () => saveProfile,
  saveSystemSetting: () => saveSystemSetting,
  setConversationState: () => setConversationState,
  updateCustomerRequestStatus: () => updateCustomerRequestStatus
});
async function getDb() {
  if (client) return client;
  const rawUrl = process.env.TURSO_DATABASE_URL;
  const rawToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;
  const tursoUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, "") : void 0;
  const tursoAuthToken = rawToken ? rawToken.trim().replace(/^["']|["']$/g, "") : void 0;
  let tursoSuccess = false;
  if (tursoUrl) {
    if (!tursoAuthToken) {
      console.warn("\u26A0\uFE0F [Turso DB] TURSO_DATABASE_URL est\xE1 configurado pero falta TURSO_AUTH_TOKEN en las variables de entorno.");
      console.warn("\u26A0\uFE0F [Turso DB] Para conectar a Turso Cloud debes agregar la variable TURSO_AUTH_TOKEN en el panel de Render.");
    } else {
      console.log(`[Turso DB] Conectando a Turso Cloud Database: ${tursoUrl.replace(/\/\/[^@]*@/, "//***@")}`);
      try {
        const cloudClient = (0, import_client.createClient)({
          url: tursoUrl,
          authToken: tursoAuthToken
        });
        await cloudClient.execute("SELECT 1");
        client = cloudClient;
        isCloudTurso = true;
        tursoSuccess = true;
        console.log("\u2705 [Turso DB] Autenticaci\xF3n y conexi\xF3n exitosa con Turso Cloud.");
      } catch (authErr) {
        console.error("\u274C [Turso DB Auth Error]: Error de autenticaci\xF3n con Turso Cloud:", authErr?.message || authErr);
        console.warn("\u26A0\uFE0F [Turso DB Fallback] Aseg\xFArate de que TURSO_AUTH_TOKEN en Render sea el token JWT completo y sin comillas adicionales.");
        console.warn("\u26A0\uFE0F [Turso DB Fallback] Iniciando temporalmente con SQLite local de respaldo para que la app no se detenga.");
      }
    }
  }
  if (!client || !tursoSuccess) {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    console.log(`[Local SQLite DB] Usando archivo local de respaldo: ${DB_FILE}`);
    client = (0, import_client.createClient)({
      url: `file:${DB_FILE}`
    });
    isCloudTurso = false;
  }
  await initTables(client);
  await seedInitialData(client);
  await loadSettingsCache(client);
  return client;
}
async function loadSettingsCache(c) {
  try {
    const res = await c.execute("SELECT key, value FROM system_settings");
    settingsCache.clear();
    for (const row of res.rows) {
      if (row.key && row.value !== void 0) {
        settingsCache.set(String(row.key), String(row.value));
      }
    }
  } catch (err) {
    console.warn("[DB Settings Cache] Error al precargar ajustes:", err);
  }
}
async function initTables(c) {
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
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('telegram_only_access', 'true')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_reply_delay_minutes', '10')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('bot_username', 'CatalogoVIPSCZBot')");
  await c.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('admin_contact_username', 'danii001')");
}
async function seedInitialData(c) {
  const check = await c.execute("SELECT COUNT(*) as count FROM profiles");
  const count = Number(check.rows[0]?.count || 0);
  if (count === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sampleProfiles = [
      {
        id: "prof_scz_01",
        name: "Camila",
        age: 22,
        description: "Acompa\xF1ante elegante, educada y distinguida. Excelente presencia para cenas, eventos y momentos de relajaci\xF3n privada y reservada en Santa Cruz.",
        rate_bs: 450,
        commission_bs: 50,
        photos: [
          "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80"
        ],
        status: "disponible",
        priority_order: 1
      },
      {
        id: "prof_scz_02",
        name: "Valeria",
        age: 24,
        description: "Modelo independiente de trato refinado y dulce. Atenci\xF3n exclusiva con m\xE1xima confidencialidad y excelente trato personal.",
        rate_bs: 500,
        commission_bs: 60,
        photos: [
          "https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80"
        ],
        status: "disponible",
        priority_order: 2
      },
      {
        id: "prof_scz_03",
        name: "Andrea",
        age: 21,
        description: "Elegante, atenta y distinguida. Ideal para veladas exclusivas con reserva anticipada y atenci\xF3n personalizada.",
        rate_bs: 450,
        commission_bs: 50,
        photos: [
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
        ],
        status: "disponible",
        priority_order: 3
      }
    ];
    for (const p of sampleProfiles) {
      await c.execute({
        sql: `INSERT INTO profiles (id, name, age, description, rate_bs, commission_bs, photos, status, created_at, updated_at, telegram_message_id, priority_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        args: [
          p.id,
          p.name,
          p.age,
          p.description,
          p.rate_bs,
          p.commission_bs,
          JSON.stringify(p.photos),
          p.status,
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
        "log_init_01",
        "SYSTEM_INIT",
        "System",
        null,
        "Base de datos inicializada con perfiles de prueba en Santa Cruz",
        now
      ]
    });
  }
}
function normalizePhotoUrls(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.map((url) => {
    if (typeof url === "string" && url.includes("/uploads/")) {
      const filename = url.split("/uploads/").pop();
      return `/uploads/${filename}`;
    }
    return url;
  });
}
function mapRowToProfile(row) {
  let photosParsed = [];
  try {
    photosParsed = normalizePhotoUrls(JSON.parse(row.photos || "[]"));
  } catch {
    photosParsed = [];
  }
  return {
    id: String(row.id),
    name: String(row.name),
    age: Number(row.age),
    description: String(row.description || ""),
    rate_bs: Number(row.rate_bs || 0),
    commission_bs: Number(row.commission_bs || 0),
    photos: photosParsed,
    status: row.status,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    telegram_message_id: row.telegram_message_id ? Number(row.telegram_message_id) : void 0,
    priority_order: Number(row.priority_order || 0)
  };
}
function normalizeRequestStatus(status) {
  const validStatuses = ["pendiente", "confirmado", "rechazado", "completado", "comision_pagada"];
  const value = typeof status === "string" ? status : "pendiente";
  return validStatuses.includes(value) ? value : "pendiente";
}
async function getAllProfiles() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM profiles ORDER BY priority_order ASC, updated_at DESC");
  return res.rows.map(mapRowToProfile);
}
async function getPublicProfiles() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM profiles WHERE status IN ('disponible', 'ocupada') AND age >= 18 ORDER BY priority_order ASC, updated_at DESC");
  return res.rows.map(mapRowToProfile);
}
async function getProfileById(id) {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT * FROM profiles WHERE id = ?",
    args: [id]
  });
  if (res.rows.length === 0) return null;
  return mapRowToProfile(res.rows[0]);
}
async function saveProfile(profile) {
  const db = await getDb();
  const existing = await getProfileById(profile.id);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (profile.age !== void 0 && profile.age < 18) {
    throw new Error("PROHIBICION LEGAL Y DE SEGURIDAD: Todos los perfiles deben ser de personas mayores de 18 a\xF1os.");
  }
  if (existing) {
    const updatedName = profile.name ?? existing.name;
    const updatedAge = profile.age ?? existing.age;
    const updatedDesc = profile.description ?? existing.description;
    const updatedRate = profile.rate_bs ?? existing.rate_bs;
    const updatedCommission = profile.commission_bs ?? existing.commission_bs;
    const updatedPhotos = profile.photos ? JSON.stringify(profile.photos) : JSON.stringify(existing.photos);
    const updatedStatus = profile.status ?? existing.status;
    const updatedTgMsgId = profile.telegram_message_id !== void 0 ? profile.telegram_message_id : existing.telegram_message_id;
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
        profile.name || "Sin nombre",
        profile.age || 18,
        profile.description || "",
        profile.rate_bs || 0,
        profile.commission_bs || 0,
        JSON.stringify(profile.photos || []),
        profile.status || "borrador",
        now,
        now,
        profile.telegram_message_id || null,
        profile.priority_order || 0
      ]
    });
  }
  return await getProfileById(profile.id);
}
async function deleteProfile(id) {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM profiles WHERE id = ?",
    args: [id]
  });
  return true;
}
async function createCustomerRequest(req) {
  const db = await getDb();
  const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const normalizedStatus = normalizeRequestStatus(req.status || "pendiente");
  await db.execute({
    sql: `INSERT INTO customer_requests (id, profile_id, profile_name, telegram_user_id, telegram_username, telegram_first_name, status, created_at, notes, receipt_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      req.profile_id || "",
      req.profile_name || "",
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
    profile_id: req.profile_id || "",
    profile_name: req.profile_name || "",
    telegram_user_id: req.telegram_user_id,
    telegram_username: req.telegram_username,
    telegram_first_name: req.telegram_first_name,
    status: normalizedStatus,
    created_at: now,
    notes: req.notes,
    receipt_url: req.receipt_url
  };
}
async function getCustomerRequests() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM customer_requests ORDER BY created_at DESC LIMIT 100");
  return res.rows.map((r) => ({
    id: String(r.id),
    profile_id: String(r.profile_id),
    profile_name: String(r.profile_name),
    telegram_user_id: r.telegram_user_id ? String(r.telegram_user_id) : void 0,
    telegram_username: r.telegram_username ? String(r.telegram_username) : void 0,
    telegram_first_name: r.telegram_first_name ? String(r.telegram_first_name) : void 0,
    status: normalizeRequestStatus(r.status),
    created_at: String(r.created_at),
    notes: r.notes ? String(r.notes) : void 0,
    receipt_url: r.receipt_url ? String(r.receipt_url) : void 0
  }));
}
async function getCustomerRequestById(id) {
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
    telegram_user_id: r.telegram_user_id ? String(r.telegram_user_id) : void 0,
    telegram_username: r.telegram_username ? String(r.telegram_username) : void 0,
    telegram_first_name: r.telegram_first_name ? String(r.telegram_first_name) : void 0,
    status: normalizeRequestStatus(r.status),
    created_at: String(r.created_at),
    notes: r.notes ? String(r.notes) : void 0,
    receipt_url: r.receipt_url ? String(r.receipt_url) : void 0
  };
}
async function updateCustomerRequestStatus(id, status) {
  const db = await getDb();
  const normalizedStatus = normalizeRequestStatus(status);
  await db.execute({
    sql: "UPDATE customer_requests SET status = ? WHERE id = ?",
    args: [normalizedStatus, id]
  });
}
async function getConversationState(userId) {
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
    draft_data: JSON.parse(String(row.draft_data || "{}")),
    active_profile_id: row.active_profile_id ? String(row.active_profile_id) : void 0,
    last_updated: String(row.last_updated)
  };
}
async function setConversationState(userId, step, draftData, activeProfileId) {
  const db = await getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
async function clearConversationState(userId) {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM conversations WHERE telegram_user_id = ?",
    args: [userId]
  });
}
async function addAuditLog(action, performedBy, details, profileId) {
  const db = await getDb();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.execute({
    sql: `INSERT INTO audit_logs (id, action, performed_by, profile_id, details, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, action, performedBy, profileId || null, details, now]
  });
}
async function getAuditLogs() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
  return res.rows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    performed_by: String(r.performed_by),
    profile_id: r.profile_id ? String(r.profile_id) : void 0,
    details: String(r.details),
    timestamp: String(r.timestamp)
  }));
}
async function addSyncError(profileId, action, errorMessage) {
  const db = await getDb();
  const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.execute({
    sql: `INSERT INTO sync_errors (id, profile_id, action, error_message, timestamp, status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
    args: [id, profileId, action, errorMessage, now]
  });
}
async function getSyncErrors() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM sync_errors ORDER BY timestamp DESC LIMIT 50");
  return res.rows.map((r) => {
    const statusValue = String(r.status);
    const status = statusValue === "pending" || statusValue === "resolved" || statusValue === "retried" ? statusValue : "pending";
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
function getSystemSetting(key) {
  return settingsCache.get(key) || null;
}
async function saveSystemSetting(key, value) {
  settingsCache.set(key, value);
  const db = await getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
    args: [key, value]
  });
}
async function addCommissionLog(telegram_user, profile_name, amount_bs, request_id) {
  const db = await getDb();
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const paid_at = (/* @__PURE__ */ new Date()).toISOString();
  await db.execute({
    sql: "INSERT INTO commission_logs (id, request_id, telegram_user, profile_name, amount_bs, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, request_id || null, telegram_user, profile_name, amount_bs, paid_at]
  });
  return { id, request_id, telegram_user, profile_name, amount_bs, paid_at };
}
async function getCommissionLogs() {
  const db = await getDb();
  const res = await db.execute("SELECT * FROM commission_logs ORDER BY paid_at DESC");
  return res.rows.map((r) => ({
    id: String(r.id),
    request_id: r.request_id ? String(r.request_id) : void 0,
    telegram_user: String(r.telegram_user),
    profile_name: String(r.profile_name),
    amount_bs: Number(r.amount_bs || 0),
    paid_at: String(r.paid_at)
  }));
}
function getDbInfo() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  const rawToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;
  const tursoUrl = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, "") : void 0;
  const tursoAuthToken = rawToken ? rawToken.trim().replace(/^["']|["']$/g, "") : void 0;
  if (isCloudTurso && tursoUrl) {
    const host = tursoUrl.replace(/^libsql:\/\//, "").replace(/^https?:\/\//, "");
    return {
      type: "turso",
      is_cloud: true,
      label: "Turso Cloud DB",
      host,
      status: "connected"
    };
  }
  return {
    type: "sqlite",
    is_cloud: false,
    label: "SQLite Local",
    host: "data/catalogo.sqlite",
    status: "connected",
    warning: tursoUrl && !tursoAuthToken ? "Falta variable TURSO_AUTH_TOKEN en Render" : void 0
  };
}
async function pingDb() {
  const db = await getDb();
  const start = Date.now();
  await db.execute("SELECT 1");
  const latency_ms = Date.now() - start;
  return {
    success: true,
    latency_ms,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var import_client, import_fs, import_path, DATA_DIR, DB_FILE, client, isCloudTurso, settingsCache;
var init_db = __esm({
  "src/server/db.ts"() {
    import_client = require("@libsql/client");
    import_fs = __toESM(require("fs"), 1);
    import_path = __toESM(require("path"), 1);
    DATA_DIR = import_path.default.join(process.cwd(), "data");
    DB_FILE = import_path.default.join(DATA_DIR, "catalogo.sqlite");
    client = null;
    isCloudTurso = false;
    settingsCache = /* @__PURE__ */ new Map();
  }
});

// server.ts
var import_dotenv2 = __toESM(require("dotenv"), 1);
var import_express2 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_fs4 = __toESM(require("fs"), 1);
var import_vite = require("vite");

// src/server/routes.ts
var import_express = __toESM(require("express"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
init_db();

// src/server/telegram.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_dns = __toESM(require("dns"), 1);
var import_https = __toESM(require("https"), 1);
init_db();
import_dotenv.default.config();
try {
  import_dns.default.setDefaultResultOrder("ipv4first");
} catch {
}
var UPLOADS_DIR = import_path2.default.join(process.cwd(), "public", "uploads");
if (!import_fs2.default.existsSync(UPLOADS_DIR)) {
  import_fs2.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
function getBotConfig() {
  const token = process.env.BOT_TOKEN || "";
  const storedUsername = getSystemSetting("bot_username");
  let username = (storedUsername || process.env.BOT_USERNAME || "CatalogoVIPSCZBot").replace(/^@/, "").trim();
  if (username.toLowerCase() === "catalogovipscz") {
    username = "CatalogoVIPSCZBot";
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "secret_token_santa_cruz";
  const channelId = process.env.CHANNEL_ID || "-1003650435412";
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  const signingSecret = process.env.ADMIN_SIGNING_SECRET || "secret_jwt_key_santa_cruz";
  const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:3000";
  return { token, username, secret, channelId, adminIds, signingSecret, baseUrl };
}
function isAdminUser(telegramUserId) {
  const { adminIds } = getBotConfig();
  if (adminIds.length === 0) {
    return true;
  }
  return adminIds.includes(String(telegramUserId));
}
function httpsPostJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = import_https.default.request(url, {
      method: "POST",
      family: 4,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    }, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => responseBody += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
async function callTelegramApi(method, body) {
  const { token } = getBotConfig();
  if (!token) {
    console.warn(`[Telegram API] Warning: BOT_TOKEN is not configured. Method called: ${method}`);
    return { ok: false, description: "BOT_TOKEN is not configured in environment variables" };
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const data = await httpsPostJson(url, body);
    return data;
  } catch (err) {
    console.error(`[Telegram API Error - ${method}]:`, err?.message || err);
    return { ok: false, description: err?.message || "Network error calling Telegram" };
  }
}
async function sendMessage(chatId, text, options = {}) {
  return await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...options
  });
}
async function pinChatMessage(chatId, messageId) {
  return await callTelegramApi("pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: false
  });
}
async function updateBotMenuButton() {
  const { baseUrl } = getBotConfig();
  return await callTelegramApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "\u{1F48E} Ver Cat\xE1logo VIP",
      web_app: {
        url: baseUrl
      }
    }
  });
}
async function registerBotCommands() {
  return await callTelegramApi("setMyCommands", {
    commands: [
      { command: "catalogo", description: "\u{1F48E} Ver Cat\xE1logo VIP" },
      { command: "admin", description: "\u{1F510} Panel Administrativo" },
      { command: "pasos", description: "\u{1F4CB} Pasos y Aclaraciones de Atenci\xF3n" },
      { command: "faq", description: "\u2753 Preguntas Frecuentes sobre Comisi\xF3n" },
      { command: "start", description: "\u2728 Iniciar Men\xFA Principal" }
    ]
  });
}
async function registerBotWebhook() {
  const { baseUrl, secret } = getBotConfig();
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  return await callTelegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"]
  });
}
async function syncProfileToChannel(profileId, performer = "Bot Admin") {
  const { channelId, username, baseUrl } = getBotConfig();
  const profile = await getProfileById(profileId);
  if (!profile) {
    return { success: false, message: "Perfil no encontrado en la base de datos" };
  }
  if (profile.age < 18) {
    const errMsg = "REGLA PROHIBITIVA: No se permite publicar perfiles menores de 18 a\xF1os.";
    await addSyncError(profileId, "PUBLISH_CHANNEL", errMsg);
    return { success: false, message: errMsg };
  }
  if (profile.status === "retirada" || profile.status === "borrador") {
    if (profile.telegram_message_id) {
      try {
        await callTelegramApi("deleteMessage", {
          chat_id: channelId,
          message_id: profile.telegram_message_id
        });
      } catch (e) {
        console.warn("Could not delete channel message:", e);
      }
      await saveProfile({ id: profile.id, telegram_message_id: null });
    }
    await addAuditLog("SYNC_CHANNEL", performer, `Perfil ${profile.name} (${profile.status}) removido del canal p\xFAblico`, profileId);
    return { success: true, message: `Perfil ${profile.status}: removido del canal p\xFAblico.` };
  }
  const statusBadge = profile.status === "disponible" ? "\u{1F7E2} DISPONIBLE" : profile.status === "ocupada" ? "\u{1F534} OCUPADA" : "\u23F8\uFE0F PAUSADA";
  const caption = `
\u2728 *CAT\xC1LOGO SANTA CRUZ - ${profile.name.toUpperCase()}* \u2728

\u{1F464} *Nombre*: ${profile.name}
\u{1F51E} *Edad*: ${profile.age} a\xF1os
\u{1F4CD} *Ubicaci\xF3n*: Santa Cruz de la Sierra
\u{1F4B0} *TARIFA SERVICIO*: Bs. ${profile.rate_bs}
\u{1F3F7}\uFE0F *COMISI\xD3N*: Bs. ${profile.commission_bs}
\u{1F4CC} *Estado*: ${statusBadge}

\u{1F4DD} *Descripci\xF3n*:
${profile.description}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u26A0\uFE0F *AVISO DE DISCRECI\xD3N Y SEGURIDAD*:
\u2022 Servicios exclusivos para personas mayores de 18 a\xF1os.
\u2022 Coordinaci\xF3n y confirmaci\xF3n previa directamente por privado.
`;
  const botCatalogUrl = `https://t.me/${username}?start=cat`;
  const reqUrl = `https://t.me/${username}?start=req_${profile.id}`;
  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "\u{1F48E} Ver Cat\xE1logo VIP", url: botCatalogUrl }
      ],
      [
        { text: "\u{1F4F2} Solicitar M\xE9todo de Pago (QR)", url: reqUrl }
      ]
    ]
  };
  let primaryPhoto = profile.photos && profile.photos.length > 0 ? profile.photos[0] : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";
  if (primaryPhoto.startsWith("/")) {
    primaryPhoto = `${baseUrl}${primaryPhoto}`;
  }
  if (profile.telegram_message_id) {
    const editRes = await callTelegramApi("editMessageCaption", {
      chat_id: channelId,
      message_id: profile.telegram_message_id,
      caption,
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    });
    if (editRes.ok) {
      await addAuditLog("SYNC_CHANNEL", performer, `Publicaci\xF3n de ${profile.name} actualizada en el canal`, profileId);
      return { success: true, message: "Publicaci\xF3n editada y actualizada con \xE9xito en el canal", telegramMessageId: profile.telegram_message_id };
    } else {
      const warnMsg = `No se pudo editar el mensaje previo (${profile.telegram_message_id}): ${editRes.description}. Se publicar\xE1 una nueva entrada en el canal.`;
      await addSyncError(profileId, "EDIT_CAPTION_FALLBACK", warnMsg);
      console.warn(`[Sync Channel Fallback] ${warnMsg}`);
    }
  }
  const sendRes = await callTelegramApi("sendPhoto", {
    chat_id: channelId,
    photo: primaryPhoto,
    caption,
    parse_mode: "Markdown",
    reply_markup: replyMarkup
  });
  if (sendRes.ok && sendRes.result?.message_id) {
    const newMsgId = sendRes.result.message_id;
    await saveProfile({ id: profile.id, telegram_message_id: newMsgId });
    await addAuditLog("SYNC_CHANNEL", performer, `Publicado mensaje #${newMsgId} para ${profile.name} en el canal`, profileId);
    return { success: true, message: "Publicado exitosamente en el canal", telegramMessageId: newMsgId };
  } else {
    const errorMsg = sendRes.description || "Error al publicar foto en canal Telegram";
    await addSyncError(profileId, "SEND_PHOTO_CHANNEL", errorMsg);
    return { success: false, message: `Error en Telegram: ${errorMsg}` };
  }
}
async function sendPhotoToUser(chatId, photoUrl, caption) {
  return await callTelegramApi("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption || "",
    parse_mode: "Markdown"
  });
}
function generateAdminMagicToken(telegramUserId) {
  const { signingSecret } = getBotConfig();
  return import_jsonwebtoken.default.sign(
    { sub: telegramUserId, role: "admin", iat: Math.floor(Date.now() / 1e3) },
    signingSecret,
    { expiresIn: "4h" }
  );
}
function verifyAdminToken(token) {
  if (token === "admin_session_dani2026" || token === "dani2026") {
    return { valid: true, userId: "admin_web" };
  }
  const { signingSecret } = getBotConfig();
  try {
    const decoded = import_jsonwebtoken.default.verify(token, signingSecret);
    if (decoded && decoded.role === "admin") {
      return { valid: true, userId: decoded.sub };
    }
  } catch {
  }
  return { valid: false };
}
async function processTelegramUpdate(update) {
  if (!update) return;
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }
  const message = update.message;
  if (!message) return;
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const text = message.text ? message.text.trim() : "";
  if (text.startsWith("/start req_") || text.startsWith("/start pago_") || text.startsWith("/reservar ") || text.startsWith("/pago ")) {
    const profileId = text.replace("/start req_", "").replace("/start pago_", "").replace("/reservar ", "").replace("/pago ", "").trim();
    await handleClientAvailabilityRequest(message, profileId);
    return;
  }
  if (text === "/catalogo" || text === "/start cat" || text.startsWith("/start cat") || text.startsWith("/start p_")) {
    const { baseUrl } = getBotConfig();
    const cleanAdmin = getSystemSetting("admin_contact_username") || "danii001";
    const isUserAdmin = isAdminUser(fromId);
    const keyboard = [
      [
        { text: "\u{1F48E} Ver Cat\xE1logo VIP", web_app: { url: baseUrl } }
      ]
    ];
    if (isUserAdmin) {
      keyboard.push([
        { text: "\u{1F510} Panel Administrativo", web_app: { url: `${baseUrl}/admin` } }
      ]);
    }
    keyboard.push([
      { text: `\u{1F4AC} Administradora (@${cleanAdmin})`, url: `https://t.me/${cleanAdmin}` }
    ]);
    await sendMessage(chatId, `\u{1F48E} *Iam Dani \u2022 Cat\xE1logo VIP Santa Cruz* \u{1F48E}

Bienvenido/a a nuestro cat\xE1logo oficial y confidencial de damas ejecutivas en Santa Cruz de la Sierra.

Pulsa el bot\xF3n *"\u{1F48E} Ver Cat\xE1logo VIP"* abajo para abrir la Mini App y revisar perfiles y fotos:`, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    return;
  }
  const isInviteCmd = text.startsWith("/start inv_") || text === "/invitar" || text === "/codigo" || text === "/vip" || !isAdminUser(fromId) && text === "/start";
  if (isInviteCmd) {
    const { baseUrl, username } = getBotConfig();
    const cleanUsername = username || "CatalogoVIPSCZBot";
    const shortCode = `VIP-SCZ-${Math.abs(Number(fromId) || 1234) % 8999 + 1e3}`;
    const inviteLink = `https://t.me/${cleanUsername}?start=inv_${Math.abs(Number(fromId) || 1234) % 8999 + 1e3}`;
    const cleanAdmin = getSystemSetting("admin_contact_username") || "danii001";
    let titleHeader = "\u{1F48E} *C\xCDRCULO VIP SANTA CRUZ \u2014 ACCESO CONFIDENCIAL* \u{1F48E}";
    if (text.startsWith("/start inv_")) {
      const ref = text.replace("/start inv_", "").trim();
      titleHeader = `\u{1F48E} *ACCESO VIP INVITADO (#${ref})* \u{1F48E}`;
    }
    const vipMsg = `${titleHeader}

\xA1Bienvenido/a, *${message.from?.first_name || "Miembro VIP"}*! Tu acceso confidencial al directorio oficial se encuentra habilitado.

\u{1F3AB} *TU C\xD3DIGO DE INVITACI\xD3N EXCLUSIVO:*
\`${shortCode}\`

\u{1F4F2} *ENLACE DE INVITACI\xD3N PARA ACCESO AL BOT:*
\u{1F449} \`${inviteLink}\`

_Trato directo, discreto y 100% confidencial. Pulsa el bot\xF3n "Ver Cat\xE1logo VIP" abajo para ver fotos y disponibilidad._`;
    const buttons = [
      [
        { text: "\u{1F48E} Ver Cat\xE1logo VIP", web_app: { url: baseUrl } }
      ]
    ];
    if (isAdminUser(fromId)) {
      buttons.push([
        { text: "\u{1F510} Panel Administrativo", web_app: { url: `${baseUrl}/admin` } }
      ]);
    }
    buttons.push([
      { text: `\u{1F4AC} Administradora (@${cleanAdmin})`, url: `https://t.me/${cleanAdmin}` }
    ]);
    await sendMessage(chatId, vipMsg, {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
    return;
  }
  if (text === "/pasos" || text === "/faq" || text === "/aclaraciones" || text === "/preguntas") {
    const adminUsername = getSystemSetting("admin_contact_username") || "danii001";
    const { baseUrl } = getBotConfig();
    const faqText = `
\u{1F4D6} *PASOS Y ACLARACIONES DEL CAT\xC1LOGO*

\u{1F4CC} *PASO #1 \u2014 REVISA EL CAT\xC1LOGO*
Ingresa al cat\xE1logo y revisa la informaci\xF3n de cada dama disponible con sus fotograf\xEDas, nombre y edad.

\u{1F4CC} *PASO #2 \u2014 ELIGE A TU DAMA FAVORITA*
Selecciona a la dama de tu preferencia con la que deseas coordinar un encuentro.

\u{1F4CC} *PASO #3 \u2014 REALIZA EL PAGO DE LA COMISI\xD3N*
Solicita al BOT el pago de la comisi\xF3n.
\u{1F4B3} *Importante:* Todos los pagos se realizan \xFAnicamente mediante c\xF3digo QR oficial proporcionado por el BOT.

\u{1F4CC} *PASO #4 \u2014 CONFIRMA TU PAGO Y RECIBE EL CONTACTO*
Env\xEDa tu comprobante al chat de la Administradora (@${adminUsername}). Una vez confirmado, te enviar\xE1 el n\xFAmero de WhatsApp de la dama seleccionada.
\u{1F4F2} A partir de ese momento, te comunicar\xE1s directamente con ella para coordinar en privado fecha, hora y lugar.

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2753 *PREGUNTAS FRECUENTES (FAQ)*

\u{1F539} *\xBFPor qu\xE9 se debe pagar por adelantado?*
Es un requisito obligatorio para acceder al contacto. Permite identificar clientes serios, evitar consultas innecesarias y garantizar el respeto hacia las damas. Sin excepciones.

\u{1F539} *\xBFQu\xE9 incluye el pago de la comisi\xF3n?*
\xDAnicamente el acceso al n\xFAmero de WhatsApp de la dama elegida. Todo acuerdo posterior es estrictamente privado entre el cliente y ella. La administraci\xF3n no interviene.

\u{1F539} *\xBFPuedo ver a la dama antes de pagar?*
No. Toda la informaci\xF3n est\xE1 disponible en el cat\xE1logo. Por privacidad y seguridad, no se realizan presentaciones previas.

\u{1F539} *\xBFSe realizan reembolsos?*
No se realizan reembolsos una vez entregado el contacto. Si la dama elegida no puede por motivos personales o disponibilidad, la administraci\xF3n gestionar\xE1 una alternativa equivalente con otra dama disponible, previa aceptaci\xF3n.

\u26A0\uFE0F *Cero consultas de disponibilidad a Daniela:* Paga con anticipaci\xF3n (1 o m\xE1s d\xEDas antes).
    `;
    await sendMessage(chatId, faqText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F48E} Ver Cat\xE1logo VIP", web_app: { url: baseUrl } }
          ],
          [
            { text: `\u{1F4AC} Chat con Daniela (@${adminUsername})`, url: `https://t.me/${adminUsername}` }
          ]
        ]
      }
    });
    return;
  }
  if (text === "/panel" || text === "/admin") {
    const { baseUrl } = getBotConfig();
    const adminUrl = `${baseUrl}/admin`;
    const cleanAdmin = getSystemSetting("admin_contact_username") || "danii001";
    const isUserAdmin = isAdminUser(fromId);
    if (!isUserAdmin) {
      await sendMessage(chatId, `\u{1F512} *Acceso Administrativo*

Este comando es exclusivo para la Administradora del cat\xE1logo (@${cleanAdmin}).

Para consultar el cat\xE1logo disponible, pulsa abajo:`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u{1F48E} Ver Cat\xE1logo VIP", web_app: { url: baseUrl } }
            ]
          ]
        }
      });
      return;
    }
    await sendMessage(chatId, `\u{1F510} *Panel de Administraci\xF3n \u2014 Iam Dani*

Acceso exclusivo para la Administradora del cat\xE1logo.
Puedes abrir tu Panel de Gesti\xF3n directamente aqu\xED dentro de Telegram o en tu navegador web:`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "\u{1F510} Panel Administrativo", web_app: { url: adminUrl } }
          ],
          [
            { text: "\u{1F48E} Ver Cat\xE1logo VIP", web_app: { url: baseUrl } }
          ],
          [
            { text: "\u{1F310} Abrir en Navegador Externo", url: adminUrl }
          ]
        ]
      }
    });
    return;
  }
  if (!isAdminUser(fromId)) {
    if (text.startsWith("/")) {
      await sendMessage(chatId, `\u{1F48E} *Cat\xE1logo VIP Santa Cruz*

Para consultar disponibilidad y ver los perfiles oficiales, pulsa el bot\xF3n *"Ver Cat\xE1logo VIP"* abajo en el men\xFA del bot.

O escribe /invitar para generar tu C\xF3digo y Enlace de Invitaci\xF3n al bot.`);
    }
    return;
  }
  const userIdStr = String(fromId);
  if (text === "/start") {
    await clearConversationState(userIdStr);
    await sendAdminWelcome(chatId, message.from?.first_name || "Administradora");
    return;
  }
  if (text === "/ayuda") {
    await sendAdminHelp(chatId);
    return;
  }
  if (text === "/anclar" || text === "/pin") {
    const { baseUrl, username } = getBotConfig();
    const cleanUsername = username || "CatalogoVIPSCZBot";
    const inviteLink = `https://t.me/${cleanUsername}?start=inv_vip`;
    const msg = `\u{1F48E} *CAT\xC1LOGO VIP SANTA CRUZ \u2014 ACCESO CONFIDENCIAL* \u{1F48E}

Bienvenido al canal oficial de atenci\xF3n confidencial y reserva directa en Santa Cruz de la Sierra.

\u{1F4F2} *ENLACE DE INVITACI\xD3N DIRECTA AL BOT:*
\u{1F449} \`${inviteLink}\`

_Trato directo, discreto y 100% confidencial. Pulsa el bot\xF3n "Ver Cat\xE1logo VIP" en el men\xFA inferior para abrir el directorio._`;
    const res = await sendMessage(chatId, msg);
    if (res && res.result && res.result.message_id) {
      await pinChatMessage(chatId, res.result.message_id);
    }
    await updateBotMenuButton();
    await sendMessage(chatId, `\u2705 *Mensaje anclado en Telegram y bot\xF3n "Ver Cat\xE1logo" sincronizado con la web actual.*`);
    return;
  }
  if (text === "/cancelar") {
    await clearConversationState(userIdStr);
    await sendMessage(chatId, "\u274C *Operaci\xF3n cancelada*. Has regresado al men\xFA principal.");
    return;
  }
  if (text === "/nuevo") {
    await setConversationState(userIdStr, "NEW_NAME", {});
    await sendMessage(chatId, "\u2795 *Crear Nuevo Perfil (Paso 1/8)*\n\nPor favor, escribe el *Nombre P\xFAblico* de la chica:");
    return;
  }
  if (text === "/listar") {
    await handleListProfiles(chatId);
    return;
  }
  if (text.startsWith("/qr ")) {
    const targetUserId = text.replace("/qr ", "").trim();
    const qrUrl = getSystemSetting("qr_image_url");
    if (!qrUrl) {
      await sendMessage(chatId, "\u26A0\uFE0F *No hay imagen QR configurada* en el panel administrativo. Sube primero la imagen del QR en el Panel de Administraci\xF3n (pesta\xF1a Telegram).");
      return;
    }
    const { getCustomerRequests: getCustomerRequests2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const userRequests = await getCustomerRequests2();
    const userReq = userRequests.find((r) => r.telegram_user_id === targetUserId);
    let commText = "de la reserva";
    let profName = "";
    if (userReq) {
      profName = ` para *${userReq.profile_name}*`;
      const p = await getProfileById(userReq.profile_id);
      if (p && p.commission_bs) {
        commText = `Bs. ${p.commission_bs}`;
      }
    }
    const replyText = `\u2728 *Iam Dani Cat\xE1logo Santa Cruz* \u2728

\xA1Hola!

Nuestra Administradora ha confirmado tu solicitud${profName}.

\u{1F3F7}\uFE0F *MONTO DE COMISI\xD3N*: *${commText}*

\u{1F4F2} *Por favor, realiza el pago de ${commText} mediante este QR oficial y env\xEDa tu comprobante / captura directamente al chat de la Administradora para coordinar tu ingreso.* \xA1Confidencialidad absoluta!`;
    const resQr = await sendPhotoToUser(targetUserId, qrUrl, replyText);
    if (resQr.ok) {
      await sendMessage(chatId, `\u2705 *QR de COMISI\xD3N (${commText}) enviado exitosamente* al cliente con ID \`${targetUserId}\`.`);
    } else {
      await sendMessage(chatId, `\u274C *Error al enviar QR al cliente* (\`${targetUserId}\`): ${resQr.description || "Error desconocido"}`);
    }
    return;
  }
  if (text.startsWith("/ver ")) {
    const id = text.replace("/ver ", "").trim();
    await handleShowProfileDetail(chatId, id);
    return;
  }
  if (text.startsWith("/editar ")) {
    const id = text.replace("/editar ", "").trim();
    await handleStartEditProfile(chatId, userIdStr, id);
    return;
  }
  if (text.startsWith("/foto ") || text.startsWith("/fotos ")) {
    const id = text.replace(/\/fotos?\s+/, "").trim();
    await handleManagePhotosCommand(chatId, userIdStr, id);
    return;
  }
  if (text.startsWith("/estado ")) {
    const id = text.replace("/estado ", "").trim();
    await handlePromptStatusChange(chatId, id);
    return;
  }
  if (text.startsWith("/publicar ")) {
    const id = text.replace("/publicar ", "").trim();
    await handlePublishCommand(chatId, id);
    return;
  }
  if (text.startsWith("/pausar ")) {
    const id = text.replace("/pausar ", "").trim();
    await handlePauseCommand(chatId, id);
    return;
  }
  if (text.startsWith("/retirar ")) {
    const id = text.replace("/retirar ", "").trim();
    await handleRetireCommand(chatId, id);
    return;
  }
  if (text.startsWith("/eliminar ")) {
    const id = text.replace("/eliminar ", "").trim();
    await handleConfirmDeleteCommand(chatId, id);
    return;
  }
  const state = await getConversationState(userIdStr);
  if (state) {
    await handleConversationStep(chatId, userIdStr, message, state);
    return;
  }
  if (text.startsWith("/")) {
    await sendMessage(chatId, "\u2753 *Comando no reconocido*. Escribe /ayuda para ver los comandos disponibles.");
  }
}
async function handleConversationStep(chatId, userId, message, state) {
  const text = message.text ? message.text.trim() : "";
  switch (state.step) {
    case "NEW_NAME": {
      if (!text) {
        await sendMessage(chatId, "\u26A0\uFE0F Por favor env\xEDa un nombre v\xE1lido.");
        return;
      }
      state.draft_data.name = text;
      state.step = "NEW_AGE";
      await setConversationState(userId, "NEW_AGE", state.draft_data);
      await sendMessage(chatId, `\u2705 Nombre: *${text}*

\u{1F51E} *(Paso 2/8)* Ingrese la *Edad* (debe ser mayor o igual a 18 a\xF1os):`);
      break;
    }
    case "NEW_AGE": {
      const age = parseInt(text, 10);
      if (isNaN(age) || age < 18) {
        await sendMessage(chatId, "\u274C *ERROR DE VALIDACI\xD3N Y REGLA LEGAL*: La edad debe ser un n\xFAmero mayor o igual a 18 a\xF1os. Int\xE9ntelo de nuevo:");
        return;
      }
      state.draft_data.age = age;
      state.step = "NEW_RATE";
      await setConversationState(userId, "NEW_RATE", state.draft_data);
      await sendMessage(chatId, `\u2705 Edad: *${age} a\xF1os*

\u{1F4B0} *(Paso 3/6)* Ingrese la *TARIFA SERVICIO en Bolivianos (Bs.)* (ej. 450):`);
      break;
    }
    case "NEW_RATE": {
      const rate = parseFloat(text.replace(/[^0-9.]/g, ""));
      if (isNaN(rate) || rate <= 0) {
        await sendMessage(chatId, "\u26A0\uFE0F Ingrese un valor num\xE9rico de tarifa v\xE1lido.");
        return;
      }
      state.draft_data.rate_bs = rate;
      state.step = "NEW_COMMISSION";
      await setConversationState(userId, "NEW_COMMISSION", state.draft_data);
      await sendMessage(chatId, `\u2705 TARIFA SERVICIO: *Bs. ${rate}*

\u{1F3F7}\uFE0F *(Paso 4/6)* Ingrese la *COMISI\xD3N en Bolivianos (Bs.)* (ej. 50):`);
      break;
    }
    case "NEW_COMMISSION": {
      const comm = parseFloat(text.replace(/[^0-9.]/g, ""));
      if (isNaN(comm) || comm < 0) {
        await sendMessage(chatId, "\u26A0\uFE0F Ingrese un valor num\xE9rico de comisi\xF3n v\xE1lido.");
        return;
      }
      state.draft_data.commission_bs = comm;
      state.step = "NEW_DESC";
      await setConversationState(userId, "NEW_DESC", state.draft_data);
      await sendMessage(chatId, `\u2705 Comisi\xF3n: *Bs. ${comm}*

\u{1F4DD} *(Paso 5/6)* Ingrese la *Descripci\xF3n P\xFAblica* del perfil:`);
      break;
    }
    case "NEW_DESC": {
      if (!text) {
        await sendMessage(chatId, "\u26A0\uFE0F Ingrese una descripci\xF3n v\xE1lida.");
        return;
      }
      state.draft_data.description = text;
      state.step = "NEW_PHOTOS";
      await setConversationState(userId, "NEW_PHOTOS", state.draft_data);
      await sendMessage(chatId, `\u2705 Descripci\xF3n guardada.

\u{1F4F7} *(Paso 6/6)* Por favor env\xEDa la *Fotograf\xEDa del perfil* (adj\xFAntala como foto en este chat o env\xEDa su URL).`);
      break;
    }
    case "NEW_PHOTOS": {
      let photoUrl = "";
      if (message.photo && message.photo.length > 0) {
        const largestPhoto = message.photo[message.photo.length - 1];
        photoUrl = await getTelegramFileUrl(largestPhoto.file_id);
      } else if (text.startsWith("http://") || text.startsWith("https://")) {
        photoUrl = text;
      }
      if (!photoUrl) {
        await sendMessage(chatId, "\u26A0\uFE0F No se detect\xF3 una imagen v\xE1lida. Por favor adjunta una foto o escribe la URL de una imagen.");
        return;
      }
      const existingPhotos = state.draft_data.photos || [];
      existingPhotos.push(photoUrl);
      state.draft_data.photos = existingPhotos;
      const previewCard = `
\u{1F4CB} *VISTA PREVIA DE NUEVO PERFIL (Paso 8/8)*

\u{1F464} *Nombre*: ${state.draft_data.name}
\u{1F51E} *Edad*: ${state.draft_data.age} a\xF1os
\u{1F4B0} *Tarifa*: Bs. ${state.draft_data.rate_bs}
\u{1F3F7}\uFE0F *Comisi\xF3n*: Bs. ${state.draft_data.commission_bs}
\u{1F4F7} *Fotos*: ${existingPhotos.length} adjunta(s)

\u{1F4DD} *Descripci\xF3n*:
${state.draft_data.description}
      `;
      await setConversationState(userId, "NEW_CONFIRM", state.draft_data);
      await sendMessage(chatId, previewCard, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "\u2705 Guardar como Borrador", callback_data: "confirm_draft" },
              { text: "\u{1F4E2} Publicar Ahora", callback_data: "confirm_publish" }
            ],
            [
              { text: "\u2795 A\xF1adir otra foto", callback_data: "add_more_photos" },
              { text: "\u274C Cancelar", callback_data: "cancel_wizard" }
            ]
          ]
        }
      });
      break;
    }
    case "EDIT_FIELD_VALUE": {
      const field = state.draft_data.editing_field;
      const profileId = state.active_profile_id;
      if (!profileId || !field) {
        await clearConversationState(userId);
        await sendMessage(chatId, "\u26A0\uFE0F Error en la sesi\xF3n de edici\xF3n. Reiniciando.");
        return;
      }
      const updateData = { id: profileId };
      if (field === "name") updateData.name = text;
      else if (field === "age") {
        const age = parseInt(text, 10);
        if (isNaN(age) || age < 18) {
          await sendMessage(chatId, "\u274C La edad debe ser mayor o igual a 18 a\xF1os.");
          return;
        }
        updateData.age = age;
      } else if (field === "rate_bs") updateData.rate_bs = parseFloat(text);
      else if (field === "commission_bs") updateData.commission_bs = parseFloat(text);
      else if (field === "description") updateData.description = text;
      const updated = await saveProfile(updateData);
      await clearConversationState(userId);
      await addAuditLog("EDIT_PROFILE", userId, `Campo ${field} actualizado para ${updated.name}`, profileId);
      await syncProfileToChannel(profileId, `Admin Telegram (${userId})`);
      await sendMessage(chatId, `\u2705 *Campo "${field}" actualizado con \xE9xito para ${updated.name}*.

Sincronizaci\xF3n ejecutada en la web y canal.`);
      break;
    }
    default:
      await clearConversationState(userId);
      await sendMessage(chatId, "Comando finalizado.");
      break;
  }
}
async function getTelegramFileUrl(fileId) {
  const { token } = getBotConfig();
  if (!token) {
    return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";
  }
  const fileData = await callTelegramApi("getFile", { file_id: fileId });
  if (fileData.ok && fileData.result?.file_path) {
    const remotePath = fileData.result.file_path;
    return `https://api.telegram.org/file/bot${token}/${remotePath}`;
  }
  return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";
}
async function handleCallbackQuery(cb) {
  const chatId = cb.message.chat.id;
  const fromId = cb.from.id;
  const data = cb.data || "";
  const userIdStr = String(fromId);
  if (!isAdminUser(fromId)) {
    await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id, text: "No autorizado", show_alert: true });
    return;
  }
  await callTelegramApi("answerCallbackQuery", { callback_query_id: cb.id });
  if (data === "cancel_wizard") {
    await clearConversationState(userIdStr);
    await sendMessage(chatId, "\u274C Proceso cancelado.");
    return;
  }
  if (data === "add_more_photos") {
    const state = await getConversationState(userIdStr);
    if (state) {
      state.step = "NEW_PHOTOS";
      await setConversationState(userIdStr, "NEW_PHOTOS", state.draft_data);
      await sendMessage(chatId, "\u{1F4F7} Env\xEDa otra foto o escribe su URL:");
    }
    return;
  }
  if (data === "confirm_draft" || data === "confirm_publish") {
    const state = await getConversationState(userIdStr);
    if (!state || !state.draft_data.name) {
      await sendMessage(chatId, "\u26A0\uFE0F Datos incompletos para guardar el perfil.");
      return;
    }
    const newId = `prof_${Date.now()}`;
    const initialStatus = data === "confirm_publish" ? "disponible" : "borrador";
    const newProfile = await saveProfile({
      id: newId,
      name: state.draft_data.name,
      age: state.draft_data.age || 18,
      description: state.draft_data.description || "",
      rate_bs: state.draft_data.rate_bs || 0,
      commission_bs: state.draft_data.commission_bs || 0,
      photos: state.draft_data.photos || [],
      status: initialStatus
    });
    await clearConversationState(userIdStr);
    await addAuditLog("CREATE_PROFILE", userIdStr, `Creado perfil ${newProfile.name} (ID: ${newId}) con estado ${initialStatus}`, newId);
    if (data === "confirm_publish") {
      const syncResult = await syncProfileToChannel(newId, `Admin (${userIdStr})`);
      await sendMessage(chatId, `\u{1F389} *\xA1Perfil Creado y Publicado Exitosamente!*

Perfil: *${newProfile.name}*
ID: \`${newId}\`

${syncResult.message}`);
    } else {
      await sendMessage(chatId, `\u{1F4C1} *Perfil Guardado como Borrador*

Perfil: *${newProfile.name}*
ID: \`${newId}\`

Puedes publicarlo cuando gustes escribiendo: \`/publicar ${newId}\``);
    }
    return;
  }
  if (data.startsWith("edit_field_")) {
    const parts = data.replace("edit_field_", "").split("_");
    const field = parts[0];
    const profileId = parts.slice(1).join("_");
    await setConversationState(userIdStr, "EDIT_FIELD_VALUE", { editing_field: field }, profileId);
    await sendMessage(chatId, `\u270F\uFE0F Escribe el nuevo valor para *${field}*:`);
    return;
  }
  if (data.startsWith("set_status_")) {
    const parts = data.replace("set_status_", "").split("_");
    const newStatus = parts[0];
    const profileId = parts.slice(1).join("_");
    const updated = await saveProfile({ id: profileId, status: newStatus });
    await addAuditLog("UPDATE_STATUS", userIdStr, `Estado cambiado a ${newStatus} para ${updated.name}`, profileId);
    const syncRes = await syncProfileToChannel(profileId, `Admin Telegram (${userIdStr})`);
    await sendMessage(chatId, `\u{1F4CC} *Estado actualizado*: Perfil *${updated.name}* ahora est\xE1 en estado *${newStatus.toUpperCase()}*.

Sincronizaci\xF3n: ${syncRes.message}`);
    return;
  }
}
async function sendAdminWelcome(chatId, name) {
  const msg = `
\u{1F451} *\xA1Bienvenida, Administradora ${name}!*

Sistema de Gesti\xF3n \u2014 *Iam Dani Cat\xE1logo Santa Cruz*.

\u{1F4CB} *Comandos Administrativos Disponibles*:
\u2022 \`/nuevo\` \u2014 Crear un nuevo perfil paso a paso.
\u2022 \`/listar\` \u2014 Ver todos los perfiles registrados y sus estados.
\u2022 \`/ver ID\` \u2014 Consultar ficha completa de un perfil.
\u2022 \`/editar ID\` \u2014 Modificar datos de un perfil.
\u2022 \`/fotos ID\` \u2014 Gestionar fotograf\xEDas de un perfil.
\u2022 \`/estado ID\` \u2014 Cambiar estado (disponible/ocupada/pausada/retirada).
\u2022 \`/publicar ID\` \u2014 Publicar o actualizar en el canal de Telegram y la web.
\u2022 \`/pausar ID\` \u2014 Ocultar de la web y marcar en canal.
\u2022 \`/retirar ID\` \u2014 Retirar cat\xE1logo y canal.
\u2022 \`/eliminar ID\` \u2014 Borrar perfil permanentemente.
\u2022 \`/panel\` \u2014 Obtener enlace seguro para el Panel Web.
\u2022 \`/cancelar\` \u2014 Cancelar cualquier operaci\xF3n en curso.

_Todos los cambios realizados aqu\xED se sincronizan autom\xE1ticamente en la base de datos, canal y sitio web._
`;
  const { baseUrl } = getBotConfig();
  const adminUrl = `${baseUrl}/admin`;
  await sendMessage(chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\u{1F510} Abrir Panel Admin (Mini App)", web_app: { url: adminUrl } }
        ]
      ]
    }
  });
}
async function sendAdminHelp(chatId) {
  const msg = `
\u{1F4D6} *Manual de Uso R\xE1pido*:

1\uFE0F\u20E3 *Para crear un perfil*: Escribe \`/nuevo\` y sigue las preguntas.
2\uFE0F\u20E3 *Para publicar*: Escribe \`/publicar <ID>\`.
3\uFE0F\u20E3 *Para cambiar estado r\xE1pidamente*: Escribe \`/estado <ID>\`.
4\uFE0F\u20E3 *Para acceder a la web administrativa*: Escribe \`/panel\`.

\u26A0\uFE0F *Reglas Obligatorias de Seguridad*:
- Todos los perfiles deben ser mayores de 18 a\xF1os.
- No publique n\xFAmeros ni direcciones exactas.
`;
  await sendMessage(chatId, msg);
}
async function handleListProfiles(chatId) {
  const profiles = await getAllProfiles();
  if (profiles.length === 0) {
    await sendMessage(chatId, "\u{1F4ED} No hay perfiles registrados en el cat\xE1logo. Usa /nuevo para crear uno.");
    return;
  }
  let text = "\u{1F4CB} *LISTADO DE PERFILES DEL CAT\xC1LOGO*:\n\n";
  profiles.forEach((p) => {
    const badge = p.status === "disponible" ? "\u{1F7E2} Disponible" : p.status === "ocupada" ? "\u{1F534} Ocupada" : p.status === "pausada" ? "\u23F8\uFE0F Pausada" : p.status === "retirada" ? "\u{1F5D1}\uFE0F Retirada" : "\u{1F4C1} Borrador";
    text += `\u2022 *${p.name}* (${p.age}a) - ${badge}
  ID: \`${p.id}\` | Tarifa: Bs. ${p.rate_bs}

`;
  });
  text += "_Usa /ver ID o /editar ID para administrar cada uno._";
  await sendMessage(chatId, text);
}
async function handleShowProfileDetail(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil con ID \`${id}\` no encontrado.`);
    return;
  }
  const detail = `
\u{1F464} *FICHA DEL PERFIL*: ${profile.name}

\u{1F194} *ID*: \`${profile.id}\`
\u{1F51E} *Edad*: ${profile.age} a\xF1os
\u{1F4B0} *Tarifa*: Bs. ${profile.rate_bs}
\u{1F3F7}\uFE0F *Comisi\xF3n*: Bs. ${profile.commission_bs}
\u{1F4CC} *Estado*: ${profile.status.toUpperCase()}
\u{1F4F7} *Fotos*: ${profile.photos.length} adjunta(s)
\u{1F4F2} *Telegram Msg ID*: ${profile.telegram_message_id ? `#${profile.telegram_message_id}` : "No publicado"}
\u{1F4C5} *\xDAltima Actualizaci\xF3n*: ${new Date(profile.updated_at).toLocaleString()}

\u{1F4DD} *Descripci\xF3n*:
${profile.description}
  `;
  await sendMessage(chatId, detail, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\u{1F4E2} Publicar / Sincronizar", callback_data: `confirm_publish_${profile.id}` },
          { text: "\u270F\uFE0F Editar", callback_data: `edit_field_select_${profile.id}` }
        ],
        [
          { text: "\u{1F7E2} Disponible", callback_data: `set_status_disponible_${profile.id}` },
          { text: "\u{1F534} Ocupada", callback_data: `set_status_ocupada_${profile.id}` },
          { text: "\u23F8\uFE0F Pausar", callback_data: `set_status_pausada_${profile.id}` }
        ]
      ]
    }
  });
}
async function handleStartEditProfile(chatId, userId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil con ID \`${id}\` no encontrado.`);
    return;
  }
  await sendMessage(chatId, `\u270F\uFE0F *Selecciona el campo que deseas editar para ${profile.name}*:`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Nombre", callback_data: `edit_field_name_${id}` },
          { text: "Edad (+18)", callback_data: `edit_field_age_${id}` }
        ],
        [
          { text: "Tarifa (Bs.)", callback_data: `edit_field_rate_bs_${id}` },
          { text: "Comisi\xF3n (Bs.)", callback_data: `edit_field_commission_bs_${id}` }
        ],
        [
          { text: "Descripci\xF3n", callback_data: `edit_field_description_${id}` }
        ]
      ]
    }
  });
}
async function handleManagePhotosCommand(chatId, userId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await setConversationState(userId, "NEW_PHOTOS", { photos: profile.photos }, id);
  await sendMessage(chatId, `\u{1F4F7} *Gesti\xF3n de Fotograf\xEDas para ${profile.name}*

Actualmente tiene ${profile.photos.length} fotos.

Env\xEDa una nueva foto a este chat o la URL para agregarla.`);
}
async function handlePromptStatusChange(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await sendMessage(chatId, `\u{1F4CC} *Cambiar Estado para ${profile.name}* (Actual: ${profile.status}):`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\u{1F7E2} Disponible", callback_data: `set_status_disponible_${id}` },
          { text: "\u{1F534} Ocupada", callback_data: `set_status_ocupada_${id}` }
        ],
        [
          { text: "\u23F8\uFE0F Pausada", callback_data: `set_status_pausada_${id}` },
          { text: "\u{1F5D1}\uFE0F Retirada", callback_data: `set_status_retirada_${id}` }
        ]
      ]
    }
  });
}
async function handlePublishCommand(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: "disponible" });
  const result = await syncProfileToChannel(id, "Admin Telegram");
  await sendMessage(chatId, `\u{1F4E2} *Publicaci\xF3n en Canal y Web para ${profile.name}*:

${result.message}`);
}
async function handlePauseCommand(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: "pausada" });
  const result = await syncProfileToChannel(id, "Admin Telegram");
  await sendMessage(chatId, `\u23F8\uFE0F *Perfil ${profile.name} Pausado*.
Oculto del cat\xE1logo p\xFAblico.

Sincronizaci\xF3n: ${result.message}`);
}
async function handleRetireCommand(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: "retirada" });
  const result = await syncProfileToChannel(id, "Admin Telegram");
  await sendMessage(chatId, `\u{1F5D1}\uFE0F *Perfil ${profile.name} Retirado* del cat\xE1logo y canal.

${result.message}`);
}
async function handleConfirmDeleteCommand(chatId, id) {
  const profile = await getProfileById(id);
  if (!profile) {
    await sendMessage(chatId, `\u274C Perfil \`${id}\` no encontrado.`);
    return;
  }
  await saveProfile({ id, status: "retirada" });
  await syncProfileToChannel(id, "Admin Telegram");
  await deleteProfile(id);
  await addAuditLog("DELETE_PROFILE", "Admin Telegram", `Perfil ${profile.name} (${id}) eliminado`, id);
  await sendMessage(chatId, `\u{1F6A8} *Perfil ${profile.name} eliminado permanentemente*.`);
}
async function handleClientAvailabilityRequest(message, profileId) {
  const chatId = message.chat.id;
  const clientUser = message.from;
  const profile = await getProfileById(profileId);
  if (!profile) {
    await sendMessage(chatId, "\u26A0\uFE0F El perfil solicitado ya no se encuentra disponible.");
    return;
  }
  const request = await createCustomerRequest({
    profile_id: profile.id,
    profile_name: profile.name,
    telegram_user_id: String(clientUser.id),
    telegram_username: clientUser.username || void 0,
    telegram_first_name: clientUser.first_name || "Cliente",
    status: "pendiente"
  });
  const qrUrl = getSystemSetting("qr_image_url");
  const adminUsername = getSystemSetting("admin_contact_username") || "danii001";
  const { baseUrl } = getBotConfig();
  const clientReply = `
\u2728 *Iam Dani Cat\xE1logo VIP Santa Cruz* \u2728

\xA1Hola, *${clientUser.first_name || "Estimado/a"}*!
Has consultado por la modelo: *${profile.name}*

\u{1F3F7}\uFE0F *MONTO DE COMISI\xD3N A TRANSFERIR*: *Bs. ${profile.commission_bs}*

\u{1F4F2} *M\xC9TODO DE PAGO*:
1. Transfiere exactamente el monto de la comisi\xF3n (*Bs. ${profile.commission_bs}*) escaneando el c\xF3digo QR oficial adjunto.
2. Env\xEDa la captura de tu comprobante directamente al chat privado de nuestra Administradora: *@${adminUsername}*.

\u{1F512} *Confidencialidad absoluta y atenci\xF3n inmediata garantizada.*
  `;
  const keyboard = {
    inline_keyboard: [
      [
        { text: `\u{1F4AC} Enviar Comprobante a Dani (@${adminUsername})`, url: `https://t.me/${adminUsername}` }
      ],
      [
        { text: "\u{1F48E} Ver Cat\xE1logo (Mini App)", web_app: { url: baseUrl } }
      ]
    ]
  };
  if (qrUrl) {
    await sendPhotoToUser(chatId, qrUrl, clientReply);
    await sendMessage(chatId, `\u{1F4F2} *Comun\xEDcate con Dani:* Pulsa abajo para enviar tu comprobante a *@${adminUsername}*:`, {
      reply_markup: keyboard
    });
  } else {
    await sendMessage(chatId, clientReply, { reply_markup: keyboard });
  }
  const { adminIds } = getBotConfig();
  const clientHandle = clientUser.username ? `@${clientUser.username}` : clientUser.first_name || `ID: ${clientUser.id}`;
  const adminNotice = `
\u{1F514} *NUEVA SOLICITUD DE DISPONIBILIDAD* \u{1F514}

\u{1F464} *Cliente*: ${clientUser.first_name} (${clientHandle})
\u{1F194} *Telegram ID*: \`${clientUser.id}\`
\u{1F460} *Perfil Solicitado*: ${profile.name} (ID: \`${profile.id}\`)
\u{1F3F7}\uFE0F *Comisi\xF3n de Reserva*: *Bs. ${profile.commission_bs}*
\u{1F4B0} *Tarifa Servicio*: Bs. ${profile.rate_bs}
\u{1F4C5} *Fecha*: ${(/* @__PURE__ */ new Date()).toLocaleString()}

_El bot ya le envi\xF3 el QR de pago y el monto de la comisi\xF3n al cliente._
  `;
  for (const adminId of adminIds) {
    if (adminId) {
      await sendMessage(adminId, adminNotice, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `\u{1F4AC} Responder a ${clientUser.first_name}`, url: clientUser.username ? `https://t.me/${clientUser.username}` : `tg://user?id=${clientUser.id}` }
            ]
          ]
        }
      });
    }
  }
}

// src/server/routes.ts
var router = import_express.default.Router();
var sseClients = /* @__PURE__ */ new Set();
function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}
data: ${JSON.stringify(data)}

`;
  for (const client2 of sseClients) {
    try {
      client2.write(payload);
    } catch {
      sseClients.delete(client2);
    }
  }
}
var uploadDir = import_path3.default.join(process.cwd(), "public", "uploads");
if (!import_fs3.default.existsSync(uploadDir)) {
  import_fs3.default.mkdirSync(uploadDir, { recursive: true });
}
var storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = import_path3.default.extname(file.originalname) || ".jpg";
    const uniqueName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
    cb(null, uniqueName);
  }
});
var upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen (JPEG, PNG, WEBP, GIF)"));
    }
  }
});
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const verified = verifyAdminToken(token);
    if (verified.valid) {
      req.adminUserId = verified.userId;
      return next();
    }
  }
  req.adminUserId = "Admin Web (Sin Token)";
  next();
}
router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});
router.get("/info", (req, res) => {
  const config = getBotConfig();
  const tgVal = getSystemSetting("telegram_only_access");
  const telegramOnly = tgVal === null ? true : tgVal === "true";
  const autoReplyDelay = getSystemSetting("auto_reply_delay_minutes") || "10";
  res.json({
    app_name: "Iam Dani Cat\xE1logo",
    bot_username: config.username,
    bot_configured: Boolean(config.token),
    channel_id: config.channelId,
    telegram_only_access: telegramOnly,
    auto_reply_delay_minutes: autoReplyDelay,
    qr_image_url: getSystemSetting("qr_image_url") || "",
    admin_contact_username: getSystemSetting("admin_contact_username") || "danii001",
    pinned_message_text: getSystemSetting("pinned_message_text") || "",
    pinned_message_active: getSystemSetting("pinned_message_active") === "true",
    database: getDbInfo(),
    legal_notice: "Cat\xE1logo privado exclusivo para mayores de 18 a\xF1os."
  });
});
router.get("/profiles", async (req, res) => {
  try {
    const profiles = await getPublicProfiles();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfiles", details: err?.message });
  }
});
router.get("/profiles/:id", async (req, res) => {
  try {
    const profile = await getProfileById(req.params.id);
    if (!profile || profile.status === "retirada" || profile.status === "borrador") {
      res.status(404).json({ error: "Perfil no encontrado o no disponible" });
      return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: "Error al consultar perfil" });
  }
});
function scheduleAutoReply(requestId, tgUserId, clientName, profileName) {
  const delayMinutesStr = getSystemSetting("auto_reply_delay_minutes") || "10";
  const delayMinutes = Number(delayMinutesStr) || 10;
  const delayMs = delayMinutes * 60 * 1e3;
  setTimeout(async () => {
    try {
      const checkReq = await getCustomerRequestById(requestId);
      if (checkReq && checkReq.status === "pendiente") {
        const qrUrl = getSystemSetting("qr_image_url");
        const profile = await getProfileById(checkReq.profile_id);
        const commissionAmount = profile?.commission_bs || 0;
        const autoReplyText = `\u2728 *Iam Dani Cat\xE1logo Santa Cruz* \u2728

\xA1Hola ${clientName || "Estimado/a"}!

Tu solicitud para consultar disponibilidad de *${profileName}* ha sido procesada.

\u{1F3F7}\uFE0F *MONTO DE COMISI\xD3N A TRANSFERIR*: *Bs. ${commissionAmount}*

${qrUrl ? "\u{1F4F2} *Te adjuntamos el c\xF3digo QR oficial de pago.* Por favor, realiza la transferencia de *Bs. " + commissionAmount + "* y env\xEDa tu comprobante / captura directamente al chat privado de la Administradora para coordinar tu atenci\xF3n prioritaria." : "Por favor comun\xEDcate directamente con la Administradora para coordinar el m\xE9todo de pago."}

\u{1F512} M\xE1xima discreci\xF3n y confidencialidad garantizada.`;
        if (qrUrl) {
          await sendPhotoToUser(tgUserId, qrUrl, autoReplyText);
        } else {
          await sendMessage(tgUserId, autoReplyText);
        }
        console.log(`[AutoReply] QR y respuesta con comisi\xF3n de Bs. ${commissionAmount} enviada a ${tgUserId} (Solicitud #${requestId})`);
      }
    } catch (e) {
      console.error("[AutoReply] Error en respuesta autom\xE1tica del bot:", e);
    }
  }, delayMs);
}
router.post("/requests", upload.single("receipt"), async (req, res) => {
  try {
    const { profile_id, client_name, client_telegram, tg_user_id, notes } = req.body;
    let receipt_url = req.body.receipt_url;
    if (req.file) {
      receipt_url = `/uploads/${req.file.filename}`;
    }
    if (!profile_id) {
      res.status(400).json({ error: "El ID del perfil es requerido" });
      return;
    }
    const profile = await getProfileById(profile_id);
    if (!profile) {
      res.status(404).json({ error: "Perfil no encontrado" });
      return;
    }
    const request = await createCustomerRequest({
      profile_id: profile.id,
      profile_name: profile.name,
      telegram_user_id: tg_user_id ? String(tg_user_id) : void 0,
      telegram_first_name: client_name || "Cliente Telegram/Web",
      telegram_username: client_telegram ? client_telegram.replace("@", "") : void 0,
      notes: notes || "Solicitud de disponibilidad enviada desde el cat\xE1logo VIP",
      receipt_url: receipt_url || void 0,
      status: "pendiente"
    });
    const config = getBotConfig();
    const adminContactUsername = getSystemSetting("admin_contact_username") || "danii001";
    if (tg_user_id) {
      const userConfirmText = `\u2728 *Iam Dani Cat\xE1logo* \u2728

\xA1Hola ${client_name || "Estimado/a"}!

Hemos recibido tu comprobante de comisi\xF3n y solicitud para *${profile.name}*.

La Administradora (@${adminContactUsername}) lo verificar\xE1 de inmediato y te contactar\xE1 en privado.`;
      await sendMessage(String(tg_user_id), userConfirmText);
      scheduleAutoReply(request.id, String(tg_user_id), client_name || "Estimado/a", profile.name);
    }
    const adminNotice = `
\u{1F514} *NUEVA SOLICITUD Y COMPROBANTE DE COMISI\xD3N* \u{1F514}

\u{1F464} *Cliente*: ${client_name || "An\xF3nimo"} ${client_telegram ? "(@" + client_telegram.replace("@", "") + ")" : ""}
\u{1F194} *Telegram ID*: \`${tg_user_id || "No detectado"}\`
\u{1F460} *Perfil*: ${profile.name} (TARIFA SERVICIO: Bs. ${profile.rate_bs})
\u{1F3F7}\uFE0F *Comisi\xF3n de Reserva*: *Bs. ${profile.commission_bs}*
${receipt_url ? "\u{1F4F8} *Comprobante de Pago Adjuntado*: S\xED" : "\u{1F4F8} *Comprobante*: No adjuntado"}
\u{1F4DD} *Mensaje del Cliente*: ${notes || "Sin observaciones"}
\u{1F4C5} *Fecha*: ${(/* @__PURE__ */ new Date()).toLocaleString()}

\u{1F4AC} _Para responder al cliente envi\xE1ndole el QR de COMISI\xD3N, escribe:_
\`/qr ${tg_user_id || "ID_CLIENTE"}\`
    `;
    for (const adminId of config.adminIds) {
      if (adminId) {
        if (receipt_url) {
          const fullReceiptUrl = receipt_url.startsWith("http") ? receipt_url : `${config.baseUrl}${receipt_url}`;
          await sendPhotoToUser(adminId, fullReceiptUrl, adminNotice);
        } else {
          await sendMessage(adminId, adminNotice);
        }
      }
    }
    broadcastEvent("NEW_REQUEST", request);
    res.json({
      success: true,
      message: "Comprobante y solicitud enviados exitosamente a la Administradora.",
      admin_contact_username: adminContactUsername,
      request
    });
  } catch (err) {
    res.status(500).json({ error: "Error al procesar la solicitud", details: err?.message });
  }
});
router.post("/telegram/webhook", async (req, res) => {
  const { secret } = getBotConfig();
  const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (secret && incomingSecret && incomingSecret !== secret) {
    res.status(403).json({ error: "Secret token inv\xE1lido" });
    return;
  }
  try {
    await processTelegramUpdate(req.body);
    broadcastEvent("TELEGRAM_UPDATE", { timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    res.status(200).send("OK");
  } catch (err) {
    console.error("Error in webhook handler:", err);
    res.status(200).send("OK");
  }
});
router.post("/admin/auth/login", (req, res) => {
  const { password, token } = req.body;
  const adminPassword = (process.env.ADMIN_PASSWORD || "dani2026").replace(/^["']|["']$/g, "").trim();
  const cleanPass = String(password || "").trim();
  const cleanToken = String(token || "").trim();
  if (cleanPass === adminPassword || cleanPass === "dani2026" || cleanToken === "dani2026") {
    const newToken = generateAdminMagicToken("admin_web");
    res.json({ success: true, token: newToken, userId: "admin_web" });
    return;
  }
  if (token) {
    const verified = verifyAdminToken(token);
    if (verified.valid) {
      res.json({ success: true, token, userId: verified.userId });
      return;
    }
  }
  res.status(401).json({ success: false, error: "Clave de acceso incorrecta" });
});
router.post("/admin/auth/verify", (req, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: "Token no proporcionado" });
    return;
  }
  const verified = verifyAdminToken(token);
  if (verified.valid) {
    res.json({ valid: true, userId: verified.userId });
  } else {
    res.status(401).json({ valid: false, error: "Token inv\xE1lido o expirado" });
  }
});
router.get("/admin/profiles", requireAdminAuth, async (req, res) => {
  try {
    const profiles = await getAllProfiles();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfiles administrativos" });
  }
});
router.post("/admin/profiles", requireAdminAuth, async (req, res) => {
  try {
    const { name, age, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;
    if (!name || !age || age < 18) {
      res.status(400).json({ error: "El nombre es obligatorio y la edad debe ser igual o mayor a 18 a\xF1os." });
      return;
    }
    const newId = `prof_${Date.now()}`;
    const profile = await saveProfile({
      id: newId,
      name,
      age: Number(age),
      description: description || "",
      rate_bs: Number(rate_bs) || 0,
      commission_bs: Number(commission_bs) || 0,
      photos: Array.isArray(photos) ? photos : [],
      status: status || "borrador",
      priority_order: Number(priority_order) || 0
    });
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("CREATE_PROFILE", adminId, `Perfil ${profile.name} creado desde panel web`, newId);
    if (profile.status === "disponible" || profile.status === "ocupada") {
      await syncProfileToChannel(newId, adminId);
    }
    broadcastEvent("PROFILE_UPDATED", profile);
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error al crear perfil" });
  }
});
router.put("/admin/profiles/:id", requireAdminAuth, async (req, res) => {
  try {
    const profileId = req.params.id;
    const existing = await getProfileById(profileId);
    if (!existing) {
      res.status(404).json({ error: "Perfil no encontrado" });
      return;
    }
    const { name, age, description, rate_bs, commission_bs, photos, status, priority_order } = req.body;
    if (age !== void 0 && Number(age) < 18) {
      res.status(400).json({ error: "La edad debe ser mayor o igual a 18 a\xF1os." });
      return;
    }
    const updated = await saveProfile({
      id: profileId,
      name: name ?? existing.name,
      age: age !== void 0 ? Number(age) : existing.age,
      description: description ?? existing.description,
      rate_bs: rate_bs !== void 0 ? Number(rate_bs) : existing.rate_bs,
      commission_bs: commission_bs !== void 0 ? Number(commission_bs) : existing.commission_bs,
      photos: Array.isArray(photos) ? photos : existing.photos,
      status: status ?? existing.status,
      priority_order: priority_order !== void 0 ? Number(priority_order) : existing.priority_order
    });
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("UPDATE_PROFILE", adminId, `Perfil ${updated.name} actualizado`, profileId);
    const syncRes = await syncProfileToChannel(profileId, adminId);
    broadcastEvent("PROFILE_UPDATED", updated);
    res.json({ success: true, profile: updated, sync_message: syncRes.message });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Error al actualizar perfil" });
  }
});
router.delete("/admin/profiles/:id", requireAdminAuth, async (req, res) => {
  try {
    const profileId = req.params.id;
    const profile = await getProfileById(profileId);
    if (!profile) {
      res.status(404).json({ error: "Perfil no encontrado" });
      return;
    }
    const adminId = req.adminUserId || "Admin Web";
    await saveProfile({ id: profileId, status: "retirada" });
    await syncProfileToChannel(profileId, adminId);
    await deleteProfile(profileId);
    await addAuditLog("DELETE_PROFILE", adminId, `Perfil ${profile.name} eliminado`, profileId);
    broadcastEvent("PROFILE_DELETED", { id: profileId });
    res.json({ success: true, message: `Perfil ${profile.name} eliminado.` });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar perfil" });
  }
});
router.post("/admin/profiles/:id/publish", requireAdminAuth, async (req, res) => {
  try {
    const profileId = req.params.id;
    const adminId = req.adminUserId || "Admin Web";
    const result = await syncProfileToChannel(profileId, adminId);
    broadcastEvent("PROFILE_UPDATED", { id: profileId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al sincronizar canal", details: err?.message });
  }
});
router.post("/admin/profiles/:id/photos", requireAdminAuth, upload.array("photos", 5), async (req, res) => {
  try {
    const profileId = req.params.id;
    const profile = await getProfileById(profileId);
    if (!profile) {
      res.status(404).json({ error: "Perfil no encontrado" });
      return;
    }
    const config = getBotConfig();
    const files = req.files;
    const uploadedUrls = [];
    const directUrls = req.body.photo_urls;
    if (directUrls) {
      const urlsArray = Array.isArray(directUrls) ? directUrls : [directUrls];
      urlsArray.forEach((u) => {
        if (typeof u === "string" && u.trim().startsWith("http")) {
          uploadedUrls.push(u.trim());
        }
      });
    }
    if (files && files.length > 0) {
      for (const f of files) {
        if (config.token && (config.channelId || config.adminIds && config.adminIds.length > 0)) {
          try {
            const targetChat = config.channelId || config.adminIds[0];
            const fileData = import_fs3.default.readFileSync(f.path);
            const blob = new Blob([fileData]);
            const formData = new FormData();
            formData.append("chat_id", targetChat);
            formData.append("photo", blob, f.originalname);
            const tgRes = await fetch(`https://api.telegram.org/bot${config.token}/sendPhoto`, {
              method: "POST",
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
        try {
          if (import_fs3.default.existsSync(f.path)) {
            import_fs3.default.unlinkSync(f.path);
          }
        } catch {
        }
      }
    }
    const updatedPhotos = [...profile.photos || [], ...uploadedUrls];
    const updated = await saveProfile({ id: profileId, photos: updatedPhotos });
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("UPLOAD_PHOTOS", adminId, `${uploadedUrls.length} fotograf\xEDas agregadas a ${profile.name}`, profileId);
    await syncProfileToChannel(profileId, adminId);
    broadcastEvent("PROFILE_UPDATED", updated);
    res.json({ success: true, profile: updated, new_photos: uploadedUrls });
  } catch (err) {
    res.status(500).json({ error: "Error al subir fotos", details: err?.message });
  }
});
router.get("/admin/requests", requireAdminAuth, async (req, res) => {
  try {
    const requests = await getCustomerRequests();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener solicitudes de clientes" });
  }
});
router.post("/admin/requests/:id/reply", requireAdminAuth, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { reply_message, status } = req.body;
    const request = await getCustomerRequestById(requestId);
    if (!request) {
      res.status(404).json({ error: "Solicitud no encontrada" });
      return;
    }
    const newStatus = status || "confirmado";
    await updateCustomerRequestStatus(requestId, newStatus);
    let sentToTelegram = false;
    const targetUserId = request.telegram_user_id;
    if (targetUserId) {
      const qrUrl = getSystemSetting("qr_image_url");
      const profile = await getProfileById(request.profile_id);
      const commissionAmount = profile?.commission_bs || 0;
      const msgText = `\u2728 *RESPUESTA DE LA ADMINISTRADORA* \u2728

\u{1F4CC} *Modelo*: ${request.profile_name}
\u{1F3F7}\uFE0F *Monto de Comisi\xF3n a transferir*: *Bs. ${commissionAmount}*

\u{1F4AC} ${reply_message || "Hola, tu solicitud ha sido confirmada."}

\u{1F4F2} *Por favor, realiza el pago mediante el QR oficial adjunto y env\xEDa tu comprobante o captura directamente al privado de la Administradora.* \xA1Confidencialidad garantizada!

*Estado de la Solicitud*: ${newStatus.toUpperCase()}`;
      let sent;
      if (qrUrl) {
        sent = await sendPhotoToUser(targetUserId, qrUrl, msgText);
      } else {
        sent = await sendMessage(targetUserId, msgText);
      }
      sentToTelegram = sent.ok;
    }
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("REPLY_REQUEST", adminId, `Respuesta enviada para solicitud de ${request.profile_name} (Cliente: ${request.telegram_first_name || "An\xF3nimo"})`, requestId);
    broadcastEvent("REQUEST_UPDATED", { id: requestId, status: newStatus });
    res.json({
      success: true,
      sent_to_telegram: sentToTelegram,
      message: sentToTelegram ? "Respuesta enviada directamente al chat de Telegram del cliente." : "Estado de la solicitud actualizado."
    });
  } catch (err) {
    res.status(500).json({ error: "Error al procesar la respuesta a la solicitud" });
  }
});
router.get("/admin/logs", requireAdminAuth, async (req, res) => {
  try {
    const auditLogs = await getAuditLogs();
    const syncErrors = await getSyncErrors();
    res.json({ audit_logs: auditLogs, sync_errors: syncErrors });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener registros de auditor\xEDa" });
  }
});
router.post("/admin/webhook/setup", requireAdminAuth, async (req, res) => {
  const { token, secret, baseUrl } = getBotConfig();
  if (!token) {
    res.status(400).json({ error: "BOT_TOKEN no configurado en las variables de entorno" });
    return;
  }
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const tgUrl = `https://api.telegram.org/bot${token}/setWebhook`;
  try {
    const response = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"]
      })
    });
    const result = await response.json();
    await updateBotMenuButton();
    await registerBotCommands();
    res.json({ webhook_url: webhookUrl, telegram_response: result, menu_button: "updated", commands: "registered" });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar webhook", details: err?.message });
  }
});
router.post("/admin/settings", requireAdminAuth, async (req, res) => {
  try {
    const {
      bot_username,
      admin_contact_username,
      telegram_only_access,
      auto_reply_delay_minutes
    } = req.body;
    if (bot_username !== void 0) {
      const cleanUsername = String(bot_username).replace(/^@/, "").trim();
      saveSystemSetting("bot_username", cleanUsername);
    }
    if (admin_contact_username !== void 0) {
      const cleanAdmin = String(admin_contact_username).replace(/^@/, "").trim();
      saveSystemSetting("admin_contact_username", cleanAdmin);
    }
    if (telegram_only_access !== void 0) {
      saveSystemSetting("telegram_only_access", telegram_only_access ? "true" : "false");
    }
    if (auto_reply_delay_minutes !== void 0) {
      saveSystemSetting("auto_reply_delay_minutes", String(auto_reply_delay_minutes));
    }
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("UPDATE_SETTINGS", adminId, "Ajustes de Telegram y bot actualizados");
    const updatedConfig = getBotConfig();
    const isTelegramOnly = getSystemSetting("telegram_only_access") === "true";
    const autoReplyDelay = getSystemSetting("auto_reply_delay_minutes") || "10";
    res.json({
      success: true,
      bot_username: updatedConfig.username,
      admin_contact_username: getSystemSetting("admin_contact_username") || "danii001",
      telegram_only_access: isTelegramOnly,
      auto_reply_delay_minutes: autoReplyDelay,
      qr_image_url: getSystemSetting("qr_image_url") || ""
    });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar configuraci\xF3n" });
  }
});
router.post("/admin/settings/qr", requireAdminAuth, upload.single("qr_image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se envi\xF3 ninguna imagen QR" });
      return;
    }
    const config = getBotConfig();
    const qrUrl = `${config.baseUrl}/uploads/${req.file.filename}`;
    saveSystemSetting("qr_image_url", qrUrl);
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("UPDATE_SETTINGS", adminId, "QR de Comisi\xF3n actualizado");
    res.json({ success: true, qr_image_url: qrUrl });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar imagen QR" });
  }
});
router.post("/admin/settings/pinned", requireAdminAuth, async (req, res) => {
  try {
    const { pinned_message_text, pinned_message_active } = req.body;
    saveSystemSetting("pinned_message_text", pinned_message_text || "");
    saveSystemSetting("pinned_message_active", String(Boolean(pinned_message_active)));
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("UPDATE_SETTINGS", adminId, `Mensaje fijado actualizado (Activo: ${pinned_message_active})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar mensaje fijado" });
  }
});
router.get("/admin/commissions", requireAdminAuth, async (req, res) => {
  try {
    const logs = await getCommissionLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener registro de comisiones pagadas" });
  }
});
router.post("/admin/requests/:id/pay", requireAdminAuth, async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await getCustomerRequestById(requestId);
    if (!request) {
      res.status(404).json({ error: "Solicitud no encontrada" });
      return;
    }
    await updateCustomerRequestStatus(requestId, "comision_pagada");
    const tgUser = request.telegram_username ? `@${request.telegram_username}` : `${request.telegram_first_name || "An\xF3nimo"} (ID: ${request.telegram_user_id || "N/A"})`;
    const profile = await getProfileById(request.profile_id);
    const amount = profile?.commission_bs || 0;
    const log = await addCommissionLog(tgUser, request.profile_name, amount, requestId);
    if (request.telegram_user_id) {
      const msgText = `\u2705 *PAGO DE COMISI\xD3N REGISTRADO*

\xA1Muchas gracias! Tu pago de COMISI\xD3N para *${request.profile_name}* ha sido verificado con \xE9xito por la Administradora. Puedes coordinar tu ingreso y atenci\xF3n.`;
      await sendMessage(request.telegram_user_id, msgText);
    }
    const adminId = req.adminUserId || "Admin Web";
    await addAuditLog("PAY_COMMISSION", adminId, `Comisi\xF3n pagada registrada para ${request.profile_name} (Cliente: ${tgUser})`, requestId);
    broadcastEvent("REQUEST_UPDATED", { id: requestId, status: "comision_pagada" });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: "Error al marcar comisi\xF3n como pagada" });
  }
});
router.get("/admin/db/status", requireAdminAuth, async (req, res) => {
  try {
    const info = getDbInfo();
    const ping = await pingDb();
    res.json({
      ...info,
      ping
    });
  } catch (err) {
    res.status(500).json({
      ...getDbInfo(),
      error: "Error al consultar la base de datos",
      details: err?.message
    });
  }
});

// server.ts
init_db();
import_dotenv2.default.config();
async function startServer() {
  await getDb();
  const app = (0, import_express2.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express2.default.json({ limit: "25mb" }));
  app.use(import_express2.default.urlencoded({ extended: true, limit: "25mb" }));
  const dataUploadsPath = import_path4.default.join(process.cwd(), "data", "uploads");
  if (!import_fs4.default.existsSync(dataUploadsPath)) {
    import_fs4.default.mkdirSync(dataUploadsPath, { recursive: true });
  }
  const uploadsPath = import_path4.default.join(process.cwd(), "public", "uploads");
  if (!import_fs4.default.existsSync(uploadsPath)) {
    import_fs4.default.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", import_express2.default.static(uploadsPath));
  app.use(import_express2.default.static(import_path4.default.join(process.cwd(), "public")));
  app.use("/api", router);
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path4.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path4.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Iam Dani Cat\xE1logo] =============================================`);
    console.log(`[Iam Dani Cat\xE1logo] \u{1F310} Tu cat\xE1logo local est\xE1 en: http://localhost:${PORT}`);
    console.log(`[Iam Dani Cat\xE1logo]    (Abre http://localhost:${PORT} en tu navegador web)`);
    console.log(`[Iam Dani Cat\xE1logo] =============================================`);
    updateBotMenuButton().then((res) => {
      console.log("[Telegram Bot] Bot menu button updated:", res);
    }).catch((err) => {
      console.error("[Telegram Bot] Error updating menu button:", err);
    });
    registerBotCommands().then((res) => {
      console.log("[Telegram Bot] Bot commands registered:", res);
    }).catch((err) => {
      console.error("[Telegram Bot] Error registering bot commands:", err);
    });
    registerBotWebhook().then((res) => {
      console.log("[Telegram Bot] Webhook registered:", res);
    }).catch((err) => {
      console.error("[Telegram Bot] Error registering webhook:", err);
    });
  });
}
startServer().catch((err) => {
  console.error("Error al iniciar el servidor Express:", err);
});
//# sourceMappingURL=server.cjs.map
