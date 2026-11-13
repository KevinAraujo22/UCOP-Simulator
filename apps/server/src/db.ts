import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DATA_DIR, UPLOADS_DIR } from './config';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'ucop.sqlite'));
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
`);
