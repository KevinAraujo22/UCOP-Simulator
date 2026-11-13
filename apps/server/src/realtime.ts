import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  Member,
  Scene,
  SceneState,
  ServerToClientEvents,
  SocketData,
  Token,
} from '@ucop/shared';
import { campaigns, scenes, tokens } from './repo';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let io: IoServer | null = null;

export function setIo(server: IoServer): void {
  io = server;
}

/** Salas por campanha: mestres recebem tudo; jogadores só o que podem ver. */
export const rooms = {
  gm: (campaignId: string) => `campaign:${campaignId}:gm`,
  players: (campaignId: string) => `campaign:${campaignId}:players`,
};

export function isActiveScene(scene: Scene): boolean {
  return campaigns.findRow(scene.campaignId)?.active_scene_id === scene.id;
}

/** Estado de uma cena como o mestre vê (todos os tokens). */
export function gmSceneState(scene: Scene): SceneState {
  return { scene, tokens: tokens.listByScene(scene.id) };
}

/** Estado da cena ativa como os jogadores veem (sem tokens ocultos). */
export function playerSceneState(campaignId: string): SceneState | null {
  const activeId = campaigns.findRow(campaignId)?.active_scene_id;
  const scene = activeId ? scenes.get(activeId) : undefined;
  if (!scene) return null;
  return { scene, tokens: tokens.listByScene(scene.id).filter((t) => !t.hidden) };
}

export function emitSceneList(campaignId: string): void {
  io?.to(rooms.gm(campaignId)).emit('scene:list', scenes.list(campaignId));
}

export function emitSceneUpdated(scene: Scene): void {
  if (!io) return;
  io.to(rooms.gm(scene.campaignId)).emit('scene:updated', scene);
  if (isActiveScene(scene)) io.to(rooms.players(scene.campaignId)).emit('scene:updated', scene);
}

export function emitSceneDeleted(scene: Scene): void {
  io?.to(rooms.gm(scene.campaignId)).emit('scene:deleted', scene.id);
}

/** Avisa todos sobre a cena ativa e envia aos jogadores o estado filtrado. */
export function emitActiveScene(campaignId: string): void {
  if (!io) return;
  const activeId = campaigns.findRow(campaignId)?.active_scene_id ?? null;
  io.to(rooms.gm(campaignId)).emit('scene:active', activeId);
  const players = io.to(rooms.players(campaignId));
  players.emit('scene:active', activeId);
  players.emit('scene:state', playerSceneState(campaignId));
}

/**
 * Propaga a criação/alteração de um token. Para jogadores, um token que ficou
 * oculto vira "removido" e um token oculto nunca é enviado.
 */
export function emitTokenChanged(scene: Scene, token: Token, previous?: Token): void {
  if (!io) return;
  io.to(rooms.gm(scene.campaignId)).emit('token:upserted', token);
  if (!isActiveScene(scene)) return;
  const players = io.to(rooms.players(scene.campaignId));
  if (!token.hidden) players.emit('token:upserted', token);
  else if (previous && !previous.hidden) players.emit('token:removed', { sceneId: scene.id, tokenId: token.id });
}

export function emitTokenRemoved(scene: Scene, token: Token): void {
  if (!io) return;
  const payload = { sceneId: scene.id, tokenId: token.id };
  io.to(rooms.gm(scene.campaignId)).emit('token:removed', payload);
  if (!token.hidden && isActiveScene(scene)) io.to(rooms.players(scene.campaignId)).emit('token:removed', payload);
}

export function emitMemberJoined(member: Member): void {
  if (!io) return;
  io.to(rooms.gm(member.campaignId)).to(rooms.players(member.campaignId)).emit('member:joined', member);
}
