import type { CastRitualInput, RollRecord, RollRequest } from './dice';
import type { CreateTokenInput, MoveTokenInput, PlaceTokenInput, UpdateTokenInput } from './schemas';
import type { CreateSheetInput, Sheet, UpdateSheetInput } from './sheets';
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
  /** Mestre: todas as fichas. Jogador: apenas as próprias. */
  sheets: Sheet[];
  /** Últimas rolagens (secretas só para o mestre). */
  rolls: RollRecord[];
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
  /** Arrastar uma ficha para o mapa: cria o token dela (ou move o existente). */
  'token:place': (input: PlaceTokenInput, ack: Ack<Token>) => void;
  'token:delete': (tokenId: string, ack: Ack<null>) => void;
  'sheet:create': (input: CreateSheetInput, ack: Ack<Sheet>) => void;
  /** Dono ou mestre: troca seções inteiras da ficha (merge raso). */
  'sheet:update': (input: UpdateSheetInput, ack: Ack<Sheet>) => void;
  'sheet:delete': (sheetId: string, ack: Ack<null>) => void;
  /** O servidor rola os dados e transmite o resultado. */
  roll: (input: RollRequest, ack: Ack<RollRecord>) => void;
  /** Conjura um ritual da ficha: desconta PE/PD e transmite o resultado à mesa. */
  'ritual:cast': (input: CastRitualInput, ack: Ack<RollRecord>) => void;
}

/** Eventos enviados pelo servidor. */
export interface ServerToClientEvents {
  'campaign:updated': (campaign: Campaign) => void;
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
  'sheet:upserted': (sheet: Sheet) => void;
  'sheet:removed': (sheetId: string) => void;
  'roll:new': (roll: RollRecord) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

export interface SocketData {
  user: User;
  campaignId?: string;
  role?: Role;
}
