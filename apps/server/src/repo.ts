import { randomInt, randomUUID } from 'node:crypto';
import {
  sheetSchemaFor,
  type Campaign,
  type CampaignSummary,
  type GameSystem,
  type Member,
  type Role,
  type RollRecord,
  type Scene,
  type Sheet,
  type SheetData,
  type SheetSystem,
  type Token,
  type User,
} from '@ucop/shared';
import { db } from './db';

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------
interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}
interface CampaignRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  active_scene_id: string | null;
  system: GameSystem;
  determination: number;
  players_move_own_only: number;
  created_at: string;
}
interface MemberRow {
  campaign_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  name: string;
}
interface SceneRow {
  id: string;
  campaign_id: string;
  name: string;
  background_url: string | null;
  grid_size: number;
  width: number;
  height: number;
  created_at: string;
}
interface TokenRow {
  id: string;
  scene_id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  image_url: string | null;
  owner_id: string | null;
  hidden: number;
  sheet_id: string | null;
  created_at: string;
}
interface SheetRow {
  id: string;
  campaign_id: string;
  owner_id: string | null;
  system: SheetSystem;
  name: string;
  data: string;
  created_at: string;
  updated_at: string;
}
interface RollRow {
  id: string;
  campaign_id: string;
  user_id: string;
  user_name: string;
  label: string;
  secret: number;
  detail: string;
  created_at: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  createdAt: r.created_at,
});

export function toCampaign(r: CampaignRow, role: Role): Campaign {
  return {
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    activeSceneId: r.active_scene_id,
    ...(role === 'gm' ? { inviteCode: r.invite_code } : {}),
    system: r.system,
    determination: r.determination === 1,
    playersMoveOwnOnly: r.players_move_own_only !== 0,
    createdAt: r.created_at,
  };
}

const toMember = (r: MemberRow): Member => ({
  campaignId: r.campaign_id,
  userId: r.user_id,
  name: r.name,
  role: r.role,
  joinedAt: r.joined_at,
});

const toScene = (r: SceneRow): Scene => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name,
  backgroundUrl: r.background_url,
  gridSize: r.grid_size,
  width: r.width,
  height: r.height,
  createdAt: r.created_at,
});

const toToken = (r: TokenRow): Token => ({
  id: r.id,
  sceneId: r.scene_id,
  name: r.name,
  x: r.x,
  y: r.y,
  size: r.size,
  color: r.color,
  imageUrl: r.image_url,
  ownerId: r.owner_id,
  hidden: r.hidden === 1,
  sheetId: r.sheet_id,
});

const toSheet = (r: SheetRow): Sheet => ({
  id: r.id,
  campaignId: r.campaign_id,
  ownerId: r.owner_id,
  system: r.system,
  name: r.name,
  // Normaliza dados antigos/incompletos com os padrões atuais do schema.
  data: sheetSchemaFor(r.system).parse(JSON.parse(r.data)),
  updatedAt: r.updated_at,
});

const toRoll = (r: RollRow): RollRecord => ({
  id: r.id,
  campaignId: r.campaign_id,
  userId: r.user_id,
  userName: r.user_name,
  label: r.label,
  secret: r.secret === 1,
  createdAt: r.created_at,
  detail: JSON.parse(r.detail) as RollRecord['detail'],
});

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------
export const users = {
  findById(id: string): User | undefined {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row && toUser(row);
  },
  findAuthByEmail(email: string): { user: User; passwordHash: string } | undefined {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row && { user: toUser(row), passwordHash: row.password_hash };
  },
  create(input: { name: string; email: string; passwordHash: string }): User {
    const row: UserRow = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      password_hash: input.passwordHash,
      created_at: now(),
    };
    db.prepare(
      'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (@id, @email, @name, @password_hash, @created_at)',
    ).run(row);
    return toUser(row);
  },
};

// ---------------------------------------------------------------------------
// Campanhas e membros
// ---------------------------------------------------------------------------
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

function generateInviteCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    const exists = db.prepare('SELECT 1 FROM campaigns WHERE invite_code = ?').get(code);
    if (!exists) return code;
  }
}

