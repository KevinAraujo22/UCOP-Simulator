import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { PACKAGED, PORT, WEB_DIST } from './config';
import './db';
import { currentUser, requireAuth } from './auth';
import { fatal, getPublicUrl, startDesktopExtras, stopDesktopExtras } from './launcher';
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
/** Link público do túnel (quando o exe abriu um) — mostrado ao mestre na mesa. */
app.get('/api/server-info', requireAuth, (req, res) => {
  currentUser(req);
  res.json({ publicUrl: getPublicUrl(), packaged: PACKAGED });
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

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    fatal(`A porta ${PORT} já está em uso — o UCOP já está aberto? Feche a outra janela ou defina UCOP_PORT.`);
  } else {
    fatal(`Não foi possível iniciar o servidor: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`[ucop] servidor ouvindo em http://localhost:${PORT}`);
  console.log(
    hasWebBuild
      ? `[ucop] servindo o front-end compilado de ${WEB_DIST}`
      : '[ucop] front-end compilado não encontrado — use o Vite (npm run dev) para o front-end',
  );
  startDesktopExtras(PORT);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    stopDesktopExtras();
    process.exit(0);
  });
}
process.on('exit', stopDesktopExtras);
