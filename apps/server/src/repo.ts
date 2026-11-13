import { randomInt, randomUUID } from 'node:crypto';
import type { Campaign, CampaignSummary, Member, Role, Scene, Token, User } from '@ucop/shared';
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
  create: db.transaction((name: string, ownerId: string): CampaignRow => {
    const row: CampaignRow = {
      id: randomUUID(),
      name,
      owner_id: ownerId,
      invite_code: generateInviteCode(),
      active_scene_id: null,
      created_at: now(),
    };
    db.prepare(
      `INSERT INTO campaigns (id, name, owner_id, invite_code, active_scene_id, created_at)
       VALUES (@id, @name, @owner_id, @invite_code, @active_scene_id, @created_at)`,
    ).run(row);
    members.add(row.id, ownerId, 'gm');
    return row;
  }),
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
  listByScene(sceneId: string): Token[] {
    const rows = db
      .prepare('SELECT * FROM tokens WHERE scene_id = ? ORDER BY created_at')
      .all(sceneId) as TokenRow[];
    return rows.map(toToken);
  },
  create(input: Omit<Token, 'id'>): Token {
    const token: Token = { id: randomUUID(), ...input };
    db.prepare(
      `INSERT INTO tokens (id, scene_id, name, x, y, size, color, image_url, owner_id, hidden, created_at)
       VALUES (@id, @sceneId, @name, @x, @y, @size, @color, @imageUrl, @ownerId, @hidden, @createdAt)`,
    ).run({ ...token, hidden: token.hidden ? 1 : 0, createdAt: now() });
    return token;
  },
  update(token: Token): Token {
    db.prepare(
      `UPDATE tokens SET name = @name, x = @x, y = @y, size = @size, color = @color,
              image_url = @imageUrl, owner_id = @ownerId, hidden = @hidden WHERE id = @id`,
    ).run({ ...token, hidden: token.hidden ? 1 : 0 });
    return token;
  },
  delete(id: string): void {
    db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  },
};