export const campaigns = {
  findRow(id: string): CampaignRow | undefined {
    return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as CampaignRow | undefined;
  },
  findRowByInvite(code: string): CampaignRow | undefined {
    return db.prepare('SELECT * FROM campaigns WHERE invite_code = ?').get(code) as
      | CampaignRow
      | undefined;
  },
  listForUser(userId: string): CampaignSummary[] {
    const rows = db
      .prepare(
        `SELECT c.*, m.role AS role,
                (SELECT COUNT(*) FROM members mm WHERE mm.campaign_id = c.id) AS member_count
           FROM campaigns c
           JOIN members m ON m.campaign_id = c.id AND m.user_id = ?
          ORDER BY c.created_at DESC`,
      )
      .all(userId) as (CampaignRow & { role: Role; member_count: number })[];
    return rows.map((r) => ({ ...toCampaign(r, r.role), role: r.role, memberCount: r.member_count }));
  },
  create: db.transaction(
    (input: { name: string; system: GameSystem; determination: boolean }, ownerId: string): CampaignRow => {
      const row: CampaignRow = {
        id: randomUUID(),
        name: input.name,
        owner_id: ownerId,
        invite_code: generateInviteCode(),
        active_scene_id: null,
        system: input.system,
        determination: input.determination ? 1 : 0,
        players_move_own_only: 1,
        created_at: now(),
      };
      db.prepare(
        `INSERT INTO campaigns (id, name, owner_id, invite_code, active_scene_id, system, determination, created_at)
         VALUES (@id, @name, @owner_id, @invite_code, @active_scene_id, @system, @determination, @created_at)`,
      ).run(row);
      members.add(row.id, ownerId, 'gm');
      return row;
    },
  ),
  update(
    id: string,
    patch: { name?: string; system?: GameSystem; determination?: boolean; playersMoveOwnOnly?: boolean },
  ): CampaignRow {
    const row = campaigns.findRow(id)!;
    const next = {
      ...row,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.system !== undefined ? { system: patch.system } : {}),
      ...(patch.determination !== undefined ? { determination: patch.determination ? 1 : 0 } : {}),
      ...(patch.playersMoveOwnOnly !== undefined ? { players_move_own_only: patch.playersMoveOwnOnly ? 1 : 0 } : {}),
    };
    db.prepare(
      `UPDATE campaigns SET name = @name, system = @system, determination = @determination,
              players_move_own_only = @players_move_own_only WHERE id = @id`,
    ).run(next);
    return next;
  },
  setActiveScene(campaignId: string, sceneId: string | null): void {
    db.prepare('UPDATE campaigns SET active_scene_id = ? WHERE id = ?').run(sceneId, campaignId);
  },
};

export const members = {
  get(campaignId: string, userId: string): Member | undefined {
    const row = db
      .prepare(
        `SELECT m.*, u.name AS name FROM members m JOIN users u ON u.id = m.user_id
          WHERE m.campaign_id = ? AND m.user_id = ?`,
      )
      .get(campaignId, userId) as MemberRow | undefined;
    return row && toMember(row);
  },
  list(campaignId: string): Member[] {
    const rows = db
      .prepare(
        `SELECT m.*, u.name AS name FROM members m JOIN users u ON u.id = m.user_id
          WHERE m.campaign_id = ? ORDER BY m.role = 'gm' DESC, u.name COLLATE NOCASE`,
      )
      .all(campaignId) as MemberRow[];
    return rows.map(toMember);
  },
  add(campaignId: string, userId: string, role: Role): void {
    db.prepare(
      'INSERT INTO members (campaign_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
    ).run(campaignId, userId, role, now());
  },
};

