import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { PORT, WEB_DIST } from './config';
import './db';
import { errorHandler } from './http';
import { setIo, type IoServer } from './realtime';
import { authRouter } from './routes/auth';
import { campaignsRouter } from './routes/campaigns';
import { scenesRouter } from './routes/scenes';
import { uploadsApiRouter, uploadsServeRouter } from './routes/uploads';
import { registerSocketHandlers } from './socket';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // Cloudflare Tunnel / proxy reverso local
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api', uploadsApiRouter);
app.use('/api', campaignsRouter);
app.use('/api', scenesRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});
app.use('/uploads', uploadsServeRouter);

// Em produção, o próprio servidor entrega o front-end compilado (apps/web/dist).
const hasWebBuild = fs.existsSync(path.join(WEB_DIST, 'index.html'));
if (hasWebBuild) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.use(errorHandler);

const server = http.createServer(app);
const io: IoServer = new Server(server, { serveClient: false });
setIo(io);
registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`[ucop] servidor ouvindo em http://localhost:${PORT}`);
  console.log(
    hasWebBuild
      ? `[ucop] servindo o front-end compilado de ${WEB_DIST}`
      : '[ucop] apps/web/dist não encontrado — use o Vite (npm run dev) para o front-end',
  );
});
