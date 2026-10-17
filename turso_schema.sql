-- ========================================================
-- SCHEMA SQL PARA TURSO (Iam Dani • Catálogo VIP Santa Cruz)
-- ========================================================

-- 1. Tabla de Perfiles (Sin columna zone; tarifas y comisiones individuales)
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

-- 2. Tabla de Solicitudes de Clientes
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

-- 3. Tabla de Estado de Conversación del Bot
CREATE TABLE IF NOT EXISTS conversations (
  telegram_user_id TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  draft_data TEXT NOT NULL,
  active_profile_id TEXT,
  last_updated TEXT NOT NULL
);

-- 4. Tabla de Auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  profile_id TEXT,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- 5. Tabla de Errores de Sincronización
CREATE TABLE IF NOT EXISTS sync_errors (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  action TEXT NOT NULL,
  error_message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL
);

-- 6. Tabla de Ajustes del Sistema (Bot, QR, mensajes)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 7. Tabla de Registro de Comisiones Pagadas
CREATE TABLE IF NOT EXISTS commission_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  telegram_user TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  amount_bs REAL,
  paid_at TEXT NOT NULL
);

-- ========================================================
-- DATOS INICIALES POR DEFECTO (SEMILLA)
-- ========================================================

INSERT OR IGNORE INTO system_settings (key, value) VALUES ('telegram_only_access', 'true');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_reply_delay_minutes', '10');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('bot_username', 'CatalogoVIPSCZBot');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('admin_contact_username', 'danii001');

-- Perfiles de prueba iniciales (sin zona, con tarifas y comisiones individuales)
INSERT OR IGNORE INTO profiles (
  id, name, age, description, rate_bs, commission_bs, photos, status, created_at, updated_at, priority_order
) VALUES 
(
  'prof_andrea_scz',
  'Andrea',
  21,
  'Elegancia, discreción absoluta y trato exclusivo. Sesiones privadas con reserva anticipada.',
  450,
  50,
  '["https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80"]',
  'disponible',
  '2026-03-01T00:00:00.000Z',
  '2026-03-01T00:00:00.000Z',
  1
),
(
  'prof_valeria_scz',
  'Valeria',
  23,
  'Compañía de alto nivel, universitaria, atención personalizada y máxima confidencialidad garantizada.',
  500,
  60,
  '["https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80"]',
  'disponible',
  '2026-03-01T00:00:00.000Z',
  '2026-03-01T00:00:00.000Z',
  2
),
(
  'prof_camila_scz',
  'Camila',
  20,
  'Carismática, dulce y atenta. Disponible previa reserva para clientes VIP.',
  600,
  70,
  '["https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80"]',
  'disponible',
  '2026-03-01T00:00:00.000Z',
  '2026-03-01T00:00:00.000Z',
  3
);
