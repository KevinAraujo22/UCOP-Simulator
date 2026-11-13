import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES, UPLOADS_DIR } from '../config';
import { currentUser, requireAuth, requireMember } from '../auth';
import { HttpError } from '../http';

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const ID_RE = /^[\w-]+$/;
const FILE_RE = /^[\w-]+\.(png|jpg|webp|gif)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = path.join(UPLOADS_DIR, req.params.id);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(_req, file, cb) {
      cb(null, `${randomUUID()}${EXTENSIONS[file.mimetype]}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (EXTENSIONS[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, 'Formato não suportado (use PNG, JPG, WEBP ou GIF)'));
  },
});

/** POST /api/campaigns/:id/uploads — membro envia uma imagem (campo "file"): mapas, tokens, retratos. */
export const uploadsApiRouter = Router();
uploadsApiRouter.post(
  '/campaigns/:id/uploads',
  requireAuth,
  (req, _res, next) => {
    if (!ID_RE.test(req.params.id)) return next(new HttpError(400, 'Campanha inválida'));
    requireMember(req.params.id, currentUser(req).id);
    next();
  },
  upload.single('file'),
  (req, res) => {
    if (!req.file) throw new HttpError(400, 'Nenhum arquivo enviado (campo "file")');
    res.status(201).json({ url: `/uploads/${req.params.id}/${req.file.filename}` });
  },
);

/** GET /uploads/:campaignId/:file — apenas membros da campanha. */
export const uploadsServeRouter = Router();
uploadsServeRouter.get('/:campaignId/:file', requireAuth, (req, res, next) => {
  const { campaignId, file } = req.params;
  if (!ID_RE.test(campaignId) || !FILE_RE.test(file)) throw new HttpError(404, 'Arquivo não encontrado');
  requireMember(campaignId, currentUser(req).id);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(path.join(UPLOADS_DIR, campaignId, file), (err) => {
    if (err) next(new HttpError(404, 'Arquivo não encontrado'));
  });
});
