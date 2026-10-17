import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { router as apiRouter } from './src/server/routes.js';
import { getDb } from './src/server/db.js';
import { updateBotMenuButton, registerBotCommands, registerBotWebhook } from './src/server/telegram.js';

async function startServer() {
  // Ensure DB initialized
  await getDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Ensure data/uploads exists (important for persistent volumes like Fly.io where public/uploads is a symlink to data/uploads)
  const dataUploadsPath = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(dataUploadsPath)) {
    fs.mkdirSync(dataUploadsPath, { recursive: true });
  }

  // Static folder for uploaded image assets
  const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsPath));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // API routes FIRST
  app.use('/api', apiRouter);

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Iam Dani Catálogo] =============================================`);
    console.log(`[Iam Dani Catálogo] 🌐 Tu catálogo local está en: http://localhost:${PORT}`);
    console.log(`[Iam Dani Catálogo]    (Abre http://localhost:${PORT} en tu navegador web)`);
    console.log(`[Iam Dani Catálogo] =============================================`);
    updateBotMenuButton().then(res => {
      console.log('[Telegram Bot] Bot menu button updated:', res);
    }).catch(err => {
      console.error('[Telegram Bot] Error updating menu button:', err);
    });
    registerBotCommands().then(res => {
      console.log('[Telegram Bot] Bot commands registered:', res);
    }).catch(err => {
      console.error('[Telegram Bot] Error registering bot commands:', err);
    });
    registerBotWebhook().then(res => {
      console.log('[Telegram Bot] Webhook registered:', res);
    }).catch(err => {
      console.error('[Telegram Bot] Error registering webhook:', err);
    });
  });
}

startServer().catch(err => {
  console.error('Error al iniciar el servidor Express:', err);
});
