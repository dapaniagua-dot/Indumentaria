import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, queryOne, exec, USE_PG } from './db.js';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- Config ---
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

// --- Init DB ---
async function initDB() {
  if (USE_PG) {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'viewer',
        active BOOLEAN DEFAULT true, created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL,
        model_code TEXT DEFAULT '', category TEXT DEFAULT '', brand TEXT DEFAULT '',
        size TEXT DEFAULT '', color TEXT DEFAULT '', price NUMERIC DEFAULT 0,
        cost NUMERIC DEFAULT 0, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 5,
        description TEXT DEFAULT '', image_url TEXT DEFAULT '', active BOOLEAN DEFAULT true,
        publicidad BOOLEAN DEFAULT false,
        created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT DEFAULT '',
        product_sku TEXT DEFAULT '', type TEXT NOT NULL, quantity INTEGER NOT NULL,
        notes TEXT DEFAULT '', reference TEXT DEFAULT '', user_email TEXT DEFAULT '',
        created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS entregas (
        id TEXT PRIMARY KEY, fecha_hora TEXT DEFAULT '',
        receptor_nombre TEXT NOT NULL, receptor_apellido TEXT NOT NULL,
        receptor_dni TEXT DEFAULT '', sector TEXT DEFAULT '',
        prendas JSONB DEFAULT '[]', total_prendas INTEGER DEFAULT 0,
        entregado_por_email TEXT DEFAULT '', entregado_por_nombre TEXT DEFAULT '',
        created_date TIMESTAMPTZ DEFAULT NOW(), updated_date TIMESTAMPTZ DEFAULT NOW(), created_by TEXT DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_date);
    `);
    await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT DEFAULT NULL`);
    await exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false`);
    await exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS publicidad BOOLEAN DEFAULT false`);
  } else {
    await exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'viewer',
        active INTEGER DEFAULT 1, created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL,
        model_code TEXT DEFAULT '', category TEXT DEFAULT '', brand TEXT DEFAULT '',
        size TEXT DEFAULT '', color TEXT DEFAULT '', price REAL DEFAULT 0,
        cost REAL DEFAULT 0, stock INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 5,
        description TEXT DEFAULT '', image_url TEXT DEFAULT '', active INTEGER DEFAULT 1,
        publicidad INTEGER DEFAULT 0,
        created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT DEFAULT '',
        product_sku TEXT DEFAULT '', type TEXT NOT NULL CHECK(type IN ('entrada', 'salida', 'ajuste')),
        quantity INTEGER NOT NULL, notes TEXT DEFAULT '', reference TEXT DEFAULT '', user_email TEXT DEFAULT '',
        created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS entregas (
        id TEXT PRIMARY KEY, fecha_hora TEXT DEFAULT '',
        receptor_nombre TEXT NOT NULL, receptor_apellido TEXT NOT NULL,
        receptor_dni TEXT DEFAULT '', sector TEXT DEFAULT '',
        prendas TEXT DEFAULT '[]', total_prendas INTEGER DEFAULT 0,
        entregado_por_email TEXT DEFAULT '', entregado_por_nombre TEXT DEFAULT '',
        created_date TEXT DEFAULT (datetime('now')), updated_date TEXT DEFAULT (datetime('now')), created_by TEXT DEFAULT ''
      );
    `);
    try { await exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT DEFAULT NULL`); } catch {}
    try { await exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`); } catch {}
    try { await exec(`ALTER TABLE products ADD COLUMN publicidad INTEGER DEFAULT 0`); } catch {}
  }
  console.log(`Database ready [${USE_PG ? 'PostgreSQL' : 'SQLite'}]`);
}

// --- Express App ---
const app = express();

app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: NODE_ENV === 'production' ? true : ALLOWED_ORIGINS,
  credentials: true,
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Se requiere rol de administrador' });
  next();
}

// --- Auth Routes ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = await queryOne('SELECT * FROM users WHERE email = ? AND active = ?', [email.toLowerCase().trim(), USE_PG ? true : 1]);
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const totpEnabled = USE_PG ? user.totp_enabled : !!user.totp_enabled;
  if (totpEnabled) {
    const tempToken = jwt.sign({ id: user.id, pending2FA: true }, JWT_SECRET, { expiresIn: '5m' });
    return res.json({ requires2FA: true, tempToken });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json(req.user));

app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const countRow = await queryOne('SELECT COUNT(*) as c FROM users');
  const isFirstUser = parseInt(countRow.c) === 0;

  if (!isFirstUser) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Solo admin puede crear usuarios' });
    } catch {
      return res.status(403).json({ error: 'Token inválido' });
    }
  }

  const id = uuidv4().replace(/-/g, '').slice(0, 24);
  const password_hash = await bcrypt.hash(password, 12);
  const userRole = isFirstUser ? 'admin' : (role || 'viewer');

  try {
    await query('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email.toLowerCase().trim(), password_hash, full_name || '', userRole]);
    res.json({ ok: true, message: isFirstUser ? 'Admin creado' : 'Usuario creado' });
  } catch (err) {
    if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    throw err;
  }
});

app.get('/api/auth/users', authenticateToken, requireAdmin, async (req, res) => {
  const rows = await query('SELECT id, email, full_name, role, active, created_date FROM users ORDER BY created_date');
  res.json(rows);
});

app.get('/api/auth/status', async (req, res) => {
  const row = await queryOne('SELECT COUNT(*) as c FROM users');
  res.json({ needsSetup: parseInt(row.c) === 0 });
});

// --- File Upload ---
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const ext = path.extname(req.file.originalname);
  const newName = `${uuidv4()}${ext}`;
  fs.renameSync(req.file.path, path.join(UPLOADS_DIR, newName));
  res.json({ file_url: `/uploads/${newName}` });
});

// --- Label Analysis with Claude Vision ---
app.post('/api/analyze-label', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: `Analiza esta etiqueta de prenda de ropa/indumentaria deportiva y extrae los siguientes datos. Responde SOLO con un JSON válido, sin texto adicional ni markdown:

{
  "name": "nombre del producto (ej: BOCA H JSY AU)",
  "brand": "marca (ej: Adidas, Nike)",
  "model_code": "código de modelo/artículo (ej: IU1244, HT3695)",
  "category": "categoría: Remeras, Shorts, Buzos, Camperas, Pantalones, Medias, u otra",
  "size": "talle USA (el que figura como 'USA', 'US' o 'U.S.'). Prioridad: USA > UK > EUR. Ej: S, M, L, XL, XXL",
  "color": "código o nombre de color que figure en la etiqueta"
}

Si algún dato no es legible o no aparece, dejá el campo como string vacío "". El name debe ser descriptivo y corto.

IMPORTANTE para el talle: en etiquetas deportivas suele haber varios sistemas (USA, UK, EUR, FR, etc.). Devolvé SIEMPRE el talle USA. Si no aparece USA, usá UK. Si tampoco, usá EUR. Nunca mezcles sistemas.`
          }
        ]
      }]
    });

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const text = message.content[0].text.trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const jsonStr = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
    const parsed = JSON.parse(jsonStr);
    res.json(parsed);
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Label analysis error:', err);
    res.status(500).json({ error: 'Error al analizar la etiqueta: ' + err.message });
  }
});

// --- Entity CRUD ---
const ENTITY_CONFIG = {
  Product: { table: 'products', jsonFields: [] },
  StockMovement: { table: 'stock_movements', jsonFields: [] },
  Entrega: { table: 'entregas', jsonFields: ['prendas'] },
};

const VALID_COLUMNS = {
  products: new Set(['id','name','sku','model_code','category','brand','size','color','price','cost','stock','min_stock','description','image_url','active','publicidad','created_date','updated_date','created_by']),
  stock_movements: new Set(['id','product_id','product_name','product_sku','type','quantity','notes','reference','user_email','created_date','updated_date','created_by']),
  entregas: new Set(['id','fecha_hora','receptor_nombre','receptor_apellido','receptor_dni','sector','prendas','total_prendas','entregado_por_email','entregado_por_nombre','created_date','updated_date','created_by']),
};

const VALID_SORT = new Set(['created_date','updated_date','name','sku','stock','category','brand','product_name','type','quantity','fecha_hora','receptor_nombre']);

function sanitizeSort(sort) {
  if (!sort) return 'created_date DESC';
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!VALID_SORT.has(field)) return 'created_date DESC';
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}

function prepareValue(value, field, jsonFields) {
  if (jsonFields.includes(field) && typeof value !== 'string') return JSON.stringify(value);
  return value;
}

function parseRow(row, config) {
  if (!row) return null;
  const parsed = { ...row };
  for (const f of config.jsonFields) {
    if (parsed[f] && typeof parsed[f] === 'string') {
      try { parsed[f] = JSON.parse(parsed[f]); } catch {}
    }
  }
  if (!USE_PG && 'active' in parsed) parsed.active = !!parsed.active;
  return parsed;
}

// LIST
app.get('/api/entities/:entity', authenticateToken, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) return res.status(404).json({ error: 'Entidad desconocida' });

  const orderBy = sanitizeSort(req.query.sort);
  const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
  const rows = await query(`SELECT * FROM ${config.table} ORDER BY ${orderBy} LIMIT ?`, [limit]);
  res.json(rows.map(r => parseRow(r, config)));
});

// FILTER
app.post('/api/entities/:entity/filter', authenticateToken, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) return res.status(404).json({ error: 'Entidad desconocida' });

  const validCols = VALID_COLUMNS[config.table];
  const keys = Object.keys(req.body).filter(k => validCols.has(k));

  if (keys.length === 0) {
    const rows = await query(`SELECT * FROM ${config.table}`);
    return res.json(rows.map(r => parseRow(r, config)));
  }

  const where = keys.map((k, i) => USE_PG ? `${k} = $${i + 1}` : `${k} = ?`).join(' AND ');
  const values = keys.map(k => req.body[k]);

  let rows;
  if (USE_PG) {
    const { rows: pgRows } = await (await import('./db.js')).getDB().then(c => c.pool.query(`SELECT * FROM ${config.table} WHERE ${where}`, values));
    rows = pgRows;
  } else {
    rows = await query(`SELECT * FROM ${config.table} WHERE ${where}`, values);
  }
  res.json(rows.map(r => parseRow(r, config)));
});

// CREATE
app.post('/api/entities/:entity', authenticateToken, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) return res.status(404).json({ error: 'Entidad desconocida' });

  const validCols = VALID_COLUMNS[config.table];
  const id = uuidv4().replace(/-/g, '').slice(0, 24);
  const now = new Date().toISOString();
  const raw = { ...req.body, id, created_date: now, updated_date: now };

  const keys = Object.keys(raw).filter(k => validCols.has(k));
  const values = keys.map(k => prepareValue(raw[k] ?? null, k, config.jsonFields));

  if (USE_PG) {
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const conn = await (await import('./db.js')).getDB();
    await conn.pool.query(`INSERT INTO ${config.table} (${cols}) VALUES (${placeholders})`, values);
    const { rows } = await conn.pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
    return res.json(parseRow(rows[0], config));
  } else {
    const cols = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    await query(`INSERT INTO ${config.table} (${cols}) VALUES (${placeholders})`, values);
    const row = await queryOne(`SELECT * FROM ${config.table} WHERE id = ?`, [id]);
    return res.json(parseRow(row, config));
  }
});

// UPDATE
app.put('/api/entities/:entity/:id', authenticateToken, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) return res.status(404).json({ error: 'Entidad desconocida' });

  const validCols = VALID_COLUMNS[config.table];
  const raw = { ...req.body, updated_date: new Date().toISOString() };
  delete raw.id;

  const keys = Object.keys(raw).filter(k => validCols.has(k));
  if (keys.length === 0) return res.json({});

  const values = keys.map(k => prepareValue(raw[k] ?? null, k, config.jsonFields));

  if (USE_PG) {
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const conn = await (await import('./db.js')).getDB();
    await conn.pool.query(`UPDATE ${config.table} SET ${sets} WHERE id = $${keys.length + 1}`, [...values, req.params.id]);
    const { rows } = await conn.pool.query(`SELECT * FROM ${config.table} WHERE id = $1`, [req.params.id]);
    return res.json(parseRow(rows[0], config));
  } else {
    const sets = keys.map(k => `${k} = ?`).join(', ');
    await query(`UPDATE ${config.table} SET ${sets} WHERE id = ?`, [...values, req.params.id]);
    const row = await queryOne(`SELECT * FROM ${config.table} WHERE id = ?`, [req.params.id]);
    return res.json(parseRow(row, config));
  }
});

// DELETE
app.delete('/api/entities/:entity/:id', authenticateToken, requireAdmin, async (req, res) => {
  const config = ENTITY_CONFIG[req.params.entity];
  if (!config) return res.status(404).json({ error: 'Entidad desconocida' });
  await query(`DELETE FROM ${config.table} WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

// --- 2FA Routes ---
app.get('/api/auth/2fa/status', authenticateToken, async (req, res) => {
  const user = await queryOne('SELECT totp_enabled FROM users WHERE id = ?', [req.user.id]);
  res.json({ enabled: USE_PG ? !!user.totp_enabled : !!user.totp_enabled });
});

app.post('/api/auth/2fa/setup', authenticateToken, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `Control de Stock (${req.user.email})`, length: 20 });
  await query('UPDATE users SET totp_secret = ? WHERE id = ?', [secret.base32, req.user.id]);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

