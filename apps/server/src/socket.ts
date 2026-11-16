import { randomInt, randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';
import {
  clampTokenCell,
  createSheetSchema,
  createTokenSchema,
  firstZodMessage,
  moveTokenSchema,
  placeTokenSchema,
  castRitualSchema,
  findRitual,
  newSheetData,
  op1Derive,
  RITUAL_BASE_COST,
  rollExpression,
  rollOp2,
  rollRequestSchema,
  sheetSchemaFor,
  updateSheetSchema,
  updateTokenSchema,
  type AckResponse,
  type ClientToServerEvents,
  type InterServerEvents,
  type Role,
  type RollRecord,
  type Scene,
  type ServerToClientEvents,
  type Op1SheetData,
  type Sheet,
  type SocketData,
  type Token,
} from '@ucop/shared';
import { userFromToken } from './auth';
import { assertCampaignUpload, HttpError, parse } from './http';
import {
  canSeeSheet,
  emitActiveScene,
  emitRoll,
  emitSheetRemoved,
  emitSheetUpserted,
  emitTokenChanged,
  emitTokenRemoved,
  gmSceneState,
  playerSceneState,
  rooms,
  type IoServer,
} from './realtime';
import { campaigns, members, rolls, scenes, sheets, tokens, toCampaign } from './repo';

const MAX_SHEET_BYTES = 512 * 1024;

/** Dado justo com RNG criptográfico: o resultado nasce no servidor. */
const secureDie = (sides: number) => randomInt(1, sides + 1);

/**
 * Mantém os tokens ligados à ficha em dia: troca o retrato/nome se o token ainda
 * usava o retrato/nome antigos (personalizações feitas pelo mestre são preservadas).
 */
function syncLinkedTokens(before: Sheet, after: Sheet): void {
  const oldPortrait = (before.data as { portrait?: string | null }).portrait ?? null;
  const newPortrait = (after.data as { portrait?: string | null }).portrait ?? null;
  if (oldPortrait === newPortrait && before.name === after.name) return;
  for (const token of tokens.listBySheet(after.id)) {
    const patch: Partial<Token> = {};
    if (oldPortrait !== newPortrait && (token.imageUrl === oldPortrait || token.imageUrl === null)) patch.imageUrl = newPortrait;
    if (before.name !== after.name && token.name === before.name) patch.name = after.name;
    if (!Object.keys(patch).length) continue;
    const scene = scenes.get(token.sceneId);
    if (scene) emitTokenChanged(scene, tokens.update({ ...token, ...patch }), token);
  }
}

function sheetInCampaign(sheetId: unknown, campaignId: string): Sheet {
  const sheet = typeof sheetId === 'string' ? sheets.get(sheetId) : undefined;
  if (!sheet || sheet.campaignId !== campaignId) throw new HttpError(404, 'Ficha não encontrada');
  return sheet;
}

type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Executa um handler e responde pelo ack com {ok, data} ou {ok:false, error}.
 * Erros de autorização/validação viram mensagens para o cliente.
 */
function handle<T>(ack: unknown, fn: () => T): void {
  const reply = typeof ack === 'function' ? (ack as (r: AckResponse<T>) => void) : () => {};
  try {
    reply({ ok: true, data: fn() });
  } catch (err) {
    if (err instanceof HttpError) reply({ ok: false, error: err.message });
    else {
      console.error('[ucop] erro no socket', err);
      reply({ ok: false, error: 'Erro interno do servidor' });
    }
  }
}

function context(socket: IoSocket): { campaignId: string; role: Role; userId: string } {
  const { campaignId, role, user } = socket.data;
  if (!campaignId || !role) throw new HttpError(400, 'Entre em uma campanha primeiro');
  return { campaignId, role, userId: user.id };
}

function requireGm(socket: IoSocket) {
  const ctx = context(socket);
  if (ctx.role !== 'gm') throw new HttpError(403, 'Apenas o mestre pode fazer isso');
  return ctx;
}

/** Cena da campanha atual do socket. */
function sceneInCampaign(sceneId: unknown, campaignId: string): Scene {
  const scene = typeof sceneId === 'string' ? scenes.get(sceneId) : undefined;
  if (!scene || scene.campaignId !== campaignId) throw new HttpError(404, 'Cena não encontrada');
  return scene;
}

function tokenInCampaign(tokenId: unknown, campaignId: string): { token: Token; scene: Scene } {
  const token = typeof tokenId === 'string' ? tokens.get(tokenId) : undefined;
  const scene = token && scenes.get(token.sceneId);
  if (!token || !scene || scene.campaignId !== campaignId) throw new HttpError(404, 'Token não encontrado');
  return { token, scene };
}

function assertOwnerIsMember(campaignId: string, ownerId: string | null | undefined): void {
  if (ownerId && !members.get(campaignId, ownerId)) throw new HttpError(400, 'Dono do token não é membro da campanha');
}

export function registerSocketHandlers(io: IoServer): void {
  // Autenticação do handshake: io({ auth: { token } })
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const user = userFromToken(typeof token === 'string' ? token : undefined);
    if (!user) return next(new Error('Não autenticado'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(rooms.user(socket.data.user.id));

    socket.on('campaign:join', (campaignId, ack) =>
      handle(ack, () => {
        const userId = socket.data.user.id;
        const member = typeof campaignId === 'string' ? members.get(campaignId, userId) : undefined;
        const row = member && campaigns.findRow(member.campaignId);
        if (!member || !row) throw new HttpError(404, 'Campanha não encontrada');

        // Um socket acompanha uma campanha por vez.
        if (socket.data.campaignId) {
          socket.leave(rooms.gm(socket.data.campaignId));
          socket.leave(rooms.players(socket.data.campaignId));
        }
        socket.data.campaignId = row.id;
        socket.data.role = member.role;
        socket.join(member.role === 'gm' ? rooms.gm(row.id) : rooms.players(row.id));

        const activeScene =
          member.role === 'gm'
            ? (() => {
                const scene = row.active_scene_id ? scenes.get(row.active_scene_id) : undefined;
                return scene ? gmSceneState(scene) : null;
              })()
            : playerSceneState(row.id);

        return {
          campaign: toCampaign(row, member.role),
          role: member.role,
          members: members.list(row.id),
          scenes: member.role === 'gm' ? scenes.list(row.id) : [],
          activeScene,
          sheets: sheets.list(row.id).filter((s) => canSeeSheet(s, userId, member.role)),
          rolls: rolls.recent(row.id, member.role === 'gm'),
        };
      }),
    );

    // -------------------------------------------------------------- fichas
    socket.on('sheet:create', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const data = parse(createSheetSchema, input);
        const campaign = campaigns.findRow(campaignId)!;
        if (data.creature && role !== 'gm') throw new HttpError(403, 'Apenas o mestre cria criaturas');
        let ownerId: string | null = userId;
        if (role === 'gm') {
          ownerId = data.creature ? null : (data.ownerId ?? null);
          assertOwnerIsMember(campaignId, ownerId);
        }
        const system = data.creature ? 'creature' : campaign.system;
        const sheet = sheets.create({ campaignId, ownerId, system, name: data.name, data: newSheetData(system) });
        emitSheetUpserted(sheet);
        return sheet;
      }),
    );

    socket.on('sheet:update', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const data = parse(updateSheetSchema, input);
        const sheet = sheetInCampaign(data.id, campaignId);
        if (!canSeeSheet(sheet, userId, role)) throw new HttpError(404, 'Ficha não encontrada');
        if (data.ownerId !== undefined && role !== 'gm') throw new HttpError(403, 'Apenas o mestre troca o dono');
        if (data.ownerId) {
          if (sheet.system === 'creature') throw new HttpError(400, 'Criaturas não têm dono');
          assertOwnerIsMember(campaignId, data.ownerId);
        }
        const merged = { ...(sheet.data as Record<string, unknown>), ...data.patch };
        const result = sheetSchemaFor(sheet.system).safeParse(merged);
        if (!result.success) throw new HttpError(400, firstZodMessage(result.error));
        if (JSON.stringify(result.data).length > MAX_SHEET_BYTES) throw new HttpError(400, 'Ficha grande demais');
        const portrait = (result.data as { portrait: string | null }).portrait;
        assertCampaignUpload(campaignId, portrait);
        const updated = sheets.update({
          ...sheet,
          name: data.name ?? sheet.name,
          ownerId: data.ownerId !== undefined ? data.ownerId : sheet.ownerId,
          data: result.data,
        });
        emitSheetUpserted(updated, sheet.ownerId);
        syncLinkedTokens(sheet, updated);
        return updated;
      }),
    );

    socket.on('sheet:delete', (sheetId, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const sheet = sheetInCampaign(sheetId, campaignId);
        if (role !== 'gm' && sheet.ownerId !== userId) throw new HttpError(403, 'Você só pode excluir as suas fichas');
        sheets.delete(sheet.id);
        emitSheetRemoved(sheet);
        return null;
      }),
    );

    // ------------------------------------------------------------ rituais
    // Conjurar: o servidor confere a ficha, desconta PE (ou PD, na regra de
    // Determinação) e transmite o resultado — inclusive a rolagem do efeito.
    socket.on('ritual:cast', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const req = parse(castRitualSchema, input);
        const sheet = sheetInCampaign(req.sheetId, campaignId);
        if (!canSeeSheet(sheet, userId, role)) throw new HttpError(404, 'Ficha não encontrada');
        if (sheet.system !== 'op1') throw new HttpError(400, 'A conjuração de rituais é das fichas de Ordem 1');
        const data = sheet.data as Op1SheetData;
        const ritual = data.rituals.find((r) => r.id === req.ritualId);
        if (!ritual) throw new HttpError(404, 'Ritual não encontrado na ficha');
        const cat = findRitual(ritual.ref);
        const extra = req.form === 'discente' ? cat?.discente : req.form === 'verdadeiro' ? cat?.verdadeiro : 0;
        if (req.form !== 'normal' && !extra) throw new HttpError(400, 'Este ritual não tem essa forma');
        const cost = Math.max(0, RITUAL_BASE_COST[ritual.circle] + (extra ?? 0) + req.adjust);
        const campaign = campaigns.findRow(campaignId)!;
        const key = campaign.determination ? 'pd' : 'pe';
        const current = data[key].current;
        if (current < cost) {
          throw new HttpError(400, `${key.toUpperCase()} insuficientes: ${current} disponíveis, custo ${cost}`);
        }
        let effect: ReturnType<typeof rollExpression> | null = null;
        if (req.roll?.trim()) {
          try {
            effect = rollExpression(req.roll, secureDie);
          } catch (err) {
            throw new HttpError(400, err instanceof Error ? err.message : 'Rolagem inválida');
          }
        }
        const newData: Op1SheetData = { ...data, [key]: { current: current - cost } };
        const updated = sheets.update({ ...sheet, data: newData });
        emitSheetUpserted(updated);
        const record: RollRecord = {
          id: randomUUID(),
          campaignId,
          userId,
          userName: socket.data.user.name,
          label: `${sheet.name} · ${ritual.name}`,
          secret: role === 'gm' && !!req.secret,
          createdAt: new Date().toISOString(),
          detail: {
            type: 'cast',
            ritual: ritual.name,
            element: ritual.element,
            circle: ritual.circle,
            form: req.form,
            cost,
            resource: key === 'pd' ? 'PD' : 'PE',
            remaining: current - cost,
            dt: op1Derive(newData).ritualDt,
            roll: effect,
            total: effect?.total ?? 0,
          },
        };
        rolls.add(record);
        emitRoll(record);
        return record;
      }),
    );

    // ------------------------------------------------------------- rolagens
    socket.on('roll', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role } = context(socket);
        const req = parse(rollRequestSchema, input);
        let detail: RollRecord['detail'];
        try {
          detail =
            req.type === 'expr'
              ? rollExpression(req.expression, secureDie)
              : rollOp2(req.dice, req.fear ?? null, secureDie);
        } catch (err) {
          throw new HttpError(400, err instanceof Error ? err.message : 'Rolagem inválida');
        }
        const roll: RollRecord = {
          id: randomUUID(),
          campaignId,
          userId: socket.data.user.id,
          userName: socket.data.user.name,
          label: req.label ?? '',
          secret: role === 'gm' && !!req.secret,
          createdAt: new Date().toISOString(),
          detail,
        };
        rolls.add(roll);
        emitRoll(roll);
        return roll;
      }),
    );

    socket.on('scene:view', (sceneId, ack) =>
      handle(ack, () => {
        const { campaignId } = requireGm(socket);
        return gmSceneState(sceneInCampaign(sceneId, campaignId));
      }),
    );

    socket.on('scene:activate', (sceneId, ack) =>
      handle(ack, () => {
        const { campaignId } = requireGm(socket);
        const id = sceneId === null ? null : sceneInCampaign(sceneId, campaignId).id;
        campaigns.setActiveScene(campaignId, id);
        emitActiveScene(campaignId);
        return null;
      }),
    );

    socket.on('token:create', (input, ack) =>
      handle(ack, () => {
        const { campaignId } = requireGm(socket);
        const data = parse(createTokenSchema, input);
        const scene = sceneInCampaign(data.sceneId, campaignId);
        assertOwnerIsMember(campaignId, data.ownerId);
        assertCampaignUpload(campaignId, data.imageUrl);
        if (data.sheetId) sheetInCampaign(data.sheetId, campaignId);
        const pos = clampTokenCell(data.x, data.y, data.size, scene);
        const token = tokens.create({ ...data, ...pos });
        emitTokenChanged(scene, token);
        return token;
      }),
    );

    socket.on('token:update', (input, ack) =>
      handle(ack, () => {
        const { campaignId } = requireGm(socket);
        const { id, patch } = parse(updateTokenSchema, input);
        const { token, scene } = tokenInCampaign(id, campaignId);
        assertOwnerIsMember(campaignId, patch.ownerId);
        assertCampaignUpload(campaignId, patch.imageUrl);
        if (patch.sheetId) sheetInCampaign(patch.sheetId, campaignId);
        const merged = { ...token, ...patch };
        const updated = tokens.update({ ...merged, ...clampTokenCell(merged.x, merged.y, merged.size, scene) });
        emitTokenChanged(scene, updated, token);
        return updated;
      }),
    );

    // Servidor autoritativo: o jogador só move tokens visíveis, na cena ativa, e — com o
    // toggle ligado (padrão) — apenas os próprios.
    socket.on('token:move', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const { id, x, y } = parse(moveTokenSchema, input);
        const { token, scene } = tokenInCampaign(id, campaignId);
        if (role !== 'gm') {
          const campaign = campaigns.findRow(campaignId)!;
          if (token.hidden || scene.id !== campaign.active_scene_id) throw new HttpError(404, 'Token não encontrado');
          if (token.ownerId !== userId && campaign.players_move_own_only !== 0) {
            throw new HttpError(403, 'Você só pode mover os seus tokens');
          }
        }
        const updated = tokens.update({ ...token, ...clampTokenCell(x, y, token.size, scene) });
        emitTokenChanged(scene, updated, token);
        return updated;
      }),
    );

    // Arrastar ficha → mapa. Mestre: qualquer ficha, em qualquer cena. Jogador: só as
    // próprias, na cena ativa. Se a ficha já tem token na cena, ele é movido.
    socket.on('token:place', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const data = parse(placeTokenSchema, input);
        const sheet = sheetInCampaign(data.sheetId, campaignId);
        const scene = sceneInCampaign(data.sceneId, campaignId);
        if (role !== 'gm') {
          if (sheet.system === 'creature' || sheet.ownerId !== userId) {
            throw new HttpError(403, 'Você só pode colocar os seus personagens no mapa');
          }
          if (campaigns.findRow(campaignId)?.active_scene_id !== scene.id) throw new HttpError(403, 'Esta cena não está ativa');
        }
        const existing = tokens.listByScene(scene.id).find((t) => t.sheetId === sheet.id);
        if (existing) {
          if (role !== 'gm' && existing.hidden) throw new HttpError(404, 'Token não encontrado');
          const moved = tokens.update({ ...existing, ...clampTokenCell(data.x, data.y, existing.size, scene) });
          emitTokenChanged(scene, moved, existing);
          return moved;
        }
        const creature = sheet.system === 'creature';
        const portrait = (sheet.data as { portrait?: string | null }).portrait ?? null;
        const token = tokens.create({
          sceneId: scene.id,
          name: sheet.name,
          ...clampTokenCell(data.x, data.y, 1, scene),
          size: 1,
          color: creature ? '#b91c1c' : '#7c3aed',
          imageUrl: portrait,
          ownerId: creature ? null : sheet.ownerId,
          // Criaturas entram ocultas: o mestre revela quando quiser.
          hidden: creature,
          sheetId: sheet.id,
        });
        emitTokenChanged(scene, token);
        return token;
      }),
    );

    socket.on('token:delete', (tokenId, ack) =>
      handle(ack, () => {
        const { campaignId } = requireGm(socket);
        const { token, scene } = tokenInCampaign(tokenId, campaignId);
        tokens.delete(token.id);
        emitTokenRemoved(scene, token);
        return null;
      }),
    );
  });
}
