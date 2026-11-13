import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Database from 'better-sqlite3';
import { APP_DIR, DATA_DIR, PACKAGED, UPLOADS_DIR } from './config';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Dentro do UCOP.exe o `require` só enxerga módulos internos do Node; o módulo nativo do
 * SQLite (better_sqlite3.node, ao lado do exe) é carregado com um require criado a
 * partir do próprio executável e entregue pronto ao better-sqlite3.
 */
function nativeBinding(): object | undefined {
  if (!PACKAGED) return undefined;
  const load = createRequire(process.execPath);
  return load(path.join(APP_DIR, 'better_sqlite3.node')) as object;
}

// Os tipos só declaram `string`, mas a biblioteca também aceita o módulo já carregado
// (lib/database.js do better-sqlite3 11).
export const db = new Database(path.join(DATA_DIR, 'ucop.sqlite'), {
  nativeBinding: nativeBinding() as unknown as string | undefined,
});
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    owner_id        TEXT NOT NULL REFERENCES users(id),
    invite_code     TEXT NOT NULL UNIQUE,
    active_scene_id TEXT,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('gm', 'player')),
    joined_at   TEXT NOT NULL,
    PRIMARY KEY (campaign_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id             TEXT PRIMARY KEY,
    campaign_id    TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    background_url TEXT,
    grid_size      INTEGER NOT NULL,
    width          INTEGER NOT NULL,
    height         INTEGER NOT NULL,
    created_at     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scenes_campaign ON scenes(campaign_id);

  CREATE TABLE IF NOT EXISTS tokens (
    id         TEXT PRIMARY KEY,
    scene_id   TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    x          INTEGER NOT NULL,
    y          INTEGER NOT NULL,
    size       INTEGER NOT NULL,
    color      TEXT NOT NULL,
    image_url  TEXT,
    owner_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    hidden     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tokens_scene ON tokens(scene_id);

  CREATE TABLE IF NOT EXISTS sheets (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    owner_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    system      TEXT NOT NULL,
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sheets_campaign ON sheets(campaign_id);

  CREATE TABLE IF NOT EXISTS rolls (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    user_name   TEXT NOT NULL,
    label       TEXT NOT NULL,
    secret      INTEGER NOT NULL DEFAULT 0,
    detail      TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rolls_campaign ON rolls(campaign_id, created_at);
`);

// Migrações simples para bancos criados antes da etapa 3.
function addColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumn('campaigns', 'system', "system TEXT NOT NULL DEFAULT 'op1'");
addColumn('campaigns', 'determination', 'determination INTEGER NOT NULL DEFAULT 0');
addColumn('campaigns', 'players_move_own_only', 'players_move_own_only INTEGER NOT NULL DEFAULT 1');
addColumn('tokens', 'sheet_id', 'sheet_id TEXT REFERENCES sheets(id) ON DELETE SET NULL');
