import type { CreateTokenInput, MoveTokenInput, UpdateTokenInput } from './schemas';
import type { Campaign, Member, Role, Scene, SceneState, Token, User } from './types';

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (res: AckResponse<T>) => void;

export interface JoinResult {
  campaign: Campaign;
  role: Role;
  members: Member[];
  /** Todas as cenas (apenas para o mestre; vazio para jogadores). */
  scenes: Scene[];
  /** Estado da cena ativa, já filtrado para o papel do usuário. */
  activeScene: SceneState | null;
}

/** Eventos enviados pelo cliente. */
export interface ClientToServerEvents {
  'campaign:join': (campaignId: string, ack: Ack<JoinResult>) => void;
  /** Mestre: carrega qualquer cena da campanha para ver/editar. */
  'scene:view': (sceneId: string, ack: Ack<SceneState>) => void;
  /** Mestre: define a cena que os jogadores veem (null = nenhuma). */
  'scene:activate': (sceneId: string | null, ack: Ack<null>) => void;
  'token:create': (input: CreateTokenInput, ack: Ack<Token>) => void;
  'token:update': (input: UpdateTokenInput, ack: Ack<Token>) => void;
  'token:move': (input: MoveTokenInput, ack: Ack<Token>) => void;
  'token:delete': (tokenId: string, ack: Ack<null>) => void;
}

/** Eventos enviados pelo servidor. */
export interface ServerToClientEvents {
  /** Mestre: a lista completa de cenas mudou. */
  'scene:list': (scenes: Scene[]) => void;
  'scene:active': (sceneId: string | null) => void;
  /** Jogadores: estado completo da cena ativa (null = nenhuma). */
  'scene:state': (state: SceneState | null) => void;
  'scene:updated': (scene: Scene) => void;
  'scene:deleted': (sceneId: string) => void;
  'token:upserted': (token: Token) => void;
  'token:removed': (payload: { sceneId: string; tokenId: string }) => void;
  'member:joined': (member: Member) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

export interface SocketData {
  user: User;
  campaignId?: string;
  role?: Role;
}
