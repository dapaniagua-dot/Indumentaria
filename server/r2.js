// Cloudflare R2 (S3-compatible) helper for delivery video uploads.
// Uploads happen directly from the browser via presigned PUT URLs, so the
// video bytes never pass through this server.
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || '';
// Public base URL of the bucket (r2.dev dev URL or a custom domain). No trailing slash.
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

const ENDPOINT = ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : '';

export function isR2Configured() {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL);
}

// Origin (scheme + host) of the R2 S3 API endpoint — used for CSP connect-src.
export function r2EndpointOrigin() {
  return ENDPOINT || null;
}

// Origin of the public bucket URL — used for CSP media-src.
export function r2PublicOrigin() {
  if (!PUBLIC_URL) return null;
  try { return new URL(PUBLIC_URL).origin; } catch { return null; }
}

let _client = null;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: ENDPOINT,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    });
  }
  return _client;
}

const EXT_BY_TYPE = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

function extFor(contentType) {
  if (!contentType) return 'webm';
  const base = contentType.split(';')[0].trim().toLowerCase();
  return EXT_BY_TYPE[base] || 'webm';
}

// Returns { uploadUrl, publicUrl, key, contentType } for a delivery video.
// The browser must PUT the blob to uploadUrl with the SAME Content-Type.
export async function presignDeliveryVideo({ contentType }) {
  const type = (contentType || 'video/webm').split(';')[0].trim().toLowerCase();
  const ext = extFor(type);
  const now = new Date();
  const folder = `entregas/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const key = `${folder}/${uuidv4()}.${ext}`;

  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 900 }); // 15 min

  return { uploadUrl, publicUrl: `${PUBLIC_URL}/${key}`, key, contentType: type };
}

const CT_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
const EXT_BY_CT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

// Upload a buffer directly to R2 (server-side) and return its public URL.
export async function uploadObject({ buffer, contentType, ext, keyPrefix = 'uploads' }) {
  let cleanExt = (ext || '').replace(/^\./, '').toLowerCase();
  if (!cleanExt && contentType) cleanExt = EXT_BY_CT[contentType.toLowerCase()] || '';
  if (!cleanExt) cleanExt = 'bin';
  const ct = contentType || CT_BY_EXT[cleanExt] || 'application/octet-stream';
  const key = `${keyPrefix}/${uuidv4()}.${cleanExt}`;
  await client().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: ct }));
  return { key, publicUrl: `${PUBLIC_URL}/${key}` };
}
