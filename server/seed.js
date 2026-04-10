import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, exec, USE_PG } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DBBACKUP = path.join(__dirname, '..', '..', 'DBBACKUP');

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const parseRow = (line) => {
    const fields = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { fields.push(current); current = ''; }
      else current += ch;
    }
    fields.push(current);
    return fields;
  };
  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length !== headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = values[idx]; });
    rows.push(obj);
  }
  return rows;
}

async function seed() {
  // Create tables
  if (USE_PG) {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT DEFAULT '', role TEXT DEFAULT 'viewer', active BOOLEAN DEFAULT true, created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL, model_code TEXT DEFAULT '', category TEXT DEFAULT '', brand TEXT DEFAULT '', size TEXT DEFAULT '', color TEXT DEFAULT '', price NUMERIC DEFAULT 0, cost NUMERIC DEFAULT 0, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 5, description TEXT DEFAULT '', image_url TEXT DEFAULT '', active BOOLEAN DEFAULT true, created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT DEFAULT '', product_sku TEXT DEFAULT '', type TEXT NOT NULL, quantity INTEGER NOT NULL, notes TEXT DEFAULT '', reference TEXT DEFAULT '', user_email TEXT DEFAULT '', created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS entregas (id TEXT PRIMARY KEY, fecha_hora TEXT DEFAULT '', receptor_nombre TEXT NOT NULL, receptor_apellido TEXT NOT NULL, receptor_dni TEXT DEFAULT '', sector TEXT DEFAULT '', prendas JSONB DEFAULT '[]', total_prendas INTEGER DEFAULT 0, entregado_por_email TEXT DEFAULT '', entregado_por_nombre TEXT DEFAULT '', created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT '');
    `);
  } else {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT DEFAULT '', role TEXT DEFAULT 'viewer', active INTEGER DEFAULT 1, created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL, model_code TEXT DEFAULT '', category TEXT DEFAULT '', brand TEXT DEFAULT '', size TEXT DEFAULT '', color TEXT DEFAULT '', price REAL DEFAULT 0, cost REAL DEFAULT 0, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 5, description TEXT DEFAULT '', image_url TEXT DEFAULT '', active INTEGER DEFAULT 1, created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT DEFAULT '', product_sku TEXT DEFAULT '', type TEXT NOT NULL, quantity INTEGER NOT NULL, notes TEXT DEFAULT '', reference TEXT DEFAULT '', user_email TEXT DEFAULT '', created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS entregas (id TEXT PRIMARY KEY, fecha_hora TEXT DEFAULT '', receptor_nombre TEXT NOT NULL, receptor_apellido TEXT NOT NULL, receptor_dni TEXT DEFAULT '', sector TEXT DEFAULT '', prendas TEXT DEFAULT '[]', total_prendas INTEGER DEFAULT 0, entregado_por_email TEXT DEFAULT '', entregado_por_nombre TEXT DEFAULT '', created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT '');
    `);
  }

  // Seed Products
  const productFile = path.join(DBBACKUP, 'Product_export.csv');
  if (fs.existsSync(productFile)) {
    const products = parseCSV(fs.readFileSync(productFile, 'utf-8'));
    console.log(`Found ${products.length} products`);
    await query('DELETE FROM products');

    for (const r of products) {
      const params = [
        r.id, r.name, r.sku, r.model_code || '', r.category || '', r.brand || '',
        r.size || '', r.color || '', parseFloat(r.price) || 0, parseFloat(r.cost) || 0,
        parseInt(r.stock) || 0, parseInt(r.min_stock) || 5, r.description || '',
        r.image_url || '', USE_PG ? (r.active === 'true') : (r.active === 'true' ? 1 : 0),
        r.created_date || new Date().toISOString(), r.updated_date || new Date().toISOString(), r.created_by || ''
      ];

      if (USE_PG) {
        const { pool } = await (await import('./db.js')).getDB();
        await pool.query(
          `INSERT INTO products (id,name,sku,model_code,category,brand,size,color,price,cost,stock,min_stock,description,image_url,active,created_date,updated_date,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`, params);
      } else {
        await query(
          `INSERT OR IGNORE INTO products (id,name,sku,model_code,category,brand,size,color,price,cost,stock,min_stock,description,image_url,active,created_date,updated_date,created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, params);
      }
    }
    console.log(`Imported ${products.length} products`);
  } else {
    console.log('Product_export.csv not found');
  }

  // Seed Stock Movements
  const movFile = path.join(DBBACKUP, 'StockMovement_export.csv');
  if (fs.existsSync(movFile)) {
    const movements = parseCSV(fs.readFileSync(movFile, 'utf-8'));
    console.log(`Found ${movements.length} movements`);
    await query('DELETE FROM stock_movements');

    for (const r of movements) {
      const params = [
        r.id, r.product_id || '', r.product_name || '', r.product_sku || '',
        r.type || 'entrada', parseInt(r.quantity) || 0, r.notes || '',
        r.reference || '', r.user_email || '', r.created_date || new Date().toISOString(),
        r.updated_date || new Date().toISOString(), r.created_by || ''
      ];

      if (USE_PG) {
        const { pool } = await (await import('./db.js')).getDB();
        await pool.query(
          `INSERT INTO stock_movements (id,product_id,product_name,product_sku,type,quantity,notes,reference,user_email,created_date,updated_date,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`, params);
      } else {
        await query(
          `INSERT OR IGNORE INTO stock_movements (id,product_id,product_name,product_sku,type,quantity,notes,reference,user_email,created_date,updated_date,created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, params);
      }
    }
    console.log(`Imported ${movements.length} movements`);
  } else {
    console.log('StockMovement_export.csv not found');
  }

  console.log(`Seed complete! [${USE_PG ? 'PostgreSQL' : 'SQLite'}]`);
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
