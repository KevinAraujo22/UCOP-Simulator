import type { GameSystem } from './systems';

/** Papel de um usuário dentro de uma campanha. */
export type Role = 'gm' | 'player';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  ownerId: string;
  /** Cena que os jogadores estão vendo (null = nenhuma). */
  activeSceneId: string | null;
  /** Código de convite — enviado apenas para o mestre. */
  inviteCode?: string;
  /** Sistema das fichas da campanha. */
  system: GameSystem;
  /** Ordem 1: regra opcional de pontos de determinação (PD no lugar de PE e SAN). */
  determination: boolean;
  /** Jogadores só movem os próprios tokens (desligado: movem qualquer token visível). */
  playersMoveOwnOnly: boolean;
  createdAt: string;
}

/** Campanha vista por um usuário específico (inclui o papel dele). */
export interface CampaignSummary extends Campaign {
  role: Role;
  memberCount: number;
}

export interface Member {
  campaignId: string;
  userId: string;
  name: string;
  role: Role;
  joinedAt: string;
}

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  /** URL (em /uploads) da imagem de fundo, se houver. */
  backgroundUrl: string | null;
  /** Tamanho de cada célula da grade, em pixels. */
  gridSize: number;
  /** Largura do mapa, em células. */
  width: number;
  /** Altura do mapa, em células. */
  height: number;
  createdAt: string;
}

export interface Token {
  id: string;
  sceneId: string;
  name: string;
  /** Coluna (em células) do canto superior esquerdo. */
  x: number;
  /** Linha (em células) do canto superior esquerdo. */
  y: number;
  /** Tamanho em células (1 = ocupa 1×1). */
  size: number;
  color: string;
  imageUrl: string | null;
  /** Usuário que pode mover o token (além do mestre). */
  ownerId: string | null;
  /** Tokens ocultos nunca são enviados aos jogadores. */
  hidden: boolean;
  /** Ficha vinculada (abre com duplo clique). */
  sheetId: string | null;
}

export interface SceneState {
  scene: Scene;
  tokens: Token[];
}

export interface AuthResponse {
  token: string;
  user: User;
}
