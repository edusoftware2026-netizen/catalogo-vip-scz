# 💎 Iam Dani — Catálogo Digital e IA con Telegram Bot (Santa Cruz)

Plataforma de catálogo web interactiva, gestor de inventario y asistente con Inteligencia Artificial (Google Gemini) integrada con Telegram Bot para notificaciones, consultas y administración.

---

## 🚀 Guía de Publicación y Despliegue

Tienes **dos alternativas** preparadas y automatizadas mediante scripts de PowerShell para publicar tu catálogo y conectarlo con Telegram:

---

### 🌐 Alternativa 2 (Recomendada para Producción 24/7): Despliegue en la Nube con Fly.io

Esta alternativa publica tu catálogo en un servidor en la nube permanente (**Fly.io**) con **Volumen Persistente de 1 GB (`catalogo_data`)**, garantizando que tu base de datos SQLite (`catalogo.sqlite`) y todas las fotografías subidas por los usuarios se conserven intactas y tu Bot de Telegram responda **las 24 horas del día, los 365 días del año**.

#### Pasos para publicar con la Alternativa 2:

1. **Prepara tu archivo `.env` local (Opcional pero Recomendado):**
   Asegúrate de tener un archivo `.env` en la raíz del proyecto con tus claves (puedes basarte en `.env.example`):
   ```env
   GEMINI_API_KEY="tu_api_key_de_gemini"
   BOT_TOKEN="tu_token_de_telegram_bot"
   BOT_USERNAME="IamDaniSantaCruzBot"
   TELEGRAM_WEBHOOK_SECRET="tu_secreto_para_webhook"
   CHANNEL_ID="-1003650435412"
   ```

2. **Abre PowerShell en la carpeta del proyecto y ejecuta el script automatizado:**
   ```powershell
   .\deploy_flyio.ps1
   ```

3. **¿Qué hace el script automáticamente por ti?**
   - **Paso 1:** Verifica si tienes **Fly CLI** instalado (lo instala automáticamente con Winget si falta).
   - **Paso 2 y 3:** Te solicita un nombre para tu app (ej. `iam-dani-catalogo`) y la región (por defecto `mia` - Miami). Crea la app en Fly.io y genera el archivo `fly.toml`.
   - **Paso 4:** Crea el **Volumen Persistente gratuito de 1 GB (`catalogo_data`)** y configura automáticamente el punto de montaje en `/app/data` dentro del contenedor Docker.
   - **Paso 5:** Detecta tu archivo `.env` local (o te solicita las claves en pantalla) y sube de forma segura `GEMINI_API_KEY`, `BOT_TOKEN`, `APP_URL`, `APP_BASE_URL` y demás parámetros como **secretos encriptados a Fly.io**.
   - **Paso 6:** Lanza el comando `fly deploy` para compilar tu contenedor Docker y poner tu web en línea en la URL HTTPS pública:
     ```
     https://tu-nombre-de-app.fly.dev
     ```

#### Comandos útiles para la gestión diaria en Fly.io:
- **`fly logs`** → Ver en tiempo real la consola, peticiones web y mensajes del Bot de Telegram.
- **`fly status`** → Ver el estado, CPU y RAM del contenedor.
- **`fly open`** → Abrir instantáneamente la URL pública del catálogo en tu navegador web.
- **`fly secrets list`** → Consultar qué variables secretas están configuradas en el servidor.

---

### ⚡ Alternativa 1 (Para Pruebas Rápida desde tu PC): Cloudflare Tunnel

Si deseas mostrar tu catálogo o probar el webhook de Telegram de manera instantánea corriendo desde tu propio equipo (sin requerir servidor nube ni tarjeta de crédito):

1. **Ejecuta desde PowerShell:**
   ```powershell
   .\iniciar_cloudflare.ps1
   ```
2. El script compilará la aplicación (`npm run build`), abrirá el servidor en el **puerto 3000** y creará un **túnel HTTPS gratuito** (`https://xxxx.trycloudflare.com`) accesible desde cualquier parte de internet.

---

## 🛠️ Estructura técnica de Persistencia en Docker

- **Base de datos SQLite:** `/app/data/catalogo.sqlite`
- **Imágenes subidas por usuarios:** `/app/data/uploads` (enlazado simbólicamente desde `/app/public/uploads`).
- **Volumen persistente de Fly.io:** Montado en `/app/data`, asegurando permanencia total de datos en reinicios o actualizaciones del servidor.
