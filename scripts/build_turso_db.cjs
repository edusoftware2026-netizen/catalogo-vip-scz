const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const dbPath = path.resolve('data/catalogo.db');
  const sqlitePath = path.resolve('data/catalogo.sqlite');
  
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  
  const client = createClient({ url: 'file:' + dbPath });

  // 1. Set journal_mode to WAL (requerido estrictamente por Turso para uploads)
  const jMode = await client.execute('PRAGMA journal_mode = WAL;');
  console.log('✅ Journal Mode configurado:', jMode.rows[0]);

  const schemaSql = fs.readFileSync('turso_schema.sql', 'utf8');

  // Strip comments
  const cleanSql = schemaSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sql of statements) {
    await client.execute(sql);
  }

  // Checkpoint to flush everything cleanly into the main DB file while keeping WAL mode
  const checkpoint = await client.execute('PRAGMA wal_checkpoint(TRUNCATE);');
  console.log('✅ Checkpoint WAL:', checkpoint.rows[0]);

  // Verify journal_mode
  const checkMode = await client.execute('PRAGMA journal_mode;');
  console.log('✅ Verificación Journal Mode:', checkMode.rows[0]);

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  console.log('✅ TABLAS CREADAS:', tables.rows.map(r => r.name));

  const profCount = await client.execute("SELECT count(*) as count FROM profiles");
  console.log('✅ TOTAL PERFILES:', profCount.rows[0].count);

  // Close / Sync client
  client.close();

  // Copy to catalogo.sqlite
  fs.copyFileSync(dbPath, sqlitePath);
  console.log('✅ catalogo.db preparado en modo WAL para Turso');
  console.log('✅ catalogo.sqlite copia en modo WAL preparada para Turso');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