app.post('/api/auth/2fa/enable', authenticateToken, async (req, res) => {
  const { code } = req.body;
  const user = await queryOne('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);
  if (!user?.totp_secret) return res.status(400).json({ error: 'Primero iniciá la configuración' });
  const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
  if (!verified) return res.status(400).json({ error: 'Código incorrecto' });
  await query('UPDATE users SET totp_enabled = ? WHERE id = ?', [USE_PG ? true : 1, req.user.id]);
  res.json({ ok: true });
});

app.post('/api/auth/2fa/verify', async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Datos requeridos' });
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.pending2FA) return res.status(400).json({ error: 'Token inválido' });
    const user = await queryOne('SELECT * FROM users WHERE id = ? AND active = ?', [decoded.id, USE_PG ? true : 1]);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
    if (!verified) return res.status(401).json({ error: 'Código incorrecto' });
    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch {
    return res.status(401).json({ error: 'Token expirado o inválido' });
  }
});

app.post('/api/auth/2fa/disable', authenticateToken, async (req, res) => {
  const { code } = req.body;
  const user = await queryOne('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);
  if (!user?.totp_secret) return res.status(400).json({ error: '2FA no está configurado' });
  const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
  if (!verified) return res.status(400).json({ error: 'Código incorrecto' });
  await query('UPDATE users SET totp_enabled = ?, totp_secret = ? WHERE id = ?', [USE_PG ? false : 0, null, req.user.id]);
  res.json({ ok: true });
});

// --- SPA Fallback ---
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// --- Start ---
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Stock API running on port ${PORT} [${NODE_ENV}] [${USE_PG ? 'PostgreSQL' : 'SQLite'}]`);
  });
}).catch(err => {
  console.error('Failed to init database:', err);
  process.exit(1);
});
