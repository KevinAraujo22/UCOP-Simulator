import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Member, User } from '@ucop/shared';
import { AUTH_COOKIE, JWT_SECRET, TOKEN_TTL_SECONDS } from './config';
import { HttpError } from './http';
import { members, users } from './repo';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function signToken(user: User): string {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

/** Retorna o usuário dono do token, ou undefined se inválido/expirado. */
export function userFromToken(token: string | undefined | null): User | undefined {
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') return undefined;
    return users.findById(payload.sub);
  } catch {
    return undefined;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Token do cabeçalho Authorization: Bearer … ou, na falta dele, do cookie. */
function tokenFromRequest(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return readCookie(req, AUTH_COOKIE);
}

/**
 * O cookie existe só para que <img>/Konva consigam carregar /uploads (que é
 * restrito a membros) sem precisar de cabeçalho Authorization.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const user = userFromToken(tokenFromRequest(req));
  if (!user) return next(new HttpError(401, 'Não autenticado'));
  req.user = user;
  next();
}

export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, 'Não autenticado');
  return req.user;
}

/** Garante que o usuário participa da campanha (e opcionalmente é o mestre). */
export function requireMember(campaignId: string, userId: string, opts: { gm?: boolean } = {}): Member {
  const member = members.get(campaignId, userId);
  if (!member) throw new HttpError(404, 'Campanha não encontrada');
  if (opts.gm && member.role !== 'gm') throw new HttpError(403, 'Apenas o mestre pode fazer isso');
  return member;
}
