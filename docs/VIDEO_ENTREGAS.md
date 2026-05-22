# 🎥 Video de entregas — Configuración (Cloudflare R2)

Cada entrega de mercadería puede grabar un video desde la cámara (webcam USB)
conectada a la PC donde se usa el sistema. El video lleva **incrustado** (quemado
en la imagen) la fecha y hora del **servidor**, el nombre y DNI del receptor y la
cantidad de prendas. Se sube directo del navegador a Cloudflare R2 y queda ligado
a la entrega en la base de datos.

> Si NO configurás R2, todo el sistema sigue funcionando igual; simplemente la
> sección de grabación no aparece y las entregas se guardan sin video.

---

## 1. Crear el bucket en Cloudflare R2

1. Entrá a [dash.cloudflare.com](https://dash.cloudflare.com) → menú **R2**.
   (La primera vez te pide activar R2; el plan gratis incluye 10 GB.)
2. **Create bucket** → nombre, por ejemplo `entregas-video` → Create.
3. Anotá tu **Account ID** (aparece en la página de R2, a la derecha).

## 2. Hacer público el bucket (para reproducir los videos)

1. Entrá al bucket → pestaña **Settings**.
2. En **Public access → Public Development URL**, hacé **Enable**.
   - Te queda una URL tipo `https://pub-xxxxxxxxxxxx.r2.dev`. **Copiala.**
   - (Opcional, recomendado a futuro: conectar un dominio propio como
     `videos.controldestock.cc` en *Custom Domains*.)

## 3. Configurar CORS (para que el navegador pueda subir)

En el bucket → **Settings → CORS Policy → Edit/Add**, pegá esto:

```json
[
  {
    "AllowedOrigins": [
      "https://controldestock.cc",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

> Si el dominio real es otro (o usás `www.`), agregalo a `AllowedOrigins`.

## 4. Crear el token de API (claves de acceso)

1. En R2 → **Manage R2 API Tokens** → **Create API Token**.
2. Permiso: **Object Read & Write**. Alcance: el bucket `entregas-video` (o todos).
3. Create. Te muestra **una sola vez**:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

   (Ignorá el "endpoint" S3 que muestra; el sistema lo arma solo con el Account ID.)

## 5. Cargar las variables en Railway

En el proyecto de Railway → servicio web → **Variables** → agregá:

| Variable | Valor |
|---|---|
| `R2_ACCOUNT_ID` | tu Account ID de Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key del token |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key del token |
| `R2_BUCKET` | `entregas-video` |
| `R2_PUBLIC_URL` | `https://pub-xxxxxxxx.r2.dev` (sin barra final) |

Guardá → Railway redeploya solo. Listo.

---

## Cómo se usa

1. Entrar a **Entregas**. La primera vez el navegador pide permiso de cámara
   (se acepta una sola vez por equipo).
2. Aparece el **preview** con el sello (reloj + receptor) ya incrustado.
3. Al **primer escaneo** la grabación arranca sola (indicador 🔴 REC).
4. Al tocar **Confirmar Entrega**, el video se sube a R2 y queda ligado a la entrega.
5. El video se puede ver después en **Movimientos → Entregas → (abrir una entrega)**.

## Notas técnicas

- **Hora confiable:** el reloj quemado y la fecha del registro usan la hora del
  **servidor** (`/api/server-time`), no la de la PC, para que no se pueda falsear
  cambiando el reloj de la máquina.
- **Subida directa:** el navegador pide una URL firmada (`/api/entregas/video-presign`)
  y sube el archivo directo a R2 (no pasa por Railway → sin límite de tamaño del server).
- **Tope de duración:** 15 min por video (corte automático de seguridad).
- **Formato:** `webm` (VP9/Opus) en Chrome/Edge; `mp4` como alternativa en Safari.
- **Costo aprox. R2:** ~US$ 0,015/GB/mes de almacenamiento, sin cargo por descarga.
  Un clip de ~1 min pesa ~15-20 MB.
- **Compatibilidad:** funciona en Chrome/Edge (PC). En iPhone/Safari la grabación
  por canvas puede no estar soportada según versión.
