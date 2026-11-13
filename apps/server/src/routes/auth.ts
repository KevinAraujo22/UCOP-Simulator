import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { loginSchema, registerSchema, type AuthResponse } from '@ucop/shared';
import { clearAuthCookie, currentUser, requireAuth, setAuthCookie, signToken } from '../auth';
import { ah, HttpError, parse } from '../http';
import { users } from '../repo';

export const authRouter = Router();

authRouter.post(
  '/register',
  ah(async (req, res) => {
    const input = parse(registerSchema, req.body);
    if (users.findAuthByEmail(input.email)) throw new HttpError(409, 'Já existe uma conta com este e-mail');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = users.create({ name: input.name, email: input.email, passwordHash });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, user } satisfies AuthResponse);
  }),
);

authRouter.post(
  '/login',
  ah(async (req, res) => {
    const input = parse(loginSchema, req.body);
    const found = users.findAuthByEmail(input.email);
    const ok = found ? await bcrypt.compare(input.password, found.passwordHash) : false;
    if (!found || !ok) throw new HttpError(401, 'E-mail ou senha incorretos');
    const token = signToken(found.user);
    setAuthCookie(res, token);
    res.json({ token, user: found.user } satisfies AuthResponse);
  }),
);

/** Retorna o usuário atual e renova o cookie usado para carregar imagens. */
authRouter.get('/me', requireAuth, (req, res) => {
  const user = currentUser(req);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user } satisfies AuthResponse);
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});
