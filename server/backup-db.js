// Backup de la base de datos a un archivo JSON local.
// Uso (PowerShell, dentro de la carpeta STOCK):
//   $env:DATABASE_URL="postgresql://...URL_PUBLICA_DE_RAILWAY..."; node server/backup-db.js
//
// La URL pública está en Railway: servicio Postgres -> Variables -> DATABASE_PUBLIC_URL
// (o pestaña "Connect" -> Public Network).
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url || !/^postgres/i.test(url)) {
  console.error('❌ Falta DATABASE_URL (la URL PÚBLICA de Railway).');
  console.error('   Ej (PowerShell): $env:DATABASE_URL="postgresql://usuario:pass@host:puerto/railway"; node server/backup-db.js');
  process.exit(1);
}

const TABLES = ['users', 'products', 'stock_movements', 'entregas'];

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  const dump = { generated_at: new Date().toISOString(), source: 'controldestock.cc', tables: {} };
  for (const t of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${t}`);
    dump.tables[t] = rows;
    console.log(`  ${t}: ${rows.length} filas`);
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  // Fuera del repo (INDUMENTARIA/DBBACKUP) para no subir datos sensibles a git
  const outDir = path.join(__dirname, '..', '..', 'DBBACKUP');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `backup-stock-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2));
  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Backup guardado en:\n   ${file}\n   (${mb} MB)`);
} catch (err) {
  console.error('❌ Error al generar el backup:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
