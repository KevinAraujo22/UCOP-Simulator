import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '../..');

// Carrega .env (apps/server/.env tem prioridade sobre o da raiz). Variáveis já
// definidas no ambiente nunca são sobrescritas.
for (const file of [path.join(SERVER_ROOT, '.env'), path.join(REPO_ROOT, '.env')]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // arquivo inexistente: tudo bem
  }
}

// Variável própria (e não PORT) para não colidir com ferramentas que definem PORT
// para o front-end; o proxy do Vite espera o servidor na 3333.
export const PORT = Number(process.env.UCOP_PORT ?? 3333);
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(SERVER_ROOT, 'data'));
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const WEB_DIST = path.join(REPO_ROOT, 'apps', 'web', 'dist');

const DEV_SECRET = 'ucop-dev-secret-NAO-USE-EM-PRODUCAO';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;
if (!process.env.JWT_SECRET) {
  console.warn(
    '\n[ucop] ⚠  JWT_SECRET não definido — usando um segredo de desenvolvimento.\n' +
      '[ucop]    Defina JWT_SECRET no ambiente ou em .env antes de expor o servidor.\n',
  );
}

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias
export const AUTH_COOKIE = 'ucop_token';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
