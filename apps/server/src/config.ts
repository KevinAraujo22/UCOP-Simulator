import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isSea } from 'node:sea';
import { fileURLToPath } from 'node:url';

/**
 * true quando rodando de dentro do UCOP.exe (Node "single executable application").
 * Nesse modo tudo fica ao lado do executável: web/, data/, .env e o módulo nativo.
 */
export const PACKAGED = isSea();

/** Pasta do executável (modo empacotado) — onde ficam web/, data/ e o módulo do SQLite. */
export const APP_DIR = PACKAGED ? path.dirname(process.execPath) : '';

const here = PACKAGED ? APP_DIR : path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = PACKAGED ? APP_DIR : path.resolve(here, '..');
export const REPO_ROOT = PACKAGED ? APP_DIR : path.resolve(SERVER_ROOT, '../..');

// Carrega .env (apps/server/.env tem prioridade sobre o da raiz; no exe, o .env ao lado
// dele). Variáveis já definidas no ambiente nunca são sobrescritas.
const envFiles = PACKAGED ? [path.join(APP_DIR, '.env')] : [path.join(SERVER_ROOT, '.env'), path.join(REPO_ROOT, '.env')];
for (const file of envFiles) {
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
export const WEB_DIST = PACKAGED ? path.join(APP_DIR, 'web') : path.join(REPO_ROOT, 'apps', 'web', 'dist');

/**
 * No exe, sem JWT_SECRET definido, gera um segredo aleatório na primeira execução e o
 * guarda em data/segredo.key (assim as sessões continuam válidas entre reinícios).
 */
function packagedSecret(): string {
  const file = path.join(DATA_DIR, 'segredo.key');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  } catch {
    // primeira execução
  }
  const secret = randomBytes(48).toString('base64url');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, secret, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

const DEV_SECRET = 'ucop-dev-secret-NAO-USE-EM-PRODUCAO';
export const JWT_SECRET = process.env.JWT_SECRET || (PACKAGED ? packagedSecret() : DEV_SECRET);
if (!process.env.JWT_SECRET && !PACKAGED) {
  console.warn(
    '\n[ucop] ⚠  JWT_SECRET não definido — usando um segredo de desenvolvimento.\n' +
      '[ucop]    Defina JWT_SECRET no ambiente ou em .env antes de expor o servidor.\n',
  );
}

/**
 * Origens que podem chamar a API de outro endereço: o app de celular (Capacitor serve o
 * app em http://localhost / https://localhost dentro do APK). A autenticação dessas
 * chamadas é só por token no cabeçalho (sem cookies). UCOP_CORS_ORIGINS acrescenta outras,
 * separadas por vírgula.
 */
export const CORS_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  ...(process.env.UCOP_CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias
export const AUTH_COOKIE = 'ucop_token';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
