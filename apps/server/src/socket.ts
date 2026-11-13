import type { Socket } from 'socket.io';
import {
  clampTokenCell,
  createTokenSchema,
  moveTokenSchema,
  updateTokenSchema,
  type AckResponse,
  type ClientToServerEvents,
  type InterServerEvents,
  type Role,
  type Scene,
  type ServerToClientEvents,
  type SocketData,
  type Token,
} from '@ucop/shared';
import { userFromToken } from './auth';
import { assertCampaignUpload, HttpError, parse } from './http';
import {
  emitActiveScene,
  emitTokenChanged,
  emitTokenRemoved,
  gmSceneState,
  playerSceneState,
  rooms,
  type IoServer,
} from './realtime';
import { campaigns, members, scenes, tokens, toCampaign } from './repo';

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
        };
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
        const merged = { ...token, ...patch };
        const updated = tokens.update({ ...merged, ...clampTokenCell(merged.x, merged.y, merged.size, scene) });
        emitTokenChanged(scene, updated, token);
        return updated;
      }),
    );

    // Servidor autoritativo: o jogador só move tokens próprios, visíveis, na cena ativa.
    socket.on('token:move', (input, ack) =>
      handle(ack, () => {
        const { campaignId, role, userId } = context(socket);
        const { id, x, y } = parse(moveTokenSchema, input);
        const { token, scene } = tokenInCampaign(id, campaignId);
        if (role !== 'gm') {
          const activeId = campaigns.findRow(campaignId)?.active_scene_id;
          if (token.hidden || scene.id !== activeId) throw new HttpError(404, 'Token não encontrado');
          if (token.ownerId !== userId) throw new HttpError(403, 'Você só pode mover os seus tokens');
        }
        const updated = tokens.update({ ...token, ...clampTokenCell(x, y, token.size, scene) });
        emitTokenChanged(scene, updated, token);
        return updated;
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
