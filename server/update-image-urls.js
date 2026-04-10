import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Get list of available images
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const availableImages = fs.readdirSync(imagesDir);

async function updateUrls() {
  const { rows: products } = await pool.query('SELECT id, name, sku, image_url FROM products WHERE image_url IS NOT NULL AND image_url != \'\'');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const product of products) {
    const url = product.image_url;
    // Extract filename from base44 URL
    const match = url.match(/([^/]+)$/);
    if (!match) { skipped++; continue; }
    const filename = match[1];

    if (availableImages.includes(filename)) {
      const newUrl = `/images/${filename}`;
      await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [newUrl, product.id]);
      console.log(`OK: ${product.name} (${product.sku}) -> ${newUrl}`);
      updated++;
    } else {
      console.log(`NOT FOUND: ${filename} (${product.name} ${product.sku})`);
      notFound++;
    }
  }

  console.log(`\n--- Resumen ---`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Sin imagen local: ${notFound}`);
  console.log(`Saltados: ${skipped}`);

  await pool.end();
}

updateUrls().catch(err => { console.error('Error:', err); process.exit(1); });
