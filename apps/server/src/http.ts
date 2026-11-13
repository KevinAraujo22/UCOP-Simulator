import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { firstZodMessage } from '@ucop/shared';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Valida `data` com um schema zod, lançando 400 com mensagem legível. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, firstZodMessage(result.error));
  return result.data;
}

/** Imagens de uma campanha só podem apontar para uploads da própria campanha. */
export function assertCampaignUpload(campaignId: string, url: string | null | undefined): void {
  if (url && !url.startsWith(`/uploads/${campaignId}/`)) {
    throw new HttpError(400, 'A imagem precisa ter sido enviada nesta campanha');
  }
}

/** Envolve handlers assíncronos para que erros cheguem ao middleware de erro. */
export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: firstZodMessage(err) });
    return;
  }
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máx. 10 MB)' : `Upload inválido: ${err.message}`;
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  console.error('[ucop] erro inesperado', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