// ---------------------------------------------------------------------------
// Cenas
// ---------------------------------------------------------------------------
export const scenes = {
  get(id: string): Scene | undefined {
    const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(id) as SceneRow | undefined;
    return row && toScene(row);
  },
  list(campaignId: string): Scene[] {
    const rows = db
      .prepare('SELECT * FROM scenes WHERE campaign_id = ? ORDER BY created_at')
      .all(campaignId) as SceneRow[];
    return rows.map(toScene);
  },
  create(
    campaignId: string,
    input: { name: string; gridSize: number; width: number; height: number; backgroundUrl?: string | null },
  ): Scene {
    const row: SceneRow = {
      id: randomUUID(),
      campaign_id: campaignId,
      name: input.name,
      background_url: input.backgroundUrl ?? null,
      grid_size: input.gridSize,
      width: input.width,
      height: input.height,
      created_at: now(),
    };
    db.prepare(
      `INSERT INTO scenes (id, campaign_id, name, background_url, grid_size, width, height, created_at)
       VALUES (@id, @campaign_id, @name, @background_url, @grid_size, @width, @height, @created_at)`,
    ).run(row);
    return toScene(row);
  },
  update(scene: Scene): Scene {
    db.prepare(
      `UPDATE scenes SET name = @name, background_url = @backgroundUrl, grid_size = @gridSize,
              width = @width, height = @height WHERE id = @id`,
    ).run(scene);
    return scene;
  },
  delete(id: string): void {
    db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export const tokens = {
  get(id: string): Token | undefined {
    const row = db.prepare('SELECT * FROM tokens WHERE id = ?').get(id) as TokenRow | undefined;
    return row && toToken(row);
  },
  listBySheet(sheetId: string): Token[] {
    const rows = db.prepare('SELECT * FROM tokens WHERE sheet_id = ?').all(sheetId) as TokenRow[];
    return rows.map(toToken);
  },
  listByScene(sceneId: string): Token[] {
    const rows = db
      .prepare('SELECT * FROM tokens WHERE scene_id = ? ORDER BY created_at')
      .all(sceneId) as TokenRow[];
    return rows.map(toToken);
  },
  create(input: Omit<Token, 'id'>): Token {
    const token: Token = { id: randomUUID(), ...input };
    db.prepare(
      `INSERT INTO tokens (id, scene_id, name, x, y, size, color, image_url, owner_id, hidden, sheet_id, created_at)
       VALUES (@id, @sceneId, @name, @x, @y, @size, @color, @imageUrl, @ownerId, @hidden, @sheetId, @createdAt)`,
    ).run({ ...token, hidden: token.hidden ? 1 : 0, createdAt: now() });
    return token;
  },
  update(token: Token): Token {
    db.prepare(
      `UPDATE tokens SET name = @name, x = @x, y = @y, size = @size, color = @color,
              image_url = @imageUrl, owner_id = @ownerId, hidden = @hidden, sheet_id = @sheetId WHERE id = @id`,
    ).run({ ...token, hidden: token.hidden ? 1 : 0 });
    return token;
  },
  delete(id: string): void {
    db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// Fichas
// ---------------------------------------------------------------------------
export const sheets = {
  get(id: string): Sheet | undefined {
    const row = db.prepare('SELECT * FROM sheets WHERE id = ?').get(id) as SheetRow | undefined;
    return row && toSheet(row);
  },
  list(campaignId: string): Sheet[] {
    const rows = db
      .prepare('SELECT * FROM sheets WHERE campaign_id = ? ORDER BY system = \'creature\', name COLLATE NOCASE')
      .all(campaignId) as SheetRow[];
    return rows.map(toSheet);
  },
  create(input: { campaignId: string; ownerId: string | null; system: SheetSystem; name: string; data: SheetData }): Sheet {
    const ts = now();
    const row: SheetRow = {
      id: randomUUID(),
      campaign_id: input.campaignId,
      owner_id: input.ownerId,
      system: input.system,
      name: input.name,
      data: JSON.stringify(input.data),
      created_at: ts,
      updated_at: ts,
    };
    db.prepare(
      `INSERT INTO sheets (id, campaign_id, owner_id, system, name, data, created_at, updated_at)
       VALUES (@id, @campaign_id, @owner_id, @system, @name, @data, @created_at, @updated_at)`,
    ).run(row);
    return toSheet(row);
  },
  update(sheet: Sheet): Sheet {
    const updatedAt = now();
    db.prepare('UPDATE sheets SET name = ?, owner_id = ?, data = ?, updated_at = ? WHERE id = ?').run(
      sheet.name,
      sheet.ownerId,
      JSON.stringify(sheet.data),
      updatedAt,
      sheet.id,
    );
    return { ...sheet, updatedAt };
  },
  delete(id: string): void {
    db.prepare('DELETE FROM sheets WHERE id = ?').run(id);
  },
};

// ---------------------------------------------------------------------------
// Rolagens (histórico curto por campanha)
// ---------------------------------------------------------------------------
const ROLL_HISTORY = 100;

export const rolls = {
  add(roll: RollRecord): void {
    db.prepare(
      `INSERT INTO rolls (id, campaign_id, user_id, user_name, label, secret, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      roll.id,
      roll.campaignId,
      roll.userId,
      roll.userName,
      roll.label,
      roll.secret ? 1 : 0,
      JSON.stringify(roll.detail),
      roll.createdAt,
    );
    db.prepare(
      `DELETE FROM rolls WHERE campaign_id = ? AND id NOT IN
         (SELECT id FROM rolls WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ${ROLL_HISTORY})`,
    ).run(roll.campaignId, roll.campaignId);
  },
  recent(campaignId: string, includeSecret: boolean): RollRecord[] {
    const rows = db
      .prepare(
        `SELECT * FROM rolls WHERE campaign_id = ? ${includeSecret ? '' : 'AND secret = 0'}
          ORDER BY created_at DESC LIMIT 50`,
      )
      .all(campaignId) as RollRow[];
    return rows.map(toRoll).reverse();
  },
};
